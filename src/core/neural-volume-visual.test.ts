import { describe, expect, it } from "vitest";
import { compactGrowthReveal, resolveNeuralColor, resolveNeuralGroupActivity, visibleMemoryAnchorCount } from "./neural-volume-visual";
import type { CoreActivitySnapshot } from "./core-activity";

function activity(signals: Partial<Record<string, number>>): CoreActivitySnapshot {
  const ids = ["perception", "permission", "memory", "language", "workspace", "output", "motor"] as const;
  return {
    schemaVersion: 2,
    generatedAtMs: 1,
    method: "r3-recency-motor-v2",
    heuristic: true,
    windowMs: 300_000,
    auditHealthy: true,
    visibleEventCount: 1,
    windowEventCount: 1,
    latestEventAtMs: 1,
    overallSignal: .4,
    regions: ids.map((id) => ({ id, label: id, eventCount: signals[id] ? 1 : 0, signal: signals[id] ?? 0, lastEventAtMs: signals[id] ? 1 : null })),
    links: [
      { id: "permission-perception", from: "permission", to: "perception", evidenceCount: 0, signal: 0 },
      { id: "perception-workspace", from: "perception", to: "workspace", evidenceCount: 0, signal: 0 },
      { id: "memory-workspace", from: "memory", to: "workspace", evidenceCount: 0, signal: 0 },
      { id: "language-workspace", from: "language", to: "workspace", evidenceCount: 0, signal: 0 },
      { id: "workspace-output", from: "workspace", to: "output", evidenceCount: 0, signal: 0 },
    ],
  };
}

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

describe("resolveNeuralGroupActivity", () => {
  it("separa entrada, contexto y salida usando sólo regiones R3 cognitivas", () => {
    expect(resolveNeuralGroupActivity(activity({ perception: .3, language: .7, memory: .2, workspace: .5, output: .4 }))).toEqual({ input: .7, memory: .5, output: .4 });
  });

  it("no presenta permisos ni movimiento manual como actividad cognitiva", () => {
    expect(resolveNeuralGroupActivity(activity({ permission: .8, motor: .9 }))).toEqual({ input: 0, memory: 0, output: 0 });
    expect(resolveNeuralGroupActivity(null)).toEqual({ input: 0, memory: 0, output: 0 });
  });
});
