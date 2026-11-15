import type { CoreActivityLinkId, CoreActivityRegionId, CoreActivitySnapshot } from "./core-activity";

// Three nominal five-second polls. This is a display freshness budget, not
// another event window or a measure of the model's processing time.
export const VOLUME_SIGNAL_SNAPSHOT_MAX_AGE_MS = 15_000;

export type VolumeSignalState = "live" | "idle" | "stale" | "unavailable" | "error";

export type VolumeSignalRoute = {
  id: CoreActivityLinkId;
  label: string;
  from: CoreActivityRegionId;
  to: CoreActivityRegionId;
  eventCount: number;
  signal: number;
  animatable: boolean;
};

export type VolumeSignalSnapshot = {
  state: VolumeSignalState;
  recentEventCount: number;
  overallSignal: number;
  windowSeconds: number;
  generatedAt: number | null;
  lastEventAt: number | null;
  animatable: boolean;
  routes: VolumeSignalRoute[];
  description: string;
};

const routeLabels: Record<CoreActivityLinkId, string> = {
  "permission-perception": "Permisos → Percepción",
  "perception-workspace": "Percepción → Contexto",
  "memory-workspace": "Memoria → Contexto",
  "language-workspace": "Lenguaje → Contexto",
  "workspace-output": "Contexto → Salida",
};

type SignalAssessment = { state: VolumeSignalState; description: string };

function assess(activity: CoreActivitySnapshot | null, available: boolean, nowMs: number): SignalAssessment {
  if (!available || !activity) {
    return { state: "unavailable", description: "La fuente de actividad registrada no está disponible. No se generan eventos para sustituirla." };
  }
  if (!activity.auditHealthy) {
    return { state: "error", description: "La auditoría no pudo verificarse. La muestra recibida se conserva como referencia, sin animar señales." };
  }
  const { generatedAtMs, latestEventAtMs, windowMs } = activity;
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0
    || !Number.isSafeInteger(generatedAtMs) || generatedAtMs <= 0
    || !Number.isSafeInteger(windowMs) || windowMs <= 0
    || generatedAtMs > nowMs
    || (latestEventAtMs !== null && (!Number.isSafeInteger(latestEventAtMs) || latestEventAtMs <= 0 || latestEventAtMs > generatedAtMs))
    || activity.regions.some(region => region.lastEventAtMs !== null
      && (!Number.isSafeInteger(region.lastEventAtMs) || region.lastEventAtMs <= 0 || region.lastEventAtMs > generatedAtMs))) {
    return { state: "error", description: "Las fechas de la muestra son incoherentes. Las señales permanecen detenidas." };
  }
  if (nowMs - generatedAtMs > VOLUME_SIGNAL_SNAPSHOT_MAX_AGE_MS) {
    return { state: "stale", description: "La muestra dejó de actualizarse durante más de 15 segundos. Se muestran sus datos anteriores sin animarlos." };
  }
  if (latestEventAtMs !== null && nowMs - latestEventAtMs > windowMs) {
    return { state: "stale", description: "La evidencia recibida ya está fuera de la ventana de actividad. Se conserva como referencia, sin animación." };
  }
  // Procedure/governance events can legitimately contribute to the event count
  // without producing regional signals or a latest cognitive-event timestamp.
  if (activity.overallSignal <= 0 || activity.windowEventCount === 0 || latestEventAtMs === null) {
    return { state: "idle", description: "No hay señal de procesos en la ventana registrada. Un evento de gobierno no implica actividad cognitiva." };
  }
  return { state: "live", description: "Hay evidencia R3 reciente. Los pulsos ilustran rutas registradas, no señales internas del modelo ni actividad cerebral biológica." };
}

export function buildVolumeSignalSnapshot(
  activity: CoreActivitySnapshot | null,
  available: boolean,
  nowMs = Date.now(),
): VolumeSignalSnapshot {
  const assessment = assess(activity, available, nowMs);
  const usableRegions = new Set(activity?.regions.filter(region =>
    assessment.state === "live" && region.eventCount > 0 && region.signal > 0
    && region.lastEventAtMs !== null && nowMs - region.lastEventAtMs <= activity.windowMs,
  ).map(region => region.id));
  const routes = activity?.links.map(link => ({
    id: link.id,
    label: routeLabels[link.id],
    from: link.from,
    to: link.to,
    eventCount: link.evidenceCount,
    signal: link.signal,
    animatable: assessment.state === "live" && link.evidenceCount > 0 && link.signal > 0
      && usableRegions.has(link.from) && usableRegions.has(link.to),
  })) ?? [];

  return {
    ...assessment,
    recentEventCount: activity?.windowEventCount ?? 0,
    overallSignal: activity?.overallSignal ?? 0,
    windowSeconds: activity ? activity.windowMs / 1_000 : 0,
    generatedAt: activity?.generatedAtMs ?? null,
    lastEventAt: activity?.latestEventAtMs ?? null,
    animatable: assessment.state === "live" && usableRegions.size > 0,
    routes,
  };
}
