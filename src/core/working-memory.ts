export type WorkingMemoryState = "empty" | "active" | "expired";

export type WorkingMemoryExchange = {
  exchangeId: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  provider: string;
  model: string;
  source: "cloudConversation";
};

export type WorkingMemorySnapshot = {
  schemaVersion: 1;
  state: WorkingMemoryState;
  generation: number;
  exchanges: WorkingMemoryExchange[];
  exchangeCount: number;
  messageCount: number;
  maximumMessages: number;
  characterCount: number;
  maximumCharacters: number;
  ttlSeconds: number;
  expiresInSeconds: number | null;
  lastActivityAt: string | null;
  persisted: false;
};

export type WorkingMemoryOperationResult = {
  snapshot: WorkingMemorySnapshot;
  auditHealthy: boolean;
  warning: string | null;
};

const snapshotKeys = ["schemaVersion", "state", "generation", "exchanges", "exchangeCount", "messageCount", "maximumMessages", "characterCount", "maximumCharacters", "ttlSeconds", "expiresInSeconds", "lastActivityAt", "persisted"];
const exchangeKeys = ["exchangeId", "userText", "assistantText", "createdAt", "provider", "model", "source"];
const operationKeys = ["snapshot", "auditHealthy", "warning"];
const states: WorkingMemoryState[] = ["empty", "active", "expired"];

function fail(message: string): never {
  throw new Error(`Memoria de trabajo R6.2 inválida: ${message}`);
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

function nonNegativeInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}

function positiveInteger(value: unknown, field: string) {
  const parsed = nonNegativeInteger(value, field);
  if (!parsed) fail(`${field} debe ser positivo`);
  return parsed;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío`);
  return value;
}

function timestamp(value: unknown, field: string) {
  const parsed = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(parsed) || Number.isNaN(Date.parse(parsed))) fail(`${field} debe ser UTC ISO-8601`);
  return parsed;
}

function parseExchange(value: unknown, index: number): WorkingMemoryExchange {
  const input = record(value, `exchanges[${index}]`);
  exactKeys(input, exchangeKeys, `exchanges[${index}]`);
  const exchangeId = text(input.exchangeId, `exchanges[${index}].exchangeId`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(exchangeId)) fail(`exchanges[${index}].exchangeId no es UUID v4`);
  if (input.source !== "cloudConversation") fail(`exchanges[${index}].source es desconocido`);
  return {
    exchangeId,
    userText: text(input.userText, `exchanges[${index}].userText`),
    assistantText: text(input.assistantText, `exchanges[${index}].assistantText`),
    createdAt: timestamp(input.createdAt, `exchanges[${index}].createdAt`),
    provider: text(input.provider, `exchanges[${index}].provider`),
    model: text(input.model, `exchanges[${index}].model`),
    source: "cloudConversation",
  };
}

export function parseWorkingMemorySnapshot(value: unknown): WorkingMemorySnapshot {
  const input = record(value, "snapshot");
  exactKeys(input, snapshotKeys, "snapshot");
  if (input.schemaVersion !== 1) fail("schemaVersion debe ser 1");
  if (typeof input.state !== "string" || !states.includes(input.state as WorkingMemoryState)) fail("state es desconocido");
  if (!Array.isArray(input.exchanges)) fail("exchanges debe ser una lista");
  const exchanges = input.exchanges.map(parseExchange);
  const exchangeCount = nonNegativeInteger(input.exchangeCount, "exchangeCount");
  const messageCount = nonNegativeInteger(input.messageCount, "messageCount");
  const maximumMessages = positiveInteger(input.maximumMessages, "maximumMessages");
  const characterCount = nonNegativeInteger(input.characterCount, "characterCount");
  const maximumCharacters = positiveInteger(input.maximumCharacters, "maximumCharacters");
  const ttlSeconds = positiveInteger(input.ttlSeconds, "ttlSeconds");
  const expiresInSeconds = input.expiresInSeconds === null ? null : nonNegativeInteger(input.expiresInSeconds, "expiresInSeconds");
  const lastActivityAt = input.lastActivityAt === null ? null : timestamp(input.lastActivityAt, "lastActivityAt");
  const state = input.state as WorkingMemoryState;
  if (input.persisted !== false) fail("el contenido no puede declararse persistente");
  if (exchangeCount !== exchanges.length || messageCount !== exchanges.length * 2) fail("los conteos no corresponden a los intercambios");
  if (messageCount > maximumMessages || maximumMessages !== 6) fail("el presupuesto debe limitarse a seis mensajes");
  const exactCharacters = exchanges.reduce((total, exchange) => total + [...exchange.userText].length + [...exchange.assistantText].length, 0);
  if (characterCount !== exactCharacters || characterCount > maximumCharacters || maximumCharacters !== 48_000) fail("el presupuesto de caracteres no coincide");
  if (ttlSeconds !== 1_800 || (expiresInSeconds !== null && expiresInSeconds > ttlSeconds)) fail("el vencimiento excede 30 minutos");
  if (state === "active" && (!exchanges.length || !lastActivityAt || expiresInSeconds === null)) fail("active requiere contenido y vencimiento");
  if (state !== "active" && (exchanges.length || expiresInSeconds !== null)) fail("empty/expired no puede exponer contenido activo");
  return {
    schemaVersion: 1,
    state,
    generation: nonNegativeInteger(input.generation, "generation"),
    exchanges,
    exchangeCount,
    messageCount,
    maximumMessages,
    characterCount,
    maximumCharacters,
    ttlSeconds,
    expiresInSeconds,
    lastActivityAt,
    persisted: false,
  };
}

export function parseWorkingMemoryOperationResult(value: unknown): WorkingMemoryOperationResult {
  const input = record(value, "operation");
  exactKeys(input, operationKeys, "operation");
  if (typeof input.auditHealthy !== "boolean") fail("auditHealthy debe ser booleano");
  const warning = input.warning === null ? null : text(input.warning, "warning");
  if (input.auditHealthy && warning) fail("una auditoría saludable no puede incluir advertencia");
  if (!input.auditHealthy && !warning) fail("un fallo de auditoría requiere advertencia");
  return { snapshot: parseWorkingMemorySnapshot(input.snapshot), auditHealthy: input.auditHealthy, warning };
}

export function messagesFromWorkingMemory(snapshot: WorkingMemorySnapshot) {
  return snapshot.exchanges.flatMap((exchange) => [
    { id: `${exchange.exchangeId}-user`, role: "user" as const, text: exchange.userText, createdAt: exchange.createdAt },
    { id: `${exchange.exchangeId}-assistant`, role: "assistant" as const, text: exchange.assistantText, createdAt: exchange.createdAt, model: `${exchange.provider} · ${exchange.model}` },
  ]);
}

export function workingMemoryRemainingLabel(snapshot: WorkingMemorySnapshot) {
  if (snapshot.state === "expired") return "EXPIRADA";
  if (snapshot.state === "empty" || snapshot.expiresInSeconds === null) return "VACÍA";
  const minutes = Math.floor(snapshot.expiresInSeconds / 60);
  const seconds = snapshot.expiresInSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function workingMemoryUsagePercent(snapshot: WorkingMemorySnapshot) {
  if (!snapshot.maximumCharacters) return 0;
  return Math.min(100, Math.round((snapshot.characterCount / snapshot.maximumCharacters) * 1_000) / 10);
}
