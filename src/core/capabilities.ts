export const CAPABILITY_REGISTRY_SCHEMA_VERSION = 1 as const;

export type CapabilityDomain = "cloud" | "context" | "perception" | "memory" | "avatar" | "output";
export type CapabilityKind = "observation" | "query" | "mutation" | "export" | "process" | "presentation";
export type CapabilityMaturity = "implemented" | "partial" | "planned";
export type CapabilityState = "unavailable" | "disabled" | "idle" | "active" | "degraded" | "error";
export type CapabilityRisk = "none" | "low" | "medium" | "high" | "critical";
export type CapabilityEffect =
  | "none"
  | "localRead"
  | "localWrite"
  | "networkSend"
  | "processLaunch"
  | "windowMetadataRead"
  | "credentialPresenceRead"
  | "assetRender";
export type CapabilityHealthStatus = "unchecked" | "healthy" | "degraded" | "unavailable" | "error";
export type CapabilityPermissionMode = "implicitRead" | "sessionOptIn" | "explicitPreview" | "explicitConfirmation";
export type CapabilityPermissionEnforcer = "native" | "currentUi" | "operatingSystem" | "none";

export type CapabilityPermission = {
  mode: CapabilityPermissionMode;
  enforcedBy: CapabilityPermissionEnforcer;
  summary: string;
};

export type CapabilityHealth = {
  status: CapabilityHealthStatus;
  summary: string;
  checkedAt: string | null;
};

export type CapabilityDescriptor = {
  id: string;
  version: number;
  label: string;
  description: string;
  domain: CapabilityDomain;
  kind: CapabilityKind;
  maturity: CapabilityMaturity;
  adapter: string;
  operations: string[];
  state: CapabilityState;
  risk: CapabilityRisk;
  effects: CapabilityEffect[];
  dataScopes: string[];
  requirements: string[];
  permission: CapabilityPermission;
  health: CapabilityHealth;
  lastExecution: null;
};

export type CapabilityRegistrySnapshot = {
  schemaVersion: typeof CAPABILITY_REGISTRY_SCHEMA_VERSION;
  generatedAt: string;
  capabilities: CapabilityDescriptor[];
};

export type CapabilityRegistrySource = "native" | "webDevelopment";

export type CapabilityRegistryResult = {
  source: CapabilityRegistrySource;
  snapshot: CapabilityRegistrySnapshot;
};

const domains = ["cloud", "context", "perception", "memory", "avatar", "output"] as const;
const kinds = ["observation", "query", "mutation", "export", "process", "presentation"] as const;
const maturities = ["implemented", "partial", "planned"] as const;
const states = ["unavailable", "disabled", "idle", "active", "degraded", "error"] as const;
const risks = ["none", "low", "medium", "high", "critical"] as const;
const effects = ["none", "localRead", "localWrite", "networkSend", "processLaunch", "windowMetadataRead", "credentialPresenceRead", "assetRender"] as const;
const healthStatuses = ["unchecked", "healthy", "degraded", "unavailable", "error"] as const;
const permissionModes = ["implicitRead", "sessionOptIn", "explicitPreview", "explicitConfirmation"] as const;
const permissionEnforcers = ["native", "currentUi", "operatingSystem", "none"] as const;
const capabilityKeys = ["id", "version", "label", "description", "domain", "kind", "maturity", "adapter", "operations", "state", "risk", "effects", "dataScopes", "requirements", "permission", "health", "lastExecution"];

function fail(message: string): never {
  throw new Error(`Registro de capacidades inválido: ${message}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const expected = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !expected.has(key));
  const missing = keys.filter((key) => !(key in value));
  if (unknown.length) fail(`${field} contiene campos desconocidos: ${unknown.join(", ")}`);
  if (missing.length) fail(`${field} no contiene: ${missing.join(", ")}`);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío`);
  return value;
}

function enumValue<const T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) fail(`${field} contiene un valor desconocido`);
  return value as T[number];
}

function textList(value: unknown, field: string, required = false): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    fail(`${field} debe ser una lista de textos no vacíos`);
  }
  if (required && value.length === 0) fail(`${field} debe contener al menos un valor`);
  return [...value] as string[];
}

function isoTimestamp(value: unknown, field: string): string {
  const timestamp = text(value, field);
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!pattern.test(timestamp) || Number.isNaN(Date.parse(timestamp))) fail(`${field} debe contener una fecha ISO-8601`);
  return timestamp;
}

function nullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : isoTimestamp(value, field);
}

function parsePermission(value: unknown, id: string): CapabilityPermission {
  const permission = record(value, `${id}.permission`);
  exactKeys(permission, ["mode", "enforcedBy", "summary"], `${id}.permission`);
  return {
    mode: enumValue(permission.mode, permissionModes, `${id}.permission.mode`),
    enforcedBy: enumValue(permission.enforcedBy, permissionEnforcers, `${id}.permission.enforcedBy`),
    summary: text(permission.summary, `${id}.permission.summary`),
  };
}

