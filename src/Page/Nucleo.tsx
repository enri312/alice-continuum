import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BrainSnapshot } from "../core/brain";
import { applyCoreActivitySnapshot, parseCoreActivitySnapshot } from "../core/core-activity";
import type { CoreActivitySnapshot } from "../core/core-activity";
import { NeuralVolume } from "../components/NeuralVolume";
import { CognitiveFlow } from "../components/CognitiveFlow";
import { InternalState } from "../components/InternalState";
import { ActionPlanner, plannerInspectorItems } from "../components/ActionPlanner";
import { NucleusViewIcon } from "../components/NucleusViewIcon";

type NucleoProps = { snapshot: BrainSnapshot; desktopApp: boolean };
type NucleusView = "volume" | "flow" | "state" | "planner";

export function Nucleo({ snapshot, desktopApp }: NucleoProps) {
  const requestedView = new URLSearchParams(window.location.search).get("nucleoView");
  const initialView: NucleusView = requestedView === "flow" || requestedView === "state" || requestedView === "planner" ? requestedView : "volume";
  const [view, setView] = useState<NucleusView>(initialView);
  const [selectedId, setSelectedId] = useState(initialView === "flow" ? "flow-input" : initialView === "state" ? "state-curiosity" : initialView === "planner" ? "planner-response" : "volume-summary");
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

  const plannerSelected = plannerInspectorItems[selectedId];
  const selected = selectedId === "volume-summary"
    ? { label: "Matriz cognitivo-afectiva", value: `${effectiveSnapshot.persistentMemoryCount} recuerdos`, detail: "La estructura depende de memoria local. El brillo temporal se deriva de eventos R3 mediante una heurística de recencia explícita; no representa emociones ni conciencia." }
    : plannerSelected
      ?? effectiveSnapshot.nodes.find((node) => node.id === selectedId)
      ?? effectiveSnapshot.flowNodes.find((node) => node.id === selectedId)
      ?? effectiveSnapshot.stateMetrics.find((metric) => metric.id === selectedId)
      ?? effectiveSnapshot.behaviorControls.find((control) => control.id === selectedId)
      ?? effectiveSnapshot.nodes[0];
  const selectedValue = typeof selected.value === "number" ? selected.value.toFixed(3) : selected.value;

  function changeView(next: NucleusView) {
    setView(next);
    setSelectedId(next === "volume" ? "volume-summary" : next === "flow" ? "flow-input" : next === "state" ? "state-curiosity" : "planner-response");
  }

  return (
    <section className="neuro-panel" aria-labelledby="neuro-title">
      <div className="neuro-heading"><div><p className="eyebrow">NEURO · ESTADO VERIFICABLE</p><h2 id="neuro-title">Núcleo de Alice</h2></div><span className={`neuro-live ${activity?.windowEventCount ? "" : "idle"}`}><i />{activity?.windowEventCount ? "señal R3 reciente" : effectiveSnapshot.persistentMemoryCount ? "estructura local" : "sin actividad"}</span></div>
      <div className={`core-activity-provenance ${activityStatus} ${activity && !activity.auditHealthy ? "degraded" : ""}`} role="status">
        <strong>R3 · ACTIVIDAD DERIVADA</strong>
        <span>{activityStatus === "loading" ? "LEYENDO AUDITORÍA LOCAL…" : activityStatus === "unavailable" ? "SNAPSHOT NATIVO NO DISPONIBLE" : `${activity?.windowEventCount ?? 0} EVENTOS / ${Math.round((activity?.windowMs ?? 0) / 60_000)} MIN · SEÑAL ${(activity?.overallSignal ?? 0).toFixed(3)} · ${activity?.auditHealthy ? "AUDITORÍA ÍNTEGRA" : "AUDITORÍA CON LÍNEAS INVÁLIDAS"}`}</span>
        <small>HEURÍSTICA {activity?.method?.toUpperCase() ?? "R3-RECENCY-V1"} · NO ES EMOCIÓN NI CONCIENCIA</small>
      </div>
      <div className="neuro-view-tabs" role="tablist" aria-label="Visualizaciones del Núcleo">
        <button role="tab" aria-label="Volumen neuronal" data-tooltip="Volumen neuronal" aria-selected={view === "volume"} className={view === "volume" ? "selected" : ""} onClick={() => changeView("volume")}><NucleusViewIcon kind="volume" active={view === "volume"} /><span className="neuro-view-label">Volumen neuronal</span></button>
        <button role="tab" aria-label="Flujo cognitivo" data-tooltip="Flujo cognitivo" aria-selected={view === "flow"} className={view === "flow" ? "selected" : ""} onClick={() => changeView("flow")}><NucleusViewIcon kind="flow" active={view === "flow"} /><span className="neuro-view-label">Flujo cognitivo</span></button>
        <button role="tab" aria-label="Estado y controles" data-tooltip="Estado y controles" aria-selected={view === "state"} className={view === "state" ? "selected" : ""} onClick={() => changeView("state")}><NucleusViewIcon kind="state" active={view === "state"} /><span className="neuro-view-label">Estado y controles</span></button>
        <button role="tab" aria-label="Planificador" data-tooltip="Planificador" aria-selected={view === "planner"} className={view === "planner" ? "selected" : ""} onClick={() => changeView("planner")}><NucleusViewIcon kind="planner" active={view === "planner"} /><span className="neuro-view-label">Planificador</span></button>
      </div>
      <div className="neuro-layout">
        <div className="neuro-stage" aria-label="Mapa de contexto de Alice">
          {view === "volume" ? <>
            <NeuralVolume snapshot={effectiveSnapshot} activity={activity} />
          </> : view === "flow" ? <CognitiveFlow snapshot={effectiveSnapshot} activity={activity} selectedId={selectedId} onSelect={setSelectedId} /> : view === "state" ? <InternalState snapshot={effectiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /> : <ActionPlanner snapshot={effectiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
        <aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selectedValue}</span><p>{selected.detail}</p><small>Este indicador representa datos implementados o una capacidad futura claramente marcada; no prueba emociones ni conciencia.</small></aside>
      </div>
      <p className="neuro-footnote">{view === "volume" ? "La estructura persistente crece únicamente con recuerdos locales autorizados. La señal efímera usa eventos R3 de los últimos cinco minutos y decae hasta cero; su porcentaje es una heurística técnica reproducible. La paleta afectiva continúa en 0.00 hasta que exista un simulador auditable." : view === "flow" ? "Las regiones y enlaces sólo se iluminan cuando una ruta cuenta con eventos R3 recientes. Un valor 0.000 significa ausencia de evidencia en la ventana, no ausencia absoluta de procesamiento." : view === "state" ? "Permisos y memoria muestran señal técnica R3; las emociones y controles no implementados permanecen en cero. Ningún indicador prueba una experiencia interna." : "El Planificador continúa vacío. R3 acredita operaciones técnicas, pero no inventa intención, utilidad, riesgo, novedad ni decisiones que todavía no se calculan."}</p>
    </section>
  );
}
