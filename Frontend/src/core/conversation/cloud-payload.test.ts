import { describe, expect, it } from "vitest";
import { buildCloudPayload, buildCloudPayloadReview } from "./cloud-payload";

const context = {
  draft: "  Ayúdame con programación  ",
  includeHistory: false,
  recentHistory: [
    { role: "user" as const, text: "mensaje privado anterior" },
    { role: "assistant" as const, text: "respuesta anterior" },
  ],
  includeMemory: false,
  memories: [{ intention: "dato privado", summary: "resumen privado", nextStep: "continuar" }],
  includeWindow: false,
  observationEnabled: true,
  foregroundContext: { processName: "Code", windowTitle: "Proyecto secreto" },
};

describe("buildCloudPayload", () => {
  it("etiqueta autoestudio antes de memoria automática o semántica y conserva el límite de su comprobación", () => {
    const payload = buildCloudPayload({ ...context, includeMemory: true, memories: [{
      studyLearning: true, automaticLearning: true, kind: "Autoestudio", memoryType: "semantic",
      intention: "Álgebra", summary: "Un ejemplo comprobado", source: "Fuente curada · https://example.org/algebra",
    }] });
    expect(payload).toContain("AUTOESTUDIO · FUENTE CURADA · COMPRENSIÓN COMPROBADA EN UN EJERCICIO · NO DECLARACIÓN DEL PROPIETARIO");
    expect(payload).toContain("no garantiza dominio general");
    expect(payload).toContain("https://example.org/algebra");
    expect(payload).not.toContain("Carlos declaró");
    expect(payload).not.toContain("HECHO ENSEÑADO Y CONFIRMADO");
  });
  it("conserva ambos lados del diálogo de voz como diálogo y respeta excluir historial", () => {
    const payload = buildCloudPayload({ ...context, includeHistory: true, includeAssistantDialogue: true });
    expect(payload).toContain("LAS RESPUESTAS DE ALICE NO SON EVIDENCIA FACTUAL");
    expect(payload).toContain("Carlos: mensaje privado anterior");
    expect(payload).toContain("Alice (respuesta anterior no verificada): respuesta anterior");
    expect(payload).not.toContain("dato privado");
    expect(buildCloudPayload({ ...context, includeAssistantDialogue: true })).not.toContain("respuesta anterior");
  });
  it("envía únicamente el mensaje cuando no se autoriza contexto adicional", () => {
    const payload = buildCloudPayload(context);

    expect(payload).toBe("MENSAJE ACTUAL\nCarlos Nuñez → Alice:\nAyúdame con programación");
    expect(payload).not.toContain("mensaje privado anterior");
    expect(payload).not.toContain("dato privado");
    expect(payload).not.toContain("Proyecto secreto");
  });

  it("incluye el historial solamente cuando fue autorizado", () => {
    const payload = buildCloudPayload({ ...context, includeHistory: true });

    expect(payload).toContain("HISTORIAL LOCAL AUTORIZADO · SOLO MENSAJES DEL PROPIETARIO");
    expect(payload).toContain("Carlos Nuñez: mensaje privado anterior");
    expect(payload).not.toContain("respuesta anterior");
    expect(payload).not.toContain("dato privado");
  });

  it("no reinyecta respuestas históricas del modelo como contexto factual", () => {
    const payload = buildCloudPayload({
      ...context,
      includeHistory: true,
      recentHistory: [{ role: "assistant", text: "dato alucinado por un modelo anterior" }],
    });

    expect(payload).not.toContain("dato alucinado");
    expect(payload).toBe("MENSAJE ACTUAL\nCarlos Nuñez → Alice:\nAyúdame con programación");
  });

  it("incluye únicamente los recuerdos recuperados y autorizados", () => {
    const payload = buildCloudPayload({ ...context, includeMemory: true });

    expect(payload).toContain("RECUERDOS LOCALES RECUPERADOS Y AUTORIZADOS");
    expect(payload).toContain("[RECUERDO LOCAL] dato privado: resumen privado · Próximo paso: continuar");
    expect(payload).not.toContain("Proyecto secreto");
  });

  it("distingue una conversación pasada de un hecho confirmado", () => {
    const payload = buildCloudPayload({
      ...context,
      includeMemory: true,
      memories: [{
        kind: "Conversación",
        memoryType: "episodic",
        intention: "Investigamos una tecnología",
        summary: "El modelo produjo una respuesta",
        source: "Intercambio real autorizado · OpenRouter · openrouter/free",
      }],
    });

    expect(payload).toContain("[EPISODIO DE CONVERSACIÓN · NO ES UN HECHO VERIFICADO]");
    expect(payload).toContain("Carlos dijo o preguntó: Investigamos una tecnología");
    expect(payload).toContain("La respuesta histórica del modelo no se incorpora como conocimiento");
    expect(payload).toContain("Fuente: Intercambio real autorizado · OpenRouter · openrouter/free");
    expect(payload).not.toContain("El modelo produjo una respuesta");
    expect(payload).not.toContain("HECHO ENSEÑADO Y CONFIRMADO");
  });

  it("no adjunta la ventana si la observación está apagada", () => {
    const blocked = buildCloudPayload({ ...context, includeWindow: true, observationEnabled: false });
    const allowed = buildCloudPayload({ ...context, includeWindow: true });

    expect(blocked).not.toContain("VENTANA AUTORIZADA");
    expect(allowed).toContain("Programa: Code");
    expect(allowed).toContain("Título: Proyecto secreto");
  });

  it("mide cada fragmento sobre la misma cadena exacta que se enviará", () => {
    const review = buildCloudPayloadReview({
      ...context,
      draft: "Alice, leé esto 👋",
      includeHistory: true,
      includeMemory: true,
      includeWindow: true,
    });
    const included = review.budget.fragments.filter((item) => item.included);

    expect(review.payload).toBe(buildCloudPayload({
      ...context,
      draft: "Alice, leé esto 👋",
      includeHistory: true,
      includeMemory: true,
      includeWindow: true,
    }));
    expect(review.budget.totalCharacters).toBe(Array.from(review.payload).length);
    expect(review.budget.totalUtf8Bytes).toBe(new TextEncoder().encode(review.payload).length);
    expect(review.budget.separatorCharacters).toBe((included.length - 1) * 2);
    expect(included.reduce((sum, item) => sum + item.characters, 0) + review.budget.separatorCharacters).toBe(review.budget.totalCharacters);
    expect(included.reduce((sum, item) => sum + item.utf8Bytes, 0) + review.budget.separatorUtf8Bytes).toBe(review.budget.totalUtf8Bytes);
    expect(review.budget.totalUtf8Bytes).toBeGreaterThan(review.budget.totalCharacters);
  });

  it("asigna cero a fragmentos opcionales no autorizados", () => {
    const review = buildCloudPayloadReview(context);
    const optional = review.budget.fragments.filter((item) => item.optional);
    const message = review.budget.fragments.find((item) => item.id === "message");

    expect(optional).toHaveLength(3);
    expect(optional.every((item) => !item.included && item.characters === 0 && item.utf8Bytes === 0)).toBe(true);
    expect(message).toMatchObject({ included: true, optional: false });
    expect(review.budget.separatorCharacters).toBe(0);
  });
});
