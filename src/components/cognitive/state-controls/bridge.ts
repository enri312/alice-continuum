import type { BrainSnapshot } from "../../../core/cognitive/brain";
import { behaviorKeyForControl } from "../../../core/conversation/behavior-settings";
import { describeRetrieval } from "../RetrievedMemory";

export function buildStateControlsPayload(snapshot: BrainSnapshot, selectedId: string, editable: boolean) {
  const selected = snapshot.stateMetrics.find(item => item.id === selectedId)
    ?? snapshot.behaviorControls.find(item => item.id === selectedId)
    ?? snapshot.stateMetrics[0];
  return {
    hasActivity: snapshot.hasActivity,
    localRecords: (snapshot.nodes.find(node => node.id === "memory")?.value ?? "0 recuerdos").toUpperCase(),
    selectedId,
    metrics: snapshot.stateMetrics,
    controls: snapshot.behaviorControls.map(control => ({ ...control, locked: control.locked || !editable })),
    retrieval: { ...describeRetrieval(snapshot.retrievedMemory), count: snapshot.retrievedMemory.count },
    inspector: { label: selected.label, value: selected.value.toFixed(3), detail: selected.detail },
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
    if (item.type === "changeBehavior" && Object.keys(item).length === 3 && control && !control.locked
      && control.availability === "ready" && behaviorKeyForControl(control.id)
      && typeof item.value === "number" && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1) {
      return { type: "changeBehavior", id: control.id, value: item.value };
    }
  } catch { /* A malformed or obsolete event never changes application state. */ }
  return null;
}
