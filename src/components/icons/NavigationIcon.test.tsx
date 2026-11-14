import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavigationIcon } from "./NavigationIcon";

describe("iconos de navegación", () => {
  it("inserta el SVG real de Estado con la clase de selección", () => {
    const html = renderToStaticMarkup(<NavigationIcon kind="state" active />);
    expect(html).toContain('screen-tab-icon icon-state is-active');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<svg');
    expect(html).toContain('data-semantic="observable-internal-state technical-signals session-controls retrieved-memory"');
  });

  it("inserta el SVG real de Memoria sin marcarlo como seleccionado", () => {
    const html = renderToStaticMarkup(<NavigationIcon kind="memory" active={false} />);
    expect(html).toContain('screen-tab-icon icon-memory');
    expect(html).not.toContain('is-active');
    expect(html).toContain('data-semantic="layered-memory rag lifecycle archive backup"');
  });
});
