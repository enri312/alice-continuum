export type SpeechEvidence = {
  rms: number;
  probability: number;
  voicedMs: number;
};

export type MicrophoneOptions = { deviceId?: string };
export type NoiseStatus = { microphone: string; systemEcho: boolean; browserNoise: boolean };
export type ProcessedMicrophone = {
  stream: MediaStream;
  read: () => SpeechEvidence;
  close: () => void;
  status: NoiseStatus;
};
