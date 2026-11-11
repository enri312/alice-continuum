import { describe, expect, it } from "vitest";
import type { CoreActivitySnapshot } from "./core-activity";
import { buildVolumeSignalSnapshot, VOLUME_SIGNAL_SNAPSHOT_MAX_AGE_MS } from "./volume-signals";

const now = 1_800_000_000_000;

function sample(): CoreActivitySnapshot {
  return {
    schemaVersion: 2,
    generatedAtMs: now,
    method: "r3-recency-motor-v2",
    heuristic: true,
    windowMs: 300_000,
    auditHealthy: true,
    visibleEventCount: 8,
    windowEventCount: 2,
    latestEventAtMs: now - 2_000,
    overallSignal: .25,
    regions: [
      { id: "permission", label: "Permisos", eventCount: 0, signal: 0, lastEventAtMs: null },
      { id: "perception", label: "Percepción", eventCount: 0, signal: 0, lastEventAtMs: null },
      { id: "memory", label: "Memoria", eventCount: 2, signal: .4, lastEventAtMs: now - 2_000 },
      { id: "language", label: "Lenguaje", eventCount: 0, signal: 0, lastEventAtMs: null },
      { id: "workspace", label: "Contexto", eventCount: 2, signal: .4, lastEventAtMs: now - 2_000 },
      { id: "output", label: "Salida", eventCount: 0, signal: 0, lastEventAtMs: null },
      { id: "motor", label: "Motor", eventCount: 0, signal: 0, lastEventAtMs: null },
    ],
    links: [
      { id: "permission-perception", from: "permission", to: "perception", evidenceCount: 0, signal: 0 },
      { id: "perception-workspace", from: "perception", to: "workspace", evidenceCount: 0, signal: 0 },
      { id: "memory-workspace", from: "memory", to: "workspace", evidenceCount: 2, signal: .4 },
      { id: "language-workspace", from: "language", to: "workspace", evidenceCount: 0, signal: 0 },
      { id: "workspace-output", from: "workspace", to: "output", evidenceCount: 0, signal: 0 },
    ],
  };
}

function withoutProcessSignals(): CoreActivitySnapshot {
  const activity = sample();
  return {
    ...activity,
    windowEventCount: 0,
    overallSignal: 0,
    latestEventAtMs: null,
    regions: activity.regions.map(region => ({ ...region, eventCount: 0, signal: 0, lastEventAtMs: null })),
    links: activity.links.map(link => ({ ...link, evidenceCount: 0, signal: 0 })),
  };
}

