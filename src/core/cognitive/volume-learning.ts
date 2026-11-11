import type { CognitiveMemoryLayer, CognitiveMemoryNode, CognitiveMemoryOrigin } from "../memory/cognitive-memory";

export type VolumeLearningSnapshot = {
  total: number;
  byOrigin: Readonly<Record<CognitiveMemoryOrigin, number>>;
  byLayer: Readonly<Record<CognitiveMemoryLayer, number>>;
};

// A checkpoint exists only in the visual observer's memory. Tokens are neither
// durable history nor security/integrity hashes and contain no copied labels.
export type VolumeLearningCheckpoint = Readonly<Record<string, string>>;
export type VolumeLearningChanges = { addedIds: string[]; changedIds: string[]; removedIds: string[] };

/** A slow visual extent for saved records, never a measure of intelligence. */
export function volumeLearningScale(count: number): number {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return Math.min(1, Math.max(.76, .76 + .24 * total / (total + 180)));
}

function uniqueNodes(nodes: readonly CognitiveMemoryNode[]): CognitiveMemoryNode[] {
  const seen = new Set<string>();
  return nodes.filter(node => {
    if (!node.id || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

export function buildVolumeLearningSnapshot(nodes: readonly CognitiveMemoryNode[]): VolumeLearningSnapshot {
  const byOrigin: Record<CognitiveMemoryOrigin, number> = { study: 0, automatic: 0, profile: 0, record: 0 };
  const byLayer: Record<CognitiveMemoryLayer, number> = { episodic: 0, semantic: 0, procedural: 0, preference: 0, self: 0, unclassified: 0 };
  const records = uniqueNodes(nodes);
  for (const node of records) {
    byOrigin[node.origin] += 1;
    byLayer[node.layer] += 1;
  }
  return { total: records.length, byOrigin, byLayer };
}

const isoSourceDate = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})";
const studyReviewSuffix = new RegExp(` · estudiado ${isoSourceDate}$`);
const automaticReviewDate = new RegExp(` · ${isoSourceDate}(?= · intercambio )`);

function knowledgeSource(node: CognitiveMemoryNode): string | null {
  if (node.origin === "study") return node.source?.replace(studyReviewSuffix, "") ?? null;
  if (node.origin === "automatic") return node.source?.replace(automaticReviewDate, "") ?? null;
  return node.source;
}

function visualFingerprint(node: CognitiveMemoryNode): string {
  const semantic = JSON.stringify({
    origin: node.origin,
    layer: node.layer,
    label: node.label,
    content: node.content ?? null,
    version: node.version,
    status: node.status,
    studyState: node.studyState,
    accessibility: node.accessibility,
    suppressed: node.suppressed,
    archived: node.archived,
    deletionScheduled: node.deletionScheduled,
    source: knowledgeSource(node),
    importance: node.importance,
    conversationExchangeId: node.conversationExchangeId ?? null,
    affects: [...node.affects].sort((left, right) => left.emotion.localeCompare(right.emotion)),
  });
  // Two fast 32-bit accumulators form an opaque visual change token. This is
  // deliberately not presented as SHA-256, authentication or a storage digest.
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (let index = 0; index < semantic.length; index++) {
    const code = semantic.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `visual-v1:${semantic.length}:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function createVolumeLearningCheckpoint(nodes: readonly CognitiveMemoryNode[]): VolumeLearningCheckpoint {
  return Object.freeze(Object.fromEntries(uniqueNodes(nodes).map(node => [node.id, visualFingerprint(node)])));
}

export function diffVolumeLearningCheckpoints(
  previous: VolumeLearningCheckpoint | null,
  next: VolumeLearningCheckpoint,
): VolumeLearningChanges {
  // Opening the view establishes a baseline; it does not replay earlier births.
  if (previous === null) return { addedIds: [], changedIds: [], removedIds: [] };
  return {
    addedIds: Object.keys(next).filter(id => !Object.hasOwn(previous, id)).sort(),
    changedIds: Object.keys(next).filter(id => Object.hasOwn(previous, id) && previous[id] !== next[id]).sort(),
    removedIds: Object.keys(previous).filter(id => !Object.hasOwn(next, id)).sort(),
  };
}
