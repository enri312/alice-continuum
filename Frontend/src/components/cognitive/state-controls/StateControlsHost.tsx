import { lazy, Suspense, useRef } from "react";
import { behaviorKeyForControl, type ConversationBehaviorKey, type ConversationBehaviorSettings } from "../../../core/conversation/behavior-settings";
import type { NucleusPageProps } from "../../../pages/shared/nucleus-shared";
import { buildStateControlsPayload, type StateControlsAction } from "./bridge";
import { StateControlsView } from "./StateControlsView";

export type StateControlsHostProps = NucleusPageProps & {
  behavior?: { settings: ConversationBehaviorSettings; supported: boolean; busy: boolean; onChange: (key: ConversationBehaviorKey, value: number) => void };
};
const Recovery = lazy(() => import("./StateControlsRecovery").then(module => ({ default: module.StateControlsRecovery })));

// App boundary: shared conversation settings stay in App; R3 and page state are Rust.
export function StateControlsHost(props: StateControlsHostProps) {
  const selectedId = useRef("state-curiosity");
  const behavior = props.behavior ? { settings: props.behavior.settings, supported: props.behavior.supported, busy: props.behavior.busy } : null;
  const payload = buildStateControlsPayload(props.snapshot, selectedId.current, behavior);
  const handleAction = (action: StateControlsAction) => {
    selectedId.current = action.id;
    const key = behaviorKeyForControl(action.id);
    if (action.type === "changeBehavior" && key && props.behavior?.supported && !props.behavior.busy) props.behavior.onChange(key, action.value);
  };
  return <StateControlsView payload={payload} desktopApp={props.desktopApp} persistentMemoryCount={props.snapshot.persistentMemoryCount}
    getSelectedId={() => selectedId.current} onAction={handleAction} fallback={() => <Suspense fallback={<p role="status">Preparando Estado y controles…</p>}>
      <Recovery {...props} initialSelectedId={selectedId.current} onSelect={id => { selectedId.current = id; }} />
    </Suspense>} />;
}
