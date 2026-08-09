export type AuditSource = "system" | "permission" | "capability" | "memory" | "cloud";
export type AuditStage = "request" | "authorization" | "execution" | "stop" | "revocation" | "block" | "error";
export type AuditDecision = "allow" | "deny" | "cancel";
export type AuditOutcome = "pending" | "success" | "blocked" | "error";

export type AuditEvent = {
  schemaVersion: 1;
  eventId: string;
  operationId: string;
  timestampMs: number;
  source: AuditSource;
  capabilityId: string | null;
  operation: string;
  stage: AuditStage;
  decision: AuditDecision | null;
  outcome: AuditOutcome;
  durationMs: number | null;
  subjectDigest: string | null;
  reasonCode: string;
};

export type AuditSnapshot = {
  schemaVersion: 1;
  healthy: boolean;
  storagePath: string;
  currentBytes: number;
  rotatedBytes: number;
  maximumCurrentBytes: number;
  totalValidEvents: number;
  invalidLines: number;
  events: AuditEvent[];
};

const sources: AuditSource[] = ["system", "permission", "capability", "memory", "cloud"];
const stages: AuditStage[] = ["request", "authorization", "execution", "stop", "revocation", "block", "error"];
const decisions: AuditDecision[] = ["allow", "deny", "cancel"];
const outcomes: AuditOutcome[] = ["pending", "success", "blocked", "error"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseAuditEvent(value: unknown): AuditEvent {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || typeof value.eventId !== "string" || !uuidV4.test(value.eventId)
    || typeof value.operationId !== "string" || !uuidV4.test(value.operationId)
    || !finiteNonNegative(value.timestampMs) || value.timestampMs === 0
    || !sources.includes(value.source as AuditSource)
    || !nullableString(value.capabilityId)
    || typeof value.operation !== "string" || !value.operation
    || !stages.includes(value.stage as AuditStage)
    || !(value.decision === null || decisions.includes(value.decision as AuditDecision))
    || !outcomes.includes(value.outcome as AuditOutcome)
    || !(value.durationMs === null || finiteNonNegative(value.durationMs))
    || !nullableString(value.subjectDigest)
    || typeof value.reasonCode !== "string" || !value.reasonCode) {
    throw new Error("Evento de auditoría R3 inválido");
  }
  return value as AuditEvent;
}

export function parseAuditSnapshot(value: unknown): AuditSnapshot {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || typeof value.healthy !== "boolean"
    || typeof value.storagePath !== "string"
    || !finiteNonNegative(value.currentBytes)
    || !finiteNonNegative(value.rotatedBytes)
    || !finiteNonNegative(value.maximumCurrentBytes)
    || !finiteNonNegative(value.totalValidEvents)
    || !finiteNonNegative(value.invalidLines)
    || !Array.isArray(value.events)) {
    throw new Error("Snapshot de auditoría R3 inválido");
  }
  return { ...value, events: value.events.map(parseAuditEvent) } as AuditSnapshot;
}

export function auditSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
