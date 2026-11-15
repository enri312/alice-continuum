#[cfg(target_arch = "wasm32")]
mod activity_ui;
pub mod flow_model;
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
#[cfg(target_arch = "wasm32")]
#[macro_use]
mod browser_runtime;

#[cfg(target_arch = "wasm32")]
mountable_view!(
    browser,
    crate::model::Payload,
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
