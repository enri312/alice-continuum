import type { CapabilityRegistrySnapshot, CapabilityRisk } from "./capabilities";

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
  provenance: { author: string; origin: "localUser"; createdAt: string; updatedAt: string; parentRevisionId: string | null };
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
  exactKeys(item, ["author", "origin", "createdAt", "updatedAt", "parentRevisionId"], "provenance");
  if (item.origin !== "localUser") fail("provenance.origin debe ser localUser durante R4.1");
  if (item.parentRevisionId !== null && (typeof item.parentRevisionId !== "string" || !uuidV4.test(item.parentRevisionId))) fail("parentRevisionId debe ser UUID v4 o null");
  return {
    author: visibleText(item.author, "provenance.author", 120),
    origin: "localUser",
    createdAt: timestamp(item.createdAt, "provenance.createdAt"),
    updatedAt: timestamp(item.updatedAt, "provenance.updatedAt"),
    parentRevisionId: item.parentRevisionId as string | null,
  };
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
