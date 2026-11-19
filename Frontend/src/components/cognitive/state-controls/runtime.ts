import initialize, {
  apply_activity_batch,
  init_conversation_session, update_conversation_session,
  update_memory_session,
  update_learning_session,
  update_observation_session,
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
  mount_navigation, update_navigation, unmount_navigation,
  mount_settings_page, update_settings_page, unmount_settings_page,
  mount_planner_page, update_planner_page, unmount_planner_page,
  mount_volume_page, update_volume_page, unmount_volume_page,
  mount_memory_page, update_memory_page, unmount_memory_page,
} from "../../../dioxus/dioxus-ui/pkg/alice_state_controls";
import wasmUrl from "../../../dioxus/dioxus-ui/pkg/alice_state_controls_bg.wasm?url";
import type { StateControlsRuntime } from "./lifecycle";
import { connectActivitySession } from "../../../core/cognitive/activity-session";
import { connectConversationSession } from "../../../core/conversation/conversation-session";
import { connectMemorySession } from "../../../core/memory/memory-session";
import { connectLearningSession } from "../../../core/memory/learning-session";
import { connectObservationSession } from "../../../core/governance/observation-session";

let initialization: Promise<unknown> | undefined;
export async function loadRuntime(): Promise<StateControlsRuntime> {
  initialization ??= initialize({ module_or_path: wasmUrl }).catch(error => { initialization = undefined; throw error; });
  await initialization;
  connectActivitySession(apply_activity_batch);
  connectConversationSession(init_conversation_session, update_conversation_session);
  connectMemorySession(update_memory_session);
  connectLearningSession(update_learning_session);
  connectObservationSession(update_observation_session);
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

export async function loadNavigationRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_navigation, update: update_navigation, unmount: unmount_navigation };
}

export async function loadSettingsPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_settings_page, update: update_settings_page, unmount: unmount_settings_page };
}

export async function loadPlannerPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_planner_page, update: update_planner_page, unmount: unmount_planner_page };
}

export async function loadVolumePageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_volume_page, update: update_volume_page, unmount: unmount_volume_page };
}

export async function loadMemoryPageRuntime(): Promise<StateControlsRuntime> {
  await loadRuntime();
  return { mount: mount_memory_page, update: update_memory_page, unmount: unmount_memory_page };
}
