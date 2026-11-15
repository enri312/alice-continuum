export const FACE_READINESS_SCHEMA_VERSION = 1 as const;

export type FaceModelState = "verified" | "missing" | "mismatch" | "error";
export type FaceReadinessStatus = {
  schemaVersion: typeof FACE_READINESS_SCHEMA_VERSION;
  capabilityId: "perception.face.landmarks";
  model: { fileName: string; state: FaceModelState; sizeBytes: number; sha256: string | null; detail: string };
  runtime: { available: boolean; detail: string };
  sensorOpened: false;
};

function fail(message: string): never {
  throw new Error(`Diagnóstico facial inválido: ${message}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const expected = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !expected.has(key));
  const missing = keys.filter((key) => !(key in value));
  if (unknown.length) fail(`${field} contiene campos desconocidos: ${unknown.join(", ")}`);
  if (missing.length) fail(`${field} no contiene: ${missing.join(", ")}`);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío`);
  return value;
}

export function parseFaceReadinessStatus(value: unknown): FaceReadinessStatus {
  const input = record(value, "status");
  exactKeys(input, ["schemaVersion", "capabilityId", "model", "runtime", "sensorOpened"], "status");
  if (input.schemaVersion !== FACE_READINESS_SCHEMA_VERSION) fail("schemaVersion debe ser 1");
  if (input.capabilityId !== "perception.face.landmarks") fail("capabilityId no corresponde a rostro");
  if (input.sensorOpened !== false) fail("el diagnóstico de preparación no puede abrir un sensor");

  const model = record(input.model, "model");
  exactKeys(model, ["fileName", "state", "sizeBytes", "sha256", "detail"], "model");
  const state = model.state;
  if (state !== "verified" && state !== "missing" && state !== "mismatch" && state !== "error") fail("model.state desconocido");
  if (!Number.isInteger(model.sizeBytes) || (model.sizeBytes as number) < 0) fail("model.sizeBytes inválido");
  if (model.sha256 !== null && (typeof model.sha256 !== "string" || !/^[A-F0-9]{64}$/.test(model.sha256))) fail("model.sha256 inválido");

  const runtime = record(input.runtime, "runtime");
  exactKeys(runtime, ["available", "detail"], "runtime");
  if (typeof runtime.available !== "boolean") fail("runtime.available debe ser booleano");

  return {
    schemaVersion: FACE_READINESS_SCHEMA_VERSION,
    capabilityId: "perception.face.landmarks",
    model: {
      fileName: text(model.fileName, "model.fileName"),
      state,
      sizeBytes: model.sizeBytes as number,
      sha256: model.sha256 as string | null,
      detail: text(model.detail, "model.detail"),
    },
    runtime: { available: runtime.available, detail: text(runtime.detail, "runtime.detail") },
    sensorOpened: false,
  };
}
