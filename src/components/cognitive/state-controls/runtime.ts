import initialize, { mount_state_controls, update_state_controls, unmount_state_controls } from "../../../dioxus/state-controls/pkg/alice_state_controls";
import wasmUrl from "../../../dioxus/state-controls/pkg/alice_state_controls_bg.wasm?url";
import type { StateControlsRuntime } from "./lifecycle";

let initialization: Promise<unknown> | undefined;
export async function loadRuntime(): Promise<StateControlsRuntime> {
  initialization ??= initialize({ module_or_path: wasmUrl }).catch(error => { initialization = undefined; throw error; });
  await initialization;
  return { mount: mount_state_controls, update: update_state_controls, unmount: unmount_state_controls };
}
