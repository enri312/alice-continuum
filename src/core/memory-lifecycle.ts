export type MemoryLifecyclePreviewState = "unavailable" | "ready" | "active" | "sourceChanged" | "rolledBack" | "blocked";
export type MemoryValidityState = "current" | "conflict" | "archived" | "notAssessed";
export type MemoryAccessibilityState = "notAssessed" | "accessible" | "dormant";
export type MemoryRetrievalPolicy = "eligible" | "legacyEligible" | "blockedBySuppression" | "blockedByDormancy" | "blockedByConflict" | "blockedByArchive";
export type MemorySuppressionAction = "suppress" | "release";
export type MemorySuppressionReason = "ownerChoice" | "sensitiveContext" | "temporaryBoundary";
export type MemoryWeakeningAssessmentState = "notAssessed" | "insufficientEvidence" | "noWeakeningSignal" | "reviewRequired";

export type MemoryWeakeningAssessment = {
  recordId: string;
  helpfulOutcomes: number;
  notHelpfulOutcomes: number;
  evidenceCount: number;
  state: MemoryWeakeningAssessmentState;
  automaticAction: false;
};

export type MemoryLifecycleReference = {
  recordId: string;
  recordSha256: string;
  validity: MemoryValidityState;
  accessibility: MemoryAccessibilityState;
  retrievalPolicy: MemoryRetrievalPolicy;
  retention: "notAssessed";
  suppressed: boolean;
  archived: boolean;
  baseVersion: 1;
  reconsolidationCount: number;
};

export type MemoryLifecyclePreview = {
  sourceSha256: string;
  recordCount: number;
  currentCount: number;
  conflictCount: number;
  archivedCount: number;
  notAssessedCount: number;
  accessibilityAssessedCount: number;
  accessibleCount: number;
  dormantCount: number;
  retrievalEligibleCount: number;
  retrievalBlockedCount: number;
  retrievalOutcomeCount: number;
  functionalAssessmentCount: number;
  weakeningReviewRequiredCount: number;
  retentionAssessedCount: 0;
  suppressedCount: number;
  reconsolidatedCount: number;
  references: MemoryLifecycleReference[];
  weakeningAssessments: MemoryWeakeningAssessment[];
  recordsModified: false;
  contentCopied: false;
  automaticInference: false;
};

export type MemoryLifecyclePreviewSnapshot = {
  schemaVersion: 1;
  state: MemoryLifecyclePreviewState;
  storagePath: string;
  sourceSha256: string | null;
  activeRevisionId: string | null;
  revisionCount: number;
  preview: MemoryLifecyclePreview | null;
  blockedReason: string | null;
  migrationRequiresConfirmation: true;
  lifecycleWritesAvailable: boolean;
  recordsModified: false;
};

export type MemoryValidityAssessmentAction = "confirmCurrent" | "markConflict";

export type MemoryValidityAssessmentResult = {
  schemaVersion: 1;
  recordId: string;
  action: MemoryValidityAssessmentAction;
  previousValidity: "notAssessed";
  newValidity: "current" | "conflict";
  sourceSha256Before: string;
  sourceSha256After: string;
  backupSha256: string;
  recordsModified: true;
  auditWritten: true;
  lifecycle: MemoryLifecyclePreviewSnapshot;
};

export type MemoryAccessibilityAssessmentAction = "makeAccessible" | "setDormant";

export type MemoryAccessibilityAssessmentResult = {
  schemaVersion: 1;
  recordId: string;
  action: MemoryAccessibilityAssessmentAction;
  previousAccessibility: MemoryAccessibilityState;
  newAccessibility: "accessible" | "dormant";
  sourceSha256Before: string;
  sourceSha256After: string;
  backupSha256: string;
  recordsModified: true;
  auditWritten: true;
  lifecycle: MemoryLifecyclePreviewSnapshot;
};

export type MemorySuppressionAssessmentResult = {
  schemaVersion: 1;
  recordId: string;
  action: MemorySuppressionAction;
  reason: MemorySuppressionReason;
  previousSuppressed: boolean;
  newSuppressed: boolean;
  sourceSha256Before: string;
  sourceSha256After: string;
  backupSha256: string;
  recordsModified: true;
  auditWritten: true;
  lifecycle: MemoryLifecyclePreviewSnapshot;
};

