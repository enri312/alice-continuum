import type {
  CapabilityEffect,
  CapabilityHealthStatus,
  CapabilityMaturity,
  CapabilityPermissionEnforcer,
  CapabilityPermissionMode,
  CapabilityRegistrySnapshot,
  CapabilityRisk,
  CapabilityState,
} from "./capabilities";

export const SKILL_MANIFEST_SCHEMA_VERSION = 1 as const;
export type SkillStatus = "draft" | "inReview" | "approved" | "disabled" | "retired";
export type SkillValueKind = "text" | "number" | "boolean" | "path";
export type SkillStepKind = "manual" | "capability";
export type SkillPreconditionKind = "manualConfirmation" | "inputPresent" | "capabilityAvailable";
export type SkillSuccessCheckKind = "manualConfirmation" | "outputPresent" | "capabilityHealthy";

export type SkillManifest = {
  schemaVersion: typeof SKILL_MANIFEST_SCHEMA_VERSION;
  skillId: string;
  version: number;
  revisionId: string;
  title: string;
  description: string;
  purpose: string;
  provenance: {
    author: string;
    origin: "localUser";
    createdAt: string;
    updatedAt: string;
    parentRevisionId: string | null;
    procedure?: { decisionId: string; candidateId: string; fingerprint: string; candidateSha256: string };
  };
  status: SkillStatus;
  declaredRisk: CapabilityRisk;
  execution: { mode: "simulationOnly"; enabled: false; allowNetwork: false; allowProcessLaunch: false; allowLocalWrite: false };
  requiredCapabilities: { capabilityId: string; operations: string[]; reason: string }[];
  inputs: { id: string; label: string; description: string; kind: SkillValueKind; required: boolean; sensitive: boolean }[];
  outputs: { id: string; label: string; description: string; kind: SkillValueKind; sensitive: boolean }[];
  preconditions: { id: string; label: string; description: string; kind: SkillPreconditionKind; reference: string }[];
  steps: { id: string; title: string; description: string; kind: SkillStepKind; capabilityId: string | null; operation: string | null; inputIds: string[] }[];
  successChecks: { id: string; label: string; description: string; kind: SkillSuccessCheckKind; reference: string }[];
};

export const SKILL_DRAFT_STORE_SCHEMA_VERSION = 1 as const;
export type SkillDraftSummary = {
  skillId: string;
  title: string;
  version: number;
  revisionId: string;
  updatedAt: string;
  declaredRisk: CapabilityRisk;
  sha256: string;
  backupAvailable: boolean;
};
export type SkillDraftStoreSnapshot = {
  schemaVersion: typeof SKILL_DRAFT_STORE_SCHEMA_VERSION;
  storagePath: string;
  existed: boolean;
  drafts: SkillDraftSummary[];
};
export type SkillDraftRecord = {
  manifest: SkillManifest;
  sha256: string;
  storagePath: string;
  backupAvailable: boolean;
};
export type SkillDraftSaveInput = { manifest: SkillManifest; expectedRevisionId: string | null };

export const SKILL_LIFECYCLE_SCHEMA_VERSION = 1 as const;
export type SkillLifecycleAction = "submitReview" | "approve" | "disable" | "restore" | "retire";
export type SkillLifecycleTransitionInput = {
  skillId: string;
  expectedRevisionId: string;
  action: SkillLifecycleAction;
  confirmation: { actor: "localOwner"; confirmed: true; expectedSha256: string; reason: string };
};
export type SkillLifecycleSummary = {
  skillId: string;
  title: string;
  version: number;
  revisionId: string;
  status: Exclude<SkillStatus, "draft">;
  updatedAt: string;
  sha256: string;
  revisionCount: number;
  executionEnabled: false;
};
export type SkillLifecycleSnapshot = {
  schemaVersion: typeof SKILL_LIFECYCLE_SCHEMA_VERSION;
  storagePath: string;
  existed: boolean;
  skills: SkillLifecycleSummary[];
};
export type SkillLifecycleRecord = {
  manifest: SkillManifest;
  sha256: string;
  storagePath: string;
  revisionCount: number;
  executionEnabled: false;
};
export type SkillLifecycleTransitionResult = {
  operationId: string;
  action: SkillLifecycleAction;
  manifest: SkillManifest;
  sha256: string;
  storagePath: string;
  revisionCount: number;
  executionEnabled: false;
};

