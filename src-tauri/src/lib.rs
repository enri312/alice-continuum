mod audit;
mod avatar;
mod capabilities;
mod cloud;
mod conversation_history;
mod conversation_learning;
mod conversation_reference;
mod core_activity;
mod diagnostics;
mod documents;
mod face_readiness;
mod hybrid_retrieval;
mod knowledge_graph;
mod learning_candidates;
mod memory_affect;
// Shared arbitration and explicit runtime controls; voice UI remains pending.
#[allow(dead_code)]
mod local_inference;
mod memory;
mod observation;
mod owner_profile;
mod procedure_learning;
// R5.3 conserva decisiones explícitas del propietario en un almacén separado;
// no crea borradores R4 ni habilita ejecución.
mod procedure_store;
// R2 gobierna la primera capacidad migrada. La observación de ventana solo
// cambia de estado al consumir un grant nativo específico y vigente.
#[allow(dead_code)]
mod permissions;
mod sensory;
// R4 conserva borradores locales verificables; ningún comando ejecuta pasos.
mod automatic_memory;
mod conversation_vision;
mod desktop_actions;
#[cfg(target_os = "linux")]
mod linux_lifecycle;
#[cfg(target_os = "linux")]
mod linux_media;
mod media_actions;
#[cfg(target_os = "linux")]
mod media_linux;
mod media_windows;
mod runtime_paths;
mod skills;
mod tasks;
mod util;
mod visual_learning;
mod voice_input;
mod voice_output;
mod voice_session;
mod whisper_input;
mod working_memory;

use audit::{audit_snapshot, record_process_started};
use avatar::{avatar_animation_status, avatar_status, record_avatar_motor_transition};
use capabilities::capability_registry_status;
use cloud::{cloud_status, send_cloud_message};
use conversation_history::conversation_history_status;
use conversation_learning::{confirm_conversation_learning, preview_conversation_learning};
use core_activity::core_activity_snapshot;
use diagnostics::diagnostic_snapshot;
use documents::preview_document;
use face_readiness::face_readiness_status;
use hybrid_retrieval::preview_hybrid_memory_retrieval;
use knowledge_graph::{
    confirm_knowledge_graph_association, knowledge_graph_associations,
    set_knowledge_graph_association_withdrawn,
};
use knowledge_graph::{knowledge_graph_snapshot, preview_knowledge_graph_association};
use learning_candidates::{confirm_learning_candidate, preview_learning_candidates};
use memory::{
    activate_layered_memory, activate_memory_lifecycle, assess_memory_accessibility,
    assess_memory_suppression, assess_memory_validity, confirm_memory_archive,
    confirm_memory_deletion, confirm_memory_deletion_schedule, confirm_memory_reconsolidation,
    consolidation_preview, consolidation_recovery_status, export_memory, layered_memory_status,
    load_memory, markdown_note_catalog, memory_lifecycle_preview, open_memory_directory,
    preview_consolidation_merge, preview_memory_archive, preview_memory_deletion,
    preview_memory_deletion_schedule, preview_memory_reconsolidation,
    resolve_consolidation_candidate, restore_consolidation_transaction, restore_memory_backup,
    rollback_layered_memory, rollback_memory_lifecycle, save_memory,
};
use observation::{get_foreground_context, spawn_observer_thread, ObservationStore};
use owner_profile::owner_profile_status;
use permissions::{
    cancel_permission_request, decide_permission_request, execute_context_observation_grant,
    execute_sensor_lease_grant, permission_gateway_status, prepare_permission_request,
    revoke_permission_grant, stop_sensor_lease, PermissionGateway,
};
use procedure_learning::procedure_detection_status;
use procedure_store::{
    convert_procedure_candidate_to_draft, procedure_candidate_store_status,
    procedure_draft_conversion_status, record_procedure_pattern_decision, ProcedureCandidateStore,
};
use sensory::{sensor_lease_status, spawn_sensor_reaper_thread, SensorLeaseStore};
use skills::{
    prepare_read_only_skill_template, read_skill_draft, read_skill_lifecycle, save_skill_draft,
    simulate_skill_plan, skill_draft_store_status, skill_lifecycle_status,
    transition_skill_lifecycle, SkillDraftStore,
};
use tasks::{
    confirm_task_mutation, dispatch_task_notification, preview_task_mutation, reserve_task_attempt,
    run_read_only_capability_check, set_task_engine_enabled, spawn_task_engine_thread,
    task_attempt_ledger_status, task_engine_status, task_registry_status, TaskEngineStore,
};
use tauri::Manager;
use visual_learning::analyze_screen_frame;
use voice_input::transcribe_voice_turn;
use voice_output::{
    cancel_voice_output, confirm_voice_output, preview_voice_output, VoiceOutputStore,
};
use working_memory::{clear_working_memory, working_memory_status, WorkingMemoryStore};

