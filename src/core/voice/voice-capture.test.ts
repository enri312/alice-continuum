import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceCapture, type CaptureEnvironment } from "./voice-capture";

function fixture(automatic = false) {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() });
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const recorder = {
    state: "inactive", ondataavailable: null, onstop: null, onerror: null,
    start: vi.fn(() => { recorder.state = "recording"; }),
    stop: vi.fn(() => { recorder.state = "inactive"; }),
  };
  const events = { onStarted: vi.fn(), onElapsed: vi.fn(), onRecorded: vi.fn(), onError: vi.fn(), onQuiet: vi.fn() };
  const filteredStream = { getTracks: () => [] } as unknown as MediaStream;
  const monitor = { read: vi.fn(() => ({ rms: 0, probability: 0, voicedMs: 0 })), close: vi.fn(), stream: filteredStream,
    status: { microphone: "Prueba", systemEcho: false, browserNoise: true } };
  const environment: CaptureEnvironment = {
    getMicrophone: vi.fn(async () => stream),
    createRecorder: vi.fn(() => recorder as unknown as MediaRecorder),
    processMicrophone: vi.fn(async () => monitor),
  };
  const capture = new VoiceCapture(events, environment, automatic);
  const emit = (name: "ondataavailable" | "onstop" | "onerror", payload: unknown = {}) => {
    (recorder[name] as ((event: unknown) => void) | null)?.(payload);
  };
  return { capture, events, track, stream, recorder, environment, monitor, emit };
}

