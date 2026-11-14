use super::layers::read_layered_document_at;
use super::model::{
    ConsolidationCandidate, ConsolidationCandidateKind, ConsolidationDecision,
    ConsolidationDecisionDocument, ConsolidationMergeBackupStatus,
    ConsolidationMergeDifferenceField, ConsolidationMergeLayerImpact, ConsolidationMergePreview,
    ConsolidationPreviewSnapshot, ConsolidationPreviewState, ConsolidationReasonCode,
    ConsolidationRecoveryReceiptView, ConsolidationRecoveryRehearsal,
    ConsolidationRecoveryStatusSnapshot, ConsolidationRecoveryStatusState,
    ConsolidationRecoveryStep, ConsolidationResolutionAction, ConsolidationResolutionResult,
    ConsolidationRestartRecoveryResult, ConsolidationRestorationResult,
    ConsolidationSourceRelation, ConsolidationTransactionDocument, ConsolidationTransactionReceipt,
    ConsolidationTransactionState, MemorySession, PreviewConsolidationMergeInput,
    ResolveConsolidationCandidateInput, RestoreConsolidationTransactionInput,
};
use super::storage::{
    append_memory_audit, atomic_replace_memory_source, atomic_replace_text_file,
    memory_subject_digest, read_validated_source_at,
};
use super::validation::{
    is_sha256, validate_consolidation_decisions, validate_consolidation_transactions,
    validate_memory_sessions,
};
use super::CONSOLIDATION_DECISION_FILE;
use super::{
    elapsed_ms, CONSOLIDATION_DECISION_SCHEMA_VERSION, CONSOLIDATION_MAX_CANDIDATES,
    CONSOLIDATION_MAX_RECORDS, CONSOLIDATION_MERGE_PREVIEW_SCHEMA_VERSION,
    CONSOLIDATION_PREVIEW_SCHEMA_VERSION, CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION,
    CONSOLIDATION_TRANSACTION_FILE, CONSOLIDATION_TRANSACTION_SCHEMA_VERSION,
};
use crate::audit::AuditOutcome;
use crate::audit::AuditStage;
use crate::capabilities::validate_timestamp;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::time::Instant;

pub(super) fn normalize_consolidation_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn normalized_memory_signature(session: &MemorySession) -> String {
    [
        normalize_consolidation_text(&session.kind),
        normalize_consolidation_text(session.memory_type.as_deref().unwrap_or("")),
        normalize_consolidation_text(&session.intention),
        normalize_consolidation_text(session.summary.as_deref().unwrap_or("")),
        normalize_consolidation_text(session.next_step.as_deref().unwrap_or("")),
    ]
    .join("\u{1f}")
}

pub(super) fn empty_consolidation_snapshot(
    state: ConsolidationPreviewState,
    storage_path: String,
    blocked_reason: Option<String>,
) -> ConsolidationPreviewSnapshot {
    ConsolidationPreviewSnapshot {
        schema_version: CONSOLIDATION_PREVIEW_SCHEMA_VERSION,
        state,
        storage_path,
        source_sha256: None,
        record_count: 0,
        eligible_record_count: 0,
        archived_record_count: 0,
        candidate_count: 0,
        pending_candidate_count: 0,
        kept_separate_count: 0,
        exact_duplicate_count: 0,
        review_required_count: 0,
        candidates: Vec::new(),
        blocked_reason,
        automatic_merge: false,
        records_modified: false,
        model_used: false,
    }
}