pub fn run() {
    let observation_store = ObservationStore::default();
    let permission_gateway = PermissionGateway::default();
    let sensor_store = SensorLeaseStore::default();
    let skill_store = SkillDraftStore::default();
    let procedure_store = ProcedureCandidateStore::default();
    let working_memory_store = WorkingMemoryStore::default();
    let task_engine_store = TaskEngineStore::default();
    let voice_output_store = VoiceOutputStore::default();
    let voice_session_store = voice_session::VoiceSessionStore::default();
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(observation_store.clone())
        .manage(permission_gateway.clone())
        .manage(sensor_store.clone())
        .manage(skill_store)
        .manage(procedure_store)
        .manage(working_memory_store)
        .manage(task_engine_store.clone())
        .manage(voice_output_store)
        .manage(voice_session_store.clone())
        .manage(conversation_vision::VisionSessionStore::default())
        .manage(media_actions::MediaPlaybackStore::default())
        .setup(move |app| {
            #[cfg(target_os = "linux")]
            linux_lifecycle::install(app.handle().clone())?;
            avatar::configure_asset_scope(app.handle())?;
            let window_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            if let Some(window) = app.get_webview_window("main") {
                window.set_icon(window_icon)?;
                #[cfg(target_os = "linux")]
                {
                    use gtk::prelude::GtkWindowExt;
                    window
                        .gtk_window()?
                        .set_icon_name(Some("com.carlosnunez.alicecognitivecore"));
                    linux_media::configure(&window, voice_session_store.clone())?;
                }
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
            spawn_task_engine_thread(task_engine_store.clone(), app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            conversation_vision::start_vision_session,
            conversation_vision::stop_vision_session,
            conversation_vision::preview_vision_desktop,
            automatic_memory::automatic_memory_status,
            automatic_memory::set_automatic_memory_enabled,
            automatic_memory::review_automatic_memory,
            local_inference::local_runtime_status,
            local_inference::start_local_runtime,
            local_inference::stop_local_runtime,
            capability_registry_status,
            knowledge_graph_snapshot,
            preview_knowledge_graph_association,
            confirm_knowledge_graph_association,
            knowledge_graph_associations,
            set_knowledge_graph_association_withdrawn,
            preview_document,
            face_readiness_status,
            preview_hybrid_memory_retrieval,
            prepare_read_only_skill_template,
            skill_draft_store_status,
            read_skill_draft,
            read_skill_lifecycle,
            save_skill_draft,
            simulate_skill_plan,
            skill_lifecycle_status,
            transition_skill_lifecycle,
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
            procedure_detection_status,
            procedure_candidate_store_status,
            record_procedure_pattern_decision,
            procedure_draft_conversion_status,
            convert_procedure_candidate_to_draft,
            diagnostic_snapshot,
            get_foreground_context,
            load_memory,
            markdown_note_catalog,
            owner_profile_status,
            layered_memory_status,
            memory_lifecycle_preview,
            activate_memory_lifecycle,
            rollback_memory_lifecycle,
            assess_memory_validity,
            assess_memory_accessibility,
            assess_memory_suppression,
            preview_memory_archive,
            confirm_memory_archive,
            preview_memory_deletion_schedule,
            confirm_memory_deletion_schedule,
            preview_memory_deletion,
            confirm_memory_deletion,
            preview_memory_reconsolidation,
            confirm_memory_reconsolidation,
            consolidation_preview,
            consolidation_recovery_status,
            preview_consolidation_merge,
            resolve_consolidation_candidate,
            restore_consolidation_transaction,
            activate_layered_memory,
            rollback_layered_memory,
            save_memory,
            export_memory,
            restore_memory_backup,
            open_memory_directory,
            avatar_status,
            avatar_animation_status,
            record_avatar_motor_transition,
            cloud_status,
            conversation_history_status,
            working_memory_status,
            clear_working_memory,
            send_cloud_message,
            preview_conversation_learning,
            confirm_conversation_learning,
            transcribe_voice_turn,
            voice_session::start_voice_session,
            voice_session::stop_voice_session,
            voice_output::speak_voice_session_response,
            preview_voice_output,
            confirm_voice_output,
            cancel_voice_output,
            analyze_screen_frame,
            preview_learning_candidates,
            confirm_learning_candidate,
            task_registry_status,
            preview_task_mutation,
            confirm_task_mutation,
            task_engine_status,
            set_task_engine_enabled,
            task_attempt_ledger_status,
            reserve_task_attempt,
            run_read_only_capability_check,
            dispatch_task_notification
        ])
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar Alice Continuum")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                let _ = local_inference::runtime().stop();
            }
        });
}
