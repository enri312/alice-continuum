import { describe, expect, it } from "vitest";
import { parseCapabilityRegistrySnapshot } from "./capabilities";
import { parseProcedureDetectionSnapshot } from "./procedure-learning";

const registry = parseCapabilityRegistrySnapshot({
  schemaVersion: 1,
  generatedAt: "2026-08-11T13:00:00Z",
  capabilities: [
    { id: "memory.records.read", version: 1, label: "Leer memoria", description: "Lee registros.", domain: "memory", kind: "query", maturity: "implemented", adapter: "memory", operations: ["loadValidatedRecords"], state: "idle", risk: "medium", effects: ["localRead"], dataScopes: [], requirements: [], permission: { mode: "implicitRead", enforcedBy: "native", summary: "Local." }, health: { status: "healthy", summary: "Disponible.", checkedAt: "2026-08-11T13:00:00Z" }, lastExecution: null },
    { id: "cloud.providers.inspect", version: 1, label: "Proveedores", description: "Consulta proveedores.", domain: "cloud", kind: "query", maturity: "implemented", adapter: "cloud", operations: ["cloud_status"], state: "idle", risk: "low", effects: ["credentialPresenceRead"], dataScopes: [], requirements: [], permission: { mode: "implicitRead", enforcedBy: "native", summary: "Local." }, health: { status: "healthy", summary: "Disponible.", checkedAt: "2026-08-11T13:00:00Z" }, lastExecution: null },
  ],
});

function snapshot() {
  return {
    schemaVersion: 1,
    method: "r5-audited-sequence-v1",
    generatedAt: "2026-08-11T13:05:00Z",
    evidenceWindow: "r3-visible-current-v1",
    auditHealthy: true,
    scannedEventCount: 8,
    qualifyingExecutionCount: 6,
    excludedEventCount: 2,
    minimumOccurrences: 3,
    minimumSteps: 2,
    patterns: [{
      fingerprint: `sha256:${"a".repeat(64)}`,
      declaredRisk: "medium",
      steps: [
        { id: "step-01", position: 1, capabilityId: "memory.records.read", operation: "loadValidatedRecords" },
        { id: "step-02", position: 2, capabilityId: "cloud.providers.inspect", operation: "cloud_status" },
      ],
      occurrences: Array.from({ length: 3 }, (_, index) => ({
        operationId: `123e4567-e89b-42d3-a456-42661417410${index}`,
        evidenceEventIds: [`123e4567-e89b-42d3-a456-42661417420${index}`, `123e4567-e89b-42d3-a456-42661417430${index}`],
      })),
      variations: [{ stepId: "step-01", dimension: "durationMs", distinctValues: 3 }],
    }],
    persistenceApplied: false,
    candidateCreated: false,
    executionEnabled: false,
  };
}

describe("parseProcedureDetectionSnapshot", () => {
  it("acepta un patrón reconstruible y conserva todas las barreras", () => {
    const parsed = parseProcedureDetectionSnapshot(snapshot(), registry);
    expect(parsed.patterns).toHaveLength(1);
    expect(parsed.persistenceApplied).toBe(false);
    expect(parsed.candidateCreated).toBe(false);
    expect(parsed.executionEnabled).toBe(false);
  });

  it("acepta honestamente un resultado vacío", () => {
    const empty = { ...snapshot(), scannedEventCount: 4, qualifyingExecutionCount: 0, excludedEventCount: 4, patterns: [] };
    expect(parseProcedureDetectionSnapshot(empty, registry).patterns).toEqual([]);
  });

  it("rechaza conteos, umbrales y política alterados", () => {
    expect(() => parseProcedureDetectionSnapshot({ ...snapshot(), excludedEventCount: 3 }, registry)).toThrow(/conteos/);
    expect(() => parseProcedureDetectionSnapshot({ ...snapshot(), minimumOccurrences: 1 }, registry)).toThrow(/política/);
    expect(() => parseProcedureDetectionSnapshot({ ...snapshot(), candidateCreated: true }, registry)).toThrow(/política/);
  });

  it("rechaza evidencia reutilizada, privilegios desconocidos y campos inventados", () => {
    const reused = structuredClone(snapshot());
    reused.patterns[0].occurrences[1].evidenceEventIds[0] = reused.patterns[0].occurrences[0].evidenceEventIds[0];
    expect(() => parseProcedureDetectionSnapshot(reused, registry)).toThrow(/reutilizado/);
    const unknown = structuredClone(snapshot());
    unknown.patterns[0].steps[0].operation = "invented";
    expect(() => parseProcedureDetectionSnapshot(unknown, registry)).toThrow(/operación/);
    expect(() => parseProcedureDetectionSnapshot({ ...snapshot(), autonomy: 1 }, registry)).toThrow(/campos/);
  });
});
