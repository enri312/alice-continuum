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
    expect(f.bridge.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
