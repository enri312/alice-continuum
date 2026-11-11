import { parseMemoryAffects, type MemoryAffect } from "../cognitive/affect";
import { neuralMemoryPosition } from "../cognitive/neural-geometry";
export type CognitiveMemoryLayer = "episodic" | "semantic" | "procedural" | "preference" | "self" | "unclassified";
export type CognitiveMemoryStatus = "confirmed" | "conflict" | "archived" | "historical" | "learned";
export type CognitiveMemoryOrigin = "study" | "automatic" | "profile" | "record";
export type CognitiveMemoryRecordedAtKind = "study" | "created" | "session";
export type CognitiveMemoryStudyState = "available" | "review" | "withdrawn";

export type CognitiveMemoryInput = {
  studyLearning?: boolean;
  studyState?: CognitiveMemoryStudyState | null;
  studyPasses?: number;
  automaticLearning?: boolean;
  conversationExchangeId?: string;
  ownerReviewed?: boolean;
  affects?: MemoryAffect[];
  id?: string;
  kind?: string;
  intention: string;
  summary?: string;
  startedAt?: string;
  finishedAt?: string;
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
  origin: CognitiveMemoryOrigin;
  recordedAt: string | null;
  recordedAtKind: CognitiveMemoryRecordedAtKind | null;
  studyState: CognitiveMemoryStudyState | null;
  studyPasses: number | null;
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

function isoTimestamp(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(candidate);
  if (!match || !Number.isFinite(Date.parse(candidate))) return null;
  const [, y, m, d, hours, minutes, seconds] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return candidate;
}

function memoryProvenance(memory: CognitiveMemoryInput): Pick<CognitiveMemoryNode, "origin" | "recordedAt" | "recordedAtKind"> {
  const origin: CognitiveMemoryOrigin = memory.studyLearning ? "study"
    : memory.automaticLearning ? "automatic" : memory.kind === "Perfil" ? "profile" : "record";
  // Study dates describe the latest exercise, not the creation of knowledge.
  const recordedAt = origin === "study" ? isoTimestamp(memory.finishedAt)
    : origin === "automatic" ? isoTimestamp(memory.startedAt)
      : origin === "record" ? isoTimestamp(memory.finishedAt) ?? isoTimestamp(memory.startedAt) : null;
  return { origin, recordedAt, recordedAtKind: recordedAt === null ? null
    : origin === "study" ? "study" : origin === "automatic" ? "created" : "session" };
}

function studyMetadata(memory: CognitiveMemoryInput): Pick<CognitiveMemoryNode, "studyState" | "studyPasses"> {
  if (!memory.studyLearning) return { studyState: null, studyPasses: null };
  // The earlier conversational projection only emitted approved, active lessons.
  // The full visual projection always supplies the explicit new metadata.
  if (memory.studyState === undefined && memory.studyPasses === undefined) return { studyState: "available", studyPasses: null };
  const studyPasses = Number.isSafeInteger(memory.studyPasses) && (memory.studyPasses ?? -1) >= 0 ? memory.studyPasses! : null;
  const studyState = memory.studyState === "withdrawn" ? "withdrawn"
    : memory.studyState === "available" && (studyPasses ?? 0) > 0 ? "available" : "review";
  return { studyState, studyPasses };
}

export function resolveCognitiveMemoryLayer(memory: CognitiveMemoryInput): CognitiveMemoryLayer {
  if (memory.kind === "Perfil") return "self";
  if (memory.memoryType) return memory.memoryType;
  if (memory.kind === "Conversación") return "episodic";
  return "unclassified";
}

export function resolveCognitiveMemoryStatus(memory: CognitiveMemoryInput): CognitiveMemoryStatus {
  if (memory.studyLearning) {
    if (memory.studyPasses === undefined && memory.studyState === undefined) return "learned";
    return Number.isSafeInteger(memory.studyPasses) && (memory.studyPasses ?? 0) > 0 ? "learned" : "historical";
  }
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
    const study = studyMetadata(memory);
    const archived = status === "archived" || memory.archiveStatus === "archived";
    const strength = finiteRange(memory.storageStrength, 0, 1);
    const importance = finiteRange(memory.importance, 1, 5);
    nodes.push({
      ...(memory.conversationExchangeId ? { conversationExchangeId: memory.conversationExchangeId } : {}),
      affects: (memory.memoryVersion ?? 1) === 1 ? parseMemoryAffects(memory.affects) : [],
      id,
      label,
      ...(memory.summary ? {content:memory.summary} : {}),
      ...memoryProvenance(memory),
      ...study,
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
      retrieved: !archived && status !== "conflict" && memory.accessibilityStatus !== "dormant" && memory.suppressionStatus !== "suppressed"
        && (!memory.studyLearning || study.studyState === "available") && retrieved.has(id),
      ...neuralMemoryPosition(id),
    });
  }
  return nodes;
}
