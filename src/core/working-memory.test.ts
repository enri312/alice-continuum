import { describe, expect, it } from "vitest";
import { messagesFromWorkingMemory, parseWorkingMemoryOperationResult, parseWorkingMemorySnapshot } from "./working-memory";

function activeSnapshot() {
  const userText = "Mensaje real";
  const assistantText = "Respuesta real";
  return {
    schemaVersion: 1,
    state: "active",
    generation: 1,
    exchanges: [{
      exchangeId: "75b40444-aa7e-4b19-bae7-776d42dc760a",
      userText,
      assistantText,
      createdAt: "2026-08-14T12:00:00Z",
      provider: "OpenAI",
      model: "modelo-real",
      source: "cloudConversation",
    }],
    exchangeCount: 1,
    messageCount: 2,
    maximumMessages: 6,
    characterCount: [...userText].length + [...assistantText].length,
    maximumCharacters: 48_000,
    ttlSeconds: 1_800,
    expiresInSeconds: 1_799,
    lastActivityAt: "2026-08-14T12:00:00Z",
    persisted: false,
  };
}

describe("contrato R6.2 de memoria de trabajo real", () => {
  it("acepta un intercambio real y lo convierte en los seis mensajes máximos de conversación", () => {
    const snapshot = parseWorkingMemorySnapshot(activeSnapshot());
    const messages = messagesFromWorkingMemory(snapshot);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", text: "Mensaje real" });
    expect(messages[1]).toMatchObject({ role: "assistant", text: "Respuesta real" });
  });

  it("rechaza persistencia, conteos inventados y presupuestos ampliados", () => {
    expect(() => parseWorkingMemorySnapshot({ ...activeSnapshot(), persisted: true })).toThrow();
    expect(() => parseWorkingMemorySnapshot({ ...activeSnapshot(), messageCount: 6 })).toThrow();
    expect(() => parseWorkingMemorySnapshot({ ...activeSnapshot(), maximumMessages: 8 })).toThrow();
  });

  it("acepta el vaciado confirmado y conserva el estado efímero", () => {
    const empty = { ...activeSnapshot(), state: "empty", generation: 2, exchanges: [], exchangeCount: 0, messageCount: 0, characterCount: 0, expiresInSeconds: null, lastActivityAt: null };
    const result = parseWorkingMemoryOperationResult({ snapshot: empty, auditHealthy: true, warning: null });

    expect(result.snapshot.state).toBe("empty");
    expect(result.snapshot.persisted).toBe(false);
  });

  it("expone un fallo real de auditoría en vez de ocultarlo", () => {
    const result = parseWorkingMemoryOperationResult({ snapshot: activeSnapshot(), auditHealthy: false, warning: "Auditoría R3 no disponible" });

    expect(result.warning).toContain("R3");
  });
});
