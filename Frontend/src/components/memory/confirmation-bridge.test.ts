import { describe, expect, it } from "vitest";
import { parseConfirmationAction, type ConfirmationPayload } from "./confirmation-bridge";

const pending: ConfirmationPayload = { kind: "change", token: "change-2", busy: false, quotes: [], withdrawn: false };
describe("confirmación pendiente Dioxus", () => {
  it("sólo admite la decisión actual sin datos elegidos por el renderer", () => {
    expect(parseConfirmationAction('{"type":"confirm","token":"change-2"}', pending)).toBe("confirm");
    expect(parseConfirmationAction('{"type":"cancel","token":"change-2"}', pending)).toBe("cancel");
    for (const raw of ['null','[]','invalid','{"type":"confirm","token":"change-1"}',
      '{"type":"confirm","token":"change-2","confirmed":true}',
      '{"type":"confirm","token":"change-2","expectedRevision":7}',
      '{"type":"confirm","token":"change-2","id":"other"}',
    ]) expect(parseConfirmationAction(raw,pending)).toBeNull();
  });
  it("rechaza eventos atrasados o bloqueados y conserva las acciones de cada pantalla", () => {
    const action = '{"type":"confirm","token":"change-2"}';
    expect(parseConfirmationAction(action,{ ...pending, busy: true })).toBeNull();
    expect(parseConfirmationAction(action,{ ...pending, token: "change-3" })).toBeNull();
    expect(parseConfirmationAction('{"type":"cancel","token":"change-2"}',{ ...pending, kind: "create" })).toBeNull();
  });
});