pub(super) fn consolidation_preview_at(data_root: &Path) -> ConsolidationPreviewSnapshot {
    let records_path = data_root.join("memory").join("records.json");
    let storage_path = records_path.display().to_string();
    let (source_content, sessions) = match read_validated_source_at(data_root) {
        Ok(Some(source)) => source,
        Ok(None) => {
            return empty_consolidation_snapshot(
                ConsolidationPreviewState::Unavailable,
                storage_path,
                None,
            )
        }
        Err(error) => {
            return empty_consolidation_snapshot(
                ConsolidationPreviewState::Blocked,
                storage_path,
                Some(error),
            )
        }
    };
    let source_sha256 = memory_subject_digest(&source_content);
    if sessions.len() > CONSOLIDATION_MAX_RECORDS {
        let mut snapshot = empty_consolidation_snapshot(
            ConsolidationPreviewState::Blocked,
            storage_path,
            Some(format!(
                "La vista R6.3 admite hasta {CONSOLIDATION_MAX_RECORDS} registros por revisión"
            )),
        );
        snapshot.source_sha256 = Some(source_sha256);
        snapshot.record_count = sessions.len();
        return snapshot;
    }

    let archived_record_count = sessions
        .iter()
        .filter(|session| {
            session.memory_status.as_deref() == Some("archived")
                || session.archive_status.as_deref() == Some("archived")
        })
        .count();
    let mut eligible = sessions
        .iter()
        .filter(|session| {
            session.finished_at.is_some()
                && session.memory_status.as_deref() != Some("archived")
                && session.archive_status.as_deref() != Some("archived")
        })
        .collect::<Vec<_>>();
    eligible.sort_by(|left, right| left.id.cmp(&right.id));
    let mut candidates = Vec::new();

    for (index, left) in eligible.iter().enumerate() {
        let left_intention = normalize_consolidation_text(&left.intention);
        for right in eligible.iter().skip(index + 1) {
            if left_intention != normalize_consolidation_text(&right.intention) {
                continue;
            }
            if candidates.len() == CONSOLIDATION_MAX_CANDIDATES {
                let mut snapshot = empty_consolidation_snapshot(
                    ConsolidationPreviewState::Blocked,
                    storage_path,
                    Some(format!(
                        "La vista R6.3 excede {CONSOLIDATION_MAX_CANDIDATES} pares candidatos"
                    )),
                );
                snapshot.source_sha256 = Some(source_sha256);
                snapshot.record_count = sessions.len();
                snapshot.eligible_record_count = eligible.len();
                snapshot.archived_record_count = archived_record_count;
                return snapshot;
            }
            let exact = normalized_memory_signature(left) == normalized_memory_signature(right);
            let kind = if exact {
                ConsolidationCandidateKind::ExactDuplicate
            } else {
                ConsolidationCandidateKind::ReviewRequired
            };
            let reason_code = if exact {
                ConsolidationReasonCode::ExactNormalizedContent
            } else {
                ConsolidationReasonCode::SameNormalizedIntentionDifferentContent
            };
            let candidate_id = memory_subject_digest(&format!(
                "alice-consolidation-preview:{CONSOLIDATION_PREVIEW_SCHEMA_VERSION}:{source_sha256}:{:?}:{}:{}",
                kind, left.id, right.id
            ));
            candidates.push(ConsolidationCandidate {
                candidate_id,
                kind,
                record_ids: vec![left.id.clone(), right.id.clone()],
                reason_code,
                requires_human_review: true,
                resolution: None,
                decision_id: None,
            });
        }
    }

    let decisions = match read_consolidation_decisions_at(data_root) {
        Ok(document) => document,
        Err(error) => {
            let mut snapshot = empty_consolidation_snapshot(
                ConsolidationPreviewState::Blocked,
                storage_path,
                Some(error),
            );
            snapshot.source_sha256 = Some(source_sha256);
            snapshot.record_count = sessions.len();
            snapshot.eligible_record_count = eligible.len();
            snapshot.archived_record_count = archived_record_count;
            return snapshot;
        }
    };
    if decisions
        .decisions
        .iter()
        .any(|decision| decision.source_sha256 == source_sha256)
    {
        let backup_path = consolidation_source_backup_path(data_root, &source_sha256);
        let backup_matches = fs::read_to_string(&backup_path)
            .map(|content| content == source_content)
            .unwrap_or(false);
        if !backup_matches {
            let mut snapshot = empty_consolidation_snapshot(
                ConsolidationPreviewState::Blocked,
                storage_path,
                Some("La decisión R6.3 no posee un respaldo canónico verificable".into()),
            );
            snapshot.source_sha256 = Some(source_sha256);
            snapshot.record_count = sessions.len();
            snapshot.eligible_record_count = eligible.len();
            snapshot.archived_record_count = archived_record_count;
            return snapshot;
        }
    }
    for candidate in &mut candidates {
        if let Some(decision) = decisions.decisions.iter().find(|decision| {
            decision.source_sha256 == source_sha256
                && decision.candidate_id == candidate.candidate_id
                && decision.record_ids == candidate.record_ids
        }) {
            candidate.resolution = Some(decision.action);
            candidate.decision_id = Some(decision.decision_id.clone());
        }
    }

    let exact_duplicate_count = candidates
        .iter()
        .filter(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .count();
    let review_required_count = candidates.len() - exact_duplicate_count;
    let kept_separate_count = candidates
        .iter()
        .filter(|candidate| {
            candidate.resolution == Some(ConsolidationResolutionAction::KeepSeparate)
        })
        .count();
    ConsolidationPreviewSnapshot {
        schema_version: CONSOLIDATION_PREVIEW_SCHEMA_VERSION,
        state: ConsolidationPreviewState::Ready,
        storage_path,
        source_sha256: Some(source_sha256),
        record_count: sessions.len(),
        eligible_record_count: eligible.len(),
        archived_record_count,
        candidate_count: candidates.len(),
        pending_candidate_count: candidates.len() - kept_separate_count,
        kept_separate_count,
        exact_duplicate_count,
        review_required_count,
        candidates,
        blocked_reason: None,
        automatic_merge: false,
        records_modified: false,
        model_used: false,
    }
}

pub(super) fn consolidation_merge_differences(
    survivor: &MemorySession,
    duplicate: &MemorySession,
) -> Vec<ConsolidationMergeDifferenceField> {
    let mut fields = Vec::new();
    macro_rules! compare {
        ($field:ident, $variant:ident) => {
            if survivor.$field != duplicate.$field {
                fields.push(ConsolidationMergeDifferenceField::$variant);
            }
        };
    }
    compare!(kind, Kind);
    compare!(intention, Intention);
    compare!(started_at, StartedAt);
    compare!(finished_at, FinishedAt);
    compare!(summary, Summary);
    compare!(next_step, NextStep);
    compare!(memory_type, MemoryType);
    compare!(source, Source);
    compare!(importance, Importance);
    compare!(storage_strength, StorageStrength);
    compare!(memory_status, MemoryStatus);
    compare!(suppression_status, SuppressionStatus);
    compare!(suppression_reason, SuppressionReason);
    compare!(suppression_updated_at, SuppressionUpdatedAt);
    compare!(archive_status, ArchiveStatus);
    compare!(archive_reason, ArchiveReason);
    compare!(archive_updated_at, ArchiveUpdatedAt);
    compare!(deletion_status, DeletionStatus);
    compare!(deletion_reason, DeletionReason);
    compare!(deletion_requested_at, DeletionRequestedAt);
    compare!(deletion_eligible_at, DeletionEligibleAt);
    compare!(memory_version, MemoryVersion);
    compare!(reconsolidated_at, ReconsolidatedAt);
    compare!(reconsolidation_reason, ReconsolidationReason);
    compare!(previous_version_sha256, PreviousVersionSha256);
    compare!(successful_recalls, SuccessfulRecalls);
    compare!(failed_recalls, FailedRecalls);
    compare!(last_recalled_at, LastRecalledAt);
    compare!(retrieval_evidence_version, RetrievalEvidenceVersion);
    compare!(successful_reviews, SuccessfulReviews);
    compare!(correction_count, CorrectionCount);
    compare!(last_reviewed_at, LastReviewedAt);
    compare!(context_events, ContextEvents);
    fields
}

pub(super) fn preview_consolidation_merge_at(
    data_root: &Path,
    input: PreviewConsolidationMergeInput,
) -> Result<ConsolidationMergePreview, String> {
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.candidate_id) {
        return Err("La vista de fusión R6.3-C contiene una huella inválida".into());
    }
    if input.expected_record_ids.len() != 2
        || input
            .expected_record_ids
            .iter()
            .any(|id| id.trim().is_empty())
        || input.expected_record_ids[0] >= input.expected_record_ids[1]
    {
        return Err(
            "La vista de fusión R6.3-C requiere dos registros ordenados y distintos".into(),
        );
    }
    if !input
        .expected_record_ids
        .iter()
        .any(|id| id == &input.survivor_record_id)
    {
        return Err("El registro superviviente debe pertenecer al par revisado".into());
    }

    let preview = consolidation_preview_at(data_root);
    if preview.state != ConsolidationPreviewState::Ready {
        return Err(preview
            .blocked_reason
            .unwrap_or_else(|| "La memoria canónica no está disponible".into()));
    }
    if preview.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str()) {
        return Err(
            "records.json cambió después de la vista previa; actualizá antes de planificar".into(),
        );
    }
    let candidate = preview
        .candidates
        .iter()
        .find(|candidate| candidate.candidate_id == input.candidate_id)
        .ok_or("El candidato R6.3-C ya no existe en la fuente revisada")?;
    if candidate.record_ids != input.expected_record_ids {
        return Err("El par de registros no coincide con el candidato revisado".into());
    }
    if candidate.kind != ConsolidationCandidateKind::ExactDuplicate {
        return Err("R6.3-C sólo admite duplicados exactos normalizados".into());
    }
    if candidate.resolution.is_some() {
        return Err("El candidato ya posee una decisión humana y no admite plan de fusión".into());
    }

    let (source_content, sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para planificar la fusión")?;
    if memory_subject_digest(&source_content) != input.expected_source_sha256 {
        return Err("records.json cambió durante la planificación; no se produjo un plan".into());
    }
    let survivor = sessions
        .iter()
        .find(|session| session.id == input.survivor_record_id)
        .ok_or("El registro superviviente ya no existe")?;
    let duplicate_record_id = input
        .expected_record_ids
        .iter()
        .find(|id| *id != &input.survivor_record_id)
        .cloned()
        .ok_or("No se pudo determinar el registro duplicado")?;
    let duplicate = sessions
        .iter()
        .find(|session| session.id == duplicate_record_id)
        .ok_or("El registro duplicado ya no existe")?;
    if normalized_memory_signature(survivor) != normalized_memory_signature(duplicate) {
        return Err("El contenido normalizado dejó de ser idéntico".into());
    }

    let projected_sessions = sessions
        .iter()
        .filter(|session| session.id != duplicate_record_id)
        .cloned()
        .collect::<Vec<_>>();
    validate_memory_sessions(&projected_sessions)?;
    let projected_source =
        serde_json::to_string_pretty(&projected_sessions).map_err(|error| error.to_string())?;
    let source_backup_path =
        consolidation_source_backup_path(data_root, &input.expected_source_sha256);
    let source_backup_status = if source_backup_path.exists() {
        let backup = fs::read_to_string(&source_backup_path)
            .map_err(|error| format!("No se pudo verificar el respaldo R6.3-C: {error}"))?;
        if backup != source_content {
            return Err("El respaldo existente no coincide con records.json".into());
        }
        ConsolidationMergeBackupStatus::Verified
    } else {
        ConsolidationMergeBackupStatus::Missing
    };
    let layered_document = read_layered_document_at(data_root)?;
    let (layer_impact, active_layer_revision_id) = match layered_document {
        None => (ConsolidationMergeLayerImpact::Absent, None),
        Some(document) => match document.active_revision_id {
            Some(active) => (
                ConsolidationMergeLayerImpact::ActiveRevisionWillBecomeStale,
                Some(active),
            ),
            None => (ConsolidationMergeLayerImpact::Inactive, None),
        },
    };

    Ok(ConsolidationMergePreview {
        schema_version: CONSOLIDATION_MERGE_PREVIEW_SCHEMA_VERSION,
        source_sha256: input.expected_source_sha256,
        candidate_id: input.candidate_id,
        candidate_kind: candidate.kind,
        reason_code: candidate.reason_code,
        record_ids: input.expected_record_ids,
        survivor_record_id: input.survivor_record_id,
        duplicate_record_id,
        current_record_count: sessions.len(),
        projected_record_count: projected_sessions.len(),
        projected_source_sha256: memory_subject_digest(&projected_source),
        projected_source_byte_length: projected_source.len(),
        normalized_content_equal: true,
        differing_fields: consolidation_merge_differences(survivor, duplicate),
        source_backup_path: source_backup_path.display().to_string(),
        source_backup_status,
        layer_impact,
        active_layer_revision_id,
        recovery_protocol_version: 1,
        recovery_steps: vec![
            ConsolidationRecoveryStep::VerifySource,
            ConsolidationRecoveryStep::CreateOrVerifyBackup,
            ConsolidationRecoveryStep::PrepareProjectedSource,
            ConsolidationRecoveryStep::AtomicReplace,
            ConsolidationRecoveryStep::VerifyProjectedSource,
            ConsolidationRecoveryStep::WriteAudit,
            ConsolidationRecoveryStep::RestoreBackupOnFailure,
            ConsolidationRecoveryStep::VerifyRestoredSource,
        ],
        byte_exact_backup_required: true,
        atomic_replace_required: true,
        audit_required: true,
        restored_source_verification_required: true,
        active_layer_execution_blocked: matches!(
            layer_impact,
            ConsolidationMergeLayerImpact::ActiveRevisionWillBecomeStale
        ),
        transaction_receipt_version: CONSOLIDATION_TRANSACTION_SCHEMA_VERSION,
        transaction_receipt_file: CONSOLIDATION_TRANSACTION_FILE.into(),
        durable_receipt_required: true,
        restart_recovery_required: true,
        execution_available: false,
        requires_final_confirmation: true,
        restoration_command_available: true,
        records_modified: false,
        files_created: false,
        audit_written: false,
        model_used: false,
    })
}

