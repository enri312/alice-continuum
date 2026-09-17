import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BrainSnapshot } from "../../core/cognitive/brain";
import { applyCoreActivitySnapshot, parseCoreActivitySnapshot } from "../../core/cognitive/core-activity";
import type { CoreActivitySnapshot } from "../../core/cognitive/core-activity";

export type NucleusPageProps = { snapshot: BrainSnapshot; desktopApp: boolean };

export type NucleusActivityStatus = "loading" | "ready" | "unavailable";
export type NucleusActivityViewState = NucleusActivityStatus | "idle";

export function resolveNucleusActivityViewState(
  activity: CoreActivitySnapshot | null,
  activityStatus: NucleusActivityStatus,
): NucleusActivityViewState {
  if (activityStatus !== "ready") return activityStatus;
  return (activity?.windowEventCount ?? 0) > 0 ? "ready" : "idle";
}

export function useNucleusSnapshot({ snapshot, desktopApp }: NucleusPageProps) {
  const [activity, setActivity] = useState<CoreActivitySnapshot | null>(null);
  const [activityStatus, setActivityStatus] = useState<NucleusActivityStatus>(desktopApp ? "loading" : "unavailable");
  const effectiveSnapshot = useMemo(() => applyCoreActivitySnapshot(snapshot, activity), [activity, snapshot]);

  useEffect(() => {
    if (!desktopApp) return;
    let active = true;
    const refresh = async () => {
      try {
        const parsed = parseCoreActivitySnapshot(await invoke<unknown>("core_activity_snapshot"));
        if (active) { setActivity(parsed); setActivityStatus("ready"); }
      } catch {
        if (active) { setActivity(null); setActivityStatus("unavailable"); }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [desktopApp]);

  return { activity, activityStatus, effectiveSnapshot };
}

type NucleusFrameProps = {
  code: string;
  title: string;
  description: string;
  activity: CoreActivitySnapshot | null;
  activityStatus: NucleusActivityStatus;
  children: ReactNode;
  footnote: string;
};

type NucleusPageHeaderProps = Pick<NucleusFrameProps, "code" | "title" | "description" | "activity" | "activityStatus">;

const nucleusSignalLabel: Record<NucleusActivityViewState, string> = {
  loading: "cargando señal R3",
  unavailable: "señal R3 no disponible",
  idle: "sin señal R3 reciente",
  ready: "señal R3 reciente",
};

export function NucleusPageHeader({ code, title, description, activity, activityStatus }: NucleusPageHeaderProps) {
  const viewState = resolveNucleusActivityViewState(activity, activityStatus);

  return <div
    className={`neuro-heading nucleus-page-header is-${viewState}`}
    data-activity-state={viewState}
  >
    <div>
      <p className="eyebrow">{code} · ESTADO VERIFICABLE</p>
      <h2 id={`${code}-title`}>{title}</h2>
      <p className="nucleus-page-description">{description}</p>
    </div>
    <span
      className={`neuro-live ${viewState} is-${viewState}`}
      data-activity-state={viewState}
      data-signal-present={viewState === "ready"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={viewState === "loading"}
    >
      <i aria-hidden="true" />
      {nucleusSignalLabel[viewState]}
    </span>
  </div>;
}

type NucleusProvenanceBandProps = Pick<NucleusFrameProps, "activity" | "activityStatus">;

export function NucleusProvenanceBand({ activity, activityStatus }: NucleusProvenanceBandProps) {
  const viewState = resolveNucleusActivityViewState(activity, activityStatus);
  const auditState = activity ? (activity.auditHealthy ? "healthy" : "degraded") : "unknown";

  return <div
    className={`core-activity-provenance ${activityStatus} is-${viewState} ${auditState === "degraded" ? "degraded" : ""}`.trim()}
    data-activity-state={viewState}
    data-audit-state={auditState}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-busy={viewState === "loading"}
  >
    <strong>R3 · ACTIVIDAD DERIVADA</strong>
    <span>{activityStatus === "loading" ? "LEYENDO AUDITORÍA LOCAL…" : activityStatus === "unavailable" ? "SNAPSHOT NATIVO NO DISPONIBLE" : `${activity?.windowEventCount ?? 0} EVENTOS / ${Math.round((activity?.windowMs ?? 0) / 60_000)} MIN · SEÑAL ${(activity?.overallSignal ?? 0).toFixed(3)} · ${activity?.auditHealthy ? "AUDITORÍA ÍNTEGRA" : "AUDITORÍA CON LÍNEAS INVÁLIDAS"}`}</span>
    <small>HEURÍSTICA {activity?.method?.toUpperCase() ?? "R3-RECENCY-MOTOR-V2"} · NO ES EMOCIÓN NI CONCIENCIA</small>
  </div>;
}

export function NucleusFrame({ code, title, description, activity, activityStatus, children, footnote }: NucleusFrameProps) {
  return <section
    className="neuro-panel nucleus-page"
    data-activity-state={resolveNucleusActivityViewState(activity, activityStatus)}
    aria-labelledby={`${code}-title`}
  >
    <NucleusPageHeader
      code={code}
      title={title}
      description={description}
      activity={activity}
      activityStatus={activityStatus}
    />
    <NucleusProvenanceBand activity={activity} activityStatus={activityStatus} />
    {children}
    <p className="neuro-footnote">{footnote}</p>
  </section>;
}
