import type { CapabilityRegistrySnapshot, CapabilityRisk } from "./capabilities";
import { parseSkillDraftRecord, type SkillDraftRecord } from "./skills";

export type ProcedurePatternDecision = "retain" | "dismiss";

export type ProcedureDecisionSummary = {
  decisionId: string;
  fingerprint: string;
  action: ProcedurePatternDecision;
  decidedAt: string;
  candidateId: string | null;
  title: string | null;
  suggestedSkillId: string | null;
  declaredRisk: CapabilityRisk | null;
  stepCount: number;
  occurrenceCount: number;
  candidateSha256: string | null;
  executionEnabled: false;
};

export type ProcedureCandidateStoreSnapshot = {
  schemaVersion: 1;
  storagePath: string;
  existed: boolean;
  decisions: ProcedureDecisionSummary[];
  executionEnabled: false;
  skillDraftCreated: false;
};

export type ProcedurePatternDecisionResult = {
  operationId: string;
  decision: ProcedureDecisionSummary;
  storagePath: string;
  executionEnabled: false;
  skillDraftCreated: false;
};

export type ProcedureDraftConversionSummary = {
  fingerprint: string;
  decisionId: string;
  candidateId: string;
  candidateSha256: string;
  skillId: string;
  revisionId: string;
  draftSha256: string;
  updatedAt: string;
  executionEnabled: false;
  approved: false;
};

export type ProcedureDraftConversionSnapshot = {
  schemaVersion: 1;
  conversions: ProcedureDraftConversionSummary[];
  executionEnabled: false;
  automaticApproval: false;
};

export type ProcedureDraftConversionResult = {
  operationId: string;
  sourceFingerprint: string;
  sourceCandidateId: string;
  sourceCandidateSha256: string;
  draft: SkillDraftRecord;
  executionEnabled: false;
  approved: false;
};

const snapshotKeys = ["schemaVersion", "storagePath", "existed", "decisions", "executionEnabled", "skillDraftCreated"];
const decisionKeys = ["decisionId", "fingerprint", "action", "decidedAt", "candidateId", "title", "suggestedSkillId", "declaredRisk", "stepCount", "occurrenceCount", "candidateSha256", "executionEnabled"];
const resultKeys = ["operationId", "decision", "storagePath", "executionEnabled", "skillDraftCreated"];
const conversionKeys = ["fingerprint", "decisionId", "candidateId", "candidateSha256", "skillId", "revisionId", "draftSha256", "updatedAt", "executionEnabled", "approved"];
const conversionSnapshotKeys = ["schemaVersion", "conversions", "executionEnabled", "automaticApproval"];
const conversionResultKeys = ["operationId", "sourceFingerprint", "sourceCandidateId", "sourceCandidateSha256", "draft", "executionEnabled", "approved"];
const risks: CapabilityRisk[] = ["none", "low", "medium", "high", "critical"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
const plainDigest = /^[0-9a-f]{64}$/;
const skillId = /^local\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?)*$/;

function fail(message: string): never {
  throw new Error(`Almacén R5 inválido: ${message}`);
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

function timestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) fail(`${field} debe ser ISO-8601`);
  return value;
}

function nullableText(value: unknown, field: string, maximum: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) fail(`${field} no es texto visible válido`);
  return value;
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(`${field} debe ser entero no negativo`);
  return value;
}

export function parseProcedureDecisionSummary(value: unknown): ProcedureDecisionSummary {
  const decision = record(value, "decision");
  exactKeys(decision, decisionKeys, "decision");
  if (typeof decision.decisionId !== "string" || !uuidV4.test(decision.decisionId)) fail("decisionId debe ser UUID v4");
  if (typeof decision.fingerprint !== "string" || !digest.test(decision.fingerprint)) fail("fingerprint debe ser SHA-256");
  if (decision.action !== "retain" && decision.action !== "dismiss") fail("action es desconocida");
  const decidedAt = timestamp(decision.decidedAt, "decidedAt");
  const candidateId = decision.candidateId === null ? null : typeof decision.candidateId === "string" && uuidV4.test(decision.candidateId) ? decision.candidateId : fail("candidateId no es válido");
  const title = nullableText(decision.title, "title", 120);
  const suggestedSkillId = decision.suggestedSkillId === null ? null : typeof decision.suggestedSkillId === "string" && skillId.test(decision.suggestedSkillId) ? decision.suggestedSkillId : fail("suggestedSkillId no es válido");
  const declaredRisk = decision.declaredRisk === null ? null : risks.includes(decision.declaredRisk as CapabilityRisk) ? decision.declaredRisk as CapabilityRisk : fail("declaredRisk es desconocido");
  const stepCount = count(decision.stepCount, "stepCount");
  const occurrenceCount = count(decision.occurrenceCount, "occurrenceCount");
  const candidateSha256 = decision.candidateSha256 === null ? null : typeof decision.candidateSha256 === "string" && digest.test(decision.candidateSha256) ? decision.candidateSha256 : fail("candidateSha256 no es válido");
  if (decision.executionEnabled !== false) fail("executionEnabled debe permanecer deshabilitado");
  const retained = decision.action === "retain";
  if (retained !== Boolean(candidateId && title && suggestedSkillId && declaredRisk && candidateSha256 && stepCount >= 2 && occurrenceCount >= 3)) fail("los metadatos no coinciden con la decisión");
  if (!retained && (stepCount !== 0 || occurrenceCount !== 0)) fail("dismiss no puede conservar conteos del candidato");
  return { decisionId: decision.decisionId, fingerprint: decision.fingerprint, action: decision.action, decidedAt, candidateId, title, suggestedSkillId, declaredRisk, stepCount, occurrenceCount, candidateSha256, executionEnabled: false };
}

