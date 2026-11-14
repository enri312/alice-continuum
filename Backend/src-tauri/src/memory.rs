//! Stable native commands and auditing; memory rules and storage live in submodules.
use paths::{memory_directory, memory_file};
mod assessment;
mod consolidation;
mod layers;
mod learning;
mod lifecycle;
mod model;
mod paths;
mod queries;
mod reconsolidation;
mod records;
mod retention;
mod storage;
mod validation;

use crate::audit::new_operation_id;
use crate::audit::record_producer_audit;
use crate::audit::AuditOutcome;
use crate::audit::AuditSource;
use crate::audit::AuditStage;
use crate::capabilities::current_unix_seconds;
use crate::capabilities::current_utc_timestamp;
use crate::capabilities::format_utc_timestamp;
use crate::util::alice_data_root_path;
use assessment::{
    assess_memory_accessibility_at, assess_memory_suppression_at, assess_memory_validity_at,
};
use consolidation::{
    consolidation_preview_at, consolidation_recovery_status_at, preview_consolidation_merge_at,
    resolve_consolidation_candidate_at, restore_consolidation_transaction_at,
};
use layers::{activate_layered_memory_at, layered_memory_status_at, rollback_layered_memory_at};
pub(crate) use learning::{append_confirmed_conversation_learning, append_confirmed_learning};
use lifecycle::{
    activate_memory_lifecycle_at, memory_lifecycle_preview_at, rollback_memory_lifecycle_at,
};
pub(crate) use model::{
    ActivateLayeredMemoryInput, ActivateMemoryLifecycleInput, AssessMemoryAccessibilityInput,
    AssessMemorySuppressionInput, AssessMemoryValidityInput, ConfirmMemoryArchiveInput,
    ConfirmMemoryDeletionInput, ConfirmMemoryDeletionScheduleInput,
    ConfirmMemoryReconsolidationInput, ConfirmedConversationLearningAppendInput,
    ConfirmedLearningAppendInput, ConfirmedLearningAppendResult, ConsolidationMergePreview,
    ConsolidationPreviewSnapshot, ConsolidationRecoveryStatusSnapshot,
    ConsolidationResolutionResult, ConsolidationRestorationResult, LayeredMemorySnapshot,
    MarkdownNoteCatalogSnapshot, MemoryAccessibilityAssessmentResult, MemoryArchivePreview,
    MemoryArchiveResult, MemoryCapabilityProbe, MemoryDeletionPreview, MemoryDeletionResult,
    MemoryDeletionSchedulePreview, MemoryDeletionScheduleResult, MemoryGraphReference,
    MemoryLifecyclePreviewSnapshot, MemoryReconsolidationPreview, MemoryReconsolidationResult,
    MemoryResourceState, MemorySession, MemorySnapshot, MemorySuppressionAssessmentResult,
    MemoryValidityAssessmentResult, PreviewConsolidationMergeInput, PreviewMemoryArchiveInput,
    PreviewMemoryDeletionInput, PreviewMemoryDeletionScheduleInput,
    PreviewMemoryReconsolidationInput, ResolveConsolidationCandidateInput,
    RestoreConsolidationTransactionInput, RollbackLayeredMemoryInput, RollbackMemoryLifecycleInput,
};
pub(crate) use queries::{graph_references_from_source, memory_capability_probe};
use reconsolidation::{confirm_memory_reconsolidation_at, prepare_memory_reconsolidation_at};
use retention::{
    confirm_memory_archive_at, confirm_memory_deletion_at, confirm_memory_deletion_schedule_at,
    prepare_memory_archive_at, prepare_memory_deletion_at, prepare_memory_deletion_schedule_at,
};
use std::sync::Mutex;
use std::sync::MutexGuard;
use std::sync::OnceLock;
use std::time::Instant;
use storage::memory_subject_digest;
use tauri::AppHandle;
pub(crate) use validation::validate_graph_episode_evidence;
use validation::validate_memory_sessions;

const LAYERED_MEMORY_SCHEMA_VERSION: u8 = 2;

const LAYERED_MEMORY_FILE: &str = "layer-index-v3.json";

const MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION: u8 = 1;

const MEMORY_LIFECYCLE_FILE: &str = "lifecycle-index-v1.json";

const MEMORY_RECONSOLIDATION_SCHEMA_VERSION: u8 = 1;

