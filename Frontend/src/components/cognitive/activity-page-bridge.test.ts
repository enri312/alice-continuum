import { describe, expect, it } from "vitest";
import type { CognitiveEvent } from "../../core/cognitive/cognitive-events";
import { buildActivityPagePayload, parseActivityAction } from "./activity-page-bridge";

const events: CognitiveEvent[] = [{ id: "one", sequence: 1, createdAt: "2026-11-15T12:00:00.123Z",
  module: "MEMORY", level: "INFO", node: "ÁRBOL", payload: "<b>literal</b>" }];
describe("frontera de Actividad Dioxus", () => {
  it("entrega todos los eventos con ambos relojes locales y el estado de reintento", () => {
    const original = JSON.stringify(events);
    const settings = { view: "events" as const, module: "MEMORY" as const, query: "ÁRBOL", selectedId: "one" };
    const payload = buildActivityPagePayload(events, "audit", settings);
    expect(payload.timeline.events[0]).toMatchObject({ id: "one", timestampMs: Date.parse(events[0].createdAt), payload: "<b>literal</b>" });
    expect(payload.streamTimes[0]).toMatch(/123/);
    expect(payload.settings).toEqual({ view: "events", module: "MEMORY", query: "ÁRBOL" });
    expect(payload.timeline.selectedId).toBe("one");
    expect(buildActivityPagePayload([], "events", null)).toMatchObject({ settings: null, requestedView: "events", streamTimes: [] });
    expect(JSON.stringify(events)).toBe(original);
  });
  it("sólo admite vaciar la vista con fuente vigente y estados cerrados", () => {
    expect(parseActivityAction('{"type":"clear"}', events)).toBe("clear");
    expect(parseActivityAction('{"type":"clear"}', [])).toBeNull();
    const state = { type: "state", view: "events", module: "MEMORY", query: "hola", selectedId: "one" };
    expect(parseActivityAction(JSON.stringify(state), events)).toEqual({ view: "events", module: "MEMORY", query: "hola", selectedId: "one" });
    expect(parseActivityAction(JSON.stringify(state), [])).toMatchObject({ query: "hola", selectedId: "" });
    for (const invalid of [{ ...state, view: "audit" }, { ...state, module: "ROOT" }, { ...state, query: "x".repeat(8193) },
      { ...state, command: "audit_snapshot" }, { type: "clear", id: "one" }, [], null, { type: "invoke" }]) {
      expect(parseActivityAction(JSON.stringify(invalid), events)).toBeNull();
    }
    expect(parseActivityAction("invalid", events)).toBeNull();
  });
});
