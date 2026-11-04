import { describe, expect, it } from "vitest";
import { SpeechEndpoint } from "./speech-endpoint";

describe("fin de turno por silencio local", () => {
  it("no convierte silencio ni un golpe aislado en un turno", () => {
    const detector = new SpeechEndpoint(0);
    detector.update({ rms: 0.1, probability: 0.99, voicedMs: 30 }, 250);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 1500)).toBe("listening");
    expect(detector.hasSpeech).toBe(false);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 8000)).toBe("quiet");
  });
  it("termina tras una pausa de un segundo, conservando pausas breves", () => {
    const detector = new SpeechEndpoint(0);
    detector.update({ rms: 0.05, probability: 0.9, voicedMs: 150 }, 250);
    detector.update({ rms: 0.04, probability: 0.85, voicedMs: 200 }, 500);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 1000)).toBe("listening");
    detector.update({ rms: 0.04, probability: 0.6, voicedMs: 50 }, 1250);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 2250)).toBe("end");
  });
  it("ignora ruido fuerte continuo sin probabilidad de voz", () => {
    const detector = new SpeechEndpoint(0);
    for (let time = 250; time < 8000; time += 250) expect(detector.update({ rms: 0.3, probability: 0.1, voicedMs: 0 }, time)).toBe("listening");
    expect(detector.update({ rms: 0.3, probability: 0.1, voicedMs: 0 }, 8000)).toBe("quiet");
    expect(detector.hasSpeech).toBe(false);
  });
  it("conserva una palabra breve sostenida y no suma impulsos separados", () => {
    const detector = new SpeechEndpoint(0);
    detector.update({ rms: 0.03, probability: 0.95, voicedMs: 60 }, 250);
    detector.update({ rms: 0.03, probability: 0.95, voicedMs: 60 }, 1000);
    expect(detector.hasSpeech).toBe(false);
    detector.update({ rms: 0.03, probability: 0.95, voicedMs: 130 }, 1250);
    expect(detector.hasSpeech).toBe(true);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 2250)).toBe("end");
  });
});