export const SKILL_SIMULATION_SCHEMA_VERSION = 1 as const;
export type SkillSimulationBlockCode = "executionDisabled" | "statusNotApproved" | "inputsNotProvided" | "preconditionsUnevaluated" | "capabilityPlanned" | "capabilityUnavailable" | "capabilityUnhealthy" | "permissionUnavailable";
export type SkillSimulationResult = {
  schemaVersion: typeof SKILL_SIMULATION_SCHEMA_VERSION;
  method: "r4-static-plan-v1";
  generatedAt: string;
  registrySchemaVersion: number;
  manifestSha256: string;
  planSha256: string;
  skill: { skillId: string; version: number; revisionId: string; title: string; status: SkillStatus; declaredRisk: CapabilityRisk };
  inputs: { id: string; label: string; kind: SkillValueKind; required: boolean; sensitive: boolean }[];
  outputs: { id: string; label: string; kind: SkillValueKind; sensitive: boolean }[];
  requiredCapabilities: {
    capabilityId: string;
    label: string;
    maturity: CapabilityMaturity;
    state: CapabilityState;
    health: CapabilityHealthStatus;
    risk: CapabilityRisk;
    operations: string[];
    effects: CapabilityEffect[];
    dataScopes: string[];
    requirements: string[];
    permission: { mode: CapabilityPermissionMode; enforcedBy: CapabilityPermissionEnforcer; requiresUserDecision: boolean; summary: string };
  }[];
  preconditions: { id: string; label: string; kind: SkillPreconditionKind; reference: string; evaluated: false }[];
  steps: { position: number; stepId: string; title: string; kind: SkillStepKind; capabilityId: string | null; operation: string | null; inputIds: string[]; readiness: "available" | "manualReview" | "blocked"; blockCodes: SkillSimulationBlockCode[] }[];
  successChecks: { id: string; label: string; kind: SkillSuccessCheckKind; reference: string; evaluated: false }[];
  blocks: { code: SkillSimulationBlockCode; capabilityId: string | null; stepId: string | null; summary: string }[];
  canExecute: false;
  adapterInvocationCount: 0;
  sideEffectsApplied: false;
};

const manifestKeys = ["schemaVersion", "skillId", "version", "revisionId", "title", "description", "purpose", "provenance", "status", "declaredRisk", "execution", "requiredCapabilities", "inputs", "outputs", "preconditions", "steps", "successChecks"];
const statuses: SkillStatus[] = ["draft", "inReview", "approved", "disabled", "retired"];
const risks: CapabilityRisk[] = ["none", "low", "medium", "high", "critical"];
const valueKinds: SkillValueKind[] = ["text", "number", "boolean", "path"];
const preconditionKinds: SkillPreconditionKind[] = ["manualConfirmation", "inputPresent", "capabilityAvailable"];
const successKinds: SkillSuccessCheckKind[] = ["manualConfirmation", "outputPresent", "capabilityHealthy"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const localId = /^[a-z](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const skillId = /^local\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]{0,46}[a-z0-9])?)*$/;
const operationId = /^[A-Za-z0-9._-]{1,96}$/;
const sha256 = /^[0-9a-f]{64}$/;
const prefixedSha256 = /^sha256:[0-9a-f]{64}$/;
const capabilityMaturities: CapabilityMaturity[] = ["implemented", "partial", "planned"];
const capabilityStates: CapabilityState[] = ["unavailable", "disabled", "idle", "active", "degraded", "error"];
const capabilityHealth: CapabilityHealthStatus[] = ["unchecked", "healthy", "degraded", "unavailable", "error"];
const capabilityEffects: CapabilityEffect[] = ["none", "localRead", "localWrite", "networkSend", "processLaunch", "windowMetadataRead", "credentialPresenceRead", "assetRender", "cameraObserve", "microphoneObserve"];
const permissionModes: CapabilityPermissionMode[] = ["implicitRead", "sessionOptIn", "explicitPreview", "explicitConfirmation"];
const permissionEnforcers: CapabilityPermissionEnforcer[] = ["native", "currentUi", "operatingSystem", "none"];
const simulationBlockCodes: SkillSimulationBlockCode[] = ["executionDisabled", "statusNotApproved", "inputsNotProvided", "preconditionsUnevaluated", "capabilityPlanned", "capabilityUnavailable", "capabilityUnhealthy", "permissionUnavailable"];
const lifecycleActions: SkillLifecycleAction[] = ["submitReview", "approve", "disable", "restore", "retire"];

function fail(message: string): never {
  throw new Error(`Manifiesto de habilidad inválido: ${message}`);
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

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(`${field} contiene un valor desconocido`);
  return value as T;
}

function timestamp(value: unknown, field: string): string {
  const parsed = visibleText(value, field, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(parsed) || Number.isNaN(Date.parse(parsed))) fail(`${field} debe ser ISO-8601`);
  return parsed;
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !localId.test(value)) fail(`${field} no tiene formato canónico`);
  return value;
}

function unique<T>(values: T[], key: (value: T) => string, field: string) {
  const keys = values.map(key);
  if (new Set(keys).size !== keys.length) fail(`${field} contiene identificadores repetidos`);
}

function textList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) fail(`${field} debe ser una lista de textos`);
  if (new Set(value).size !== value.length) fail(`${field} contiene duplicados`);
  return [...value] as string[];
}

