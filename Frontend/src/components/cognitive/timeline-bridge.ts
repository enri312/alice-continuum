import type { CognitiveEvent } from "../../core/cognitive/cognitive-events";

// Browser locale service only. Rust owns the visible window, geometry and selection.
export function buildTimelinePayload(events: CognitiveEvent[], selectedId: string) {
  const clock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { selectedId, events: events.map(event => {
    const timestampMs = Date.parse(event.createdAt);
    return { id: event.id, sequence: event.sequence, module: event.module, level: event.level,
      node: event.node, payload: event.payload, timestampMs,
      timeLabel: Number.isFinite(timestampMs) ? clock.format(new Date(timestampMs)) : "Fecha inválida" };
  }) };
}
