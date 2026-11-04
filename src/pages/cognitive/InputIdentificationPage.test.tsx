import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Identificacion } from "./InputIdentificationPage";

const inputs = {
  draft: "Mensaje de prueba visual",
  messageCount: 0,
  memoryCount: 0,
  retrievedMemoryCount: 0,
  observerEnabled: false,
  foregroundContext: null,
  cloudPending: false,
  observationAvailable: true,
  onToggleObservation: vi.fn(),
};

describe("inicio centrado en conversación", () => {
  it("monta un único chat antes de las herramientas secundarias y no ejecuta el diagnóstico cerrado", () => {
    const markup = renderToStaticMarkup(<Identificacion {...inputs} conversationPanel={<div data-testid="chat">Conversación de prueba</div>} />);
    expect(markup.match(/data-testid="chat"/g)).toHaveLength(1);
    expect(markup.indexOf('data-testid="chat"')).toBeLessThan(markup.indexOf("Diagnóstico de entrada"));
    expect(markup).not.toContain("Capturar diagnóstico");
    expect(markup).not.toContain("Palabras del mensaje");
    expect(markup).not.toContain("Mensaje de prueba visual");
    expect(inputs.onToggleObservation).not.toHaveBeenCalled();
  });

  it("mantiene diagnóstico y documentos en accesos cerrados e independientes", () => {
    const markup = renderToStaticMarkup(<Identificacion {...inputs} conversationPanel={<div>Chat</div>} />);
    const tools = markup.match(/<details class="conversation-secondary-panel"[^>]*>/g);
    expect(tools).toHaveLength(2);
    expect(tools?.every(tag => !/\bopen(?:=|\s|>)/.test(tag))).toBe(true);
    expect(markup).toContain("Documentos locales");
    expect(markup).toContain("Abrir una vista previa independiente del chat");
  });
});
