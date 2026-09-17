import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryAssociations } from "./MemoryAssociations";
describe("relaciones de memoria", () => {
  it("no ofrece guardar relaciones sin datos ni backend", () => {
    const html = renderToStaticMarkup(<MemoryAssociations desktopApp={false} />);
    expect(html).toContain("Disponible en la aplicación de escritorio");
    expect(html).not.toContain("Confirmar y guardar relación");
    expect(html).toContain("no demuestra causalidad");
  });
  it("muestra actualización explícita sin inventar fuentes", () => {
    const html = renderToStaticMarkup(<MemoryAssociations desktopApp />);
    expect(html).toContain("Actualizar relaciones");
    expect(html).not.toContain("Seleccionar episodio");
  });
});
