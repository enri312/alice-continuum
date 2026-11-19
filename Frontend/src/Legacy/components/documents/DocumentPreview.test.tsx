import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentPreview } from "./DocumentPreview";

describe("vista previa documental", () => {
  it("requiere selección y no promete aprender o enviar el archivo", () => {
    const html = renderToStaticMarkup(<DocumentPreview />);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".pdf,.md,.txt"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Autorizar lectura y ver texto");
    expect(html).toContain("No se envía a un modelo ni se guarda como recuerdo");
    expect(html).not.toContain("<pre");
  });
});
