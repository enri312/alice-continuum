import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BrainSnapshot } from "../core/brain";
import { applyCoreActivitySnapshot, parseCoreActivitySnapshot } from "../core/core-activity";
import type { CoreActivitySnapshot } from "../core/core-activity";

export type NucleusPageProps = { snapshot: BrainSnapshot; desktopApp: boolean };

export function useNucleusSnapshot({ snapshot, desktopApp }: NucleusPageProps) {
  const [activity, setActivity] = useState<CoreActivitySnapshot | null>(null);
  const [activityStatus, setActivityStatus] = useState<"loading" | "ready" | "unavailable">(desktopApp ? "loading" : "unavailable");
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
  activityStatus: "loading" | "ready" | "unavailable";
  children: ReactNode;
  footnote: string;
};

export function NucleusFrame({ code, title, description, activity, activityStatus, children, footnote }: NucleusFrameProps) {
  return <section className="neuro-panel nucleus-page" aria-labelledby={`${code}-title`}>
    <div className="neuro-heading">
      <div><p className="eyebrow">{code} · ESTADO VERIFICABLE</p><h2 id={`${code}-title`}>{title}</h2><p className="nucleus-page-description">{description}</p></div>
      <span className={`neuro-live ${activity?.windowEventCount ? "" : "idle"}`}><i />{activity?.windowEventCount ? "señal R3 reciente" : "sin señal R3 reciente"}</span>
    </div>
    <div className={`core-activity-provenance ${activityStatus} ${activity && !activity.auditHealthy ? "degraded" : ""}`} role="status">
      <strong>R3 · ACTIVIDAD DERIVADA</strong>
      <span>{activityStatus === "loading" ? "LEYENDO AUDITORÍA LOCAL…" : activityStatus === "unavailable" ? "SNAPSHOT NATIVO NO DISPONIBLE" : `${activity?.windowEventCount ?? 0} EVENTOS / ${Math.round((activity?.windowMs ?? 0) / 60_000)} MIN · SEÑAL ${(activity?.overallSignal ?? 0).toFixed(3)} · ${activity?.auditHealthy ? "AUDITORÍA ÍNTEGRA" : "AUDITORÍA CON LÍNEAS INVÁLIDAS"}`}</span>
      <small>HEURÍSTICA {activity?.method?.toUpperCase() ?? "R3-RECENCY-MOTOR-V2"} · NO ES EMOCIÓN NI CONCIENCIA</small>
    </div>
    {children}
    <p className="neuro-footnote">{footnote}</p>
  </section>;
}
