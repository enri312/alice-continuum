import { describe, expect, it } from "vitest";
import { bytesToBase64, parseVoiceTurnTranscript } from "./voice-input";

describe("voice turn input", () => {
  it("accepts only an ephemeral unsubmitted transcript", () => {
    const result = parseVoiceTurnTranscript({ text: "Hola Alice", noSpeech: false, model: "gemma", durationMs: 1200, ephemeralAudio: true, sentToConversation: false, persisted: false });
    expect(result.text).toBe("Hola Alice");
    expect(() => parseVoiceTurnTranscript({ ...result, persisted: true })).toThrow(/privacidad/);
  });

  it("distinguishes silence and encodes bytes without files", () => {
    expect(parseVoiceTurnTranscript({ text: "", noSpeech: true, model: "gemma", durationMs: 30, ephemeralAudio: true, sentToConversation: false, persisted: false }).noSpeech).toBe(true);
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});
