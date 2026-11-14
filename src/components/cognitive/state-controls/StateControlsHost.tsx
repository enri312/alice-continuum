import { useState } from "react";
import { applyConversationBehavior, behaviorKeyForControl, type ConversationBehaviorKey, type ConversationBehaviorSettings } from "../../../core/conversation/behavior-settings";
import { useNucleusSnapshot, type NucleusPageProps } from "../../../pages/shared/nucleus-shared";
import { buildStateControlsPayload, type StateControlsAction } from "./bridge";
import { StateControlsFallback } from "./StateControlsFallback";
import { StateControlsView } from "./StateControlsView";

type StateControlsHostProps = NucleusPageProps & {
  behavior?: { settings: ConversationBehaviorSettings; supported: boolean; busy: boolean; onChange: (key: ConversationBehaviorKey, value: number) => void };
};

// Boundary between the React application and the Dioxus page; no page markup lives here.
export function StateControlsHost(props: StateControlsHostProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const snapshot = props.behavior ? applyConversationBehavior(effectiveSnapshot, props.behavior.settings, props.behavior.supported, props.behavior.busy) : effectiveSnapshot;
  const [selectedId, setSelectedId] = useState("state-curiosity");
  const behavior = props.behavior ? { settings: props.behavior.settings, supported: props.behavior.supported, busy: props.behavior.busy } : null;
  const payload = buildStateControlsPayload(effectiveSnapshot, selectedId, behavior, activity, activityStatus);
  const changeControl = (id: string, value: number) => {
    const key = behaviorKeyForControl(id);
    if (key && props.behavior?.supported && !props.behavior.busy) props.behavior.onChange(key, value);
  };
  const handleAction = (action: StateControlsAction) => {
    setSelectedId(action.id);
    if (action.type === "changeBehavior") changeControl(action.id, action.value);
  };
  return <StateControlsView payload={payload} onAction={handleAction} fallback={
    <StateControlsFallback snapshot={snapshot} activity={activity} activityStatus={activityStatus} selectedId={selectedId} onSelect={setSelectedId} onControlChange={props.behavior ? changeControl : undefined} />
  } />;
}
