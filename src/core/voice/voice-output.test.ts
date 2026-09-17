import { describe, expect, it } from "vitest";
import { parseVoiceOutputPreview, parseVoiceOutputResult } from "./voice-output";

const preview = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  exchangeId: "123e4567-e89b-42d3-a456-426614174001",
  textSha256: `sha256:${"a".repeat(64)}`,
  characterCount: 18,
  characterLimit: 1500,
  provider: "fish-audio",
  model: "s2.1-pro-free",
  configuration: "ready",
  canConfirm: true,
  ephemeral: true,
};

describe("voice output contract", () => {
  it("accepts a ready ephemeral preview", () => {
    expect(parseVoiceOutputPreview(preview)).toMatchObject({ canConfirm: true, provider: "fish-audio" });
  });

  it("rejects a preview that authorizes an absent configuration", () => {
    expect(() => parseVoiceOutputPreview({ ...preview, configuration: "missingApiKey" })).toThrow(/configuración/);
  });

  it("accepts only temporary mp3 output", () => {
    expect(parseVoiceOutputResult({
      requestId: preview.requestId,
      mimeType: "audio/mpeg",
      audioBase64: "AQID",
      characterCount: 18,
      durationMs: 820,
      ephemeral: true,
    }).audioBase64).toBe("AQID");
    expect(() => parseVoiceOutputResult({
      requestId: preview.requestId,
      mimeType: "audio/wav",
      audioBase64: "AQID",
      characterCount: 18,
      durationMs: 820,
      ephemeral: true,
    })).toThrow(/descarte/);
  });
});
