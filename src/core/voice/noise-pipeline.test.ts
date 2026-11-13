import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Incoming = { data: Record<string, unknown> };
const harness = vi.hoisted(() => ({
  autoReady: true,
  workers: [] as Array<{
    onmessage: ((event: Incoming) => void) | null;
    onerror: (() => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock("./noise-worker?worker", () => ({ default: class {
  onmessage: ((event: Incoming) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn(() => {
    if (harness.autoReady) queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
  });
  constructor() { harness.workers.push(this); }
} }));
vi.mock("./noise-worklet?worker&url", () => ({ default: "filtered-worklet.js" }));

import { processMicrophone } from "./noise-pipeline";
import { NoiseSignalTimeout } from "./noise-types";

function fixture() {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const filter = { connect: vi.fn(), disconnect: vi.fn(), frequency: { value: 0 }, Q: { value: 0 }, type: "" };
  const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
  const filteredTrack = { stop: vi.fn() };
  const filteredStream = { getTracks: () => [filteredTrack] };
  const destination = { stream: filteredStream };
  const context = {
    sampleRate: 48000, resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
    audioWorklet: { addModule: vi.fn(async () => undefined) },
    createMediaStreamSource: vi.fn(() => source), createBiquadFilter: vi.fn(() => filter), createGain: vi.fn(() => gain),
    createMediaStreamDestination: vi.fn(() => destination),
  };
  const port = {
    onmessage: null as ((event: Incoming) => void) | null, close: vi.fn(),
    postMessage: vi.fn((message: { type: string }) => {
      if (message.type === "connect") queueMicrotask(() => port.onmessage?.({ data: { type: "ready" } }));
    }),
  };
  const node = { port, connect: vi.fn(), disconnect: vi.fn(), onprocessorerror: null as (() => void) | null };
  const rawTrack = { stop: vi.fn(), readyState: "live", label: "Micrófono de prueba", getSettings: () => ({ noiseSuppression: true }) };
  const raw = { getAudioTracks: () => [rawTrack] } as unknown as MediaStream;
  vi.stubGlobal("AudioContext", class { constructor() { return context; } });
  vi.stubGlobal("AudioWorkletNode", class { constructor() { return node; } });
  vi.stubGlobal("MessageChannel", class { port1 = {}; port2 = {}; });
  const assertDisposed = () => {
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(filter.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(node.disconnect).toHaveBeenCalledOnce();
    expect(port.close).toHaveBeenCalledOnce();
    expect(harness.workers[0].terminate).toHaveBeenCalledOnce();
    expect(filteredTrack.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  };
  return { raw, rawTrack, filteredStream, destination, source, filter, gain, port, node, context, assertDisposed };
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

async function pendingInitialization(f: ReturnType<typeof fixture>, failed: Parameters<typeof processMicrophone>[1]) {
  harness.autoReady = false;
  const aborted = new AbortController();
  const pending = processMicrophone(f.raw, failed, aborted.signal);
  await flush();
  return {
    connect: () => {
      expect(harness.workers).toHaveLength(1);
      harness.workers[0].onmessage?.({ data: { type: "ready" } });
      return pending;
    },
    close: async () => {
      aborted.abort();
      const processed = await pending.catch(() => undefined);
      processed?.close();
    },
  };
}

describe("pipeline local de ruido y causas de descarte", () => {
  beforeEach(() => { harness.autoReady = true; harness.workers.length = 0; });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("empieza a vigilar tras conectar el audio aunque WASM tarde cuatro segundos", async () => {
    let monotonic = 0;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    vi.spyOn(Date, "now").mockImplementation(() => 1_800_000_000_000 + monotonic);
    const f = fixture();
    const failed = vi.fn();
    const pending = await pendingInitialization(f, failed);
    try {
      expect(f.source.connect).not.toHaveBeenCalled();
      monotonic = 4000;
      const processed = await pending.connect();
      expect(f.source.connect).toHaveBeenCalledExactlyOnceWith(f.filter);
      expect(f.node.connect).toHaveBeenCalledExactlyOnceWith(f.destination);
      monotonic = 4250;
      expect(processed.read()).toEqual({ rms: 0, probability: 0, voicedMs: 0 });
      expect(failed).not.toHaveBeenCalled();
      expect(f.context.close).not.toHaveBeenCalled();
    } finally {
      await pending.close();
      vi.restoreAllMocks();
    }
    f.assertDisposed();
  });

  it("descarta con NoiseSignalTimeout sólo después de 1500 ms desde la conexión", async () => {
    let monotonic = 0;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    vi.spyOn(Date, "now").mockImplementation(() => 1_800_000_000_000 + monotonic);
    const f = fixture();
    const failed = vi.fn();
    const pending = await pendingInitialization(f, failed);
    try {
      monotonic = 4000;
      const processed = await pending.connect();
      monotonic = 5500;
      expect(processed.read()).toEqual({ rms: 0, probability: 0, voicedMs: 0 });
      monotonic = 5501;
      let failure: unknown;
      try { processed.read(); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(NoiseSignalTimeout);
      expect(failure).toMatchObject({ reason: "metrics_timeout", message: "No llega señal del filtro local. La toma se descartó." });
      // The owner propagates this thrown failure; the pipeline must not also
      // invoke its callback and create a duplicate error or restart.
      expect(failed).not.toHaveBeenCalled();
      f.assertDisposed();
      expect(f.rawTrack.stop).not.toHaveBeenCalled();
    } finally {
      await pending.close();
      vi.restoreAllMocks();
    }
  });

  it("renueva la vigilancia con métricas de silencio sin inventar evidencia de voz", async () => {
    let monotonic = 0;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    vi.spyOn(Date, "now").mockImplementation(() => 1_800_000_000_000 + monotonic);
    const f = fixture();
    const failed = vi.fn();
    const pending = await pendingInitialization(f, failed);
    try {
      const processed = await pending.connect();
      const silence = { data: { type: "metrics", rms: 0, probability: 0, voicedMs: 0, frames: 5 } };
      monotonic = 1000;
      f.port.onmessage!(silence);
      monotonic = 2400;
      expect(processed.read()).toEqual({ rms: 0, probability: 0, voicedMs: 0 });
      f.port.onmessage!(silence);
      monotonic = 3800;
      expect(processed.read()).toEqual({ rms: 0, probability: 0, voicedMs: 0 });
      expect(f.context.close).not.toHaveBeenCalled();
      // Reads do not renew the heartbeat: only the last metrics at 2400 ms do.
      monotonic = 3901;
      expect(() => processed.read()).toThrow(NoiseSignalTimeout);
      expect(failed).not.toHaveBeenCalled();
      f.assertDisposed();
    } finally {
      await pending.close();
      vi.restoreAllMocks();
    }
  });

  it("ignora saltos hacia delante y atrás del reloj civil al vigilar la señal", async () => {
    let monotonic = 1000;
    let civil = 1_800_000_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    vi.spyOn(Date, "now").mockImplementation(() => civil);
    const f = fixture();
    const failed = vi.fn();
    const pending = await pendingInitialization(f, failed);
    try {
      const processed = await pending.connect();
      civil += 86_400_000;
      monotonic = 1250;
      expect(processed.read()).toEqual({ rms: 0, probability: 0, voicedMs: 0 });
      expect(f.context.close).not.toHaveBeenCalled();
      civil -= 172_800_000;
      monotonic = 2501;
      expect(() => processed.read()).toThrow(NoiseSignalTimeout);
      expect(failed).not.toHaveBeenCalled();
      f.assertDisposed();
    } finally {
      await pending.close();
      vi.restoreAllMocks();
    }
  });

  it("cierra una sola vez tras timeout e ignora métricas y fallos tardíos", async () => {
    let monotonic = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    const f = fixture();
    const failed = vi.fn();
    const pending = await pendingInitialization(f, failed);
    try {
      const processed = await pending.connect();
      const notify = f.port.onmessage!;
      const workerError = harness.workers[0].onerror!;
      const processorError = f.node.onprocessorerror!;
      monotonic = 2600;
      expect(() => processed.read()).toThrow(NoiseSignalTimeout);
      processed.close();
      processed.close();
      notify({ data: { type: "metrics", rms: 1, probability: 1, voicedMs: 50, frames: 5 } });
      notify({ data: { type: "error", message: "Fallo tardío", reason: "input_backlog" } });
      workerError();
      processorError();
      expect(failed).not.toHaveBeenCalled();
      expect(processed.getSignalSnapshot?.()).toBeUndefined();
      f.assertDisposed();
      expect(f.rawTrack.stop).not.toHaveBeenCalled();
    } finally {
      await pending.close();
      vi.restoreAllMocks();
    }
    f.assertDisposed();
  });

  it("mantiene una copia cumulativa sin doble conteo ni reinicio al leer VAD y congela al cerrar", async () => {
    const f = fixture();
    const processed = await processMicrophone(f.raw, vi.fn(), undefined, { sensitivity: "soft" });
    expect(processed.getSignalSnapshot?.()).toBeUndefined();
    const signal = { inputSamples: 4, inputSquareSum: 8.25, inputPeak: 2, inputClippedSamples: 2, outputSamples: 2, outputSquareSum: 0.05, outputPeak: 0.2 };
    const metrics = (value: unknown) => f.port.onmessage!({ data: { type: "metrics", rms: 0.05, probability: 0.5, voicedMs: 0, frames: 5, signal: value } });
    metrics(signal);
    const first = processed.getSignalSnapshot!()!;
    expect(first.inputGain).toBe(2);
    expect(first.inputRms).toBeCloseTo(Math.sqrt(8.25 / 4));
    expect(first.outputRms).toBeCloseTo(Math.sqrt(0.05 / 2));
    expect(first.inputClippedFraction).toBe(0.5);
    processed.read(); processed.read();
    expect(processed.getSignalSnapshot!()).toEqual(first);
    expect(processed.getSignalSnapshot!()).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    metrics(signal); // cumulative packet duplicated, not another 4 input samples
    expect(processed.getSignalSnapshot!()).toEqual(first);
    const latest = { ...signal, inputSamples: 8, inputSquareSum: 16.5, inputClippedSamples: 4, outputSamples: 4, outputSquareSum: 0.1 };
    metrics(latest);
    const second = processed.getSignalSnapshot!()!;
    expect(second.inputSamples).toBe(8);
    expect(second.outputSamples).toBe(4);
    metrics(signal); // delayed old batch cannot regress the displayed measure
    expect(processed.getSignalSnapshot!()).toEqual(second);
    expect(first.inputSamples).toBe(4);
    metrics({ ...latest, inputPeak: NaN });
    expect(processed.getSignalSnapshot!()).toBeUndefined();
    metrics(signal); // invalid data must not reset the monotonic watermark
    expect(processed.getSignalSnapshot!()).toBeUndefined();
    metrics(latest);
    expect(processed.getSignalSnapshot!()).toEqual(second);
    processed.close();
    metrics({ ...latest, inputSamples: 12, inputSquareSum: 24.75, inputClippedSamples: 6 });
    expect(processed.getSignalSnapshot!()).toEqual(second);
    f.assertDisposed();
  });

  it("deja el diagnóstico ausente ante lotes sin medición sin inventar niveles de silencio", async () => {
    const f = fixture();
    const processed = await processMicrophone(f.raw, vi.fn());
    f.port.onmessage!({ data: { type: "metrics", rms: 0.05, probability: 1, voicedMs: 50, frames: 5 } });
    expect(processed.getSignalSnapshot!()).toBeUndefined();
    expect(processed.read()).toEqual({ rms: 0.05, probability: 1, voicedMs: 50 });
    processed.close();
  });

  it.each([
    { requested: undefined, applied: "normal", gain: 1 },
    { requested: "normal", applied: "normal", gain: 1 },
    { requested: "soft", applied: "soft", gain: 2 },
    { requested: "unsupported", applied: "normal", gain: 1 },
  ])("aplica la sensibilidad $applied con ganancia local $gain sin saltarse el filtro", async ({ requested, applied, gain }) => {
    const f = fixture();
    const processed = await processMicrophone(f.raw, vi.fn(), undefined, { sensitivity: requested as never });
    expect(f.gain.gain.value).toBe(gain);
    expect(f.context.createGain).toHaveBeenCalledOnce();
    expect(f.source.connect).toHaveBeenCalledExactlyOnceWith(f.filter);
    expect(f.filter.type).toBe("highpass");
    expect(f.filter.frequency.value).toBe(80);
    expect(f.filter.connect).toHaveBeenCalledExactlyOnceWith(f.gain);
    expect(f.gain.connect).toHaveBeenCalledExactlyOnceWith(f.node);
    expect(f.node.connect).toHaveBeenCalledExactlyOnceWith(f.destination);
    expect(processed.status.sensitivity).toBe(applied);
    expect(f.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "connect", sensitivity: applied }), expect.any(Array));
    expect(processed.stream).toBe(f.filteredStream);
    expect(processed.stream).not.toBe(f.raw);
    processed.close();
    processed.close();
    f.assertDisposed();
  });

  it.each(["input_backlog", "output_overflow", "unsupported_rate"])("cierra el filtro antes de comunicar %s y nunca devuelve el stream crudo", async reason => {
    const f = fixture();
    const failed = vi.fn(() => f.assertDisposed());
    const processed = await processMicrophone(f.raw, failed);
    expect(processed.stream).toBe(f.filteredStream);
    expect(processed.stream).not.toBe(f.raw);
    expect(f.context.createMediaStreamSource).toHaveBeenCalledWith(f.raw);
    const notify = f.port.onmessage!;
    notify({ data: { type: "error", message: "Toma descartada", reason } });
    expect(failed).toHaveBeenCalledExactlyOnceWith("Toma descartada", reason);
    notify({ data: { type: "error", message: "Error tardío", reason } });
    harness.workers[0].onerror?.();
    processed.close();
    expect(failed).toHaveBeenCalledOnce();
    f.assertDisposed();
    // The owning VoiceCapture, not this processor, owns the raw microphone.
    expect(f.rawTrack.stop).not.toHaveBeenCalled();
  });

  it.each(["device_lost", "INPUT_BACKLOG", { reason: "input_backlog" }, null])("no convierte una causa desconocida en una recuperación autorizada: %j", async reason => {
    const f = fixture();
    const failed = vi.fn();
    await processMicrophone(f.raw, failed);
    f.port.onmessage!({ data: { type: "error", message: "Error del filtro", reason } });
    expect(failed).toHaveBeenCalledExactlyOnceWith("Error del filtro");
    f.assertDisposed();
  });

  it("cancela una inicialización pendiente sin devolver audio ni notificar un nuevo fallo recuperable", async () => {
    const f = fixture();
    harness.autoReady = false;
    const aborted = new AbortController();
    const failed = vi.fn();
    const pending = processMicrophone(f.raw, failed, aborted.signal);
    const rejected = expect(pending).rejects.toThrow(/cancel/);
    await flush();
    expect(harness.workers).toHaveLength(1);
    aborted.abort();
    await rejected;
    expect(failed).not.toHaveBeenCalled();
    expect(harness.workers[0].terminate).toHaveBeenCalledOnce();
    expect(f.port.close).toHaveBeenCalledOnce();
    expect(f.context.close).toHaveBeenCalledOnce();
    expect(f.context.createMediaStreamSource).not.toHaveBeenCalled();
    expect(f.context.createGain).not.toHaveBeenCalled();
    expect(f.gain.disconnect).not.toHaveBeenCalled();
    expect(f.node.disconnect).toHaveBeenCalledOnce();
  });
});
