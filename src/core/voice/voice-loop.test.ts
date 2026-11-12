import { describe, expect, it, vi } from "vitest";
import { VoiceLoop, type VoiceLoopPorts } from "./voice-loop";

function fixture() {
  const captures: {
    quiet: () => void;
    error: Parameters<VoiceLoopPorts["capture"]>[2];
    record: (metadata?: { recordedSeconds?: number }) => void;
    control: ReturnType<VoiceLoopPorts["capture"]>;
  }[] = [];
  let recorded!: Parameters<VoiceLoopPorts["capture"]>[0];
  let quiet!: () => void;
  const ports: VoiceLoopPorts = {
    authorize: vi.fn(async () => "session-1"), revoke: vi.fn(async () => undefined),
    capture: vi.fn((onRecorded, onQuiet, onError) => {
      recorded = onRecorded; quiet = onQuiet;
      const control = { start: vi.fn(async () => undefined), cancel: vi.fn(), finish: vi.fn() };
      captures.push({ quiet: onQuiet, error: onError, record: metadata => onRecorded(new Blob(["fixture"]), metadata), control });
      return control;
    }),
    transcribe: vi.fn(async () => ({ text: "Hola, Alice", noSpeech: false, model: "Gemma", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false } as const)),
    respond: vi.fn(async () => ({ exchangeId: "exchange-1" })),
    synthesize: vi.fn(async () => ({ requestId: "tts", mimeType: "audio/mpeg", audioBase64: "AAAA", characterCount: 4, durationMs: 20, ephemeral: true } as const)),
    play: vi.fn(async (_audio, onStarted) => { onStarted?.(); }), stopPlayback: vi.fn(), onState: vi.fn(), onNotice: vi.fn(),
  };
  return { loop: new VoiceLoop(ports), ports, captures, record: (metadata?: { recordedSeconds?: number }) => recorded(new Blob(["fixture"]), metadata), quiet: () => quiet() };
}
async function flush() { for (let i = 0; i < 16; i++) await Promise.resolve(); }

