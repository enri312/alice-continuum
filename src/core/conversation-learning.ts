export type ConversationEpisode = {
  id: string;
  kind: "Conversación";
  intention: string;
  startedAt: string;
  finishedAt: string;
  summary: string;
  memoryType: "episodic";
  source: string;
  importance: number;
  storageStrength: number;
  memoryStatus: "confirmed";
  successfulRecalls: number;
  failedRecalls: number;
  successfulReviews: number;
  correctionCount: number;
  contextEvents: [];
};

export type RealConversationExchange = {
  id: string;
  userMessage: string;
  assistantMessage: string;
  provider: string;
  model: string;
  startedAt: string;
  finishedAt: string;
};

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`El intercambio real no contiene ${field}`);
  return normalized;
}

function timestamp(value: string, field: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`El intercambio real contiene ${field} inválida`);
  return parsed;
}

export function buildConversationEpisode(exchange: RealConversationExchange): ConversationEpisode {
  const startedAtMs = timestamp(exchange.startedAt, "una fecha de inicio");
  const finishedAtMs = timestamp(exchange.finishedAt, "una fecha de finalización");
  if (finishedAtMs < startedAtMs) throw new Error("El intercambio real finaliza antes de comenzar");

  const provider = required(exchange.provider, "un proveedor");
  const model = required(exchange.model, "un modelo");
  return {
    id: required(exchange.id, "un identificador"),
    kind: "Conversación",
    intention: required(exchange.userMessage, "el mensaje de Carlos"),
    startedAt: exchange.startedAt,
    finishedAt: exchange.finishedAt,
    summary: required(exchange.assistantMessage, "la respuesta de Alice"),
    memoryType: "episodic",
    source: `Intercambio real autorizado · ${provider} · ${model}`,
    importance: 2,
    storageStrength: .08,
    memoryStatus: "confirmed",
    successfulRecalls: 0,
    failedRecalls: 0,
    successfulReviews: 0,
    correctionCount: 0,
    contextEvents: [],
  };
}
