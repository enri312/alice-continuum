import { useState } from "react";
import { ActionPlanner, plannerInspectorItems, type PlannerItemId } from "../components/ActionPlanner";
import { TaskRegistryPanel } from "../components/TaskRegistryPanel";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Planificador(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [selectedId, setSelectedId] = useState<PlannerItemId>("planner-response");
  const selected = plannerInspectorItems[selectedId] ?? plannerInspectorItems["planner-response"]!;
  return <NucleusFrame code="[04]" title="Planificador de acción" description="Área reservada para explicar decisiones cognitivas y revisar intenciones temporales gobernadas por el propietario." activity={activity} activityStatus={activityStatus} footnote="El planificador cognitivo no inventa intención, utilidad, riesgo ni novedad. R7 sólo persiste un recordatorio después de una revisión y confirmación explícitas; todavía no lo ejecuta.">
    <div className="neuro-layout"><div className="neuro-stage"><ActionPlanner snapshot={effectiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value}</span><p>{selected.detail}</p><small>La pantalla es descriptiva; no genera, selecciona ni ejecuta respuestas.</small></aside></div>
    <TaskRegistryPanel desktopApp={props.desktopApp} />
  </NucleusFrame>;
}
