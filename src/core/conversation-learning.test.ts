import { describe, expect, it } from "vitest";
import { buildConversationEpisode } from "./conversation-learning";

const realExchange = {
  id: "exchange-2026-08-17-01",
  userMessage: "Alice, ¿qué conocés sobre mis proyectos?",
  assistantMessage: "Conozco Alice Cognitive Core y tu preferencia por pruebas reales.",
  provider: "OpenRouter",
  model: "openrouter/free",
  startedAt: "2026-08-17T21:30:00.000Z",
  finishedAt: "2026-08-17T21:30:03.000Z",
};

describe("aprendizaje episódico de conversación", () => {
  it("conserva un intercambio recibido como episodio con procedencia y sin declararlo conocimiento semántico", () => {
    expect(buildConversationEpisode(realExchange)).toEqual({
      id: realExchange.id,
      kind: "Conversación",
      intention: realExchange.userMessage,
      startedAt: realExchange.startedAt,
      finishedAt: realExchange.finishedAt,
      summary: realExchange.assistantMessage,
      memoryType: "episodic",
      source: "Intercambio real autorizado · OpenRouter · openrouter/free",
      importance: 2,
      storageStrength: .08,
      memoryStatus: "confirmed",
      successfulRecalls: 0,
      failedRecalls: 0,
      successfulReviews: 0,
      correctionCount: 0,
      contextEvents: [],
    });
  });

  it("rechaza contenido ausente y una cronología imposible", () => {
    expect(() => buildConversationEpisode({ ...realExchange, assistantMessage: " " })).toThrow("respuesta de Alice");
    expect(() => buildConversationEpisode({ ...realExchange, finishedAt: "2026-08-17T21:29:59.000Z" })).toThrow("finaliza antes");
  });
});
