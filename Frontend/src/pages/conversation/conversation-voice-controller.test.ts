import { afterEach, expect, it, vi } from "vitest";
import { createConversationVoice } from "./conversation-voice-controller";

const capture = vi.hoisted(() => ({ record: () => {} }));

vi.mock("../../core/voice/voice-capture", () => ({
  VoiceCapture: class {
    constructor(events: { onRecorded: (audio: Blob, seconds: number) => void }) {
      capture.record = () => events.onRecorded(new Blob(["audio"], { type: "audio/webm" }), 2);
    }
    async start() {}
    cancel() {}
  },
}));

afterEach(() => vi.unstubAllGlobals());

it.each([
  { source: "ignored", text: "Reproduce Spotify", sent: 0 },
  { source: "attended", text: "Alice, abre el reproductor equivocado.", sent: 1 },
])("deja corregir $source tras cerrar la escucha y sin enviar el borrador", async ({ source, text, sent }) => {
  vi.stubGlobal("document", { getElementById: () => null });
  vi.stubGlobal("HTMLAudioElement", class {});
  vi.stubGlobal("AudioContext", class {
    async resume() {}
    async close() {}
  });
  const respond = vi.fn(async () => ({ exchangeId: "test" }));
  const stop = vi.fn(async () => {});
  const setDraft = vi.fn();
  const unused = async (): Promise<never> => { throw Error("Salida de voz no disponible en la prueba"); };
  const voice = createConversationVoice({
    desktopApp: () => true, isDisabled: () => false, getDraft: () => "Borrador previo ",
    setDraft, invalidateReview: vi.fn(), prepare: async () => {}, start: async () => "voice-test",
    stop, transcribe: async () => ({
      text, noSpeech: false, model: "Whisper", durationMs: 1,
      ephemeralAudio: true, sentToConversation: false, persisted: false,
    }), respond, speak: unused, preview: unused, confirm: unused, cancel: async () => {},
  }, () => {});
  try {
    voice.dispatch({ type: "listen" });
    await vi.waitFor(() => expect(voice.snapshot().loopState).toBe("standby"));
    capture.record();
    expect(voice.snapshot().canReviewTranscript).toBe(false);
    await vi.waitFor(() => {
      const current = voice.snapshot();
      expect(current.loopState).toBe("standby");
      expect(source === "ignored" ? current.ignored : current.lastTurn).toMatchObject({ transcript: text });
    });
    expect(setDraft).not.toHaveBeenCalled();
    voice.dispatch({ type: "reviewTranscript", value: source });
    expect(voice.snapshot().active).toBe(false);
    expect(stop).toHaveBeenCalledExactlyOnceWith("voice-test");
    expect(setDraft).toHaveBeenCalledExactlyOnceWith(`Borrador previo\n${text}`);
    expect(respond).toHaveBeenCalledTimes(sent);
  } finally {
    voice.dispose();
  }
});
