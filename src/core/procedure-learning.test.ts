import { describe, expect, it } from "vitest";
import { parseAuditEvent, type AuditEvent } from "./audit";
import { parseCapabilityRegistrySnapshot } from "./capabilities";
import { parseProcedureCandidate } from "./procedure-learning";

const registry = parseCapabilityRegistrySnapshot({
  schemaVersion: 1,
  generatedAt: "2026-08-11T12:00:00Z",
  capabilities: [
    {
      id: "memory.records.read", version: 1, label: "Leer memoria", description: "Lee registros locales.", domain: "memory", kind: "query", maturity: "implemented", adapter: "memory", operations: ["loadValidatedRecords"], state: "idle", risk: "medium", effects: ["localRead"], dataScopes: ["isolatedFixture"], requirements: [], permission: { mode: "implicitRead", enforcedBy: "native", summary: "Lectura local." }, health: { status: "healthy", summary: "Disponible.", checkedAt: "2026-08-11T12:00:00Z" }, lastExecution: null,
    },
    {
      id: "cloud.providers.inspect", version: 1, label: "Revisar proveedores", description: "Consulta disponibilidad sin revelar claves.", domain: "cloud", kind: "query", maturity: "implemented", adapter: "cloud", operations: ["cloud_status"], state: "idle", risk: "low", effects: ["credentialPresenceRead"], dataScopes: ["providerMetadata"], requirements: [], permission: { mode: "implicitRead", enforcedBy: "native", summary: "Lectura local." }, health: { status: "healthy", summary: "Disponible.", checkedAt: "2026-08-11T12:00:00Z" }, lastExecution: null,
    },
  ],
});

const baseEvent = {
  schemaVersion: 1 as const,
  timestampMs: 1_786_280_000_000,
  stage: "execution" as const,
  decision: null,
  outcome: "success" as const,
  subjectDigest: null,
};

function fixture() {
  const events: AuditEvent[] = [];
  const occurrences = Array.from({ length: 3 }, (_, index) => {
    const suffix = index + 1;
    const operationId = `123e4567-e89b-42d3-a456-42661417410${suffix}`;
    const memory = parseAuditEvent({ ...baseEvent, eventId: `123e4567-e89b-42d3-a456-42661417420${suffix}`, operationId, timestampMs: baseEvent.timestampMs + index * 10, source: "memory", capabilityId: "memory.records.read", operation: "loadValidatedRecords", durationMs: 4 + index, subjectDigest: `sha256:${"a".repeat(64)}`, reasonCode: "MEMORY_READ_COMPLETED" });
    const cloud = parseAuditEvent({ ...baseEvent, eventId: `123e4567-e89b-42d3-a456-42661417430${suffix}`, operationId, timestampMs: baseEvent.timestampMs + index * 10 + 1, source: "cloud", capabilityId: "cloud.providers.inspect", operation: "cloud_status", durationMs: 2, reasonCode: "PROVIDERS_INSPECTED" });
    events.push(memory, cloud);
    return { operationId, evidence: [{ stepId: "leer-memoria", eventId: memory.eventId }, { stepId: "revisar-proveedores", eventId: cloud.eventId }] };
  });
  return {
    events,
    candidate: {
      schemaVersion: 1,
      candidateId: "123e4567-e89b-42d3-a456-426614174000",
      generatedAt: "2026-08-11T12:05:00Z",
      method: "r5AuditedRepetitionV1",
      status: "proposed",
      title: "Revisión local repetida",
      purpose: "Consultar memoria y proveedores de manera visible.",
      suggestedSkillId: "local.revision-repetida",
      declaredRisk: "medium",
      policy: { proposalOnly: true, autoActivation: false, executionEnabled: false, writesDurableMemory: false },
      steps: [
        { id: "leer-memoria", position: 1, capabilityId: "memory.records.read", operation: "loadValidatedRecords" },
        { id: "revisar-proveedores", position: 2, capabilityId: "cloud.providers.inspect", operation: "cloud_status" },
      ],
      occurrences,
      variations: [{ stepId: "leer-memoria", dimension: "durationMs", distinctValues: 3 }],
    },
  };
}

describe("parseProcedureCandidate", () => {
  it("acepta tres ejecuciones R3 correlacionadas y reconstruibles", () => {
    const { candidate, events } = fixture();
    const parsed = parseProcedureCandidate(candidate, registry, events);
    expect(parsed.occurrences).toHaveLength(3);
    expect(parsed.policy.executionEnabled).toBe(false);
    expect(parsed.variations).toEqual([{ stepId: "leer-memoria", dimension: "durationMs", distinctValues: 3 }]);
  });

  it("rechaza una sola aparición, procedimientos triviales y campos inventados", () => {
    const { candidate, events } = fixture();
    expect(() => parseProcedureCandidate({ ...candidate, occurrences: candidate.occurrences.slice(0, 1) }, registry, events)).toThrow(/occurrences/);
    expect(() => parseProcedureCandidate({ ...candidate, steps: candidate.steps.slice(0, 1) }, registry, events)).toThrow(/steps/);
    expect(() => parseProcedureCandidate({ ...candidate, inventedActivity: 99 }, registry, events)).toThrow(/campos/);
  });

  it("rechaza autoactivación, riesgo reducido y capacidades inexistentes", () => {
    const { candidate, events } = fixture();
    expect(() => parseProcedureCandidate({ ...candidate, policy: { ...candidate.policy, autoActivation: true } }, registry, events)).toThrow(/política/);
    expect(() => parseProcedureCandidate({ ...candidate, declaredRisk: "low" }, registry, events)).toThrow(/riesgo/);
    expect(() => parseProcedureCandidate({ ...candidate, steps: [{ ...candidate.steps[0], capabilityId: "memory.invented.read" }, candidate.steps[1]] }, registry, events)).toThrow(/capacidad/);
  });

  it("rechaza evidencia reutilizada, fallida o diferencias no demostradas", () => {
    const { candidate, events } = fixture();
    const reused = structuredClone(candidate);
    reused.occurrences[1].evidence[0].eventId = reused.occurrences[0].evidence[0].eventId;
    expect(() => parseProcedureCandidate(reused, registry, events)).toThrow(/reutilizado/);

    const failed = events.map((event, index) => index === 0 ? { ...event, outcome: "error" as const, stage: "error" as const } : event);
    expect(() => parseProcedureCandidate(candidate, registry, failed)).toThrow(/evidencia productora exitosa/);
    expect(() => parseProcedureCandidate({ ...candidate, variations: [] }, registry, events)).toThrow(/variations/);
  });
});
