export const TASK_REGISTRY_SCHEMA_VERSION = 1 as const;

export type TaskRegistryState = "missing" | "ready" | "invalid";
export type TaskKind = "localReminder" | "readOnlyCheck";
export type TaskStatus = "scheduled" | "paused" | "completed" | "cancelled";
export type TaskMutationAction = "scheduleLocalReminder" | "cancelTask";

export type TaskScope = {
  kind: "localNotification" | "capabilityRead";
  capabilityId: string | null;
};

export type TaskRecord = {
  taskId: string;
  title: string;
  kind: TaskKind;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  schedule: { kind: "once"; nextRunAt: string | null };
  scope: TaskScope;
  origin: "ownerConfirmed";
  cancellable: boolean;
};

export type TaskRegistrySnapshot = {
  schemaVersion: typeof TASK_REGISTRY_SCHEMA_VERSION;
  state: TaskRegistryState;
  storageExists: boolean;
  taskCount: number;
  scheduledCount: number;
  pausedCount: number;
  completedCount: number;
  cancelledCount: number;
  tasks: TaskRecord[];
  error: string | null;
  automaticExecution: false;
};

export type TaskMutationPlan = {
  schemaVersion: typeof TASK_REGISTRY_SCHEMA_VERSION;
  planId: string;
  planSha256: string;
  action: TaskMutationAction;
  plannedAt: string;
  taskId: string;
  title: string;
  nextRunAt: string | null;
  scope: TaskScope;
  sourceExists: boolean;
  sourceSha256Before: string | null;
  projectedRevisionId: string;
  projectedSourceSha256: string;
  recordCountBefore: number;
  recordCountAfter: number;
  backupRequired: boolean;
  revisionRequired: boolean;
  auditRequired: boolean;
  writesRequired: boolean;
  automaticExecution: false;
  writesPerformed: false;
};

export type TaskMutationReceipt = {
  schemaVersion: typeof TASK_REGISTRY_SCHEMA_VERSION;
  operationId: string;
  action: TaskMutationAction;
  taskId: string;
  revisionId: string;
  sourceSha256: string;
  recordCount: number;
  backupCreated: boolean;
  revisionWritten: boolean;
  auditWritten: boolean;
  idempotent: boolean;
  automaticExecution: false;
};

