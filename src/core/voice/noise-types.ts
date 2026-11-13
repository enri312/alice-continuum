export type SpeechEvidence = {
  rms: number;
  probability: number;
  voicedMs: number;
};

export type NoiseFailureReason = "input_backlog" | "output_overflow" | "unsupported_rate" | "metrics_timeout";

// A read failure carries its cause without treating arbitrary error text as a
// request to restart capture. The owner still discards the whole failed take.
export class NoiseSignalTimeout extends Error {
  readonly reason = "metrics_timeout";
  constructor() { super("No llega señal del filtro local. La toma se descartó."); }
}

// Messages from the filter may request capture recovery only for known causes.
export function noiseFailureReason(value: unknown): NoiseFailureReason | undefined {
  return value === "input_backlog" || value === "output_overflow" || value === "unsupported_rate" || value === "metrics_timeout" ? value : undefined;
}

export function isRecoverableNoiseFailure(value: unknown): boolean {
  return value === "input_backlog" || value === "output_overflow" || value === "metrics_timeout";
}

export type MicrophoneSensitivity = "normal" | "soft";
export function microphoneProfile(value?: unknown): Readonly<{ sensitivity: MicrophoneSensitivity; gain: number; silenceMs: number }> {
  return value === "soft"
    ? { sensitivity: "soft", gain: 2, silenceMs: 2000 }
    : { sensitivity: "normal", gain: 1, silenceMs: 1000 };
}

export type MicrophoneOptions = { deviceId?: string; sensitivity?: MicrophoneSensitivity };
export type NoiseStatus = { microphone: string; systemEcho: boolean; browserNoise: boolean; sensitivity?: MicrophoneSensitivity };
export type AudioSignalCounters = {
  inputSamples: number;
  inputSquareSum: number;
  inputPeak: number;
  inputClippedSamples: number;
  outputSamples: number;
  outputSquareSum: number;
  outputPeak: number;
};
export type AudioSignalSnapshot = {
  sampleRate: 48000;
  inputGain: number;
  inputSamples: number;
  inputRms: number;
  inputPeak: number;
  inputClippedSamples: number;
  inputClippedFraction: number;
  outputSamples: number;
  outputRms: number;
  outputPeak: number;
  coverage: "last_received_batch";
};
export type ProcessedMicrophone = {
  stream: MediaStream;
  read: () => SpeechEvidence;
  close: () => void;
  status: NoiseStatus;
  getSignalSnapshot?: () => Readonly<AudioSignalSnapshot> | undefined;
};
