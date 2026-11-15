import type { CognitiveEvent, CognitiveModule } from "../../core/cognitive/cognitive-events";
import { buildTimelinePayload } from "./timeline-bridge";

export type ActivityRecovery = { view: "timeline" | "events"; module: CognitiveModule | "ALL"; query: string; selectedId: string };
export function buildActivityPagePayload(events: CognitiveEvent[], requestedView: string, recovery: ActivityRecovery | null) {
  const clock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
  return { timeline: buildTimelinePayload(events, recovery?.selectedId ?? ""), requestedView,
    settings: recovery ? { view: recovery.view, module: recovery.module, query: recovery.query } : null,
    streamTimes: events.map(event => { const ms = Date.parse(event.createdAt); return Number.isFinite(ms) ? clock.format(new Date(ms)) : "Fecha inválida"; }),
  };
}
export function parseActivityAction(raw: string, events: CognitiveEvent[]): ActivityRecovery | "clear" | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).length === 1 && item.type === "clear") return events.length ? "clear" : null;
    if (Object.keys(item).sort().join(",") !== "module,query,selectedId,type,view" || item.type !== "state"
      || !["timeline", "events"].includes(item.view as string)
      || !["ALL", "SYSTEM", "PERCEPTION", "MEMORY", "WORKSPACE", "OUTPUT", "SECURITY"].includes(item.module as string)
      || typeof item.query !== "string" || item.query.length > 8192 || typeof item.selectedId !== "string" || item.selectedId.length > 128) return null;
    return { view: item.view as ActivityRecovery["view"], module: item.module as ActivityRecovery["module"], query: item.query,
      selectedId: events.some(event => event.id === item.selectedId) ? item.selectedId : "" };
  } catch { return null; }
}
