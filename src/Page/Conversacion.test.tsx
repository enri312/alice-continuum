import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Conversacion } from "./Conversacion";

describe("control de contexto de conversación", () => {
  it("expone fuentes reales y separa historial durable de memoria confirmada", () => {
    const markup = renderToStaticMarkup(<Conversacion
      desktopApp
      draft=""
      status={{ providers: [{ id: "ollama", label: "Ollama local", configured: true, defaultModel: "qwen3.5:4b", protocol: "Ollama", retentionMode: "local" }] }}
      provider="ollama"
      model="qwen3.5:4b"
      messages={[]}
      memories={[]}
      observationEnabled={false}
      foregroundContext={null}
      onToggleObservation={vi.fn(async () => undefined)}
      onDraftChange={vi.fn()}
      onMemoryRetrieval={vi.fn()}
      onOpenSettings={vi.fn()}
      onSend={vi.fn()}
      onRetrievalOutcome={vi.fn(async () => undefined)}
    />);

    expect(markup).toContain("FUENTES SELECCIONADAS · DATOS REALES");
    expect(markup).toContain("seleccionado · todavía no hay mensajes guardados");
    expect(markup).toContain("Configurar observador en Gateway");
    expect(markup).toContain("CONTINUIDAD LOCAL");
    expect(markup).toContain("CONVERSACIÓN GUARDADA LOCALMENTE");
    expect(markup).toContain("no se convierte automáticamente en recuerdo ni en hecho confirmado");
    expect(markup).not.toContain("Aprendizaje episódico local");
  });
});
