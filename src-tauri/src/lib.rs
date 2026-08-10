mod audit;
mod avatar;
mod capabilities;
mod cloud;
mod core_activity;
mod diagnostics;
mod memory;
mod observation;
// R2 gobierna la primera capacidad migrada. La observación de ventana solo
// cambia de estado al consumir un grant nativo específico y vigente.
#[allow(dead_code)]
mod permissions;
mod sensory;
// R4 conserva borradores locales verificables; ningún comando ejecuta pasos.
mod skills;
mod util;

use audit::{audit_snapshot, record_process_started};
use avatar::avatar_status;
use capabilities::capability_registry_status;
use cloud::{cloud_status, send_cloud_message};
use core_activity::core_activity_snapshot;
use diagnostics::diagnostic_snapshot;
use memory::{
    export_memory, load_memory, open_memory_directory, restore_memory_backup, save_memory,
};
use observation::{get_foreground_context, spawn_observer_thread, ObservationStore};
use permissions::{
    cancel_permission_request, decide_permission_request, execute_context_observation_grant,
    execute_sensor_lease_grant, permission_gateway_status, prepare_permission_request,
    revoke_permission_grant, stop_sensor_lease, PermissionGateway,
};
use sensory::{sensor_lease_status, spawn_sensor_reaper_thread, SensorLeaseStore};
use skills::{read_skill_draft, save_skill_draft, skill_draft_store_status, SkillDraftStore};
use tauri::Manager;

pub fn run() {
    let observation_store = ObservationStore::default();
    let permission_gateway = PermissionGateway::default();
    let sensor_store = SensorLeaseStore::default();
    let skill_store = SkillDraftStore::default();
    tauri::Builder::default()
        .manage(observation_store.clone())
        .manage(permission_gateway.clone())
        .manage(sensor_store.clone())
        .manage(skill_store)
        .setup(move |app| {
            let window_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(window_icon)?;
            }
            if let Err(error) = record_process_started(app.handle()) {
                eprintln!("Auditoría R3 no disponible al iniciar: {error}");
            }
            spawn_observer_thread(
                observation_store.clone(),
                permission_gateway.clone(),
                app.handle().clone(),
            );
            spawn_sensor_reaper_thread(
                sensor_store.clone(),
                permission_gateway.clone(),
                app.handle().clone(),
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capability_registry_status,
            skill_draft_store_status,
            read_skill_draft,
            save_skill_draft,
            permission_gateway_status,
            prepare_permission_request,
            decide_permission_request,
            cancel_permission_request,
            revoke_permission_grant,
            execute_context_observation_grant,
            execute_sensor_lease_grant,
            stop_sensor_lease,
            sensor_lease_status,
            audit_snapshot,
            core_activity_snapshot,
            diagnostic_snapshot,
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