function parseProvenance(value: unknown): SkillManifest["provenance"] {
  const item = record(value, "provenance");
  const baseKeys = ["author", "origin", "createdAt", "updatedAt", "parentRevisionId"];
  exactKeys(item, "procedure" in item ? [...baseKeys, "procedure"] : baseKeys, "provenance");
  if (item.origin !== "localUser") fail("provenance.origin debe ser localUser durante R4.1");
  if (item.parentRevisionId !== null && (typeof item.parentRevisionId !== "string" || !uuidV4.test(item.parentRevisionId))) fail("parentRevisionId debe ser UUID v4 o null");
  const parsed: SkillManifest["provenance"] = {
    author: visibleText(item.author, "provenance.author", 120),
    origin: "localUser",
    createdAt: timestamp(item.createdAt, "provenance.createdAt"),
    updatedAt: timestamp(item.updatedAt, "provenance.updatedAt"),
    parentRevisionId: item.parentRevisionId as string | null,
  };
  if ("procedure" in item) {
    const procedure = record(item.procedure, "provenance.procedure");
    exactKeys(procedure, ["decisionId", "candidateId", "fingerprint", "candidateSha256"], "provenance.procedure");
    if (typeof procedure.decisionId !== "string" || !uuidV4.test(procedure.decisionId) || typeof procedure.candidateId !== "string" || !uuidV4.test(procedure.candidateId)) fail("provenance.procedure requiere UUID v4");
    if (typeof procedure.fingerprint !== "string" || !prefixedSha256.test(procedure.fingerprint) || typeof procedure.candidateSha256 !== "string" || !prefixedSha256.test(procedure.candidateSha256)) fail("provenance.procedure requiere SHA-256 canónicos");
    parsed.procedure = { decisionId: procedure.decisionId, candidateId: procedure.candidateId, fingerprint: procedure.fingerprint, candidateSha256: procedure.candidateSha256 };
  }
  return parsed;
}

function parseExecution(value: unknown): SkillManifest["execution"] {
  const item = record(value, "execution");
  exactKeys(item, ["mode", "enabled", "allowNetwork", "allowProcessLaunch", "allowLocalWrite"], "execution");
  if (item.mode !== "simulationOnly" || item.enabled !== false || item.allowNetwork !== false || item.allowProcessLaunch !== false || item.allowLocalWrite !== false) {
    fail("R4.1 exige simulationOnly, desactivada y sin efectos externos");
  }
  return item as SkillManifest["execution"];
}

function parseRequirements(value: unknown): SkillManifest["requiredCapabilities"] {
  if (!Array.isArray(value) || value.length > 24) fail("requiredCapabilities debe ser una lista de hasta 24 capacidades");
  const items = value.map((raw, index) => {
    const item = record(raw, `requiredCapabilities[${index}]`);
    exactKeys(item, ["capabilityId", "operations", "reason"], `requiredCapabilities[${index}]`);
    const operations = textList(item.operations, `requiredCapabilities[${index}].operations`);
    if (!operations.length || operations.some((operation) => !operationId.test(operation))) fail(`requiredCapabilities[${index}].operations no es válida`);
    return { capabilityId: visibleText(item.capabilityId, `requiredCapabilities[${index}].capabilityId`, 128), operations, reason: visibleText(item.reason, `requiredCapabilities[${index}].reason`, 300) };
  });
  unique(items, (item) => item.capabilityId, "requiredCapabilities");
  return items;
}

function parseInputs(value: unknown): SkillManifest["inputs"] {
  if (!Array.isArray(value) || value.length > 32) fail("inputs debe ser una lista de hasta 32 entradas");
  const items = value.map((raw, index) => {
    const item = record(raw, `inputs[${index}]`);
    exactKeys(item, ["id", "label", "description", "kind", "required", "sensitive"], `inputs[${index}]`);
    const parsed = { id: identifier(item.id, `inputs[${index}].id`), label: visibleText(item.label, `inputs[${index}].label`, 120), description: visibleText(item.description, `inputs[${index}].description`, 400), kind: enumValue(item.kind, valueKinds, `inputs[${index}].kind`), required: item.required, sensitive: item.sensitive };
    if (typeof parsed.required !== "boolean" || typeof parsed.sensitive !== "boolean") fail(`inputs[${index}] requiere booleanos`);
    if (parsed.kind === "path" && !parsed.sensitive) fail(`inputs[${index}] de tipo path debe ser sensitive`);
    return parsed as SkillManifest["inputs"][number];
  });
  unique(items, (item) => item.id, "inputs");
  return items;
}

function parseOutputs(value: unknown): SkillManifest["outputs"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) fail("outputs debe contener entre 1 y 32 resultados");
  const items = value.map((raw, index) => {
    const item = record(raw, `outputs[${index}]`);
    exactKeys(item, ["id", "label", "description", "kind", "sensitive"], `outputs[${index}]`);
    const parsed = { id: identifier(item.id, `outputs[${index}].id`), label: visibleText(item.label, `outputs[${index}].label`, 120), description: visibleText(item.description, `outputs[${index}].description`, 400), kind: enumValue(item.kind, valueKinds, `outputs[${index}].kind`), sensitive: item.sensitive };
    if (typeof parsed.sensitive !== "boolean") fail(`outputs[${index}].sensitive debe ser booleano`);
    if (parsed.kind === "path" && !parsed.sensitive) fail(`outputs[${index}] de tipo path debe ser sensitive`);
    return parsed as SkillManifest["outputs"][number];
  });
  unique(items, (item) => item.id, "outputs");
  return items;
}

function parsePreconditions(value: unknown): SkillManifest["preconditions"] {
  if (!Array.isArray(value) || value.length > 32) fail("preconditions debe ser una lista de hasta 32 elementos");
  const items = value.map((raw, index) => {
    const item = record(raw, `preconditions[${index}]`);
    exactKeys(item, ["id", "label", "description", "kind", "reference"], `preconditions[${index}]`);
    return { id: identifier(item.id, `preconditions[${index}].id`), label: visibleText(item.label, `preconditions[${index}].label`, 120), description: visibleText(item.description, `preconditions[${index}].description`, 400), kind: enumValue(item.kind, preconditionKinds, `preconditions[${index}].kind`), reference: visibleText(item.reference, `preconditions[${index}].reference`, 128) };
  });
  unique(items, (item) => item.id, "preconditions");
  return items;
}

