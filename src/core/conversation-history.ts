export type ConversationHistoryState = "missing" | "ready" | "invalid";

export type ConversationHistoryExchange = {
  exchangeId: string;
  responseId: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  provider: string;
  model: string;
  source: "assistantConversation";
};

export type ConversationHistorySnapshot = {
  schemaVersion: 1;
  state: ConversationHistoryState;
  storageExists: boolean;
  revisionId: string | null;
  updatedAt: string | null;
  exchanges: ConversationHistoryExchange[];
  exchangeCount: number;
  messageCount: number;
  maximumExchanges: 1000;
  persisted: true;
  automaticMemoryPromotion: false;
  error: string | null;
};

const snapshotKeys = ["schemaVersion", "state", "storageExists", "revisionId", "updatedAt", "exchanges", "exchangeCount", "messageCount", "maximumExchanges", "persisted", "automaticMemoryPromotion", "error"];
const exchangeKeys = ["exchangeId", "responseId", "userText", "assistantText", "createdAt", "provider", "model", "source"];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fail(message: string): never {
  throw new Error(`Historial de conversación inválido: ${message}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[], field: string) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) fail(`${field} tiene campos ausentes o desconocidos`);
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) fail(`${field} debe ser texto no vacío`);
  return value;
}

function uuid(value: unknown, field: string) {
  const parsed = text(value, field);
  if (!uuidV4.test(parsed)) fail(`${field} debe ser UUID v4`);
  return parsed;
}

function timestamp(value: unknown, field: string) {
  const parsed = text(value, field);
  if (!isoUtc.test(parsed) || Number.isNaN(Date.parse(parsed))) fail(`${field} debe ser UTC ISO-8601`);
  return parsed;
}

function integer(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} debe ser un entero no negativo`);
  return value as number;
}

function nullableText(value: unknown, field: string) {
  return value === null ? null : text(value, field);
}

function parseExchange(value: unknown, index: number): ConversationHistoryExchange {
  const input = object(value, `exchanges[${index}]`);
  exactKeys(input, exchangeKeys, `exchanges[${index}]`);
  if (input.source !== "assistantConversation") fail(`exchanges[${index}].source es desconocido`);
  return {
    exchangeId: uuid(input.exchangeId, `exchanges[${index}].exchangeId`),
    responseId: text(input.responseId, `exchanges[${index}].responseId`),
    userText: text(input.userText, `exchanges[${index}].userText`),
    assistantText: text(input.assistantText, `exchanges[${index}].assistantText`),
    createdAt: timestamp(input.createdAt, `exchanges[${index}].createdAt`),
    provider: text(input.provider, `exchanges[${index}].provider`),
    model: text(input.model, `exchanges[${index}].model`),
    source: "assistantConversation",
  };
}

export function parseConversationHistorySnapshot(value: unknown): ConversationHistorySnapshot {
  const input = object(value, "snapshot");
  exactKeys(input, snapshotKeys, "snapshot");
  if (input.schemaVersion !== 1 || input.persisted !== true || input.automaticMemoryPromotion !== false) fail("las garantías del historial no coinciden");
  if (input.state !== "missing" && input.state !== "ready" && input.state !== "invalid") fail("state es desconocido");
  if (!Array.isArray(input.exchanges)) fail("exchanges debe ser una lista");
  const exchanges = input.exchanges.map(parseExchange);
  if (new Set(exchanges.map((exchange) => exchange.exchangeId)).size !== exchanges.length) fail("exchangeId está repetido");
  if (new Set(exchanges.map((exchange) => exchange.responseId)).size !== exchanges.length) fail("responseId está repetido");
  if (exchanges.some((exchange, index) => index > 0 && exchange.createdAt < exchanges[index - 1]!.createdAt)) fail("los intercambios no están ordenados");
  const exchangeCount = integer(input.exchangeCount, "exchangeCount");
  const messageCount = integer(input.messageCount, "messageCount");
  const revisionId = input.revisionId === null ? null : uuid(input.revisionId, "revisionId");
  const updatedAt = input.updatedAt === null ? null : timestamp(input.updatedAt, "updatedAt");
  const error = nullableText(input.error, "error");
  const storageExists = typeof input.storageExists === "boolean" ? input.storageExists : fail("storageExists debe ser booleano");
  if (input.maximumExchanges !== 1000) fail("maximumExchanges no coincide");
  if (exchangeCount !== exchanges.length || messageCount !== exchanges.length * 2) fail("los conteos no coinciden");
  if (input.state === "ready" && (!storageExists || !revisionId || !updatedAt || error)) fail("ready requiere una fuente válida");
  if (updatedAt && exchanges.at(-1)?.createdAt && exchanges.at(-1)!.createdAt > updatedAt) fail("updatedAt precede al último intercambio");
  if (input.state === "missing" && (storageExists || revisionId || updatedAt || exchanges.length || error)) fail("missing no puede declarar datos");
  if (input.state === "invalid" && (!storageExists || revisionId || updatedAt || exchanges.length || !error)) fail("invalid debe bloquear el contenido");
  return {
    schemaVersion: 1,
    state: input.state,
    storageExists,
    revisionId,
    updatedAt,
    exchanges,
    exchangeCount,
    messageCount,
    maximumExchanges: 1000,
    persisted: true,
    automaticMemoryPromotion: false,
    error,
  };
}

export function messagesFromConversationHistory(snapshot: ConversationHistorySnapshot) {
  return snapshot.exchanges.flatMap((exchange) => [
    { id: `${exchange.exchangeId}-user`, role: "user" as const, text: exchange.userText, createdAt: exchange.createdAt },
    { id: `${exchange.exchangeId}-assistant`, role: "assistant" as const, text: exchange.assistantText, createdAt: exchange.createdAt, model: `${exchange.provider} · ${exchange.model}` },
  ]);
}
