export type SpeechEvidence = {
  rms: number;
  probability: number;
  voicedMs: number;
};

export type NoiseFailureReason = "input_backlog" | "output_overflow" | "unsupported_rate";

// Messages from the filter may request capture recovery only for known causes.
export function noiseFailureReason(value: unknown): NoiseFailureReason | undefined {
  return value === "input_backlog" || value === "output_overflow" || value === "unsupported_rate" ? value : undefined;
}

export function isRecoverableNoiseFailure(value: unknown): boolean {
  return value === "input_backlog" || value === "output_overflow";
}

export type MicrophoneOptions = { deviceId?: string };
export type NoiseStatus = { microphone: string; systemEcho: boolean; browserNoise: boolean };
export type ProcessedMicrophone = {
  stream: MediaStream;
  read: () => SpeechEvidence;
  close: () => void;
  status: NoiseStatus;
};
