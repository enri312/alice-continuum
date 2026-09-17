import { describe, expect, it } from "vitest";
import { affectPalette, createPlannedAffectChannels, parseMemoryAffects } from "./affect";

describe("affectPalette", () => {
  it("define diez canales distinguibles y con colores RGB consistentes", () => {
    expect(affectPalette).toHaveLength(10);
    expect(new Set(affectPalette.map((channel) => channel.id)).size).toBe(10);
    expect(new Set(affectPalette.map((channel) => channel.color)).size).toBe(10);
    for (const channel of affectPalette) {
      const expected = `#${channel.rgb.map((component) => component.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      expect(channel.color).toBe(expected);
    }
  });

  it("no inventa un estado emocional antes de implementar el simulador", () => {
    const channels = createPlannedAffectChannels();
    expect(channels.every((channel) => channel.value === 0)).toBe(true);
    expect(channels.every((channel) => channel.availability === "planned")).toBe(true);
  });

  it("acepta sólo emociones con intensidad y evidencia literal", () => {
    expect(parseMemoryAffects([{ emotion: "joy", intensity: .8, evidence: "estoy feliz" }], "Hoy estoy feliz")).toEqual([{ emotion: "joy", intensity: .8, evidence: "estoy feliz" }]);
    expect(parseMemoryAffects([{ emotion: "joy", intensity: 1, evidence: "Me alegra mucho ver que Alice está cobrando vida con cada avance" }], "Me alegra mucho ver que Alice está cobrando vida con cada avance")).toHaveLength(1);
    expect(() => parseMemoryAffects([{ emotion: "joy", intensity: .8, evidence: "estoy feliz" }], "Hoy compré un SSD")).toThrow("evidencia");
    expect(() => parseMemoryAffects([{ emotion: "joy", intensity: .8, evidence: "Compré un SSD" }], "Compré un SSD")).toThrow("evidencia");
    expect(() => parseMemoryAffects([{ emotion: "sadness", intensity: .6, evidence: "No estoy triste" }], "No estoy triste")).toThrow("evidencia");
    expect(() => parseMemoryAffects([{ emotion: "joy", intensity: 1.4, evidence: "feliz" }], "feliz")).toThrow("Emoción");
  });
});