pub(super) fn projected_consolidation_source_at(
    data_root: &Path,
    plan: &ConsolidationMergePreview,
) -> Result<String, String> {
    let (source, sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para preparar el ensayo R6.3-D")?;
    if memory_subject_digest(&source) != plan.source_sha256 {
        return Err("records.json cambió antes del ensayo R6.3-D".into());
    }
    let projected_sessions = sessions
        .into_iter()
        .filter(|session| session.id != plan.duplicate_record_id)
        .collect::<Vec<_>>();
    validate_memory_sessions(&projected_sessions)?;
    let projected =
        serde_json::to_string_pretty(&projected_sessions).map_err(|error| error.to_string())?;
    if projected_sessions.len() != plan.projected_record_count
        || projected.len() != plan.projected_source_byte_length
        || memory_subject_digest(&projected) != plan.projected_source_sha256
    {
        return Err("La proyección R6.3-D no coincide con el plan humano revisado".into());
    }
    Ok(projected)
}

pub(super) fn restore_rehearsal_source(
    source_path: &Path,
    backup_content: &str,
    expected_source_sha256: &str,
) -> Result<String, String> {
    atomic_replace_memory_source(source_path, backup_content, expected_source_sha256)?;
    let restored = fs::read_to_string(source_path)
        .map_err(|error| format!("No se pudo releer la restauración R6.3-D: {error}"))?;
    let restored_sha256 = memory_subject_digest(&restored);
    if restored_sha256 != expected_source_sha256 || restored != backup_content {
        return Err("La restauración R6.3-D no recuperó los bytes originales".into());
    }
    Ok(restored_sha256)
}

// Este motor sólo se invoca desde pruebas físicas controladas; no es un comando de la app.
#[allow(dead_code)]
pub(super) fn rehearse_consolidation_recovery_at(
    data_root: &Path,
    input: PreviewConsolidationMergeInput,
    audit: impl FnOnce(&ConsolidationMergePreview) -> Result<(), String>,
) -> Result<ConsolidationRecoveryRehearsal, String> {
    let plan = preview_consolidation_merge_at(data_root, input)?;
    if plan.active_layer_execution_blocked {
        return Err(
            "R6.3-D bloqueó el ensayo porque una revisión R6.1 activa quedaría obsoleta".into(),
        );
    }
    let source_path = data_root.join("memory").join("records.json");
    let source_content = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo releer records.json para R6.3-D: {error}"))?;
    if memory_subject_digest(&source_content) != plan.source_sha256 {
        return Err("records.json cambió antes de crear el respaldo R6.3-D".into());
    }
    let projected_content = projected_consolidation_source_at(data_root, &plan)?;
    let backup_path = PathBuf::from(&plan.source_backup_path);
    let backup_directory = backup_path
        .parent()
        .ok_or("El respaldo R6.3-D no posee un directorio válido")?;
    fs::create_dir_all(backup_directory)
        .map_err(|error| format!("No se pudo crear el directorio de respaldo R6.3-D: {error}"))?;
    let backup_created = if backup_path.exists() {
        false
    } else {
        let mut backup_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&backup_path)
            .map_err(|error| format!("No se pudo crear el respaldo R6.3-D: {error}"))?;
        backup_file
            .write_all(source_content.as_bytes())
            .and_then(|()| backup_file.sync_all())
            .map_err(|error| format!("No se pudo persistir el respaldo R6.3-D: {error}"))?;
        true
    };
    let backup_content = fs::read_to_string(&backup_path)
        .map_err(|error| format!("No se pudo verificar el respaldo R6.3-D: {error}"))?;
    if backup_content != source_content
        || memory_subject_digest(&backup_content) != plan.source_sha256
    {
        return Err("El respaldo R6.3-D no coincide byte a byte con la fuente".into());
    }

    if let Err(replace_error) = atomic_replace_memory_source(
        &source_path,
        &projected_content,
        &plan.projected_source_sha256,
    ) {
        let current = fs::read_to_string(&source_path).unwrap_or_default();
        if current != source_content {
            restore_rehearsal_source(&source_path, &backup_content, &plan.source_sha256).map_err(
                |restore_error| {
                    format!(
                        "Falló el reemplazo R6.3-D ({replace_error}) y también la restauración ({restore_error})"
                    )
                },
            )?;
        }
        return Err(replace_error);
    }

    let audit_result = audit(&plan);
    let restored_source_sha256 =
        restore_rehearsal_source(&source_path, &backup_content, &plan.source_sha256).map_err(
            |restore_error| match &audit_result {
                Ok(()) => format!("El ensayo se auditó, pero no pudo restaurarse: {restore_error}"),
                Err(audit_error) => format!(
            "Fallaron la auditoría ({audit_error}) y la restauración R6.3-D ({restore_error})"
        ),
            },
        )?;
    if let Err(audit_error) = audit_result {
        return Err(format!(
            "La auditoría R6.3-D falló y records.json fue restaurado byte a byte: {audit_error}"
        ));
    }

    Ok(ConsolidationRecoveryRehearsal {
        source_sha256: plan.source_sha256,
        projected_source_sha256: plan.projected_source_sha256,
        restored_source_sha256,
        source_backup_path: backup_path.display().to_string(),
        backup_created,
        projected_source_verified: true,
        audit_written: true,
        source_restored: true,
    })
}

