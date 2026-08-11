import { parseAuditEvent, type AuditEvent } from "./audit";
import type { CapabilityRegistrySnapshot, CapabilityRisk } from "./capabilities";

export const PROCEDURE_CANDIDATE_SCHEMA_VERSION = 1 as const;
export type ProcedureVariationDimension = "durationMs" | "subjectDigest";

export type ProcedureCandidate = {
  schemaVersion: typeof PROCEDURE_CANDIDATE_SCHEMA_VERSION;
  candidateId: string;
  generatedAt: string;
  method: "r5AuditedRepetitionV1";
  status: "proposed";
  title: string;
  purpose: string;
  suggestedSkillId: string;
  declaredRisk: CapabilityRisk;
  policy: {
    proposalOnly: true;
    autoActivation: false;
    executionEnabled: false;
    writesDurableMemory: false;
  };
  steps: {
    id: string;
    position: number;
    capabilityId: string;
    operation: string;
  }[];
  occurrences: {
    operationId: string;
    evidence: { stepId: string; eventId: string }[];
  }[];
  variations: {
    stepId: string;
    dimension: ProcedureVariationDimension;
    distinctValues: number;
  }[];
};

const candidateKeys = ["schemaVersion", "candidateId", "generatedAt", "method", "status", "title", "purpose", "suggestedSkillId", "declaredRisk", "policy", "steps", "occurrences", "variations"];
const policyKeys = ["proposalOnly", "autoActivation", "executionEnabled", "writesDurableMemory"];
const stepKeys = ["id", "position", "capabilityId", "operation"];
const occurrenceKeys = ["operationId", "evidence"];
const evidenceKeys = ["stepId", "eventId"];
const variationKeys = ["stepId", "dimension", "distinctValues"];
const risks: CapabilityRisk[] = ["none", "low", "medium", "high", "critical"];
const riskRank: Record<CapabilityRisk, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const localId = /^[a-z](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const skillId = /^local\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?)*$/;