const digest = /^sha256:[0-9a-f]{64}$/;
const snapshotKeys = ["schemaVersion", "state", "storagePath", "sourceSha256", "activeRevisionId", "revisionCount", "preview", "blockedReason", "migrationRequiresConfirmation", "lifecycleWritesAvailable", "recordsModified"];
const previewKeys = ["sourceSha256", "recordCount", "currentCount", "conflictCount", "archivedCount", "notAssessedCount", "accessibilityAssessedCount", "accessibleCount", "dormantCount", "retrievalEligibleCount", "retrievalBlockedCount", "retrievalOutcomeCount", "functionalAssessmentCount", "weakeningReviewRequiredCount", "retentionAssessedCount", "suppressedCount", "reconsolidatedCount", "references", "weakeningAssessments", "recordsModified", "contentCopied", "automaticInference"];
const referenceKeys = ["recordId", "recordSha256", "validity", "accessibility", "retrievalPolicy", "retention", "suppressed", "archived", "baseVersion", "reconsolidationCount"];
const assessmentKeys = ["schemaVersion", "recordId", "action", "previousValidity", "newValidity", "sourceSha256Before", "sourceSha256After", "backupSha256", "recordsModified", "auditWritten", "lifecycle"];
const accessibilityAssessmentKeys = ["schemaVersion", "recordId", "action", "previousAccessibility", "newAccessibility", "sourceSha256Before", "sourceSha256After", "backupSha256", "recordsModified", "auditWritten", "lifecycle"];
const suppressionAssessmentKeys = ["schemaVersion", "recordId", "action", "reason", "previousSuppressed", "newSuppressed", "sourceSha256Before", "sourceSha256After", "backupSha256", "recordsModified", "auditWritten", "lifecycle"];
const states: MemoryLifecyclePreviewState[] = ["unavailable", "ready", "active", "sourceChanged", "rolledBack", "blocked"];
const validities: MemoryValidityState[] = ["current", "conflict", "archived", "notAssessed"];
const accessibilities: MemoryAccessibilityState[] = ["notAssessed", "accessible", "dormant"];
const retrievalPolicies: MemoryRetrievalPolicy[] = ["eligible", "legacyEligible", "blockedBySuppression", "blockedByDormancy", "blockedByConflict", "blockedByArchive"];
const suppressionReasons: MemorySuppressionReason[] = ["ownerChoice", "sensitiveContext", "temporaryBoundary"];
const weakeningStates: MemoryWeakeningAssessmentState[] = ["notAssessed", "insufficientEvidence", "noWeakeningSignal", "reviewRequired"];

