import { describe, expect, it } from "vitest";
import { buildCognitiveMemoryNodes } from "../memory/cognitive-memory";
import { buildCognitiveVolumeGraph, cognitiveVolumeNodeColor, cognitiveMemoryRadius } from "./cognitive-volume";
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

  it("diferencia estado y capa mediante reglas explícitas", () => {
    const [conflict, episodic] = buildCognitiveMemoryNodes([
      { id: "conflict", intention: "Conflicto", memoryType: "semantic", memoryStatus: "conflict" },
      { id: "episode", intention: "Episodio", memoryType: "episodic", memoryStatus: "confirmed" },
    ]).map((memory) => buildCognitiveVolumeGraph([memory], null).nodes[0]);
    expect(cognitiveVolumeNodeColor(conflict)).toEqual([248, 113, 113]);
    expect(cognitiveVolumeNodeColor(episodic)).toEqual([34, 211, 238]);
  });

  it("mezcla colores sólo cuando el recuerdo contiene asociaciones emocionales confirmadas", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "moment", intention: "Momento", memoryStatus: "confirmed", affects: [
      { emotion: "joy", intensity: .75, evidence: "Estoy feliz" },
      { emotion: "nostalgia", intensity: .25, evidence: "y con nostalgia" },
    ] }]);
    expect(cognitiveVolumeNodeColor(buildCognitiveVolumeGraph([memory], null).nodes[0])).toEqual([238, 202, 100]);
  });

  it("mantiene visible un recuerdo en reposo sin ruta de recuperación", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "dormant", intention: "En reposo", memoryStatus: "confirmed", accessibilityStatus: "dormant" }], ["dormant"]);
    const graph = buildCognitiveVolumeGraph([memory], null);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.nodes[0].detail).toContain("dormant");
    expect(cognitiveVolumeNodeColor(graph.nodes[0])).toEqual([100, 116, 139]);
    expect(graph.edges).toEqual([]);
  });

  it("atenúa un recuerdo suprimido y conserva su identidad sin ruta activa", () => {
    const [memory] = buildCognitiveMemoryNodes([{ id: "suppressed", intention: "Suprimido", memoryStatus: "confirmed", suppressionStatus: "suppressed" }], ["suppressed"]);
    const graph = buildCognitiveVolumeGraph([memory], null);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.nodes[0].detail).toContain("suppressed");
    expect(cognitiveVolumeNodeColor(graph.nodes[0])).toEqual([88, 72, 94]);
    expect(graph.edges).toEqual([]);
  });
});
