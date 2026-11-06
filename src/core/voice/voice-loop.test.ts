import { describe, expect, it, vi } from "vitest";
import { VoiceLoop, type VoiceLoopPorts } from "./voice-loop";

function fixture() {
  const captures: { quiet: () => void; error: (message: string) => void }[] = [];
  let recorded!: (take: Blob) => void;
  let quiet!: () => void;
  const ports: VoiceLoopPorts = {
    authorize: vi.fn(async () => "session-1"), revoke: vi.fn(async () => undefined),
    capture: vi.fn((onRecorded, onQuiet, onError) => {
      recorded = onRecorded; quiet = onQuiet;
      captures.push({ quiet: onQuiet, error: onError });
      return { start: vi.fn(async () => undefined), cancel: vi.fn(), finish: vi.fn() };
    }),
    transcribe: vi.fn(async () => ({ text: "Hola, Alice", noSpeech: false, model: "Gemma", durationMs: 10, ephemeralAudio: true, sentToConversation: false, persisted: false } as const)),
    respond: vi.fn(async () => ({ exchangeId: "exchange-1" })),
    synthesize: vi.fn(async () => ({ requestId: "tts", mimeType: "audio/mpeg", audioBase64: "AAAA", characterCount: 4, durationMs: 20, ephemeral: true } as const)),
    play: vi.fn(async (_audio, onStarted) => { onStarted?.(); }), stopPlayback: vi.fn(), onState: vi.fn(),
  };
  return { loop: new VoiceLoop(ports), ports, captures, record: () => recorded(new Blob(["fixture"])), quiet: () => quiet() };
}
async function flush() { for (let i = 0; i < 16; i++) await Promise.resolve(); }

describe("sesión de voz automática", () => {
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
    expect(f.ports.onTurnObserved).toHaveBeenLastCalledWith({ transcript:"Hola, Alice", transcriptionMs:250, responseMs:750,
      synthesisMs:400, untilPlaybackMs:1500, totalMs:3000, outcome:"completed" });
    f.loop.stop();
  });
  it("no publica transcripciones ignoradas en la observación ni en el chat", async () => {
    const f = fixture(); f.ports.acceptTranscript = () => false; f.ports.onTurnObserved = vi.fn();
    await f.loop.start(); f.record(); await flush();
    expect(f.ports.onTurnObserved).not.toHaveBeenCalled();
    expect(f.ports.respond).not.toHaveBeenCalled(); f.loop.stop();
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
