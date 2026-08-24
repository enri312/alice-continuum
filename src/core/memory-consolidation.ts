export type ReviewOutcome = "confirmed" | "needs-correction";
export type RetrievalOutcome = "helpful" | "not-helpful";

export type ReviewableMemory = {
  id: string;
  intention: string;
  kind?: string;
  finishedAt?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  retrievalEvidenceVersion?: 1;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
};

export type ScheduledReview<T extends ReviewableMemory = ReviewableMemory> = {
  memory: T;
  dueAt: string;
  due: boolean;
  daysUntilDue: number;
  intervalDays: number;
};

type ReinforcementCandidate = {
  id?: string;
  kind?: string;
  memoryStatus?: "confirmed" | "conflict" | "archived";
};

const reviewIntervals = [1, 3, 7, 14, 30, 60, 120] as const;
const dayMs = 24 * 60 * 60 * 1000;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function validDate(value?: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function reviewIntervalDays(memory: ReviewableMemory) {
  if (memory.memoryStatus === "conflict") return 0;
  const confirmations = Math.max(0, memory.successfulReviews ?? 0);
  const corrections = Math.max(0, memory.correctionCount ?? 0);
  const stage = clamp(confirmations - corrections, 0, reviewIntervals.length - 1);
  const importance = clamp(memory.importance ?? 3, 1, 5);
  const importanceFactor = importance >= 4 ? .75 : importance <= 2 ? 1.25 : 1;
  return Math.max(1, Math.round(reviewIntervals[stage] * importanceFactor));
}

export function scheduleReview<T extends ReviewableMemory>(memory: T, now = new Date()): ScheduledReview<T> | null {
  if (!memory.finishedAt || memory.memoryStatus === "archived") return null;
  const anchor = validDate(memory.lastReviewedAt) ?? validDate(memory.finishedAt);
  if (anchor === undefined) return null;
  const intervalDays = reviewIntervalDays(memory);
  const dueTimestamp = memory.memoryStatus === "conflict" ? anchor : anchor + intervalDays * dayMs;
  const difference = dueTimestamp - now.getTime();
  return {
    memory,
    dueAt: new Date(dueTimestamp).toISOString(),
    due: difference <= 0,
    daysUntilDue: difference <= 0 ? 0 : Math.ceil(difference / dayMs),
    intervalDays,
  };
}

export function buildReviewQueue<T extends ReviewableMemory>(memories: T[], now = new Date()) {
  return memories
    .map((memory) => scheduleReview(memory, now))
    .filter((review): review is ScheduledReview<T> => review !== null)
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt));
}

export function applyMemoryReview<T extends ReviewableMemory>(memory: T, outcome: ReviewOutcome, now = new Date()): T {
  const importance = clamp(memory.importance ?? 3, 1, 5);
  const strength = clamp(memory.storageStrength ?? .08, 0, 1);
  if (outcome === "confirmed") {
    const reinforcement = .1 + importance * .012;
    return {
      ...memory,
      storageStrength: Number(clamp(strength + reinforcement, 0, 1).toFixed(3)),
      memoryStatus: "confirmed",
      successfulReviews: (memory.successfulReviews ?? 0) + 1,
      lastReviewedAt: now.toISOString(),
    };
  }
  return {
    ...memory,
    storageStrength: Number(clamp(strength - .12, 0, 1).toFixed(3)),
    memoryStatus: "conflict",
    correctionCount: (memory.correctionCount ?? 0) + 1,
    lastReviewedAt: now.toISOString(),
  };
}

export function applyMemoryRetrievalOutcome<T extends ReviewableMemory>(memory: T, outcome: RetrievalOutcome, now = new Date()): T {
  if (memory.kind !== "Enseñanza" || (memory.memoryStatus !== undefined && memory.memoryStatus !== "confirmed")) return memory;
  const previousHelpful = memory.retrievalEvidenceVersion === 1 ? memory.successfulRecalls ?? 0 : 0;
  const previousNotHelpful = memory.retrievalEvidenceVersion === 1 ? memory.failedRecalls ?? 0 : 0;
  return {
    ...memory,
    successfulRecalls: previousHelpful + (outcome === "helpful" ? 1 : 0),
    failedRecalls: previousNotHelpful + (outcome === "not-helpful" ? 1 : 0),
    lastRecalledAt: now.toISOString(),
    retrievalEvidenceVersion: 1,
  };
}

export function selectReinforceableMemoryIds(memories: ReinforcementCandidate[]) {
  return [...new Set(memories
    .filter((memory) => memory.id && memory.kind === "Enseñanza" && memory.memoryStatus === "confirmed")
    .map((memory) => memory.id as string))];
}
