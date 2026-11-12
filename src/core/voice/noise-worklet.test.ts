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

function fixture(sensitivity?: unknown) {
  const bridge = new Processor();
  const pending: Float32Array[] = [];
  const worker = { onmessage: (_event: unknown) => undefined, start: vi.fn(), close: vi.fn(),
    postMessage: (frame: Float32Array) => pending.push(frame) };
  bridge.port.onmessage({ data: { type: "connect", port: worker, sensitivity } });
  const output = new Float32Array(128);
  const tick = (sample = 0.1) => bridge.process([[new Float32Array(128).fill(sample)]], [[output]]);
  return { bridge, worker, pending, output, tick };
}

describe("enlace de audio bajo variaciones de planificación", () => {
  it("mide antes del clamp y sobre la salida real sin cambiar PCM ni contar tramas pendientes como reproducidas", () => {
    const f = fixture("soft");
    for (let i = 0; i < 19; i++) expect(f.tick(2)).toBe(true);
    expect(f.pending).toHaveLength(5);
    expect(f.pending.every(frame => frame.every(value => value === 32768))).toBe(true);
    expect(f.output.every(value => value === 0)).toBe(true);
    const processed = new Float32Array(480).fill(0.03);
    for (const _frame of f.pending.slice(0, 5)) f.worker.onmessage({ data: { frame: processed, probability: 0.1, rms: 0.03 } });
    const first = f.bridge.port.postMessage.mock.calls.find(([message]) => message.type === "metrics")![0].signal;
    expect(first.inputSamples).toBe(19 * 128);
    expect(first.inputSquareSum).toBe(19 * 128 * 4);
    expect(first.inputPeak).toBe(2);
    expect(first.inputClippedSamples).toBe(19 * 128);
    expect(first.outputSamples).toBe(19 * 128);
    expect(first.outputSquareSum).toBe(0);
    expect(first.outputPeak).toBe(0);
    let outputEnergy = 0;
    for (let i = 0; i < 19; i++) {
      expect(f.tick(2)).toBe(true);
      for (const sample of f.output) outputEnergy += sample * sample;
    }
    for (const _frame of f.pending.slice(5, 10)) f.worker.onmessage({ data: { frame: processed, probability: 0.1, rms: 0.03 } });
    const packets = f.bridge.port.postMessage.mock.calls.filter(([message]) => message.type === "metrics");
    const second = packets[1][0].signal;
    expect(second.inputSamples).toBe(38 * 128);
    expect(second.inputSquareSum).toBe(38 * 128 * 4);
    expect(second.inputClippedSamples).toBe(38 * 128);
    expect(second.outputSamples).toBe(38 * 128);
    expect(second.outputSquareSum).toBeCloseTo(outputEnergy, 12);
    expect(second.outputPeak).toBe(processed[0]);
    expect(first.outputSquareSum).toBe(0); // earlier packets own a scalar copy
    expect(first.inputSamples).toBe(19 * 128);
    expect(f.bridge.port.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
  it.each([undefined, "soft"])("tolera 320 ms de demora del worker y vuelve a entregar la voz procesada (%s)", sensitivity => {
    const f = fixture(sensitivity);
    for (let i = 0; i < 120; i++) expect(f.tick()).toBe(true);
    expect(f.pending.length).toBe(32);
    expect(f.output.every(value => value === 0)).toBe(true);
    for (const frame of f.pending) f.worker.onmessage({ data: { frame: new Float32Array(frame.length).fill(0.05), probability: 1, rms: 0.05 } });
    expect(f.tick()).toBe(true);
    expect(f.output.some(value => value > 0)).toBe(true);
    expect(f.bridge.port.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
  it.each([undefined, "soft"])("detiene la captura ante un worker que no responde, sin dejar crecer la cola (%s)", sensitivity => {
    const f = fixture(sensitivity);
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
  it.each([undefined, "soft"])("rechaza una entrega que supera la capacidad de salida sin ampliar el búfer (%s)", sensitivity => {
    const f = fixture(sensitivity);
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
  it.each([undefined, "soft"])("rechaza una frecuencia incompatible antes de enviar tramas al worker (%s)", sensitivity => {
    vi.stubGlobal("sampleRate", 44100);
    try {
      const f = fixture(sensitivity);
      expect(f.tick()).toBe(false);
      expect(f.pending).toHaveLength(0);
      expect(f.output.every(value => value === 0)).toBe(true);
      expect(f.bridge.port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error", reason: "unsupported_rate" }));
      expect(f.worker.close).toHaveBeenCalledOnce();
    } finally { vi.stubGlobal("sampleRate", 48000); }
  });
  it.each([undefined, "soft"])("ignora respuestas y reconexiones tardías después de cerrar la captura (%s)", sensitivity => {
    const f = fixture(sensitivity);
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

  it.each([0.1, 0.4])("conserva la amplitud ya procesada por RNNoise en soft con probabilidad %s", probability => {
    const f = fixture("soft");
    for (let i = 0; i < 8; i++) {
      expect(f.tick()).toBe(true);
      expect(f.output.every(value => value === 0)).toBe(true);
    }
    expect(f.pending).toHaveLength(2);
    const processed = new Float32Array(480).fill(0.03);
    for (const _frame of f.pending) f.worker.onmessage({ data: { frame: processed, probability, rms: 0.03 } });
    expect(f.tick()).toBe(true);
    expect(f.output.every(value => value === processed[0])).toBe(true);
    // The raw fixture input is 0.1: this is filtered worker output, not bypass.
    expect(f.output[0]).not.toBeCloseTo(0.1);
  });

  it.each([undefined, "normal", "unknown"])("conserva el gate normal para una trama de probabilidad baja (%s)", sensitivity => {
    const f = fixture(sensitivity);
    for (let i = 0; i < 8; i++) expect(f.tick()).toBe(true);
    for (const _frame of f.pending) f.worker.onmessage({ data: { frame: new Float32Array(480).fill(0.03), probability: 0.1, rms: 0.03 } });
    expect(f.tick()).toBe(true);
    expect(f.output[0]).toBeCloseTo(0.03 * 0.08, 7);
    expect(f.output[127]).toBeCloseTo(0.03 * 0.08, 7);
  });

  it.each([
    { initial: "soft", replacement: "normal", expected: 0.03 },
    { initial: "normal", replacement: "soft", expected: 0.03 * 0.08 },
  ])("ignora una reconexión que intenta cambiar el perfil $initial a $replacement", ({ initial, replacement, expected }) => {
    const f = fixture(initial);
    const anotherWorker = { start: vi.fn(), close: vi.fn(), postMessage: vi.fn(), onmessage: vi.fn() };
    f.bridge.port.onmessage({ data: { type: "connect", port: anotherWorker, sensitivity: replacement } });
    for (let i = 0; i < 8; i++) expect(f.tick()).toBe(true);
    expect(f.pending).toHaveLength(2);
    expect(anotherWorker.start).not.toHaveBeenCalled();
    expect(anotherWorker.postMessage).not.toHaveBeenCalled();
    expect(f.worker.start).toHaveBeenCalledOnce();
    for (const _frame of f.pending) f.worker.onmessage({ data: { frame: new Float32Array(480).fill(0.03), probability: 0.1, rms: 0.03 } });
    expect(f.tick()).toBe(true);
    expect(f.output[0]).toBeCloseTo(expected, 7);
  });
});
