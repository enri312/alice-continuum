import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceCapture, type CaptureEnvironment } from "./voice-capture";
import { NoiseSignalTimeout, type AudioSignalSnapshot, type MicrophoneOptions } from "./noise-types";

function fixture(automatic = false, options: MicrophoneOptions = {}) {
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
    getSignalSnapshot: undefined as (() => Readonly<AudioSignalSnapshot> | undefined) | undefined,
    status: { microphone: "Prueba", systemEcho: false, browserNoise: true } };
  const environment: CaptureEnvironment = {
    getMicrophone: vi.fn(async () => stream),
    createRecorder: vi.fn(() => recorder as unknown as MediaRecorder),
    processMicrophone: vi.fn(async () => monitor),
  };
  const capture = new VoiceCapture(events, environment, automatic, options);
  const emit = (name: "ondataavailable" | "onstop" | "onerror", payload: unknown = {}) => {
    (recorder[name] as ((event: unknown) => void) | null)?.(payload);
  };
  return { capture, events, track, stream, recorder, environment, monitor, emit };
}

function signalSnapshot(): AudioSignalSnapshot {
  return { sampleRate: 48000, inputGain: 4, inputSamples: 960, inputRms: 0.03, inputPeak: 0.4,
    inputClippedSamples: 0, inputClippedFraction: 0, outputSamples: 960, outputRms: 0.025,
    outputPeak: 0.3, coverage: "last_received_batch" };
}

