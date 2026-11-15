import { describe, expect, it } from "vitest";
import { buildSourceChoices, canPreviewSources, parseSourceFormAction, type SourceFormPayload } from "./source-form-bridge";

const payload: SourceFormPayload = { busy: false,
  sources: [{ id: "a", title: "A", entry: "Cita A" }, { id: "b", title: "B", entry: "Cita B" }],
  selected: ["a", "b"], quotes: ["Cita A", "Cita B"],
};
describe("formulario de fuentes Dioxus", () => {
  it("copia sólo las entradas seleccionadas y conserva títulos limitados en las demás opciones", () => {
    const choices = buildSourceChoices(["a", "b"], [
      { id: "a", intention: "A".repeat(120) + "UNSELECTED_PRIVATE_TAIL" },
      { id: "b", intention: "Entrada seleccionada" },
      { id: "not-eligible", intention: "INELIGIBLE_RECORD" },
    ], ["b", ""]);
    expect(choices[0]).toEqual({ id: "a", title: "A".repeat(90), entry: "" });
    expect(choices[1].entry).toBe("Entrada seleccionada");
    expect(JSON.stringify(choices)).not.toContain("UNSELECTED_PRIVATE_TAIL");
    expect(JSON.stringify(choices)).not.toContain("INELIGIBLE_RECORD");
  });
  it("valida fuentes actuales, índices y tamaños sin aceptar autoridad del renderer", () => {
    expect(parseSourceFormAction('{"type":"selectSource","index":0,"id":"a"}', payload)).toEqual({ type: "selectSource", index: 0, id: "a" });
    expect(parseSourceFormAction('{"type":"previewSources"}', payload)).toEqual({ type: "previewSources" });
    for (const action of [null, [], { type: "selectSource", index: 2, id: "a" },
      { type: "selectSource", index: 0, id: "removed" },
      { type: "editQuote", index: 0, quote: "😀".repeat(1025) },
      { type: "previewSources", confirmed: true }, { type: "previewSources", expectedRevision: 7 },
      { type: "selectSource", index: 0, id: "a", recordSha256: "forged" },
    ]) expect(parseSourceFormAction(JSON.stringify(action), payload)).toBeNull();
  });
  it("bloquea revisión con fuentes repetidas, retiradas, citas vacías y estado ocupado", () => {
    for (const current of [{ ...payload, selected: ["a", "a"] as [string,string] },
      { ...payload, quotes: [" ", "B"] as [string,string] }, { ...payload, sources: [] }, { ...payload, busy: true },
    ]) {
      expect(canPreviewSources(current)).toBe(false);
      expect(parseSourceFormAction('{"type":"previewSources"}', current)).toBeNull();
    }
    expect(parseSourceFormAction('{"type":"editQuote","index":0,"quote":"B"}', { ...payload, busy: true })).toBeNull();
  });
});