const MEMORY_ARCHIVE_SCHEMA_VERSION: u8 = 1;

const MEMORY_DELETION_SCHEMA_VERSION: u8 = 1;

const MEMORY_DELETION_WAIT_SECONDS: i64 = 7 * 24 * 60 * 60;

const CONSOLIDATION_PREVIEW_SCHEMA_VERSION: u8 = 2;

const CONSOLIDATION_DECISION_SCHEMA_VERSION: u8 = 1;

const CONSOLIDATION_MERGE_PREVIEW_SCHEMA_VERSION: u8 = 4;

const CONSOLIDATION_TRANSACTION_SCHEMA_VERSION: u8 = 1;

const CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION: u8 = 1;

const CONSOLIDATION_DECISION_FILE: &str = "consolidation-decisions-v1.json";

const CONSOLIDATION_TRANSACTION_FILE: &str = "consolidation-merge-transactions-v1.json";

const CONSOLIDATION_MAX_RECORDS: usize = 1_000;

const CONSOLIDATION_MAX_CANDIDATES: usize = 2_000;

static MEMORY_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn acquire_memory_write_lock() -> Result<MutexGuard<'static, ()>, String> {
    MEMORY_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "El bloqueo de escritura de Memoria quedó dañado".into())
}

fn elapsed_ms(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis())
        .unwrap_or(86_400_000)
        .min(86_400_000)
}

fn audited_memory_operation<T>(
    app: &AppHandle,
    capability_id: &str,
    operation: &str,
    subject_digest: &str,
    success_reason: &str,
    execute: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    audited_memory_operation_with(
        subject_digest,
        success_reason,
        |operation_id, stage, outcome, duration_ms, digest, reason_code| {
            record_producer_audit(
                app,
                operation_id,
                AuditSource::Memory,
                capability_id.into(),
                operation.into(),
                stage,
                outcome,
                duration_ms,
                digest,
                reason_code,
            )
        },
        execute,
    )
}