pub(super) fn read_consolidation_transactions_at(
    data_root: &Path,
) -> Result<ConsolidationTransactionDocument, String> {
    let path = consolidation_transaction_path(data_root);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ConsolidationTransactionDocument {
                schema_version: CONSOLIDATION_TRANSACTION_SCHEMA_VERSION,
                transactions: Vec::new(),
            });
        }
        Err(error) => return Err(format!("No se pudo leer el recibo R6.3-E: {error}")),
    };
    let document = serde_json::from_str::<ConsolidationTransactionDocument>(&content)
        .map_err(|error| format!("El recibo R6.3-E no es válido: {error}"))?;
    validate_consolidation_transactions(&document)?;
    Ok(document)
}

pub(super) fn consolidation_recovery_receipt_view(
    receipt: &ConsolidationTransactionReceipt,
) -> ConsolidationRecoveryReceiptView {
    ConsolidationRecoveryReceiptView {
        transaction_id: receipt.transaction_id.clone(),
        candidate_id: receipt.candidate_id.clone(),
        source_sha256: receipt.source_sha256.clone(),
        projected_source_sha256: receipt.projected_source_sha256.clone(),
        source_backup_file: receipt.source_backup_file.clone(),
        state: receipt.state,
        created_at: receipt.created_at.clone(),
        restored_at: receipt.restored_at.clone(),
    }
}

