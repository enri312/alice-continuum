import { describe, expect, it } from "vitest";
import { createWebDevelopmentCapabilityRegistry, parseCapabilityRegistrySnapshot, summarizeCapabilityRegistry } from "./capabilities";

function plannedCapability(id = "perception.camera.observe") {
  return {
    id,
    version: 1,
    label: "Observar cámara local",
    description: "Capacidad futura sin apertura de dispositivos.",
    domain: "perception",
    kind: "observation",
    maturity: "planned",
    adapter: "none",
    operations: ["observeAuthorizedCamera"],
    state: "unavailable",
    risk: "high",
    effects: ["none"],
    dataScopes: ["cameraFrames"],
    requirements: ["Gateway R2"],
    permission: {
      mode: "sessionOptIn",
      enforcedBy: "none",
      summary: "No existe permiso aplicable porque no está implementada.",
    },
    health: {
      status: "unavailable",
      summary: "Sin adaptador ni sonda.",
      checkedAt: null,
    },
    lastExecution: null,
  };
}

function snapshot(capabilities = [plannedCapability()]) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-09T03:00:00Z",
    capabilities,
  };
}

describe("capability registry contract", () => {
  it("acepta un snapshot válido y conserva el dominio de percepción", () => {
    const parsed = parseCapabilityRegistrySnapshot(snapshot());

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.capabilities[0].domain).toBe("perception");
    expect(parsed.capabilities[0].lastExecution).toBeNull();
  });

  it("rechaza versiones de esquema desconocidas", () => {
    expect(() => parseCapabilityRegistrySnapshot({ ...snapshot(), schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it("rechaza identificadores repetidos", () => {
    expect(() => parseCapabilityRegistrySnapshot(snapshot([plannedCapability(), plannedCapability()]))).toThrow(/repetido/);
  });

  it("rechaza una capacidad planificada que aparenta estar activa", () => {
    const capability = { ...plannedCapability(), state: "active" };

    expect(() => parseCapabilityRegistrySnapshot(snapshot([capability]))).toThrow(/planificada/);
  });

  it("rechaza telemetría o campos que el contrato no conoce", () => {
    const capability = { ...plannedCapability(), inventedLatency: 2 };

    expect(() => parseCapabilityRegistrySnapshot(snapshot([capability]))).toThrow(/campos desconocidos/);
  });

  it("marca el fallback vacío como desarrollo web y no como backend real", () => {
    const result = createWebDevelopmentCapabilityRegistry(new Date("2026-08-09T03:00:00Z"));

    expect(result.source).toBe("webDevelopment");
    expect(result.snapshot.capabilities).toEqual([]);
    expect(parseCapabilityRegistrySnapshot(result.snapshot)).toEqual(result.snapshot);
  });

  it("resume solo estados reales sin contar lo planificado como disponible", () => {
    const parsed = parseCapabilityRegistrySnapshot(snapshot([
      plannedCapability(),
      { ...plannedCapability("output.voice.synthesize"), domain: "output" },
    ]));

    expect(summarizeCapabilityRegistry(parsed)).toEqual({ total: 2, available: 0, planned: 2, unhealthy: 0 });
  });
});
