import { useState } from "react";
import { InternalState } from "../components/InternalState";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Estado(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [selectedId, setSelectedId] = useState("state-curiosity");
  const selected = effectiveSnapshot.stateMetrics.find((metric) => metric.id === selectedId)
    ?? effectiveSnapshot.behaviorControls.find((control) => control.id === selectedId)
    ?? effectiveSnapshot.stateMetrics[0];
  return <NucleusFrame code="[03]" title="Estado y controles" description="Indicadores implementados, valores planificados y controles aún bloqueados." activity={activity} activityStatus={activityStatus} footnote="Permisos y memoria muestran señal técnica R3; las emociones y controles no implementados permanecen en cero. Ningún indicador prueba una experiencia interna.">
    <div className="neuro-layout"><div className="neuro-stage"><InternalState snapshot={effectiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value.toFixed(3)}</span><p>{selected.detail}</p><small>Los controles bloqueados no cambian el comportamiento de Alice.</small></aside></div>
  </NucleusFrame>;
}
