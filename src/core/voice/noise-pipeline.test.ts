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

describe("pipeline local de ruido y causas de descarte", () => {
  beforeEach(() => { harness.autoReady = true; harness.workers.length = 0; });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { requested: undefined, applied: "normal", gain: 1 },
    { requested: "normal", applied: "normal", gain: 1 },
    { requested: "soft", applied: "soft", gain: 4 },
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
