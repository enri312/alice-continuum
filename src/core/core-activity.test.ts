import { describe, expect, it } from "vitest";
import { buildBrainSnapshot } from "./brain";
import { applyCoreActivitySnapshot, parseCoreActivitySnapshot } from "./core-activity";

const regions = [
  { id: "perception", label: "Percepción", eventCount: 1, signal: 0.3, lastEventAtMs: 1_786_280_000_000 },
  { id: "permission", label: "Permisos", eventCount: 1, signal: 0.3, lastEventAtMs: 1_786_280_000_000 },
  { id: "memory", label: "Memoria", eventCount: 0, signal: 0, lastEventAtMs: null },
  { id: "language", label: "Lenguaje", eventCount: 0, signal: 0, lastEventAtMs: null },
  { id: "workspace", label: "Contexto", eventCount: 1, signal: 0.3, lastEventAtMs: 1_786_280_000_000 },
  { id: "output", label: "Salida", eventCount: 0, signal: 0, lastEventAtMs: null },
  { id: "motor", label: "Motor manual", eventCount: 0, signal: 0, lastEventAtMs: null },
];
const links = [
  { id: "permission-perception", from: "permission", to: "perception", evidenceCount: 1, signal: 0.3 },
  { id: "perception-workspace", from: "perception", to: "workspace", evidenceCount: 1, signal: 0.3 },
  { id: "memory-workspace", from: "memory", to: "workspace", evidenceCount: 0, signal: 0 },
  { id: "language-workspace", from: "language", to: "workspace", evidenceCount: 0, signal: 0 },
  { id: "workspace-output", from: "workspace", to: "output", evidenceCount: 0, signal: 0 },
];
const raw = {
  schemaVersion: 2,
  generatedAtMs: 1_786_280_000_000,
  method: "r3-recency-motor-v2",
  heuristic: true,
  windowMs: 300_000,
  auditHealthy: true,
  visibleEventCount: 4,
  windowEventCount: 1,
  latestEventAtMs: 1_786_280_000_000,
  overallSignal: 0.25,
  regions,
  links,
};

const baseInputs = {
  conversationCount: 0,
  memoryCount: 0,
  retrievedMemoryCount: 0,
  retrievedMemoryTop: "",
  observerEnabled: false,
  foregroundContext: null,
  cloudConfigured: false,
  cloudPending: false,
};

describe("parseCoreActivitySnapshot", () => {
  it("acepta el contrato cerrado y conserva la etiqueta heurística", () => {
    const parsed = parseCoreActivitySnapshot(raw);
    expect(parsed.heuristic).toBe(true);
    expect(parsed.method).toBe("r3-recency-motor-v2");
    expect(parsed.regions.find((region) => region.id === "perception")?.signal).toBe(0.3);
  });

  it("rechaza campos privados, topologías alteradas y conteos incoherentes", () => {
    expect(() => parseCoreActivitySnapshot({ ...raw, message: "privado" })).toThrow();
    expect(() => parseCoreActivitySnapshot({ ...raw, links: links.map((link, index) => index ? link : { ...link, to: "output" }) })).toThrow();
    expect(() => parseCoreActivitySnapshot({ ...raw, windowEventCount: 0 })).toThrow();
  });

  it("acepta un archivo real sin actividad reciente sin inventar señal", () => {
    const empty = {
      ...raw,
      windowEventCount: 0,
      latestEventAtMs: null,
      overallSignal: 0,
      regions: regions.map((region) => ({ ...region, eventCount: 0, signal: 0, lastEventAtMs: null })),
      links: links.map((link) => ({ ...link, evidenceCount: 0, signal: 0 })),
    };
    expect(parseCoreActivitySnapshot(empty).overallSignal).toBe(0);
  });
});

describe("applyCoreActivitySnapshot", () => {
  it("separa densidad persistente de señal R3 efímera", () => {
    const base = buildBrainSnapshot({ ...baseInputs, memoryCount: 10 });
    const merged = applyCoreActivitySnapshot(base, parseCoreActivitySnapshot(raw));
    expect(merged.persistentNeuralDensity).toBe(base.persistentNeuralDensity);
    expect(merged.currentNeuralActivity).toBe(0.25);
    expect(merged.neuralDensity).toBeCloseTo(base.persistentNeuralDensity + 0.25 * 0.18);
    expect(merged.flowNodes.find((node) => node.id === "flow-input")?.activation).toBe(0.3);
    expect(merged.flowNodes.find((node) => node.id === "flow-affect")?.activation).toBe(0);
  });

  it("apaga pulsos de interfaz cuando R3 no aporta evidencia", () => {
    const base = buildBrainSnapshot({ ...baseInputs, lastUserMessage: "texto local" });
    const merged = applyCoreActivitySnapshot(base, null);
    expect(merged.hasActivity).toBe(false);
    expect(merged.currentNeuralActivity).toBe(0);
    expect(merged.flowNodes.every((node) => node.activation === 0)).toBe(true);
  });

  it("ilumina sólo el cuerpo manual cuando existe evidencia motora", () => {
    const motorRaw = {
      ...raw,
      regions: regions.map((region) => region.id === "motor"
        ? { ...region, eventCount: 1, signal: .6, lastEventAtMs: raw.generatedAtMs }
        : { ...region, eventCount: 0, signal: 0, lastEventAtMs: null }),
      links: links.map((link) => ({ ...link, evidenceCount: 0, signal: 0 })),
    };
    const merged = applyCoreActivitySnapshot(buildBrainSnapshot(baseInputs), parseCoreActivitySnapshot(motorRaw));
    expect(merged.flowNodes.find((node) => node.id === "flow-body")?.activation).toBe(.6);
    expect(merged.flowNodes.find((node) => node.id === "flow-response")?.activation).toBe(0);
    expect(merged.flowNodes.find((node) => node.id === "flow-workspace")?.activation).toBe(0);
  });
});
