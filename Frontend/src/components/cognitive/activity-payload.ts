import { hasCoreActivitySignal, type CoreActivitySnapshot } from "../../core/cognitive/core-activity";

export type NucleusActivityStatus = "loading" | "ready" | "unavailable";

export function buildActivityPayload(activity: CoreActivitySnapshot | null, status: NucleusActivityStatus) {
  return {
    status, signalPresent: hasCoreActivitySignal(activity),
    auditHealthy: activity?.auditHealthy ?? null,
    windowEventCount: activity?.windowEventCount ?? 0,
    windowMs: activity?.windowMs ?? 0,
    overallSignal: activity?.overallSignal ?? 0,
    method: activity?.method ?? null,
  };
}
