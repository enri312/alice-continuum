import { describe, expect, it } from "vitest";
import { buildBrainSnapshot } from "./brain";

const memories = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `memory-${index}`, intention: `Recuerdo ${index}`, memoryStatus: "confirmed" as const }));

const emptyInputs = {
  conversationCount: 0,
  memories: [],
  retrievedMemoryCount: 0,
  retrievedMemoryTop: "",
  retrievedMemoryIds: [],
  observerEnabled: false,
  foregroundContext: null,
  cloudConfigured: false,
  cloudPending: false,
};

describe("buildBrainSnapshot", () => {
  it("mantiene el núcleo realmente vacío sin actividad comprobable", () => {
    const snapshot = buildBrainSnapshot(emptyInputs);

    expect(snapshot.hasActivity).toBe(false);
    expect(snapshot.neuralDensity).toBe(0);
    expect(snapshot.persistentNeuralDensity).toBe(0);
    expect(snapshot.currentNeuralActivity).toBe(0);
    expect(snapshot.persistentMemoryCount).toBe(0);
    expect(snapshot.focusStatus).toBe("en espera");
    expect(snapshot.nodes.find((node) => node.id === "memory")?.value).toBe("0 recuerdos");
    expect(snapshot.affectChannels).toHaveLength(10);
    expect(snapshot.affectChannels.every((channel) => channel.value === 0 && channel.availability === "planned")).toBe(true);
  });

  it("no confunde un proveedor configurado con aprendizaje o actividad", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, cloudConfigured: true });

    expect(snapshot.hasActivity).toBe(false);
    expect(snapshot.neuralDensity).toBe(0);
    expect(snapshot.nodes.find((node) => node.id === "cloud")?.value).toBe("disponible");
  });

  it("hace depender la densidad persistente únicamente de recuerdos locales", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, memories: memories(6) });
    const expectedDensity = .015 + .845 * 6 / 186;

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.persistentNeuralDensity).toBeCloseTo(expectedDensity, 6);
    expect(snapshot.neuralDensity).toBeCloseTo(expectedDensity, 6);
    expect(snapshot.currentNeuralActivity).toBe(0);
    expect(snapshot.persistentMemoryCount).toBe(6);
  });

  it("representa una entrada actual como actividad temporal sin aprendizaje", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, lastUserMessage: "Hola Alice" });

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.focusStatus).toBe("conversación activa");
    expect(snapshot.persistentNeuralDensity).toBe(0);
    expect(snapshot.neuralDensity).toBeCloseTo(.035, 6);
    expect(snapshot.currentNeuralActivity).toBeCloseTo(.035, 6);
    expect(snapshot.nodes.find((node) => node.id === "chat")?.value).toBe("mensaje recibido");
  });

  it("añade un pulso visible cuando la observación local aporta una ventana", () => {
    const snapshot = buildBrainSnapshot({
      ...emptyInputs,
      observerEnabled: true,
      foregroundContext: { windowTitle: "Trabajo práctico", processName: "Code" },
    });

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.neuralDensity).toBeCloseTo(.025, 6);
    expect(snapshot.currentNeuralActivity).toBeCloseTo(.025, 6);
    expect(snapshot.nodes.find((node) => node.id === "window")?.value).toBe("Code");
  });

  it("prioriza la recuperación local y conserva su evidencia", () => {
    const snapshot = buildBrainSnapshot({
      ...emptyInputs,
      memories: memories(8),
      retrievedMemoryCount: 2,
      retrievedMemoryTop: "Preferencia por documentación previa",
      retrievedMemoryIds: ["memory-0", "memory-1"],
    });

    expect(snapshot.focusStatus).toBe("recuperando memoria");
    expect(snapshot.retrievedMemoryCount).toBe(2);
    expect(snapshot.focusDetail).toContain("2 recuerdos relacionados");
    expect(snapshot.focusDetail).toContain("Preferencia por documentación previa");
    expect(snapshot.neuralDensity).toBeGreaterThan(snapshot.persistentNeuralDensity);
    expect(snapshot.currentNeuralActivity).toBeCloseTo(.05, 6);
  });

  it("marca una consulta de nube sin convertirla en memoria persistente", () => {
    const snapshot = buildBrainSnapshot({
      ...emptyInputs,
      cloudConfigured: true,
      cloudPending: true,
    });

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.focusStatus).toBe("consultando la nube");
    expect(snapshot.neuralDensity).toBeCloseTo(.055, 6);
    expect(snapshot.currentNeuralActivity).toBeCloseTo(.055, 6);
    expect(snapshot.persistentNeuralDensity).toBe(0);
    expect(snapshot.nodes.find((node) => node.id === "reply")?.value).toBe("esperando");
  });

  it("mantiene una red inicial pequeña y reserva la nube densa para aprendizaje acumulado", () => {
    const initial = buildBrainSnapshot({ ...emptyInputs, memories: memories(10) });
    const mature = buildBrainSnapshot({ ...emptyInputs, memories: memories(1_000) });

    expect(initial.persistentNeuralDensity).toBeLessThan(.07);
    expect(mature.persistentNeuralDensity).toBeGreaterThan(.72);
    expect(mature.persistentNeuralDensity).toBeLessThanOrEqual(.86);
  });
});