function parseHealth(value: unknown, id: string): CapabilityHealth {
  const health = record(value, `${id}.health`);
  exactKeys(health, ["status", "summary", "checkedAt"], `${id}.health`);
  const parsed: CapabilityHealth = {
    status: enumValue(health.status, healthStatuses, `${id}.health.status`),
    summary: text(health.summary, `${id}.health.summary`),
    checkedAt: nullableTimestamp(health.checkedAt, `${id}.health.checkedAt`),
  };
  if (parsed.status === "unchecked" && parsed.checkedAt !== null) fail(`${id}: salud unchecked no puede tener checkedAt`);
  if (["healthy", "degraded", "error"].includes(parsed.status) && parsed.checkedAt === null) {
    fail(`${id}: la salud ${parsed.status} requiere checkedAt`);
  }
  return parsed;
}

function parseCapability(value: unknown): CapabilityDescriptor {
  const input = record(value, "capability");
  exactKeys(input, capabilityKeys, "capability");
  const id = text(input.id, "capability.id");
  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(id)) fail(`el identificador '${id}' no es válido`);
  if (!Number.isInteger(input.version) || (input.version as number) <= 0) fail(`${id}.version debe ser un entero positivo`);

  const parsed: CapabilityDescriptor = {
    id,
    version: input.version as number,
    label: text(input.label, `${id}.label`),
    description: text(input.description, `${id}.description`),
    domain: enumValue(input.domain, domains, `${id}.domain`),
    kind: enumValue(input.kind, kinds, `${id}.kind`),
    maturity: enumValue(input.maturity, maturities, `${id}.maturity`),
    adapter: text(input.adapter, `${id}.adapter`),
    operations: textList(input.operations, `${id}.operations`, true),
    state: enumValue(input.state, states, `${id}.state`),
    risk: enumValue(input.risk, risks, `${id}.risk`),
    effects: Array.isArray(input.effects)
      ? input.effects.map((effect, index) => enumValue(effect, effects, `${id}.effects[${index}]`))
      : fail(`${id}.effects debe ser una lista`),
    dataScopes: textList(input.dataScopes, `${id}.dataScopes`),
    requirements: textList(input.requirements, `${id}.requirements`),
    permission: parsePermission(input.permission, id),
    health: parseHealth(input.health, id),
    lastExecution: input.lastExecution === null ? null : fail(`${id}.lastExecution debe ser null durante R1`),
  };

  if (!parsed.effects.length) fail(`${id}.effects debe contener al menos un efecto`);
  if (parsed.effects.includes("none") && parsed.effects.length !== 1) fail(`${id} no puede combinar none con otros efectos`);
  if (parsed.maturity === "planned") {
    if (parsed.adapter !== "none" || parsed.state !== "unavailable") fail(`${id}: una capacidad planificada debe usar adapter none y estado unavailable`);
    if (parsed.health.status !== "unavailable" || parsed.health.checkedAt !== null) fail(`${id}: una capacidad planificada debe tener salud unavailable sin sonda`);
  } else if (parsed.adapter === "none") fail(`${id}: una capacidad implementada o parcial requiere un adaptador real`);
  if (parsed.state === "active" && (parsed.health.checkedAt === null || !["healthy", "degraded"].includes(parsed.health.status))) {
    fail(`${id}: una capacidad activa requiere una comprobación real y vigente`);
  }
  if (parsed.state === "degraded" && parsed.health.status !== "degraded") fail(`${id}: el estado degraded requiere salud degraded`);
  if (parsed.state === "error" && parsed.health.status !== "error") fail(`${id}: el estado error requiere salud error`);
  return parsed;
}

export function parseCapabilityRegistrySnapshot(value: unknown): CapabilityRegistrySnapshot {
  const input = record(value, "snapshot");
  exactKeys(input, ["schemaVersion", "generatedAt", "capabilities"], "snapshot");
  if (input.schemaVersion !== CAPABILITY_REGISTRY_SCHEMA_VERSION) {
    fail(`schemaVersion debe ser ${CAPABILITY_REGISTRY_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.capabilities)) fail("capabilities debe ser una lista");
  const capabilities = input.capabilities.map(parseCapability);
  const identifiers = new Set<string>();
  for (const capability of capabilities) {
    if (identifiers.has(capability.id)) fail(`el identificador '${capability.id}' está repetido`);
    identifiers.add(capability.id);
  }
  return {
    schemaVersion: CAPABILITY_REGISTRY_SCHEMA_VERSION,
    generatedAt: isoTimestamp(input.generatedAt, "generatedAt"),
    capabilities,
  };
}

export function createWebDevelopmentCapabilityRegistry(now = new Date()): CapabilityRegistryResult {
  return {
    source: "webDevelopment",
    snapshot: {
      schemaVersion: CAPABILITY_REGISTRY_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      capabilities: [],
    },
  };
}

export type CapabilityRegistrySummary = {
  total: number;
  available: number;
  planned: number;
  unhealthy: number;
};

export function summarizeCapabilityRegistry(snapshot: CapabilityRegistrySnapshot): CapabilityRegistrySummary {
  return snapshot.capabilities.reduce<CapabilityRegistrySummary>((summary, capability) => ({
    total: summary.total + 1,
    available: summary.available + Number(capability.state === "idle" || capability.state === "active"),
    planned: summary.planned + Number(capability.maturity === "planned"),
    unhealthy: summary.unhealthy + Number(capability.state === "degraded" || capability.state === "error"),
  }), { total: 0, available: 0, planned: 0, unhealthy: 0 });
}
