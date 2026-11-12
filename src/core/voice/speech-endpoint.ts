import { microphoneProfile, type MicrophoneSensitivity, type SpeechEvidence } from "./noise-types";

// RNNoise measures speech likelihood, not the identity of the speaker.
export class SpeechEndpoint {
  private startedAt: number;
  private lastVoice: number;
  private voicedMs = 0;
  private noiseFloor = 0.002;
  private readonly silenceMs: number;
  constructor(now: number, sensitivity?: MicrophoneSensitivity) {
    this.startedAt = now;
    this.lastVoice = now;
    this.silenceMs = microphoneProfile(sensitivity).silenceMs;
  }
  get hasSpeech() { return this.voicedMs >= 120; }
  update(evidence: SpeechEvidence, now: number): "listening" | "end" | "quiet" {
    const { rms, probability, voicedMs } = evidence;
    if (Number.isFinite(rms) && Number.isFinite(probability) && Number.isFinite(voicedMs)) {
      if (probability < 0.2) this.noiseFloor += (Math.min(0.015, Math.max(0.0005, rms)) - this.noiseFloor) * 0.05;
      const threshold = Math.max(0.004, this.noiseFloor * 2.2);
      if (rms >= threshold && probability >= (this.hasSpeech ? 0.45 : 0.65)) {
        if (!this.hasSpeech && now - this.lastVoice > 400) this.voicedMs = 0;
        this.voicedMs += Math.max(0, Math.min(250, voicedMs));
        this.lastVoice = now;
      }
    }
    if (this.hasSpeech && now - this.lastVoice >= this.silenceMs) return "end";
    if (!this.hasSpeech && now - this.startedAt >= 8000) return "quiet";
    return "listening";
  }
}
