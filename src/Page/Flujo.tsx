import { useState } from "react";
import { CognitiveFlow } from "../components/CognitiveFlow";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Flujo(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [selectedId, setSelectedId] = useState("flow-input");
  const selected = effectiveSnapshot.flowNodes.find((node) => node.id === selectedId) ?? effectiveSnapshot.flowNodes[0];
  return <NucleusFrame code="[02]" title="Flujo cognitivo" description="Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida." activity={activity} activityStatus={activityStatus} footnote="Los enlaces se iluminan solo cuando tienen evidencia R3 reciente. Las rutas futuras continúan visibles como planificadas y no representan actividad real.">
    <div className="neuro-layout"><div className="neuro-stage"><CognitiveFlow snapshot={effectiveSnapshot} activity={activity} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value}</span><p>{selected.detail}</p><small>La activación es una señal técnica derivada, no una experiencia interna.</small></aside></div>
  </NucleusFrame>;
}