describe("captura efímera por turnos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("descarta la toma y libera el filtro antes de notificar una interrupción recuperable", async () => {
    const f = fixture(true);
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["toma incompleta de prueba"]) });
    f.events.onError.mockImplementation(() => {
      expect(f.track.stop).toHaveBeenCalledOnce();
      expect(f.monitor.close).toHaveBeenCalledOnce();
      expect(f.recorder.stop).toHaveBeenCalledOnce();
    });
    const failed = vi.mocked(f.environment.processMicrophone).mock.calls[0][1];
    failed("Filtro interrumpido", "input_backlog");
    f.emit("onstop");
    failed("Error tardío", "output_overflow");
    expect(f.events.onError).toHaveBeenCalledExactlyOnceWith("Filtro interrumpido", "input_backlog");
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.events.onQuiet).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("no abre el micrófono al construir y libera la captura antes de transcribir", async () => {
    const f = fixture();
    expect(f.environment.getMicrophone).not.toHaveBeenCalled();
    await f.capture.start();
    expect(f.environment.createRecorder).toHaveBeenCalledWith(f.monitor.stream);
    expect(f.environment.createRecorder).not.toHaveBeenCalledWith(f.stream);
    f.emit("ondataavailable", { data: new Blob(["audio de prueba"]) });
    f.capture.finish();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.emit("onstop");
    const [take, , transcribe] = f.events.onRecorded.mock.calls[0];
    expect(await take.text()).toBe("audio de prueba");
    expect(transcribe).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cierra una concesión de micrófono que llega después de cancelar", async () => {
    const f = fixture();
    let grant!: (stream: MediaStream) => void;
    f.environment.getMicrophone = () => new Promise(resolve => { grant = resolve; });
    const pending = f.capture.start();
    f.capture.cancel();
    grant(f.stream);
    await pending;
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.environment.createRecorder).not.toHaveBeenCalled();
    expect(f.events.onStarted).not.toHaveBeenCalled();
  });

  it("explica en español un rechazo del permiso sin iniciar la grabación", async () => {
    const f = fixture();
    f.environment.getMicrophone = vi.fn().mockRejectedValue(new DOMException("The request is not allowed", "NotAllowedError"));
    await f.capture.start();
    expect(f.events.onError).toHaveBeenCalledWith(expect.stringContaining("el permiso fue rechazado"));
    expect(f.environment.createRecorder).not.toHaveBeenCalled();
    expect(f.events.onStarted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("descarta la toma y no entrega callbacks pendientes tras cancelar", async () => {
    const f = fixture();
    await f.capture.start();
    const staleStop = f.recorder.onstop as unknown as () => void;
    f.emit("ondataavailable", { data: new Blob(["privado"]) });
    f.capture.cancel();
    staleStop();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.recorder.ondataavailable).toBeNull();
    expect(f.track.stop).toHaveBeenCalledOnce();
  });

  it("al llegar a 60 segundos conserva la toma para transcripción manual", async () => {
    const f = fixture();
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["audio"]) });
    vi.advanceTimersByTime(60_000);
    f.emit("onstop");
    expect(f.events.onRecorded.mock.calls[0].slice(1)).toEqual([60, false]);
    expect(f.track.stop).toHaveBeenCalledOnce();
  });

  it.each(["onerror", "disconnect"] as const)("libera recursos y descarta ante %s", async error => {
    const f = fixture();
    await f.capture.start();
    if (error === "disconnect") f.track.dispatchEvent(new Event("ended"));
    else f.emit("onerror");
    expect(f.events.onError).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("descarta audio que supera el límite antes de entregarlo a transcripción", async () => {
    const f = fixture();
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]) });
    expect(f.events.onError).toHaveBeenCalledWith(expect.stringContaining("8 MB"));
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalledOnce();
  });

  it("libera el micrófono si falla la construcción del grabador", async () => {
    const f = fixture();
    f.environment.createRecorder = () => { throw Error("grabador no disponible"); };
    await f.capture.start();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.events.onError).toHaveBeenCalledWith(expect.stringContaining("grabador no disponible"));
  });

  it("termina una frase automática por pausa y libera el detector antes de transcribir", async () => {
    const f = fixture(true);
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["frase"]) });
    f.monitor.read.mockReturnValue({ rms: 0.05, probability: 0.95, voicedMs: 200 });
    vi.advanceTimersByTime(500);
    f.monitor.read.mockReturnValue({ rms: 0, probability: 0, voicedMs: 0 });
    vi.advanceTimersByTime(1000);
    expect(f.recorder.stop).toHaveBeenCalledOnce();
    expect(f.monitor.close).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();
    f.emit("onstop");
    expect(f.events.onRecorded.mock.calls[0][2]).toBe(true);
    expect(f.events.onQuiet).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("descarta ocho segundos de silencio sin entregar audio a transcripción", async () => {
    const f = fixture(true);
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["silencio"]) });
    vi.advanceTimersByTime(8000);
    f.emit("onstop");
    expect(f.events.onQuiet).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.monitor.close).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cierra el filtro que termina de prepararse después de cancelar", async () => {
    const f = fixture();
    let ready!: (value: typeof f.monitor) => void;
    f.environment.processMicrophone = vi.fn(() => new Promise<typeof f.monitor>(resolve => { ready = resolve; }));
    const pending = f.capture.start();
    await Promise.resolve();
    f.capture.cancel();
    expect(vi.mocked(f.environment.processMicrophone).mock.calls[0][2]?.aborted).toBe(true);
    ready(f.monitor); await pending;
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.monitor.close).toHaveBeenCalledOnce();
    expect(f.environment.createRecorder).not.toHaveBeenCalled();
  });

  it("descarta una toma si el filtro deja de entregar audio, sin recurrir al micrófono crudo", async () => {
    const f = fixture(); await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["toma parcial"]) });
    f.monitor.read.mockImplementation(() => { throw Error("Procesador detenido"); });
    vi.advanceTimersByTime(250);
    expect(f.events.onError).toHaveBeenCalledWith(expect.stringContaining("Procesador detenido"));
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.monitor.close).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("no graba si el supresor no se puede iniciar", async () => {
    const f = fixture();
    f.environment.processMicrophone = async () => { throw Error("WASM no disponible"); };
    await f.capture.start();
    expect(f.environment.createRecorder).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.events.onError).toHaveBeenCalledWith(expect.stringContaining("WASM"));
  });
});
