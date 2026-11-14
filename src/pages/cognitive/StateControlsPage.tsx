import { useState } from "react";
import { InternalState } from "../../components/cognitive/InternalState";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "../shared/nucleus-shared";
import { applyConversationBehavior, behaviorKeyForControl } from "../../core/conversation/behavior-settings";
import type { ConversationBehaviorKey, ConversationBehaviorSettings } from "../../core/conversation/behavior-settings";

type StateControlsProps = NucleusPageProps & {
  behavior?: { settings: ConversationBehaviorSettings; supported: boolean; busy: boolean; onChange: (key: ConversationBehaviorKey, value: number) => void };
};

export function Estado(props: StateControlsProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const snapshot = props.behavior ? applyConversationBehavior(effectiveSnapshot, props.behavior.settings, props.behavior.supported, props.behavior.busy) : effectiveSnapshot;
  const [selectedId, setSelectedId] = useState("state-curiosity");
  const selected = snapshot.stateMetrics.find((metric) => metric.id === selectedId)
    ?? snapshot.behaviorControls.find((control) => control.id === selectedId)
    ?? snapshot.stateMetrics[0];
  return <NucleusFrame code="[03]" title="Estado y controles" description="Señales verificables, memoria recuperada y ajustes disponibles para el próximo envío." activity={activity} activityStatus={activityStatus} footnote="Los ajustes de estilo no conceden permisos. Las señales técnicas no representan emociones ni conciencia; los módulos pendientes conservan su bloqueo.">
    <div className="neuro-layout"><div className="neuro-stage"><InternalState snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} onControlChange={props.behavior ? (id, value) => { const key = behaviorKeyForControl(id); if (key && props.behavior?.supported && !props.behavior.busy) props.behavior.onChange(key, value); } : undefined} /></div><aside className="neuro-inspector"><p className="eyebrow">INSPECTOR</p><h3>{selected.label}</h3><span className="inspector-value">{selected.value.toFixed(3)}</span><p>{selected.detail}</p><small>Creatividad y estilo empático se aplican a la conversación local. Los controles bloqueados conservan sus límites.</small></aside></div>
  </NucleusFrame>;
}