export function parseProcedureCandidateStoreSnapshot(value: unknown): ProcedureCandidateStoreSnapshot {
  const snapshot = record(value, "snapshot");
  exactKeys(snapshot, snapshotKeys, "snapshot");
  if (snapshot.schemaVersion !== 1 || typeof snapshot.storagePath !== "string" || !snapshot.storagePath || typeof snapshot.existed !== "boolean" || snapshot.executionEnabled !== false || snapshot.skillDraftCreated !== false) fail("cabecera o política no admitida");
  if (!Array.isArray(snapshot.decisions) || snapshot.decisions.length > 128) fail("decisions debe ser una lista acotada");
  const decisions = snapshot.decisions.map(parseProcedureDecisionSummary);
  const fingerprints = new Set(decisions.map((decision) => decision.fingerprint));
  if (fingerprints.size !== decisions.length) fail("hay decisiones repetidas para un mismo patrón");
  if (!snapshot.existed && decisions.length) fail("un almacén inexistente no puede contener decisiones");
  return { schemaVersion: 1, storagePath: snapshot.storagePath, existed: snapshot.existed, decisions, executionEnabled: false, skillDraftCreated: false };
}

export function parseProcedurePatternDecisionResult(value: unknown): ProcedurePatternDecisionResult {
  const result = record(value, "result");
  exactKeys(result, resultKeys, "result");
  if (typeof result.operationId !== "string" || !uuidV4.test(result.operationId) || typeof result.storagePath !== "string" || !result.storagePath || result.executionEnabled !== false || result.skillDraftCreated !== false) fail("resultado o política no admitida");
  return { operationId: result.operationId, decision: parseProcedureDecisionSummary(result.decision), storagePath: result.storagePath, executionEnabled: false, skillDraftCreated: false };
}

function parseProcedureDraftConversionSummary(value: unknown): ProcedureDraftConversionSummary {
  const conversion = record(value, "conversion");
  exactKeys(conversion, conversionKeys, "conversion");
  if (typeof conversion.fingerprint !== "string" || !digest.test(conversion.fingerprint) || typeof conversion.candidateSha256 !== "string" || !digest.test(conversion.candidateSha256)) fail("la conversión requiere huellas R5 canónicas");
  if (typeof conversion.decisionId !== "string" || !uuidV4.test(conversion.decisionId) || typeof conversion.candidateId !== "string" || !uuidV4.test(conversion.candidateId) || typeof conversion.revisionId !== "string" || !uuidV4.test(conversion.revisionId)) fail("la conversión requiere UUID v4");
  if (typeof conversion.skillId !== "string" || !skillId.test(conversion.skillId) || typeof conversion.draftSha256 !== "string" || !plainDigest.test(conversion.draftSha256)) fail("la conversión no identifica un borrador R4 válido");
  const updatedAt = timestamp(conversion.updatedAt, "updatedAt");
  if (conversion.executionEnabled !== false || conversion.approved !== false) fail("la conversión no puede ejecutar ni aprobar");
  return { fingerprint: conversion.fingerprint, decisionId: conversion.decisionId, candidateId: conversion.candidateId, candidateSha256: conversion.candidateSha256, skillId: conversion.skillId, revisionId: conversion.revisionId, draftSha256: conversion.draftSha256, updatedAt, executionEnabled: false, approved: false };
}

export function parseProcedureDraftConversionSnapshot(value: unknown): ProcedureDraftConversionSnapshot {
  const snapshot = record(value, "conversionSnapshot");
  exactKeys(snapshot, conversionSnapshotKeys, "conversionSnapshot");
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.conversions) || snapshot.executionEnabled !== false || snapshot.automaticApproval !== false) fail("snapshot de conversiones no admitido");
  const conversions = snapshot.conversions.map(parseProcedureDraftConversionSummary);
  if (new Set(conversions.map((conversion) => conversion.fingerprint)).size !== conversions.length) fail("hay conversiones repetidas para una huella");
  return { schemaVersion: 1, conversions, executionEnabled: false, automaticApproval: false };
}

export function parseProcedureDraftConversionResult(value: unknown, registry: CapabilityRegistrySnapshot): ProcedureDraftConversionResult {
  const result = record(value, "conversionResult");
  exactKeys(result, conversionResultKeys, "conversionResult");
  if (typeof result.operationId !== "string" || !uuidV4.test(result.operationId) || typeof result.sourceFingerprint !== "string" || !digest.test(result.sourceFingerprint) || typeof result.sourceCandidateId !== "string" || !uuidV4.test(result.sourceCandidateId) || typeof result.sourceCandidateSha256 !== "string" || !digest.test(result.sourceCandidateSha256) || result.executionEnabled !== false || result.approved !== false) fail("resultado de conversión no admitido");
  const draft = parseSkillDraftRecord(result.draft, registry);
  const procedure = draft.manifest.provenance.procedure;
  if (!procedure || procedure.fingerprint !== result.sourceFingerprint || procedure.candidateId !== result.sourceCandidateId || procedure.candidateSha256 !== result.sourceCandidateSha256 || draft.manifest.status !== "draft") fail("el borrador no conserva la procedencia R5 exacta");
  return { operationId: result.operationId, sourceFingerprint: result.sourceFingerprint, sourceCandidateId: result.sourceCandidateId, sourceCandidateSha256: result.sourceCandidateSha256, draft, executionEnabled: false, approved: false };
}