pub(super) fn consolidation_recovery_status_at(
    data_root: &Path,
) -> ConsolidationRecoveryStatusSnapshot {
    let receipt_path = consolidation_transaction_path(data_root);
    let receipt_file_exists = receipt_path.is_file();
    let base = |state,
                transaction_count,
                receipt,
                source_relation,
                current_source_sha256,
                blocked_reason,
                restoration_available| ConsolidationRecoveryStatusSnapshot {
        schema_version: CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION,
        state,
        receipt_path: receipt_path.display().to_string(),
        receipt_file_exists,
        transaction_count,
        receipt,
        source_relation,
        current_source_sha256,
        blocked_reason,
        restoration_available,
        restoration_requires_confirmation: true,
        automatic_recovery: false,
        merge_execution_available: false,
        records_modified: false,
        files_created: false,
    };
    let document = match read_consolidation_transactions_at(data_root) {
        Ok(document) => document,
        Err(error) => {
            return base(
                ConsolidationRecoveryStatusState::Blocked,
                0,
                None,
                None,
                None,
                Some(error),
                false,
            )
        }
    };
    let transaction_count = document.transactions.len();
    let selected = document
        .transactions
        .iter()
        .find(|receipt| receipt.state != ConsolidationTransactionState::Restored)
        .or_else(|| document.transactions.last());
    let Some(receipt) = selected else {
        return base(
            ConsolidationRecoveryStatusState::Idle,
            transaction_count,
            None,
            None,
            None,
            None,
            false,
        );
    };
    let source_path = data_root.join("memory").join("records.json");
    let current_source_sha256 = match fs::read_to_string(&source_path) {
        Ok(content) => Some(memory_subject_digest(&content)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return base(
                ConsolidationRecoveryStatusState::Blocked,
                transaction_count,
                Some(consolidation_recovery_receipt_view(receipt)),
                None,
                None,
                Some(format!(
                    "No se pudo leer records.json para determinar la recuperación R6.3-F: {error}"
                )),
                false,
            )
        }
    };
    let source_relation = match current_source_sha256.as_deref() {
        Some(sha256) if sha256 == receipt.source_sha256 => ConsolidationSourceRelation::Original,
        Some(sha256) if sha256 == receipt.projected_source_sha256 => {
            ConsolidationSourceRelation::Projected
        }
        Some(_) => ConsolidationSourceRelation::Diverged,
        None => ConsolidationSourceRelation::Missing,
    };
    let receipt_view = Some(consolidation_recovery_receipt_view(receipt));
    match (receipt.state, source_relation) {
        (ConsolidationTransactionState::Restored, ConsolidationSourceRelation::Original) => base(
            ConsolidationRecoveryStatusState::Restored,
            transaction_count,
            receipt_view,
            Some(source_relation),
            current_source_sha256,
            None,
            false,
        ),
        (
            ConsolidationTransactionState::Prepared | ConsolidationTransactionState::Projected,
            ConsolidationSourceRelation::Original | ConsolidationSourceRelation::Projected,
        ) => base(
            ConsolidationRecoveryStatusState::RecoveryRequired,
            transaction_count,
            receipt_view,
            Some(source_relation),
            current_source_sha256,
            None,
            true,
        ),
        _ => base(
            ConsolidationRecoveryStatusState::Blocked,
            transaction_count,
            receipt_view,
            Some(source_relation),
            current_source_sha256,
            Some(
                "records.json no coincide con el estado durable del recibo R6.3-F; no se modificó la fuente"
                    .into(),
            ),
            false,
        ),
    }
}

pub(super) fn write_consolidation_transactions_at(
    data_root: &Path,
    document: &ConsolidationTransactionDocument,
) -> Result<(), String> {
    validate_consolidation_transactions(document)?;
    let path = consolidation_transaction_path(data_root);
    let content = serde_json::to_string_pretty(document).map_err(|error| error.to_string())?;
    atomic_replace_text_file(&path, &content, "r6-3-e.tmp", "recibo R6.3-E")?;
    let stored = read_consolidation_transactions_at(data_root)?;
    if stored != *document {
        return Err("El recibo R6.3-E no coincide después de releerlo".into());
    }
    Ok(())
}

pub(super) fn create_or_verify_transaction_backup(
    data_root: &Path,
    plan: &ConsolidationMergePreview,
    source_content: &str,
) -> Result<PathBuf, String> {
    let backup_path = consolidation_source_backup_path(data_root, &plan.source_sha256);
    let backup_directory = backup_path
        .parent()
        .ok_or("El respaldo R6.3-E no posee un directorio válido")?;
    fs::create_dir_all(backup_directory)
        .map_err(|error| format!("No se pudo crear el directorio R6.3-E: {error}"))?;
    if !backup_path.exists() {
        let mut backup = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&backup_path)
            .map_err(|error| format!("No se pudo crear el respaldo R6.3-E: {error}"))?;
        backup
            .write_all(source_content.as_bytes())
            .and_then(|()| backup.sync_all())
            .map_err(|error| format!("No se pudo persistir el respaldo R6.3-E: {error}"))?;
    }
    let stored = fs::read_to_string(&backup_path)
        .map_err(|error| format!("No se pudo verificar el respaldo R6.3-E: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != plan.source_sha256 {
        return Err("El respaldo R6.3-E no coincide byte a byte".into());
    }
    Ok(backup_path)
}

