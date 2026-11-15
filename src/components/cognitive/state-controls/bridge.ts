import type { BrainSnapshot } from "../../../core/cognitive/brain";
import type { CoreActivitySnapshot } from "../../../core/cognitive/core-activity";
import { buildActivityPayload } from "../activity-payload";
import { behaviorKeyForControl } from "../../../core/conversation/behavior-settings";
import type { ConversationBehaviorSettings } from "../../../core/conversation/behavior-settings";
import type { NucleusActivityStatus } from "../../../pages/shared/nucleus-shared";

export type StateControlsBehavior = { settings: ConversationBehaviorSettings; supported: boolean; busy: boolean };

export function buildStateControlsPayload(snapshot: BrainSnapshot, selectedId: string, behavior: StateControlsBehavior | null, activity: CoreActivitySnapshot | null = null, activityStatus: NucleusActivityStatus = "unavailable") {
  return {
    hasActivity: snapshot.hasActivity,
    localRecords: (snapshot.nodes.find(node => node.id === "memory")?.value ?? "0 recuerdos").toUpperCase(),
    selectedId,
    metrics: snapshot.stateMetrics,
    controls: snapshot.behaviorControls,
    behavior,
    retrieval: snapshot.retrievedMemory,
    activity: buildActivityPayload(activity, activityStatus),
  };
}

export type StateControlsPayload = ReturnType<typeof buildStateControlsPayload>;
export type StateControlsAction = { type: "select"; id: string } | { type: "changeBehavior"; id: string; value: number };

// The current host state authorizes every action, including events from an older render.
export function parseStateControlsAction(raw: string, payload: StateControlsPayload): StateControlsAction | null {
  try {
    const action: unknown = JSON.parse(raw);
    if (!action || typeof action !== "object" || Array.isArray(action)) return null;
    const item = action as Record<string, unknown>;
    if (typeof item.id !== "string") return null;
    if (item.type === "select" && Object.keys(item).length === 2
      && (item.id === "retrieved-memory" || [...payload.metrics, ...payload.controls].some(entry => entry.id === item.id))) {
      return { type: "select", id: item.id };
    }
    const control = payload.controls.find(entry => entry.id === item.id);
    if (item.type === "changeBehavior" && Object.keys(item).length === 3 && control
      && payload.behavior?.supported && !payload.behavior.busy && behaviorKeyForControl(control.id)
      && typeof item.value === "number" && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1) {
      return { type: "changeBehavior", id: control.id, value: item.value };
    }
  } catch { /* A malformed or obsolete event never changes application state. */ }
  return null;
}
