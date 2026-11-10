import { parseMemoryAffects, type MemoryAffect } from "../cognitive/affect";
import { neuralMemoryPosition } from "../cognitive/neural-geometry";
export type CognitiveMemoryLayer = "episodic" | "semantic" | "procedural" | "preference" | "self" | "unclassified";
export type CognitiveMemoryStatus = "confirmed" | "conflict" | "archived" | "historical" | "learned";

export type CognitiveMemoryInput = {
  studyLearning?: boolean;
  automaticLearning?: boolean;
  conversationExchangeId?: string;
  ownerReviewed?: boolean;
  affects?: MemoryAffect[];
  id?: string;
  kind?: string;
  intention: string;
  summary?: string;
  memoryType?: "semantic" | "procedural" | "preference" | "episodic";
  source?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  accessibilityStatus?: "accessible" | "dormant";
  suppressionStatus?: "suppressed";
  archiveStatus?: "archived";
  deletionStatus?: "scheduled";
  memoryVersion?: number;
  successfulRecalls?: number;
  successfulReviews?: number;
};

export type CognitiveMemoryNode = {
  conversationExchangeId?: string;
  affects: MemoryAffect[];
  id: string;
  label: string;
  content?: string;
  layer: CognitiveMemoryLayer;
  status: CognitiveMemoryStatus;
  accessibility: "notAssessed" | "accessible" | "dormant";
  suppressed: boolean;
  archived: boolean;
  deletionScheduled: boolean;
  version: number;
  source: string | null;
  storageStrength: number | null;
  importance: number | null;
  successfulRecalls: number;
  successfulReviews: number;
  retrieved: boolean;
  x: number;
  y: number;
  z: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function finiteRange(value: number | undefined, minimum: number, maximum: number) {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, value));
}

function nonNegativeInteger(value: number | undefined) {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

export function resolveCognitiveMemoryLayer(memory: CognitiveMemoryInput): CognitiveMemoryLayer {
  if (memory.kind === "Perfil") return "self";
  if (memory.memoryType) return memory.memoryType;
  if (memory.kind === "Conversación") return "episodic";
  return "unclassified";
}

export function resolveCognitiveMemoryStatus(memory: CognitiveMemoryInput): CognitiveMemoryStatus {
  if (memory.studyLearning) return "learned";
  if (memory.automaticLearning) return memory.ownerReviewed ? "confirmed" : "learned";
  return memory.memoryStatus ?? "historical";
}

/**
 * Crea una proyección visual: cada nodo conserva el ID de un registro real.
 * Las coordenadas son sólo una distribución determinista por capa y no declaran
 * anatomía, asociación semántica ni actividad neuronal biológica.
 */
export function buildCognitiveMemoryNodes(memories: CognitiveMemoryInput[], retrievedMemoryIds: string[] = []): CognitiveMemoryNode[] {
  const retrieved = new Set(retrievedMemoryIds);
  const seen = new Set<string>();
  const nodes: CognitiveMemoryNode[] = [];
  for (const memory of memories) {
    const id = memory.id?.trim();
    const label = memory.intention.trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const layer = resolveCognitiveMemoryLayer(memory);
    const status = resolveCognitiveMemoryStatus(memory);
    const archived = status === "archived" || memory.archiveStatus === "archived";
    const strength = finiteRange(memory.storageStrength, 0, 1);
    const importance = finiteRange(memory.importance, 1, 5);
    nodes.push({
      ...(memory.conversationExchangeId ? { conversationExchangeId: memory.conversationExchangeId } : {}),
      affects: (memory.memoryVersion ?? 1) === 1 ? parseMemoryAffects(memory.affects) : [],
      id,
      label,
      ...(memory.summary ? {content:memory.summary} : {}),
      layer,
      status,
      accessibility: memory.accessibilityStatus ?? "notAssessed",
      suppressed: memory.suppressionStatus === "suppressed",
      archived,
      deletionScheduled: memory.deletionStatus === "scheduled",
      version: Number.isSafeInteger(memory.memoryVersion) && (memory.memoryVersion ?? 0) >= 2 ? memory.memoryVersion! : 1,
      source: memory.source?.trim() || null,
      storageStrength: strength === null ? null : clamp01(strength),
      importance,
      successfulRecalls: nonNegativeInteger(memory.successfulRecalls),
      successfulReviews: nonNegativeInteger(memory.successfulReviews),
      retrieved: !archived && status !== "conflict" && memory.accessibilityStatus !== "dormant" && memory.suppressionStatus !== "suppressed" && retrieved.has(id),
      ...neuralMemoryPosition(id),
    });
  }
  return nodes;
}