// Prepara una interrupción controlada. No está registrada como comando Tauri.
#[allow(dead_code)]
pub(super) fn prepare_interrupted_consolidation_at(
    data_root: &Path,
    input: PreviewConsolidationMergeInput,
    created_at: String,
) -> Result<String, String> {
    validate_timestamp("createdAt", &created_at)?;
    let plan = preview_consolidation_merge_at(data_root, input)?;
    if plan.active_layer_execution_blocked {
        return Err("R6.3-E bloqueó la preparación porque R6.1 está activa".into());
    }
    let mut document = read_consolidation_transactions_at(data_root)?;
    if document
        .transactions
        .iter()
        .any(|receipt| receipt.state != ConsolidationTransactionState::Restored)
    {
        return Err("Ya existe una transacción R6.3-E pendiente de recuperación".into());
    }
    let source_path = data_root.join("memory").join("records.json");
    let source_content = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo leer records.json para R6.3-E: {error}"))?;
    if memory_subject_digest(&source_content) != plan.source_sha256 {
        return Err("records.json cambió antes de preparar R6.3-E".into());
    }
    let projected_content = projected_consolidation_source_at(data_root, &plan)?;
    let backup_path = create_or_verify_transaction_backup(data_root, &plan, &source_content)?;
    let transaction_id = memory_subject_digest(&format!(
        "alice-consolidation-transaction:{}:{}:{}:{}",
        plan.source_sha256,
        plan.projected_source_sha256,
        plan.candidate_id,
        plan.survivor_record_id
    ));
    let receipt = ConsolidationTransactionReceipt {
        transaction_id: transaction_id.clone(),
        candidate_id: plan.candidate_id,
        record_ids: plan.record_ids,
        survivor_record_id: plan.survivor_record_id,
        duplicate_record_id: plan.duplicate_record_id,
        source_sha256: plan.source_sha256.clone(),
        projected_source_sha256: plan.projected_source_sha256.clone(),
        source_backup_file: backup_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("El nombre del respaldo R6.3-E no es UTF-8")?
            .into(),
        state: ConsolidationTransactionState::Prepared,
        created_at,
        restored_at: None,
    };
    document.transactions.push(receipt);
    write_consolidation_transactions_at(data_root, &document)?;

    atomic_replace_memory_source(
        &source_path,
        &projected_content,
        &plan.projected_source_sha256,
    )?;
    let stored_receipt = document
        .transactions
        .iter_mut()
        .find(|receipt| receipt.transaction_id == transaction_id)
        .ok_or("La transacción R6.3-E desapareció antes de marcarse proyectada")?;
    stored_receipt.state = ConsolidationTransactionState::Projected;
    write_consolidation_transactions_at(data_root, &document)?;
    Ok(transaction_id)
}

// Primitiva de disco: R6.3-F sólo la expone a través del wrapper gobernado.
#[allow(dead_code)]
pub(super) fn recover_interrupted_consolidation_at(
    data_root: &Path,
    transaction_id: &str,
    expected_source_sha256: &str,
    expected_projected_source_sha256: &str,
    restored_at: String,
    audit: impl FnOnce(&ConsolidationTransactionReceipt) -> Result<(), String>,
) -> Result<ConsolidationRestartRecoveryResult, String> {
    if !is_sha256(transaction_id)
        || !is_sha256(expected_source_sha256)
        || !is_sha256(expected_projected_source_sha256)
    {
        return Err("La recuperación R6.3-F contiene una huella inválida".into());
    }
    validate_timestamp("restoredAt", &restored_at)?;
    let mut document = read_consolidation_transactions_at(data_root)?;
    let receipt_index = document
        .transactions
        .iter()
        .position(|receipt| receipt.transaction_id == transaction_id)
        .ok_or("La transacción R6.3-E no existe")?;
    let receipt = document.transactions[receipt_index].clone();
    if receipt.source_sha256 != expected_source_sha256
        || receipt.projected_source_sha256 != expected_projected_source_sha256
    {
        return Err(
            "El recibo R6.3-F cambió después de la revisión; actualizá el estado antes de restaurar"
                .into(),
        );
    }
    let source_path = data_root.join("memory").join("records.json");
    let current = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo leer records.json al recuperar R6.3-E: {error}"))?;
    let current_sha256 = memory_subject_digest(&current);
    if receipt.state == ConsolidationTransactionState::Restored {
        if current_sha256 != receipt.source_sha256 {
            return Err("El recibo está restaurado, pero records.json no coincide".into());
        }
        return Ok(ConsolidationRestartRecoveryResult {
            transaction_id: receipt.transaction_id,
            source_sha256: receipt.source_sha256,
            source_restored: true,
            audit_written: true,
            receipt_state: ConsolidationTransactionState::Restored,
        });
    }
    if current_sha256 == receipt.projected_source_sha256 {
        let backup_path = data_root
            .join("memory")
            .join("backups")
            .join(&receipt.source_backup_file);
        let backup = fs::read_to_string(&backup_path)
            .map_err(|error| format!("No se pudo leer el respaldo al recuperar R6.3-E: {error}"))?;
        restore_rehearsal_source(&source_path, &backup, &receipt.source_sha256)?;
    } else if current_sha256 != receipt.source_sha256 {
        return Err(
            "records.json no coincide con la fuente ni la proyección del recibo R6.3-E".into(),
        );
    }
    if let Err(error) = audit(&receipt) {
        return Err(format!(
            "La fuente R6.3-E fue restaurada, pero la auditoría debe reintentarse: {error}"
        ));
    }
    let stored_receipt = &mut document.transactions[receipt_index];
    stored_receipt.state = ConsolidationTransactionState::Restored;
    stored_receipt.restored_at = Some(restored_at);
    write_consolidation_transactions_at(data_root, &document)?;
    Ok(ConsolidationRestartRecoveryResult {
        transaction_id: transaction_id.into(),
        source_sha256: receipt.source_sha256,
        source_restored: true,
        audit_written: true,
        receipt_state: ConsolidationTransactionState::Restored,
    })
}

