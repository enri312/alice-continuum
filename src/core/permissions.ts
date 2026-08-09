export const PERMISSION_GATEWAY_SCHEMA_VERSION = 1 as const;

export type PermissionMode = "implicitRead" | "oneShot" | "session";
export type PermissionRisk = "none" | "low" | "medium" | "high" | "critical";
export type PermissionEffect =
  | "none"
  | "localRead"
  | "localWrite"
  | "networkSend"
  | "processLaunch"
  | "windowMetadataRead"
  | "cameraObserve"
  | "microphoneObserve"
  | "screenObserve";
export type PermissionResourceKind =
  | "camera"
  | "microphone"
  | "screen"
  | "file"
  | "directory"
  | "networkEndpoint"
  | "process"
  | "window"
  | "memory"
  | "other";
export type PermissionRequestState = "awaitingDecision" | "approved" | "denied" | "cancelled" | "expired";
export type PermissionGrantState = "approved" | "consuming" | "completed" | "error" | "active" | "stopped" | "revoked" | "expired";

export type PermissionResource = {
  kind: PermissionResourceKind;
  stableId: string;
  label: string;
};

export type PreparedPermissionRequest = {
  schemaVersion: typeof PERMISSION_GATEWAY_SCHEMA_VERSION;
  requestId: string;
  idempotencyKey: string;
  capabilityId: string;
  capabilityVersion: number;
  operation: string;
  mode: PermissionMode;
  purpose: string;
  resource: PermissionResource;
  dataScopes: string[];
  effects: PermissionEffect[];
  risk: PermissionRisk;
  createdAt: string;
  decisionExpiresAt: string;
  requestedDurationSeconds: number | null;
  maximumDurationSeconds: number | null;
  executionPlanDigest: string;
  previewDigest: string;
  state: PermissionRequestState;
  summary: string;
  warnings: string[];
};

export type PermissionGrant = {
  schemaVersion: typeof PERMISSION_GATEWAY_SCHEMA_VERSION;
  grantId: string;
  requestId: string;
  previewDigest: string;
  capabilityId: string;
  operation: string;
  mode: PermissionMode;
  issuedAt: string;
  expiresAt: string;
  remainingUses: number | null;
  state: PermissionGrantState;
};

export type PermissionGatewayStatus = {
  schemaVersion: typeof PERMISSION_GATEWAY_SCHEMA_VERSION;
  generatedAt: string;
  policy: {
    denyByDefault: true;
    persistentGrants: false;
    r2DecisionCommandsExposed: false;
    r2ExecutionCommandsExposed: false;
  };
  limits: {
    highRiskDecisionTtlSeconds: 60;
    standardDecisionTtlSeconds: 300;
    maximumSessionDurationSeconds: 300;
  };
  requests: PreparedPermissionRequest[];
  grants: PermissionGrant[];
};

export type PermissionGatewaySource = "native" | "webDevelopment";
export type PermissionGatewayResult = {
  source: PermissionGatewaySource;
  snapshot: PermissionGatewayStatus;
};

export type PrepareForegroundControlPermissionInput = {
  idempotencyKey: string;
  capabilityId: "context.foreground.control";
  operation: "setContextObservationEnabled";
  purpose: string;
  parameters: { enabled: boolean };
};

const modes = ["implicitRead", "oneShot", "session"] as const;
const risks = ["none", "low", "medium", "high", "critical"] as const;
const effects = ["none", "localRead", "localWrite", "networkSend", "processLaunch", "windowMetadataRead", "cameraObserve", "microphoneObserve", "screenObserve"] as const;
const resourceKinds = ["camera", "microphone", "screen", "file", "directory", "networkEndpoint", "process", "window", "memory", "other"] as const;
const requestStates = ["awaitingDecision", "approved", "denied", "cancelled", "expired"] as const;
const grantStates = ["approved", "consuming", "completed", "error", "active", "stopped", "revoked", "expired"] as const;
const requestKeys = ["schemaVersion", "requestId", "idempotencyKey", "capabilityId", "capabilityVersion", "operation", "mode", "purpose", "resource", "dataScopes", "effects", "risk", "createdAt", "decisionExpiresAt", "requestedDurationSeconds", "maximumDurationSeconds", "executionPlanDigest", "previewDigest", "state", "summary", "warnings"] as const;
const grantKeys = ["schemaVersion", "grantId", "requestId", "previewDigest", "capabilityId", "operation", "mode", "issuedAt", "expiresAt", "remainingUses", "state"] as const;

function fail(message: string): never {
  throw new Error(`Gateway de permisos inválido: ${message}`);
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

function enumValue<const T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) fail(`${field} contiene un valor desconocido`);
  return value as T[number];
}

