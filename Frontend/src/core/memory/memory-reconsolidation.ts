import { parseMemoryLifecyclePreview, type MemoryLifecyclePreviewSnapshot } from "./memory-lifecycle";

export type MemoryReconsolidationReason = "ownerCorrection" | "newContext" | "clarification";
export type MemoryReconsolidationField = "intention" | "summary" | "nextStep" | "source";

export type MemoryReconsolidationPreview = {
  schemaVersion: 1;
  planId: string;
  plannedAt: string;
  recordId: string;
  reason: MemoryReconsolidationReason;
  noteSha256: string;
  sourceSha256: string;
  recordSha256Before: string;
  projectedRecordSha256: string;
  previousVersion: number;
  projectedVersion: number;
  changedFields: MemoryReconsolidationField[];
  recordsModified: false;
  versionWritten: false;
  automaticAction: false;
};

export type MemoryReconsolidationResult = {
  schemaVersion: 1;
  planId: string;
  revisionId: string;
  recordId: string;
  reason: MemoryReconsolidationReason;
  previousVersion: number;
  newVersion: number;
  sourceSha256Before: string;
  sourceSha256After: string;
  recordSha256Before: string;
  recordSha256After: string;
  backupSha256: string;
  revisionSha256: string;
  recordsModified: true;
  versionWritten: true;
  auditWritten: true;
  lifecycle: MemoryLifecyclePreviewSnapshot;
};

const digest = /^sha256:[0-9a-f]{64}$/;
const reasons: MemoryReconsolidationReason[] = ["ownerCorrection", "newContext", "clarification"];
const fields: MemoryReconsolidationField[] = ["intention", "summary", "nextStep", "source"];
const previewKeys = ["schemaVersion", "planId", "plannedAt", "recordId", "reason", "noteSha256", "sourceSha256", "recordSha256Before", "projectedRecordSha256", "previousVersion", "projectedVersion", "changedFields", "recordsModified", "versionWritten", "automaticAction"];
const resultKeys = ["schemaVersion", "planId", "revisionId", "recordId", "reason", "previousVersion", "newVersion", "sourceSha256Before", "sourceSha256After", "recordSha256Before", "recordSha256After", "backupSha256", "revisionSha256", "recordsModified", "versionWritten", "auditWritten", "lifecycle"];

function fail(message: string): never { throw new Error(`Reconsolidación de memoria inválida: ${message}`); }
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
function version(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail(`${field} no es una versión válida`);
  return value as number;
}
function reason(value: unknown, field: string) {
  if (typeof value !== "string" || !reasons.includes(value as MemoryReconsolidationReason)) fail(`${field} es desconocido`);
  return value as MemoryReconsolidationReason;
}

export function parseMemoryReconsolidationPreview(value: unknown): MemoryReconsolidationPreview {
  const input = object(value, "preview");
  exactKeys(input, previewKeys, "preview");
  if (input.schemaVersion !== 1) fail("preview.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("preview.recordId está vacío");
  if (typeof input.plannedAt !== "string" || Number.isNaN(Date.parse(input.plannedAt))) fail("preview.plannedAt no es una fecha válida");
  if (!Array.isArray(input.changedFields) || input.changedFields.length === 0) fail("preview.changedFields debe declarar cambios");
  const changedFields = input.changedFields.map((field) => {
    if (typeof field !== "string" || !fields.includes(field as MemoryReconsolidationField)) fail("preview.changedFields contiene un campo desconocido");
    return field as MemoryReconsolidationField;
  });
  if (new Set(changedFields).size !== changedFields.length) fail("preview.changedFields repite campos");
  const previousVersion = version(input.previousVersion, "preview.previousVersion");
  const projectedVersion = version(input.projectedVersion, "preview.projectedVersion");
  if (projectedVersion !== previousVersion + 1) fail("preview no propone una única versión sucesora");
  const recordSha256Before = sha(input.recordSha256Before, "preview.recordSha256Before");
  const projectedRecordSha256 = sha(input.projectedRecordSha256, "preview.projectedRecordSha256");
  if (recordSha256Before === projectedRecordSha256) fail("preview no cambia el registro");
  if (input.recordsModified !== false || input.versionWritten !== false || input.automaticAction !== false) fail("preview declara efectos antes de confirmar");
  return {
    schemaVersion: 1,
    planId: sha(input.planId, "preview.planId"),
    plannedAt: input.plannedAt,
    recordId: input.recordId,
    reason: reason(input.reason, "preview.reason"),
    noteSha256: sha(input.noteSha256, "preview.noteSha256"),
    sourceSha256: sha(input.sourceSha256, "preview.sourceSha256"),
    recordSha256Before,
    projectedRecordSha256,
    previousVersion,
    projectedVersion,
    changedFields,
    recordsModified: false,
    versionWritten: false,
    automaticAction: false,
  };
}

export function parseMemoryReconsolidationResult(value: unknown): MemoryReconsolidationResult {
  const input = object(value, "result");
  exactKeys(input, resultKeys, "result");
  if (input.schemaVersion !== 1) fail("result.schemaVersion debe ser 1");
  if (typeof input.recordId !== "string" || !input.recordId.trim()) fail("result.recordId está vacío");
  const previousVersion = version(input.previousVersion, "result.previousVersion");
  const newVersion = version(input.newVersion, "result.newVersion");
  if (newVersion !== previousVersion + 1) fail("result no confirma una única versión sucesora");
  const sourceSha256Before = sha(input.sourceSha256Before, "result.sourceSha256Before");
  const sourceSha256After = sha(input.sourceSha256After, "result.sourceSha256After");
  const recordSha256Before = sha(input.recordSha256Before, "result.recordSha256Before");
  const recordSha256After = sha(input.recordSha256After, "result.recordSha256After");
  const backupSha256 = sha(input.backupSha256, "result.backupSha256");
  if (sourceSha256Before === sourceSha256After || recordSha256Before === recordSha256After) fail("result no produjo una versión distinta");
  if (backupSha256 !== sourceSha256Before) fail("result.backupSha256 no protege la fuente anterior");
  if (input.recordsModified !== true || input.versionWritten !== true || input.auditWritten !== true) fail("result no confirma todos los efectos obligatorios");
  const lifecycle = parseMemoryLifecyclePreview(input.lifecycle);
  if (lifecycle.sourceSha256 !== sourceSha256After) fail("result.lifecycle no corresponde a la fuente nueva");
  const reference = lifecycle.preview?.references.find((item) => item.recordId === input.recordId);
  if (!reference || reference.recordSha256 !== recordSha256After || reference.reconsolidationCount !== newVersion - 1) fail("result.lifecycle no contiene la versión confirmada");
  return {
    schemaVersion: 1,
    planId: sha(input.planId, "result.planId"),
    revisionId: sha(input.revisionId, "result.revisionId"),
    recordId: input.recordId,
    reason: reason(input.reason, "result.reason"),
    previousVersion,
    newVersion,
    sourceSha256Before,
    sourceSha256After,
    recordSha256Before,
    recordSha256After,
    backupSha256,
    revisionSha256: sha(input.revisionSha256, "result.revisionSha256"),
    recordsModified: true,
    versionWritten: true,
    auditWritten: true,
    lifecycle,
  };
}
