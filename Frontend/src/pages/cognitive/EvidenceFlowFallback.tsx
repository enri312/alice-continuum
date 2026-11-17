import { useState } from "react";
import { CognitiveFlow } from "../../components/cognitive/CognitiveFlow";
import { CognitiveFlowDioxus } from "../../components/cognitive/CognitiveFlowDioxus";
import { MemoryAssociations } from "../../components/memory/MemoryAssociations";
import { NucleusPageHeader, NucleusProvenanceBand, resolveNucleusActivityViewState, type NucleusPageProps, useNucleusSnapshot } from "../shared/nucleus-shared";

// Recovery page only. The normal page and its R3 subscription are owned by Dioxus.
export function EvidenceFlowFallback(props: NucleusPageProps & { initialSelectedId?: string }) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [selectedId, setSelectedId] = useState(props.initialSelectedId ?? "flow-input");
  const selected = effectiveSnapshot.flowNodes.find((node) => node.id === selectedId) ?? effectiveSnapshot.flowNodes[0];
  return <section className="neuro-panel nucleus-page" data-activity-state={resolveNucleusActivityViewState(activity, activityStatus)} aria-labelledby="[02]-title">
    <CognitiveFlowDioxus snapshot={effectiveSnapshot} activity={activity} activityStatus={activityStatus} selectedId={selectedId} onSelect={setSelectedId} fallback={<>
      <NucleusPageHeader code="[02]" title="Flujo cognitivo" description="Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida." activity={activity} activityStatus={activityStatus} />
      <NucleusProvenanceBand activity={activity} activityStatus={activityStatus} />
      <div className="neuro-layout">
        <div className="neuro-stage"><CognitiveFlow snapshot={effectiveSnapshot} activity={activity} activityStatus={activityStatus} selectedId={selectedId} onSelect={setSelectedId} /></div>
        <aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value}</span><p>{selected.detail}</p><small>La activación es una señal técnica derivada, no una experiencia interna.</small></aside>
      </div>
    </>} />
    <MemoryAssociations desktopApp={props.desktopApp} />
    <p className="neuro-footnote">Los enlaces se iluminan solo cuando tienen evidencia R3 reciente. Las rutas futuras continúan visibles como planificadas y no representan actividad real.</p>
  </section>;
}