function cleanText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${field} debe ser texto limpio no vacío`);
  }
  return value;
}

function opaqueId(value: unknown, field: string): string {
  const parsed = cleanText(value, field);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(parsed)) fail(`${field} no es un identificador opaco válido`);
  return parsed;
}

function identifier(value: unknown, field: string): string {
  const parsed = cleanText(value, field);
  if (!/^[a-z][A-Za-z0-9]{0,95}$/.test(parsed)) fail(`${field} no es lowerCamelCase`);
  return parsed;
}

function capabilityId(value: unknown): string {
  const parsed = cleanText(value, "capabilityId");
  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(parsed)) fail("capabilityId no es canónico");
  return parsed;
}

function utcTimestamp(value: unknown, field: string): string {
  const parsed = cleanText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    fail(`${field} debe ser UTC ISO-8601`);
  }
  return parsed;
}

function digest(value: unknown, field: string): string {
  const parsed = cleanText(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(parsed)) fail(`${field} debe ser SHA-256 hexadecimal minúsculo`);
  return parsed;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) fail(`${field} debe ser un entero positivo`);
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}

function optionalDuration(value: unknown, field: string): number | null {
  return value === null ? null : positiveInteger(value, field);
}

function textList(value: unknown, field: string, required = false): string[] {
  if (!Array.isArray(value)) fail(`${field} debe ser una lista`);
  const parsed = value.map((item, index) => cleanText(item, `${field}[${index}]`));
  if (required && parsed.length === 0) fail(`${field} requiere al menos un valor`);
  if (new Set(parsed).size !== parsed.length) fail(`${field} no admite duplicados`);
  return parsed;
}

function parseResource(value: unknown): PermissionResource {
  const input = record(value, "resource");
  exactKeys(input, ["kind", "stableId", "label"], "resource");
  return {
    kind: enumValue(input.kind, resourceKinds, "resource.kind"),
    stableId: opaqueId(input.stableId, "resource.stableId"),
    label: cleanText(input.label, "resource.label"),
  };
}

function parsePreparedRequest(value: unknown): PreparedPermissionRequest {
  const input = record(value, "request");
  exactKeys(input, requestKeys, "request");
  if (input.schemaVersion !== PERMISSION_GATEWAY_SCHEMA_VERSION) fail("request.schemaVersion debe ser 1");
  const mode = enumValue(input.mode, modes, "request.mode");
  if (mode === "implicitRead") fail("implicitRead no crea solicitudes");
  const dataScopes = textList(input.dataScopes, "request.dataScopes", true).map((item) => identifier(item, "request.dataScopes"));
  if (!Array.isArray(input.effects) || input.effects.length === 0) fail("request.effects requiere valores");
  const parsedEffects = input.effects.map((effect, index) => enumValue(effect, effects, `request.effects[${index}]`));
  if (new Set(parsedEffects).size !== parsedEffects.length) fail("request.effects no admite duplicados");
  if (parsedEffects.includes("none") && parsedEffects.length !== 1) fail("none no puede combinarse con efectos");
  const requestedDurationSeconds = optionalDuration(input.requestedDurationSeconds, "request.requestedDurationSeconds");
  const maximumDurationSeconds = optionalDuration(input.maximumDurationSeconds, "request.maximumDurationSeconds");
  const risk = enumValue(input.risk, risks, "request.risk");
  const createdAt = utcTimestamp(input.createdAt, "request.createdAt");
  const decisionExpiresAt = utcTimestamp(input.decisionExpiresAt, "request.decisionExpiresAt");
  const decisionTtl = Date.parse(decisionExpiresAt) - Date.parse(createdAt);
  const maximumDecisionTtl = risk === "high" || risk === "critical" ? 60_000 : 300_000;
  if (decisionTtl <= 0 || decisionTtl > maximumDecisionTtl) fail("request.decisionExpiresAt excede el límite de riesgo");
  if (mode === "session") {
    if (requestedDurationSeconds === null || maximumDurationSeconds === null || requestedDurationSeconds > maximumDurationSeconds || maximumDurationSeconds > 300) {
      fail("request.session contiene una duración inválida");
    }
  } else if (requestedDurationSeconds !== null || maximumDurationSeconds !== null) fail("request.oneShot no admite duración");
  return {
    schemaVersion: PERMISSION_GATEWAY_SCHEMA_VERSION,
    requestId: opaqueId(input.requestId, "request.requestId"),
    idempotencyKey: opaqueId(input.idempotencyKey, "request.idempotencyKey"),
    capabilityId: capabilityId(input.capabilityId),
    capabilityVersion: positiveInteger(input.capabilityVersion, "request.capabilityVersion"),
    operation: identifier(input.operation, "request.operation"),
    mode,
    purpose: cleanText(input.purpose, "request.purpose"),
    resource: parseResource(input.resource),
    dataScopes,
    effects: parsedEffects,
    risk,
    createdAt,
    decisionExpiresAt,
    requestedDurationSeconds,
    maximumDurationSeconds,
    executionPlanDigest: digest(input.executionPlanDigest, "request.executionPlanDigest"),
    previewDigest: digest(input.previewDigest, "request.previewDigest"),
    state: enumValue(input.state, requestStates, "request.state"),
    summary: cleanText(input.summary, "request.summary"),
    warnings: textList(input.warnings, "request.warnings"),
  };
}

function parseGrant(value: unknown): PermissionGrant {
  const input = record(value, "grant");
  exactKeys(input, grantKeys, "grant");
  if (input.schemaVersion !== PERMISSION_GATEWAY_SCHEMA_VERSION) fail("grant.schemaVersion debe ser 1");
  const mode = enumValue(input.mode, modes, "grant.mode");
  if (mode === "implicitRead") fail("implicitRead no crea grants");
  const state = enumValue(input.state, grantStates, "grant.state");
  const remainingUses = input.remainingUses === null ? null : nonNegativeInteger(input.remainingUses, "grant.remainingUses");
  if (mode === "session") {
    if (remainingUses !== null) fail("grant.session requiere remainingUses=null");
    if (state === "consuming" || state === "completed") fail("grant.session contiene un estado oneShot");
  } else {
    if (state === "active" || state === "stopped") fail("grant.oneShot contiene un estado session");
    const expectedUses = state === "approved" ? 1 : 0;
    if (remainingUses !== expectedUses) fail(`grant.oneShot requiere remainingUses=${expectedUses}`);
  }
  return {
    schemaVersion: PERMISSION_GATEWAY_SCHEMA_VERSION,
    grantId: opaqueId(input.grantId, "grant.grantId"),
    requestId: opaqueId(input.requestId, "grant.requestId"),
    previewDigest: digest(input.previewDigest, "grant.previewDigest"),
    capabilityId: capabilityId(input.capabilityId),
    operation: identifier(input.operation, "grant.operation"),
    mode,
    issuedAt: utcTimestamp(input.issuedAt, "grant.issuedAt"),
    expiresAt: utcTimestamp(input.expiresAt, "grant.expiresAt"),
    remainingUses,
    state,
  };
}

export function parsePermissionGatewayStatus(value: unknown): PermissionGatewayStatus {
  const input = record(value, "status");
  exactKeys(input, ["schemaVersion", "generatedAt", "policy", "limits", "requests", "grants"], "status");
  if (input.schemaVersion !== PERMISSION_GATEWAY_SCHEMA_VERSION) fail("status.schemaVersion debe ser 1");
  const policy = record(input.policy, "status.policy");
  exactKeys(policy, ["denyByDefault", "persistentGrants", "r2DecisionCommandsExposed", "r2ExecutionCommandsExposed"], "status.policy");
  if (policy.denyByDefault !== true || policy.persistentGrants !== false || policy.r2DecisionCommandsExposed !== false || policy.r2ExecutionCommandsExposed !== false) {
    fail("status.policy contradice los límites de R2");
  }
  const limits = record(input.limits, "status.limits");
  exactKeys(limits, ["highRiskDecisionTtlSeconds", "standardDecisionTtlSeconds", "maximumSessionDurationSeconds"], "status.limits");
  if (limits.highRiskDecisionTtlSeconds !== 60 || limits.standardDecisionTtlSeconds !== 300 || limits.maximumSessionDurationSeconds !== 300) {
    fail("status.limits no coincide con el contrato R2");
  }
  if (!Array.isArray(input.requests) || !Array.isArray(input.grants)) fail("status requiere listas de requests y grants");
  const requests = input.requests.map(parsePreparedRequest);
  const grants = input.grants.map(parseGrant);
  if (new Set(requests.map((request) => request.requestId)).size !== requests.length) fail("requestId repetido");
  if (new Set(grants.map((grant) => grant.grantId)).size !== grants.length) fail("grantId repetido");
  return {
    schemaVersion: PERMISSION_GATEWAY_SCHEMA_VERSION,
    generatedAt: utcTimestamp(input.generatedAt, "status.generatedAt"),
    policy: { denyByDefault: true, persistentGrants: false, r2DecisionCommandsExposed: false, r2ExecutionCommandsExposed: false },
    limits: { highRiskDecisionTtlSeconds: 60, standardDecisionTtlSeconds: 300, maximumSessionDurationSeconds: 300 },
    requests,
    grants,
  };
}

export function createWebDevelopmentPermissionGateway(now = new Date()): PermissionGatewayResult {
  return {
    source: "webDevelopment",
    snapshot: {
      schemaVersion: PERMISSION_GATEWAY_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      policy: { denyByDefault: true, persistentGrants: false, r2DecisionCommandsExposed: false, r2ExecutionCommandsExposed: false },
      limits: { highRiskDecisionTtlSeconds: 60, standardDecisionTtlSeconds: 300, maximumSessionDurationSeconds: 300 },
      requests: [],
      grants: [],
    },
  };
}

export function createForegroundControlPreparation(
  idempotencyKey: string,
  purpose: string,
  enabled: boolean,
): PrepareForegroundControlPermissionInput {
  opaqueId(idempotencyKey, "idempotencyKey");
  cleanText(purpose, "purpose");
  return {
    idempotencyKey,
    capabilityId: "context.foreground.control",
    operation: "setContextObservationEnabled",
    purpose,
    parameters: { enabled },
  };
}
