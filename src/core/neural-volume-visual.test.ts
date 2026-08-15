import { describe, expect, it } from "vitest";
import { compactGrowthReveal, resolveNeuralColor, visibleMemoryAnchorCount } from "./neural-volume-visual";

describe("compactGrowthReveal", () => {
  it("hace crecer el volumen desde el centro hacia afuera", () => {
    expect(compactGrowthReveal("association", 0.1, 0.5)).toBeLessThan(compactGrowthReveal("association", 0.8, 0.5));
    expect(compactGrowthReveal("association", 0.3, 0)).toBeLessThan(compactGrowthReveal("cortex", 0.3, 0));
  });
});

describe("visibleMemoryAnchorCount", () => {
  it("representa exactamente los recuerdos disponibles sin superar la capacidad visual", () => {
    expect(visibleMemoryAnchorCount(10, 64)).toBe(10);
    expect(visibleMemoryAnchorCount(90, 64)).toBe(64);
    expect(visibleMemoryAnchorCount(-4, 64)).toBe(0);
  });
});

describe("resolveNeuralColor", () => {
  it("mantiene neutro un canal afectivo planificado o sin señal", () => {
    expect(resolveNeuralColor("memory", false, 0, false, [255, 216, 77])).toEqual([66, 88, 108]);
    expect(resolveNeuralColor("memory", true, 0.8, false, [255, 216, 77])).toEqual([56, 189, 248]);
  });

  it("usa el color afectivo solo ante una señal positiva y disponible", () => {
    expect(resolveNeuralColor("output", true, 0.4, true, [255, 216, 77])).toEqual([255, 216, 77]);
  });
});
