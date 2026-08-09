import { describe, expect, it } from "vitest";
import { affectPalette, createPlannedAffectChannels } from "./affect";

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
});
