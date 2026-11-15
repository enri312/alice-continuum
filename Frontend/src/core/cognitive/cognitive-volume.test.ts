import { describe, expect, it } from "vitest";
import { buildCognitiveMemoryNodes } from "../memory/cognitive-memory";
import { buildCognitiveVolumeGraph, cognitiveVolumeNodeColor, cognitiveMemoryRadius, currentVolumeAssociations, resolveCognitiveMemoryAppearance } from "./cognitive-volume";
import type { ConfirmedMemoryAssociation } from "./cognitive-volume";
import type { CoreActivitySnapshot } from "./core-activity";

const activity: CoreActivitySnapshot = {
  schemaVersion: 2,
  generatedAtMs: 1_786_280_000_000,
  method: "r3-recency-motor-v2",
  heuristic: true,
  windowMs: 300_000,
  auditHealthy: true,
  visibleEventCount: 2,
  windowEventCount: 2,
  latestEventAtMs: 1_786_280_000_000,
  overallSignal: 0.4,
  regions: [
    { id: "perception", label: "Percepción", eventCount: 1, signal: .4, lastEventAtMs: 1_786_280_000_000 },
    { id: "permission", label: "Permisos", eventCount: 0, signal: 0, lastEventAtMs: null },
    { id: "memory", label: "Memoria", eventCount: 1, signal: .4, lastEventAtMs: 1_786_280_000_000 },
    { id: "language", label: "Lenguaje", eventCount: 0, signal: 0, lastEventAtMs: null },
    { id: "workspace", label: "Contexto", eventCount: 0, signal: 0, lastEventAtMs: null },
    { id: "output", label: "Salida", eventCount: 0, signal: 0, lastEventAtMs: null },
    { id: "motor", label: "Motor", eventCount: 0, signal: 0, lastEventAtMs: null },
  ],
  links: [
    { id: "permission-perception", from: "permission", to: "perception", evidenceCount: 0, signal: 0 },
    { id: "perception-workspace", from: "perception", to: "workspace", evidenceCount: 0, signal: 0 },
    { id: "memory-workspace", from: "memory", to: "workspace", evidenceCount: 0, signal: 0 },
    { id: "language-workspace", from: "language", to: "workspace", evidenceCount: 0, signal: 0 },
    { id: "workspace-output", from: "workspace", to: "output", evidenceCount: 0, signal: 0 },
  ],
};

