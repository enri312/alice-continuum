type SessionKind = "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza";

export type MemoryRecordChanges = {
  intention?: string;
  summary: string;
  nextStep: string;
  source?: string;
  importance?: number;
};

export type MemorySession = {
  affects?: import("../cognitive/affect").MemoryAffect[];
  id: string;
  kind: SessionKind;
  intention: string;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  nextStep?: string;
  memoryType?: "semantic" | "procedural" | "preference" | "episodic";
  source?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  accessibilityStatus?: "accessible" | "dormant";
  accessibilityUpdatedAt?: string;
  suppressionStatus?: "suppressed";
  suppressionReason?: "ownerChoice" | "sensitiveContext" | "temporaryBoundary";
  suppressionUpdatedAt?: string;
  archiveStatus?: "archived";
  archiveReason?: "ownerChoice" | "superseded" | "noLongerRelevant";
  archiveUpdatedAt?: string;
  deletionStatus?: "scheduled";
  deletionReason?: "ownerRequest" | "duplicateAfterMerge" | "privacyRemoval";
  deletionRequestedAt?: string;
  deletionEligibleAt?: string;
  memoryVersion?: number;
  reconsolidatedAt?: string;
  reconsolidationReason?: "ownerCorrection" | "newContext" | "clarification";
  previousVersionSha256?: string;
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  retrievalEvidenceVersion?: 1;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
  contextEvents?: { type: "screenshot"; recordedAt: string }[];
};
