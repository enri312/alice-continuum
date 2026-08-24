import { parseMemoryLifecyclePreview, type MemoryLifecyclePreviewSnapshot } from "./memory-lifecycle";

export type MemoryArchiveAction = "archive" | "restore";
export type MemoryArchiveReason = "ownerChoice" | "superseded" | "noLongerRelevant" | "relevantAgain";

export type MemoryArchivePreview = {
  schemaVersion: 1;
  planId: string;
  plannedAt: string;
  recordId: string;
  action: MemoryArchiveAction;
  reason: MemoryArchiveReason;
  noteSha256: string;
  sourceSha256: string;
  recordSha256Before: string;
  projectedRecordSha256: string;
  previousArchived: boolean;
  projectedArchived: boolean;
  recordsModified: false;
  automaticAction: false;
};

export type MemoryArchiveResult = {
  schemaVersion: 1;
  planId: string;
  recordId: string;
  action: MemoryArchiveAction;
  reason: MemoryArchiveReason;
  previousArchived: boolean;
  newArchived: boolean;
  sourceSha256Before: string;
  sourceSha256After: string;
  recordSha256Before: string;
  recordSha256After: string;
  backupSha256: string;
  recordsModified: true;
  auditWritten: true;
  lifecycle: MemoryLifecyclePreviewSnapshot;
};

const digest = /^sha256:[0-9a-f]{64}$/;
const actions: MemoryArchiveAction[] = ["archive", "restore"];
const reasons: MemoryArchiveReason[] = ["ownerChoice", "superseded", "noLongerRelevant", "relevantAgain"];
const previewKeys = ["schemaVersion", "planId", "plannedAt", "recordId", "action", "reason", "noteSha256", "sourceSha256", "recordSha256Before", "projectedRecordSha256", "previousArchived", "projectedArchived", "recordsModified", "automaticAction"];
const resultKeys = ["schemaVersion", "planId", "recordId", "action", "reason", "previousArchived", "newArchived", "sourceSha256Before", "sourceSha256After", "recordSha256Before", "recordSha256After", "backupSha256", "recordsModified", "auditWritten", "lifecycle"];

function fail(message: string): never { throw new Error(`Archivo de memoria inválido: ${message}`); }
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: string[], field: string) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) fail(`${field} tiene campos ausentes o desconocidos`);
}
function sha(value: unknown, field: string) {
  if (typeof value !== "string" || !digest.test(value)) fail(`${field} no es SHA-256`);
  return value;
}
function action(value: unknown, field: string) {
  if (typeof value !== "string" || !actions.includes(value as MemoryArchiveAction)) fail(`${field} es desconocida`);
  return value as MemoryArchiveAction;
}
function reason(value: unknown, field: string) {
  if (typeof value !== "string" || !reasons.includes(value as MemoryArchiveReason)) fail(`${field} es desconocido`);
  return value as MemoryArchiveReason;
}
function validateTransition(selectedAction: MemoryArchiveAction, selectedReason: MemoryArchiveReason, before: unknown, after: unknown, field: string) {
  if (typeof before !== "boolean" || typeof after !== "boolean" || before === after) fail(`${field} no describe una transición real`);
  if ((selectedAction === "archive" && (before || !after || selectedReason === "relevantAgain")) || (selectedAction === "restore" && (!before || after || selectedReason !== "relevantAgain"))) fail(`${field} mezcla acción, motivo y estado`);
}

export function parseMemoryArchivePreview(value: unknown): MemoryArchivePreview {
  const input = object(value, "preview");
  exactKeys(input, previewKeys, "preview");
  if (input.schemaVersion !== 1) fail("preview.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("preview.recordId está vacío");
  if (typeof input.plannedAt !== "string" || Number.isNaN(Date.parse(input.plannedAt))) fail("preview.plannedAt no es una fecha válida");
  const selectedAction = action(input.action, "preview.action");
  const selectedReason = reason(input.reason, "preview.reason");
  validateTransition(selectedAction, selectedReason, input.previousArchived, input.projectedArchived, "preview");
  const recordSha256Before = sha(input.recordSha256Before, "preview.recordSha256Before");
  const projectedRecordSha256 = sha(input.projectedRecordSha256, "preview.projectedRecordSha256");
  if (recordSha256Before === projectedRecordSha256 || input.recordsModified !== false || input.automaticAction !== false) fail("preview declara efectos o una fuente sin cambios");
  return { schemaVersion: 1, planId: sha(input.planId, "preview.planId"), plannedAt: input.plannedAt, recordId: input.recordId, action: selectedAction, reason: selectedReason, noteSha256: sha(input.noteSha256, "preview.noteSha256"), sourceSha256: sha(input.sourceSha256, "preview.sourceSha256"), recordSha256Before, projectedRecordSha256, previousArchived: input.previousArchived as boolean, projectedArchived: input.projectedArchived as boolean, recordsModified: false, automaticAction: false };
}

export function parseMemoryArchiveResult(value: unknown): MemoryArchiveResult {
  const input = object(value, "result");
  exactKeys(input, resultKeys, "result");
  if (input.schemaVersion !== 1) fail("result.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("result.recordId está vacío");
  const selectedAction = action(input.action, "result.action");
  const selectedReason = reason(input.reason, "result.reason");
  validateTransition(selectedAction, selectedReason, input.previousArchived, input.newArchived, "result");
  const sourceSha256Before = sha(input.sourceSha256Before, "result.sourceSha256Before");
  const sourceSha256After = sha(input.sourceSha256After, "result.sourceSha256After");
  const recordSha256Before = sha(input.recordSha256Before, "result.recordSha256Before");
  const recordSha256After = sha(input.recordSha256After, "result.recordSha256After");
  const backupSha256 = sha(input.backupSha256, "result.backupSha256");
  if (sourceSha256Before === sourceSha256After || recordSha256Before === recordSha256After || backupSha256 !== sourceSha256Before || input.recordsModified !== true || input.auditWritten !== true) fail("result no confirma una transición respaldada y auditada");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  if (lifecycle.sourceSha256 !== sourceSha256After) fail("result.lifecycle no corresponde a la fuente nueva");
  const reference = lifecycle.preview?.references.find((item) => item.recordId === input.recordId);
  if (!reference || reference.recordSha256 !== recordSha256After || reference.archived !== input.newArchived) fail("result.lifecycle no contiene el archivo resultante");
  return { schemaVersion: 1, planId: sha(input.planId, "result.planId"), recordId: input.recordId, action: selectedAction, reason: selectedReason, previousArchived: input.previousArchived as boolean, newArchived: input.newArchived as boolean, sourceSha256Before, sourceSha256After, recordSha256Before, recordSha256After, backupSha256, recordsModified: true, auditWritten: true, lifecycle };
}