function fail(message: string): never {
  throw new Error(`Candidato R5 inválido: ${message}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], field: string) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) fail(`${field} tiene campos ausentes o desconocidos`);
}

function visibleText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) fail(`${field} debe ser texto visible de hasta ${maximum} caracteres`);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) fail(`${field} debe ser un entero positivo`);
  return value;
}

function parseTimestamp(value: unknown): string {
  const parsed = visibleText(value, "generatedAt", 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(parsed) || Number.isNaN(Date.parse(parsed))) fail("generatedAt debe ser ISO-8601");
  return parsed;
}

function variationKey(stepId: string, dimension: ProcedureVariationDimension, distinctValues: number) {
  return `${stepId}\u0000${dimension}\u0000${distinctValues}`;
}

export function parseProcedureCandidate(
  value: unknown,
  registry: CapabilityRegistrySnapshot,
  auditEvents: AuditEvent[],
): ProcedureCandidate {
  const candidate = record(value, "candidate");
  exactKeys(candidate, candidateKeys, "candidate");
  if (candidate.schemaVersion !== 1 || candidate.method !== "r5AuditedRepetitionV1" || candidate.status !== "proposed") fail("versión, método o estado no admitido");
  if (typeof candidate.candidateId !== "string" || !uuidV4.test(candidate.candidateId)) fail("candidateId debe ser UUID v4");
  const generatedAt = parseTimestamp(candidate.generatedAt);
  const title = visibleText(candidate.title, "title", 120);
  const purpose = visibleText(candidate.purpose, "purpose", 600);
  if (typeof candidate.suggestedSkillId !== "string" || !skillId.test(candidate.suggestedSkillId)) fail("suggestedSkillId no tiene formato local.*");
  if (!risks.includes(candidate.declaredRisk as CapabilityRisk)) fail("declaredRisk es desconocido");
  const declaredRisk = candidate.declaredRisk as CapabilityRisk;

  const policy = record(candidate.policy, "policy");
  exactKeys(policy, policyKeys, "policy");
  if (policy.proposalOnly !== true || policy.autoActivation !== false || policy.executionEnabled !== false || policy.writesDurableMemory !== false) fail("la política debe ser sólo propuesta y sin efectos");

  if (!Array.isArray(candidate.steps) || candidate.steps.length < 2 || candidate.steps.length > 16) fail("steps debe contener entre 2 y 16 pasos");
  const capabilities = new Map(registry.capabilities.map((capability) => [capability.id, capability]));
  const stepIds = new Set<string>();
  let maximumRisk = 0;
  const steps = candidate.steps.map((raw, index) => {
    const step = record(raw, `steps[${index}]`);
    exactKeys(step, stepKeys, `steps[${index}]`);
    if (typeof step.id !== "string" || !localId.test(step.id) || stepIds.has(step.id)) fail(`steps[${index}].id es inválido o repetido`);
    stepIds.add(step.id);
    if (step.position !== index + 1) fail("las posiciones deben ser consecutivas desde 1");
    const capability = typeof step.capabilityId === "string" ? capabilities.get(step.capabilityId) : undefined;
    if (!capability || capability.maturity === "planned") fail(`steps[${index}] no referencia una capacidad ejecutable registrada`);
    if (typeof step.operation !== "string" || !capability.operations.includes(step.operation)) fail(`steps[${index}] usa una operación no registrada`);
    maximumRisk = Math.max(maximumRisk, riskRank[capability.risk]);
    return { id: step.id, position: index + 1, capabilityId: step.capabilityId as string, operation: step.operation };
  });
  if (riskRank[declaredRisk] < maximumRisk) fail("declaredRisk es menor que el riesgo observado");

  const parsedAudit = auditEvents.map(parseAuditEvent);
  const eventsById = new Map<string, AuditEvent>();
  for (const event of parsedAudit) {
    if (eventsById.has(event.eventId)) fail(`el evento ${event.eventId} está repetido`);
    eventsById.set(event.eventId, event);
  }
  if (!Array.isArray(candidate.occurrences) || candidate.occurrences.length < 3 || candidate.occurrences.length > 32) fail("occurrences debe contener entre 3 y 32 ejecuciones");
  const occurrenceIds = new Set<string>();
  const usedEvents = new Set<string>();
  const evidenceByStep = new Map(steps.map((step) => [step.id, [] as AuditEvent[]]));
  const occurrences = candidate.occurrences.map((raw, occurrenceIndex) => {
    const occurrence = record(raw, `occurrences[${occurrenceIndex}]`);
    exactKeys(occurrence, occurrenceKeys, `occurrences[${occurrenceIndex}]`);
    if (typeof occurrence.operationId !== "string" || !uuidV4.test(occurrence.operationId) || occurrenceIds.has(occurrence.operationId)) fail(`occurrences[${occurrenceIndex}].operationId es inválido o repetido`);
    occurrenceIds.add(occurrence.operationId);
    if (!Array.isArray(occurrence.evidence) || occurrence.evidence.length !== steps.length) fail("cada ocurrencia requiere una evidencia por paso");
    let previousTimestamp = 0;
    const evidence = occurrence.evidence.map((rawEvidence, evidenceIndex) => {
      const reference = record(rawEvidence, `occurrences[${occurrenceIndex}].evidence[${evidenceIndex}]`);
      exactKeys(reference, evidenceKeys, `occurrences[${occurrenceIndex}].evidence[${evidenceIndex}]`);
      const step = steps[evidenceIndex];
      if (reference.stepId !== step.id || typeof reference.eventId !== "string" || !uuidV4.test(reference.eventId)) fail("la evidencia no conserva el orden de steps");
      if (usedEvents.has(reference.eventId)) fail(`el evento ${reference.eventId} fue reutilizado`);
      usedEvents.add(reference.eventId);
      const event = eventsById.get(reference.eventId);
      if (!event
        || event.operationId !== occurrence.operationId
        || event.capabilityId !== step.capabilityId
        || event.operation !== step.operation
        || !["capability", "memory", "cloud"].includes(event.source)
        || event.stage !== "execution"
        || event.outcome !== "success"
        || event.decision !== null) fail(`el evento ${reference.eventId} no es evidencia productora exitosa`);
      if (event.timestampMs < previousTimestamp) fail("la evidencia no respeta el orden temporal");
      previousTimestamp = event.timestampMs;
      evidenceByStep.get(step.id)?.push(event);
      return { stepId: step.id, eventId: reference.eventId };
    });
    return { operationId: occurrence.operationId, evidence };
  });

  if (!Array.isArray(candidate.variations)) fail("variations debe ser una lista");
  const actualVariations = new Set<string>();
  const variations = candidate.variations.map((raw, index) => {
    const variation = record(raw, `variations[${index}]`);
    exactKeys(variation, variationKeys, `variations[${index}]`);
    if (typeof variation.stepId !== "string" || !stepIds.has(variation.stepId)) fail(`variations[${index}].stepId es desconocido`);
    if (variation.dimension !== "durationMs" && variation.dimension !== "subjectDigest") fail(`variations[${index}].dimension es desconocida`);
    const distinctValues = positiveInteger(variation.distinctValues, `variations[${index}].distinctValues`);
    if (distinctValues < 2 || distinctValues > occurrences.length) fail(`variations[${index}].distinctValues está fuera de rango`);
    const key = variationKey(variation.stepId, variation.dimension, distinctValues);
    if (actualVariations.has(key)) fail("variations contiene duplicados");
    actualVariations.add(key);
    return { stepId: variation.stepId, dimension: variation.dimension, distinctValues } as ProcedureCandidate["variations"][number];
  });

  const expectedVariations = new Set<string>();
  for (const step of steps) {
    const events = evidenceByStep.get(step.id) ?? [];
    const durations = new Set(events.map((event) => event.durationMs));
    const digests = new Set(events.map((event) => event.subjectDigest));
    if (durations.size > 1) expectedVariations.add(variationKey(step.id, "durationMs", durations.size));
    if (digests.size > 1) expectedVariations.add(variationKey(step.id, "subjectDigest", digests.size));
  }
  if (actualVariations.size !== expectedVariations.size || [...actualVariations].some((key) => !expectedVariations.has(key))) fail("variations no coincide exactamente con R3");

  return {
    schemaVersion: 1,
    candidateId: candidate.candidateId,
    generatedAt,
    method: "r5AuditedRepetitionV1",
    status: "proposed",
    title,
    purpose,
    suggestedSkillId: candidate.suggestedSkillId,
    declaredRisk,
    policy: { proposalOnly: true, autoActivation: false, executionEnabled: false, writesDurableMemory: false },
    steps,
    occurrences,
    variations,
  };
}
