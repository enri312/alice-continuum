import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { retrieveMemories } from "../../src/core/memory/memory-retrieval";

const enabled = process.env.ALICE_R8_REAL_EMBEDDING_EVAL === "1";
const engine = "D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe";
const modelPath = "D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf";
const modelId = "gemma-4-E2B-it-Q4_K_M";
const endpoint = "http://127.0.0.1:18089";
const pooling = process.env.ALICE_R8_POOLING || "mean";
if (!new Set(["mean", "last"]).has(pooling)) throw new Error("ALICE_R8_POOLING solo admite mean o last");

type RecordShape = {
  id: string;
  kind?: string;
  intention: string;
  summary?: string;
  nextStep?: string;
  memoryStatus?: string;
  accessibilityStatus?: string;
  suppressionStatus?: string;
  archiveStatus?: string;
  deletionStatus?: string;
};

type OwnerProfile = {
  records: Array<{
    id: string;
    intention: string;
    summary: string;
    memoryStatus?: string;
  }>;
};

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function eligible(record: RecordShape) {
  return Boolean(record.id && record.intention?.trim())
    && (!record.memoryStatus || record.memoryStatus === "confirmed")
    && record.accessibilityStatus !== "dormant"
    && record.suppressionStatus !== "suppressed"
    && record.archiveStatus !== "archived"
    && record.deletionStatus !== "pending"
    && record.deletionStatus !== "deleted";
}

function embeddingText(record: RecordShape) {
  if (record.kind === "Conversación") return record.intention.trim();
  return [record.intention, record.summary, record.nextStep].filter(Boolean).join("\n").trim();
}

function cosine(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function portIsOccupied() {
  try {
    await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(600) });
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReady(child: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El servidor de embeddings terminó con código ${child.exitCode}`);
    try {
      const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch {
      // El modelo todavía está cargando.
    }
    await sleep(250);
  }
  throw new Error("Gemma no inició el modo embeddings dentro de 90 segundos");
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill();
  const deadline = Date.now() + 10_000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function embed(input: string[]) {
  const started = performance.now();
  const response = await fetch(`${endpoint}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: modelId, input }),
    signal: AbortSignal.timeout(180_000),
  });
  const value = await response.json() as { data?: Array<{ index: number; embedding: number[] }>; error?: { message?: string } };
  if (!response.ok || !value.data) throw new Error(value.error?.message || `Embeddings HTTP ${response.status}`);
  return {
    vectors: [...value.data].sort((left, right) => left.index - right.index).map((item) => item.embedding),
    elapsedMs: Math.round(performance.now() - started),
  };
}

