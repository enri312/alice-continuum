import { describe, expect, it } from "vitest";
import { parseConfirmedMemoryAssociations, parseKnowledgeGraphVolumeProjection, resolveKnowledgeGraphEvidenceQuote } from "./knowledge-graph-volume";

describe("asociaciones confirmadas para el volumen", () => {
  const hash = `sha256:${"a".repeat(64)}`;
  const evidence = (recordId: string, startByte = 0, endByte = 4) => ({
    recordId, recordVersion: 1, recordSha256: hash, field: "intention", startByte, endByte, quoteSha256: hash,
  });

  it("acepta únicamente aristas confirmadas con dos fuentes distintas", () => {
    expect(parseConfirmedMemoryAssociations({ edges: [
      { id: "link-1", relation: "relatedExperience", ownerConfirmed: true, evidence: [evidence("a"), evidence("b")] },
      { id: "link-2", relation: "relatedExperience", ownerConfirmed: false, evidence: [evidence("b"), evidence("c")] },
      { id: "link-3", relation: "relatedExperience", ownerConfirmed: true, evidence: [evidence("a"), evidence("a")] },
    ] })).toEqual([{ id: "link-1", relation: "relatedExperience", ownerConfirmed: true, evidence: [evidence("a"), evidence("b")] }]);
  });

  it("convierte evidencia incompleta o con posiciones inválidas en cero conexiones", () => {
    expect(parseConfirmedMemoryAssociations({ edges: [{ id: "bad", relation: "relatedExperience", ownerConfirmed: true, evidence: [] }] })).toEqual([]);
    expect(parseConfirmedMemoryAssociations({ edges: [{ id: "bad", relation: "relatedExperience", ownerConfirmed: true, evidence: [evidence("a", 4, 2), evidence("b")] }] })).toEqual([]);
    expect(parseConfirmedMemoryAssociations(null)).toEqual([]);
  });

  it("abre una cita usando las posiciones UTF-8 entregadas por Rust", () => {
    const text = "Me alegró este avance";
    const startByte = new TextEncoder().encode("Me ").length;
    const endByte = startByte + new TextEncoder().encode("alegró").length;
    const accentedByte = new TextEncoder().encode("Me alegr").length;
    expect(resolveKnowledgeGraphEvidenceQuote(text, startByte, endByte)).toBe("alegró");
    expect(resolveKnowledgeGraphEvidenceQuote(text, accentedByte + 1, endByte)).toBeNull();
  });

  it("distingue volumen normal, vacío y una relación cuya fuente cambió", () => {
    const base = { schemaVersion: 1, recordsModified: false, indexPersisted: false, inferencePerformed: false, edges: [] };
    expect(parseKnowledgeGraphVolumeProjection({ ...base, state: "empty", nodes: [] }, { revision: 0, associations: [] }).state).toBe("empty");
    expect(parseKnowledgeGraphVolumeProjection({ ...base, state: "ready", nodes: [{ nodeId: "record:a", lifecycle: { recordId: "a" } }] }, { revision: 0, associations: [] })).toMatchObject({ state: "normal", referenceIds: ["a"] });
    expect(parseKnowledgeGraphVolumeProjection({ ...base, state: "ready", nodes: [{ nodeId: "record:a", lifecycle: { recordId: "a" } }] }, { revision: 1, associations: [{ withdrawn: false, sourcesCurrent: false }] })).toMatchObject({ state: "sourceChanged", invalidatedAssociationCount: 1 });
  });

  it("rechaza respuestas malformadas en lugar de presentarlas como un grafo vacío", () => {
    expect(() => parseKnowledgeGraphVolumeProjection({ schemaVersion: 1, state: "ready", nodes: [] }, { revision: 0, associations: [] })).toThrow("contrato R8");
    expect(() => parseKnowledgeGraphVolumeProjection({ schemaVersion: 1, state: "ready", recordsModified: false, indexPersisted: false, inferencePerformed: false, nodes: [] }, { revision: 0, associations: [] })).toThrow("estado del grafo");
  });
});