fn audited_memory_operation_with<T>(
    subject_digest: &str,
    success_reason: &str,
    mut record: impl FnMut(
        String,
        AuditStage,
        AuditOutcome,
        Option<u64>,
        Option<String>,
        String,
    ) -> Result<(), String>,
    execute: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let operation_id = new_operation_id();
    record(
        operation_id.clone(),
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(subject_digest.into()),
        "MEMORY_OPERATION_ACCEPTED".into(),
    )?;

    let started = Instant::now();
    match execute() {
        Ok(value) => {
            if let Err(error) = record(
                operation_id,
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(elapsed_ms(started)),
                Some(subject_digest.into()),
                success_reason.into(),
            ) {
                eprintln!(
                    "La operación de memoria terminó, pero R3 no registró el resultado: {error}"
                );
            }
            Ok(value)
        }
        Err(error) => {
            if let Err(audit_error) = record(
                operation_id,
                AuditStage::Error,
                AuditOutcome::Error,
                Some(elapsed_ms(started)),
                Some(subject_digest.into()),
                "MEMORY_OPERATION_FAILED".into(),
            ) {
                eprintln!("R3 no registró el fallo de memoria: {audit_error}");
            }
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) fn load_memory(app: AppHandle) -> Result<MemorySnapshot, String> {
    queries::load_memory_at(&memory_file(&app)?)
}

#[tauri::command]
pub(crate) fn markdown_note_catalog(app: AppHandle) -> Result<MarkdownNoteCatalogSnapshot, String> {
    queries::markdown_note_catalog_at(&alice_data_root_path(&app)?.join("memory"))
}

#[tauri::command]
pub(crate) fn layered_memory_status(app: AppHandle) -> Result<LayeredMemorySnapshot, String> {
    Ok(layered_memory_status_at(&alice_data_root_path(&app)?))
}

#[tauri::command]
pub(crate) fn memory_lifecycle_preview(
    app: AppHandle,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    Ok(memory_lifecycle_preview_at(&alice_data_root_path(&app)?))
}

#[tauri::command]
pub(crate) fn activate_memory_lifecycle(
    app: AppHandle,
    input: ActivateMemoryLifecycleInput,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let source_digest = input.expected_source_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "activate_memory_lifecycle",
        &source_digest,
        "MEMORY_LIFECYCLE_ACTIVATED",
        || activate_memory_lifecycle_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn rollback_memory_lifecycle(
    app: AppHandle,
    input: RollbackMemoryLifecycleInput,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let revision_digest = input.expected_revision_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.restore",
        "rollback_memory_lifecycle",
        &revision_digest,
        "MEMORY_LIFECYCLE_ROLLED_BACK",
        || rollback_memory_lifecycle_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_validity(
    app: AppHandle,
    input: AssessMemoryValidityInput,
) -> Result<MemoryValidityAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_validity",
        &record_digest,
        "MEMORY_VALIDITY_ASSESSED",
        || assess_memory_validity_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_accessibility(
    app: AppHandle,
    input: AssessMemoryAccessibilityInput,
) -> Result<MemoryAccessibilityAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_accessibility",
        &record_digest,
        "MEMORY_ACCESSIBILITY_ASSESSED",
        || assess_memory_accessibility_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_suppression(
    app: AppHandle,
    input: AssessMemorySuppressionInput,
) -> Result<MemorySuppressionAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_suppression",
        &record_digest,
        "MEMORY_SUPPRESSION_ASSESSED",
        || assess_memory_suppression_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_archive(
    app: AppHandle,
    input: PreviewMemoryArchiveInput,
) -> Result<MemoryArchivePreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _) = prepare_memory_archive_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_archive(
    app: AppHandle,
    input: ConfirmMemoryArchiveInput,
) -> Result<MemoryArchiveResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_archive",
        &plan_digest,
        "MEMORY_ARCHIVE_CHANGED",
        || confirm_memory_archive_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_deletion_schedule(
    app: AppHandle,
    input: PreviewMemoryDeletionScheduleInput,
) -> Result<MemoryDeletionSchedulePreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let planned_seconds = current_unix_seconds()?;
    let (preview, _, _) = prepare_memory_deletion_schedule_at(
        &data_root,
        input,
        format_utc_timestamp(planned_seconds),
        format_utc_timestamp(planned_seconds + MEMORY_DELETION_WAIT_SECONDS),
    )?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_deletion_schedule(
    app: AppHandle,
    input: ConfirmMemoryDeletionScheduleInput,
) -> Result<MemoryDeletionScheduleResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_deletion_schedule",
        &plan_digest,
        "MEMORY_DELETION_RETENTION_CHANGED",
        || confirm_memory_deletion_schedule_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_deletion(
    app: AppHandle,
    input: PreviewMemoryDeletionInput,
) -> Result<MemoryDeletionPreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _, _) =
        prepare_memory_deletion_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_deletion(
    app: AppHandle,
    input: ConfirmMemoryDeletionInput,
) -> Result<MemoryDeletionResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_deletion",
        &plan_digest,
        "MEMORY_DELETED_AFTER_RETENTION",
        || confirm_memory_deletion_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_reconsolidation(
    app: AppHandle,
    input: PreviewMemoryReconsolidationInput,
) -> Result<MemoryReconsolidationPreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _, _) =
        prepare_memory_reconsolidation_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_reconsolidation(
    app: AppHandle,
    input: ConfirmMemoryReconsolidationInput,
) -> Result<MemoryReconsolidationResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_reconsolidation",
        &plan_digest,
        "MEMORY_RECONSOLIDATED",
        || confirm_memory_reconsolidation_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn consolidation_preview(
    app: AppHandle,
) -> Result<ConsolidationPreviewSnapshot, String> {
    Ok(consolidation_preview_at(&alice_data_root_path(&app)?))
}

#[tauri::command]
pub(crate) fn consolidation_recovery_status(
    app: AppHandle,
) -> Result<ConsolidationRecoveryStatusSnapshot, String> {
    Ok(consolidation_recovery_status_at(&alice_data_root_path(
        &app,
    )?))
}

#[tauri::command]
pub(crate) fn restore_consolidation_transaction(
    app: AppHandle,
    input: RestoreConsolidationTransactionInput,
) -> Result<ConsolidationRestorationResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let operation_id = new_operation_id();
    let subject_digest = input.transaction_id.clone();
    restore_consolidation_transaction_at(
        &data_root,
        input,
        current_utc_timestamp()?,
        |stage, outcome, duration_ms, reason_code| {
            record_producer_audit(
                &app,
                operation_id.clone(),
                AuditSource::Memory,
                "memory.records.restore".into(),
                "restore_consolidation_transaction".into(),
                stage,
                outcome,
                duration_ms,
                Some(subject_digest.clone()),
                reason_code,
            )
        },
    )
}

