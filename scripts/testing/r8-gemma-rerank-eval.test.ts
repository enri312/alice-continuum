import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { retrieveMemories } from "../../Frontend/src/core/memory/memory-retrieval";
import { createRerankReport, resolveRerankPython, type RerankReportRequest } from "./r8-report.mjs";

const enabled = process.env.ALICE_R8_REAL_RERANK_EVAL === "1";
const engine = "D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe";
const modelPath = "D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf";
const modelId = "gemma-4-E2B-it-Q4_K_M";
const endpoint = "http://127.0.0.1:18089";

type ProfileRecord = { id: string; intention: string; summary: string; memoryStatus?: string };
type OwnerProfile = { records: ProfileRecord[] };

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    if (child.exitCode !== null) throw new Error(`El servidor de reranqueo terminó con código ${child.exitCode}`);
    try {
      const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch {
      // Gemma todavía está cargando.
    }
    await sleep(250);
  }
  throw new Error("Gemma no inició el modo chat dentro de 90 segundos");
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill();
  const deadline = Date.now() + 10_000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function rotate<T>(items: T[], offset: number) {
  const index = offset % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

async function rank(query: string, candidates: ProfileRecord[]) {
  const labeled = candidates.map((candidate, index) => ({
    candidate,
    label: `R${String(index + 1).padStart(2, "0")}`,
  }));
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      temperature: 0,
      max_tokens: 128,
      messages: [
        {
          role: "system",
          content: "Ordena los tres recuerdos más relacionados con la consulta. Usa sólo IDs suministrados. La similitud no prueba que el contenido sea verdadero. Devuelve exclusivamente JSON válido.",
        },
        {
          role: "user",
          content: `CONSULTA\n${query}\n\nCANDIDATOS\n${labeled.map(({ candidate, label }) => `ID ${label}\n${candidate.summary}`).join("\n\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "memory_ranking",
          strict: true,
          schema: {
            type: "object",
            properties: {
              ids: {
                type: "array",
                items: { type: "string", enum: labeled.map((item) => item.label) },
                minItems: 3,
                maxItems: 3,
                uniqueItems: true,
              },
            },
            required: ["ids"],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const value = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message || `Reranqueo HTTP ${response.status}`);
  const content = value.choices?.[0]?.message?.content;
  if (!content) throw new Error("Gemma no devolvió el ranking");
  const parsed = JSON.parse(content) as { ids?: string[] };
  if (!Array.isArray(parsed.ids) || parsed.ids.length !== 3) throw new Error("Ranking JSON inválido");
  const allowed = new Map(labeled.map((item) => [item.label, item.candidate.id]));
  if (new Set(parsed.ids).size !== 3 || parsed.ids.some((id) => !allowed.has(id))) {
    throw new Error("Gemma devolvió IDs repetidos o ajenos a los candidatos");
  }
  return parsed.ids.map((id) => allowed.get(id)!);
}

describe.skipIf(!enabled)("R8.3 · reranqueo real con la misma Gemma", () => {
  it("compara ranking semántico y léxico sobre el perfil confirmado", async () => {
    const pythonExecutable = resolveRerankPython(); // Fail before loading a model if the offline reporter is unavailable.
    expect(await portIsOccupied(), "Apagá Gemma desde Configuración antes de ejecutar R8.3").toBe(false);
    const ollama = await fetch("http://127.0.0.1:11434/api/ps", { signal: AbortSignal.timeout(2_000) });
    expect((await ollama.json() as { models?: unknown[] }).models).toEqual([]);

    const dataRoot = process.env.ALICE_DATA_DIR || "data";
    const profilePath = `${dataRoot.replace(/[\\/]$/, "")}/memory/owner-profile.json`;
    const before = await readFile(profilePath);
    const profile = (JSON.parse(before.toString("utf8")) as OwnerProfile).records
      .filter((record) => record.memoryStatus === "confirmed" && record.id && record.intention?.trim() && record.summary?.trim());
    expect(profile.length).toBeGreaterThan(2);
    const candidateIndexes = new Map(profile.map((record, index) => [record.id, index]));
    expect(candidateIndexes.size, "El perfil no debe contener IDs duplicados").toBe(profile.length);

    const child = spawn(engine, [
      "-m", modelPath,
      "--host", "127.0.0.1", "--port", "18089",
      "-c", "4096", "-np", "1", "-ngl", "24", "-t", "8",
      "--reasoning", "off", "--jinja", "--no-webui", "--no-agent",
    ], { windowsHide: true, stdio: "ignore" });

    try {
      await waitUntilReady(child);
      const rankings: RerankReportRequest["rankings"] = [];
      const started = performance.now();
      for (let index = 0; index < profile.length; index += 1) {
        const expected = profile[index];
        const candidates = rotate(profile, index + 1);
        const ids = await rank(expected.intention, candidates);

        const lexicalCandidates = candidates.map((candidate) => ({
          id: candidate.id,
          kind: "Perfil",
          intention: "",
          summary: candidate.summary,
          memoryStatus: "confirmed" as const,
        }));
        const lexical = retrieveMemories(expected.intention, lexicalCandidates, 3);
        rankings.push({
          lexical: lexical.map((match) => candidateIndexes.get(match.memory.id)!),
          reranked: ids.map((id) => candidateIndexes.get(id)!),
        });
      }
      const elapsedMs = Math.round(performance.now() - started);
      expect(sha256(await readFile(profilePath))).toBe(sha256(before));
      console.log(JSON.stringify(createRerankReport({
        schemaVersion: 1,
        rankings,
        totalRerankLatencyMs: elapsedMs,
        sourcePreserved: true,
      }, { pythonExecutable })));
    } finally {
      await stopChild(child);
    }
    expect(await portIsOccupied()).toBe(false);
  }, 240_000);
});