function parseSteps(value: unknown): SkillManifest["steps"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) fail("steps debe contener entre 1 y 64 pasos visibles");
  const items = value.map((raw, index) => {
    const item = record(raw, `steps[${index}]`);
    exactKeys(item, ["id", "title", "description", "kind", "capabilityId", "operation", "inputIds"], `steps[${index}]`);
    const kind = enumValue(item.kind, ["manual", "capability"] as const, `steps[${index}].kind`);
    const capabilityId = item.capabilityId === null ? null : visibleText(item.capabilityId, `steps[${index}].capabilityId`, 128);
    const operation = item.operation === null ? null : visibleText(item.operation, `steps[${index}].operation`, 96);
    if ((kind === "manual" && (capabilityId !== null || operation !== null)) || (kind === "capability" && (!capabilityId || !operation || !operationId.test(operation)))) fail(`steps[${index}] no respeta su tipo`);
    return { id: identifier(item.id, `steps[${index}].id`), title: visibleText(item.title, `steps[${index}].title`, 120), description: visibleText(item.description, `steps[${index}].description`, 500), kind, capabilityId, operation, inputIds: textList(item.inputIds, `steps[${index}].inputIds`) };
  });
  unique(items, (item) => item.id, "steps");
  return items;
}

function parseSuccessChecks(value: unknown): SkillManifest["successChecks"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) fail("successChecks debe contener entre 1 y 32 comprobaciones");
  const items = value.map((raw, index) => {
    const item = record(raw, `successChecks[${index}]`);
    exactKeys(item, ["id", "label", "description", "kind", "reference"], `successChecks[${index}]`);
    return { id: identifier(item.id, `successChecks[${index}].id`), label: visibleText(item.label, `successChecks[${index}].label`, 120), description: visibleText(item.description, `successChecks[${index}].description`, 400), kind: enumValue(item.kind, successKinds, `successChecks[${index}].kind`), reference: visibleText(item.reference, `successChecks[${index}].reference`, 128) };
  });
  unique(items, (item) => item.id, "successChecks");
  return items;
}

export function parseSkillManifest(value: unknown, registry: CapabilityRegistrySnapshot): SkillManifest {
  const item = record(value, "manifest");
  exactKeys(item, manifestKeys, "manifest");
  if (item.schemaVersion !== 1 || !Number.isInteger(item.version) || (item.version as number) < 1) fail("schemaVersion o version no es válida");
  if (typeof item.skillId !== "string" || !skillId.test(item.skillId) || item.skillId.length > 96) fail("skillId debe usar el espacio local y formato canónico");
  if (typeof item.revisionId !== "string" || !uuidV4.test(item.revisionId)) fail("revisionId debe ser UUID v4 canónico");
  const provenance = parseProvenance(item.provenance);
  if (provenance.parentRevisionId === item.revisionId) fail("parentRevisionId no puede ser igual a revisionId");
  const requiredCapabilities = parseRequirements(item.requiredCapabilities);
  const inputs = parseInputs(item.inputs);
  const outputs = parseOutputs(item.outputs);
  const preconditions = parsePreconditions(item.preconditions);
  const steps = parseSteps(item.steps);
  const successChecks = parseSuccessChecks(item.successChecks);
  const status = enumValue(item.status, statuses, "status");
  const declaredRisk = enumValue(item.declaredRisk, risks, "declaredRisk");
  const registryById = new Map(registry.capabilities.map((capability) => [capability.id, capability]));
  const declared = new Set<string>();
  let maximumRisk = 0;
  for (const requirement of requiredCapabilities) {
    const capability = registryById.get(requirement.capabilityId);
    if (!capability) fail(`la capacidad '${requirement.capabilityId}' no está registrada en R1`);
    maximumRisk = Math.max(maximumRisk, risks.indexOf(capability.risk));
    for (const operation of requirement.operations) {
      if (!capability.operations.includes(operation)) fail(`la operación '${operation}' no pertenece a '${capability.id}'`);
      declared.add(`${capability.id}\0${operation}`);
    }
    if (status === "approved" && capability.maturity === "planned") fail(`una habilidad aprobada no puede depender de '${capability.id}' planificada`);
  }
  if (risks.indexOf(declaredRisk) < maximumRisk) fail("declaredRisk no puede ser menor que el riesgo de sus capacidades");
  const inputIds = new Set(inputs.map((input) => input.id));
  const outputIds = new Set(outputs.map((output) => output.id));
  const capabilityIds = new Set(requiredCapabilities.map((requirement) => requirement.capabilityId));
  const used = new Set<string>();
  for (const step of steps) {
    if (new Set(step.inputIds).size !== step.inputIds.length || step.inputIds.some((id) => !inputIds.has(id))) fail(`el paso '${step.id}' contiene inputIds inválidos`);
    if (step.kind === "capability") {
      const key = `${step.capabilityId}\0${step.operation}`;
      if (!declared.has(key)) fail(`el paso '${step.id}' usa una capacidad u operación no declarada`);
      used.add(key);
    }
  }
  if (used.size !== declared.size || [...declared].some((entry) => !used.has(entry))) fail("requiredCapabilities contiene privilegios no utilizados");
  for (const condition of preconditions) {
    const valid = condition.kind === "manualConfirmation" ? condition.reference === "user" : condition.kind === "inputPresent" ? inputIds.has(condition.reference) : capabilityIds.has(condition.reference);
    if (!valid) fail(`la precondición '${condition.id}' tiene una referencia inválida`);
  }
  for (const check of successChecks) {
    const valid = check.kind === "manualConfirmation" ? check.reference === "user" : check.kind === "outputPresent" ? outputIds.has(check.reference) : capabilityIds.has(check.reference);
    if (!valid) fail(`la comprobación '${check.id}' tiene una referencia inválida`);
  }
  return {
    schemaVersion: 1,
    skillId: item.skillId,
    version: item.version as number,
    revisionId: item.revisionId,
    title: visibleText(item.title, "title", 120),
    description: visibleText(item.description, "description", 600),
    purpose: visibleText(item.purpose, "purpose", 600),
    provenance,
    status,
    declaredRisk,
    execution: parseExecution(item.execution),
    requiredCapabilities,
    inputs,
    outputs,
    preconditions,
    steps,
    successChecks,
  };
}

