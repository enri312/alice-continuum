import { useState } from "react";
import type { BrainSnapshot } from "../core/brain";
import { NeuralVolume } from "../components/NeuralVolume";
import { CognitiveFlow } from "../components/CognitiveFlow";
import { InternalState } from "../components/InternalState";
import { ActionPlanner, plannerInspectorItems } from "../components/ActionPlanner";
import { NucleusViewIcon } from "../components/NucleusViewIcon";

type NucleoProps = { snapshot: BrainSnapshot };
type NucleusView = "volume" | "flow" | "state" | "planner";

export function Nucleo({ snapshot }: NucleoProps) {
  const requestedView = new URLSearchParams(window.location.search).get("nucleoView");
  const initialView: NucleusView = requestedView === "flow" || requestedView === "state" || requestedView === "planner" ? requestedView : "volume";
  const [view, setView] = useState<NucleusView>(initialView);
  const [selectedId, setSelectedId] = useState(initialView === "flow" ? "flow-input" : initialView === "state" ? "state-curiosity" : initialView === "planner" ? "planner-response" : "volume-summary");
  const plannerSelected = plannerInspectorItems[selectedId];
  const selected = selectedId === "volume-summary"
    ? { label: "Matriz cognitivo-afectiva", value: `${snapshot.persistentMemoryCount} recuerdos`, detail: "Solo se dibuja la fracción de estructura respaldada por recuerdos o actividad real. El brillo y los pulsos representan actividad temporal; los colores identifican canales afectivos todavía apagados." }
    : plannerSelected
      ?? snapshot.nodes.find((node) => node.id === selectedId)
      ?? snapshot.flowNodes.find((node) => node.id === selectedId)
      ?? snapshot.stateMetrics.find((metric) => metric.id === selectedId)
      ?? snapshot.behaviorControls.find((control) => control.id === selectedId)
      ?? snapshot.nodes[0];
  const selectedValue = typeof selected.value === "number" ? selected.value.toFixed(3) : selected.value;

  function changeView(next: NucleusView) {
    setView(next);
    setSelectedId(next === "volume" ? "volume-summary" : next === "flow" ? "flow-input" : next === "state" ? "state-curiosity" : "planner-response");
  }

  return (
    <section className="neuro-panel" aria-labelledby="neuro-title">
      <div className="neuro-heading"><div><p className="eyebrow">NEURO · ESTADO VERIFICABLE</p><h2 id="neuro-title">Núcleo de Alice</h2></div><span className={`neuro-live ${snapshot.hasActivity ? "" : "idle"}`}><i />{snapshot.hasActivity ? "datos locales" : "sin actividad"}</span></div>
      <div className="neuro-view-tabs" role="tablist" aria-label="Visualizaciones del Núcleo">
        <button role="tab" aria-label="Volumen neuronal" data-tooltip="Volumen neuronal" aria-selected={view === "volume"} className={view === "volume" ? "selected" : ""} onClick={() => changeView("volume")}><NucleusViewIcon kind="volume" active={view === "volume"} /><span className="neuro-view-label">Volumen neuronal</span></button>
        <button role="tab" aria-label="Flujo cognitivo" data-tooltip="Flujo cognitivo" aria-selected={view === "flow"} className={view === "flow" ? "selected" : ""} onClick={() => changeView("flow")}><NucleusViewIcon kind="flow" active={view === "flow"} /><span className="neuro-view-label">Flujo cognitivo</span></button>
        <button role="tab" aria-label="Estado y controles" data-tooltip="Estado y controles" aria-selected={view === "state"} className={view === "state" ? "selected" : ""} onClick={() => changeView("state")}><NucleusViewIcon kind="state" active={view === "state"} /><span className="neuro-view-label">Estado y controles</span></button>
        <button role="tab" aria-label="Planificador" data-tooltip="Planificador" aria-selected={view === "planner"} className={view === "planner" ? "selected" : ""} onClick={() => changeView("planner")}><NucleusViewIcon kind="planner" active={view === "planner"} /><span className="neuro-view-label">Planificador</span></button>
      </div>
      <div className="neuro-layout">
        <div className="neuro-stage" aria-label="Mapa de contexto de Alice">
          {view === "volume" ? <>
            <NeuralVolume snapshot={snapshot} />
          </> : view === "flow" ? <CognitiveFlow snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} /> : view === "state" ? <InternalState snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} /> : <ActionPlanner snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
        <aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selectedValue}</span><p>{selected.detail}</p><small>Este indicador representa datos implementados o una capacidad futura claramente marcada; no prueba emociones ni conciencia.</small></aside>
      </div>
      <p className="neuro-footnote">{view === "volume" ? "La red persistente crece con recuerdos locales autorizados. Podés girar, mover y ampliar la vista sin alterar sus datos. La paleta afectiva identifica futuros circuitos de Alegría, Tristeza, Ira, Temor, Desagrado, Ansiedad, Envidia, Aburrimiento, Vergüenza y Nostalgia; todos continúan en 0.00 hasta que exista un simulador auditable. La estructura visible no equivale a actividad ni a conciencia." : view === "flow" ? "El flujo muestra por separado qué módulos participaron. Un valor 0.000 significa que no existe actividad registrada; los módulos futuros permanecen apagados." : view === "state" ? "Las señales internas comienzan en cero. Los controles son de solo lectura y no se activarán hasta que su comportamiento esté realmente conectado al sistema." : "El Planificador comienza vacío. No mostrará intención, utilidad, riesgo, novedad ni una traza hasta que cada dato provenga de un cálculo implementado y auditable."}</p>
    </section>
  );
}
