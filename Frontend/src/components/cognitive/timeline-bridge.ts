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
export function parseTimelineSelection(raw: string, events: CognitiveEvent[]): string | null {
  try {
    const event: unknown = JSON.parse(raw);
    if (!event || typeof event !== "object" || Array.isArray(event)) return null;
    const item = event as Record<string, unknown>;
    if (Object.keys(item).length === 2 && item.type === "select" && typeof item.id === "string"
      && events.some(event => event.id === item.id)) return item.id;
  } catch { /* Malformed callbacks never change the retry selection. */ }
  return null;
}
