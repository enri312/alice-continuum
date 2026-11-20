import { useState } from "react";
import { applyConversationBehavior, behaviorKeyForControl } from "../../../../core/conversation/behavior-settings";
import { useNucleusSnapshot } from "../../../pages/shared/nucleus-shared";
import type { StateControlsHostProps } from "./StateControlsHost";
import { StateControlsFallback } from "./StateControlsFallback";

// Loaded only after a WASM failure; its polling stops before retrying Dioxus.
export function StateControlsRecovery(props: StateControlsHostProps & { initialSelectedId: string; onSelect: (id: string) => void }) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const snapshot = props.behavior ? applyConversationBehavior(effectiveSnapshot, props.behavior.settings, props.behavior.supported, props.behavior.busy) : effectiveSnapshot;
  const [selectedId, setSelectedId] = useState(props.initialSelectedId);
  const changeControl = (id: string, value: number) => {
    const key = behaviorKeyForControl(id);
    if (key && props.behavior?.supported && !props.behavior.busy) props.behavior.onChange(key, value);
  };
  return <StateControlsFallback snapshot={snapshot} activity={activity} activityStatus={activityStatus} selectedId={selectedId}
    onSelect={id => { setSelectedId(id); props.onSelect(id); }} onControlChange={props.behavior ? changeControl : undefined} />;
}
