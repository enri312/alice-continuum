mod avatar;
mod capabilities;
mod cloud;
mod memory;
mod observation;
// R2 expone consulta, preparación y decisión humana. La ejecución de grants y
// los adaptadores de capacidades continúan aislados dentro del backend.
#[allow(dead_code)]
mod permissions;
mod util;

use avatar::avatar_status;
use capabilities::capability_registry_status;
use cloud::{cloud_status, send_cloud_message};
use memory::{
    export_memory, load_memory, open_memory_directory, restore_memory_backup, save_memory,
};
use observation::{
    get_foreground_context, set_context_observation_enabled, spawn_observer_thread,
    ObservationStore,
};
use permissions::{
    cancel_permission_request, decide_permission_request, permission_gateway_status,
    prepare_permission_request, revoke_permission_grant, PermissionGateway,
};
use tauri::Manager;

pub fn run() {
    let observation_store = ObservationStore::default();
    tauri::Builder::default()
        .manage(observation_store.clone())
        .manage(PermissionGateway::default())
        .setup(move |app| {
            let window_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(window_icon)?;
            }
            spawn_observer_thread(observation_store.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capability_registry_status,
            permission_gateway_status,
            prepare_permission_request,
            decide_permission_request,
            cancel_permission_request,
            revoke_permission_grant,
            set_context_observation_enabled,
            get_foreground_context,
            load_memory,
            save_memory,
            export_memory,
            restore_memory_backup,
            open_memory_directory,
            avatar_status,
            cloud_status,
            send_cloud_message
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Alice Cognitive Core");
}
