import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Bridge = {
  port: { onmessage: (event: unknown) => void; postMessage: ReturnType<typeof vi.fn> };
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
};
let Processor: new () => Bridge;
beforeAll(async () => {
  vi.stubGlobal("AudioWorkletProcessor", class { port = { onmessage: () => undefined, postMessage: vi.fn() }; });
  vi.stubGlobal("sampleRate", 48000);
  vi.stubGlobal("registerProcessor", (_name: string, processor: typeof Processor) => { Processor = processor; });
  await import("./noise-worklet");
});
afterAll(() => vi.unstubAllGlobals());

function fixture() {
  const bridge = new Processor();
  const pending: Float32Array[] = [];
  const worker = { onmessage: (_event: unknown) => undefined, start: vi.fn(), close: vi.fn(),
    postMessage: (frame: Float32Array) => pending.push(frame) };
  bridge.port.onmessage({ data: { type: "connect", port: worker } });
  const output = new Float32Array(128);
  const tick = () => bridge.process([[new Float32Array(128).fill(0.1)]], [[output]]);
  return { bridge, worker, pending, output, tick };
}

describe("enlace de audio bajo variaciones de planificación", () => {
  it("tolera 320 ms de demora del worker y vuelve a entregar la voz procesada", () => {
    const f = fixture();
    for (let i = 0; i < 120; i++) expect(f.tick()).toBe(true);
    expect(f.pending.length).toBe(32);
    expect(f.output.every(value => value === 0)).toBe(true);
    for (const frame of f.pending) f.worker.onmessage({ data: { frame: new Float32Array(frame.length).fill(0.05), probability: 1, rms: 0.05 } });
    expect(f.tick()).toBe(true);
    expect(f.output.some(value => value > 0)).toBe(true);
    expect(f.bridge.port.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
  it("detiene la captura ante un worker que no responde, sin dejar crecer la cola", () => {
    const f = fixture();
    let alive = true;
    for (let i = 0; i < 200 && alive; i++) alive = f.tick();
    expect(alive).toBe(false);
    expect(f.pending.length).toBe(50);
    expect(f.bridge.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error", reason: "input_backlog" }));
    expect(f.worker.close).toHaveBeenCalledOnce();
    f.bridge.port.postMessage.mockClear();
    for (let i = 0; i < 5; i++) f.worker.onmessage({ data: { frame: new Float32Array(480), probability: 1, rms: 0.1 } });
    expect(f.tick()).toBe(false);
    expect(f.pending.length).toBe(50);
    expect(f.output.every(value => value === 0)).toBe(true);
    expect(f.bridge.port.postMessage).not.toHaveBeenCalled();
  });
  it("rechaza una entrega que supera la capacidad de salida sin ampliar el búfer", () => {
    const f = fixture();
    while (f.pending.length < 50) expect(f.tick()).toBe(true);
    const response = { frame: new Float32Array(480).fill(0.05), probability: 1, rms: 0.05 };
    for (let i = 0; i < f.pending.length; i++) f.worker.onmessage({ data: response });
    expect(f.bridge.port.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    f.bridge.port.postMessage.mockClear();
    // A duplicate or otherwise unexpected extra delivery must not overrun the
    // fixed 500 ms ring, even when the worker violates its response contract.
    f.worker.onmessage({ data: response });
    expect(f.bridge.port.postMessage).toHaveBeenCalledOnce();
    expect(f.bridge.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error", reason: "output_overflow" }));
    expect(f.worker.close).toHaveBeenCalledOnce();
    f.bridge.port.postMessage.mockClear();
    for (let i = 0; i < 5; i++) f.worker.onmessage({ data: response });
    expect(f.tick()).toBe(false);
    expect(f.output.every(value => value === 0)).toBe(true);
    expect(f.bridge.port.postMessage).not.toHaveBeenCalled();
  });
  it("rechaza una frecuencia incompatible antes de enviar tramas al worker", () => {
    vi.stubGlobal("sampleRate", 44100);
    try {
      const f = fixture();
      expect(f.tick()).toBe(false);
      expect(f.pending).toHaveLength(0);
      expect(f.output.every(value => value === 0)).toBe(true);
      expect(f.bridge.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error", reason: "unsupported_rate" }));
      expect(f.worker.close).toHaveBeenCalledOnce();
    } finally { vi.stubGlobal("sampleRate", 48000); }
  });
  it("ignora respuestas y reconexiones tardías después de cerrar la captura", () => {
    const f = fixture();
    for (let i = 0; i < 4; i++) expect(f.tick()).toBe(true);
    const frames = f.pending.length;
    f.bridge.port.postMessage.mockClear();
    f.bridge.port.onmessage({ data: { type: "close" } });
    for (let i = 0; i < 5; i++) f.worker.onmessage({ data: { frame: new Float32Array(480), probability: 1, rms: 0.1 } });
    f.bridge.port.onmessage({ data: { type: "connect", port: f.worker } });
    expect(f.tick()).toBe(false);
    expect(f.pending).toHaveLength(frames);
    expect(f.output.every(value => value === 0)).toBe(true);
    expect(f.worker.start).toHaveBeenCalledOnce();
    expect(f.worker.close).toHaveBeenCalledOnce();
    expect(f.bridge.port.postMessage).not.toHaveBeenCalled();
  });
});
