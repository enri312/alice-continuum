import { describe, expect, it } from "vitest";
import { buildCloudPayload } from "./cloud-payload";

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
  it("envía únicamente el mensaje cuando no se autoriza contexto adicional", () => {
    const payload = buildCloudPayload(context);

    expect(payload).toBe("MENSAJE ACTUAL\nAyúdame con programación");
    expect(payload).not.toContain("mensaje privado anterior");
    expect(payload).not.toContain("dato privado");
    expect(payload).not.toContain("Proyecto secreto");
  });

  it("incluye el historial solamente cuando fue autorizado", () => {
    const payload = buildCloudPayload({ ...context, includeHistory: true });

    expect(payload).toContain("HISTORIAL LOCAL AUTORIZADO");
    expect(payload).toContain("Enrique: mensaje privado anterior");
    expect(payload).toContain("Alice: respuesta anterior");
    expect(payload).not.toContain("dato privado");
  });

  it("incluye únicamente los recuerdos recuperados y autorizados", () => {
    const payload = buildCloudPayload({ ...context, includeMemory: true });

    expect(payload).toContain("RECUERDOS LOCALES RECUPERADOS Y AUTORIZADOS");
    expect(payload).toContain("dato privado: resumen privado · Próximo paso: continuar");
    expect(payload).not.toContain("Proyecto secreto");
  });

  it("no adjunta la ventana si la observación está apagada", () => {
    const blocked = buildCloudPayload({ ...context, includeWindow: true, observationEnabled: false });
    const allowed = buildCloudPayload({ ...context, includeWindow: true });

    expect(blocked).not.toContain("VENTANA AUTORIZADA");
    expect(allowed).toContain("Programa: Code");
    expect(allowed).toContain("Título: Proyecto secreto");
  });
});
