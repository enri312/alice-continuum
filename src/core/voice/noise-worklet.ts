// This worklet contains only buffering and metering; WASM runs in noise-worker.
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

class AliceNoiseBridge extends AudioWorkletProcessor {
  private worker: MessagePort | null = null;
  private input = new Float32Array(480);
  private inputAt = 0;
  // Bound scheduling jitter to half a second; a brief busy worker must not
  // abort a take. Startup latency remains two frames, independent of capacity.
  private ring = new Float32Array(480 * 50);
  private writeAt = 0;
  private readAt = 0;
  private available = 0;
  private pending = 0;
  private alive = true;
  private primed = false;
  private gain = 0.08;
  private frames = 0;
  private energy = 0;
  private probability = 0;
  private voicedMs = 0;
  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<{ type: string; port?: MessagePort }>) => {
      if (event.data.type === "close") { this.alive = false; this.worker?.close(); return; }
      if (event.data.type !== "connect" || !event.data.port) return;
      this.worker = event.data.port;
      this.worker.onmessage = (message: MessageEvent<{ frame: Float32Array; probability: number; rms: number }>) => {
        const { frame, probability, rms } = message.data;
        this.pending--;
        if (!this.alive) return;
        if (this.available + frame.length > this.ring.length) { this.fail(); return; }
        // Soft gating attenuates residual non-speech without chopping word starts.
        const target = probability < 0.2 ? 0.08 : probability >= 0.6 ? 1 : 0.4;
        for (let i = 0; i < frame.length; i++) {
          this.gain += (target - this.gain) * 0.004;
          this.ring[this.writeAt] = frame[i] * this.gain;
          this.writeAt = (this.writeAt + 1) % this.ring.length;
        }
        this.available += frame.length;
        this.energy += rms * rms;
        this.probability = Math.max(this.probability, probability);
        if (probability >= 0.65) this.voicedMs += 10;
        if (++this.frames === 5) {
          this.port.postMessage({ type: "metrics", rms: Math.sqrt(this.energy / this.frames), probability: this.probability, voicedMs: this.voicedMs, frames: this.frames });
          this.frames = this.energy = this.probability = this.voicedMs = 0;
        }
      };
      this.worker.start();
      this.port.postMessage({ type: "ready" });
    };
  }
  private fail() { this.alive = false; this.port.postMessage({ type: "error", message: "El filtro de audio no pudo mantener el ritmo de captura." }); }
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const output = outputs[0]?.[0];
    if (!output) return this.alive;
    output.fill(0);
    if (!this.alive || !this.worker) return this.alive;
    const input = inputs[0]?.[0];
    for (let i = 0; i < output.length; i++) {
      this.input[this.inputAt++] = Math.max(-1, Math.min(1, input?.[i] ?? 0)) * 32768;
      if (this.inputAt === 480) {
        if (++this.pending > 50 || sampleRate !== 48000) { this.fail(); return false; }
        this.worker.postMessage(this.input, [this.input.buffer]);
        this.input = new Float32Array(480);
        this.inputAt = 0;
      }
      if (!this.primed && this.available >= 960) this.primed = true;
      if (this.primed && this.available > 0) {
        output[i] = this.ring[this.readAt];
        this.readAt = (this.readAt + 1) % this.ring.length;
        this.available--;
      }
    }
    return this.alive;
  }
}
registerProcessor("alice-noise-bridge", AliceNoiseBridge);
export {};
