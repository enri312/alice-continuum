import { describe, expect, it } from "vitest";
import { messagesFromConversationHistory, parseConversationHistorySnapshot } from "./conversation-history";

const exchange = {
  exchangeId: "123e4567-e89b-42d3-a456-426614174000",
  responseId: "local:2026-09-04T14:00:00Z",
  userText: "Pregunta real",
  assistantText: "Respuesta real",
  createdAt: "2026-09-04T14:00:00Z",
  provider: "ollama",
  model: "qwen3.5:4b",
  source: "assistantConversation",
};

describe("historial durable de conversación", () => {
  it("acepta intercambios persistentes sin promoverlos a recuerdo", () => {
    const snapshot = parseConversationHistorySnapshot({
      schemaVersion: 1,
      state: "ready",
      storageExists: true,
      revisionId: "123e4567-e89b-42d3-a456-426614174001",
      updatedAt: "2026-09-04T14:00:00Z",
      exchanges: [exchange],
      exchangeCount: 1,
      messageCount: 2,
      maximumExchanges: 1000,
      persisted: true,
      automaticMemoryPromotion: false,
      error: null,
    });

    expect(messagesFromConversationHistory(snapshot)).toHaveLength(2);
    expect(snapshot.automaticMemoryPromotion).toBe(false);
  });

  it("bloquea conteos, fuentes o promociones inventadas", () => {
    const base = {
      schemaVersion: 1,
      state: "ready",
      storageExists: true,
      revisionId: "123e4567-e89b-42d3-a456-426614174001",
      updatedAt: "2026-09-04T14:00:00Z",
      exchanges: [exchange],
      exchangeCount: 1,
      messageCount: 2,
      maximumExchanges: 1000,
      persisted: true,
      automaticMemoryPromotion: false,
      error: null,
    };
    expect(() => parseConversationHistorySnapshot({ ...base, messageCount: 3 })).toThrow(/conteos/);
    expect(() => parseConversationHistorySnapshot({ ...base, automaticMemoryPromotion: true })).toThrow(/garantías/);
    expect(() => parseConversationHistorySnapshot({ ...base, exchanges: [{ ...exchange, source: "modelMemory" }] })).toThrow(/source/);
    expect(() => parseConversationHistorySnapshot({ ...base, exchanges: [exchange, { ...exchange, exchangeId: "123e4567-e89b-42d3-a456-426614174002" }], exchangeCount: 2, messageCount: 4 })).toThrow(/responseId/);
  });
});
