import { parseMemoryLifecyclePreview, type MemoryLifecyclePreviewSnapshot } from "./memory-lifecycle";

export type MemoryDeletionScheduleAction = "schedule" | "cancel";
export type MemoryDeletionReason = "ownerRequest" | "duplicateAfterMerge" | "privacyRemoval";

export type MemoryDeletionSchedulePreview = {
  schemaVersion: 1; planId: string; plannedAt: string; eligibleAt: string; recordId: string;
  action: MemoryDeletionScheduleAction; reason: MemoryDeletionReason; noteSha256: string;
  sourceSha256: string; recordSha256Before: string; projectedRecordSha256: string;
  previousScheduled: boolean; projectedScheduled: boolean; waitSeconds: 604800;
  recordsModified: false; automaticAction: false;
};

export type MemoryDeletionScheduleResult = {
  schemaVersion: 1; planId: string; recordId: string; action: MemoryDeletionScheduleAction;
  reason: MemoryDeletionReason; previousScheduled: boolean; newScheduled: boolean;
  eligibleAt: string | null; sourceSha256Before: string; sourceSha256After: string;
  recordSha256Before: string; recordSha256After: string; backupSha256: string;
  recordsModified: true; auditWritten: true; lifecycle: MemoryLifecyclePreviewSnapshot;
};

export type MemoryDeletionPreview = {
  schemaVersion: 1; planId: string; plannedAt: string; recordId: string;
  reason: MemoryDeletionReason; noteSha256: string; sourceSha256: string; recordSha256: string;
  requestedAt: string; eligibleAt: string; safeguardRequired: true; tombstoneContainsContent: false;
  recordsModified: false; automaticAction: false;
};

export type MemoryDeletionResult = {
  schemaVersion: 1; planId: string; recordId: string; reason: MemoryDeletionReason;
  sourceSha256Before: string; sourceSha256After: string; recordSha256: string;
  safeguardSha256: string; tombstoneSha256: string; remainingRecordCount: number;
  recordsModified: true; auditWritten: true; lifecycle: MemoryLifecyclePreviewSnapshot;
};

const digest = /^sha256:[0-9a-f]{64}$/;
const actions: MemoryDeletionScheduleAction[] = ["schedule", "cancel"];
const reasons: MemoryDeletionReason[] = ["ownerRequest", "duplicateAfterMerge", "privacyRemoval"];
const schedulePreviewKeys = ["schemaVersion", "planId", "plannedAt", "eligibleAt", "recordId", "action", "reason", "noteSha256", "sourceSha256", "recordSha256Before", "projectedRecordSha256", "previousScheduled", "projectedScheduled", "waitSeconds", "recordsModified", "automaticAction"];
const scheduleResultKeys = ["schemaVersion", "planId", "recordId", "action", "reason", "previousScheduled", "newScheduled", "eligibleAt", "sourceSha256Before", "sourceSha256After", "recordSha256Before", "recordSha256After", "backupSha256", "recordsModified", "auditWritten", "lifecycle"];
const previewKeys = ["schemaVersion", "planId", "plannedAt", "recordId", "reason", "noteSha256", "sourceSha256", "recordSha256", "requestedAt", "eligibleAt", "safeguardRequired", "tombstoneContainsContent", "recordsModified", "automaticAction"];
const resultKeys = ["schemaVersion", "planId", "recordId", "reason", "sourceSha256Before", "sourceSha256After", "recordSha256", "safeguardSha256", "tombstoneSha256", "remainingRecordCount", "recordsModified", "auditWritten", "lifecycle"];

function fail(message: string): never { throw new Error(`Contrato de eliminación inválido: ${message}`); }
function object(value: unknown, field: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} no es un objeto`); return value as Record<string, unknown>; }
function exact(input: Record<string, unknown>, keys: string[], field: string) { const actual = Object.keys(input).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(`${field} tiene campos desconocidos o ausentes`); }
function sha(value: unknown, field: string): string { if (typeof value !== "string" || !digest.test(value)) fail(`${field} no es SHA-256`); return value; }
function text(value: unknown, field: string): string { if (typeof value !== "string" || !value.trim()) fail(`${field} está vacío`); return value; }
function reason(value: unknown): MemoryDeletionReason { if (typeof value !== "string" || !reasons.includes(value as MemoryDeletionReason)) fail("reason es desconocido"); return value as MemoryDeletionReason; }
function action(value: unknown): MemoryDeletionScheduleAction { if (typeof value !== "string" || !actions.includes(value as MemoryDeletionScheduleAction)) fail("action es desconocida"); return value as MemoryDeletionScheduleAction; }
function count(value: unknown, field: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} no es un entero no negativo`); return value as number; }