function fail(message: string): never { throw new Error(`Vista del ciclo de memoria inválida: ${message}`); }
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: string[], field: string) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) fail(`${field} tiene campos ausentes o desconocidos`);
}
function count(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}
function nullableDigest(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string" || !digest.test(value)) fail(`${field} no es SHA-256`);
  return value;
}
function nullableString(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío o null`);
  return value;
}

function parseReference(value: unknown, index: number): MemoryLifecycleReference {
  const input = record(value, `references[${index}]`);
  exactKeys(input, referenceKeys, `references[${index}]`);
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail(`references[${index}].recordId está vacío`);
  if (typeof input.recordSha256 !== "string" || !digest.test(input.recordSha256)) fail(`references[${index}].recordSha256 no es SHA-256`);
  if (typeof input.validity !== "string" || !validities.includes(input.validity as MemoryValidityState)) fail(`references[${index}].validity es desconocido`);
  if (typeof input.accessibility !== "string" || !accessibilities.includes(input.accessibility as MemoryAccessibilityState)) fail(`references[${index}].accessibility es desconocida`);
  if (typeof input.retrievalPolicy !== "string" || !retrievalPolicies.includes(input.retrievalPolicy as MemoryRetrievalPolicy)) fail(`references[${index}].retrievalPolicy es desconocido`);
  if (input.retention !== "notAssessed" || typeof input.suppressed !== "boolean" || typeof input.archived !== "boolean" || input.baseVersion !== 1) fail(`references[${index}] declara una retención, archivo o versión base incompatible`);
  const validity = input.validity as MemoryValidityState;
  const accessibility = input.accessibility as MemoryAccessibilityState;
  const retrievalPolicy = input.retrievalPolicy as MemoryRetrievalPolicy;
  const suppressed = input.suppressed as boolean;
  const archived = input.archived as boolean;
  if (validity === "archived" && !archived) fail(`references[${index}] pierde el archivo heredado`);
  const expectedPolicy = archived ? "blockedByArchive" : validity === "conflict" ? "blockedByConflict" : suppressed ? "blockedBySuppression" : accessibility === "dormant" ? "blockedByDormancy" : validity === "current" ? "eligible" : "legacyEligible";
  if (retrievalPolicy !== expectedPolicy) fail(`references[${index}] mezcla vigencia, accesibilidad y recuperación`);
  return { recordId: input.recordId, recordSha256: input.recordSha256, validity, accessibility, retrievalPolicy, retention: "notAssessed", suppressed, archived, baseVersion: 1, reconsolidationCount: count(input.reconsolidationCount, `references[${index}].reconsolidationCount`) };
}

function parseWeakeningAssessment(value: unknown, index: number): MemoryWeakeningAssessment {
  const input = record(value, `weakeningAssessments[${index}]`);
  exactKeys(input, ["recordId", "helpfulOutcomes", "notHelpfulOutcomes", "evidenceCount", "state", "automaticAction"], `weakeningAssessments[${index}]`);
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail(`weakeningAssessments[${index}].recordId está vacío`);
  const helpfulOutcomes = count(input.helpfulOutcomes, `weakeningAssessments[${index}].helpfulOutcomes`);
  const notHelpfulOutcomes = count(input.notHelpfulOutcomes, `weakeningAssessments[${index}].notHelpfulOutcomes`);
  const evidenceCount = count(input.evidenceCount, `weakeningAssessments[${index}].evidenceCount`);
  if (evidenceCount !== helpfulOutcomes + notHelpfulOutcomes) fail(`weakeningAssessments[${index}] no suma su evidencia`);
  if (typeof input.state !== "string" || !weakeningStates.includes(input.state as MemoryWeakeningAssessmentState)) fail(`weakeningAssessments[${index}].state es desconocido`);
  if (input.automaticAction !== false) fail(`weakeningAssessments[${index}] declara una acción automática`);
  const expectedState: MemoryWeakeningAssessmentState = evidenceCount === 0 ? "notAssessed" : evidenceCount < 3 ? "insufficientEvidence" : notHelpfulOutcomes >= 2 && notHelpfulOutcomes * 3 >= evidenceCount * 2 ? "reviewRequired" : "noWeakeningSignal";
  if (input.state !== expectedState) fail(`weakeningAssessments[${index}].state no coincide con la evidencia`);
  return { recordId: input.recordId, helpfulOutcomes, notHelpfulOutcomes, evidenceCount, state: expectedState, automaticAction: false };
}

function parsePreview(value: unknown): MemoryLifecyclePreview {
  const input = record(value, "preview");
  exactKeys(input, previewKeys, "preview");
  if (typeof input.sourceSha256 !== "string" || !digest.test(input.sourceSha256)) fail("preview.sourceSha256 no es SHA-256");
  if (!Array.isArray(input.references)) fail("preview.references debe ser una lista");
  if (!Array.isArray(input.weakeningAssessments)) fail("preview.weakeningAssessments debe ser una lista");
  if (input.recordsModified !== false || input.contentCopied !== false || input.automaticInference !== false) fail("preview declara escrituras, copia o inferencia automática");
  if (input.retentionAssessedCount !== 0) fail("preview declara una retención todavía no implementada");
  const references = input.references.map(parseReference);
  const weakeningAssessments = input.weakeningAssessments.map(parseWeakeningAssessment);
  const ids = new Set(references.map((reference) => reference.recordId));
  if (ids.size !== references.length) fail("preview repite referencias");
  const preview: MemoryLifecyclePreview = {
    sourceSha256: input.sourceSha256,
    recordCount: count(input.recordCount, "recordCount"),
    currentCount: count(input.currentCount, "currentCount"),
    conflictCount: count(input.conflictCount, "conflictCount"),
    archivedCount: count(input.archivedCount, "archivedCount"),
    notAssessedCount: count(input.notAssessedCount, "notAssessedCount"),
    accessibilityAssessedCount: count(input.accessibilityAssessedCount, "accessibilityAssessedCount"),
    accessibleCount: count(input.accessibleCount, "accessibleCount"),
    dormantCount: count(input.dormantCount, "dormantCount"),
    retrievalEligibleCount: count(input.retrievalEligibleCount, "retrievalEligibleCount"),
    retrievalBlockedCount: count(input.retrievalBlockedCount, "retrievalBlockedCount"),
    retrievalOutcomeCount: count(input.retrievalOutcomeCount, "retrievalOutcomeCount"),
    functionalAssessmentCount: count(input.functionalAssessmentCount, "functionalAssessmentCount"),
    weakeningReviewRequiredCount: count(input.weakeningReviewRequiredCount, "weakeningReviewRequiredCount"),
    retentionAssessedCount: 0,
    suppressedCount: count(input.suppressedCount, "suppressedCount"),
    reconsolidatedCount: count(input.reconsolidatedCount, "reconsolidatedCount"),
    references,
    weakeningAssessments,
    recordsModified: false,
    contentCopied: false,
    automaticInference: false,
  };
  if (preview.references.length !== preview.recordCount) fail("references no cubre todos los registros");
  if (preview.weakeningAssessments.length !== preview.recordCount) fail("weakeningAssessments no cubre todos los registros");
  const assessmentIds = new Set(preview.weakeningAssessments.map((assessment) => assessment.recordId));
  if (assessmentIds.size !== preview.recordCount || preview.references.some((reference) => !assessmentIds.has(reference.recordId))) fail("weakeningAssessments no corresponde a las referencias");
  const legacyArchivedCount = preview.references.filter((reference) => reference.validity === "archived").length;
  if (preview.currentCount + preview.conflictCount + legacyArchivedCount + preview.notAssessedCount !== preview.recordCount) fail("los estados de vigencia no cubren todos los registros");
  if (preview.accessibleCount + preview.dormantCount !== preview.accessibilityAssessedCount || preview.accessibilityAssessedCount > preview.recordCount) fail("los estados de accesibilidad son incoherentes");
  if (preview.retrievalEligibleCount + preview.retrievalBlockedCount !== preview.recordCount) fail("la política de recuperación no cubre todos los registros");
  if (preview.suppressedCount !== preview.references.filter((reference) => reference.suppressed).length) fail("suppressedCount no coincide con las referencias");
  if (preview.archivedCount !== preview.references.filter((reference) => reference.archived).length) fail("archivedCount no coincide con las referencias");
  if (preview.reconsolidatedCount !== preview.references.filter((reference) => reference.reconsolidationCount > 0).length) fail("reconsolidatedCount no coincide con las referencias");
  if (preview.retrievalOutcomeCount !== preview.weakeningAssessments.reduce((total, assessment) => total + assessment.evidenceCount, 0)) fail("retrievalOutcomeCount no coincide con la evidencia");
  if (preview.functionalAssessmentCount !== preview.weakeningAssessments.filter((assessment) => assessment.state === "noWeakeningSignal" || assessment.state === "reviewRequired").length) fail("functionalAssessmentCount es incoherente");
  if (preview.weakeningReviewRequiredCount !== preview.weakeningAssessments.filter((assessment) => assessment.state === "reviewRequired").length) fail("weakeningReviewRequiredCount es incoherente");
  return preview;
}

export function parseMemoryLifecyclePreview(value: unknown): MemoryLifecyclePreviewSnapshot {
  const input = record(value, "snapshot");
  exactKeys(input, snapshotKeys, "snapshot");
  if (input.schemaVersion !== 1) fail("schemaVersion debe ser 1");
  if (typeof input.state !== "string" || !states.includes(input.state as MemoryLifecyclePreviewState)) fail("state es desconocido");
  if (typeof input.storagePath !== "string" || !input.storagePath.trim()) fail("storagePath está vacío");
  if (input.migrationRequiresConfirmation !== true || typeof input.lifecycleWritesAvailable !== "boolean" || input.recordsModified !== false) fail("la frontera de migración no está cerrada");
  const sourceSha256 = nullableDigest(input.sourceSha256, "sourceSha256");
  const activeRevisionId = nullableDigest(input.activeRevisionId, "activeRevisionId");
  const preview = input.preview === null ? null : parsePreview(input.preview);
  const blockedReason = nullableString(input.blockedReason, "blockedReason");
  const state = input.state as MemoryLifecyclePreviewState;
  if (preview && sourceSha256 !== preview.sourceSha256) fail("preview no corresponde a sourceSha256");
  if (["ready", "active", "sourceChanged", "rolledBack"].includes(state) && !preview) fail(`${state} requiere preview`);
  if ((state === "active" || state === "sourceChanged") && !activeRevisionId) fail(`${state} requiere una revisión activa`);
  if ((state === "ready" || state === "rolledBack" || state === "unavailable") && activeRevisionId) fail(`${state} no admite una revisión activa`);
  if (state === "blocked" && !blockedReason) fail("blocked requiere una razón");
  if (state !== "blocked" && blockedReason) fail("sólo blocked puede incluir una razón");
  const lifecycleWritesAvailable = input.lifecycleWritesAvailable as boolean;
  if ((state === "blocked" || state === "unavailable") === lifecycleWritesAvailable) fail("la disponibilidad de escritura no coincide con el estado");
  return { schemaVersion: 1, state, storagePath: input.storagePath, sourceSha256, activeRevisionId, revisionCount: count(input.revisionCount, "revisionCount"), preview, blockedReason, migrationRequiresConfirmation: true, lifecycleWritesAvailable, recordsModified: false };
}

export function parseMemoryValidityAssessmentResult(value: unknown): MemoryValidityAssessmentResult {
  const input = record(value, "validityAssessment");
  exactKeys(input, assessmentKeys, "validityAssessment");
  if (input.schemaVersion !== 1) fail("validityAssessment.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("validityAssessment.recordId está vacío");
  if (input.action !== "confirmCurrent" && input.action !== "markConflict") fail("validityAssessment.action es desconocido");
  if (input.previousValidity !== "notAssessed") fail("validityAssessment sólo puede partir de notAssessed");
  const expectedNewValidity = input.action === "confirmCurrent" ? "current" : "conflict";
  if (input.newValidity !== expectedNewValidity) fail("validityAssessment.newValidity no coincide con la acción");
  for (const field of ["sourceSha256Before", "sourceSha256After", "backupSha256"] as const) {
    if (typeof input[field] !== "string" || !digest.test(input[field])) fail(`validityAssessment.${field} no es SHA-256`);
  }
  const sourceSha256Before = input.sourceSha256Before as string;
  const sourceSha256After = input.sourceSha256After as string;
  const backupSha256 = input.backupSha256 as string;
  if (backupSha256 !== sourceSha256Before) fail("validityAssessment.backupSha256 no protege la fuente original");
  if (sourceSha256After === sourceSha256Before) fail("validityAssessment no produjo una fuente nueva");
  if (input.recordsModified !== true || input.auditWritten !== true) fail("validityAssessment no confirma escritura y auditoría");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  if (lifecycle.sourceSha256 !== sourceSha256After) fail("validityAssessment.lifecycle no corresponde a la fuente resultante");
  return {
    schemaVersion: 1,
    recordId: input.recordId,
    action: input.action,
    previousValidity: "notAssessed",
    newValidity: expectedNewValidity,
    sourceSha256Before,
    sourceSha256After,
    backupSha256,
    recordsModified: true,
    auditWritten: true,
    lifecycle,
  };
}

export function parseMemoryAccessibilityAssessmentResult(value: unknown): MemoryAccessibilityAssessmentResult {
  const input = record(value, "accessibilityAssessment");
  exactKeys(input, accessibilityAssessmentKeys, "accessibilityAssessment");
  if (input.schemaVersion !== 1) fail("accessibilityAssessment.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("accessibilityAssessment.recordId está vacío");
  if (input.action !== "makeAccessible" && input.action !== "setDormant") fail("accessibilityAssessment.action es desconocido");
  if (typeof input.previousAccessibility !== "string" || !accessibilities.includes(input.previousAccessibility as MemoryAccessibilityState)) fail("accessibilityAssessment.previousAccessibility es desconocida");
  const expectedNewAccessibility = input.action === "makeAccessible" ? "accessible" : "dormant";
  if (input.newAccessibility !== expectedNewAccessibility || input.previousAccessibility === expectedNewAccessibility) fail("accessibilityAssessment no describe una transición real");
  for (const field of ["sourceSha256Before", "sourceSha256After", "backupSha256"] as const) {
    if (typeof input[field] !== "string" || !digest.test(input[field])) fail(`accessibilityAssessment.${field} no es SHA-256`);
  }
  const sourceSha256Before = input.sourceSha256Before as string;
  const sourceSha256After = input.sourceSha256After as string;
  const backupSha256 = input.backupSha256 as string;
  if (backupSha256 !== sourceSha256Before || sourceSha256After === sourceSha256Before) fail("accessibilityAssessment no protege una transición de fuente real");
  if (input.recordsModified !== true || input.auditWritten !== true) fail("accessibilityAssessment no confirma escritura y auditoría");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  if (lifecycle.sourceSha256 !== sourceSha256After) fail("accessibilityAssessment.lifecycle no corresponde a la fuente resultante");
  const reference = lifecycle.preview?.references.find((item) => item.recordId === input.recordId);
  if (!reference || reference.accessibility !== expectedNewAccessibility) fail("accessibilityAssessment.lifecycle no contiene la decisión resultante");
  return {
    schemaVersion: 1,
    recordId: input.recordId,
    action: input.action,
    previousAccessibility: input.previousAccessibility as MemoryAccessibilityState,
    newAccessibility: expectedNewAccessibility,
    sourceSha256Before,
    sourceSha256After,
    backupSha256,
    recordsModified: true,
    auditWritten: true,
    lifecycle,
  };
}

export function parseMemorySuppressionAssessmentResult(value: unknown): MemorySuppressionAssessmentResult {
  const input = record(value, "suppressionAssessment");
  exactKeys(input, suppressionAssessmentKeys, "suppressionAssessment");
  if (input.schemaVersion !== 1) fail("suppressionAssessment.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("suppressionAssessment.recordId está vacío");
  if (input.action !== "suppress" && input.action !== "release") fail("suppressionAssessment.action es desconocido");
  if (typeof input.reason !== "string" || !suppressionReasons.includes(input.reason as MemorySuppressionReason)) fail("suppressionAssessment.reason es desconocido");
  if (typeof input.previousSuppressed !== "boolean" || typeof input.newSuppressed !== "boolean" || input.previousSuppressed === input.newSuppressed) fail("suppressionAssessment no describe una transición real");
  const expectedNewSuppressed = input.action === "suppress";
  if (input.newSuppressed !== expectedNewSuppressed) fail("suppressionAssessment.newSuppressed no coincide con la acción");
  for (const field of ["sourceSha256Before", "sourceSha256After", "backupSha256"] as const) {
    if (typeof input[field] !== "string" || !digest.test(input[field])) fail(`suppressionAssessment.${field} no es SHA-256`);
  }
  const sourceSha256Before = input.sourceSha256Before as string;
  const sourceSha256After = input.sourceSha256After as string;
  const backupSha256 = input.backupSha256 as string;
  if (backupSha256 !== sourceSha256Before || sourceSha256After === sourceSha256Before) fail("suppressionAssessment no protege una transición de fuente real");
  if (input.recordsModified !== true || input.auditWritten !== true) fail("suppressionAssessment no confirma escritura y auditoría");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  if (lifecycle.sourceSha256 !== sourceSha256After) fail("suppressionAssessment.lifecycle no corresponde a la fuente resultante");
  const reference = lifecycle.preview?.references.find((item) => item.recordId === input.recordId);
  if (!reference || reference.suppressed !== expectedNewSuppressed) fail("suppressionAssessment.lifecycle no contiene la decisión resultante");
  return { schemaVersion: 1, recordId: input.recordId, action: input.action, reason: input.reason as MemorySuppressionReason, previousSuppressed: input.previousSuppressed, newSuppressed: expectedNewSuppressed, sourceSha256Before, sourceSha256After, backupSha256, recordsModified: true, auditWritten: true, lifecycle };
}
