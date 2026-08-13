export type LayeredMemoryState = "unavailable" | "ready" | "active" | "sourceChanged" | "rolledBack" | "blocked";

export type LayeredMemoryPreview = {
  sourceSha256: string;
  recordCount: number;
  workingCount: number;
  episodicCount: number;
  taughtFactCount: number;
  unclassifiedCount: number;
  proceduralPendingCount: number;
  preferencePendingCount: number;
  contentCopied: false;
  automaticClassification: false;
};

export type LayeredMemorySnapshot = {
  schemaVersion: 1;
  state: LayeredMemoryState;
  storagePath: string;
  sourceSha256: string | null;
  activeRevisionId: string | null;
  revisionCount: number;
  preview: LayeredMemoryPreview | null;
  blockedReason: string | null;
  migrationRequiresConfirmation: true;
  automaticMigration: false;
  contentCopied: false;
};

const snapshotKeys = ["schemaVersion", "state", "storagePath", "sourceSha256", "activeRevisionId", "revisionCount", "preview", "blockedReason", "migrationRequiresConfirmation", "automaticMigration", "contentCopied"];
const previewKeys = ["sourceSha256", "recordCount", "workingCount", "episodicCount", "taughtFactCount", "unclassifiedCount", "proceduralPendingCount", "preferencePendingCount", "contentCopied", "automaticClassification"];
const states: LayeredMemoryState[] = ["unavailable", "ready", "active", "sourceChanged", "rolledBack", "blocked"];
const digest = /^sha256:[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`Estado R6.1 inválido: ${message}`);
}
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

function parsePreview(value: unknown): LayeredMemoryPreview {
  const input = record(value, "preview");
  exactKeys(input, previewKeys, "preview");
  if (typeof input.sourceSha256 !== "string" || !digest.test(input.sourceSha256)) fail("preview.sourceSha256 no es SHA-256");
  if (input.contentCopied !== false || input.automaticClassification !== false) fail("preview declara automatización o copia de contenido");
  const preview: LayeredMemoryPreview = {
    sourceSha256: input.sourceSha256,
    recordCount: count(input.recordCount, "preview.recordCount"),
    workingCount: count(input.workingCount, "preview.workingCount"),
    episodicCount: count(input.episodicCount, "preview.episodicCount"),
    taughtFactCount: count(input.taughtFactCount, "preview.taughtFactCount"),
    unclassifiedCount: count(input.unclassifiedCount, "preview.unclassifiedCount"),
    proceduralPendingCount: count(input.proceduralPendingCount, "preview.proceduralPendingCount"),
    preferencePendingCount: count(input.preferencePendingCount, "preview.preferencePendingCount"),
    contentCopied: false,
    automaticClassification: false,
  };
  if (preview.workingCount !== 0) fail("R6.1 no puede persistir memoria de trabajo");
  if (preview.episodicCount + preview.taughtFactCount + preview.unclassifiedCount !== preview.recordCount) fail("preview no clasifica exactamente todos los registros");
  if (preview.proceduralPendingCount + preview.preferencePendingCount > preview.unclassifiedCount) fail("los pendientes exceden los registros sin clasificar");
  return preview;
}

export function parseLayeredMemorySnapshot(value: unknown): LayeredMemorySnapshot {
  const input = record(value, "snapshot");
  exactKeys(input, snapshotKeys, "snapshot");
  if (input.schemaVersion !== 1) fail("schemaVersion debe ser 1");
  if (typeof input.state !== "string" || !states.includes(input.state as LayeredMemoryState)) fail("state es desconocido");
  if (typeof input.storagePath !== "string" || !input.storagePath.trim()) fail("storagePath está vacío");
  if (input.migrationRequiresConfirmation !== true || input.automaticMigration !== false || input.contentCopied !== false) fail("las fronteras de migración no están cerradas");
  const sourceSha256 = nullableDigest(input.sourceSha256, "sourceSha256");
  const activeRevisionId = nullableDigest(input.activeRevisionId, "activeRevisionId");
  const preview = input.preview === null ? null : parsePreview(input.preview);
  const blockedReason = nullableString(input.blockedReason, "blockedReason");
  const state = input.state as LayeredMemoryState;
  if (preview && sourceSha256 !== preview.sourceSha256) fail("preview no corresponde a sourceSha256");
  if ((state === "active" || state === "sourceChanged") && !activeRevisionId) fail("el estado activo/cambiado requiere revisión activa");
  if (state === "blocked" && !blockedReason) fail("el bloqueo requiere una razón");
  if (state !== "blocked" && blockedReason) fail("sólo blocked puede incluir una razón");
  return {
    schemaVersion: 1,
    state,
    storagePath: input.storagePath,
    sourceSha256,
    activeRevisionId,
    revisionCount: count(input.revisionCount, "revisionCount"),
    preview,
    blockedReason,
    migrationRequiresConfirmation: true,
    automaticMigration: false,
    contentCopied: false,
  };
}
