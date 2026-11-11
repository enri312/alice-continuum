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
  processRegion: CoreActivityRegionId | "retrieval" | "runtime" | null;
};

export type CognitiveVolumeEdge = {
  id: string;
  from: string;
  to: string;
  kind: "association" | "audit" | "retrieval" | "coLearning";
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
  permission: [-0.43, -0.27, 0.08],
  perception: [-0.56, 0.04, 0.04],
  language: [-0.38, 0.36, -0.1],
  memory: [-0.21, -0.07, 0.22],
  workspace: [0.24, -0.05, 0.2],
  output: [0.45, 0.32, -0.06],
  motor: [0.56, -0.2, -0.08],
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
  if (memory.studyState === "withdrawn") return [100, 116, 139];
  if (memory.studyState === "review") return [251, 191, 36];
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

/** Keep graph edges and inspector evidence tied to the currently displayed versions. */
export function currentVolumeAssociations(
  memoryNodes: readonly CognitiveMemoryNode[],
  associations: readonly ConfirmedMemoryAssociation[],
): ConfirmedMemoryAssociation[] {
  const versions = new Map(memoryNodes.map(memory => [memory.id, memory.version]));
  const seen = new Set<string>();
  return associations.filter(association => {
    const [first, second] = association.evidence;
    if (!association.ownerConfirmed || seen.has(association.id) || association.evidence.length !== 2
      || first.recordId === second.recordId
      || !association.evidence.every(item => versions.get(item.recordId) === item.recordVersion)) return false;
    seen.add(association.id);
    return true;
  });
}

export function buildCognitiveVolumeGraph(
  memoryNodes: CognitiveMemoryNode[],
  activity: CoreActivitySnapshot | null,
  associations: readonly ConfirmedMemoryAssociation[] = [],
  runtimeActive = false,
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
  if (runtimeActive) nodes.push({id:"process:runtime",kind:"process",label:"Núcleo en ejecución",
    detail:"La aplicación nativa responde. Latido de presencia técnica; no indica razonamiento, aprendizaje ni eventos R3 inventados.",
    x:0.17,y:-0.42,z:0.03,signal:.18,memory:null,processRegion:"runtime"});
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
      x: 0.12,
      y: 0.21,
      z: 0.23,
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
  for (const association of currentVolumeAssociations(memoryNodes, associations)) {
    const recordIds = association.evidence.map((item) => item.recordId);
    if (!association.ownerConfirmed || associationIds.has(association.id) || recordIds.length !== 2 || recordIds[0] === recordIds[1]) continue;
    const from = `memory:${recordIds[0]}`;
    const to = `memory:${recordIds[1]}`;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    associationIds.add(association.id);
    edges.push({ id: `association:${association.id}`, from, to, kind: "association", evidenceCount: recordIds.length, signal: .34 });
  }

  // A shared source is evidence of co-learning, not a semantic association.
  const sources = new Map<string, typeof memoryNodes>();
  for (const memory of memoryNodes) {
    if (memory.conversationExchangeId && !memory.archived) {
      const group = sources.get(memory.conversationExchangeId) ?? [];
      group.push(memory); sources.set(memory.conversationExchangeId, group);
    }
  }
  for (const [source, group] of sources) {
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 1; i < ordered.length; i++) edges.push({id:`co-learning:${source}:${i}`, from:`memory:${ordered[i - 1].id}`, to:`memory:${ordered[i].id}`, kind:"coLearning", evidenceCount:1, signal:0});
  }

  return {
    nodes,
    edges,
    persistentNodeCount: memoryNodes.length,
    processNodeCount: nodes.length - memoryNodes.length,
    persistentAssociationCount: associationIds.size,
  };
}