function fail(message: string): never {
  throw new Error(`Contrato R7 inválido: ${message}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
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

function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(`${field} debe ser booleano`);
  return value;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(`${field} contiene un valor desconocido`);
  return value as T;
}

function nullableText(value: unknown, field: string): string | null {
  return value === null ? null : text(value, field);
}

function uuid(value: unknown, field: string): string {
  const parsed = text(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(parsed)) fail(`${field} debe ser UUID canónico`);
  return parsed;
}

function sha256(value: unknown, field: string): string {
  const parsed = text(value, field);
  if (!/^sha256:[0-9a-f]{64}$/.test(parsed)) fail(`${field} debe ser SHA-256 canónico`);
  return parsed;
}

function timestamp(value: unknown, field: string): string {
  const parsed = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(parsed) || Number.isNaN(Date.parse(parsed))) fail(`${field} debe usar UTC canónico`);
  return parsed;
}

function parseScope(value: unknown, field: string): TaskScope {
  const source = object(value, field);
  exactKeys(source, ["kind", "capabilityId"], field);
  const kind = oneOf(source.kind, ["localNotification", "capabilityRead"] as const, `${field}.kind`);
  const capabilityId = nullableText(source.capabilityId, `${field}.capabilityId`);
  if ((kind === "localNotification") !== (capabilityId === null)) fail(`${field} tiene alcance incoherente`);
  return { kind, capabilityId };
}

export function parseTaskRecord(value: unknown, field = "task"): TaskRecord {
  const source = object(value, field);
  exactKeys(source, ["taskId", "title", "kind", "status", "createdAt", "updatedAt", "schedule", "scope", "origin", "cancellable"], field);
  const schedule = object(source.schedule, `${field}.schedule`);
  exactKeys(schedule, ["kind", "nextRunAt"], `${field}.schedule`);
  return {
    taskId: uuid(source.taskId, `${field}.taskId`),
    title: text(source.title, `${field}.title`),
    kind: oneOf(source.kind, ["localReminder", "readOnlyCheck"] as const, `${field}.kind`),
    status: oneOf(source.status, ["scheduled", "paused", "completed", "cancelled"] as const, `${field}.status`),
    createdAt: timestamp(source.createdAt, `${field}.createdAt`),
    updatedAt: timestamp(source.updatedAt, `${field}.updatedAt`),
    schedule: {
      kind: oneOf(schedule.kind, ["once"] as const, `${field}.schedule.kind`),
      nextRunAt: schedule.nextRunAt === null ? null : timestamp(schedule.nextRunAt, `${field}.schedule.nextRunAt`),
    },
    scope: parseScope(source.scope, `${field}.scope`),
    origin: oneOf(source.origin, ["ownerConfirmed"] as const, `${field}.origin`),
    cancellable: bool(source.cancellable, `${field}.cancellable`),
  };
}

export function parseTaskRegistrySnapshot(value: unknown): TaskRegistrySnapshot {
  const source = object(value, "snapshot");
  exactKeys(source, ["schemaVersion", "state", "storageExists", "taskCount", "scheduledCount", "pausedCount", "completedCount", "cancelledCount", "tasks", "error", "automaticExecution"], "snapshot");
  if (source.schemaVersion !== TASK_REGISTRY_SCHEMA_VERSION) fail("schemaVersion desconocido");
  if (!Array.isArray(source.tasks)) fail("tasks debe ser una lista");
  if (source.automaticExecution !== false) fail("automaticExecution debe permanecer apagado");
  return {
    schemaVersion: TASK_REGISTRY_SCHEMA_VERSION,
    state: oneOf(source.state, ["missing", "ready", "invalid"] as const, "snapshot.state"),
    storageExists: bool(source.storageExists, "snapshot.storageExists"),
    taskCount: integer(source.taskCount, "snapshot.taskCount"),
    scheduledCount: integer(source.scheduledCount, "snapshot.scheduledCount"),
    pausedCount: integer(source.pausedCount, "snapshot.pausedCount"),
    completedCount: integer(source.completedCount, "snapshot.completedCount"),
    cancelledCount: integer(source.cancelledCount, "snapshot.cancelledCount"),
    tasks: source.tasks.map((task, index) => parseTaskRecord(task, `tasks[${index}]`)),
    error: nullableText(source.error, "snapshot.error"),
    automaticExecution: false,
  };
}

export function parseTaskMutationPlan(value: unknown): TaskMutationPlan {
  const source = object(value, "plan");
  exactKeys(source, ["schemaVersion", "planId", "planSha256", "action", "plannedAt", "taskId", "title", "nextRunAt", "scope", "sourceExists", "sourceSha256Before", "projectedRevisionId", "projectedSourceSha256", "recordCountBefore", "recordCountAfter", "backupRequired", "revisionRequired", "auditRequired", "writesRequired", "automaticExecution", "writesPerformed"], "plan");
  if (source.schemaVersion !== TASK_REGISTRY_SCHEMA_VERSION) fail("plan.schemaVersion desconocido");
  if (source.automaticExecution !== false || source.writesPerformed !== false) fail("la vista previa no puede ejecutar ni escribir");
  return {
    schemaVersion: TASK_REGISTRY_SCHEMA_VERSION,
    planId: uuid(source.planId, "plan.planId"),
    planSha256: sha256(source.planSha256, "plan.planSha256"),
    action: oneOf(source.action, ["scheduleLocalReminder", "cancelTask"] as const, "plan.action"),
    plannedAt: timestamp(source.plannedAt, "plan.plannedAt"),
    taskId: uuid(source.taskId, "plan.taskId"),
    title: text(source.title, "plan.title"),
    nextRunAt: source.nextRunAt === null ? null : timestamp(source.nextRunAt, "plan.nextRunAt"),
    scope: parseScope(source.scope, "plan.scope"),
    sourceExists: bool(source.sourceExists, "plan.sourceExists"),
    sourceSha256Before: source.sourceSha256Before === null ? null : sha256(source.sourceSha256Before, "plan.sourceSha256Before"),
    projectedRevisionId: uuid(source.projectedRevisionId, "plan.projectedRevisionId"),
    projectedSourceSha256: sha256(source.projectedSourceSha256, "plan.projectedSourceSha256"),
    recordCountBefore: integer(source.recordCountBefore, "plan.recordCountBefore"),
    recordCountAfter: integer(source.recordCountAfter, "plan.recordCountAfter"),
    backupRequired: bool(source.backupRequired, "plan.backupRequired"),
    revisionRequired: bool(source.revisionRequired, "plan.revisionRequired"),
    auditRequired: bool(source.auditRequired, "plan.auditRequired"),
    writesRequired: bool(source.writesRequired, "plan.writesRequired"),
    automaticExecution: false,
    writesPerformed: false,
  };
}

export function parseTaskMutationReceipt(value: unknown): TaskMutationReceipt {
  const source = object(value, "receipt");
  exactKeys(source, ["schemaVersion", "operationId", "action", "taskId", "revisionId", "sourceSha256", "recordCount", "backupCreated", "revisionWritten", "auditWritten", "idempotent", "automaticExecution"], "receipt");
  if (source.schemaVersion !== TASK_REGISTRY_SCHEMA_VERSION || source.automaticExecution !== false) fail("recibo incompatible o con ejecución automática");
  return {
    schemaVersion: TASK_REGISTRY_SCHEMA_VERSION,
    operationId: uuid(source.operationId, "receipt.operationId"),
    action: oneOf(source.action, ["scheduleLocalReminder", "cancelTask"] as const, "receipt.action"),
    taskId: uuid(source.taskId, "receipt.taskId"),
    revisionId: uuid(source.revisionId, "receipt.revisionId"),
    sourceSha256: sha256(source.sourceSha256, "receipt.sourceSha256"),
    recordCount: integer(source.recordCount, "receipt.recordCount"),
    backupCreated: bool(source.backupCreated, "receipt.backupCreated"),
    revisionWritten: bool(source.revisionWritten, "receipt.revisionWritten"),
    auditWritten: bool(source.auditWritten, "receipt.auditWritten"),
    idempotent: bool(source.idempotent, "receipt.idempotent"),
    automaticExecution: false,
  };
}

export function localDateTimeToUtc(value: string): string {
  const instant = new Date(value);
  if (!value || Number.isNaN(instant.getTime())) throw new Error("Elegí una fecha y hora válidas.");
  return instant.toISOString().replace(/\.\d{3}Z$/, "Z");
}
