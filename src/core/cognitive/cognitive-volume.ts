import type { CognitiveMemoryNode, CognitiveMemoryLayer, CognitiveMemoryStatus } from "../memory/cognitive-memory";
import type { CoreActivityRegionId, CoreActivitySnapshot } from "./core-activity";
import { affectPalette } from "./affect";

export type CognitiveVolumeNode = {
  id: string;
  kind: "memory" | "process";
  label: string;
  detail: string;
  x: number;
  y: number;
  z: number;
  signal: number;
  memory: CognitiveMemoryNode | null;
  processRegion: CoreActivityRegionId | "retrieval" | null;
};

export type CognitiveVolumeEdge = {
  id: string;
  from: string;
  to: string;
  kind: "association" | "audit" | "retrieval";
  evidenceCount: number;
  signal: number;
};

export type ConfirmedMemoryAssociation = {
  id: string;
  relation: "relatedExperience";
  ownerConfirmed: true;
  evidence: readonly {
    recordId: string;
    recordVersion: number;
    recordSha256: string;
    field: "intention";
    startByte: number;
    endByte: number;
    quoteSha256: string;
  }[];
};

export type CognitiveVolumeGraph = {
  nodes: CognitiveVolumeNode[];
  edges: CognitiveVolumeEdge[];
  persistentNodeCount: number;
  processNodeCount: number;
  persistentAssociationCount: number;
};

const processPositions: Record<CoreActivityRegionId, readonly [number, number, number]> = {
  permission: [-0.96, -0.48, -0.08],
  perception: [-0.9, 0.12, 0.04],
  language: [-0.56, 0.55, -0.02],
  memory: [0, -0.04, 0.46],
  workspace: [0.5, 0.12, 0.1],
  output: [0.88, 0.5, -0.03],
  motor: [0.94, -0.48, -0.08],
};

export const memoryLayerColors: Record<CognitiveMemoryLayer, readonly [number, number, number]> = {
  episodic: [34, 211, 238],
  semantic: [167, 139, 250],
  procedural: [251, 191, 36],
  preference: [244, 114, 182],
  self: [52, 211, 153],
  unclassified: [100, 116, 139],
};

export const memoryStatusColors: Partial<Record<CognitiveMemoryStatus, readonly [number, number, number]>> = {
  conflict: [248, 113, 113],
  archived: [71, 85, 105],
  historical: [125, 145, 166],
};

// Importancia registrada (1–5), independiente de recuperación y estabilidad.
// Ausencia de evaluación conserva un tamaño pequeño, sin inventar impacto.
export function cognitiveMemoryRadius(importance: number | null): number {
  if (importance === null || !Number.isFinite(importance)) return 5;
  return 5 + (Math.min(5, Math.max(1, importance)) - 1) * 2;
}

export function cognitiveVolumeNodeColor(node: CognitiveVolumeNode): readonly [number, number, number] {
  if (node.kind === "process") {
    if (node.processRegion === "output" || node.processRegion === "motor") return [251, 191, 36];
    if (node.processRegion === "memory" || node.processRegion === "workspace" || node.processRegion === "retrieval") return [56, 189, 248];
    return [45, 212, 191];
  }
  const memory = node.memory;
  if (!memory) return [100, 116, 139];
  if (memory.archived) return memoryStatusColors.archived!;
  if (memory.suppressed) return [88, 72, 94];
  if (memory.accessibility === "dormant") return [100, 116, 139];
  if (memory.status === "conflict") return memoryStatusColors.conflict!;
  if (memory.affects.length && memory.status === "confirmed") {
    const total = memory.affects.reduce((sum, item) => sum + item.intensity, 0);
    return [0, 1, 2].map(index => Math.round(memory.affects.reduce((sum, item) => sum + affectPalette.find(c => c.id === item.emotion)!.rgb[index] * item.intensity, 0) / total)) as [number, number, number];
  }
  if (memory.retrieved) return [224, 242, 254];
  return memoryStatusColors[memory.status] ?? memoryLayerColors[memory.layer];
}

export function buildCognitiveVolumeGraph(
  memoryNodes: CognitiveMemoryNode[],
  activity: CoreActivitySnapshot | null,
  associations: readonly ConfirmedMemoryAssociation[] = [],
): CognitiveVolumeGraph {
  const nodes: CognitiveVolumeNode[] = memoryNodes.map((memory) => ({
    id: `memory:${memory.id}`,
    kind: "memory",
    label: memory.label,
    detail: `${memory.layer} · ${memory.status} · ${memory.accessibility}${memory.archived ? " · archived" : ""}${memory.deletionScheduled ? " · deletion scheduled" : ""}${memory.suppressed ? " · suppressed" : ""}`,
    x: memory.x,
    y: memory.y,
    z: memory.z,
    signal: memory.retrieved ? 1 : 0,
    memory,
    processRegion: null,
  }));
  const activeRegions = activity?.regions.filter((region) => region.eventCount > 0) ?? [];
  for (const region of activeRegions) {
    const [x, y, z] = processPositions[region.id];
    nodes.push({
      id: `process:${region.id}`,
      kind: "process",
      label: region.label,
      detail: `${region.eventCount} eventos R3 · señal ${region.signal.toFixed(3)}`,
      x,
      y,
      z,
      signal: region.signal,
      memory: null,
      processRegion: region.id,
    });
  }

  const retrieved = memoryNodes.filter((memory) => memory.retrieved);
  if (retrieved.length) {
    nodes.push({
      id: "process:retrieval",
      kind: "process",
      label: "Recuperación actual",
      detail: `${retrieved.length} recuerdos seleccionados por la consulta local`,
      x: 0.15,
      y: 0.08,
      z: 0.58,
      signal: 1,
      memory: null,
      processRegion: "retrieval",
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: CognitiveVolumeEdge[] = [];
  for (const link of activity?.links ?? []) {
    const from = `process:${link.from}`;
    const to = `process:${link.to}`;
    if (!link.evidenceCount || !nodeIds.has(from) || !nodeIds.has(to)) continue;
    edges.push({ id: `audit:${link.id}`, from, to, kind: "audit", evidenceCount: link.evidenceCount, signal: link.signal });
  }
  for (const memory of retrieved) {
    edges.push({ id: `retrieval:${memory.id}`, from: `memory:${memory.id}`, to: "process:retrieval", kind: "retrieval", evidenceCount: 1, signal: 1 });
  }
  if (retrieved.length && nodeIds.has("process:memory")) {
    edges.push({ id: "retrieval:memory-region", from: "process:retrieval", to: "process:memory", kind: "retrieval", evidenceCount: retrieved.length, signal: 1 });
  }

  const associationIds = new Set<string>();
  for (const association of associations) {
    const recordIds = association.evidence.map((item) => item.recordId);
    if (!association.ownerConfirmed || associationIds.has(association.id) || recordIds.length !== 2 || recordIds[0] === recordIds[1]) continue;
    const from = `memory:${recordIds[0]}`;
    const to = `memory:${recordIds[1]}`;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    associationIds.add(association.id);
    edges.push({ id: `association:${association.id}`, from, to, kind: "association", evidenceCount: recordIds.length, signal: .34 });
  }

  return {
    nodes,
    edges,
    persistentNodeCount: memoryNodes.length,
    processNodeCount: nodes.length - memoryNodes.length,
    persistentAssociationCount: associationIds.size,
  };
}
