import { Rnnoise, type DenoiseState } from "@shiguredo/rnnoise-wasm";

// The bundled WASM runs in a dedicated worker, away from both rendering and
// AudioWorklet's real-time thread. No models or audio are fetched remotely.
let state: DenoiseState | undefined;
self.onmessage = async (event: MessageEvent<{ type: string; port: MessagePort }>) => {
  if (event.data.type !== "initialize" || state) return;
  try {
    const engine = await Rnnoise.load();
    if (engine.frameSize !== 480) throw Error("Formato RNNoise incompatible");
    state = engine.createDenoiseState();
    const port = event.data.port;
    port.onmessage = (message: MessageEvent<Float32Array | "close">) => {
      if (message.data === "close") { state?.destroy(); state = undefined; port.close(); return; }
      try {
        const frame = message.data;
        if (!(frame instanceof Float32Array) || frame.length !== 480 || !state) throw Error("Trama de audio inválida");
        const probability = state.processFrame(frame);
        let energy = 0;
        for (let i = 0; i < frame.length; i++) {
          frame[i] /= 32768;
          energy += frame[i] * frame[i];
        }
        port.postMessage({ frame, probability, rms: Math.sqrt(energy / frame.length) }, [frame.buffer]);
      } catch {
        self.postMessage({ type: "error", message: "El filtro local no pudo procesar el audio." });
      }
    };
    port.start();
    self.postMessage({ type: "ready" });
  } catch {
    self.postMessage({ type: "error", message: "No se pudo iniciar el supresor de ruido local." });
  }
};
