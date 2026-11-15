import type { ConfirmedMemoryAssociation } from "../cognitive/cognitive-volume";

type UnknownRecord = Record<string, unknown>;

export type KnowledgeGraphVolumeState = "loading" | "normal" | "empty" | "sourceChanged" | "error" | "unavailable";

export type KnowledgeGraphVolumeProjection = {
  state: Exclude<KnowledgeGraphVolumeState, "loading" | "error" | "unavailable">;
  associations: ConfirmedMemoryAssociation[];
  referenceIds: string[];
  invalidatedAssociationCount: number;
};

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;
}

export function resolveKnowledgeGraphEvidenceQuote(text: string, startByte: number, endByte: number) {
  const bytes = new TextEncoder().encode(text);
  if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte) || startByte < 0 || endByte <= startByte || endByte > bytes.length) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(startByte, endByte));
  } catch {
    return null;
  }
}

/**
 * El backend ya rechaza aristas inválidas. Esta lectura defensiva evita que una
 * respuesta nativa malformada se convierta en una conexión visual inventada.
 */
export function parseConfirmedMemoryAssociations(value: unknown): ConfirmedMemoryAssociation[] {
  const snapshot = asRecord(value);
  const edges = Array.isArray(snapshot?.edges) ? snapshot.edges : [];
  const seen = new Set<string>();
  const associations: ConfirmedMemoryAssociation[] = [];
  for (const edge of edges) {
    const row = asRecord(edge);
    const id = typeof row?.id === "string" ? row.id.trim() : "";
    const relation = row?.relation;
    const evidenceRows = Array.isArray(row?.evidence) ? row.evidence : [];
    const evidence = evidenceRows.map((item) => {
      const evidence = asRecord(item);
      const recordId = typeof evidence?.recordId === "string" ? evidence.recordId.trim() : "";
      const recordVersion = evidence?.recordVersion;
      const recordSha256 = typeof evidence?.recordSha256 === "string" ? evidence.recordSha256.trim() : "";
      const field = evidence?.field;
      const startByte = evidence?.startByte;
      const endByte = evidence?.endByte;
      const quoteSha256 = typeof evidence?.quoteSha256 === "string" ? evidence.quoteSha256.trim() : "";
      if (!recordId || !Number.isSafeInteger(recordVersion) || (recordVersion as number) < 1
        || !/^sha256:[a-f0-9]{64}$/.test(recordSha256) || field !== "intention"
        || !Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte)
        || (startByte as number) < 0 || (endByte as number) <= (startByte as number)
        || !/^sha256:[a-f0-9]{64}$/.test(quoteSha256)) return null;
      return { recordId, recordVersion: recordVersion as number, recordSha256, field, startByte: startByte as number, endByte: endByte as number, quoteSha256 } as const;
    });
    if (!id || seen.has(id) || relation !== "relatedExperience" || row?.ownerConfirmed !== true
      || evidence.length !== 2 || evidence.some((item) => item === null)
      || evidence[0]!.recordId === evidence[1]!.recordId) continue;
    seen.add(id);
    associations.push({ id, relation, ownerConfirmed: true, evidence: evidence as ConfirmedMemoryAssociation["evidence"] });
  }
  return associations;
}

export function parseKnowledgeGraphVolumeProjection(snapshotValue: unknown, associationStatusValue: unknown): KnowledgeGraphVolumeProjection {
  const snapshot = asRecord(snapshotValue);
  if (snapshot?.schemaVersion !== 1 || !["missing", "empty", "ready"].includes(String(snapshot?.state))
    || snapshot?.recordsModified !== false || snapshot?.indexPersisted !== false || snapshot?.inferencePerformed !== false
    || !Array.isArray(snapshot?.nodes)) throw new Error("El snapshot del grafo no cumple el contrato R8");

  const referenceIds: string[] = [];
  const seenReferences = new Set<string>();
  for (const item of snapshot.nodes) {
    const node = asRecord(item);
    const lifecycle = asRecord(node?.lifecycle);
    const recordId = typeof lifecycle?.recordId === "string" ? lifecycle.recordId.trim() : "";
    if (!recordId || node?.nodeId !== `record:${recordId}` || seenReferences.has(recordId)) throw new Error("El grafo contiene una referencia de memoria inválida");
    seenReferences.add(recordId);
    referenceIds.push(recordId);
  }

  if ((snapshot.state === "ready") !== (referenceIds.length > 0)) throw new Error("El estado del grafo no coincide con sus referencias");
  const associations = parseConfirmedMemoryAssociations(snapshot).filter((association) => association.evidence.every((item) => seenReferences.has(item.recordId)));
  const status = asRecord(associationStatusValue);
  if (!status || !Number.isSafeInteger(status.revision) || (status.revision as number) < 0 || !Array.isArray(status.associations)) throw new Error("El estado de relaciones no cumple el contrato R8");
  let invalidatedAssociationCount = 0;
  for (const item of status.associations) {
    const relation = asRecord(item);
    if (!relation || typeof relation.withdrawn !== "boolean" || typeof relation.sourcesCurrent !== "boolean") throw new Error("El historial de relaciones contiene un estado inválido");
    if (!relation.withdrawn && !relation.sourcesCurrent) invalidatedAssociationCount += 1;
  }
  return {
    state: invalidatedAssociationCount > 0 ? "sourceChanged" : snapshot.state === "ready" ? "normal" : "empty",
    associations,
    referenceIds,
    invalidatedAssociationCount,
  };
}
