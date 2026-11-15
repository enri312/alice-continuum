#[cfg(target_arch = "wasm32")]
mod activity_ui;
pub mod associations_model;
#[cfg(target_arch = "wasm32")]
mod associations_ui;
#[cfg(target_arch = "wasm32")]
mod browser_timer;
pub mod confirmation_model;
#[cfg(target_arch = "wasm32")]
mod confirmation_ui;
pub mod core_activity_model;
pub mod flow_model;
pub mod flow_page_model;
#[cfg(target_arch = "wasm32")]
mod flow_page_ui;
#[cfg(target_arch = "wasm32")]
mod flow_ui;
pub mod model;
#[cfg(target_arch = "wasm32")]
mod ui;

pub mod relations_model;
#[cfg(target_arch = "wasm32")]
mod relations_ui;
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
    timeline_browser,
    crate::timeline_model::Payload,
    crate::timeline_ui,
    mount_cognitive_timeline,
    update_cognitive_timeline,
    unmount_cognitive_timeline
);