describe("grafo trazable del volumen cognitivo", () => {
  const association: ConfirmedMemoryAssociation = {
    id: "relation-one", relation: "relatedExperience", ownerConfirmed: true,
    evidence: ["one", "two"].map(recordId => ({
      recordId, recordVersion: 1, recordSha256: `sha256:${"a".repeat(64)}`,
      field: "intention", startByte: 0, endByte: 3, quoteSha256: `sha256:${"b".repeat(64)}`,
    })),
  };
  const associatedMemories = () => buildCognitiveMemoryNodes([
    { id: "one", intention: "Uno", memoryVersion: 1 },
    { id: "two", intention: "Dos", memoryVersion: 1 },
  ]);

  it("retira arista y evidencia seleccionable al cambiar la versión de cualquiera de sus recuerdos", () => {
    const memories = associatedMemories();
    expect(buildCognitiveVolumeGraph(memories, null, [association]).persistentAssociationCount).toBe(1);
    for (const changedId of ["one", "two"]) {
      const updated = memories.map(memory => memory.id === changedId ? { ...memory, version: 2 } : memory);
      expect(currentVolumeAssociations(updated, [association])).toEqual([]);
      expect(buildCognitiveVolumeGraph(updated, null, [association]).edges).toEqual([]);
      expect(buildCognitiveVolumeGraph(updated, null, [association]).persistentAssociationCount).toBe(0);
    }
  });

  it("permite una relación revalidada contra las versiones actuales sin duplicarla", () => {
    const memories = associatedMemories().map(memory => ({ ...memory, version: 2 }));
    const renewed = { ...association, evidence: association.evidence.map(item => ({ ...item, recordVersion: 2 })) };
    expect(currentVolumeAssociations(memories, [association, renewed, renewed])).toEqual([renewed]);
    expect(buildCognitiveVolumeGraph(memories, null, [association, renewed, renewed]).persistentAssociationCount).toBe(1);
  });

  it("oculta relaciones con una fuente ausente sin alterar los nodos restantes", () => {
    const memories = associatedMemories().slice(0, 1);
    expect(currentVolumeAssociations(memories, [association])).toEqual([]);
    const graph = buildCognitiveVolumeGraph(memories, null, [association]);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.persistentAssociationCount).toBe(0);
    expect(graph.edges).toEqual([]);
  });

  it("muestra un latido técnico sólo cuando el núcleo nativo respondió y lo mantiene dentro del volumen", () => {
    const idle=buildCognitiveVolumeGraph([], null, [], true);
    expect(idle.nodes.map(n=>n.id)).toEqual(["process:runtime"]);
    expect(idle.nodes[0].detail).toContain("no indica razonamiento");
    expect(idle.edges).toEqual([]);expect(idle.persistentNodeCount).toBe(0);
    const graph=buildCognitiveVolumeGraph([], {...activity,regions:activity.regions.map(r=>({...r,eventCount:1,signal:.5}))},[],true);
    for(const node of graph.nodes){expect(Math.abs(node.x)).toBeLessThan(.65);expect(Math.abs(node.y)).toBeLessThan(.5);expect(Math.abs(node.z)).toBeLessThan(.3);}
  });
  it("representa importancia creciente con tamaño acotado y ausencia de evaluación explícita", () => {
    expect([1, 2, 3, 4, 5].map(cognitiveMemoryRadius)).toEqual([5, 7, 9, 11, 13]);
    expect(cognitiveMemoryRadius(null)).toBe(5);
    expect(cognitiveMemoryRadius(Number.NaN)).toBe(5);
    expect(cognitiveMemoryRadius(200)).toBe(13);
    expect(cognitiveMemoryRadius(-20)).toBe(5);
  });
  it("muestra cero estructura persistente sin recuerdos", () => {
    expect(buildCognitiveVolumeGraph([], null)).toEqual({ nodes: [], edges: [], persistentNodeCount: 0, processNodeCount: 0, persistentAssociationCount: 0 });
  });

  it("crea exactamente un nodo persistente por recuerdo real", () => {
    const memories = buildCognitiveMemoryNodes([
      { id: "one", intention: "Uno", memoryType: "episodic" },
      { id: "two", intention: "Dos", memoryType: "semantic" },
    ]);
    const graph = buildCognitiveVolumeGraph(memories, null);
    expect(graph.persistentNodeCount).toBe(2);
    expect(graph.nodes.filter((node) => node.kind === "memory").map((node) => node.id)).toEqual(["memory:one", "memory:two"]);
    expect(graph.edges).toEqual([]);
  });

  it("no convierte regiones R3 inactivas en nodos de proceso", () => {
    const graph = buildCognitiveVolumeGraph([], activity);
    expect(graph.nodes.map((node) => node.id)).toEqual(["process:perception", "process:memory"]);
    expect(graph.edges).toEqual([]);
  });

  it("une sólo recuerdos realmente recuperados con la recuperación actual", () => {
    const memories = buildCognitiveMemoryNodes([
      { id: "used", intention: "Utilizado", memoryStatus: "confirmed" },
      { id: "idle", intention: "En reposo", memoryStatus: "confirmed" },
    ], ["used"]);
    const graph = buildCognitiveVolumeGraph(memories, activity);
    expect(graph.nodes.some((node) => node.id === "process:retrieval")).toBe(true);
    expect(graph.edges.find((edge) => edge.id === "retrieval:used")).toMatchObject({ from: "memory:used", kind: "retrieval" });
    expect(graph.edges.some((edge) => edge.id === "retrieval:idle")).toBe(false);
  });

  it("mantiene el tipo de memoria como relleno y el conflicto como marca independiente", () => {
    const [conflict, episodic] = buildCognitiveMemoryNodes([
      { id: "conflict", intention: "Conflicto", memoryType: "semantic", memoryStatus: "conflict" },
      { id: "episode", intention: "Episodio", memoryType: "episodic", memoryStatus: "confirmed" },
    ]).map((memory) => buildCognitiveVolumeGraph([memory], null).nodes[0]);
    expect(cognitiveVolumeNodeColor(conflict)).toEqual([167, 139, 250]);
    expect(resolveCognitiveMemoryAppearance(conflict.memory!)).toMatchObject({
      fillMode: "layer", states: [{ id: "conflict", color: [248, 113, 113] }],
    });
    expect(cognitiveVolumeNodeColor(episodic)).toEqual([34, 211, 238]);
  });

  it("mezcla colores sólo cuando el recuerdo contiene asociaciones emocionales confirmadas", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "moment", intention: "Momento", memoryStatus: "confirmed", affects: [
      { emotion: "joy", intensity: .75, evidence: "Estoy feliz" },
      { emotion: "nostalgia", intensity: .25, evidence: "y con nostalgia" },
    ] }]);
    expect(cognitiveVolumeNodeColor(buildCognitiveVolumeGraph([memory], null).nodes[0])).toEqual([238, 202, 100]);
    const appearance = resolveCognitiveMemoryAppearance(memory);
    expect(appearance.fillMode).toBe("affect");
    expect(appearance.fillLabel).toContain("Mezcla emocional revisada");
    expect(appearance.fillLabel).toContain("Alegría (75%)");
    expect(appearance.fillLabel).toContain("Nostalgia (25%)");
  });

  it("mantiene visible un recuerdo en reposo sin ruta de recuperación", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "dormant", intention: "En reposo", memoryType: "episodic", memoryStatus: "confirmed", accessibilityStatus: "dormant" }], ["dormant"]);
    const graph = buildCognitiveVolumeGraph([memory], null);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.nodes[0].detail).toContain("dormant");
    expect(cognitiveVolumeNodeColor(graph.nodes[0])).toEqual([34, 211, 238]);
    expect(resolveCognitiveMemoryAppearance(memory)).toMatchObject({ states: [{ id: "dormant" }], opacity: .4 });
    expect(graph.edges).toEqual([]);
  });

  it("atenúa un recuerdo suprimido y conserva su identidad sin ruta activa", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "suppressed", intention: "Suprimido", memoryType: "episodic", memoryStatus: "confirmed", suppressionStatus: "suppressed" }], ["suppressed"]);
    const graph = buildCognitiveVolumeGraph([memory], null);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.nodes[0].detail).toContain("suppressed");
    expect(cognitiveVolumeNodeColor(graph.nodes[0])).toEqual([34, 211, 238]);
    expect(resolveCognitiveMemoryAppearance(memory)).toMatchObject({ states: [{ id: "suppressed" }], opacity: .28 });
    expect(graph.edges).toEqual([]);
  });

  it("recupera un recuerdo sin convertir el relleno de su capa en blanco", () => {
    const input = [{ id: "semantic", intention: "Una enseñanza", memoryType: "semantic" as const, memoryStatus: "confirmed" as const }];
    const [idle] = buildCognitiveMemoryNodes(input);
    const [retrieved] = buildCognitiveMemoryNodes(input, ["semantic"]);
    expect(retrieved.retrieved).toBe(true);
    expect(resolveCognitiveMemoryAppearance(retrieved)).toMatchObject({
      color: [167, 139, 250], fillMode: "layer", fillLabel: "Tipo de memoria: Semántica", opacity: .95,
    });
    expect(resolveCognitiveMemoryAppearance(retrieved).color).toEqual(resolveCognitiveMemoryAppearance(idle).color);
    expect(cognitiveVolumeNodeColor(buildCognitiveVolumeGraph([retrieved], null).nodes[0])).toEqual([167, 139, 250]);
  });

  it("mantiene semántica una lección pendiente y diferencia su revisión del relleno procedimental", () => {
    const [pending, available, procedure] = buildCognitiveMemoryNodes([
      { id: "pending", intention: "Álgebra", memoryType: "semantic", studyLearning: true, studyState: "review", studyPasses: 0 },
      { id: "available", intention: "Aritmética", memoryType: "semantic", studyLearning: true, studyState: "available", studyPasses: 1 },
      { id: "procedure", intention: "Pasos de cálculo", memoryType: "procedural", memoryStatus: "confirmed" },
    ]);
    const appearance = resolveCognitiveMemoryAppearance(pending);
    expect(appearance.color).toEqual([167, 139, 250]);
    expect(appearance.color).toEqual(resolveCognitiveMemoryAppearance(available).color);
    expect(appearance.states.map(state => state.id)).toEqual(["review", "historical"]);
    expect(appearance.states[0]).toMatchObject({ color: [251, 191, 36], dash: [4, 3] });
    expect(appearance.color).not.toEqual(resolveCognitiveMemoryAppearance(procedure).color);
    expect(pending.retrieved).toBe(false);
  });

  it("distingue la ira revisada del anillo de conflicto y conserva su intensidad registrada", () => {
    const [anger] = buildCognitiveMemoryNodes([
      { id: "anger", intention: "Un enojo", memoryStatus: "confirmed", affects: [{ emotion: "anger", intensity: .6, evidence: "Estoy enojado" }] },
    ]);
    expect(resolveCognitiveMemoryAppearance(anger)).toMatchObject({
      color: [240, 68, 68], fillMode: "affect", fillLabel: "Emoción revisada: Ira (60%)", states: [],
    });
    const conflict = resolveCognitiveMemoryAppearance({ ...anger, status: "conflict" });
    expect(conflict.fillMode).toBe("layer");
    expect(conflict.states[0]).toMatchObject({ id: "conflict", color: [248, 113, 113] });
  });

  it("atenúa el archivo sin sustituir la asociación de alegría ya revisada", () => {
    const [memory] = buildCognitiveMemoryNodes([
      { id: "joy", intention: "Alegría guardada", memoryStatus: "confirmed", archiveStatus: "archived", affects: [{ emotion: "joy", intensity: .5, evidence: "Estoy feliz" }] },
    ]);
    expect(resolveCognitiveMemoryAppearance(memory)).toMatchObject({
      color: [255, 216, 77], fillMode: "affect", fillLabel: "Emoción revisada: Alegría (50%)", opacity: .3,
      states: [{ id: "archived" }],
    });
    expect(buildCognitiveVolumeGraph([memory], null).edges).toEqual([]);
  });

  it("prioriza las marcas de gobierno sin ocultar los estados coexistentes ni cambiar el relleno", () => {
    const [memory] = buildCognitiveMemoryNodes([
      { id: "governed", intention: "Recuerdo en revisión", memoryType: "preference", memoryStatus: "conflict",
        deletionStatus: "scheduled", archiveStatus: "archived", suppressionStatus: "suppressed", accessibilityStatus: "dormant" },
    ]);
    const appearance = resolveCognitiveMemoryAppearance({ ...memory, studyState: "withdrawn" });
    expect(appearance.states.map(state => state.id)).toEqual(["conflict", "scheduled", "archived", "suppressed", "withdrawn", "dormant"]);
    expect(appearance.color).toEqual([244, 114, 182]);
    expect(appearance.opacity).toBe(.3);
    expect(appearance.fillMode).toBe("layer");
  });

  it("retira el color afectivo de una evaluación anterior al reconsolidar una versión nueva", () => {
    const input = { id: "versioned", intention: "Una enseñanza revisada", memoryType: "semantic" as const, memoryStatus: "confirmed" as const,
      affects: [{ emotion: "joy" as const, intensity: .8, evidence: "Estoy feliz" }] };
    const [original] = buildCognitiveMemoryNodes([input]);
    const [updated] = buildCognitiveMemoryNodes([{ ...input, memoryVersion: 2 }]);
    expect(resolveCognitiveMemoryAppearance(original).fillMode).toBe("affect");
    expect(updated.affects).toEqual([]);
    expect(resolveCognitiveMemoryAppearance(updated)).toMatchObject({
      color: [167, 139, 250], fillMode: "layer", fillLabel: "Tipo de memoria: Semántica",
    });
    expect(resolveCognitiveMemoryAppearance({ ...original, version: 2 }).fillMode).toBe("layer");
  });
});