pub(super) fn restore_consolidation_transaction_at(
    data_root: &Path,
    input: RestoreConsolidationTransactionInput,
    restored_at: String,
    mut audit: impl FnMut(AuditStage, AuditOutcome, Option<u64>, &str) -> Result<(), String>,
) -> Result<ConsolidationRestorationResult, String> {
    if !input.confirmed {
        return Err("La restauración R6.3-F requiere confirmación explícita".into());
    }
    if !is_sha256(&input.transaction_id)
        || !is_sha256(&input.expected_source_sha256)
        || !is_sha256(&input.expected_projected_source_sha256)
    {
        return Err("La restauración R6.3-F contiene una huella inválida".into());
    }
    validate_timestamp("restoredAt", &restored_at)?;
    let document = read_consolidation_transactions_at(data_root)?;
    let receipt = document
        .transactions
        .iter()
        .find(|receipt| receipt.transaction_id == input.transaction_id)
        .ok_or("La transacción R6.3-F ya no existe")?;
    if receipt.source_sha256 != input.expected_source_sha256
        || receipt.projected_source_sha256 != input.expected_projected_source_sha256
    {
        return Err(
            "El recibo R6.3-F cambió después de la revisión; actualizá antes de restaurar".into(),
        );
    }
    let before = consolidation_recovery_status_at(data_root);
    if before
        .receipt
        .as_ref()
        .map(|view| view.transaction_id.as_str())
        != Some(input.transaction_id.as_str())
    {
        return Err("El estado R6.3-F ya no corresponde a la transacción revisada".into());
    }
    if receipt.state == ConsolidationTransactionState::Restored {
        if before.state != ConsolidationRecoveryStatusState::Restored {
            return Err(before
                .blocked_reason
                .unwrap_or_else(|| "La restauración cerrada no coincide con records.json".into()));
        }
        return Ok(ConsolidationRestorationResult {
            schema_version: CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION,
            transaction_id: receipt.transaction_id.clone(),
            source_sha256: receipt.source_sha256.clone(),
            source_restored: true,
            audit_written: true,
            already_restored: true,
            receipt_state: ConsolidationTransactionState::Restored,
            status: before,
        });
    }
    if before.state != ConsolidationRecoveryStatusState::RecoveryRequired
        || !before.restoration_available
    {
        return Err(before
            .blocked_reason
            .unwrap_or_else(|| "La restauración R6.3-F no está disponible".into()));
    }

    audit(
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        "MEMORY_CONSOLIDATION_RESTORE_ACCEPTED",
    )?;
    let started = Instant::now();
    let recovery = recover_interrupted_consolidation_at(
        data_root,
        &input.transaction_id,
        &input.expected_source_sha256,
        &input.expected_projected_source_sha256,
        restored_at,
        |_| {
            audit(
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(elapsed_ms(started)),
                "MEMORY_CONSOLIDATION_RESTART_RESTORED",
            )
        },
    );
    let recovery = match recovery {
        Ok(recovery) => recovery,
        Err(error) => {
            if let Err(audit_error) = audit(
                AuditStage::Error,
                AuditOutcome::Error,
                Some(elapsed_ms(started)),
                "MEMORY_CONSOLIDATION_RESTORE_FAILED",
            ) {
                return Err(format!(
                    "{error}; además no se pudo auditar el fallo R6.3-F: {audit_error}"
                ));
            }
            return Err(error);
        }
    };
    let status = consolidation_recovery_status_at(data_root);
    if status.state != ConsolidationRecoveryStatusState::Restored
        || status.current_source_sha256.as_deref() != Some(recovery.source_sha256.as_str())
    {
        return Err("R6.3-F restauró la fuente, pero el estado final no pudo verificarse".into());
    }
    Ok(ConsolidationRestorationResult {
        schema_version: CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION,
        transaction_id: recovery.transaction_id,
        source_sha256: recovery.source_sha256,
        source_restored: recovery.source_restored,
        audit_written: recovery.audit_written,
        already_restored: false,
        receipt_state: recovery.receipt_state,
        status,
    })
}

pub(super) fn write_consolidation_decisions_at(
    data_root: &Path,
    document: &ConsolidationDecisionDocument,
) -> Result<String, String> {
    validate_consolidation_decisions(document)?;
    let memory = data_root.join("memory");
    let backups = memory.join("backups");
    fs::create_dir_all(&backups)
        .map_err(|error| format!("No se pudo crear el respaldo R6.3: {error}"))?;
    let path = consolidation_decision_path(data_root);
    let previous = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("No se pudo leer el registro R6.3 anterior: {error}"))?;
        let previous_sha256 = memory_subject_digest(&content);
        let backup_path = backups.join(format!(
            "consolidation-decisions-v1-{}.json",
            &previous_sha256[7..]
        ));
        if !backup_path.exists() {
            fs::write(&backup_path, content.as_bytes())
                .map_err(|error| format!("No se pudo respaldar el registro R6.3: {error}"))?;
        }
        Some(content)
    } else {
        None
    };
    let content = serde_json::to_string_pretty(document).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, &content)
        .map_err(|error| format!("No se pudo preparar el registro R6.3: {error}"))?;
    let copy_result = fs::copy(&temporary, &path)
        .map_err(|error| format!("No se pudo guardar el registro R6.3: {error}"));
    copy_result?;
    if let Err(error) = fs::remove_file(&temporary) {
        eprintln!("No se pudo limpiar el temporal R6.3: {error}");
    }
    if let Err(audit_error) = append_memory_audit(
        &path,
        "consolidation-keep-separate",
        document.decisions.len(),
        &content,
    ) {
        let rollback = match previous {
            Some(previous) => fs::write(&path, previous.as_bytes()),
            None => fs::remove_file(&path),
        };
        return match rollback {
            Ok(()) => Err(format!(
                "No se pudo auditar la decisión R6.3 y el registro fue restaurado: {audit_error}"
            )),
            Err(rollback_error) => Err(format!(
                "No se pudo auditar la decisión R6.3 ({audit_error}) ni restaurar el registro ({rollback_error})"
            )),
        };
    }
    Ok(path.display().to_string())
}