export function parseMemoryDeletionSchedulePreview(value: unknown): MemoryDeletionSchedulePreview {
  const input = object(value, "preview"); exact(input, schedulePreviewKeys, "preview");
  const selectedAction = action(input.action); const selectedReason = reason(input.reason);
  if (input.schemaVersion !== 1 || input.waitSeconds !== 604800 || input.recordsModified !== false || input.automaticAction !== false) fail("preview rompe la espera o la frontera sin escritura");
  if (typeof input.previousScheduled !== "boolean" || typeof input.projectedScheduled !== "boolean" || input.previousScheduled === input.projectedScheduled || input.projectedScheduled !== (selectedAction === "schedule")) fail("preview no representa una transición");
  return { schemaVersion: 1, planId: sha(input.planId, "planId"), plannedAt: text(input.plannedAt, "plannedAt"), eligibleAt: text(input.eligibleAt, "eligibleAt"), recordId: text(input.recordId, "recordId"), action: selectedAction, reason: selectedReason, noteSha256: sha(input.noteSha256, "noteSha256"), sourceSha256: sha(input.sourceSha256, "sourceSha256"), recordSha256Before: sha(input.recordSha256Before, "recordSha256Before"), projectedRecordSha256: sha(input.projectedRecordSha256, "projectedRecordSha256"), previousScheduled: input.previousScheduled, projectedScheduled: input.projectedScheduled, waitSeconds: 604800, recordsModified: false, automaticAction: false };
}

export function parseMemoryDeletionScheduleResult(value: unknown): MemoryDeletionScheduleResult {
  const input = object(value, "result"); exact(input, scheduleResultKeys, "result"); const selectedAction = action(input.action);
  if (input.schemaVersion !== 1 || input.recordsModified !== true || input.auditWritten !== true || typeof input.previousScheduled !== "boolean" || typeof input.newScheduled !== "boolean" || input.previousScheduled === input.newScheduled || input.newScheduled !== (selectedAction === "schedule")) fail("result no demuestra la transición auditada");
  const eligibleAt = input.eligibleAt === null ? null : text(input.eligibleAt, "eligibleAt"); if ((selectedAction === "schedule") !== Boolean(eligibleAt)) fail("eligibleAt no coincide con la acción");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  return { schemaVersion: 1, planId: sha(input.planId, "planId"), recordId: text(input.recordId, "recordId"), action: selectedAction, reason: reason(input.reason), previousScheduled: input.previousScheduled, newScheduled: input.newScheduled, eligibleAt, sourceSha256Before: sha(input.sourceSha256Before, "sourceSha256Before"), sourceSha256After: sha(input.sourceSha256After, "sourceSha256After"), recordSha256Before: sha(input.recordSha256Before, "recordSha256Before"), recordSha256After: sha(input.recordSha256After, "recordSha256After"), backupSha256: sha(input.backupSha256, "backupSha256"), recordsModified: true, auditWritten: true, lifecycle };
}

export function parseMemoryDeletionPreview(value: unknown): MemoryDeletionPreview {
  const input = object(value, "preview"); exact(input, previewKeys, "preview");
  if (input.schemaVersion !== 1 || input.safeguardRequired !== true || input.tombstoneContainsContent !== false || input.recordsModified !== false || input.automaticAction !== false) fail("preview no conserva la frontera de seguridad");
  return { schemaVersion: 1, planId: sha(input.planId, "planId"), plannedAt: text(input.plannedAt, "plannedAt"), recordId: text(input.recordId, "recordId"), reason: reason(input.reason), noteSha256: sha(input.noteSha256, "noteSha256"), sourceSha256: sha(input.sourceSha256, "sourceSha256"), recordSha256: sha(input.recordSha256, "recordSha256"), requestedAt: text(input.requestedAt, "requestedAt"), eligibleAt: text(input.eligibleAt, "eligibleAt"), safeguardRequired: true, tombstoneContainsContent: false, recordsModified: false, automaticAction: false };
}

export function parseMemoryDeletionResult(value: unknown): MemoryDeletionResult {
  const input = object(value, "result"); exact(input, resultKeys, "result");
  if (input.schemaVersion !== 1 || input.recordsModified !== true || input.auditWritten !== true) fail("result no demuestra escritura auditada");
  return { schemaVersion: 1, planId: sha(input.planId, "planId"), recordId: text(input.recordId, "recordId"), reason: reason(input.reason), sourceSha256Before: sha(input.sourceSha256Before, "sourceSha256Before"), sourceSha256After: sha(input.sourceSha256After, "sourceSha256After"), recordSha256: sha(input.recordSha256, "recordSha256"), safeguardSha256: sha(input.safeguardSha256, "safeguardSha256"), tombstoneSha256: sha(input.tombstoneSha256, "tombstoneSha256"), remainingRecordCount: count(input.remainingRecordCount, "remainingRecordCount"), recordsModified: true, auditWritten: true, lifecycle: parseMemoryLifecyclePreview(input.lifecycle) };
}
