import { useState } from "react";
import { ActionPlanner, plannerInspectorItems, type PlannerItemId } from "../components/ActionPlanner";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Planificador(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [selectedId, setSelectedId] = useState<PlannerItemId>("planner-response");
  const selected = plannerInspectorItems[selectedId] ?? plannerInspectorItems["planner-response"]!;
  return <NucleusFrame code="[04]" title="Planificador de acción" description="Área reservada para comparar candidatas y explicar una decisión futura." activity={activity} activityStatus={activityStatus} footnote="R3 acredita operaciones técnicas, pero no inventa intención, utilidad, riesgo, novedad ni decisiones que todavía no se calculan.">
    <div className="neuro-layout"><div className="neuro-stage"><ActionPlanner snapshot={effectiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value}</span><p>{selected.detail}</p><small>La pantalla es descriptiva; no genera, selecciona ni ejecuta respuestas.</small></aside></div>
  </NucleusFrame>;
}
