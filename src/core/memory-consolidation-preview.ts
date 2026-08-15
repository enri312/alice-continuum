export type ConsolidationPreviewState = "unavailable" | "ready" | "blocked";
export type ConsolidationCandidateKind = "exactDuplicate" | "reviewRequired";
export type ConsolidationReasonCode = "exactNormalizedContent" | "sameNormalizedIntentionDifferentContent";
export type ConsolidationResolutionAction = "keepSeparate";

export type ConsolidationCandidate = {
  candidateId: string;
  kind: ConsolidationCandidateKind;
  recordIds: [string, string];
  reasonCode: ConsolidationReasonCode;
  requiresHumanReview: true;
  resolution: ConsolidationResolutionAction | null;
  decisionId: string | null;
};

export type ConsolidationPreviewSnapshot = {
  schemaVersion: 2;
  state: ConsolidationPreviewState;
  storagePath: string;
  sourceSha256: string | null;
  recordCount: number;
  eligibleRecordCount: number;
  archivedRecordCount: number;
  candidateCount: number;
  pendingCandidateCount: number;
  keptSeparateCount: number;
  exactDuplicateCount: number;
  reviewRequiredCount: number;
  candidates: ConsolidationCandidate[];
  blockedReason: string | null;
  automaticMerge: false;
  recordsModified: false;
  modelUsed: false;
};

export type ConsolidationResolutionResult = {
  schemaVersion: 1;
  decision: {
    decisionId: string;
    candidateId: string;
    sourceSha256: string;
    candidateKind: ConsolidationCandidateKind;
    reasonCode: ConsolidationReasonCode;
    recordIds: [string, string];
    action: ConsolidationResolutionAction;
    decidedAt: string;
  };
  sourceBackupPath: string;
  ledgerPath: string;
  backupCreated: boolean;
  recordsModified: false;
  modelUsed: false;
  preview: ConsolidationPreviewSnapshot;
};

const snapshotKeys = ["schemaVersion", "state", "storagePath", "sourceSha256", "recordCount", "eligibleRecordCount", "archivedRecordCount", "candidateCount", "pendingCandidateCount", "keptSeparateCount", "exactDuplicateCount", "reviewRequiredCount", "candidates", "blockedReason", "automaticMerge", "recordsModified", "modelUsed"];
const candidateKeys = ["candidateId", "kind", "recordIds", "reasonCode", "requiresHumanReview", "resolution", "decisionId"];
const resultKeys = ["schemaVersion", "decision", "sourceBackupPath", "ledgerPath", "backupCreated", "recordsModified", "modelUsed", "preview"];
const decisionKeys = ["decisionId", "candidateId", "sourceSha256", "candidateKind", "reasonCode", "recordIds", "action", "decidedAt"];
const digest = /^sha256:[0-9a-f]{64}$/;

