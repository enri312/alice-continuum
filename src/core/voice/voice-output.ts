export type VoiceConfiguration = "ready" | "missingApiKey" | "missingVoiceProfile";

export type VoiceOutputPreview = {
  requestId: string;
  exchangeId: string;
  textSha256: string;
  characterCount: number;
  characterLimit: number;
  provider: "fish-audio";
  model: string;
  configuration: VoiceConfiguration;
  canConfirm: boolean;
  ephemeral: true;
};

export type VoiceOutputResult = {
  requestId: string;
  mimeType: "audio/mpeg";
  audioBase64: string;
  characterCount: number;
  durationMs: number;
  ephemeral: true;
};

const previewKeys = ["requestId", "exchangeId", "textSha256", "characterCount", "characterLimit", "provider", "model", "configuration", "canConfirm", "ephemeral"];
const resultKeys = ["requestId", "mimeType", "audioBase64", "characterCount", "durationMs", "ephemeral"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256 = /^sha256:[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`Puente de voz inválido: ${message}`);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("la respuesta debe ser un objeto");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) fail("la respuesta tiene campos ausentes o desconocidos");
}

function uuid(value: unknown, field: string) {
  if (typeof value !== "string" || !uuidV4.test(value)) fail(`${field} debe ser UUID v4`);
  return value;
}

function positiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) fail(`${field} debe ser un entero positivo`);
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío`);
  return value;
}

export function parseVoiceOutputPreview(value: unknown): VoiceOutputPreview {
  const input = object(value);
  exactKeys(input, previewKeys);
  const configuration = input.configuration;
  if (configuration !== "ready" && configuration !== "missingApiKey" && configuration !== "missingVoiceProfile") fail("configuration es desconocida");
  if (input.provider !== "fish-audio" || input.ephemeral !== true || typeof input.canConfirm !== "boolean") fail("las garantías no coinciden");
  const characterCount = positiveInteger(input.characterCount, "characterCount");
  const characterLimit = positiveInteger(input.characterLimit, "characterLimit");
  if (characterCount > characterLimit || (input.canConfirm && configuration !== "ready") || (!input.canConfirm && configuration === "ready")) fail("la configuración no coincide con la autorización");
  if (typeof input.textSha256 !== "string" || !sha256.test(input.textSha256)) fail("textSha256 debe ser SHA-256");
  return {
    requestId: uuid(input.requestId, "requestId"),
    exchangeId: uuid(input.exchangeId, "exchangeId"),
    textSha256: input.textSha256,
    characterCount,
    characterLimit,
    provider: "fish-audio",
    model: text(input.model, "model"),
    configuration,
    canConfirm: input.canConfirm,
    ephemeral: true,
  };
}

export function parseVoiceOutputResult(value: unknown): VoiceOutputResult {
  const input = object(value);
  exactKeys(input, resultKeys);
  if (input.mimeType !== "audio/mpeg" || input.ephemeral !== true) fail("el resultado no respeta el descarte temporal");
  const audioBase64 = text(input.audioBase64, "audioBase64");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)) fail("audioBase64 no tiene formato válido");
  return {
    requestId: uuid(input.requestId, "requestId"),
    mimeType: "audio/mpeg",
    audioBase64,
    characterCount: positiveInteger(input.characterCount, "characterCount"),
    durationMs: nonNegativeInteger(input.durationMs, "durationMs"),
    ephemeral: true,
  };
}
