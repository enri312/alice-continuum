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
  const filteredTrack = { stop: vi.fn() };
  const filteredStream = { getTracks: () => [filteredTrack] };
  const context = {
    sampleRate: 48000, resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
    audioWorklet: { addModule: vi.fn(async () => undefined) },
    createMediaStreamSource: vi.fn(() => source), createBiquadFilter: vi.fn(() => filter),
    createMediaStreamDestination: vi.fn(() => ({ stream: filteredStream })),
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
    expect(node.disconnect).toHaveBeenCalledOnce();
    expect(port.close).toHaveBeenCalledOnce();
    expect(harness.workers[0].terminate).toHaveBeenCalledOnce();
    expect(filteredTrack.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  };
  return { raw, rawTrack, filteredStream, source, filter, port, node, context, assertDisposed };
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

describe("pipeline local de ruido y causas de descarte", () => {
  beforeEach(() => { harness.autoReady = true; harness.workers.length = 0; });
  afterEach(() => vi.unstubAllGlobals());

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
    expect(f.node.disconnect).toHaveBeenCalledOnce();
  });
});