function fail(message: string): never { throw new Error(`Vista R6.3 inválida: ${message}`); }
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[], field: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(`${field} tiene campos ausentes o desconocidos`);
}
function count(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}
function nullableText(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío o null`);
  return value;
}

function parseCandidate(value: unknown): ConsolidationCandidate {
  const input = record(value, "candidate");
  exactKeys(input, candidateKeys, "candidate");
  if (typeof input.candidateId !== "string" || !digest.test(input.candidateId)) fail("candidateId no es SHA-256");
  if (input.kind !== "exactDuplicate" && input.kind !== "reviewRequired") fail("kind es desconocido");
  if (!Array.isArray(input.recordIds) || input.recordIds.length !== 2 || input.recordIds.some((id) => typeof id !== "string" || !id.trim()) || input.recordIds[0] === input.recordIds[1]) fail("recordIds debe contener dos IDs distintos");
  if (input.reasonCode !== "exactNormalizedContent" && input.reasonCode !== "sameNormalizedIntentionDifferentContent") fail("reasonCode es desconocido");
  if ((input.kind === "exactDuplicate") !== (input.reasonCode === "exactNormalizedContent")) fail("kind y reasonCode no coinciden");
  if (input.requiresHumanReview !== true) fail("todo candidato requiere revisión humana");
  if (input.resolution !== null && input.resolution !== "keepSeparate") fail("resolution es desconocida");
  if (input.decisionId !== null && (typeof input.decisionId !== "string" || !digest.test(input.decisionId))) fail("decisionId no es SHA-256");
  if ((input.resolution === null) !== (input.decisionId === null)) fail("resolution y decisionId deben aparecer juntos");
  return input as ConsolidationCandidate;
}

export function parseConsolidationPreview(value: unknown): ConsolidationPreviewSnapshot {
  const input = record(value, "snapshot");
  exactKeys(input, snapshotKeys, "snapshot");
  if (input.schemaVersion !== 2) fail("schemaVersion debe ser 2");
  if (input.state !== "unavailable" && input.state !== "ready" && input.state !== "blocked") fail("state es desconocido");
  if (typeof input.storagePath !== "string" || !input.storagePath.trim()) fail("storagePath está vacío");
  if (input.automaticMerge !== false || input.recordsModified !== false || input.modelUsed !== false) fail("la vista declara efectos o inferencia prohibidos");
  const sourceSha256 = input.sourceSha256 === null ? null : nullableText(input.sourceSha256, "sourceSha256");
  if (sourceSha256 !== null && !digest.test(sourceSha256)) fail("sourceSha256 no es SHA-256");
  const blockedReason = nullableText(input.blockedReason, "blockedReason");
  const state = input.state as ConsolidationPreviewState;
  const candidates = Array.isArray(input.candidates) ? input.candidates.map(parseCandidate) : fail("candidates debe ser una lista");
  const recordCount = count(input.recordCount, "recordCount");
  const eligibleRecordCount = count(input.eligibleRecordCount, "eligibleRecordCount");
  const archivedRecordCount = count(input.archivedRecordCount, "archivedRecordCount");
  const candidateCount = count(input.candidateCount, "candidateCount");
  const pendingCandidateCount = count(input.pendingCandidateCount, "pendingCandidateCount");
  const keptSeparateCount = count(input.keptSeparateCount, "keptSeparateCount");
  const exactDuplicateCount = count(input.exactDuplicateCount, "exactDuplicateCount");
  const reviewRequiredCount = count(input.reviewRequiredCount, "reviewRequiredCount");
  if (eligibleRecordCount + archivedRecordCount > recordCount) fail("los conteos de registros exceden la fuente");
  if (candidateCount !== candidates.length || exactDuplicateCount + reviewRequiredCount !== candidateCount) fail("los conteos de candidatos no coinciden");
  if (pendingCandidateCount + keptSeparateCount !== candidateCount) fail("los conteos de resolución no coinciden");
  if (candidates.filter((candidate) => candidate.resolution === "keepSeparate").length !== keptSeparateCount) fail("keptSeparateCount no coincide");
  if (candidates.filter((candidate) => candidate.kind === "exactDuplicate").length !== exactDuplicateCount) fail("exactDuplicateCount no coincide");
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== candidates.length) fail("candidateId está repetido");
  if (state === "ready" && (!sourceSha256 || blockedReason)) fail("ready requiere fuente y no admite bloqueo");
  if (state === "blocked" && !blockedReason) fail("blocked requiere una razón");
  if (state === "unavailable" && (sourceSha256 || blockedReason || recordCount || candidateCount)) fail("unavailable contiene datos inexistentes");
  return {
    schemaVersion: 2,
    state,
    storagePath: input.storagePath,
    sourceSha256,
    recordCount,
    eligibleRecordCount,
    archivedRecordCount,
    candidateCount,
    pendingCandidateCount,
    keptSeparateCount,
    exactDuplicateCount,
    reviewRequiredCount,
    candidates,
    blockedReason,
    automaticMerge: false,
    recordsModified: false,
    modelUsed: false,
  };
}

export function parseConsolidationResolutionResult(value: unknown): ConsolidationResolutionResult {
  const input = record(value, "resolutionResult");
  exactKeys(input, resultKeys, "resolutionResult");
  if (input.schemaVersion !== 1) fail("resolutionResult.schemaVersion debe ser 1");
  if (typeof input.sourceBackupPath !== "string" || !input.sourceBackupPath.trim()) fail("sourceBackupPath está vacío");
  if (typeof input.ledgerPath !== "string" || !input.ledgerPath.trim()) fail("ledgerPath está vacío");
  if (typeof input.backupCreated !== "boolean") fail("backupCreated debe ser booleano");
  if (input.recordsModified !== false || input.modelUsed !== false) fail("la resolución declara efectos prohibidos");
  const decision = record(input.decision, "decision");
  exactKeys(decision, decisionKeys, "decision");
  for (const field of ["decisionId", "candidateId", "sourceSha256"] as const) {
    if (typeof decision[field] !== "string" || !digest.test(decision[field] as string)) fail(`${field} no es SHA-256`);
  }
  if (decision.candidateKind !== "exactDuplicate" && decision.candidateKind !== "reviewRequired") fail("candidateKind es desconocido");
  if (decision.reasonCode !== "exactNormalizedContent" && decision.reasonCode !== "sameNormalizedIntentionDifferentContent") fail("decision.reasonCode es desconocido");
  if ((decision.candidateKind === "exactDuplicate") !== (decision.reasonCode === "exactNormalizedContent")) fail("candidateKind y reasonCode no coinciden");
  if (!Array.isArray(decision.recordIds) || decision.recordIds.length !== 2 || decision.recordIds.some((id) => typeof id !== "string" || !id.trim()) || decision.recordIds[0] >= decision.recordIds[1]) fail("decision.recordIds es inválido");
  if (decision.action !== "keepSeparate") fail("decision.action es desconocida");
  if (typeof decision.decidedAt !== "string" || !Number.isFinite(Date.parse(decision.decidedAt))) fail("decidedAt es inválido");
  const preview = parseConsolidationPreview(input.preview);
  const resolved = preview.candidates.find((candidate) => candidate.candidateId === decision.candidateId);
  if (!resolved || resolved.resolution !== "keepSeparate" || resolved.decisionId !== decision.decisionId) fail("la vista no confirma la decisión");
  return { schemaVersion: 1, decision: decision as ConsolidationResolutionResult["decision"], sourceBackupPath: input.sourceBackupPath, ledgerPath: input.ledgerPath, backupCreated: input.backupCreated, recordsModified: false, modelUsed: false, preview };
}
