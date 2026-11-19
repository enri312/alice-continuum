pub mod activity_page_model;
#[cfg(target_arch = "wasm32")]
mod activity_page_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod activity_session;
#[cfg(target_arch = "wasm32")]
mod activity_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod app;
pub mod associations_model;
#[cfg(target_arch = "wasm32")]
mod associations_ui;
pub mod audit_page_model;
#[cfg(target_arch = "wasm32")]
mod audit_page_ui;
#[cfg(target_arch = "wasm32")]
mod browser_timer;
pub mod confirmation_model;
#[cfg(target_arch = "wasm32")]
mod confirmation_ui;
pub mod conversation_model;
#[cfg(any(test, target_arch = "wasm32"))]
mod conversation_session;
pub mod conversation_tools_model;
#[cfg(target_arch = "wasm32")]
mod conversation_tools_ui;
#[cfg(target_arch = "wasm32")]
mod conversation_ui;
#[cfg(target_arch = "wasm32")]
mod conversation_voice_ui;
pub mod core_activity_model;
pub mod dashboard_model;
#[cfg(target_arch = "wasm32")]
mod dashboard_ui;
pub mod flow_model;
pub mod flow_page_model;
#[cfg(target_arch = "wasm32")]
mod flow_page_ui;
#[cfg(target_arch = "wasm32")]
mod flow_ui;
pub mod governance_model;
#[cfg(target_arch = "wasm32")]
mod governance_ui;
#[cfg(target_arch = "wasm32")]
mod governance_workflows_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod learning_session;
#[cfg(target_arch = "wasm32")]
mod memory_consolidation_ui;
#[cfg(target_arch = "wasm32")]
mod memory_lifecycle_ui;
mod memory_maintenance_model;
pub mod memory_page_model;
#[cfg(target_arch = "wasm32")]
mod memory_page_ui;
#[cfg(target_arch = "wasm32")]
mod memory_panels_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod memory_session;
pub mod model;
pub mod navigation_model;
#[cfg(target_arch = "wasm32")]
mod navigation_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod observation_session;
pub mod planner_page_model;
#[cfg(target_arch = "wasm32")]
mod planner_page_ui;
pub mod settings_page_model;
#[cfg(target_arch = "wasm32")]
mod settings_page_ui;
#[cfg(target_arch = "wasm32")]
mod ui;
pub mod volume_page_model;
#[cfg(target_arch = "wasm32")]
mod volume_page_ui;
#[cfg(target_arch = "wasm32")]
mod volume_panels_ui;

pub mod relations_model;
#[cfg(target_arch = "wasm32")]
mod relations_ui;
#[cfg(any(test, target_arch = "wasm32"))]
mod retrieval_session;
pub mod source_form_model;
#[cfg(target_arch = "wasm32")]
mod source_form_ui;
pub mod state_page_model;
pub mod timeline_model;
#[cfg(target_arch = "wasm32")]
mod timeline_ui;
#[cfg(target_arch = "wasm32")]
#[macro_use]
mod browser_runtime;

#[cfg(target_arch = "wasm32")]
mountable_view!(
    governance_browser,
    crate::governance_model::Payload,
    crate::governance_ui,
    mount_governance_page,
    update_governance_page,
    unmount_governance_page
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    browser,
    crate::state_page_model::Payload,
    crate::ui,
    mount_state_controls,
    update_state_controls,
    unmount_state_controls
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    flow_browser,
    crate::flow_model::Payload,
    crate::flow_ui,
    mount_cognitive_flow,
    update_cognitive_flow,
    unmount_cognitive_flow
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    relations_browser,
    crate::relations_model::Payload,
    crate::relations_ui,
    mount_saved_relations,
    update_saved_relations,
    unmount_saved_relations
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    source_form_browser,
    crate::source_form_model::Payload,
    crate::source_form_ui,
    mount_source_form,
    update_source_form,
    unmount_source_form
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    confirmation_browser,
    crate::confirmation_model::Payload,
    crate::confirmation_ui,
    mount_relation_confirmation,
    update_relation_confirmation,
    unmount_relation_confirmation
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    associations_browser,
    crate::associations_model::Payload,
    crate::associations_ui,
    mount_memory_associations,
    update_memory_associations,
    unmount_memory_associations
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    flow_page_browser,
    crate::flow_page_model::Payload,
    crate::flow_page_ui,
    mount_flow_page,
    update_flow_page,
    unmount_flow_page
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    activity_page_browser,
    crate::activity_page_model::Payload,
    crate::activity_page_ui,
    mount_activity_page,
    update_activity_page,
    unmount_activity_page
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    dashboard_browser,
    crate::dashboard_model::Payload,
    crate::dashboard_ui,
    mount_dashboard,
    update_dashboard,
    unmount_dashboard
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    audit_page_browser,
    crate::audit_page_model::Payload,
    crate::audit_page_ui,
    mount_audit_page,
    update_audit_page,
    unmount_audit_page
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    conversation_page_browser,
    crate::conversation_model::Payload,
    crate::conversation_ui,
    mount_conversation_page,
    update_conversation_page,
    unmount_conversation_page
);
#[cfg(target_arch = "wasm32")]
mountable_view!(
    navigation_browser,
    crate::navigation_model::Payload,
    crate::navigation_ui,
    mount_navigation,
    update_navigation,
    unmount_navigation
);

#[cfg(target_arch = "wasm32")]
mountable_view!(
    settings_page_browser,
    crate::settings_page_model::Payload,
    crate::settings_page_ui,
    mount_settings_page,
    update_settings_page,
    unmount_settings_page
);

#[cfg(target_arch = "wasm32")]
mountable_view!(
    planner_page_browser,
    crate::planner_page_model::Payload,
    crate::planner_page_ui,
    mount_planner_page,
    update_planner_page,
    unmount_planner_page
);

#[cfg(target_arch = "wasm32")]
mountable_view!(
    volume_page_browser,
    crate::volume_page_model::Payload,
    crate::volume_page_ui,
    mount_volume_page,
    update_volume_page,
    unmount_volume_page
);

#[cfg(target_arch = "wasm32")]
mountable_view!(
    memory_page_browser,
    crate::memory_page_model::Payload,
    crate::memory_page_ui,
    mount_memory_page,
    update_memory_page,
    unmount_memory_page
);
#[cfg(target_arch = "wasm32")]
mod embodiment_body_ui;
pub mod embodiment_model;
#[cfg(target_arch = "wasm32")]
mod embodiment_ui;
#[cfg(target_arch = "wasm32")]
mod face_mesh;

#[cfg(target_arch = "wasm32")]
mountable_view!(
    embodiment_browser,
    crate::embodiment_model::Payload,
    crate::embodiment_ui,
    mount_embodiment,
    update_embodiment,
    unmount_embodiment
);