pub(super) fn resolve_consolidation_candidate_at(
    data_root: &Path,
    input: ResolveConsolidationCandidateInput,
    decided_at: String,
) -> Result<ConsolidationResolutionResult, String> {
    if !input.confirmed {
        return Err("La decisión R6.3 requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.candidate_id) {
        return Err("La decisión R6.3 contiene una huella inválida".into());
    }
    if input.expected_record_ids.len() != 2
        || input
            .expected_record_ids
            .iter()
            .any(|id| id.trim().is_empty())
        || input.expected_record_ids[0] >= input.expected_record_ids[1]
    {
        return Err("La decisión R6.3 debe identificar dos registros ordenados y distintos".into());
    }
    validate_timestamp("decidedAt", &decided_at)?;
    let preview = consolidation_preview_at(data_root);
    if preview.state != ConsolidationPreviewState::Ready {
        return Err(preview
            .blocked_reason
            .unwrap_or_else(|| "La memoria canónica no está disponible".into()));
    }
    if preview.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str()) {
        return Err(
            "records.json cambió después de la vista previa; actualizá antes de decidir".into(),
        );
    }
    let candidate = preview
        .candidates
        .iter()
        .find(|candidate| candidate.candidate_id == input.candidate_id)
        .ok_or("El candidato R6.3 ya no existe en la fuente revisada")?;
    if candidate.record_ids != input.expected_record_ids {
        return Err("El par de registros no coincide con el candidato revisado".into());
    }

    let mut document = read_consolidation_decisions_at(data_root)?;
    if let Some(existing) = document.decisions.iter().find(|decision| {
        decision.source_sha256 == input.expected_source_sha256
            && decision.candidate_id == input.candidate_id
    }) {
        if existing.action != input.action || existing.record_ids != input.expected_record_ids {
            return Err("El candidato ya posee una decisión incompatible".into());
        }
        let backup_path =
            consolidation_source_backup_path(data_root, &input.expected_source_sha256);
        return Ok(ConsolidationResolutionResult {
            schema_version: CONSOLIDATION_DECISION_SCHEMA_VERSION,
            decision: existing.clone(),
            source_backup_path: backup_path.display().to_string(),
            ledger_path: consolidation_decision_path(data_root).display().to_string(),
            backup_created: false,
            records_modified: false,
            model_used: false,
            preview,
        });
    }

    let source_path = data_root.join("memory").join("records.json");
    let source_content = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo releer records.json: {error}"))?;
    if memory_subject_digest(&source_content) != input.expected_source_sha256 {
        return Err("records.json cambió durante la decisión; no se escribió nada".into());
    }
    let backup_directory = data_root.join("memory").join("backups");
    fs::create_dir_all(&backup_directory)
        .map_err(|error| format!("No se pudo crear el respaldo R6.3: {error}"))?;
    let source_backup = consolidation_source_backup_path(data_root, &input.expected_source_sha256);
    let backup_created = if source_backup.exists() {
        let existing = fs::read_to_string(&source_backup)
            .map_err(|error| format!("No se pudo verificar el respaldo R6.3: {error}"))?;
        if existing != source_content {
            return Err("El respaldo R6.3 existente no coincide con la fuente".into());
        }
        false
    } else {
        fs::write(&source_backup, source_content.as_bytes())
            .map_err(|error| format!("No se pudo respaldar records.json: {error}"))?;
        true
    };

    let decision_id = memory_subject_digest(&format!(
        "alice-consolidation-decision:{}:{}:{:?}",
        input.expected_source_sha256, input.candidate_id, input.action
    ));
    let decision = ConsolidationDecision {
        decision_id,
        candidate_id: input.candidate_id,
        source_sha256: input.expected_source_sha256,
        candidate_kind: candidate.kind,
        reason_code: candidate.reason_code,
        record_ids: input.expected_record_ids,
        action: input.action,
        decided_at,
    };
    document.decisions.push(decision.clone());
    let ledger_path = write_consolidation_decisions_at(data_root, &document)?;
    let updated_preview = consolidation_preview_at(data_root);
    if updated_preview.state != ConsolidationPreviewState::Ready
        || updated_preview.source_sha256 != Some(decision.source_sha256.clone())
        || !updated_preview.candidates.iter().any(|candidate| {
            candidate.candidate_id == decision.candidate_id
                && candidate.resolution == Some(decision.action)
                && candidate.decision_id.as_deref() == Some(decision.decision_id.as_str())
        })
    {
        return Err("La decisión R6.3 se escribió pero no pudo verificarse al releerla".into());
    }
    Ok(ConsolidationResolutionResult {
        schema_version: CONSOLIDATION_DECISION_SCHEMA_VERSION,
        decision,
        source_backup_path: source_backup.display().to_string(),
        ledger_path,
        backup_created,
        records_modified: false,
        model_used: false,
        preview: updated_preview,
    })
}

pub(super) fn consolidation_decision_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(CONSOLIDATION_DECISION_FILE)
}

pub(super) fn consolidation_transaction_path(data_root: &Path) -> PathBuf {
    data_root
        .join("memory")
        .join(CONSOLIDATION_TRANSACTION_FILE)
}

pub(super) fn consolidation_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("consolidation-source-{}.json", &source_sha256[7..]))
}

pub(super) fn empty_consolidation_decisions() -> ConsolidationDecisionDocument {
    ConsolidationDecisionDocument {
        schema_version: CONSOLIDATION_DECISION_SCHEMA_VERSION,
        decisions: Vec::new(),
    }
}

pub(super) fn read_consolidation_decisions_at(
    data_root: &Path,
) -> Result<ConsolidationDecisionDocument, String> {
    let path = consolidation_decision_path(data_root);
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(empty_consolidation_decisions())
        }
        Err(error) => {
            return Err(format!(
                "No se pudo leer el registro de decisiones R6.3: {error}"
            ))
        }
    };
    let document = serde_json::from_str::<ConsolidationDecisionDocument>(&content)
        .map_err(|error| format!("El registro de decisiones R6.3 no es válido: {error}"))?;
    validate_consolidation_decisions(&document)?;
    Ok(document)
}