export function parseNewSkillDraft(value: unknown, registry: CapabilityRegistrySnapshot): SkillManifest {
  const manifest = parseSkillManifest(value, registry);
  if (manifest.version !== 1 || manifest.status !== "draft" || manifest.provenance.parentRevisionId !== null) fail("una habilidad nueva debe comenzar como draft versión 1 sin padre");
  return manifest;
}

function parseSkillDraftSummary(value: unknown, index: number): SkillDraftSummary {
  const item = record(value, `drafts[${index}]`);
  exactKeys(item, ["skillId", "title", "version", "revisionId", "updatedAt", "declaredRisk", "sha256", "backupAvailable"], `drafts[${index}]`);
  if (typeof item.skillId !== "string" || !skillId.test(item.skillId) || item.skillId.length > 96) fail(`drafts[${index}].skillId no es canónico`);
  if (!Number.isInteger(item.version) || (item.version as number) < 1) fail(`drafts[${index}].version no es válida`);
  if (typeof item.revisionId !== "string" || !uuidV4.test(item.revisionId)) fail(`drafts[${index}].revisionId debe ser UUID v4`);
  if (typeof item.sha256 !== "string" || !sha256.test(item.sha256)) fail(`drafts[${index}].sha256 no es válido`);
  if (typeof item.backupAvailable !== "boolean") fail(`drafts[${index}].backupAvailable debe ser booleano`);
  return {
    skillId: item.skillId,
    title: visibleText(item.title, `drafts[${index}].title`, 120),
    version: item.version as number,
    revisionId: item.revisionId,
    updatedAt: timestamp(item.updatedAt, `drafts[${index}].updatedAt`),
    declaredRisk: enumValue(item.declaredRisk, risks, `drafts[${index}].declaredRisk`),
    sha256: item.sha256,
    backupAvailable: item.backupAvailable,
  };
}

export function parseSkillDraftStoreSnapshot(value: unknown): SkillDraftStoreSnapshot {
  const item = record(value, "skillDraftStore");
  exactKeys(item, ["schemaVersion", "storagePath", "existed", "drafts"], "skillDraftStore");
  if (item.schemaVersion !== SKILL_DRAFT_STORE_SCHEMA_VERSION) fail("skillDraftStore.schemaVersion no es compatible");
  if (typeof item.existed !== "boolean") fail("skillDraftStore.existed debe ser booleano");
  if (!Array.isArray(item.drafts) || item.drafts.length > 128) fail("skillDraftStore.drafts debe contener hasta 128 elementos");
  const drafts = item.drafts.map(parseSkillDraftSummary);
  unique(drafts, (draft) => draft.skillId, "skillDraftStore.drafts");
  if (!item.existed && drafts.length) fail("un almacén inexistente no puede declarar borradores");
  return {
    schemaVersion: SKILL_DRAFT_STORE_SCHEMA_VERSION,
    storagePath: visibleText(item.storagePath, "skillDraftStore.storagePath", 1024),
    existed: item.existed,
    drafts,
  };
}

export function parseSkillDraftRecord(value: unknown, registry: CapabilityRegistrySnapshot): SkillDraftRecord {
  const item = record(value, "skillDraftRecord");
  exactKeys(item, ["manifest", "sha256", "storagePath", "backupAvailable"], "skillDraftRecord");
  const manifest = parseSkillManifest(item.manifest, registry);
  if (manifest.status !== "draft") fail("skillDraftRecord sólo admite status draft");
  if (typeof item.sha256 !== "string" || !sha256.test(item.sha256)) fail("skillDraftRecord.sha256 no es válido");
  if (typeof item.backupAvailable !== "boolean") fail("skillDraftRecord.backupAvailable debe ser booleano");
  return {
    manifest,
    sha256: item.sha256,
    storagePath: visibleText(item.storagePath, "skillDraftRecord.storagePath", 1024),
    backupAvailable: item.backupAvailable,
  };
}

