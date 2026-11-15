export type VoiceTurnTranscript = {
  text: string;
  noSpeech: boolean;
  model: string;
  durationMs: number;
  ephemeralAudio: true;
  sentToConversation: false;
  persisted: false;
};

const transcriptKeys = ["text", "noSpeech", "model", "durationMs", "ephemeralAudio", "sentToConversation", "persisted"];

export function parseVoiceTurnTranscript(value: unknown): VoiceTurnTranscript {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Transcripción de voz inválida: se esperaba un objeto");
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  const expected = [...transcriptKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new Error("Transcripción de voz inválida: contiene campos desconocidos");
  if (typeof input.text !== "string" || typeof input.noSpeech !== "boolean" || typeof input.model !== "string" || !input.model.trim()) throw new Error("Transcripción de voz inválida: el contenido no es válido");
  if (!Number.isSafeInteger(input.durationMs) || (input.durationMs as number) < 0) throw new Error("Transcripción de voz inválida: la duración no es válida");
  if (input.ephemeralAudio !== true || input.sentToConversation !== false || input.persisted !== false) throw new Error("Transcripción de voz inválida: las garantías de privacidad no coinciden");
  if (input.noSpeech !== !input.text.trim()) throw new Error("Transcripción de voz inválida: el estado de habla no coincide");
  return input as VoiceTurnTranscript;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return btoa(binary);
}