#[tauri::command]
pub(crate) fn preview_consolidation_merge(
    app: AppHandle,
    input: PreviewConsolidationMergeInput,
) -> Result<ConsolidationMergePreview, String> {
    preview_consolidation_merge_at(&alice_data_root_path(&app)?, input)
}

#[tauri::command]
pub(crate) fn resolve_consolidation_candidate(
    app: AppHandle,
    input: ResolveConsolidationCandidateInput,
) -> Result<ConsolidationResolutionResult, String> {
    let data_root = alice_data_root_path(&app)?;
    let subject_digest = input.candidate_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "resolve_consolidation_candidate",
        &subject_digest,
        "MEMORY_CONSOLIDATION_KEPT_SEPARATE",
        || resolve_consolidation_candidate_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn activate_layered_memory(
    app: AppHandle,
    input: ActivateLayeredMemoryInput,
) -> Result<LayeredMemorySnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    let source_digest = input.expected_source_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "activate_layered_memory",
        &source_digest,
        "MEMORY_LAYERS_ACTIVATED",
        || activate_layered_memory_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn rollback_layered_memory(
    app: AppHandle,
    input: RollbackLayeredMemoryInput,
) -> Result<LayeredMemorySnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    let revision_digest = input.expected_revision_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.restore",
        "rollback_layered_memory",
        &revision_digest,
        "MEMORY_LAYERS_ROLLED_BACK",
        || rollback_layered_memory_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn save_memory(app: AppHandle, sessions: Vec<MemorySession>) -> Result<String, String> {
    validate_memory_sessions(&sessions)?;
    let _write_guard = acquire_memory_write_lock()?;
    let path = memory_file(&app)?;
    let content = records::prepare_validated_save_at(&path, &sessions)?;
    let digest = memory_subject_digest(&content);
    audited_memory_operation(
        &app,
        "memory.records.write",
        "memory.save",
        &digest,
        "MEMORY_SAVED",
        || records::save_prepared_at(&path, &content, sessions.len()),
    )?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub(crate) fn export_memory(app: AppHandle) -> Result<String, String> {
    let path = memory_file(&app)?;
    let prepared = records::prepare_export_at(&path)?;
    let digest = memory_subject_digest(&prepared.content);
    let export_path = audited_memory_operation(
        &app,
        "memory.records.export",
        "memory.export",
        &digest,
        "MEMORY_EXPORTED",
        || records::export_prepared_at(&path, &prepared),
    )?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
pub(crate) fn restore_memory_backup(app: AppHandle) -> Result<MemorySnapshot, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let path = memory_file(&app)?;
    let prepared = records::prepare_restore_at(&path)?;
    let digest = memory_subject_digest(&prepared.content);
    audited_memory_operation(
        &app,
        "memory.records.restore",
        "memory.restore",
        &digest,
        "MEMORY_RESTORED",
        || records::restore_prepared_at(&path, &prepared),
    )?;
    Ok(MemorySnapshot {
        sessions: prepared.sessions,
        storage_path: path.display().to_string(),
        existed: true,
    })
}

#[tauri::command]
pub(crate) fn open_memory_directory(app: AppHandle) -> Result<String, String> {
    let directory = memory_directory(&app)?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer.exe")
        .arg(&directory)
        .spawn()
        .map_err(|error| format!("No se pudo abrir la carpeta de memoria: {error}"))?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&directory)
        .spawn()
        .map_err(|error| format!("No se pudo abrir la carpeta de memoria: {error}"))?;
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    return Err("Abrir la carpeta está implementado solo para Windows en esta fase".into());
    Ok(directory.display().to_string())
}

#[cfg(test)]
mod tests;

// Reuse the verified atomic file primitive without writing to canonical records.
pub(crate) fn write_study_projection(path: &std::path::Path, content: &str) -> Result<(), String> {
    storage::atomic_replace_text_file(
        path,
        content,
        &format!("study-{}.tmp", uuid::Uuid::new_v4()),
        "avance de autoestudio",
    )
}
