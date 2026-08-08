import { describe, expect, it } from "vitest";
import { buildBrainSnapshot } from "./brain";

const emptyInputs = {
  conversationCount: 0,
  memoryCount: 0,
  retrievedMemoryCount: 0,
  retrievedMemoryTop: "",
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
    expect(snapshot.persistentMemoryCount).toBe(0);
    expect(snapshot.focusStatus).toBe("en espera");
    expect(snapshot.nodes.find((node) => node.id === "memory")?.value).toBe("0 recuerdos");
  });

  it("no confunde un proveedor configurado con aprendizaje o actividad", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, cloudConfigured: true });

    expect(snapshot.hasActivity).toBe(false);
    expect(snapshot.neuralDensity).toBe(0);
    expect(snapshot.nodes.find((node) => node.id === "cloud")?.value).toBe("disponible");
  });

  it("hace depender la densidad persistente únicamente de recuerdos locales", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, memoryCount: 6 });
    const expectedDensity = .06 + Math.log2(7) * .12;

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.persistentNeuralDensity).toBeCloseTo(expectedDensity, 6);
    expect(snapshot.neuralDensity).toBeCloseTo(expectedDensity, 6);
    expect(snapshot.persistentMemoryCount).toBe(6);
  });

  it("representa una entrada actual como actividad temporal sin aprendizaje", () => {
    const snapshot = buildBrainSnapshot({ ...emptyInputs, lastUserMessage: "Hola Alice" });

    expect(snapshot.hasActivity).toBe(true);
    expect(snapshot.focusStatus).toBe("conversación activa");
    expect(snapshot.persistentNeuralDensity).toBe(0);
    expect(snapshot.neuralDensity).toBeCloseTo(.035, 6);
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
    expect(snapshot.nodes.find((node) => node.id === "window")?.value).toBe("Code");
  });

  it("prioriza la recuperación local y conserva su evidencia", () => {
    const snapshot = buildBrainSnapshot({
      ...emptyInputs,
      memoryCount: 8,
      retrievedMemoryCount: 2,
      retrievedMemoryTop: "Preferencia por documentación previa",
    });

    expect(snapshot.focusStatus).toBe("recuperando memoria");
    expect(snapshot.retrievedMemoryCount).toBe(2);
    expect(snapshot.focusDetail).toContain("2 recuerdos relacionados");
    expect(snapshot.focusDetail).toContain("Preferencia por documentación previa");
    expect(snapshot.neuralDensity).toBeGreaterThan(snapshot.persistentNeuralDensity);
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
    expect(snapshot.persistentNeuralDensity).toBe(0);
    expect(snapshot.nodes.find((node) => node.id === "reply")?.value).toBe("esperando");
  });
});
