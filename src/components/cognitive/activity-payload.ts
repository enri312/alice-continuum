import { hasCoreActivitySignal, type CoreActivitySnapshot } from "../../core/cognitive/core-activity";

export function buildActivityPayload(activity: CoreActivitySnapshot | null, status: "loading" | "ready" | "unavailable") {
  return {
    status, signalPresent: hasCoreActivitySignal(activity),
    auditHealthy: activity?.auditHealthy ?? null,
    windowEventCount: activity?.windowEventCount ?? 0,
    windowMs: activity?.windowMs ?? 0,
    overallSignal: activity?.overallSignal ?? 0,
    method: activity?.method ?? null,
  };
}
