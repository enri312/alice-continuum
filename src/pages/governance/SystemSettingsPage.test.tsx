import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { Configuracion } from "./SystemSettingsPage";

describe("control manual de Gemma", () => {
  it("expone inicio/apagado sin prometer micrófono ni cambio automático", () => {
    const html = renderToStaticMarkup(<Configuracion desktopApp status={{ providers: [{ id: "llamacpp", label: "Gemma local", configured: true, defaultModel: "gemma-4-E2B-it-Q4_K_M", protocol: "Local", retentionMode: "Sin nube" }] }} provider="llamacpp" model="gemma-4-E2B-it-Q4_K_M" onProviderChange={vi.fn()} onModelChange={vi.fn()} />);
    expect(html).toContain("Iniciar Gemma local");
    expect(html).toContain("Historial visible");
    expect(html).toContain("Mostrar todo el historial en el chat");
    expect(html).toContain("Apagar Gemma");
    expect(html).toContain("INICIO MANUAL");
    expect(html.toLowerCase()).toContain("readonly");
    expect(html).toContain("Iniciar Gemma también lo selecciona");
  });
});
