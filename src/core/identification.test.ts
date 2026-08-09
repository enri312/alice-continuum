import { describe, expect, it } from "vitest";
import { buildIdentificationSnapshot, tokenizeIdentificationInput } from "./identification";

const emptyInputs = {
  draft: "",
  lastUserMessage: undefined,
  messageCount: 0,
  memoryCount: 0,
  retrievedMemoryCount: 0,
  observerEnabled: false,
  foregroundContext: null,
  cloudPending: false,
};

describe("identification", () => {
  it("conserva palabras españolas y elimina puntuación al tokenizar", () => {
    expect(tokenizeIdentificationInput("¿Eso no salió como esperábamos, pero seguimos?")).toEqual([
      "Eso", "no", "salió", "como", "esperábamos", "pero", "seguimos",
    ]);
  });

  it("representa el estado vacío sin inventar análisis", () => {
    const snapshot = buildIdentificationSnapshot(emptyInputs);

    expect(snapshot.source).toBe("none");
    expect(snapshot.tokens).toEqual([]);
    expect(snapshot.intent).toBe("SIN_ENTRADA");
    expect(snapshot.intentConfidence).toBeNull();
    expect(snapshot.hypotheses.every((item) => item.score === null)).toBe(true);
    expect(snapshot.fields.map((field) => field.label)).toEqual(["SOURCE", "SPEAKER", "INTENT TOP-1", "INTENT CONF"]);
  });

  it("prioriza el borrador local sobre el último mensaje", () => {
    const snapshot = buildIdentificationSnapshot({
      ...emptyInputs,
      draft: "construye esa interfaz",
      lastUserMessage: "mensaje anterior",
    });

    expect(snapshot.source).toBe("draft");
    expect(snapshot.input).toBe("construye esa interfaz");
    expect(snapshot.intent).toBe("INSTRUCCIÓN");
  });

  it("identifica una inyección diagnóstica sin confundirla con conversación real", () => {
    const snapshot = buildIdentificationSnapshot({
      ...emptyInputs,
      diagnosticInput: "Era una broma, no te enojes conmigo",
      draft: "borrador real",
    });

    expect(snapshot.source).toBe("diagnostic");
    expect(snapshot.input).toBe("Era una broma, no te enojes conmigo");
    expect(snapshot.intent).toBe("FRIENDLY");
    expect(snapshot.intentMatches).toEqual(expect.arrayContaining(["broma", "conmigo"]));
    expect(snapshot.fields.find((field) => field.label === "SOURCE")?.value).toBe("MANUAL_INPUT");
    expect(snapshot.fields.find((field) => field.label === "SPEAKER")?.value).toBe("CONTEXT_SIM");
  });

  it("distingue un contexto automático del texto preparado en el inyector", () => {
    const snapshot = buildIdentificationSnapshot({
      ...emptyInputs,
      diagnosticInput: "Eso no salió como esperábamos, pero podemos intentarlo otra vez",
      diagnosticMode: "auto-demo",
    });

    expect(snapshot.fields.find((field) => field.label === "SOURCE")?.value).toBe("AUTO_DEMO");
    expect(snapshot.fields.find((field) => field.label === "SPEAKER")?.value).toBe("CONTEXT_SIM");
  });

  it("detecta ajuste solo con suficientes indicios y explica sus reglas", () => {
    const snapshot = buildIdentificationSnapshot({
      ...emptyInputs,
      draft: "Eso no salió como esperábamos, pero seguimos",
    });

    expect(snapshot.intent).toBe("AJUSTE / REVISIÓN");
    expect(snapshot.intentConfidence).toBeGreaterThan(.5);
    expect(snapshot.intentMatches).toEqual(expect.arrayContaining(["no", "salio", "pero"]));
    expect(snapshot.hypotheses.find((item) => item.id === "correction")?.score).toBeGreaterThan(0);
  });

  it("expone el contexto observado sin inferir una identidad", () => {
    const snapshot = buildIdentificationSnapshot({
      ...emptyInputs,
      lastUserMessage: "hola",
      observerEnabled: true,
      foregroundContext: { processName: "Code", windowTitle: "Alice" },
    });

    expect(snapshot.fields.find((field) => field.label === "SPEAKER")?.value).toBe("USUARIO_LOCAL");
  });
});