describe("captura efímera por turnos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("copia el diagnóstico antes de detener y cerrar el filtro sin conservar su objeto mutable", async () => {
    const f = fixture();
    const signal = signalSnapshot();
    const expected = { ...signal };
    const snapshot = vi.fn(() => {
      expect(f.recorder.stop).not.toHaveBeenCalled();
      expect(f.monitor.close).not.toHaveBeenCalled();
      return signal;
    });
    f.monitor.getSignalSnapshot = snapshot;
    f.monitor.close.mockImplementation(() => { signal.outputSamples = 0; });
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["toma filtrada de prueba"]) });
    f.capture.finish();
    expect(snapshot).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number), true, expected);
    const delivered = f.events.onRecorded.mock.calls[0][3];
    expect(delivered).not.toBe(signal);
    expect(Object.isFrozen(delivered)).toBe(true);
    expect(snapshot).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recoge el diagnóstico antes de cancelar cuando el grabador se detiene por su cuenta", async () => {
    const f = fixture();
    const signal = signalSnapshot();
    const expected = { ...signal };
    f.monitor.getSignalSnapshot = vi.fn(() => {
      expect(f.monitor.close).not.toHaveBeenCalled();
      return signal;
    });
    f.monitor.close.mockImplementation(() => { signal.inputSamples = 0; });
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["toma filtrada de prueba"]) });
    f.recorder.state = "inactive";
    f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number), false, expected);
    expect(f.monitor.getSignalSnapshot).toHaveBeenCalledOnce();
    expect(f.monitor.close).toHaveBeenCalledOnce();
  });

  it.each(["finish", "external_stop"] as const)("conserva la entrega legacy si el getter falla durante %s", async mode => {
    const f = fixture();
    f.monitor.getSignalSnapshot = vi.fn(() => { throw Error("diagnóstico no disponible"); });
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["toma filtrada de prueba"]) });
    if (mode === "finish") f.capture.finish();
    else f.recorder.state = "inactive";
    f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledOnce();
    expect(f.events.onRecorded.mock.calls[0]).toHaveLength(3);
    expect(f.events.onError).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("no reutiliza el diagnóstico de una toma anterior ni acepta su callback tardío", async () => {
    const f = fixture();
    const snapshot = vi.fn<() => Readonly<AudioSignalSnapshot> | undefined>().mockReturnValueOnce(signalSnapshot()).mockReturnValue(undefined);
    f.monitor.getSignalSnapshot = snapshot;
    await f.capture.start();
    const stale = f.recorder.onstop as unknown as () => void;
    f.emit("ondataavailable", { data: new Blob(["primera toma"]) });
    f.capture.finish(); f.emit("onstop");
    expect(f.events.onRecorded.mock.calls[0]).toHaveLength(4);
    f.events.onRecorded.mockClear();
    await f.capture.start();
    stale();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.emit("ondataavailable", { data: new Blob(["segunda toma"]) });
    f.capture.finish(); f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledOnce();
    const recorded = f.events.onRecorded.mock.calls[0];
    expect(recorded).toHaveLength(3);
    expect(await recorded[0].text()).toBe("segunda toma");
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  it.each(["cancel", "error"] as const)("descarta el diagnóstico pendiente y la entrega tardía al recibir %s", async mode => {
    const f = fixture();
    f.monitor.getSignalSnapshot = vi.fn(() => signalSnapshot());
    await f.capture.start();
    const stale = f.recorder.onstop as unknown as () => void;
    f.emit("ondataavailable", { data: new Blob(["toma cancelada"]) });
    f.capture.finish();
    if (mode === "cancel") f.capture.cancel(); else f.emit("onerror");
    stale();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.monitor.getSignalSnapshot = undefined;
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["nueva toma"]) });
    f.capture.finish(); f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledOnce();
    expect(f.events.onRecorded.mock.calls[0]).toHaveLength(3);
  });

  it("descarta el diagnóstico del silencio y no lo arrastra a la siguiente frase", async () => {
    const f = fixture(true);
    f.monitor.getSignalSnapshot = vi.fn(() => signalSnapshot());
    await f.capture.start();
    f.emit("ondataavailable", { data: new Blob(["silencio"]) });
    vi.advanceTimersByTime(8000);
    f.emit("onstop");
    expect(f.events.onQuiet).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.monitor.getSignalSnapshot = undefined;
    await f.capture.start();
    f.monitor.read.mockReturnValue({ rms: 0.05, probability: 0.95, voicedMs: 200 });
    vi.advanceTimersByTime(250);
    f.emit("ondataavailable", { data: new Blob(["frase posterior"]) });
    f.capture.finish(); f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledOnce();
    expect(f.events.onRecorded.mock.calls[0]).toHaveLength(3);
  });

  it("lleva el perfil elegido al filtro y conserva una pausa larga antes de terminar la toma", async () => {
    const options: MicrophoneOptions = { deviceId: "microfono-de-prueba", sensitivity: "soft" };
    const f = fixture(true, options);
    await f.capture.start();
    expect(f.environment.getMicrophone).toHaveBeenCalledWith(options);
    expect(vi.mocked(f.environment.processMicrophone).mock.calls[0][3]).toEqual(options);
    f.monitor.read.mockReturnValue({ rms: 0.05, probability: 0.95, voicedMs: 200 });
    vi.advanceTimersByTime(250);
    f.emit("ondataavailable", { data: new Blob(["audio filtrado de prueba"]) });
    f.monitor.read.mockReturnValue({ rms: 0, probability: 0, voicedMs: 0 });
    vi.advanceTimersByTime(1750);
    expect(f.recorder.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(f.recorder.stop).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    f.emit("onstop");
    expect(f.events.onRecorded).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number), true);
    expect(f.events.onQuiet).not.toHaveBeenCalled();
  });

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

  it.each([
    { failure: new NoiseSignalTimeout(), reason: "metrics_timeout" },
    { failure: Error("No llega señal del filtro local. La toma se descartó."), reason: undefined },
  ] as const)("descarta audio parcial y comunica sólo la clasificación acreditada: $reason", async ({ failure, reason }) => {
    const f = fixture(true); await f.capture.start();
    const staleData = f.recorder.ondataavailable as unknown as (event: { data: Blob }) => void;
    const staleStop = f.recorder.onstop as unknown as () => void;
    const staleError = f.recorder.onerror as unknown as () => void;
    const staleFilterError = vi.mocked(f.environment.processMicrophone).mock.calls[0][1];
    f.emit("ondataavailable", { data: new Blob(["toma parcial"]) });
    f.monitor.read.mockImplementation(() => { throw failure; });
    f.events.onError.mockImplementation(() => {
      expect(f.monitor.close).toHaveBeenCalledOnce();
      expect(f.track.stop).toHaveBeenCalledOnce();
      expect(f.recorder.stop).toHaveBeenCalledOnce();
      expect(f.recorder.ondataavailable).toBeNull();
      expect(f.recorder.onstop).toBeNull();
      expect(f.recorder.onerror).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });
    vi.advanceTimersByTime(250);
    if (reason) expect(f.events.onError).toHaveBeenCalledExactlyOnceWith(String(failure), reason);
    else expect(f.events.onError).toHaveBeenCalledExactlyOnceWith(String(failure));
    staleData({ data: new Blob(["entrega tardía"]) });
    staleStop(); staleError(); staleFilterError("Error tardío", "input_backlog");
    f.track.dispatchEvent(new Event("ended"));
    vi.advanceTimersByTime(1000);
    expect(f.events.onError).toHaveBeenCalledOnce();
    expect(f.events.onRecorded).not.toHaveBeenCalled();
    expect(f.events.onQuiet).not.toHaveBeenCalled();
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