describe("evidencia visual de señales del volumen", () => {
  it("no fabrica rutas ni eventos cuando la fuente no existe", () => {
    const result = buildVolumeSignalSnapshot(null, false, now);
    expect(result).toMatchObject({ state: "unavailable", routes: [], recentEventCount: 0, animatable: false, generatedAt: null, lastEventAt: null });
  });

  it("conserva los datos recibidos y habilita sólo una ruta con evidencia y extremos activos", () => {
    const result = buildVolumeSignalSnapshot(sample(), true, now);
    expect(result).toMatchObject({ state: "live", recentEventCount: 2, overallSignal: .25, windowSeconds: 300, generatedAt: now, lastEventAt: now - 2_000, animatable: true });
    expect(result.routes.filter(route => route.animatable)).toEqual([
      { id: "memory-workspace", label: "Memoria → Contexto", from: "memory", to: "workspace", eventCount: 2, signal: .4, animatable: true },
    ]);
    expect(result.routes.every(route => !("lastEventAt" in route))).toBe(true);
  });

  it("distingue reposo de la ausencia de backend", () => {
    const result = buildVolumeSignalSnapshot(withoutProcessSignals(), true, now);
    expect(result.state).toBe("idle");
    expect(result.routes).toHaveLength(5);
    expect(result.animatable).toBe(false);
    expect(result.routes.every(route => !route.animatable)).toBe(true);
  });

  it("conserva eventos de gobierno sin convertirlos en actividad de procesos", () => {
    const result = buildVolumeSignalSnapshot({ ...withoutProcessSignals(), windowEventCount: 3 }, true, now);
    expect(result).toMatchObject({ state: "idle", recentEventCount: 3, overallSignal: 0, lastEventAt: null, animatable: false });
  });

  it("detiene una muestra congelada después de tres intervalos nominales sin ocultar su evidencia", () => {
    const result = buildVolumeSignalSnapshot(sample(), true, now + VOLUME_SIGNAL_SNAPSHOT_MAX_AGE_MS + 1);
    expect(result).toMatchObject({ state: "stale", recentEventCount: 2, overallSignal: .25, generatedAt: now, animatable: false });
    expect(result.routes.find(route => route.id === "memory-workspace")).toMatchObject({ signal: .4, eventCount: 2, animatable: false });
    expect(buildVolumeSignalSnapshot(sample(), true, now + VOLUME_SIGNAL_SNAPSHOT_MAX_AGE_MS).state).toBe("live");
  });

  it("no reactiva un evento vencido por recibir otra lectura con generatedAt nuevo", () => {
    const activity = sample();
    activity.latestEventAtMs = now - activity.windowMs - 1;
    expect(buildVolumeSignalSnapshot(activity, true, now)).toMatchObject({ state: "stale", generatedAt: now, lastEventAt: activity.latestEventAtMs, animatable: false });
  });

  it("presenta auditoría no verificable como error sin animar datos conservados", () => {
    const result = buildVolumeSignalSnapshot({ ...sample(), auditHealthy: false }, true, now);
    expect(result).toMatchObject({ state: "error", recentEventCount: 2, overallSignal: .25, animatable: false });
    expect(result.routes.every(route => !route.animatable)).toBe(true);
  });

  it("no trata la última muestra como disponible cuando la conexión dejó de estar lista", () => {
    const result = buildVolumeSignalSnapshot(sample(), false, now);
    expect(result).toMatchObject({ state: "unavailable", recentEventCount: 2, generatedAt: now, animatable: false });
    expect(result.routes.every(route => !route.animatable)).toBe(true);
  });

  it.each([
    { ...sample(), generatedAtMs: now + 1 },
    { ...sample(), latestEventAtMs: now + 1 },
    { ...sample(), windowMs: 0 },
    { ...sample(), regions: sample().regions.map(region => region.id === "memory" ? { ...region, lastEventAtMs: now + 1 } : region) },
  ])("rechaza tiempos incoherentes sin animaciones", activity => {
    const result = buildVolumeSignalSnapshot(activity, true, now);
    expect(result.state).toBe("error");
    expect(result.animatable).toBe(false);
    expect(result.routes.every(route => !route.animatable)).toBe(true);
  });

  it("no anima una ruta si uno de sus extremos ya no tiene evidencia vigente", () => {
    const activity = sample();
    activity.regions = activity.regions.map(region => region.id === "memory" ? { ...region, lastEventAtMs: now - activity.windowMs - 1 } : region);
    const result = buildVolumeSignalSnapshot(activity, true, now);
    expect(result.state).toBe("live");
    expect(result.routes.find(route => route.id === "memory-workspace")).toMatchObject({ eventCount: 2, signal: .4, animatable: false });
  });

  it("un evento global sin rutas o regiones no inventa un envío de señales", () => {
    const activity = { ...withoutProcessSignals(), windowEventCount: 1, overallSignal: .2, latestEventAtMs: now - 1_000 };
    const result = buildVolumeSignalSnapshot(activity, true, now);
    expect(result).toMatchObject({ state: "live", recentEventCount: 1, animatable: false });
    expect(result.routes.every(route => route.eventCount === 0 && !route.animatable)).toBe(true);
  });

  it("no cambia los registros originales ni usa el refresco como fecha de evento", () => {
    const activity = sample();
    const before = structuredClone(activity);
    const first = buildVolumeSignalSnapshot(activity, true, now);
    const next = buildVolumeSignalSnapshot({ ...activity, generatedAtMs: now + 5_000 }, true, now + 5_000);
    expect(activity).toEqual(before);
    expect(first.lastEventAt).toBe(next.lastEventAt);
    expect(next.recentEventCount).toBe(first.recentEventCount);
  });
});