function parseSkillLifecycleSummary(value: unknown, index: number): SkillLifecycleSummary {
  const field = `skillLifecycle.skills[${index}]`;
  const item = record(value, field);
  exactKeys(item, ["skillId", "title", "version", "revisionId", "status", "updatedAt", "sha256", "revisionCount", "executionEnabled"], field);
  if (typeof item.skillId !== "string" || !skillId.test(item.skillId) || item.skillId.length > 96) fail(`${field}.skillId no es canónico`);
  if (!Number.isInteger(item.version) || (item.version as number) < 1) fail(`${field}.version no es válida`);
  if (typeof item.revisionId !== "string" || !uuidV4.test(item.revisionId)) fail(`${field}.revisionId debe ser UUID v4`);
  if (typeof item.sha256 !== "string" || !sha256.test(item.sha256)) fail(`${field}.sha256 no es válido`);
  if (!Number.isInteger(item.revisionCount) || (item.revisionCount as number) < 2 || (item.revisionCount as number) > 512) fail(`${field}.revisionCount no es válido`);
  if (item.executionEnabled !== false) fail(`${field} no puede habilitar ejecución`);
  const status = enumValue(item.status, statuses, `${field}.status`);
  if (status === "draft") fail(`${field}.status no puede ser draft`);
  return {
    skillId: item.skillId,
    title: visibleText(item.title, `${field}.title`, 120),
    version: item.version as number,
    revisionId: item.revisionId,
    status,
    updatedAt: timestamp(item.updatedAt, `${field}.updatedAt`),
    sha256: item.sha256,
    revisionCount: item.revisionCount as number,
    executionEnabled: false,
  };
}

export function parseSkillLifecycleSnapshot(value: unknown): SkillLifecycleSnapshot {
  const item = record(value, "skillLifecycle");
  exactKeys(item, ["schemaVersion", "storagePath", "existed", "skills"], "skillLifecycle");
  if (item.schemaVersion !== SKILL_LIFECYCLE_SCHEMA_VERSION || typeof item.existed !== "boolean" || !Array.isArray(item.skills) || item.skills.length > 128) fail("skillLifecycle no es compatible");
  const skills = item.skills.map(parseSkillLifecycleSummary);
  unique(skills, (skill) => skill.skillId, "skillLifecycle.skills");
  if (!item.existed && skills.length) fail("un ciclo inexistente no puede declarar habilidades");
  return { schemaVersion: 1, storagePath: visibleText(item.storagePath, "skillLifecycle.storagePath", 1024), existed: item.existed, skills };
}

export function parseSkillLifecycleRecord(value: unknown, registry: CapabilityRegistrySnapshot): SkillLifecycleRecord {
  const item = record(value, "skillLifecycleRecord");
  exactKeys(item, ["manifest", "sha256", "storagePath", "revisionCount", "executionEnabled"], "skillLifecycleRecord");
  const manifest = parseSkillManifest(item.manifest, registry);
  if (manifest.status === "draft" || manifest.execution.enabled || item.executionEnabled !== false) fail("skillLifecycleRecord no puede contener un borrador ni ejecución habilitada");
  if (typeof item.sha256 !== "string" || !sha256.test(item.sha256)) fail("skillLifecycleRecord.sha256 no es válido");
  if (!Number.isInteger(item.revisionCount) || (item.revisionCount as number) < 2 || (item.revisionCount as number) > 512) fail("skillLifecycleRecord.revisionCount no es válido");
  return {
    manifest,
    sha256: item.sha256,
    storagePath: visibleText(item.storagePath, "skillLifecycleRecord.storagePath", 1024),
    revisionCount: item.revisionCount as number,
    executionEnabled: false,
  };
}

export function parseSkillLifecycleTransitionResult(value: unknown, registry: CapabilityRegistrySnapshot): SkillLifecycleTransitionResult {
  const item = record(value, "skillLifecycleTransition");
  exactKeys(item, ["operationId", "action", "manifest", "sha256", "storagePath", "revisionCount", "executionEnabled"], "skillLifecycleTransition");
  if (typeof item.operationId !== "string" || !uuidV4.test(item.operationId)) fail("skillLifecycleTransition.operationId debe ser UUID v4");
  const action = enumValue(item.action, lifecycleActions, "skillLifecycleTransition.action");
  const manifest = parseSkillManifest(item.manifest, registry);
  if (manifest.status === "draft" || manifest.execution.enabled || item.executionEnabled !== false) fail("la transición no puede devolver un borrador ni ejecución habilitada");
  if (typeof item.sha256 !== "string" || !sha256.test(item.sha256)) fail("skillLifecycleTransition.sha256 no es válido");
  if (!Number.isInteger(item.revisionCount) || (item.revisionCount as number) < 2 || (item.revisionCount as number) > 512) fail("skillLifecycleTransition.revisionCount no es válido");
  return {
    operationId: item.operationId,
    action,
    manifest,
    sha256: item.sha256,
    storagePath: visibleText(item.storagePath, "skillLifecycleTransition.storagePath", 1024),
    revisionCount: item.revisionCount as number,
    executionEnabled: false,
  };
}

