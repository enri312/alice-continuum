import { describe, expect, it } from "vitest";
import { parseRelationReview, type SavedRelationsPayload } from "./saved-relations-bridge";

const payload: SavedRelationsPayload = { busy: false, relations: [
  { id: "active", title: "A ↔ B", withdrawn: false, sourcesCurrent: true },
  { id: "blocked", title: "A ↔ C", withdrawn: true, sourcesCurrent: false },
] };

describe("selección de relaciones desde Dioxus", () => {
  it("permite pedir revisión pero rechaza confirmaciones, revisiones elegidas y relaciones ausentes", () => {
    expect(parseRelationReview('{"type":"reviewRelation","id":"active"}', payload)).toBe("active");
    for (const raw of ['null', '[]', '{}', 'invalid',
      '{"type":"reviewRelation","id":"active","confirmed":true}',
      '{"type":"reviewRelation","id":"active","expectedRevision":1}',
      '{"type":"confirm","id":"active"}', '{"type":"reviewRelation","id":"missing"}',
      '{"type":"reviewRelation","id":"blocked"}',
    ]) expect(parseRelationReview(raw, payload)).toBeNull();
  });
  it("revalida el bloqueo actual incluso si el evento procede de una vista anterior", () => {
    const action = '{"type":"reviewRelation","id":"active"}';
    expect(parseRelationReview(action, { ...payload, busy: true })).toBeNull();
    expect(parseRelationReview(action, { ...payload, relations: [] })).toBeNull();
    expect(parseRelationReview(action, { ...payload, relations: [{ ...payload.relations[0], withdrawn: true, sourcesCurrent: false }] })).toBeNull();
  });
});
