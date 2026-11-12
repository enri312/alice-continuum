import { describe, expect, it } from "vitest";
import { SpeechEndpoint } from "./speech-endpoint";

describe("fin de turno por silencio local", () => {
  it.each(["normal", "soft"] as const)("no convierte silencio ni un golpe aislado en un turno con perfil %s", sensitivity => {
    const detector = new SpeechEndpoint(0, sensitivity);
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
  it.each(["normal", "soft"] as const)("ignora ruido fuerte continuo sin probabilidad de voz con perfil %s", sensitivity => {
    const detector = new SpeechEndpoint(0, sensitivity);
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
  it("conserva pausas de uno a 1,75 segundos y termina a los dos segundos en voz baja", () => {
    const detector = new SpeechEndpoint(0, "soft");
    detector.update({ rms: 0.03, probability: 0.9, voicedMs: 150 }, 250);
    for (const pauseMs of [1000, 1250, 1500, 1750]) {
      expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 250 + pauseMs)).toBe("listening");
    }
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 2250)).toBe("end");
  });
  it("continúa la misma frase después de una pausa larga en voz baja", () => {
    const detector = new SpeechEndpoint(0, "soft");
    detector.update({ rms: 0.03, probability: 0.9, voicedMs: 150 }, 250);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 2000)).toBe("listening");
    expect(detector.update({ rms: 0.03, probability: 0.6, voicedMs: 50 }, 2100)).toBe("listening");
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 4099)).toBe("listening");
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 4100)).toBe("end");
  });
  it("mantiene el cierre de un segundo en normal explícito y por defecto", () => {
    for (const detector of [new SpeechEndpoint(0), new SpeechEndpoint(0, "normal")]) {
      detector.update({ rms: 0.03, probability: 0.9, voicedMs: 150 }, 250);
      expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 1249)).toBe("listening");
      expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 1250)).toBe("end");
    }
  });
  it.each(["normal", "soft"] as const)("mantiene los umbrales de energía y probabilidad de inicio con perfil %s", sensitivity => {
    const detector = new SpeechEndpoint(0, sensitivity);
    detector.update({ rms: 0.003, probability: 0.99, voicedMs: 250 }, 250);
    expect(detector.hasSpeech).toBe(false);
    detector.update({ rms: 0.3, probability: 0.64, voicedMs: 250 }, 500);
    expect(detector.hasSpeech).toBe(false);
    expect(detector.update({ rms: 0, probability: 0, voicedMs: 0 }, 8000)).toBe("quiet");
  });
  it.each(["normal", "soft"] as const)("exige 120 ms de evidencia de voz sostenida con perfil %s", sensitivity => {
    const detector = new SpeechEndpoint(0, sensitivity);
    detector.update({ rms: 0.03, probability: 0.9, voicedMs: 119 }, 250);
    expect(detector.hasSpeech).toBe(false);
    detector.update({ rms: 0.03, probability: 0.9, voicedMs: 1 }, 500);
    expect(detector.hasSpeech).toBe(true);
  });
});