function parseSimulationFields(value: unknown, output: false): SkillSimulationResult["inputs"];
function parseSimulationFields(value: unknown, output: true): SkillSimulationResult["outputs"];
function parseSimulationFields(value: unknown, output: boolean): SkillSimulationResult["inputs"] | SkillSimulationResult["outputs"] {
  const field = output ? "outputs" : "inputs";
  if (!Array.isArray(value) || value.length > 32) fail(`simulation.${field} excede el límite`);
  const parsed = value.map((raw, index) => {
    const item = record(raw, `simulation.${field}[${index}]`);
    exactKeys(item, output ? ["id", "label", "kind", "sensitive"] : ["id", "label", "kind", "required", "sensitive"], `simulation.${field}[${index}]`);
    if (typeof item.sensitive !== "boolean" || (!output && typeof item.required !== "boolean")) fail(`simulation.${field}[${index}] requiere booleanos`);
    const common = { id: identifier(item.id, `simulation.${field}[${index}].id`), label: visibleText(item.label, `simulation.${field}[${index}].label`, 120), kind: enumValue(item.kind, valueKinds, `simulation.${field}[${index}].kind`), sensitive: item.sensitive };
    return output ? common : { ...common, required: item.required as boolean };
  });
  unique(parsed, (item) => item.id, `simulation.${field}`);
  return parsed as SkillSimulationResult["inputs"] | SkillSimulationResult["outputs"];
}

function parseSimulatedCapabilities(value: unknown): SkillSimulationResult["requiredCapabilities"] {
  if (!Array.isArray(value) || value.length > 24) fail("simulation.requiredCapabilities excede el límite");
  const parsed = value.map((raw, index) => {
    const field = `simulation.requiredCapabilities[${index}]`;
    const item = record(raw, field);
    exactKeys(item, ["capabilityId", "label", "maturity", "state", "health", "risk", "operations", "effects", "dataScopes", "requirements", "permission"], field);
    const permission = record(item.permission, `${field}.permission`);
    exactKeys(permission, ["mode", "enforcedBy", "requiresUserDecision", "summary"], `${field}.permission`);
    if (typeof permission.requiresUserDecision !== "boolean") fail(`${field}.permission.requiresUserDecision debe ser booleano`);
    if (!Array.isArray(item.effects)) fail(`${field}.effects debe ser una lista`);
    const effects = item.effects.map((effect) => enumValue(effect, capabilityEffects, `${field}.effects`));
    const operations = textList(item.operations, `${field}.operations`);
    if (!operations.length || operations.some((operation) => !operationId.test(operation))) fail(`${field}.operations no es válida`);
    return {
      capabilityId: visibleText(item.capabilityId, `${field}.capabilityId`, 128),
      label: visibleText(item.label, `${field}.label`, 120),
      maturity: enumValue(item.maturity, capabilityMaturities, `${field}.maturity`),
      state: enumValue(item.state, capabilityStates, `${field}.state`),
      health: enumValue(item.health, capabilityHealth, `${field}.health`),
      risk: enumValue(item.risk, risks, `${field}.risk`),
      operations,
      effects,
      dataScopes: textList(item.dataScopes, `${field}.dataScopes`),
      requirements: textList(item.requirements, `${field}.requirements`),
      permission: {
        mode: enumValue(permission.mode, permissionModes, `${field}.permission.mode`),
        enforcedBy: enumValue(permission.enforcedBy, permissionEnforcers, `${field}.permission.enforcedBy`),
        requiresUserDecision: permission.requiresUserDecision,
        summary: visibleText(permission.summary, `${field}.permission.summary`, 600),
      },
    };
  });
  unique(parsed, (capability) => capability.capabilityId, "simulation.requiredCapabilities");
  return parsed;
}

function parseSimulatedConditions<K extends SkillPreconditionKind | SkillSuccessCheckKind>(value: unknown, field: string, kinds: readonly K[]): { id: string; label: string; kind: K; reference: string; evaluated: false }[] {
  if (!Array.isArray(value) || value.length > 32) fail(`simulation.${field} excede el límite`);
  const parsed = value.map((raw, index) => {
    const item = record(raw, `simulation.${field}[${index}]`);
    exactKeys(item, ["id", "label", "kind", "reference", "evaluated"], `simulation.${field}[${index}]`);
    if (item.evaluated !== false) fail(`simulation.${field}[${index}] no puede aparentar evaluación`);
    return { id: identifier(item.id, `simulation.${field}[${index}].id`), label: visibleText(item.label, `simulation.${field}[${index}].label`, 120), kind: enumValue(item.kind, kinds, `simulation.${field}[${index}].kind`), reference: visibleText(item.reference, `simulation.${field}[${index}].reference`, 128), evaluated: false as const };
  });
  unique(parsed, (condition) => condition.id, `simulation.${field}`);
  return parsed;
}

