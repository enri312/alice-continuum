import { describe, expect, it } from "vitest";
import type { CognitiveEvent } from "../../core/cognitive/cognitive-events";
import { buildTimelinePayload } from "./timeline-bridge";

const event: CognitiveEvent = { id: "e", sequence: 7, createdAt: "2026-11-15T12:00:00.125Z", module: "MEMORY", level: "INFO", node: "LOADED", payload: "<img src=x onerror=alert(1)>" };
describe("frontera de la línea temporal Dioxus", () => {
  it("conserva todos los eventos y prepara únicamente fechas y etiquetas locales", () => {
    const events = Array.from({ length: 30 }, (_, index) => ({ ...event, id: `event-${index}`, sequence: index }));
    const value = buildTimelinePayload(events, "event-2");
    expect(value.events).toHaveLength(30);
    expect(value.selectedId).toBe("event-2");
    expect(value.events[0]).toMatchObject({ timestampMs: Date.parse(event.createdAt), payload: event.payload });
    expect(value.events[0].timeLabel).toBe(new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(event.createdAt)));
    const invalid = JSON.stringify(buildTimelinePayload([{ ...event, createdAt: "invalid" }], ""));
    expect(invalid).toContain('"timestampMs":null'); // Rust rejects the malformed source rather than inventing a time.
  });
});