describe("sesión de voz automática", () => {
  it.each(["input_backlog", "output_overflow"] as const)("descarta la toma y prepara un único filtro nuevo ante %s", async reason => {
    const f = fixture();
    try {
      await f.loop.start();
      f.captures[0].error("El filtro de audio no pudo mantener el ritmo de captura.", reason);
      await flush();
      expect(f.captures[0].control.cancel).toHaveBeenCalledOnce();
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
      expect(f.ports.authorize).toHaveBeenCalledOnce();
      expect(f.ports.revoke).not.toHaveBeenCalled();
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
      expect(f.ports.play).not.toHaveBeenCalled();
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      expect(vi.mocked(f.ports.onNotice!).mock.calls.at(-1)?.[0]).toMatch(/descart/i);
    } finally { f.loop.stop(); }
  });

  it("revoca la sesión si la nueva captura vuelve a fallar al planificar", async () => {
    const f = fixture();
    try {
      await f.loop.start();
      f.captures[0].error("primera sobrecarga", "input_backlog");
      await flush();
      f.captures[1].error("segunda sobrecarga", "output_overflow");
      await flush();
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
      expect(f.captures[1].control.cancel).toHaveBeenCalledOnce();
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.onState).toHaveBeenLastCalledWith("error", "segunda sobrecarga");
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it.each([undefined, "unsupported_rate"] as const)("detiene sin reintento los fallos sin clasificación recuperable: %s", async reason => {
    const f = fixture();
    try {
      await f.loop.start();
      f.captures[0].error("fallo no recuperable", reason);
      await flush();
      expect(f.ports.capture).toHaveBeenCalledOnce();
      expect(f.captures[0].control.cancel).toHaveBeenCalledOnce();
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.onState).toHaveBeenLastCalledWith("error", "fallo no recuperable");
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it("ignora mensajes, silencios y errores tardíos del filtro sustituido", async () => {
    const f = fixture();
    try {
      await f.loop.start();
      const stale = f.captures[0];
      stale.error("sobrecarga", "input_backlog");
      await flush();
      stale.record(); stale.quiet(); stale.error("error tardío", "output_overflow"); stale.error("otro error tardío");
      await flush();
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
      expect(f.ports.revoke).not.toHaveBeenCalled();
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      f.captures[1].error("segundo fallo vigente", "input_backlog");
      await flush();
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
    } finally { f.loop.stop(); }
  });

  it("cancelar durante la recuperación impide escucha y mensajes tardíos", async () => {
    const f = fixture();
    let ready!: () => void;
    const recovery = { start: vi.fn(() => new Promise<void>(resolve => { ready = resolve; })), cancel: vi.fn(), finish: vi.fn() };
    try {
      await f.loop.start();
      vi.mocked(f.ports.capture).mockImplementationOnce((onRecorded, onQuiet, onError) => {
        f.captures.push({ quiet: onQuiet, error: onError, record: () => onRecorded(new Blob(["late"])), control: recovery });
        return recovery;
      });
      f.captures[0].error("sobrecarga", "output_overflow");
      await flush();
      expect(f.ports.onState).toHaveBeenLastCalledWith("arming");
      f.loop.stop();
      expect(recovery.cancel).toHaveBeenCalledOnce();
      ready();
      f.captures[1].record(); f.captures[1].quiet(); f.captures[1].error("fallo después de detener", "input_backlog");
      await flush();
      expect(f.ports.onState).toHaveBeenLastCalledWith("idle", undefined);
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it("silencios y un turno completado no renuevan el presupuesto de recuperación", async () => {
    const f = fixture();
    try {
      await f.loop.start();
      f.captures[0].error("sobrecarga", "input_backlog");
      await flush();
      f.quiet(); await flush();
      f.quiet(); await flush();
      f.record(); await flush();
      expect(f.ports.respond).toHaveBeenCalledOnce();
      expect(f.ports.synthesize).toHaveBeenCalledOnce();
      const beforeError = f.captures.length;
      f.captures.at(-1)!.error("sobrecarga tras silencio y turno", "output_overflow");
      await flush();
      expect(f.captures).toHaveLength(beforeError);
      expect(f.ports.authorize).toHaveBeenCalledOnce();
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.onState).toHaveBeenLastCalledWith("error", "sobrecarga tras silencio y turno");
      expect(f.ports.respond).toHaveBeenCalledOnce();
      expect(f.ports.synthesize).toHaveBeenCalledOnce();
    } finally { f.loop.stop(); }
  });

  it("una nueva autorización explícita dispone de su propia recuperación", async () => {
    const f = fixture();
    try {
      await f.loop.start();
      f.captures[0].error("sobrecarga de la primera sesión", "input_backlog");
      await flush();
      f.loop.stop();
      await f.loop.start();
      f.captures[2].error("sobrecarga de la segunda sesión", "output_overflow");
      await flush();
      expect(f.ports.authorize).toHaveBeenCalledTimes(2);
      expect(f.ports.capture).toHaveBeenCalledTimes(4);
      expect(f.ports.revoke).toHaveBeenCalledOnce();
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      expect(f.ports.transcribe).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it("recuperar el filtro no extiende las dos horas de la sesión autorizada", async () => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      await f.loop.start();
      await vi.advanceTimersByTimeAsync(119 * 60 * 1000);
      f.captures[0].error("sobrecarga al final de la sesión", "input_backlog");
      await flush();
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      expect(f.ports.authorize).toHaveBeenCalledOnce();
      expect(f.ports.revoke).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60 * 1000);
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.onState).toHaveBeenLastCalledWith("idle", undefined);
      expect(f.ports.capture).toHaveBeenCalledTimes(2);
    } finally { f.loop.stop(); vi.useRealTimers(); }
  });

  it("autoriza una vez, completa el turno y vuelve a escuchar sin otra confirmación", async () => {
    const f = fixture(); await f.loop.start(); f.record(); await flush();
    expect(f.ports.authorize).toHaveBeenCalledTimes(1);
    expect(f.ports.transcribe).toHaveBeenCalledTimes(1);
    expect(f.ports.respond).toHaveBeenCalledWith("Hola, Alice", "session-1");
    expect(f.ports.synthesize).toHaveBeenCalledWith({ exchangeId: "exchange-1" }, "session-1");
    expect(f.ports.play).toHaveBeenCalledTimes(1);
    expect(f.ports.capture).toHaveBeenCalledTimes(2);
    f.loop.stop(); expect(f.ports.revoke).toHaveBeenCalledWith("session-1");
  });
  it("rearma el silencio sin enviar audio, mensajes o solicitudes TTS", async () => {
    const f = fixture(); await f.loop.start(); f.quiet(); await flush();
    expect(f.ports.capture).toHaveBeenCalledTimes(2);
    expect(f.ports.transcribe).not.toHaveBeenCalled();
    expect(f.ports.synthesize).not.toHaveBeenCalled(); f.loop.stop();
  });
  it("vuelve a espera al detener la conversación sin generar respuesta, guardar turno ni llamar a Fish", async () => {
    const f = fixture();
    f.ports.transcribe = vi.fn(async () => ({ text: "Detén la conversación, Alice.", noSpeech: false, model: "Gemma", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false } as const));
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.revoke).not.toHaveBeenCalled();
    expect(f.ports.respond).not.toHaveBeenCalled();
    expect(f.ports.synthesize).not.toHaveBeenCalled();
    expect(f.ports.play).not.toHaveBeenCalled();
    expect(f.ports.capture).toHaveBeenCalledTimes(2);
    expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
    f.loop.stop();
  });
  it("no detiene por una mención explicativa de la orden", async () => {
    const f = fixture();
    f.ports.transcribe = vi.fn(async () => ({ text: "Alice, ¿qué pasa si digo detén la conversación?", noSpeech: false, model: "Gemma", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false } as const));
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.respond).toHaveBeenCalledOnce();
    expect(f.ports.revoke).not.toHaveBeenCalled();
    f.loop.stop();
  });
  it("revoca una sesión que termina de prepararse después de detener", async () => {
    const f = fixture(); let grant!: (id: string) => void;
    f.ports.authorize = () => new Promise(resolve => { grant = resolve; });
    const pending = f.loop.start(); f.loop.stop(); grant("late-session"); await pending;
    expect(f.ports.revoke).toHaveBeenCalledWith("late-session");
    expect(f.ports.capture).not.toHaveBeenCalled();
  });
  it.each(["transcribe", "respond", "synthesize"] as const)("descarta el resultado tardío de %s sin continuar el turno", async stage => {
    const f = fixture(); let complete!: (value: never) => void;
    f.ports[stage] = vi.fn(() => new Promise(resolve => { complete = resolve; })) as never;
    await f.loop.start(); f.record(); await flush(); f.loop.stop();
    complete((stage === "transcribe" ? { text: "Tarde", noSpeech: false } : stage === "respond" ? { exchangeId: "late" } : { audioBase64: "late" }) as never);
    await flush();
    expect(f.ports.play).not.toHaveBeenCalled();
    expect(f.ports.capture).toHaveBeenCalledTimes(1);
  });
  it("conserva la respuesta en texto y continúa escuchando ante un fallo de voz sin reintentar Fish", async () => {
    const f = fixture(); f.ports.synthesize = vi.fn(async () => { throw Error("Fish no disponible"); });
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
    expect(f.ports.revoke).not.toHaveBeenCalled();
    expect(f.ports.synthesize).toHaveBeenCalledTimes(1);
    expect(f.ports.capture).toHaveBeenCalledTimes(2); f.loop.stop();
  });
  it("no envía a conversación ni Fish una transcripción descartada por el modo de otras voces", async () => {
    const f = fixture();
    f.ports.acceptTranscript = vi.fn(() => false);
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.respond).not.toHaveBeenCalled();
    expect(f.ports.synthesize).not.toHaveBeenCalled();
    expect(f.ports.capture).toHaveBeenCalledTimes(2);
    expect(f.ports.revoke).not.toHaveBeenCalled(); f.loop.stop();
  });
  it("mantiene la parada de voz aun con el filtro de dirección activado", async () => {
    const f = fixture();
    f.ports.acceptTranscript = () => false;
    f.ports.transcribe = vi.fn(async () => ({ text: "Detén la conversación, Alice", noSpeech: false } as never));
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.revoke).not.toHaveBeenCalled();
    expect(f.ports.respond).not.toHaveBeenCalled();
    expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
    f.loop.stop();
  });
  it("espera al micrófono filtrado antes de anunciar escucha y no la anuncia tras cancelar", async () => {
    const f = fixture(); let ready!: () => void;
    const capture = { start: () => new Promise<void>(resolve => { ready = resolve; }), cancel: vi.fn(), finish: vi.fn() };
    f.ports.capture = () => capture;
    const pending = f.loop.start(); await flush();
    expect(f.ports.onState).toHaveBeenLastCalledWith("arming");
    f.loop.stop(); ready(); await pending;
    expect(f.ports.onState).not.toHaveBeenCalledWith("standby");
    expect(capture.cancel).toHaveBeenCalledOnce();
  });
  it("ignora eventos duplicados o tardíos de una captura que ya entregó su turno", async () => {
    const f = fixture();
    await f.loop.start(); const stale = f.captures[0]; f.record(); f.record(); await flush();
    expect(f.ports.transcribe).toHaveBeenCalledOnce();
    expect(f.ports.respond).toHaveBeenCalledOnce();
    stale.quiet(); stale.error("fallo tardío"); await flush();
    expect(f.ports.capture).toHaveBeenCalledTimes(2);
    expect(f.ports.revoke).not.toHaveBeenCalled(); f.loop.stop();
  });
  it("mide etapas reales y cuenta el inicio de voz después de preparar el reproductor", async () => {
    const f = fixture(); let clock = 0;
    f.ports.now = () => clock;
    f.ports.onTurnObserved = vi.fn();
    const transcribe = f.ports.transcribe, respond = f.ports.respond, synthesize = f.ports.synthesize;
    f.ports.transcribe = async (...args) => { const value = await transcribe(...args); clock = 250; return value; };
    f.ports.respond = async (...args) => { const value = await respond(...args); clock = 1000; return value; };
    f.ports.synthesize = async (...args) => { const value = await synthesize(...args); clock = 1400; return value; };
    f.ports.play = async (_audio, onStarted) => { clock = 1500; onStarted?.(); clock = 3000; };
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith({ transcript:"Hola, Alice", transcriptionModel:"Gemma", captureMs:null, transcriptionMs:250, responseMs:750,
      synthesisMs:400, untilPlaybackMs:1500, totalMs:3000, outcome:"completed" });
    f.loop.stop();
  });
  it("conserva el modelo ASR devuelto y los segundos reales de la captura sin sumarlos al procesamiento", async () => {
    const f = fixture();
    f.ports.onTurnObserved = vi.fn();
    f.ports.transcribe = vi.fn(async () => ({ text: "Alice, hola", noSpeech: false, model: "Whisper small · local CPU" } as never));
    f.ports.now = () => 100;
    await f.loop.start(); f.record({ recordedSeconds: 4.375 }); await flush();
    expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith(expect.objectContaining({
      transcriptionModel: "Whisper small · local CPU", captureMs: 4375, transcriptionMs: 0, untilPlaybackMs: 0,
    }));
    f.loop.stop();
  });
  it.each([undefined, {}, { recordedSeconds: NaN }, { recordedSeconds: Infinity }, { recordedSeconds: -1 }])("no inventa duración de captura si falta o es inválida: %j", async metadata => {
    const f = fixture(); f.ports.onTurnObserved = vi.fn();
    await f.loop.start(); f.record(metadata); await flush();
    expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith(expect.objectContaining({ captureMs: null }));
    f.loop.stop();
  });
  it("no mezcla metadatos del turno anterior ni publica los de una captura revocada", async () => {
    const f = fixture(); f.ports.onTurnObserved = vi.fn();
    await f.loop.start(); f.record({ recordedSeconds: 2 }); await flush();
    f.ports.transcribe = vi.fn(async () => ({ text: "Hola, Alice", noSpeech: false, model: "Whisper base · local CPU" } as never));
    f.record(); await flush();
    expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith(expect.objectContaining({ captureMs: null, transcriptionModel: "Whisper base · local CPU" }));
    const stale = f.captures.at(-1)!;
    f.loop.stop(); vi.mocked(f.ports.onTurnObserved).mockClear();
    stale.record({ recordedSeconds: 9 }); await flush();
    expect(f.ports.onTurnObserved).not.toHaveBeenCalled();
  });
  it("no publica transcripciones ignoradas en la observación ni en el chat", async () => {
    const f = fixture(); f.ports.acceptTranscript = () => false; f.ports.onTurnObserved = vi.fn();
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.onTurnObserved).not.toHaveBeenCalled();
    expect(f.ports.respond).not.toHaveBeenCalled(); f.loop.stop();
  });

  it.each([
    { text: "", noSpeech: true, reason: "noSpeech" },
    { text: "Reclosa Spotify", noSpeech: false, reason: "notAddressed" },
  ] as const)("explica el descarte $reason sin atenderlo ni reemplazar el último mensaje atendido", async ({ text, noSpeech, reason }) => {
    const f = fixture();
    f.ports.onTurnObserved = vi.fn();
    f.ports.onIgnoredTakeObserved = vi.fn();
    let clock = 0;
    f.ports.now = () => clock;
    try {
      await f.loop.start();
      f.record(); await flush();
      const lastAttended = vi.mocked(f.ports.onTurnObserved).mock.calls.at(-1)?.[0];
      const attendedObservations = vi.mocked(f.ports.onTurnObserved).mock.calls.length;
      f.ports.transcribe = vi.fn(async () => {
        clock += 450;
        return { text, noSpeech, model: "Whisper small · local CPU", durationMs: 450, ephemeralAudio: true, sentToConversation: false, persisted: false } as const;
      });
      f.record({ recordedSeconds: 3.25 }); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith({
        reason, transcript: text, transcriptionModel: "Whisper small · local CPU", captureMs: 3250, transcriptionMs: 450,
      });
      expect(f.ports.onTurnObserved).toHaveBeenCalledTimes(attendedObservations);
      expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith(lastAttended);
      expect(f.ports.respond).toHaveBeenCalledOnce();
      expect(f.ports.synthesize).toHaveBeenCalledOnce();
      expect(f.ports.play).toHaveBeenCalledOnce();
      expect(f.ports.capture).toHaveBeenCalledTimes(3);
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      expect(f.ports.revoke).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it("distingue detección insuficiente previa a ASR y no repite el aviso en ventanas quiet consecutivas", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    f.ports.onTurnObserved = vi.fn();
    try {
      await f.loop.start();
      const first = f.captures[0];
      first.quiet(); await flush();
      f.quiet(); await flush();
      first.quiet(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenCalledExactlyOnceWith({ reason: "insufficientSpeech" });
      expect(f.ports.onTurnObserved).not.toHaveBeenCalled();
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
      expect(f.ports.play).not.toHaveBeenCalled();
      expect(f.ports.capture).toHaveBeenCalledTimes(3);
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
    } finally { f.loop.stop(); }
  });

  it("reemplaza el único descarte visible y lo borra cuando una frase nueva es atendida", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    try {
      await f.loop.start();
      f.quiet(); await flush();
      vi.mocked(f.ports.transcribe).mockResolvedValueOnce({ text: "Abre Spotify", noSpeech: false, model: "Whisper small", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false });
      f.record(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(expect.objectContaining({ reason: "notAddressed", transcript: "Abre Spotify", captureMs: null }));
      f.record(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(null);
      expect(f.ports.respond).toHaveBeenCalledExactlyOnceWith("Hola, Alice", "session-1");
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenCalledTimes(3);
    } finally { f.loop.stop(); }
  });

  it("conserva el descarte transcrito durante quiet posteriores y lo reemplaza sólo con un resultado ASR nuevo", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    try {
      await f.loop.start();
      vi.mocked(f.ports.transcribe).mockResolvedValueOnce({ text: "Reclosa Spotify", noSpeech: false, model: "Whisper small", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false });
      f.record(); await flush();
      const transcribedDiscard = vi.mocked(f.ports.onIgnoredTakeObserved).mock.calls.at(-1)?.[0];
      f.quiet(); await flush();
      f.quiet(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenCalledOnce();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(transcribedDiscard);
      vi.mocked(f.ports.transcribe).mockResolvedValueOnce({ text: "", noSpeech: true, model: "Whisper small", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false });
      f.record(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenCalledTimes(2);
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(expect.objectContaining({ reason: "noSpeech", transcript: "" }));
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });

  it("borra el descarte al apagar y no acepta eventos de la captura anterior al reiniciar", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    try {
      await f.loop.start();
      f.quiet(); await flush();
      const stale = f.captures.at(-1)!;
      f.loop.stop();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(null);
      vi.mocked(f.ports.onIgnoredTakeObserved).mockClear();
      await f.loop.start();
      stale.quiet(); stale.record(); await flush();
      expect(f.ports.onIgnoredTakeObserved).not.toHaveBeenCalled();
      expect(f.ports.transcribe).not.toHaveBeenCalled();
      f.quiet(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenCalledExactlyOnceWith({ reason: "insufficientSpeech" });
    } finally { f.loop.stop(); }
  });

  it.each([true, false])("no publica un descarte ASR tardío después de apagar: noSpeech=%s", async noSpeech => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    let complete!: (value: Awaited<ReturnType<VoiceLoopPorts["transcribe"]>>) => void;
    f.ports.transcribe = vi.fn(() => new Promise<Awaited<ReturnType<VoiceLoopPorts["transcribe"]>>>(resolve => { complete = resolve; }));
    await f.loop.start(); f.record(); await flush();
    f.loop.stop();
    complete({ text: noSpeech ? "" : "Reclosa Spotify", noSpeech, model: "Whisper small", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false });
    await flush();
    expect(f.ports.onIgnoredTakeObserved).not.toHaveBeenCalled();
    expect(f.ports.respond).not.toHaveBeenCalled();
    expect(f.ports.synthesize).not.toHaveBeenCalled();
    expect(f.ports.capture).toHaveBeenCalledOnce();
    expect(f.ports.onState).toHaveBeenLastCalledWith("idle", undefined);
  });

  it("borra el descarte si una captura posterior falla y termina la sesión", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    await f.loop.start(); f.quiet(); await flush();
    f.captures.at(-1)!.error("Micrófono desconectado");
    expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(null);
    expect(f.ports.onState).toHaveBeenLastCalledWith("error", "Micrófono desconectado");
    expect(f.ports.respond).not.toHaveBeenCalled();
    expect(f.ports.synthesize).not.toHaveBeenCalled();
  });

  it("reemplaza el diagnóstico anterior al reconocer la parada de conversación sin enviarla al chat", async () => {
    const f = fixture();
    f.ports.onIgnoredTakeObserved = vi.fn();
    try {
      await f.loop.start(); f.quiet(); await flush();
      vi.mocked(f.ports.transcribe).mockResolvedValueOnce({ text: "Detén la conversación, Alice", noSpeech: false, model: "Whisper small", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false });
      f.record(); await flush();
      expect(f.ports.onIgnoredTakeObserved).toHaveBeenLastCalledWith(null);
      expect(f.ports.onNotice).toHaveBeenLastCalledWith(expect.stringContaining("Conversación detenida"));
      expect(f.ports.onState).toHaveBeenLastCalledWith("standby");
      expect(f.ports.respond).not.toHaveBeenCalled();
      expect(f.ports.synthesize).not.toHaveBeenCalled();
    } finally { f.loop.stop(); }
  });
  it("completa diez turnos seguidos y detiene el siguiente por voz con una sola autorización", async () => {
    const f = fixture(); let turn = 0;
    f.ports.transcribe = vi.fn(async()=>({text:++turn<=10?`Alice, mensaje ${turn}`:"Apaga el micrófono Alice",noSpeech:false} as never));
    await f.loop.start();
    for(let i=0;i<11;i++){f.record();await flush();}
    expect(f.ports.authorize).toHaveBeenCalledOnce();
    expect(f.ports.respond).toHaveBeenCalledTimes(10);
    expect(f.ports.synthesize).toHaveBeenCalledTimes(10);
    expect(f.ports.revoke).toHaveBeenCalledWith("session-1");
    expect(f.ports.onState).toHaveBeenLastCalledWith("idle",expect.stringContaining("apagado por voz"));
  });

  it("ignora ambiente, atiende llamadas directas y reanuda después de Detend con una sola autorización", async () => {
    const f = fixture();
    const phrases = ["Voy a preparar café", "Alice es una asistente", "Marta le dijo a Alice que abra Spotify", "Hola, Alice, ¿me escuchas?", "Detend la conversación, Alice.", "Ahora pon música", "¿Me ayudas, Alice?", "Apaga el micrófono, Alice"];
    let index = 0;
    f.ports.transcribe = vi.fn(async () => ({text:phrases[index++],noSpeech:false} as never));
    f.ports.onTurnObserved = vi.fn();
    await f.loop.start();
    for (let i=0;i<phrases.length;i++) { f.record(); await flush(); }
    expect(f.ports.authorize).toHaveBeenCalledOnce();
    expect(f.ports.respond).toHaveBeenCalledTimes(2);
    expect(f.ports.respond).toHaveBeenNthCalledWith(1, phrases[3], "session-1");
    expect(f.ports.respond).toHaveBeenNthCalledWith(2, phrases[6], "session-1");
    expect(f.ports.synthesize).toHaveBeenCalledTimes(2);
    expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
    const observed = vi.mocked(f.ports.onTurnObserved).mock.calls.map(([turn]) => turn.transcript);
    expect(new Set(observed)).toEqual(new Set([phrases[3],phrases[6]]));
    expect(f.ports.onState).toHaveBeenLastCalledWith("idle", expect.stringContaining("apagado por voz"));
  });

  it("la espera y las pausas no extienden el límite de dos horas", async () => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      f.ports.transcribe = vi.fn(async()=>({text:"Detend la conversación Alice",noSpeech:false} as never));
      await f.loop.start();
      await vi.advanceTimersByTimeAsync(119*60*1000);
      f.record(); await flush();
      expect(f.ports.revoke).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60*1000);
      expect(f.ports.revoke).toHaveBeenCalledExactlyOnceWith("session-1");
      expect(f.ports.onState).toHaveBeenLastCalledWith("idle", undefined);
    } finally { f.loop.stop(); vi.useRealTimers(); }
  });
});