function parseSimulatedSteps(value: unknown, capabilities: SkillSimulationResult["requiredCapabilities"], inputs: SkillSimulationResult["inputs"]): SkillSimulationResult["steps"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) fail("simulation.steps debe contener entre 1 y 64 pasos");
  const capabilityIds = new Set(capabilities.map((capability) => capability.capabilityId));
  const inputIds = new Set(inputs.map((input) => input.id));
  const parsed = value.map((raw, index) => {
    const field = `simulation.steps[${index}]`;
    const item = record(raw, field);
    exactKeys(item, ["position", "stepId", "title", "kind", "capabilityId", "operation", "inputIds", "readiness", "blockCodes"], field);
    if (item.position !== index + 1) fail(`${field}.position no es consecutiva`);
    const kind = enumValue(item.kind, ["manual", "capability"] as const, `${field}.kind`);
    const capabilityId = item.capabilityId === null ? null : visibleText(item.capabilityId, `${field}.capabilityId`, 128);
    const operation = item.operation === null ? null : visibleText(item.operation, `${field}.operation`, 96);
    if ((kind === "manual" && (capabilityId !== null || operation !== null)) || (kind === "capability" && (!capabilityId || !operation || !capabilityIds.has(capabilityId)))) fail(`${field} no resuelve una capacidad declarada`);
    const referencedInputs = textList(item.inputIds, `${field}.inputIds`);
    if (referencedInputs.some((id) => !inputIds.has(id))) fail(`${field}.inputIds contiene referencias desconocidas`);
    if (!Array.isArray(item.blockCodes)) fail(`${field}.blockCodes debe ser una lista`);
    const blockCodes = item.blockCodes.map((code) => enumValue(code, simulationBlockCodes, `${field}.blockCodes`));
    const readiness = enumValue(item.readiness, ["available", "manualReview", "blocked"] as const, `${field}.readiness`);
    if ((readiness === "blocked") !== (blockCodes.length > 0)) fail(`${field} no coincide con sus bloqueos`);
    return { position: item.position as number, stepId: identifier(item.stepId, `${field}.stepId`), title: visibleText(item.title, `${field}.title`, 120), kind, capabilityId, operation, inputIds: referencedInputs, readiness, blockCodes };
  });
  unique(parsed, (step) => step.stepId, "simulation.steps");
  return parsed;
}

function parseSimulationBlocks(value: unknown): SkillSimulationResult["blocks"] {
  if (!Array.isArray(value) || !value.length || value.length > 256) fail("simulation.blocks debe contener bloqueos explícitos");
  return value.map((raw, index) => {
    const field = `simulation.blocks[${index}]`;
    const item = record(raw, field);
    exactKeys(item, ["code", "capabilityId", "stepId", "summary"], field);
    return {
      code: enumValue(item.code, simulationBlockCodes, `${field}.code`),
      capabilityId: item.capabilityId === null ? null : visibleText(item.capabilityId, `${field}.capabilityId`, 128),
      stepId: item.stepId === null ? null : identifier(item.stepId, `${field}.stepId`),
      summary: visibleText(item.summary, `${field}.summary`, 600),
    };
  });
}

export function parseSkillSimulationResult(value: unknown): SkillSimulationResult {
  const item = record(value, "simulation");
  exactKeys(item, ["schemaVersion", "method", "generatedAt", "registrySchemaVersion", "manifestSha256", "planSha256", "skill", "inputs", "outputs", "requiredCapabilities", "preconditions", "steps", "successChecks", "blocks", "canExecute", "adapterInvocationCount", "sideEffectsApplied"], "simulation");
  if (item.schemaVersion !== SKILL_SIMULATION_SCHEMA_VERSION || item.method !== "r4-static-plan-v1" || item.registrySchemaVersion !== 1) fail("simulation usa una versión o método incompatible");
  if (typeof item.manifestSha256 !== "string" || !sha256.test(item.manifestSha256) || typeof item.planSha256 !== "string" || !sha256.test(item.planSha256)) fail("simulation requiere digests SHA-256 canónicos");
  if (item.canExecute !== false || item.adapterInvocationCount !== 0 || item.sideEffectsApplied !== false) fail("R4.3 no puede declarar ejecución, adaptadores ni efectos");
  const skill = record(item.skill, "simulation.skill");
  exactKeys(skill, ["skillId", "version", "revisionId", "title", "status", "declaredRisk"], "simulation.skill");
  if (typeof skill.skillId !== "string" || !skillId.test(skill.skillId) || !Number.isInteger(skill.version) || (skill.version as number) < 1 || typeof skill.revisionId !== "string" || !uuidV4.test(skill.revisionId)) fail("simulation.skill no tiene identidad canónica");
  const inputs = parseSimulationFields(item.inputs, false);
  const outputs = parseSimulationFields(item.outputs, true);
  const requiredCapabilities = parseSimulatedCapabilities(item.requiredCapabilities);
  const preconditions = parseSimulatedConditions(item.preconditions, "preconditions", preconditionKinds);
  const successChecks = parseSimulatedConditions(item.successChecks, "successChecks", successKinds);
  const steps = parseSimulatedSteps(item.steps, requiredCapabilities, inputs);
  const blocks = parseSimulationBlocks(item.blocks);
  if (!blocks.some((block) => block.code === "executionDisabled" && block.capabilityId === null && block.stepId === null)) fail("simulation debe conservar el bloqueo global de ejecución");
  return {
    schemaVersion: SKILL_SIMULATION_SCHEMA_VERSION,
    method: "r4-static-plan-v1",
    generatedAt: timestamp(item.generatedAt, "simulation.generatedAt"),
    registrySchemaVersion: 1,
    manifestSha256: item.manifestSha256,
    planSha256: item.planSha256,
    skill: { skillId: skill.skillId, version: skill.version as number, revisionId: skill.revisionId, title: visibleText(skill.title, "simulation.skill.title", 120), status: enumValue(skill.status, statuses, "simulation.skill.status"), declaredRisk: enumValue(skill.declaredRisk, risks, "simulation.skill.declaredRisk") },
    inputs,
    outputs,
    requiredCapabilities,
    preconditions,
    steps,
    successChecks,
    blocks,
    canExecute: false,
    adapterInvocationCount: 0,
    sideEffectsApplied: false,
  };
}
