import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Conversacion } from "./Conversacion";

describe("control de contexto de conversación", () => {
  it("expone fuentes reales y conserva la conversación sólo en memoria de trabajo", () => {
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
    expect(markup).toContain("seleccionado · todavía no hay mensajes temporales");
    expect(markup).toContain("Configurar observador en Gateway");
    expect(markup).toContain("MEMORIA DE TRABAJO");
    expect(markup).toContain("No se convierte automáticamente en recuerdo duradero ni en hecho confirmado");
    expect(markup).not.toContain("Aprendizaje episódico local");
  });
});
