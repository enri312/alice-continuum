import initialize, {
  mount_state_controls, update_state_controls, unmount_state_controls,
  mount_cognitive_flow, update_cognitive_flow, unmount_cognitive_flow,
  mount_saved_relations, update_saved_relations, unmount_saved_relations,
  mount_source_form, update_source_form, unmount_source_form,
} from "../../../dioxus/state-controls/pkg/alice_state_controls";
import wasmUrl from "../../../dioxus/state-controls/pkg/alice_state_controls_bg.wasm?url";
import type { StateControlsRuntime } from "./lifecycle";

let initialization: Promise<unknown> | undefined;
export async function loadRuntime(): Promise<StateControlsRuntime> {
  initialization ??= initialize({ module_or_path: wasmUrl }).catch(error => { initialization = undefined; throw error; });
  await initialization;
  return { mount: mount_state_controls, update: update_state_controls, unmount: unmount_state_controls };
}

export async function loadFlowRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return {mount:mount_cognitive_flow, update:update_cognitive_flow, unmount:unmount_cognitive_flow};
}

export async function loadRelationsRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_saved_relations, update: update_saved_relations, unmount: unmount_saved_relations };
}

export async function loadSourceFormRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_source_form, update: update_source_form, unmount: unmount_source_form };
}
