import NoiseWorker from "./noise-worker?worker";
import workletUrl from "./noise-worklet?worker&url";
import { microphoneProfile, noiseFailureReason, type AudioSignalCounters, type MicrophoneOptions, type NoiseFailureReason, type ProcessedMicrophone } from "./noise-types";
import { readAudioSignalCounters, signalCountersAdvance, snapshotAudioSignal } from "./noise-signal";

export async function getMicrophone(options: MicrophoneOptions = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw Error("El micrófono no está disponible en este entorno.");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1, sampleRate: 48000,
      ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}) }, video: false,
  });
  try {
    const track = stream.getAudioTracks()[0];
    // Use system-wide echo cancellation only when the actual device advertises it.
    const modes = track.getCapabilities?.().echoCancellation as unknown;
    if (Array.isArray(modes) && modes.includes("all")) {
      try { await track.applyConstraints({ echoCancellation: { exact: "all" } } as unknown as MediaTrackConstraints); }
      catch { /* The requested standard cancellation remains in place. */ }
    }
    return stream;
  } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
}

export async function processMicrophone(raw: MediaStream, onError: (message: string, reason?: NoiseFailureReason) => void, signal?: AbortSignal, options: MicrophoneOptions = {}): Promise<ProcessedMicrophone> {
  const profile = microphoneProfile(options.sensitivity);
  const context = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
  let worker: Worker | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let filter: BiquadFilterNode | undefined;
  let gain: GainNode | undefined;
  let node: AudioWorkletNode | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let closed = false;
  let rejectInitialization: (() => void) | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener("abort", close);
    rejectInitialization?.();
    source?.disconnect(); filter?.disconnect(); gain?.disconnect(); node?.disconnect();
    node?.port.postMessage({ type: "close" });
    worker?.terminate();
    destination?.stream.getTracks().forEach(track => track.stop());
    node?.port.close();
    void context.close().catch(() => undefined);
  };
  signal?.addEventListener("abort", close, { once: true });
  try {
    if (signal?.aborted) throw Error("La preparación del micrófono se canceló.");
    if (context.sampleRate !== 48000) throw Error("El filtro requiere audio a 48 kHz.");
    await context.resume();
    if (closed) throw Error("La preparación del micrófono se canceló.");
    await context.audioWorklet.addModule(workletUrl);
    if (closed) throw Error("La preparación del micrófono se canceló.");
    node = new AudioWorkletNode(context, "alice-noise-bridge", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1 });
    worker = new NoiseWorker();
    const bridge = new MessageChannel();
    let energy = 0, frames = 0, probability = 0, voicedMs = 0, lastMetric = Date.now();
    let signalCounters: Readonly<AudioSignalCounters> | undefined;
    let signalHighWater: Readonly<AudioSignalCounters> | undefined;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("El filtro de ruido no pudo iniciarse a tiempo.")), 10000);
      const fail = (message: string) => { clearTimeout(timer); reject(Error(message)); };
      rejectInitialization = () => fail("La preparación del filtro se canceló.");
      worker!.onerror = () => fail("Falló el procesador local de ruido.");
      worker!.onmessage = event => {
        if (event.data.type === "ready") node!.port.postMessage({ type: "connect", port: bridge.port2, sensitivity: profile.sensitivity }, [bridge.port2]);
        else if (event.data.type === "error") fail(event.data.message);
      };
      node!.port.onmessage = event => {
        if (event.data.type === "ready") { clearTimeout(timer); rejectInitialization = undefined; resolve(); }
        else if (event.data.type === "error") fail(event.data.message);
      };
      worker!.postMessage({ type: "initialize", port: bridge.port1 }, [bridge.port1]);
    });
    const failed = (message: string, reason?: NoiseFailureReason) => {
      if (!closed) {
        // Dispose this filter before notifying its owner, which may rearm capture.
        close();
        if (reason) onError(message, reason); else onError(message);
      }
    };
    worker.onmessage = event => { if (event.data.type === "error") failed(event.data.message); };
    worker.onerror = () => failed("El filtro local dejó de funcionar. La toma se descartó.");
    node.onprocessorerror = () => failed("El procesador de audio se detuvo. La toma se descartó.");
    node.port.onmessage = event => {
      if (closed) return;
      if (event.data.type === "error") { failed(event.data.message, noiseFailureReason(event.data.reason)); return; }
      if (event.data.type !== "metrics") return;
      const metric = event.data;
      const measured = readAudioSignalCounters(metric.signal);
      if (!measured) signalCounters = undefined;
      else if (!signalHighWater || signalCountersAdvance(signalHighWater, measured)) {
        signalCounters = signalHighWater = measured;
      }
      energy += metric.rms * metric.rms * metric.frames;
      frames += metric.frames; probability = Math.max(probability, metric.probability); voicedMs += metric.voicedMs;
      lastMetric = Date.now();
    };
    source = context.createMediaStreamSource(raw);
    filter = context.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 80; filter.Q.value = 0.707;
    gain = context.createGain(); gain.gain.value = profile.gain;
    destination = context.createMediaStreamDestination();
    source.connect(filter); filter.connect(gain); gain.connect(node); node.connect(destination);
    const track = raw.getAudioTracks()[0];
    if (track?.readyState === "ended") throw Error("La captura se canceló mientras se preparaba el filtro.");
    const settings = track?.getSettings();
    const echoMode: unknown = settings?.echoCancellation;
    return {
      stream: destination.stream,
      status: { microphone: track?.label || "Micrófono del sistema", systemEcho: echoMode === "all", browserNoise: settings?.noiseSuppression === true, sensitivity: profile.sensitivity },
      getSignalSnapshot: () => signalCounters ? snapshotAudioSignal(signalCounters, profile.gain) : undefined,
      read: () => {
        if (Date.now() - lastMetric > 1500) throw Error("No llega señal del filtro local. La toma se descartó.");
        const evidence = { rms: frames ? Math.sqrt(energy / frames) : 0, probability, voicedMs };
        energy = frames = probability = voicedMs = 0;
        return evidence;
      }, close,
    };
  } catch (error) { close(); throw error; }
}
