import initialize, {
  mount_state_controls, update_state_controls, unmount_state_controls,
  mount_cognitive_flow, update_cognitive_flow, unmount_cognitive_flow,
  mount_saved_relations, update_saved_relations, unmount_saved_relations,
  mount_source_form, update_source_form, unmount_source_form,
  mount_relation_confirmation, update_relation_confirmation, unmount_relation_confirmation,
  mount_memory_associations, update_memory_associations, unmount_memory_associations,
  mount_flow_page, update_flow_page, unmount_flow_page,
  mount_activity_page, update_activity_page, unmount_activity_page,
  mount_dashboard, update_dashboard, unmount_dashboard,
  mount_audit_page, update_audit_page, unmount_audit_page,
  mount_conversation_page, update_conversation_page, unmount_conversation_page,
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

export async function loadConfirmationRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_relation_confirmation, update: update_relation_confirmation, unmount: unmount_relation_confirmation };
}

export async function loadAssociationsRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_memory_associations, update: update_memory_associations, unmount: unmount_memory_associations };
}

export async function loadFlowPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_flow_page, update: update_flow_page, unmount: unmount_flow_page };
}
export async function loadActivityPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_activity_page, update: update_activity_page, unmount: unmount_activity_page };
}

export async function loadDashboardRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_dashboard, update: update_dashboard, unmount: unmount_dashboard };
}

export async function loadAuditPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_audit_page, update: update_audit_page, unmount: unmount_audit_page };
}

export async function loadConversationPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_conversation_page, update: update_conversation_page, unmount: unmount_conversation_page };
}