describe.skipIf(!enabled)("R8.3 · evaluación real de Gemma como único modelo", () => {
  it("compara embeddings causales con recuperación léxica sin modificar recuerdos", async () => {
    expect(await portIsOccupied(), "Apagá Gemma desde Configuración antes de ejecutar R8.3").toBe(false);
    const ollama = await fetch("http://127.0.0.1:11434/api/ps", { signal: AbortSignal.timeout(2_000) });
    const ollamaState = await ollama.json() as { models?: unknown[] };
    expect(ollamaState.models, "Ollama debe responder con su lista de modelos").toEqual([]);

    const dataRoot = process.env.ALICE_DATA_DIR || "data";
    const recordsPath = `${dataRoot.replace(/[\\/]$/, "")}/memory/records.json`;
    const profilePath = `${dataRoot.replace(/[\\/]$/, "")}/memory/owner-profile.json`;
    const before = await readFile(recordsPath);
    const profileBefore = await readFile(profilePath);
    const records = (JSON.parse(before.toString("utf8")) as RecordShape[]).filter(eligible);
    const profile = (JSON.parse(profileBefore.toString("utf8")) as OwnerProfile).records
      .filter((record) => record.memoryStatus === "confirmed" && record.intention?.trim() && record.summary?.trim());
    expect(records.length).toBeGreaterThan(1);
    expect(profile.length).toBeGreaterThan(1);

    const child = spawn(engine, [
      "-m", modelPath,
      "--embeddings", "--pooling", pooling, "--embd-normalize", "2",
      "--host", "127.0.0.1", "--port", "18089",
      "-c", "4096", "-np", "1", "-ngl", "24", "-t", "8",
      "--no-webui", "--no-agent",
    ], { windowsHide: true, stdio: "ignore" });

    try {
      await waitUntilReady(child);
      const texts = records.map(embeddingText);
      const { vectors, elapsedMs } = await embed([...texts, texts[0]]);
      expect(vectors).toHaveLength(texts.length + 1);
      const dimensions = vectors[0].length;
      expect(dimensions).toBeGreaterThan(0);
      expect(vectors.every((vector) => vector.length === dimensions && vector.every(Number.isFinite))).toBe(true);

      let semanticTop1 = 0;
      let semanticTop3 = 0;
      let lexicalTop1 = 0;
      let lexicalTop3 = 0;
      records.forEach((record, queryIndex) => {
        const semantic = vectors.slice(0, records.length)
          .map((vector, index) => ({ id: records[index].id, score: cosine(vectors[queryIndex], vector) }))
          .sort((left, right) => right.score - left.score);
        const lexical = retrieveMemories(record.intention, records, 3);
        if (semantic[0]?.id === record.id) semanticTop1 += 1;
        if (semantic.slice(0, 3).some((item) => item.id === record.id)) semanticTop3 += 1;
        if (lexical[0]?.memory.id === record.id) lexicalTop1 += 1;
        if (lexical.some((item) => item.memory.id === record.id)) lexicalTop3 += 1;
      });

      const repeatedCosine = cosine(vectors[0], vectors.at(-1)!);
      const profileQueries = profile.map((record) => record.intention.trim());
      const profileDocuments = profile.map((record) => record.summary.trim());
      const profileEmbedding = await embed([...profileQueries, ...profileDocuments]);
      const profileQueryVectors = profileEmbedding.vectors.slice(0, profile.length);
      const profileDocumentVectors = profileEmbedding.vectors.slice(profile.length);
      let profileSemanticTop1 = 0;
      let profileSemanticTop3 = 0;
      let profileLexicalTop1 = 0;
      let profileLexicalTop3 = 0;
      const lexicalProfileDocuments = profile.map((record) => ({
        id: record.id,
        kind: "Perfil",
        intention: "",
        summary: record.summary,
        memoryStatus: "confirmed" as const,
      }));
      profile.forEach((record, queryIndex) => {
        const semantic = profileDocumentVectors
          .map((vector, index) => ({ id: profile[index].id, score: cosine(profileQueryVectors[queryIndex], vector) }))
          .sort((left, right) => right.score - left.score);
        const lexical = retrieveMemories(record.intention, lexicalProfileDocuments, 3);
        if (semantic[0]?.id === record.id) profileSemanticTop1 += 1;
        if (semantic.slice(0, 3).some((item) => item.id === record.id)) profileSemanticTop3 += 1;
        if (lexical[0]?.memory.id === record.id) profileLexicalTop1 += 1;
        if (lexical.some((item) => item.memory.id === record.id)) profileLexicalTop3 += 1;
      });
      const after = await readFile(recordsPath);
      const profileAfter = await readFile(profilePath);
      expect(sha256(after)).toBe(sha256(before));
      expect(sha256(profileAfter)).toBe(sha256(profileBefore));
      expect(repeatedCosine).toBeGreaterThan(0.9999);
      console.log(JSON.stringify({
        realEligibleRecords: records.length,
        realConfirmedProfileRecords: profile.length,
        pooling,
        dimensions,
        memoryBatchLatencyMs: elapsedMs,
        profileBatchLatencyMs: profileEmbedding.elapsedMs,
        lexicalSelfTop1: lexicalTop1 / records.length,
        lexicalSelfTop3: lexicalTop3 / records.length,
        semanticSelfTop1: semanticTop1 / records.length,
        semanticSelfTop3: semanticTop3 / records.length,
        profileLexicalTop1: profileLexicalTop1 / profile.length,
        profileLexicalTop3: profileLexicalTop3 / profile.length,
        profileSemanticTop1: profileSemanticTop1 / profile.length,
        profileSemanticTop3: profileSemanticTop3 / profile.length,
        repeatedCosine: Number(repeatedCosine.toFixed(6)),
        sourcePreserved: true,
        indexPersisted: false,
      }));
    } finally {
      await stopChild(child);
    }
    expect(await portIsOccupied()).toBe(false);
  }, 180_000);
});
