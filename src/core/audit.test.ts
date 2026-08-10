import { describe, expect, it } from "vitest";
import { auditSizeLabel, parseAuditEvent, parseAuditSnapshot } from "./audit";

const event = {
  schemaVersion: 1,
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  operationId: "123e4567-e89b-42d3-a456-426614174001",
  timestampMs: 1_786_280_000_000,
  source: "system",
  capabilityId: null,
  operation: "process.startup",
  stage: "execution",
  decision: null,
  outcome: "success",
  durationMs: null,
  subjectDigest: null,
  reasonCode: "PROCESS_STARTED",
};

describe("parseAuditSnapshot", () => {
  it("acepta el contrato nativo versionado", () => {
    const snapshot = parseAuditSnapshot({
      schemaVersion: 1,
      healthy: true,
      storagePath: "E:\\Alice Cognitive Core\\data\\audit\\events-v1.jsonl",
      currentBytes: 320,
      rotatedBytes: 0,
      maximumCurrentBytes: 5 * 1024 * 1024,
      totalValidEvents: 1,
      invalidLines: 0,
      events: [event],
    });
    expect(snapshot.events[0].reasonCode).toBe("PROCESS_STARTED");
    expect(snapshot.totalValidEvents).toBe(1);
  });

  it("rechaza versiones, identificadores y métricas inválidas", () => {
    expect(() => parseAuditEvent({ ...event, schemaVersion: 2 })).toThrow();
    expect(() => parseAuditEvent({ ...event, eventId: "inventado" })).toThrow();
    expect(() => parseAuditSnapshot({ schemaVersion: 1, events: [] })).toThrow();
    expect(() => parseAuditEvent({ ...event, message: "contenido privado" })).toThrow();
  });

  it("acepta un flujo de permiso correlacionado sin contenido sensorial", () => {
    const operationId = "123e4567-e89b-42d3-a456-426614174099";
    const permissionEvents = [
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174010", operationId, source: "permission", capabilityId: "perception.camera.observe", operation: "observeAuthorizedCamera", stage: "request", outcome: "pending", reasonCode: "AWAITING_USER_DECISION" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174011", operationId, source: "permission", capabilityId: "perception.camera.observe", operation: "observeAuthorizedCamera", stage: "authorization", decision: "allow", reasonCode: "USER_APPROVED" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174012", operationId, source: "permission", capabilityId: "perception.camera.observe", operation: "observeAuthorizedCamera", stage: "execution", durationMs: 12, reasonCode: "ADAPTER_STARTED" },
    ];

    const parsed = permissionEvents.map(parseAuditEvent);
    expect(parsed.map((item) => item.stage)).toEqual(["request", "authorization", "execution"]);
    expect(new Set(parsed.map((item) => item.operationId))).toEqual(new Set([operationId]));
    expect(parsed.every((item) => item.subjectDigest === null)).toBe(true);
  });

  it("acepta flujos correlacionados de memoria y nube sin contenido privado", () => {
    const memoryOperationId = "123e4567-e89b-42d3-a456-426614174090";
    const cloudOperationId = "123e4567-e89b-42d3-a456-426614174091";
    const digest = `sha256:${"a".repeat(64)}`;
    const events = [
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174020", operationId: memoryOperationId, source: "memory", capabilityId: "memory.records.write", operation: "memory.save", stage: "request", outcome: "pending", subjectDigest: digest, reasonCode: "MEMORY_OPERATION_ACCEPTED" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174021", operationId: memoryOperationId, source: "memory", capabilityId: "memory.records.write", operation: "memory.save", subjectDigest: digest, durationMs: 4, reasonCode: "MEMORY_SAVED" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174022", operationId: cloudOperationId, source: "cloud", capabilityId: "cloud.conversation.send", operation: "cloud.send", stage: "request", outcome: "pending", subjectDigest: digest, reasonCode: "OUTBOUND_REQUEST_ACCEPTED" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174023", operationId: cloudOperationId, source: "cloud", capabilityId: "cloud.conversation.send", operation: "cloud.send", subjectDigest: digest, durationMs: 25, reasonCode: "CLOUD_RESPONSE_RECEIVED" },
    ];

    const parsed = events.map(parseAuditEvent);
    expect(parsed.map((item) => item.source)).toEqual(["memory", "memory", "cloud", "cloud"]);
    expect(new Set(parsed.slice(0, 2).map((item) => item.operationId))).toEqual(new Set([memoryOperationId]));
    expect(new Set(parsed.slice(2).map((item) => item.operationId))).toEqual(new Set([cloudOperationId]));
  });

  it("acepta auditoría de habilidades sin parámetros ni contenido", () => {
    const operationId = "123e4567-e89b-42d3-a456-426614174092";
    const digest = `sha256:${"e".repeat(64)}`;
    const parsed = [
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174030", operationId, source: "skill", operation: "skill.lifecycle.approve", stage: "request", outcome: "pending", subjectDigest: digest, reasonCode: "SKILL_TRANSITION_ACCEPTED" },
      { ...event, eventId: "123e4567-e89b-42d3-a456-426614174031", operationId, source: "skill", operation: "skill.lifecycle.approve", subjectDigest: digest, reasonCode: "SKILL_TRANSITION_COMPLETED" },
    ].map(parseAuditEvent);
    expect(parsed.map((item) => item.source)).toEqual(["skill", "skill"]);
    expect(new Set(parsed.map((item) => item.operationId))).toEqual(new Set([operationId]));
  });

  it("rechaza digests, etapas y capacidades que el contrato Rust rechaza", () => {
    expect(() => parseAuditEvent({ ...event, subjectDigest: "mensaje privado" })).toThrow();
    expect(() => parseAuditEvent({ ...event, capabilityId: "Memory Records" })).toThrow();
    expect(() => parseAuditEvent({ ...event, stage: "request", outcome: "success" })).toThrow();
    expect(() => parseAuditEvent({ ...event, stage: "error", outcome: "success" })).toThrow();
    expect(() => parseAuditEvent({ ...event, durationMs: 86_400_001 })).toThrow();
  });

  it("formatea límites sin ocultar la unidad", () => {
    expect(auditSizeLabel(512)).toBe("512 B");
    expect(auditSizeLabel(1536)).toBe("1.5 KiB");
    expect(auditSizeLabel(5 * 1024 * 1024)).toBe("5.00 MiB");
  });
});
