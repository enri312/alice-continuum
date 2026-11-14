use super::assessment::{
    accessibility_source_backup_path, assess_memory_accessibility_at, assess_memory_suppression_at,
    assess_memory_validity_at, suppression_source_backup_path, validity_source_backup_path,
};
use super::consolidation::consolidation_decision_path;
use super::consolidation::consolidation_source_backup_path;
use super::consolidation::consolidation_transaction_path;
use super::consolidation::{
    consolidation_preview_at, consolidation_recovery_status_at,
    prepare_interrupted_consolidation_at, preview_consolidation_merge_at,
    read_consolidation_transactions_at, recover_interrupted_consolidation_at,
    rehearse_consolidation_recovery_at, resolve_consolidation_candidate_at,
    restore_consolidation_transaction_at,
};
use super::layers::layered_memory_path;
use super::layers::{
    activate_layered_memory_at, layered_memory_status_at, read_layered_document_at,
    rollback_layered_memory_at,
};
use super::learning::{append_confirmed_conversation_learning_at, append_confirmed_learning_at};
use super::lifecycle::{
    activate_memory_lifecycle_at, memory_lifecycle_path, memory_lifecycle_preview_at,
    rollback_memory_lifecycle_at,
};
use super::model::{
    ActivateLayeredMemoryInput, ActivateMemoryLifecycleInput, AssessMemoryAccessibilityInput,
    AssessMemorySuppressionInput, AssessMemoryValidityInput, ConfirmMemoryArchiveInput,
    ConfirmMemoryDeletionInput, ConfirmMemoryDeletionScheduleInput,
    ConfirmMemoryReconsolidationInput, ConfirmedConversationLearningAppendInput,
    ConfirmedLearningAppendInput, ConsolidationCandidateKind, ConsolidationMergeBackupStatus,
    ConsolidationMergeDifferenceField, ConsolidationMergeLayerImpact, ConsolidationPreviewState,
    ConsolidationRecoveryStatusState, ConsolidationResolutionAction, ConsolidationSourceRelation,
    ConsolidationTransactionState, LayeredMemoryState, MemoryAccessibilityAssessmentAction,
    MemoryAccessibilityState, MemoryArchiveAction, MemoryArchiveReason, MemoryCapabilityProbe,
    MemoryDeletionReason, MemoryDeletionScheduleAction, MemoryDeletionTombstone,
    MemoryLifecyclePreviewState, MemoryReconsolidationField, MemoryReconsolidationReason,
    MemoryReconsolidationRevision, MemoryResourceState, MemoryRetentionState,
    MemoryRetrievalPolicy, MemorySession, MemorySuppressionAction, MemorySuppressionReason,
    MemoryValidityAssessmentAction, MemoryValidityState, MemoryWeakeningAssessmentState,
    PreviewConsolidationMergeInput, PreviewMemoryArchiveInput, PreviewMemoryDeletionInput,
    PreviewMemoryDeletionScheduleInput, PreviewMemoryReconsolidationInput,
    ResolveConsolidationCandidateInput, RestoreConsolidationTransactionInput,
    RollbackLayeredMemoryInput, RollbackMemoryLifecycleInput,
};
use super::queries::{collect_markdown_notes, memory_capability_probe};
use super::reconsolidation::{
    confirm_memory_reconsolidation_at, prepare_memory_reconsolidation_at,
    reconsolidation_revision_path, reconsolidation_source_backup_path,
};
use super::retention::{
    confirm_memory_archive_at, confirm_memory_deletion_at, confirm_memory_deletion_schedule_at,
    prepare_memory_archive_at, prepare_memory_deletion_at, prepare_memory_deletion_schedule_at,
};
use super::storage::{memory_subject_digest, read_validated_source_at};
use super::validation::{is_sha256, validate_generic_memory_update, validate_memory_sessions};
use super::{audited_memory_operation_with, CONSOLIDATION_TRANSACTION_FILE};
use crate::audit::new_operation_id;
use crate::audit::AuditOutcome;
use crate::audit::AuditSource;
use crate::audit::AuditStage;
use sha2::Digest;
use sha2::Sha256;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

use crate::audit::{append_event_at, AuditEvent, AUDIT_MAX_BYTES};
use std::collections::BTreeMap;

fn temporary_probe_root(label: &str) -> PathBuf {
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "alice-memory-probe-{label}-{}-{unique}",
        std::process::id()
    ))
}

#[test]
fn markdown_catalog_lists_only_notes_and_preserves_source_bytes() {
    let root = temporary_probe_root("markdown-catalog");
    fs::create_dir_all(root.join("nested")).expect("create nested vault path");
    fs::create_dir_all(root.join(".obsidian")).expect("create config path");
    fs::write(root.join("zeta.md"), "# Zeta").expect("write note");
    fs::write(root.join("nested").join("alpha.md"), "# Alpha").expect("write nested note");
    fs::write(root.join(".obsidian").join("ignored.md"), "internal").expect("write internal file");
    fs::write(root.join("ignore.txt"), "not a note").expect("write non note");
    let before = file_hashes(&root);
    let mut notes = Vec::new();

    collect_markdown_notes(&root, &root, &mut notes).expect("catalog notes");
    notes.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    assert_eq!(notes.len(), 2);
    assert_eq!(notes[0].relative_path, "nested/alpha.md");
    assert_eq!(notes[1].relative_path, "zeta.md");
    assert!(notes.iter().all(|note| note.sha256.starts_with("sha256:")));
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove controlled vault fixture");
}

fn legacy_memory() -> MemorySession {
    serde_json::from_value(serde_json::json!({
        "id": "legacy-1",
        "kind": "Conversación",
        "intention": "Recuerdo anterior",
        "startedAt": "2026-08-06T00:00:00Z"
    }))
    .expect("deserialize legacy memory")
}

#[test]
fn memory_session_round_trip_preserves_camel_case_contract() {
    let session = MemorySession {
        affects: Vec::new(),
        id: "s1".into(),
        kind: "Proyecto".into(),
        intention: "Probar memoria".into(),
        started_at: "2026-08-06T00:00:00Z".into(),
        finished_at: None,
        summary: None,
        next_step: Some("Continuar".into()),
        memory_type: None,
        source: None,
        importance: None,
        storage_strength: None,
        memory_status: None,
        accessibility_status: None,
        accessibility_updated_at: None,
        suppression_status: None,
        suppression_reason: None,
        suppression_updated_at: None,
        archive_status: None,
        archive_reason: None,
        archive_updated_at: None,
        deletion_status: None,
        deletion_reason: None,
        deletion_requested_at: None,
        deletion_eligible_at: None,
        memory_version: None,
        reconsolidated_at: None,
        reconsolidation_reason: None,
        previous_version_sha256: None,
        successful_recalls: 0,
        failed_recalls: 0,
        last_recalled_at: None,
        retrieval_evidence_version: None,
        successful_reviews: 0,
        correction_count: 0,
        last_reviewed_at: None,
        context_events: vec![],
    };
    let json = serde_json::to_string(&session).expect("serialize session");
    assert!(json.contains("startedAt"));
    assert!(json.contains("nextStep"));
    assert!(json.contains("storageStrength"));
    let decoded: MemorySession = serde_json::from_str(&json).expect("deserialize session");
    assert_eq!(decoded.intention, "Probar memoria");
}

#[test]
fn legacy_memory_without_learning_fields_remains_compatible() {
    let decoded = legacy_memory();
    assert_eq!(decoded.storage_strength, None);
    assert_eq!(decoded.accessibility_status, None);
    assert_eq!(decoded.accessibility_updated_at, None);
    assert_eq!(decoded.suppression_status, None);
    assert_eq!(decoded.archive_status, None);
    assert_eq!(decoded.successful_recalls, 0);
    assert_eq!(decoded.failed_recalls, 0);
    assert_eq!(decoded.retrieval_evidence_version, None);
    assert_eq!(decoded.successful_reviews, 0);
    assert_eq!(decoded.correction_count, 0);
    assert_eq!(decoded.last_reviewed_at, None);
}

#[test]
fn memory_validation_accepts_legacy_and_rejects_corrupt_records() {
    let legacy = legacy_memory();
    assert!(validate_memory_sessions(std::slice::from_ref(&legacy)).is_ok());

    let mut invalid_importance = legacy.clone();
    invalid_importance.importance = Some(8);
    assert!(validate_memory_sessions(&[invalid_importance]).is_err());

    let mut invalid_strength = legacy.clone();
    invalid_strength.storage_strength = Some(1.5);
    assert!(validate_memory_sessions(&[invalid_strength]).is_err());

    let duplicate = vec![legacy.clone(), legacy];
    assert!(validate_memory_sessions(&duplicate).is_err());

    let mut reviewed_after_retrieval: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "retrieval-reviewed",
        "kind": "Enseñanza",
        "intention": "Evidencia preservada tras una corrección",
        "startedAt": "2026-08-22T10:00:00Z",
        "memoryStatus": "conflict",
        "successfulRecalls": 1,
        "failedRecalls": 2,
        "lastRecalledAt": "2026-08-22T10:05:00Z",
        "retrievalEvidenceVersion": 1
    }))
    .expect("retrieval evidence after review");
    assert!(validate_memory_sessions(std::slice::from_ref(&reviewed_after_retrieval)).is_ok());
    reviewed_after_retrieval.retrieval_evidence_version = Some(2);
    assert!(validate_memory_sessions(&[reviewed_after_retrieval]).is_err());
}

fn write_layered_fixture(root: &Path, sessions: &[MemorySession]) -> String {
    let memory = root.join("memory");
    fs::create_dir_all(&memory).expect("create layered memory fixture");
    let content = serde_json::to_string_pretty(sessions).expect("serialize layered fixture");
    fs::write(memory.join("records.json"), &content).expect("write layered records");
    content
}

fn file_hashes(root: &Path) -> BTreeMap<PathBuf, String> {
    fn visit(root: &Path, directory: &Path, hashes: &mut BTreeMap<PathBuf, String>) {
        for entry in fs::read_dir(directory).expect("read fixture directory") {
            let entry = entry.expect("read fixture entry");
            let path = entry.path();
            if path.is_dir() {
                visit(root, &path, hashes);
            } else {
                let content = fs::read(&path).expect("read fixture file");
                hashes.insert(
                    path.strip_prefix(root)
                        .expect("relative fixture path")
                        .into(),
                    crate::util::encode_hex_lower(Sha256::digest(content)),
                );
            }
        }
    }
    let mut hashes = BTreeMap::new();
    if root.is_dir() {
        visit(root, root, &mut hashes);
    }
    hashes
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_r6_preview_is_read_only() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let before = file_hashes(&root);
    let snapshot = layered_memory_status_at(&root);
    let after = file_hashes(&root);

    assert_eq!(after, before);
    assert_ne!(snapshot.state, LayeredMemoryState::Blocked);
    let preview = snapshot.preview.expect("canonical R6 preview");
    assert_eq!(preview.working_count, 0);
    assert!(!preview.content_copied);
    assert!(!preview.automatic_classification);
    assert_eq!(
        preview.episodic_count
            + preview.taught_fact_count
            + preview.procedural_count
            + preview.unclassified_count,
        preview.record_count
    );
    eprintln!(
        "R6_CANONICAL records={} working={} episodic={} taughtFacts={} procedural={} proceduralPendingR5={} unclassified={} filesIntact={}",
        preview.record_count,
        preview.working_count,
        preview.episodic_count,
        preview.taught_fact_count,
        preview.procedural_count,
        preview.procedural_pending_count,
        preview.unclassified_count,
        before.len()
    );
}

#[test]
fn lifecycle_preview_does_not_create_storage_when_memory_is_missing() {
    let root = temporary_probe_root("lifecycle-missing");
    let snapshot = memory_lifecycle_preview_at(&root);

    assert_eq!(snapshot.state, MemoryLifecyclePreviewState::Unavailable);
    assert!(snapshot.preview.is_none());
    assert!(!snapshot.lifecycle_writes_available);
    assert!(!root.exists());
}

#[test]
fn lifecycle_preview_maps_only_explicit_states_and_preserves_real_files() {
    let root = temporary_probe_root("lifecycle-preview");
    let mut current = legacy_memory();
    current.id = "current".into();
    current.memory_status = Some("confirmed".into());
    let mut conflict = legacy_memory();
    conflict.id = "conflict".into();
    conflict.memory_status = Some("conflict".into());
    let mut archived = legacy_memory();
    archived.id = "archived".into();
    archived.memory_status = Some("archived".into());
    let mut historical = legacy_memory();
    historical.id = "historical".into();
    write_layered_fixture(&root, &[current, conflict, archived, historical]);
    let before = file_hashes(&root);

    let snapshot = memory_lifecycle_preview_at(&root);

    assert_eq!(file_hashes(&root), before);
    assert_eq!(snapshot.state, MemoryLifecyclePreviewState::Ready);
    assert!(snapshot.lifecycle_writes_available);
    assert!(!snapshot.records_modified);
    let preview = snapshot.preview.expect("lifecycle preview");
    assert_eq!(preview.record_count, 4);
    assert_eq!(preview.current_count, 1);
    assert_eq!(preview.conflict_count, 1);
    assert_eq!(preview.archived_count, 1);
    assert_eq!(preview.not_assessed_count, 1);
    assert_eq!(preview.retrieval_eligible_count, 2);
    assert_eq!(preview.retrieval_blocked_count, 2);
    assert_eq!(preview.retrieval_outcome_count, 0);
    assert_eq!(preview.functional_assessment_count, 0);
    assert_eq!(preview.weakening_review_required_count, 0);
    assert_eq!(preview.weakening_assessments.len(), 4);
    assert!(preview
        .weakening_assessments
        .iter()
        .all(
            |assessment| assessment.state == MemoryWeakeningAssessmentState::NotAssessed
                && !assessment.automatic_action
        ));
    assert_eq!(
        preview.retention_assessed_count,
        preview
            .references
            .iter()
            .filter(|reference| reference.retention == MemoryRetentionState::DeletionScheduled)
            .count()
    );
    assert_eq!(
        preview.suppressed_count,
        preview
            .references
            .iter()
            .filter(|reference| reference.suppressed)
            .count()
    );
    assert_eq!(preview.reconsolidated_count, 0);
    assert!(!preview.records_modified);
    assert!(!preview.content_copied);
    assert!(!preview.automatic_inference);
    assert!(preview.references.iter().all(|reference| {
        is_sha256(&reference.record_sha256)
            && reference.base_version == 1
            && reference.retention == MemoryRetentionState::NotAssessed
            && !reference.suppressed
            && reference.reconsolidation_count == 0
    }));
    fs::remove_dir_all(root).expect("remove lifecycle fixture");
}

#[test]
fn lifecycle_preview_evaluates_only_explicit_retrieval_outcomes_without_writing() {
    let root = temporary_probe_root("lifecycle-functional-weakening");
    let review_required: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "review-required",
        "kind": "Enseñanza",
        "intention": "Dato recuperado con resultados insuficientes",
        "startedAt": "2026-08-22T10:00:00Z",
        "memoryStatus": "confirmed",
        "successfulRecalls": 1,
        "failedRecalls": 2,
        "lastRecalledAt": "2026-08-22T10:05:00Z",
        "retrievalEvidenceVersion": 1
    }))
    .expect("explicit retrieval evidence");
    let insufficient: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "insufficient",
        "kind": "Enseñanza",
        "intention": "Dato con dos resultados útiles",
        "startedAt": "2026-08-22T10:00:00Z",
        "memoryStatus": "confirmed",
        "successfulRecalls": 2,
        "failedRecalls": 0,
        "lastRecalledAt": "2026-08-22T10:06:00Z",
        "retrievalEvidenceVersion": 1
    }))
    .expect("insufficient retrieval evidence");
    let mut legacy_counter = legacy_memory();
    legacy_counter.id = "legacy-counter".into();
    legacy_counter.successful_recalls = 9;
    write_layered_fixture(&root, &[review_required, insufficient, legacy_counter]);
    let before = file_hashes(&root);

    let preview = memory_lifecycle_preview_at(&root)
        .preview
        .expect("functional preview");

    assert_eq!(file_hashes(&root), before);
    assert_eq!(preview.retrieval_outcome_count, 5);
    assert_eq!(preview.functional_assessment_count, 1);
    assert_eq!(preview.weakening_review_required_count, 1);
    assert_eq!(preview.dormant_count, 0);
    assert!(preview
        .weakening_assessments
        .iter()
        .all(|assessment| !assessment.automatic_action));
    assert_eq!(
        preview
            .weakening_assessments
            .iter()
            .find(|assessment| assessment.record_id == "review-required")
            .expect("review signal")
            .state,
        MemoryWeakeningAssessmentState::ReviewRequired
    );
    assert_eq!(
        preview
            .weakening_assessments
            .iter()
            .find(|assessment| assessment.record_id == "insufficient")
            .expect("insufficient signal")
            .state,
        MemoryWeakeningAssessmentState::InsufficientEvidence
    );
    assert_eq!(
        preview
            .weakening_assessments
            .iter()
            .find(|assessment| assessment.record_id == "legacy-counter")
            .expect("legacy counter")
            .state,
        MemoryWeakeningAssessmentState::NotAssessed
    );
    fs::remove_dir_all(root).expect("remove functional weakening fixture");
}

#[test]
fn lifecycle_preview_blocks_corrupt_memory_without_repairing_it() {
    let root = temporary_probe_root("lifecycle-corrupt");
    let memory = root.join("memory");
    fs::create_dir_all(&memory).expect("create lifecycle corrupt fixture");
    fs::write(memory.join("records.json"), "{corrupt").expect("write corrupt source");
    let before = file_hashes(&root);

    let snapshot = memory_lifecycle_preview_at(&root);

    assert_eq!(snapshot.state, MemoryLifecyclePreviewState::Blocked);
    assert!(snapshot.blocked_reason.is_some());
    assert!(snapshot.preview.is_none());
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove lifecycle corrupt fixture");
}

#[test]
fn lifecycle_activation_source_change_and_rollback_preserve_records() {
    let root = temporary_probe_root("lifecycle-durable");
    let first_content = write_layered_fixture(&root, &[legacy_memory()]);
    let first_source_sha256 = memory_subject_digest(&first_content);

    let active = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: first_source_sha256,
            confirmed: true,
        },
        "2026-08-22T10:00:00Z".into(),
    )
    .expect("activate first lifecycle revision");
    assert_eq!(active.state, MemoryLifecyclePreviewState::Active);
    assert_eq!(active.revision_count, 1);
    assert!(!active.records_modified);
    let first_revision_id = active.active_revision_id.expect("active revision");
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read preserved records"),
        first_content
    );

    let idempotent = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: active.source_sha256.expect("active source"),
            confirmed: true,
        },
        "2026-08-22T10:01:00Z".into(),
    )
    .expect("idempotent lifecycle activation");
    assert_eq!(idempotent.revision_count, 1);
    assert_eq!(
        idempotent.active_revision_id.as_deref(),
        Some(first_revision_id.as_str())
    );

    let mut second = legacy_memory();
    second.id = "second".into();
    second.memory_status = Some("confirmed".into());
    let second_content = write_layered_fixture(&root, &[legacy_memory(), second]);
    let changed = memory_lifecycle_preview_at(&root);
    assert_eq!(changed.state, MemoryLifecyclePreviewState::SourceChanged);
    let second_source_sha256 = memory_subject_digest(&second_content);
    let second_active = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: second_source_sha256,
            confirmed: true,
        },
        "2026-08-22T10:02:00Z".into(),
    )
    .expect("activate changed source revision");
    assert_eq!(second_active.state, MemoryLifecyclePreviewState::Active);
    assert_eq!(second_active.revision_count, 2);
    let second_revision_id = second_active.active_revision_id.expect("second revision");
    assert_ne!(second_revision_id, first_revision_id);
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).expect("read second records"),
        second_content
    );
    assert!(root
        .join("memory")
        .join("backups")
        .read_dir()
        .expect("read lifecycle backups")
        .any(|entry| entry
            .expect("backup entry")
            .file_name()
            .to_string_lossy()
            .starts_with("lifecycle-index-v1-")));

    let rolled_back = rollback_memory_lifecycle_at(
        &root,
        RollbackMemoryLifecycleInput {
            expected_revision_id: second_revision_id,
            confirmed: true,
        },
    )
    .expect("rollback lifecycle revision");
    assert_eq!(rolled_back.state, MemoryLifecyclePreviewState::RolledBack);
    assert!(rolled_back.active_revision_id.is_none());
    assert_eq!(rolled_back.revision_count, 2);
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read records after rollback"),
        second_content
    );
    fs::remove_dir_all(root).expect("remove durable lifecycle fixture");
}

#[test]
fn lifecycle_activation_rejects_stale_or_unconfirmed_source_without_index() {
    let root = temporary_probe_root("lifecycle-stale");
    let content = write_layered_fixture(&root, &[legacy_memory()]);
    let source_sha256 = memory_subject_digest(&content);
    let unconfirmed = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: source_sha256,
            confirmed: false,
        },
        "2026-08-22T10:00:00Z".into(),
    );
    assert!(unconfirmed.is_err());
    let stale = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: format!("sha256:{}", "a".repeat(64)),
            confirmed: true,
        },
        "2026-08-22T10:00:00Z".into(),
    );
    assert!(stale.is_err());
    assert!(!memory_lifecycle_path(&root).exists());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read unchanged records"),
        content
    );
    fs::remove_dir_all(root).expect("remove stale lifecycle fixture");
}

#[test]
fn lifecycle_audit_failure_restores_absent_index_and_preserves_records() {
    let root = temporary_probe_root("lifecycle-audit-failure");
    let content = write_layered_fixture(&root, &[legacy_memory()]);
    fs::write(root.join("memory").join("audit"), "blocked").expect("create audit obstruction");
    let result = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: memory_subject_digest(&content),
            confirmed: true,
        },
        "2026-08-22T10:00:00Z".into(),
    );

    assert!(result.is_err());
    assert!(!memory_lifecycle_path(&root).exists());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read records after audit failure"),
        content
    );
    fs::remove_dir_all(root).expect("remove lifecycle audit failure fixture");
}

#[test]
fn validity_confirmation_declares_missing_source_and_preserves_exact_backup() {
    let root = temporary_probe_root("validity-confirm");
    let mut memory = legacy_memory();
    memory.finished_at = Some("2026-08-20T12:00:00Z".into());
    memory.summary = Some("Contenido confirmado por el propietario".into());
    memory.storage_strength = Some(0.42);
    let source_content = write_layered_fixture(&root, &[memory.clone()]);
    let source_sha256 = memory_subject_digest(&source_content);
    let preview = memory_lifecycle_preview_at(&root);
    let reference = preview
        .preview
        .expect("validity preview")
        .references
        .into_iter()
        .next()
        .expect("validity reference");
    let active = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: source_sha256.clone(),
            confirmed: true,
        },
        "2026-08-22T09:00:00Z".into(),
    )
    .expect("activate lifecycle before assessment");
    let lifecycle_document_before =
        fs::read_to_string(memory_lifecycle_path(&root)).expect("read lifecycle before assessment");

    let result = assess_memory_validity_at(
        &root,
        AssessMemoryValidityInput {
            expected_source_sha256: source_sha256.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryValidityAssessmentAction::ConfirmCurrent,
            declared_source: Some("Fixture local controlado".into()),
            confirmed: true,
        },
        "2026-08-22T10:00:00Z".into(),
    )
    .expect("confirm current validity");

    assert_eq!(result.previous_validity, MemoryValidityState::NotAssessed);
    assert_eq!(result.new_validity, MemoryValidityState::Current);
    assert_eq!(result.source_sha256_before, source_sha256);
    assert_eq!(result.backup_sha256, result.source_sha256_before);
    assert_ne!(result.source_sha256_after, result.source_sha256_before);
    assert!(result.records_modified);
    assert!(result.audit_written);
    assert_eq!(
        result.lifecycle.state,
        MemoryLifecyclePreviewState::SourceChanged
    );
    assert_eq!(
        result.lifecycle.active_revision_id,
        active.active_revision_id
    );
    assert_eq!(
        fs::read_to_string(memory_lifecycle_path(&root)).expect("read unchanged lifecycle"),
        lifecycle_document_before
    );
    assert_eq!(
        fs::read_to_string(validity_source_backup_path(
            &root,
            &result.source_sha256_before
        ))
        .expect("read exact source backup"),
        source_content
    );
    let (_, stored) = read_validated_source_at(&root)
        .expect("read assessed source")
        .expect("stored source");
    let stored = &stored[0];
    assert_eq!(stored.memory_status.as_deref(), Some("confirmed"));
    assert_eq!(stored.successful_reviews, memory.successful_reviews + 1);
    assert_eq!(stored.correction_count, memory.correction_count);
    assert_eq!(
        stored.last_reviewed_at.as_deref(),
        Some("2026-08-22T10:00:00Z")
    );
    assert_eq!(stored.storage_strength, memory.storage_strength);
    assert_eq!(stored.summary, memory.summary);
    assert_eq!(stored.intention, memory.intention);
    assert_eq!(stored.source.as_deref(), Some("Fixture local controlado"));
    let assessed_reference = result
        .lifecycle
        .preview
        .as_ref()
        .expect("post-assessment preview")
        .references
        .iter()
        .find(|item| item.record_id == memory.id)
        .expect("post-assessment reference");
    let after_first_assessment = file_hashes(&root);
    let repeated = assess_memory_validity_at(
        &root,
        AssessMemoryValidityInput {
            expected_source_sha256: result.source_sha256_after,
            record_id: memory.id,
            expected_record_sha256: assessed_reference.record_sha256.clone(),
            action: MemoryValidityAssessmentAction::MarkConflict,
            declared_source: None,
            confirmed: true,
        },
        "2026-08-22T10:01:00Z".into(),
    );
    assert!(repeated.is_err());
    assert_eq!(file_hashes(&root), after_first_assessment);
    fs::remove_dir_all(root).expect("remove validity confirmation fixture");
}

#[test]
fn validity_conflict_records_correction_without_changing_strength() {
    let root = temporary_probe_root("validity-conflict");
    let mut memory = legacy_memory();
    memory.storage_strength = Some(0.81);
    memory.correction_count = 2;
    let source_content = write_layered_fixture(&root, &[memory.clone()]);
    let preview = memory_lifecycle_preview_at(&root);
    let reference = preview
        .preview
        .expect("validity preview")
        .references
        .into_iter()
        .next()
        .expect("validity reference");

    let result = assess_memory_validity_at(
        &root,
        AssessMemoryValidityInput {
            expected_source_sha256: memory_subject_digest(&source_content),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryValidityAssessmentAction::MarkConflict,
            declared_source: Some("Fixture local controlado".into()),
            confirmed: true,
        },
        "2026-08-22T10:10:00Z".into(),
    )
    .expect("mark validity conflict");

    assert_eq!(result.new_validity, MemoryValidityState::Conflict);
    assert_eq!(result.lifecycle.state, MemoryLifecyclePreviewState::Ready);
    let (_, stored) = read_validated_source_at(&root)
        .expect("read conflict source")
        .expect("stored conflict source");
    assert_eq!(stored[0].memory_status.as_deref(), Some("conflict"));
    assert_eq!(stored[0].correction_count, 3);
    assert_eq!(stored[0].successful_reviews, memory.successful_reviews);
    assert_eq!(stored[0].storage_strength, memory.storage_strength);
    fs::remove_dir_all(root).expect("remove validity conflict fixture");
}

#[test]
fn validity_assessment_rejects_unconfirmed_stale_and_changed_record_without_writing() {
    let root = temporary_probe_root("validity-rejections");
    let memory = legacy_memory();
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha256 = memory_subject_digest(&source_content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("validity preview")
        .references
        .remove(0);
    let before = file_hashes(&root);
    let base_input = AssessMemoryValidityInput {
        expected_source_sha256: source_sha256,
        record_id: memory.id,
        expected_record_sha256: reference.record_sha256,
        action: MemoryValidityAssessmentAction::ConfirmCurrent,
        declared_source: Some("Fixture local controlado".into()),
        confirmed: true,
    };

    let mut unconfirmed = base_input.clone();
    unconfirmed.confirmed = false;
    assert!(assess_memory_validity_at(&root, unconfirmed, "2026-08-22T10:20:00Z".into()).is_err());
    let mut missing_source = base_input.clone();
    missing_source.declared_source = None;
    assert!(
        assess_memory_validity_at(&root, missing_source, "2026-08-22T10:20:00Z".into()).is_err()
    );
    let mut stale_source = base_input.clone();
    stale_source.expected_source_sha256 = format!("sha256:{}", "a".repeat(64));
    assert!(assess_memory_validity_at(&root, stale_source, "2026-08-22T10:20:00Z".into()).is_err());
    let mut stale_record = base_input;
    stale_record.expected_record_sha256 = format!("sha256:{}", "b".repeat(64));
    assert!(assess_memory_validity_at(&root, stale_record, "2026-08-22T10:20:00Z".into()).is_err());
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove validity rejection fixture");
}

#[test]
fn validity_assessment_cannot_replace_existing_provenance() {
    let root = temporary_probe_root("validity-provenance-preserved");
    let mut memory = legacy_memory();
    memory.source = Some("Procedencia original confirmada".into());
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("validity preview")
        .references
        .remove(0);
    let before = file_hashes(&root);

    let result = assess_memory_validity_at(
        &root,
        AssessMemoryValidityInput {
            expected_source_sha256: memory_subject_digest(&source_content),
            record_id: memory.id,
            expected_record_sha256: reference.record_sha256,
            action: MemoryValidityAssessmentAction::ConfirmCurrent,
            declared_source: Some("Procedencia sustituta".into()),
            confirmed: true,
        },
        "2026-08-22T10:25:00Z".into(),
    );

    assert!(result.is_err());
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove provenance preservation fixture");
}

#[test]
fn validity_audit_failure_restores_records_byte_for_byte() {
    let root = temporary_probe_root("validity-audit-failure");
    let memory = legacy_memory();
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha256 = memory_subject_digest(&source_content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("validity preview")
        .references
        .remove(0);
    fs::write(root.join("memory").join("audit"), "blocked").expect("create audit obstruction");

    let result = assess_memory_validity_at(
        &root,
        AssessMemoryValidityInput {
            expected_source_sha256: source_sha256.clone(),
            record_id: memory.id,
            expected_record_sha256: reference.record_sha256,
            action: MemoryValidityAssessmentAction::ConfirmCurrent,
            declared_source: Some("Fixture local controlado".into()),
            confirmed: true,
        },
        "2026-08-22T10:30:00Z".into(),
    );

    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).expect("read restored source"),
        source_content
    );
    assert_eq!(
        fs::read_to_string(validity_source_backup_path(&root, &source_sha256))
            .expect("read preserved backup"),
        source_content
    );
    fs::remove_dir_all(root).expect("remove validity audit failure fixture");
}

#[test]
fn accessibility_dormancy_and_reactivation_are_real_reversible_and_strength_independent() {
    let root = temporary_probe_root("accessibility-cycle");
    let mut memory = legacy_memory();
    memory.memory_status = Some("confirmed".into());
    memory.storage_strength = Some(0.73);
    memory.summary = Some("Contenido que no debe cambiar".into());
    let original_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let original_sha = memory_subject_digest(&original_content);
    let initial = memory_lifecycle_preview_at(&root);
    let initial_reference = initial
        .preview
        .expect("initial accessibility preview")
        .references
        .remove(0);
    let active = activate_memory_lifecycle_at(
        &root,
        ActivateMemoryLifecycleInput {
            expected_source_sha256: original_sha.clone(),
            confirmed: true,
        },
        "2026-08-22T11:00:00Z".into(),
    )
    .expect("activate lifecycle before dormancy");

    let dormant = assess_memory_accessibility_at(
        &root,
        AssessMemoryAccessibilityInput {
            expected_source_sha256: original_sha.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: initial_reference.record_sha256,
            action: MemoryAccessibilityAssessmentAction::SetDormant,
            confirmed: true,
        },
        "2026-08-22T11:01:00Z".into(),
    )
    .expect("set memory dormant");

    assert_eq!(
        dormant.previous_accessibility,
        MemoryAccessibilityState::NotAssessed
    );
    assert_eq!(dormant.new_accessibility, MemoryAccessibilityState::Dormant);
    assert_eq!(dormant.backup_sha256, original_sha);
    assert_eq!(
        dormant.lifecycle.state,
        MemoryLifecyclePreviewState::SourceChanged
    );
    assert_eq!(
        dormant.lifecycle.active_revision_id,
        active.active_revision_id
    );
    let dormant_preview = dormant.lifecycle.preview.as_ref().expect("dormant preview");
    assert_eq!(dormant_preview.dormant_count, 1);
    assert_eq!(dormant_preview.accessible_count, 0);
    assert_eq!(dormant_preview.accessibility_assessed_count, 1);
    assert_eq!(dormant_preview.retrieval_blocked_count, 1);
    assert_eq!(
        dormant_preview.references[0].retrieval_policy,
        MemoryRetrievalPolicy::BlockedByDormancy
    );
    assert_eq!(
        fs::read_to_string(accessibility_source_backup_path(&root, &original_sha))
            .expect("read dormancy backup"),
        original_content
    );
    let (_, stored_dormant) = read_validated_source_at(&root)
        .expect("read dormant source")
        .expect("dormant source");
    assert_eq!(
        stored_dormant[0].accessibility_status.as_deref(),
        Some("dormant")
    );
    assert_eq!(stored_dormant[0].storage_strength, memory.storage_strength);
    assert_eq!(stored_dormant[0].summary, memory.summary);
    assert_eq!(
        stored_dormant[0].successful_recalls,
        memory.successful_recalls
    );

    let dormant_reference = dormant_preview.references[0].clone();
    let accessible = assess_memory_accessibility_at(
        &root,
        AssessMemoryAccessibilityInput {
            expected_source_sha256: dormant.source_sha256_after,
            record_id: memory.id,
            expected_record_sha256: dormant_reference.record_sha256,
            action: MemoryAccessibilityAssessmentAction::MakeAccessible,
            confirmed: true,
        },
        "2026-08-22T11:02:00Z".into(),
    )
    .expect("make memory accessible again");
    assert_eq!(
        accessible.previous_accessibility,
        MemoryAccessibilityState::Dormant
    );
    assert_eq!(
        accessible.new_accessibility,
        MemoryAccessibilityState::Accessible
    );
    let accessible_preview = accessible.lifecycle.preview.expect("accessible preview");
    assert_eq!(accessible_preview.accessible_count, 1);
    assert_eq!(accessible_preview.dormant_count, 0);
    assert_eq!(accessible_preview.retrieval_eligible_count, 1);
    assert_eq!(
        accessible_preview.references[0].retrieval_policy,
        MemoryRetrievalPolicy::Eligible
    );
    let (_, stored_accessible) = read_validated_source_at(&root)
        .expect("read accessible source")
        .expect("accessible source");
    assert_eq!(
        stored_accessible[0].accessibility_status.as_deref(),
        Some("accessible")
    );
    assert_eq!(
        stored_accessible[0].storage_strength,
        memory.storage_strength
    );
    assert_eq!(stored_accessible[0].summary, memory.summary);
    fs::remove_dir_all(root).expect("remove accessibility cycle fixture");
}

#[test]
fn accessibility_rejects_noncurrent_stale_unconfirmed_and_repeated_without_writes() {
    let root = temporary_probe_root("accessibility-rejections");
    let memory = legacy_memory();
    let content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha = memory_subject_digest(&content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("accessibility rejection preview")
        .references
        .remove(0);
    let before = file_hashes(&root);
    let noncurrent = AssessMemoryAccessibilityInput {
        expected_source_sha256: source_sha,
        record_id: memory.id,
        expected_record_sha256: reference.record_sha256,
        action: MemoryAccessibilityAssessmentAction::SetDormant,
        confirmed: true,
    };
    assert!(
        assess_memory_accessibility_at(&root, noncurrent, "2026-08-22T11:10:00Z".into()).is_err()
    );
    assert_eq!(file_hashes(&root), before);

    let mut current = legacy_memory();
    current.memory_status = Some("confirmed".into());
    current.accessibility_status = Some("accessible".into());
    current.accessibility_updated_at = Some("2026-08-22T11:09:00Z".into());
    let current_content = write_layered_fixture(&root, std::slice::from_ref(&current));
    let current_sha = memory_subject_digest(&current_content);
    let current_reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("current accessibility preview")
        .references
        .remove(0);
    let before_rejections = file_hashes(&root);
    let base = AssessMemoryAccessibilityInput {
        expected_source_sha256: current_sha,
        record_id: current.id,
        expected_record_sha256: current_reference.record_sha256,
        action: MemoryAccessibilityAssessmentAction::MakeAccessible,
        confirmed: true,
    };
    assert!(
        assess_memory_accessibility_at(&root, base.clone(), "2026-08-22T11:10:00Z".into()).is_err()
    );
    let mut unconfirmed = base.clone();
    unconfirmed.confirmed = false;
    assert!(
        assess_memory_accessibility_at(&root, unconfirmed, "2026-08-22T11:10:00Z".into()).is_err()
    );
    let mut stale = base;
    stale.expected_record_sha256 = format!("sha256:{}", "c".repeat(64));
    assert!(assess_memory_accessibility_at(&root, stale, "2026-08-22T11:10:00Z".into()).is_err());
    assert_eq!(file_hashes(&root), before_rejections);
    fs::remove_dir_all(root).expect("remove accessibility rejection fixture");
}

#[test]
fn accessibility_audit_failure_restores_records_byte_for_byte() {
    let root = temporary_probe_root("accessibility-audit-failure");
    let mut memory = legacy_memory();
    memory.memory_status = Some("confirmed".into());
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha = memory_subject_digest(&source_content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("accessibility audit preview")
        .references
        .remove(0);
    fs::write(root.join("memory").join("audit"), "blocked")
        .expect("create accessibility audit obstruction");

    let result = assess_memory_accessibility_at(
        &root,
        AssessMemoryAccessibilityInput {
            expected_source_sha256: source_sha.clone(),
            record_id: memory.id,
            expected_record_sha256: reference.record_sha256,
            action: MemoryAccessibilityAssessmentAction::SetDormant,
            confirmed: true,
        },
        "2026-08-22T11:20:00Z".into(),
    );

    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read restored accessibility source"),
        source_content
    );
    assert_eq!(
        fs::read_to_string(accessibility_source_backup_path(&root, &source_sha))
            .expect("read accessibility backup"),
        source_content
    );
    fs::remove_dir_all(root).expect("remove accessibility audit fixture");
}

#[test]
fn suppression_and_release_are_real_reversible_and_independent_from_accessibility() {
    let root = temporary_probe_root("suppression-cycle");
    let mut memory = legacy_memory();
    memory.id = "suppression-memory".into();
    memory.kind = "Enseñanza".into();
    memory.memory_status = Some("confirmed".into());
    memory.accessibility_status = Some("accessible".into());
    memory.accessibility_updated_at = Some("2026-08-22T12:00:00Z".into());
    memory.storage_strength = Some(0.64);
    memory.summary = Some("Contenido privado que debe conservarse".into());
    let original_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let original_sha = memory_subject_digest(&original_content);
    let initial_reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("initial suppression preview")
        .references
        .remove(0);

    let suppressed = assess_memory_suppression_at(
        &root,
        AssessMemorySuppressionInput {
            expected_source_sha256: original_sha.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: initial_reference.record_sha256,
            action: MemorySuppressionAction::Suppress,
            reason: MemorySuppressionReason::SensitiveContext,
            confirmed: true,
        },
        "2026-08-22T12:01:00Z".into(),
    )
    .expect("suppress current memory");

    assert!(!suppressed.previous_suppressed);
    assert!(suppressed.new_suppressed);
    assert_eq!(suppressed.backup_sha256, original_sha);
    let suppressed_preview = suppressed
        .lifecycle
        .preview
        .as_ref()
        .expect("suppressed preview");
    assert_eq!(suppressed_preview.suppressed_count, 1);
    assert_eq!(suppressed_preview.accessible_count, 1);
    assert_eq!(suppressed_preview.retrieval_blocked_count, 1);
    assert_eq!(
        suppressed_preview.references[0].retrieval_policy,
        MemoryRetrievalPolicy::BlockedBySuppression
    );
    assert_eq!(
        fs::read_to_string(suppression_source_backup_path(&root, &original_sha))
            .expect("read suppression backup"),
        original_content
    );
    let (_, stored_suppressed) = read_validated_source_at(&root)
        .expect("read suppressed source")
        .expect("suppressed source");
    assert_eq!(
        stored_suppressed[0].suppression_status.as_deref(),
        Some("suppressed")
    );
    assert_eq!(
        stored_suppressed[0].suppression_reason.as_deref(),
        Some("sensitiveContext")
    );
    assert_eq!(
        stored_suppressed[0].storage_strength,
        memory.storage_strength
    );
    assert_eq!(stored_suppressed[0].summary, memory.summary);

    let suppressed_reference = suppressed_preview.references[0].clone();
    let released = assess_memory_suppression_at(
        &root,
        AssessMemorySuppressionInput {
            expected_source_sha256: suppressed.source_sha256_after,
            record_id: memory.id,
            expected_record_sha256: suppressed_reference.record_sha256,
            action: MemorySuppressionAction::Release,
            reason: MemorySuppressionReason::OwnerChoice,
            confirmed: true,
        },
        "2026-08-22T12:02:00Z".into(),
    )
    .expect("release suppressed memory");
    assert!(released.previous_suppressed);
    assert!(!released.new_suppressed);
    let released_preview = released.lifecycle.preview.expect("released preview");
    assert_eq!(released_preview.suppressed_count, 0);
    assert_eq!(released_preview.accessible_count, 1);
    assert_eq!(
        released_preview.references[0].retrieval_policy,
        MemoryRetrievalPolicy::Eligible
    );
    let (_, stored_released) = read_validated_source_at(&root)
        .expect("read released source")
        .expect("released source");
    assert_eq!(stored_released[0].suppression_status, None);
    assert_eq!(stored_released[0].suppression_reason, None);
    assert_eq!(stored_released[0].suppression_updated_at, None);
    assert_eq!(stored_released[0].storage_strength, memory.storage_strength);
    assert_eq!(stored_released[0].summary, memory.summary);
    fs::remove_dir_all(root).expect("remove suppression cycle fixture");
}

#[test]
fn suppression_rejects_invalid_transitions_and_restores_on_audit_failure() {
    let root = temporary_probe_root("suppression-rejections");
    let mut memory = legacy_memory();
    memory.id = "suppression-rejection".into();
    memory.kind = "Enseñanza".into();
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha = memory_subject_digest(&source_content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("suppression rejection preview")
        .references
        .remove(0);
    let before = file_hashes(&root);
    let mut input = AssessMemorySuppressionInput {
        expected_source_sha256: source_sha,
        record_id: memory.id.clone(),
        expected_record_sha256: reference.record_sha256,
        action: MemorySuppressionAction::Suppress,
        reason: MemorySuppressionReason::OwnerChoice,
        confirmed: true,
    };
    assert!(
        assess_memory_suppression_at(&root, input.clone(), "2026-08-22T12:10:00Z".into()).is_err()
    );
    input.confirmed = false;
    assert!(assess_memory_suppression_at(&root, input, "2026-08-22T12:10:00Z".into()).is_err());
    assert_eq!(file_hashes(&root), before);

    memory.memory_status = Some("confirmed".into());
    let current_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let current_sha = memory_subject_digest(&current_content);
    let current_reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("current suppression preview")
        .references
        .remove(0);
    fs::write(root.join("memory").join("audit"), "blocked")
        .expect("create suppression audit obstruction");
    let result = assess_memory_suppression_at(
        &root,
        AssessMemorySuppressionInput {
            expected_source_sha256: current_sha.clone(),
            record_id: memory.id,
            expected_record_sha256: current_reference.record_sha256,
            action: MemorySuppressionAction::Suppress,
            reason: MemorySuppressionReason::TemporaryBoundary,
            confirmed: true,
        },
        "2026-08-22T12:11:00Z".into(),
    );
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read restored suppression source"),
        current_content
    );
    assert_eq!(
        fs::read_to_string(suppression_source_backup_path(&root, &current_sha))
            .expect("read suppression backup"),
        current_content
    );
    fs::remove_dir_all(root).expect("remove suppression rejection fixture");
}

#[test]
fn archive_and_restore_are_physical_reversible_and_preserve_other_axes() {
    let root = temporary_probe_root("archive-reversible");
    let mut memory = legacy_memory();
    memory.id = "archive-target".into();
    memory.memory_status = Some("confirmed".into());
    memory.accessibility_status = Some("dormant".into());
    memory.accessibility_updated_at = Some("2026-08-23T11:00:00Z".into());
    memory.suppression_status = Some("suppressed".into());
    memory.suppression_reason = Some("ownerChoice".into());
    memory.suppression_updated_at = Some("2026-08-23T11:05:00Z".into());
    memory.storage_strength = Some(0.42);
    memory.summary = Some("Contenido real que debe permanecer intacto".into());
    let original_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let original_sha = memory_subject_digest(&original_content);
    let original_files = file_hashes(&root);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("initial archive preview")
        .references
        .remove(0);
    let (preview, _, _) = prepare_memory_archive_at(
        &root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: original_sha.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryArchiveAction::Archive,
            reason: MemoryArchiveReason::OwnerChoice,
            note: "Carlos decidió retirar temporalmente este recuerdo".into(),
        },
        "2026-08-23T12:00:00Z".into(),
    )
    .expect("prepare archive");
    assert_eq!(file_hashes(&root), original_files);
    let archived = confirm_memory_archive_at(
        &root,
        ConfirmMemoryArchiveInput {
            expected_plan_id: preview.plan_id,
            planned_at: preview.planned_at,
            expected_source_sha256: preview.source_sha256,
            record_id: preview.record_id,
            expected_record_sha256: preview.record_sha256_before,
            action: preview.action,
            reason: preview.reason,
            note: "Carlos decidió retirar temporalmente este recuerdo".into(),
            confirmed: true,
        },
    )
    .expect("confirm archive");
    assert!(archived.new_archived);
    assert_eq!(archived.backup_sha256, original_sha);
    let (_, archived_records) = read_validated_source_at(&root)
        .expect("read archived source")
        .expect("archived source");
    assert_eq!(archived_records[0].memory_status, memory.memory_status);
    assert_eq!(
        archived_records[0].accessibility_status,
        memory.accessibility_status
    );
    assert_eq!(
        archived_records[0].suppression_status,
        memory.suppression_status
    );
    assert_eq!(
        archived_records[0].storage_strength,
        memory.storage_strength
    );
    assert_eq!(archived_records[0].summary, memory.summary);
    let archived_reference = archived
        .lifecycle
        .preview
        .expect("archived lifecycle")
        .references
        .remove(0);
    assert!(archived_reference.archived);
    assert_eq!(
        archived_reference.retrieval_policy,
        MemoryRetrievalPolicy::BlockedByArchive
    );

    let (restore_preview, _, _) = prepare_memory_archive_at(
        &root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: archived.source_sha256_after,
            record_id: memory.id.clone(),
            expected_record_sha256: archived_reference.record_sha256,
            action: MemoryArchiveAction::Restore,
            reason: MemoryArchiveReason::RelevantAgain,
            note: "El recuerdo vuelve a ser relevante para Carlos".into(),
        },
        "2026-08-23T12:10:00Z".into(),
    )
    .expect("prepare restore");
    let restored = confirm_memory_archive_at(
        &root,
        ConfirmMemoryArchiveInput {
            expected_plan_id: restore_preview.plan_id,
            planned_at: restore_preview.planned_at,
            expected_source_sha256: restore_preview.source_sha256,
            record_id: restore_preview.record_id,
            expected_record_sha256: restore_preview.record_sha256_before,
            action: restore_preview.action,
            reason: restore_preview.reason,
            note: "El recuerdo vuelve a ser relevante para Carlos".into(),
            confirmed: true,
        },
    )
    .expect("confirm restore");
    assert!(!restored.new_archived);
    assert_eq!(restored.source_sha256_after, original_sha);
    let (_, restored_records) = read_validated_source_at(&root)
        .expect("read restored source")
        .expect("restored source");
    assert_eq!(restored_records[0], memory);
    let restored_reference = restored
        .lifecycle
        .preview
        .expect("restored lifecycle")
        .references
        .remove(0);
    assert!(!restored_reference.archived);
    assert_eq!(
        restored_reference.retrieval_policy,
        MemoryRetrievalPolicy::BlockedBySuppression
    );
    fs::remove_dir_all(root).expect("remove archive cycle fixture");
}

#[test]
fn archive_rejects_unconfirmed_stale_legacy_and_restores_audit_failure() {
    let root = temporary_probe_root("archive-guards");
    let mut memory = legacy_memory();
    memory.id = "archive-guard".into();
    memory.memory_status = Some("confirmed".into());
    let source_content = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha = memory_subject_digest(&source_content);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("guard preview")
        .references
        .remove(0);
    let (preview, _, _) = prepare_memory_archive_at(
        &root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: source_sha.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryArchiveAction::Archive,
            reason: MemoryArchiveReason::NoLongerRelevant,
            note: "Ya no corresponde al contexto actual".into(),
        },
        "2026-08-23T13:00:00Z".into(),
    )
    .expect("prepare guarded archive");
    let mut confirmation = ConfirmMemoryArchiveInput {
        expected_plan_id: preview.plan_id.clone(),
        planned_at: preview.planned_at.clone(),
        expected_source_sha256: preview.source_sha256.clone(),
        record_id: preview.record_id.clone(),
        expected_record_sha256: preview.record_sha256_before.clone(),
        action: preview.action,
        reason: preview.reason,
        note: "Ya no corresponde al contexto actual".into(),
        confirmed: false,
    };
    assert!(confirm_memory_archive_at(&root, confirmation.clone()).is_err());
    confirmation.confirmed = true;
    confirmation.expected_source_sha256 = memory_subject_digest("stale");
    assert!(confirm_memory_archive_at(&root, confirmation).is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).expect("unchanged source"),
        source_content
    );
    fs::write(root.join("memory").join("audit"), "blocked").expect("audit obstruction");
    let failed = confirm_memory_archive_at(
        &root,
        ConfirmMemoryArchiveInput {
            expected_plan_id: preview.plan_id,
            planned_at: preview.planned_at,
            expected_source_sha256: preview.source_sha256,
            record_id: preview.record_id,
            expected_record_sha256: preview.record_sha256_before,
            action: preview.action,
            reason: preview.reason,
            note: "Ya no corresponde al contexto actual".into(),
            confirmed: true,
        },
    );
    assert!(failed.is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).expect("restored source"),
        source_content
    );

    let legacy_root = temporary_probe_root("archive-legacy");
    memory.memory_status = Some("archived".into());
    let legacy_content = write_layered_fixture(&legacy_root, std::slice::from_ref(&memory));
    let legacy_reference = memory_lifecycle_preview_at(&legacy_root)
        .preview
        .expect("legacy preview")
        .references
        .remove(0);
    assert!(prepare_memory_archive_at(
        &legacy_root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: memory_subject_digest(&legacy_content),
            record_id: memory.id,
            expected_record_sha256: legacy_reference.record_sha256,
            action: MemoryArchiveAction::Restore,
            reason: MemoryArchiveReason::RelevantAgain,
            note: "Intento de restauración heredada".into()
        },
        "2026-08-23T13:10:00Z".into()
    )
    .is_err());
    fs::remove_dir_all(root).expect("remove archive guard fixture");
    fs::remove_dir_all(legacy_root).expect("remove legacy archive fixture");
}

#[test]
fn deletion_retention_is_physical_cancelable_and_enforces_seven_days() {
    let root = temporary_probe_root("deletion-retention");
    let mut memory = legacy_memory();
    memory.id = "retention-target".into();
    memory.memory_status = Some("confirmed".into());
    memory.summary = Some("Contenido que debe sobrevivir a la espera".into());
    let source = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("initial retention preview")
        .references
        .remove(0);
    let (archive_plan, _, _) = prepare_memory_archive_at(
        &root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: memory_subject_digest(&source),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryArchiveAction::Archive,
            reason: MemoryArchiveReason::OwnerChoice,
            note: "Paso previo reversible".into(),
        },
        "2026-08-23T09:00:00Z".into(),
    )
    .expect("prepare archive before retention");
    let archived = confirm_memory_archive_at(
        &root,
        ConfirmMemoryArchiveInput {
            expected_plan_id: archive_plan.plan_id,
            planned_at: archive_plan.planned_at,
            expected_source_sha256: archive_plan.source_sha256,
            record_id: archive_plan.record_id,
            expected_record_sha256: archive_plan.record_sha256_before,
            action: archive_plan.action,
            reason: archive_plan.reason,
            note: "Paso previo reversible".into(),
            confirmed: true,
        },
    )
    .expect("archive before retention");
    let archived_reference = archived
        .lifecycle
        .preview
        .expect("archive lifecycle")
        .references
        .remove(0);
    let before_preview = file_hashes(&root);
    let (schedule, _, _) = prepare_memory_deletion_schedule_at(
        &root,
        PreviewMemoryDeletionScheduleInput {
            expected_source_sha256: archived.source_sha256_after,
            record_id: memory.id.clone(),
            expected_record_sha256: archived_reference.record_sha256,
            action: MemoryDeletionScheduleAction::Schedule,
            reason: MemoryDeletionReason::OwnerRequest,
            note: "Carlos solicita evaluar el retiro".into(),
        },
        "2026-08-23T10:00:00Z".into(),
        "2026-08-30T10:00:00Z".into(),
    )
    .expect("prepare seven-day retention");
    assert_eq!(file_hashes(&root), before_preview);
    assert_eq!(schedule.wait_seconds, 604_800);
    assert!(prepare_memory_deletion_schedule_at(
        &root,
        PreviewMemoryDeletionScheduleInput {
            expected_source_sha256: schedule.source_sha256.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: schedule.record_sha256_before.clone(),
            action: MemoryDeletionScheduleAction::Schedule,
            reason: MemoryDeletionReason::OwnerRequest,
            note: "Intento de acortar espera".into(),
        },
        "2026-08-23T10:00:00Z".into(),
        "2026-08-24T10:00:00Z".into(),
    )
    .is_err());
    let scheduled = confirm_memory_deletion_schedule_at(
        &root,
        ConfirmMemoryDeletionScheduleInput {
            expected_plan_id: schedule.plan_id,
            planned_at: schedule.planned_at,
            eligible_at: schedule.eligible_at,
            expected_source_sha256: schedule.source_sha256,
            record_id: schedule.record_id,
            expected_record_sha256: schedule.record_sha256_before,
            action: schedule.action,
            reason: schedule.reason,
            note: "Carlos solicita evaluar el retiro".into(),
            confirmed: true,
        },
    )
    .expect("confirm retention");
    assert!(scheduled.new_scheduled);
    assert_eq!(
        scheduled
            .lifecycle
            .preview
            .as_ref()
            .expect("scheduled lifecycle")
            .retention_assessed_count,
        1
    );
    let (_, stored) = read_validated_source_at(&root)
        .expect("read scheduled source")
        .expect("scheduled source");
    assert_eq!(stored[0].summary, memory.summary);
    assert_eq!(
        stored[0].deletion_eligible_at.as_deref(),
        Some("2026-08-30T10:00:00Z")
    );
    let scheduled_reference = scheduled
        .lifecycle
        .preview
        .expect("scheduled preview")
        .references
        .remove(0);
    assert!(prepare_memory_deletion_at(
        &root,
        PreviewMemoryDeletionInput {
            expected_source_sha256: scheduled.source_sha256_after.clone(),
            record_id: memory.id.clone(),
            expected_record_sha256: scheduled_reference.record_sha256.clone(),
            note: "Todavía no debe eliminarse".into(),
        },
        "2026-08-30T09:59:59Z".into(),
    )
    .is_err());
    let (cancel, _, _) = prepare_memory_deletion_schedule_at(
        &root,
        PreviewMemoryDeletionScheduleInput {
            expected_source_sha256: scheduled.source_sha256_after,
            record_id: memory.id.clone(),
            expected_record_sha256: scheduled_reference.record_sha256,
            action: MemoryDeletionScheduleAction::Cancel,
            reason: MemoryDeletionReason::OwnerRequest,
            note: "Carlos cancela el retiro".into(),
        },
        "2026-08-24T10:00:00Z".into(),
        "2026-08-31T10:00:00Z".into(),
    )
    .expect("prepare cancellation");
    let canceled = confirm_memory_deletion_schedule_at(
        &root,
        ConfirmMemoryDeletionScheduleInput {
            expected_plan_id: cancel.plan_id,
            planned_at: cancel.planned_at,
            eligible_at: cancel.eligible_at,
            expected_source_sha256: cancel.source_sha256,
            record_id: cancel.record_id,
            expected_record_sha256: cancel.record_sha256_before,
            action: cancel.action,
            reason: cancel.reason,
            note: "Carlos cancela el retiro".into(),
            confirmed: true,
        },
    )
    .expect("cancel retention");
    assert!(!canceled.new_scheduled);
    let (_, stored) = read_validated_source_at(&root)
        .expect("read canceled source")
        .expect("canceled source");
    assert!(stored[0].deletion_status.is_none());
    assert_eq!(stored[0].summary, memory.summary);
    fs::remove_dir_all(root).expect("remove retention fixture");
}

#[test]
fn final_deletion_removes_active_record_only_after_safeguard_and_writes_content_free_tombstone() {
    let root = temporary_probe_root("deletion-final");
    let mut memory = legacy_memory();
    memory.id = "delete-target".into();
    memory.memory_status = Some("confirmed".into());
    memory.summary = Some("Contenido privado que no debe aparecer en la lápida".into());
    memory.archive_status = Some("archived".into());
    memory.archive_reason = Some("ownerChoice".into());
    memory.archive_updated_at = Some("2026-08-20T10:00:00Z".into());
    let source = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("archive preview")
        .references
        .remove(0);
    let (schedule, _, _) = prepare_memory_deletion_schedule_at(
        &root,
        PreviewMemoryDeletionScheduleInput {
            expected_source_sha256: memory_subject_digest(&source),
            record_id: memory.id.clone(),
            expected_record_sha256: reference.record_sha256,
            action: MemoryDeletionScheduleAction::Schedule,
            reason: MemoryDeletionReason::PrivacyRemoval,
            note: "Retiro solicitado por privacidad".into(),
        },
        "2026-08-20T11:00:00Z".into(),
        "2026-08-27T11:00:00Z".into(),
    )
    .expect("prepare final retention");
    let scheduled = confirm_memory_deletion_schedule_at(
        &root,
        ConfirmMemoryDeletionScheduleInput {
            expected_plan_id: schedule.plan_id,
            planned_at: schedule.planned_at,
            eligible_at: schedule.eligible_at,
            expected_source_sha256: schedule.source_sha256,
            record_id: schedule.record_id,
            expected_record_sha256: schedule.record_sha256_before,
            action: schedule.action,
            reason: schedule.reason,
            note: "Retiro solicitado por privacidad".into(),
            confirmed: true,
        },
    )
    .expect("schedule final deletion");
    let scheduled_source = fs::read_to_string(root.join("memory").join("records.json"))
        .expect("scheduled source bytes");
    let scheduled_reference = scheduled
        .lifecycle
        .preview
        .expect("scheduled lifecycle")
        .references
        .remove(0);
    let (preview, _, _, _) = prepare_memory_deletion_at(
        &root,
        PreviewMemoryDeletionInput {
            expected_source_sha256: scheduled.source_sha256_after,
            record_id: memory.id.clone(),
            expected_record_sha256: scheduled_reference.record_sha256,
            note: "Confirmación final del retiro privado".into(),
        },
        "2026-08-27T11:00:00Z".into(),
    )
    .expect("prepare final deletion");
    let confirmation = ConfirmMemoryDeletionInput {
        expected_plan_id: preview.plan_id.clone(),
        planned_at: preview.planned_at,
        expected_source_sha256: preview.source_sha256,
        record_id: preview.record_id,
        expected_record_sha256: preview.record_sha256,
        note: "Confirmación final del retiro privado".into(),
        confirmed: true,
    };
    let audit_path = root.join("memory").join("audit");
    fs::remove_dir_all(&audit_path).expect("remove audit directory inside fixture");
    fs::write(&audit_path, "blocked").expect("create audit obstruction");
    assert!(
        confirm_memory_deletion_at(&root, confirmation.clone(), "2026-08-27T11:00:01Z".into(),)
            .is_err()
    );
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read source restored after failed audit"),
        scheduled_source
    );
    assert!(!root
        .join("memory")
        .join("deletion-tombstones")
        .join(format!("{}.json", &preview.plan_id[7..]))
        .exists());
    fs::remove_file(&audit_path).expect("remove audit obstruction");
    let result = confirm_memory_deletion_at(&root, confirmation, "2026-08-27T11:00:02Z".into())
        .expect("confirm final deletion");
    assert_eq!(result.remaining_record_count, 0);
    assert!(read_validated_source_at(&root)
        .expect("read source after deletion")
        .expect("source exists")
        .1
        .is_empty());
    let safeguard = fs::read_to_string(
        root.join("memory")
            .join("private-deletion-safeguards")
            .join(format!("source-{}.json", &result.source_sha256_before[7..])),
    )
    .expect("read exact safeguard");
    assert_eq!(safeguard, scheduled_source);
    let tombstone = fs::read_to_string(
        root.join("memory")
            .join("deletion-tombstones")
            .join(format!("{}.json", &preview.plan_id[7..])),
    )
    .expect("read tombstone");
    assert!(!tombstone.contains("Contenido privado"));
    assert!(!tombstone.contains("delete-target"));
    let parsed: MemoryDeletionTombstone =
        serde_json::from_str(&tombstone).expect("parse tombstone");
    assert!(!parsed.content_included);
    fs::remove_dir_all(root).expect("remove final deletion fixture");
}

#[test]
fn reconsolidation_preview_and_confirmation_preserve_a_real_previous_version() {
    let root = temporary_probe_root("reconsolidation-version");
    let mut memory = legacy_memory();
    memory.id = "reconsolidation-memory".into();
    memory.memory_status = Some("confirmed".into());
    memory.summary = Some("Contenido original confirmado".into());
    memory.source = Some("Confirmación directa".into());
    let original_record = memory.clone();
    let original_source = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let original_source_sha = memory_subject_digest(&original_source);
    let original_reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("initial reconsolidation preview")
        .references
        .remove(0);
    let proposal = PreviewMemoryReconsolidationInput {
        expected_source_sha256: original_source_sha.clone(),
        record_id: memory.id.clone(),
        expected_record_sha256: original_reference.record_sha256.clone(),
        reason: MemoryReconsolidationReason::Clarification,
        note: "Carlos aclaró el contenido y confirmó la actualización".into(),
        proposed_intention: memory.intention.clone(),
        proposed_summary: Some("Contenido aclarado y confirmado".into()),
        proposed_next_step: memory.next_step.clone(),
        proposed_source: Some("Aclaración directa de Carlos".into()),
    };
    let before_preview = file_hashes(&root);
    let (preview, _, _, _) =
        prepare_memory_reconsolidation_at(&root, proposal.clone(), "2026-08-23T13:00:00Z".into())
            .expect("prepare versioned reconsolidation");
    assert_eq!(file_hashes(&root), before_preview);
    assert_eq!(preview.previous_version, 1);
    assert_eq!(preview.projected_version, 2);
    assert!(!preview.records_modified);
    assert!(!preview.version_written);
    assert_eq!(
        preview.changed_fields,
        vec![
            MemoryReconsolidationField::Summary,
            MemoryReconsolidationField::Source
        ]
    );

    let result = confirm_memory_reconsolidation_at(
        &root,
        ConfirmMemoryReconsolidationInput {
            expected_plan_id: preview.plan_id.clone(),
            planned_at: preview.planned_at.clone(),
            expected_source_sha256: proposal.expected_source_sha256,
            record_id: proposal.record_id,
            expected_record_sha256: proposal.expected_record_sha256,
            reason: proposal.reason,
            note: proposal.note,
            proposed_intention: proposal.proposed_intention,
            proposed_summary: proposal.proposed_summary,
            proposed_next_step: proposal.proposed_next_step,
            proposed_source: proposal.proposed_source,
            confirmed: true,
        },
    )
    .expect("confirm versioned reconsolidation");
    assert_eq!(result.previous_version, 1);
    assert_eq!(result.new_version, 2);
    assert_eq!(result.backup_sha256, original_source_sha);
    assert!(result.records_modified && result.version_written && result.audit_written);
    assert_eq!(
        fs::read_to_string(reconsolidation_source_backup_path(
            &root,
            &result.source_sha256_before
        ))
        .expect("read exact reconsolidation backup"),
        original_source
    );
    let revision_content =
        fs::read_to_string(reconsolidation_revision_path(&root, &result.revision_id))
            .expect("read immutable previous version");
    assert_eq!(
        memory_subject_digest(&revision_content),
        result.revision_sha256
    );
    let revision: MemoryReconsolidationRevision =
        serde_json::from_str(&revision_content).expect("decode previous version");
    assert_eq!(revision.record, original_record);
    assert_eq!(revision.previous_version, 1);
    assert_eq!(revision.successor_version, 2);
    let (_, stored) = read_validated_source_at(&root)
        .expect("read reconsolidated source")
        .expect("reconsolidated source exists");
    assert_eq!(
        stored[0].summary.as_deref(),
        Some("Contenido aclarado y confirmado")
    );
    assert_eq!(stored[0].memory_version, Some(2));
    assert_eq!(
        stored[0].previous_version_sha256.as_deref(),
        Some(result.record_sha256_before.as_str())
    );
    let lifecycle = result.lifecycle.preview.expect("reconsolidated lifecycle");
    assert_eq!(lifecycle.reconsolidated_count, 1);
    assert_eq!(lifecycle.references[0].reconsolidation_count, 1);
    assert_eq!(
        lifecycle.references[0].record_sha256,
        result.record_sha256_after
    );
    fs::remove_dir_all(root).expect("remove reconsolidation version fixture");
}

#[test]
fn generic_save_guard_blocks_silent_content_and_version_overwrites() {
    let mut confirmed = legacy_memory();
    confirmed.id = "guarded-memory".into();
    confirmed.memory_status = Some("confirmed".into());
    confirmed.summary = Some("Contenido confirmado".into());

    let mut discardable = legacy_memory();
    discardable.id = "legacy-fragment".into();
    assert!(validate_generic_memory_update(
        &[discardable, confirmed.clone()],
        std::slice::from_ref(&confirmed)
    )
    .is_ok());

    let mut metadata_only = confirmed.clone();
    metadata_only.successful_recalls = 1;
    metadata_only.failed_recalls = 0;
    metadata_only.retrieval_evidence_version = Some(1);
    metadata_only.last_recalled_at = Some("2026-08-23T13:05:00Z".into());
    assert!(validate_generic_memory_update(
        std::slice::from_ref(&confirmed),
        std::slice::from_ref(&metadata_only)
    )
    .is_ok());

    let mut overwritten = confirmed.clone();
    overwritten.summary = Some("Sobrescritura silenciosa".into());
    assert!(validate_generic_memory_update(
        std::slice::from_ref(&confirmed),
        std::slice::from_ref(&overwritten)
    )
    .is_err());

    let mut forged_version = confirmed.clone();
    forged_version.memory_version = Some(2);
    forged_version.reconsolidated_at = Some("2026-08-23T13:06:00Z".into());
    forged_version.reconsolidation_reason = Some("clarification".into());
    forged_version.previous_version_sha256 = Some(memory_subject_digest("forged"));
    assert!(validate_generic_memory_update(
        std::slice::from_ref(&confirmed),
        std::slice::from_ref(&forged_version)
    )
    .is_err());
    let mut forged_archive = confirmed.clone();
    forged_archive.archive_status = Some("archived".into());
    forged_archive.archive_reason = Some("ownerChoice".into());
    forged_archive.archive_updated_at = Some("2026-08-23T13:07:00Z".into());
    assert!(validate_generic_memory_update(
        std::slice::from_ref(&confirmed),
        std::slice::from_ref(&forged_archive)
    )
    .is_err());
    assert!(validate_generic_memory_update(std::slice::from_ref(&confirmed), &[]).is_err());
}

#[test]
fn reconsolidation_rejects_noop_stale_and_unconfirmed_and_rolls_back_audit_failure() {
    let root = temporary_probe_root("reconsolidation-rollback");
    let mut memory = legacy_memory();
    memory.id = "reconsolidation-rollback".into();
    memory.memory_status = Some("confirmed".into());
    memory.summary = Some("Original".into());
    let source = write_layered_fixture(&root, std::slice::from_ref(&memory));
    let source_sha = memory_subject_digest(&source);
    let reference = memory_lifecycle_preview_at(&root)
        .preview
        .expect("reconsolidation rollback preview")
        .references
        .remove(0);
    let unchanged = PreviewMemoryReconsolidationInput {
        expected_source_sha256: source_sha.clone(),
        record_id: memory.id.clone(),
        expected_record_sha256: reference.record_sha256.clone(),
        reason: MemoryReconsolidationReason::Clarification,
        note: "Nota válida, pero sin cambios de contenido".into(),
        proposed_intention: memory.intention.clone(),
        proposed_summary: memory.summary.clone(),
        proposed_next_step: memory.next_step.clone(),
        proposed_source: memory.source.clone(),
    };
    let before_noop = file_hashes(&root);
    assert!(
        prepare_memory_reconsolidation_at(&root, unchanged, "2026-08-23T13:10:00Z".into()).is_err()
    );
    assert_eq!(file_hashes(&root), before_noop);

    let proposal = PreviewMemoryReconsolidationInput {
        expected_source_sha256: source_sha.clone(),
        record_id: memory.id.clone(),
        expected_record_sha256: reference.record_sha256.clone(),
        reason: MemoryReconsolidationReason::NewContext,
        note: "Nueva evidencia confirmada por el propietario".into(),
        proposed_intention: memory.intention.clone(),
        proposed_summary: Some("Actualizado".into()),
        proposed_next_step: memory.next_step.clone(),
        proposed_source: memory.source.clone(),
    };
    let (preview, _, _, _) =
        prepare_memory_reconsolidation_at(&root, proposal.clone(), "2026-08-23T13:11:00Z".into())
            .expect("prepare rollback plan");
    let unconfirmed = ConfirmMemoryReconsolidationInput {
        expected_plan_id: preview.plan_id.clone(),
        planned_at: preview.planned_at.clone(),
        expected_source_sha256: proposal.expected_source_sha256.clone(),
        record_id: proposal.record_id.clone(),
        expected_record_sha256: proposal.expected_record_sha256.clone(),
        reason: proposal.reason,
        note: proposal.note.clone(),
        proposed_intention: proposal.proposed_intention.clone(),
        proposed_summary: proposal.proposed_summary.clone(),
        proposed_next_step: proposal.proposed_next_step.clone(),
        proposed_source: proposal.proposed_source.clone(),
        confirmed: false,
    };
    let before_unconfirmed = file_hashes(&root);
    assert!(confirm_memory_reconsolidation_at(&root, unconfirmed).is_err());
    assert_eq!(file_hashes(&root), before_unconfirmed);

    let audit_path = root.join("memory").join("audit");
    fs::write(&audit_path, "obstruction").expect("create reconsolidation audit obstruction");
    let result = confirm_memory_reconsolidation_at(
        &root,
        ConfirmMemoryReconsolidationInput {
            expected_plan_id: preview.plan_id,
            planned_at: preview.planned_at,
            expected_source_sha256: proposal.expected_source_sha256,
            record_id: proposal.record_id,
            expected_record_sha256: proposal.expected_record_sha256,
            reason: proposal.reason,
            note: proposal.note,
            proposed_intention: proposal.proposed_intention,
            proposed_summary: proposal.proposed_summary,
            proposed_next_step: proposal.proposed_next_step,
            proposed_source: proposal.proposed_source,
            confirmed: true,
        },
    );
    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json"))
            .expect("read restored reconsolidation source"),
        source
    );
    assert_eq!(
        fs::read_to_string(reconsolidation_source_backup_path(&root, &source_sha))
            .expect("read reconsolidation rollback backup"),
        source
    );
    let revision_count = if root.join("memory").join("revisions").is_dir() {
        fs::read_dir(root.join("memory").join("revisions"))
            .expect("read revision directory")
            .count()
    } else {
        0
    };
    assert_eq!(revision_count, 0);
    fs::remove_dir_all(root).expect("remove reconsolidation rollback fixture");
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_lifecycle_preview_is_read_only() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let before = file_hashes(&root);
    let snapshot = memory_lifecycle_preview_at(&root);
    let after = file_hashes(&root);

    assert_eq!(after, before);
    assert_eq!(snapshot.state, MemoryLifecyclePreviewState::Active);
    assert!(snapshot.lifecycle_writes_available);
    let preview = snapshot.preview.expect("canonical lifecycle preview");
    assert_eq!(preview.references.len(), preview.record_count);
    assert_eq!(preview.weakening_assessments.len(), preview.record_count);
    assert_eq!(
        preview.current_count
            + preview.conflict_count
            + preview
                .references
                .iter()
                .filter(|reference| reference.validity == MemoryValidityState::Archived)
                .count()
            + preview.not_assessed_count,
        preview.record_count
    );
    assert_eq!(preview.retention_assessed_count, 0);
    assert_eq!(
        preview.suppressed_count,
        preview
            .references
            .iter()
            .filter(|reference| reference.suppressed)
            .count()
    );
    assert_eq!(
        preview.archived_count,
        preview
            .references
            .iter()
            .filter(|reference| reference.archived)
            .count()
    );
    assert_eq!(
        preview.reconsolidated_count,
        preview
            .references
            .iter()
            .filter(|reference| reference.reconsolidation_count > 0)
            .count()
    );
    assert_eq!(
        preview.accessible_count + preview.dormant_count,
        preview.accessibility_assessed_count
    );
    eprintln!(
        "R6_5_LIFECYCLE_CANONICAL records={} current={} conflict={} archived={} retention={} notAssessed={} accessible={} dormant={} suppressed={} reconsolidated={} outcomes={} assessed={} reviewRequired={} filesIntact={}",
        preview.record_count,
        preview.current_count,
        preview.conflict_count,
        preview.archived_count,
        preview.retention_assessed_count,
        preview.not_assessed_count,
        preview.accessible_count,
        preview.dormant_count,
        preview.suppressed_count,
        preview.reconsolidated_count,
        preview.retrieval_outcome_count,
        preview.functional_assessment_count,
        preview.weakening_review_required_count,
        before.len()
    );
}

#[test]
fn r6_preview_classifies_only_explicit_evidence_without_writing() {
    let root = temporary_probe_root("r6-preview");
    let conversation = legacy_memory();
    let semantic: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "semantic-1",
        "kind": "Enseñanza",
        "intention": "Dato enseñado",
        "startedAt": "2026-08-13T00:00:00Z",
        "memoryType": "semantic"
    }))
    .unwrap();
    let procedural: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "procedure-1",
        "kind": "Enseñanza",
        "intention": "Proceso enseñado",
        "startedAt": "2026-08-13T00:00:00Z",
        "memoryType": "procedural"
    }))
    .unwrap();
    let preference: MemorySession = serde_json::from_value(serde_json::json!({
        "id": "preference-1",
        "kind": "Enseñanza",
        "intention": "Preferencia enseñada",
        "startedAt": "2026-08-13T00:00:00Z",
        "memoryType": "preference"
    }))
    .unwrap();
    let source = write_layered_fixture(&root, &[conversation, semantic, procedural, preference]);
    let before = fs::read(root.join("memory").join("records.json")).unwrap();
    let snapshot = layered_memory_status_at(&root);
    let preview = snapshot.preview.expect("preview R6");

    assert_eq!(snapshot.state, LayeredMemoryState::Ready);
    assert_eq!(preview.record_count, 4);
    assert_eq!(preview.working_count, 0);
    assert_eq!(preview.episodic_count, 1);
    assert_eq!(preview.taught_fact_count, 1);
    assert_eq!(preview.procedural_count, 1);
    assert_eq!(preview.unclassified_count, 1);
    assert_eq!(preview.procedural_pending_count, 1);
    assert_eq!(preview.preference_pending_count, 1);
    assert!(!preview.content_copied);
    assert!(!preview.automatic_classification);
    assert_eq!(preview.source_sha256, memory_subject_digest(&source));
    assert_eq!(
        fs::read(root.join("memory").join("records.json")).unwrap(),
        before
    );
    assert!(!layered_memory_path(&root).exists());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn r6_activation_and_rollback_are_revisioned_and_preserve_source_bytes() {
    let root = temporary_probe_root("r6-reversible");
    let source = write_layered_fixture(&root, &[legacy_memory()]);
    let records = root.join("memory").join("records.json");
    let before = fs::read(&records).unwrap();
    let source_sha256 = memory_subject_digest(&source);

    let active = activate_layered_memory_at(
        &root,
        ActivateLayeredMemoryInput {
            expected_source_sha256: source_sha256,
            confirmed: true,
        },
        "2026-08-13T12:00:00Z".into(),
    )
    .expect("activate R6 projection");
    assert_eq!(active.state, LayeredMemoryState::Active);
    assert_eq!(active.revision_count, 1);
    assert_eq!(fs::read(&records).unwrap(), before);
    let revision_id = active.active_revision_id.expect("active revision");

    let rolled_back = rollback_layered_memory_at(
        &root,
        RollbackLayeredMemoryInput {
            expected_revision_id: revision_id,
            confirmed: true,
        },
    )
    .expect("rollback R6 projection");
    assert_eq!(rolled_back.state, LayeredMemoryState::RolledBack);
    assert_eq!(rolled_back.revision_count, 1);
    assert_eq!(fs::read(&records).unwrap(), before);
    let document = read_layered_document_at(&root).unwrap().unwrap();
    assert!(document.active_revision_id.is_none());
    assert_eq!(document.revisions.len(), 1);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn r6_fails_closed_on_stale_confirmation_and_corrupt_index() {
    let root = temporary_probe_root("r6-fail-closed");
    let source = write_layered_fixture(&root, &[legacy_memory()]);
    let stale_sha256 = memory_subject_digest(&source);
    fs::write(
        root.join("memory").join("records.json"),
        serde_json::to_string_pretty(&Vec::<MemorySession>::new()).unwrap(),
    )
    .unwrap();
    let result = activate_layered_memory_at(
        &root,
        ActivateLayeredMemoryInput {
            expected_source_sha256: stale_sha256,
            confirmed: true,
        },
        "2026-08-13T12:00:00Z".into(),
    );
    assert!(result.is_err());
    assert!(!layered_memory_path(&root).exists());

    fs::write(layered_memory_path(&root), "not-json").unwrap();
    let blocked = layered_memory_status_at(&root);
    assert_eq!(blocked.state, LayeredMemoryState::Blocked);
    assert!(blocked.blocked_reason.is_some());
    assert_eq!(
        fs::read_to_string(layered_memory_path(&root)).unwrap(),
        "not-json"
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn r6_blocks_structurally_valid_but_tampered_references() {
    let root = temporary_probe_root("r6-tampered-reference");
    let source = write_layered_fixture(&root, &[legacy_memory()]);
    let active = activate_layered_memory_at(
        &root,
        ActivateLayeredMemoryInput {
            expected_source_sha256: memory_subject_digest(&source),
            confirmed: true,
        },
        "2026-08-13T12:00:00Z".into(),
    )
    .unwrap();
    assert_eq!(active.state, LayeredMemoryState::Active);

    let mut document = read_layered_document_at(&root).unwrap().unwrap();
    document.revisions[0].layers.episodic[0].record_id = "otro-id".into();
    fs::write(
        layered_memory_path(&root),
        serde_json::to_string_pretty(&document).unwrap(),
    )
    .unwrap();

    let blocked = layered_memory_status_at(&root);
    assert_eq!(blocked.state, LayeredMemoryState::Blocked);
    assert!(blocked
        .blocked_reason
        .as_deref()
        .is_some_and(|reason| reason.contains("proyección determinista")));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn audited_memory_wrapper_writes_real_correlated_jsonl_without_content() {
    let root = temporary_probe_root("r3-write");
    let memory = root.join("memory");
    fs::create_dir_all(&memory).expect("create isolated memory directory");
    let records = memory.join("records.json");
    let private_content = "recuerdo privado que no debe aparecer en auditoría";
    let digest = memory_subject_digest(private_content);

    audited_memory_operation_with(
        &digest,
        "MEMORY_SAVED",
        |operation_id, stage, outcome, duration_ms, subject_digest, reason_code| {
            let event = AuditEvent::producer(
                operation_id,
                AuditSource::Memory,
                "memory.records.write".into(),
                "memory.save".into(),
                stage,
                outcome,
                duration_ms,
                subject_digest,
                reason_code,
            )?;
            append_event_at(&root, &event, AUDIT_MAX_BYTES)
        },
        || fs::write(&records, private_content).map_err(|error| error.to_string()),
    )
    .expect("execute audited memory write");

    assert_eq!(
        fs::read_to_string(&records).expect("read isolated memory"),
        private_content
    );
    let audit_json =
        fs::read_to_string(root.join("audit").join("events-v1.jsonl")).expect("read real R3 JSONL");
    let events = audit_json
        .lines()
        .map(|line| serde_json::from_str::<AuditEvent>(line).expect("parse R3 event"))
        .collect::<Vec<_>>();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].stage, AuditStage::Request);
    assert_eq!(events[1].stage, AuditStage::Execution);
    assert_eq!(events[0].operation_id, events[1].operation_id);
    assert!(events.iter().all(|event| {
        event.subject_digest.as_deref() == Some(digest.as_str())
            && event.source == AuditSource::Memory
    }));
    assert!(!audit_json.contains(private_content));
    fs::remove_dir_all(root).expect("remove isolated R3 memory fixture");
}

#[test]
fn capability_probe_does_not_create_a_missing_data_root() {
    let root = temporary_probe_root("missing");
    assert!(!root.exists());

    assert_eq!(
        memory_capability_probe(&root),
        MemoryCapabilityProbe {
            directory_exists: false,
            manifest: MemoryResourceState::Missing,
            records: MemoryResourceState::Missing,
            backup: MemoryResourceState::Missing,
        }
    );
    assert!(!root.exists());
}

#[test]
fn capability_probe_validates_existing_files_without_modifying_them() {
    let root = temporary_probe_root("valid");
    let memory = root.join("memory");
    let backups = memory.join("backups");
    fs::create_dir_all(&backups).expect("create controlled fixture");
    let manifest = serde_json::json!({
        "format": "alice-memory",
        "version": 1,
        "recordsFile": "records.json"
    })
    .to_string();
    let records = serde_json::to_string(&vec![legacy_memory()]).expect("serialize fixture");
    fs::write(memory.join("manifest.json"), &manifest).expect("write manifest fixture");
    fs::write(memory.join("records.json"), &records).expect("write records fixture");
    fs::write(backups.join("records.backup.json"), &records).expect("write backup fixture");

    assert_eq!(
        memory_capability_probe(&root),
        MemoryCapabilityProbe {
            directory_exists: true,
            manifest: MemoryResourceState::Valid,
            records: MemoryResourceState::Valid,
            backup: MemoryResourceState::Valid,
        }
    );
    assert_eq!(
        fs::read_to_string(memory.join("manifest.json")).expect("read manifest fixture"),
        manifest
    );
    assert_eq!(
        fs::read_to_string(memory.join("records.json")).expect("read records fixture"),
        records
    );
    assert_eq!(
        fs::read_to_string(backups.join("records.backup.json")).expect("read backup fixture"),
        records
    );

    fs::remove_dir_all(root).expect("remove controlled fixture");
}

#[test]
fn capability_probe_reports_invalid_records_without_rewriting_them() {
    let root = temporary_probe_root("invalid");
    let memory = root.join("memory");
    fs::create_dir_all(&memory).expect("create controlled fixture");
    fs::write(memory.join("records.json"), "not-json").expect("write corrupt fixture");

    let probe = memory_capability_probe(&root);
    assert_eq!(probe.records, MemoryResourceState::Invalid);
    assert_eq!(
        fs::read_to_string(memory.join("records.json")).expect("read corrupt fixture"),
        "not-json"
    );

    fs::remove_dir_all(root).expect("remove controlled fixture");
}

#[test]
fn r6_3_preview_detects_exact_and_review_pairs_without_writing() {
    let root = temporary_probe_root("r6-3-candidates");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "alice-a",
            "kind": "Enseñanza",
            "intention": "Arquitectura de Alice",
            "startedAt": "2026-08-14T10:00:00Z",
            "finishedAt": "2026-08-14T10:01:00Z",
            "summary": "Alice usa memoria local.",
            "nextStep": "Revisar",
            "memoryType": "semantic"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "alice-b",
            "kind": "Enseñanza",
            "intention": "  ARQUITECTURA, de Alice! ",
            "startedAt": "2026-08-14T11:00:00Z",
            "finishedAt": "2026-08-14T11:01:00Z",
            "summary": "Alice usa memoria local",
            "nextStep": "revisar",
            "memoryType": "semantic"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "alice-c",
            "kind": "Enseñanza",
            "intention": "Arquitectura de Alice",
            "startedAt": "2026-08-14T12:00:00Z",
            "finishedAt": "2026-08-14T12:01:00Z",
            "summary": "Alice usa únicamente memoria remota.",
            "memoryType": "semantic"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "alice-archived",
            "kind": "Enseñanza",
            "intention": "Arquitectura de Alice",
            "startedAt": "2026-08-14T13:00:00Z",
            "finishedAt": "2026-08-14T13:01:00Z",
            "summary": "Alice usa memoria local.",
            "memoryType": "semantic",
            "memoryStatus": "archived"
        }))
        .unwrap(),
    ];
    let content = write_layered_fixture(&root, &records);
    let before = file_hashes(&root);
    let snapshot = consolidation_preview_at(&root);
    let after = file_hashes(&root);

    assert_eq!(snapshot.state, ConsolidationPreviewState::Ready);
    assert_eq!(snapshot.record_count, 4);
    assert_eq!(snapshot.eligible_record_count, 3);
    assert_eq!(snapshot.archived_record_count, 1);
    assert_eq!(snapshot.candidate_count, 3);
    assert_eq!(snapshot.pending_candidate_count, 3);
    assert_eq!(snapshot.kept_separate_count, 0);
    assert_eq!(snapshot.exact_duplicate_count, 1);
    assert_eq!(snapshot.review_required_count, 2);
    assert_eq!(
        snapshot.source_sha256,
        Some(memory_subject_digest(&content))
    );
    assert!(snapshot
        .candidates
        .iter()
        .all(|candidate| candidate.requires_human_review && candidate.record_ids.len() == 2));
    assert!(!snapshot.automatic_merge);
    assert!(!snapshot.records_modified);
    assert!(!snapshot.model_used);
    assert_eq!(after, before);

    fs::remove_dir_all(root).expect("remove R6.3 fixture");
}

#[test]
fn r6_3_c_merge_preview_requires_exact_pair_and_never_writes() {
    let root = temporary_probe_root("r6-3-c-merge-preview");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-a",
            "kind": "Enseñanza",
            "intention": "Arquitectura de Alice",
            "startedAt": "2026-08-20T10:00:00Z",
            "finishedAt": "2026-08-20T10:01:00Z",
            "summary": "Alice usa memoria local.",
            "nextStep": "Revisar",
            "memoryType": "semantic",
            "source": "Carlos",
            "importance": 5
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-b",
            "kind": "Enseñanza",
            "intention": "  ARQUITECTURA, DE ALICE! ",
            "startedAt": "2026-08-20T11:00:00Z",
            "finishedAt": "2026-08-20T11:01:00Z",
            "summary": "Alice usa memoria local",
            "nextStep": "revisar",
            "memoryType": "semantic",
            "source": "Enseñanza directa",
            "importance": 4
        }))
        .unwrap(),
    ];
    let source = write_layered_fixture(&root, &records);
    let snapshot = consolidation_preview_at(&root);
    let candidate = snapshot
        .candidates
        .iter()
        .find(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .expect("exact duplicate candidate")
        .clone();
    let source_sha256 = snapshot.source_sha256.clone().unwrap();
    let before = file_hashes(&root);

    let plan = preview_consolidation_merge_at(
        &root,
        PreviewConsolidationMergeInput {
            expected_source_sha256: source_sha256.clone(),
            candidate_id: candidate.candidate_id.clone(),
            expected_record_ids: candidate.record_ids.clone(),
            survivor_record_id: "memory-a".into(),
        },
    )
    .expect("read-only merge preview");

    assert_eq!(plan.schema_version, 4);
    assert_eq!(
        plan.candidate_kind,
        ConsolidationCandidateKind::ExactDuplicate
    );
    assert_eq!(plan.survivor_record_id, "memory-a");
    assert_eq!(plan.duplicate_record_id, "memory-b");
    assert_eq!(plan.current_record_count, 2);
    assert_eq!(plan.projected_record_count, 1);
    assert!(is_sha256(&plan.projected_source_sha256));
    assert_ne!(plan.projected_source_sha256, memory_subject_digest(&source));
    assert!(plan.normalized_content_equal);
    assert!(plan
        .differing_fields
        .contains(&ConsolidationMergeDifferenceField::Intention));
    assert!(plan
        .differing_fields
        .contains(&ConsolidationMergeDifferenceField::StartedAt));
    assert!(plan
        .differing_fields
        .contains(&ConsolidationMergeDifferenceField::Source));
    assert_eq!(
        plan.source_backup_status,
        ConsolidationMergeBackupStatus::Missing
    );
    assert_eq!(plan.layer_impact, ConsolidationMergeLayerImpact::Absent);
    assert_eq!(plan.recovery_protocol_version, 1);
    assert_eq!(plan.recovery_steps.len(), 8);
    assert!(plan.byte_exact_backup_required);
    assert!(plan.atomic_replace_required);
    assert!(plan.audit_required);
    assert!(plan.restored_source_verification_required);
    assert!(!plan.active_layer_execution_blocked);
    assert_eq!(plan.transaction_receipt_version, 1);
    assert_eq!(
        plan.transaction_receipt_file,
        CONSOLIDATION_TRANSACTION_FILE
    );
    assert!(plan.durable_receipt_required);
    assert!(plan.restart_recovery_required);
    assert!(!plan.execution_available);
    assert!(plan.requires_final_confirmation);
    assert!(plan.restoration_command_available);
    assert!(!plan.records_modified);
    assert!(!plan.files_created);
    assert!(!plan.audit_written);
    assert!(!plan.model_used);
    assert_eq!(file_hashes(&root), before);

    let wrong_survivor = preview_consolidation_merge_at(
        &root,
        PreviewConsolidationMergeInput {
            expected_source_sha256: source_sha256.clone(),
            candidate_id: candidate.candidate_id.clone(),
            expected_record_ids: candidate.record_ids.clone(),
            survivor_record_id: "memory-c".into(),
        },
    );
    assert!(wrong_survivor.is_err());
    assert_eq!(file_hashes(&root), before);

    let backup_path = consolidation_source_backup_path(&root, &source_sha256);
    fs::create_dir_all(backup_path.parent().unwrap()).unwrap();
    fs::write(&backup_path, &source).unwrap();
    let active = activate_layered_memory_at(
        &root,
        ActivateLayeredMemoryInput {
            expected_source_sha256: source_sha256.clone(),
            confirmed: true,
        },
        "2026-08-20T12:00:00Z".into(),
    )
    .expect("activate controlled R6.1 projection");
    let active_revision_id = active.active_revision_id.expect("active R6.1 revision");
    let before_active_plan = file_hashes(&root);
    let active_plan = preview_consolidation_merge_at(
        &root,
        PreviewConsolidationMergeInput {
            expected_source_sha256: source_sha256,
            candidate_id: candidate.candidate_id,
            expected_record_ids: candidate.record_ids,
            survivor_record_id: "memory-b".into(),
        },
    )
    .expect("read-only plan with verified backup and active layer");
    assert_eq!(
        active_plan.source_backup_status,
        ConsolidationMergeBackupStatus::Verified
    );
    assert_eq!(
        active_plan.layer_impact,
        ConsolidationMergeLayerImpact::ActiveRevisionWillBecomeStale
    );
    assert_eq!(
        active_plan.active_layer_revision_id.as_deref(),
        Some(active_revision_id.as_str())
    );
    assert!(active_plan.active_layer_execution_blocked);
    assert_eq!(file_hashes(&root), before_active_plan);

    fs::remove_dir_all(root).expect("remove R6.3-C fixture");
}

#[test]
fn r6_3_d_rehearsal_restores_real_bytes_and_blocks_active_layers() {
    let root = temporary_probe_root("r6-3-d-recovery-rehearsal");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "recovery-a",
            "kind": "Enseñanza",
            "intention": "Protocolo de recuperación",
            "startedAt": "2026-08-20T14:00:00Z",
            "finishedAt": "2026-08-20T14:01:00Z",
            "summary": "Restaurar la fuente byte a byte.",
            "nextStep": "Verificar SHA",
            "memoryType": "semantic",
            "source": "Carlos"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "recovery-b",
            "kind": "Enseñanza",
            "intention": "PROTOCOLO, DE RECUPERACIÓN!",
            "startedAt": "2026-08-20T15:00:00Z",
            "finishedAt": "2026-08-20T15:01:00Z",
            "summary": "Restaurar la fuente byte a byte",
            "nextStep": "verificar sha",
            "memoryType": "semantic",
            "source": "Ensayo controlado"
        }))
        .unwrap(),
    ];
    let original = write_layered_fixture(&root, &records);
    let source_path = root.join("memory").join("records.json");
    let original_bytes = fs::read(&source_path).unwrap();
    let snapshot = consolidation_preview_at(&root);
    let candidate = snapshot
        .candidates
        .iter()
        .find(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .unwrap()
        .clone();
    let source_sha256 = snapshot.source_sha256.unwrap();
    let input = PreviewConsolidationMergeInput {
        expected_source_sha256: source_sha256.clone(),
        candidate_id: candidate.candidate_id.clone(),
        expected_record_ids: candidate.record_ids.clone(),
        survivor_record_id: "recovery-a".into(),
    };

    let audit_root = root.clone();
    let rehearsal = rehearse_consolidation_recovery_at(&root, input.clone(), |plan| {
        let event = AuditEvent::producer(
            new_operation_id(),
            AuditSource::Memory,
            "memory.records.write".into(),
            "memory.consolidation.recovery_rehearsal".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            None,
            Some(plan.projected_source_sha256.clone()),
            "MEMORY_CONSOLIDATION_RECOVERY_REHEARSED",
        )?;
        append_event_at(&audit_root, &event, AUDIT_MAX_BYTES)
    })
    .expect("physical recovery rehearsal");

    assert_eq!(rehearsal.source_sha256, source_sha256);
    assert_ne!(rehearsal.projected_source_sha256, rehearsal.source_sha256);
    assert_eq!(rehearsal.restored_source_sha256, rehearsal.source_sha256);
    assert!(rehearsal.backup_created);
    assert!(rehearsal.projected_source_verified);
    assert!(rehearsal.audit_written);
    assert!(rehearsal.source_restored);
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);
    assert_eq!(
        fs::read_to_string(&rehearsal.source_backup_path).unwrap(),
        original
    );
    assert!(!source_path.with_extension("r6-3-d.tmp").exists());
    let audit_content = fs::read_to_string(root.join("audit").join("events-v1.jsonl"))
        .expect("real R3 rehearsal audit");
    let event = serde_json::from_str::<AuditEvent>(audit_content.trim()).unwrap();
    assert_eq!(event.source, AuditSource::Memory);
    assert_eq!(event.reason_code, "MEMORY_CONSOLIDATION_RECOVERY_REHEARSED");

    let before_failed_audit = file_hashes(&root);
    let failed_audit = rehearse_consolidation_recovery_at(&root, input.clone(), |_| {
        Err("fallo de auditoría inducido".into())
    })
    .unwrap_err();
    assert!(failed_audit.contains("restaurado byte a byte"));
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);
    assert_eq!(file_hashes(&root), before_failed_audit);

    let active = activate_layered_memory_at(
        &root,
        ActivateLayeredMemoryInput {
            expected_source_sha256: source_sha256,
            confirmed: true,
        },
        "2026-08-20T16:00:00Z".into(),
    )
    .expect("activate controlled R6.1 before blocked rehearsal");
    assert_eq!(active.state, LayeredMemoryState::Active);
    let before_block = file_hashes(&root);
    let blocked = rehearse_consolidation_recovery_at(&root, input, |_| {
        panic!("audit must not run while R6.1 is active")
    })
    .unwrap_err();
    assert!(blocked.contains("R6.1 activa"));
    assert_eq!(file_hashes(&root), before_block);

    fs::remove_dir_all(root).expect("remove R6.3-D fixture");
}

#[test]
fn r6_3_e_durable_receipt_recovers_after_restart_and_retries_audit() {
    let root = temporary_probe_root("r6-3-e-restart-recovery");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "restart-a",
            "kind": "Enseñanza",
            "intention": "Recuperación después de reiniciar",
            "startedAt": "2026-08-20T17:00:00Z",
            "finishedAt": "2026-08-20T17:01:00Z",
            "summary": "El recibo conserva sólo identificadores y huellas.",
            "nextStep": "Restaurar",
            "memoryType": "semantic",
            "source": "Carlos"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "restart-b",
            "kind": "Enseñanza",
            "intention": "RECUPERACIÓN DESPUÉS DE REINICIAR!",
            "startedAt": "2026-08-20T17:30:00Z",
            "finishedAt": "2026-08-20T17:31:00Z",
            "summary": "El recibo conserva sólo identificadores y huellas",
            "nextStep": "restaurar",
            "memoryType": "semantic",
            "source": "Ensayo de reinicio"
        }))
        .unwrap(),
    ];
    let original = write_layered_fixture(&root, &records);
    let source_path = root.join("memory").join("records.json");
    let original_bytes = fs::read(&source_path).unwrap();
    let snapshot = consolidation_preview_at(&root);
    let candidate = snapshot
        .candidates
        .iter()
        .find(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .unwrap()
        .clone();
    let source_sha256 = snapshot.source_sha256.unwrap();
    let transaction_id = prepare_interrupted_consolidation_at(
        &root,
        PreviewConsolidationMergeInput {
            expected_source_sha256: source_sha256.clone(),
            candidate_id: candidate.candidate_id,
            expected_record_ids: candidate.record_ids,
            survivor_record_id: "restart-a".into(),
        },
        "2026-08-20T18:00:00Z".into(),
    )
    .expect("prepare physical interrupted transaction");

    let projected = fs::read_to_string(&source_path).unwrap();
    let projected_sha256 = memory_subject_digest(&projected);
    assert_ne!(projected, original);
    assert_ne!(projected_sha256, source_sha256);
    let prepared_document = read_consolidation_transactions_at(&root).unwrap();
    assert_eq!(prepared_document.transactions.len(), 1);
    assert_eq!(
        prepared_document.transactions[0].state,
        ConsolidationTransactionState::Projected
    );
    assert!(prepared_document.transactions[0].restored_at.is_none());
    let receipt_text = fs::read_to_string(consolidation_transaction_path(&root)).unwrap();
    assert!(!receipt_text.contains("Recuperación después"));
    assert!(!receipt_text.contains("El recibo conserva"));

    let failed_audit = recover_interrupted_consolidation_at(
        &root,
        &transaction_id,
        &source_sha256,
        &projected_sha256,
        "2026-08-20T18:05:00Z".into(),
        |_| Err("auditoría temporalmente inaccesible".into()),
    )
    .unwrap_err();
    assert!(failed_audit.contains("auditoría debe reintentarse"));
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);
    assert_eq!(
        read_consolidation_transactions_at(&root)
            .unwrap()
            .transactions[0]
            .state,
        ConsolidationTransactionState::Projected
    );

    let audit_root = root.clone();
    let recovered = recover_interrupted_consolidation_at(
        &root,
        &transaction_id,
        &source_sha256,
        &projected_sha256,
        "2026-08-20T18:10:00Z".into(),
        |receipt| {
            let event = AuditEvent::producer(
                new_operation_id(),
                AuditSource::Memory,
                "memory.records.write".into(),
                "memory.consolidation.restart_recovery".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                None,
                Some(receipt.transaction_id.clone()),
                "MEMORY_CONSOLIDATION_RESTART_RECOVERED",
            )?;
            append_event_at(&audit_root, &event, AUDIT_MAX_BYTES)
        },
    )
    .expect("recover from durable receipt after simulated restart");
    assert_eq!(recovered.transaction_id, transaction_id);
    assert_eq!(recovered.source_sha256, source_sha256);
    assert!(recovered.source_restored);
    assert!(recovered.audit_written);
    assert_eq!(
        recovered.receipt_state,
        ConsolidationTransactionState::Restored
    );
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);
    let restored_document = read_consolidation_transactions_at(&root).unwrap();
    assert_eq!(
        restored_document.transactions[0].state,
        ConsolidationTransactionState::Restored
    );
    assert_eq!(
        restored_document.transactions[0].restored_at.as_deref(),
        Some("2026-08-20T18:10:00Z")
    );

    let idempotent = recover_interrupted_consolidation_at(
        &root,
        &transaction_id,
        &source_sha256,
        &projected_sha256,
        "2026-08-20T18:15:00Z".into(),
        |_| panic!("an already restored receipt must not audit again"),
    )
    .expect("idempotent recovery after restart");
    assert_eq!(
        idempotent.receipt_state,
        ConsolidationTransactionState::Restored
    );
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);

    let before_corruption_probe = fs::read(&source_path).unwrap();
    fs::write(consolidation_transaction_path(&root), b"{}").unwrap();
    assert!(recover_interrupted_consolidation_at(
        &root,
        &transaction_id,
        &source_sha256,
        &projected_sha256,
        "2026-08-20T18:20:00Z".into(),
        |_| Ok(()),
    )
    .is_err());
    assert_eq!(fs::read(&source_path).unwrap(), before_corruption_probe);

    fs::remove_dir_all(root).expect("remove R6.3-E fixture");
}

#[test]
fn r6_3_f_exposes_native_status_and_governed_restore_without_merge_command() {
    let root = temporary_probe_root("r6-3-f-governed-restoration");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "governed-a",
            "kind": "Enseñanza",
            "intention": "Restauración gobernada",
            "startedAt": "2026-08-20T19:00:00Z",
            "finishedAt": "2026-08-20T19:01:00Z",
            "summary": "La restauración requiere recibo y confirmación.",
            "nextStep": "Verificar estado",
            "memoryType": "semantic",
            "source": "Carlos"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "governed-b",
            "kind": "Enseñanza",
            "intention": "RESTAURACIÓN GOBERNADA!",
            "startedAt": "2026-08-20T19:30:00Z",
            "finishedAt": "2026-08-20T19:31:00Z",
            "summary": "La restauración requiere recibo y confirmación",
            "nextStep": "verificar estado",
            "memoryType": "semantic",
            "source": "Ensayo controlado"
        }))
        .unwrap(),
    ];
    let original = write_layered_fixture(&root, &records);
    let source_path = root.join("memory").join("records.json");
    let original_bytes = fs::read(&source_path).unwrap();
    let preview = consolidation_preview_at(&root);
    let source_sha256 = preview.source_sha256.unwrap();
    let candidate = preview
        .candidates
        .into_iter()
        .find(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .unwrap();
    let transaction_id = prepare_interrupted_consolidation_at(
        &root,
        PreviewConsolidationMergeInput {
            expected_source_sha256: source_sha256.clone(),
            candidate_id: candidate.candidate_id,
            expected_record_ids: candidate.record_ids,
            survivor_record_id: "governed-a".into(),
        },
        "2026-08-20T20:00:00Z".into(),
    )
    .expect("prepare governed recovery fixture");
    let projected_bytes = fs::read(&source_path).unwrap();
    let projected_sha256 = memory_subject_digest(std::str::from_utf8(&projected_bytes).unwrap());

    let pending = consolidation_recovery_status_at(&root);
    assert_eq!(pending.schema_version, 1);
    assert_eq!(
        pending.state,
        ConsolidationRecoveryStatusState::RecoveryRequired
    );
    assert!(pending.receipt_file_exists);
    assert_eq!(pending.transaction_count, 1);
    assert_eq!(
        pending
            .receipt
            .as_ref()
            .map(|receipt| receipt.transaction_id.as_str()),
        Some(transaction_id.as_str())
    );
    assert_eq!(
        pending.source_relation,
        Some(ConsolidationSourceRelation::Projected)
    );
    assert_eq!(
        pending.current_source_sha256.as_deref(),
        Some(projected_sha256.as_str())
    );
    assert!(pending.restoration_available);
    assert!(pending.restoration_requires_confirmation);
    assert!(!pending.automatic_recovery);
    assert!(!pending.merge_execution_available);
    assert!(!pending.records_modified);
    assert!(!pending.files_created);

    let input = RestoreConsolidationTransactionInput {
        transaction_id: transaction_id.clone(),
        expected_source_sha256: source_sha256.clone(),
        expected_projected_source_sha256: projected_sha256.clone(),
        confirmed: true,
    };
    let stale = restore_consolidation_transaction_at(
        &root,
        RestoreConsolidationTransactionInput {
            expected_projected_source_sha256: memory_subject_digest("stale"),
            ..input.clone()
        },
        "2026-08-20T20:03:00Z".into(),
        |_, _, _, _| panic!("stale input must fail before audit"),
    );
    assert!(stale.is_err());
    assert_eq!(fs::read(&source_path).unwrap(), projected_bytes);

    let request_audit_failure = restore_consolidation_transaction_at(
        &root,
        input.clone(),
        "2026-08-20T20:04:00Z".into(),
        |stage, _, _, _| {
            assert_eq!(stage, AuditStage::Request);
            Err("auditoría R3 indisponible".into())
        },
    )
    .unwrap_err();
    assert!(request_audit_failure.contains("auditoría R3 indisponible"));
    assert_eq!(fs::read(&source_path).unwrap(), projected_bytes);

    let mut audit_events = Vec::new();
    let restored = restore_consolidation_transaction_at(
        &root,
        input.clone(),
        "2026-08-20T20:05:00Z".into(),
        |stage, outcome, _, reason| {
            audit_events.push((stage, outcome, reason.to_string()));
            Ok(())
        },
    )
    .expect("governed restore from native status");
    assert_eq!(audit_events.len(), 2);
    assert_eq!(audit_events[0].0, AuditStage::Request);
    assert_eq!(audit_events[0].1, AuditOutcome::Pending);
    assert_eq!(audit_events[1].0, AuditStage::Execution);
    assert_eq!(audit_events[1].1, AuditOutcome::Success);
    assert!(restored.source_restored);
    assert!(restored.audit_written);
    assert!(!restored.already_restored);
    assert_eq!(
        restored.receipt_state,
        ConsolidationTransactionState::Restored
    );
    assert_eq!(
        restored.status.state,
        ConsolidationRecoveryStatusState::Restored
    );
    assert!(!restored.status.restoration_available);
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);
    assert_eq!(fs::read_to_string(&source_path).unwrap(), original);

    let idempotent = restore_consolidation_transaction_at(
        &root,
        input,
        "2026-08-20T20:06:00Z".into(),
        |_, _, _, _| panic!("closed restoration must not audit twice"),
    )
    .expect("idempotent governed restoration");
    assert!(idempotent.already_restored);
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);

    fs::write(consolidation_transaction_path(&root), b"{}").unwrap();
    let blocked = consolidation_recovery_status_at(&root);
    assert_eq!(blocked.state, ConsolidationRecoveryStatusState::Blocked);
    assert!(!blocked.restoration_available);
    assert!(blocked.blocked_reason.is_some());
    assert_eq!(fs::read(&source_path).unwrap(), original_bytes);

    fs::remove_dir_all(root).expect("remove R6.3-F fixture");
}

#[test]
fn r6_3_preview_is_deterministic_and_does_not_compare_different_topics() {
    let root = temporary_probe_root("r6-3-deterministic");
    let first = serde_json::from_value::<MemorySession>(serde_json::json!({
        "id": "memory-z",
        "kind": "Enseñanza",
        "intention": "Tema Z",
        "startedAt": "2026-08-14T10:00:00Z",
        "finishedAt": "2026-08-14T10:01:00Z",
        "summary": "Contenido"
    }))
    .unwrap();
    let second = serde_json::from_value::<MemorySession>(serde_json::json!({
        "id": "memory-a",
        "kind": "Enseñanza",
        "intention": "Tema A",
        "startedAt": "2026-08-14T11:00:00Z",
        "finishedAt": "2026-08-14T11:01:00Z",
        "summary": "Contenido"
    }))
    .unwrap();
    write_layered_fixture(&root, &[first, second]);

    let one = consolidation_preview_at(&root);
    let two = consolidation_preview_at(&root);
    assert_eq!(one, two);
    assert_eq!(one.candidate_count, 0);

    fs::remove_dir_all(root).expect("remove deterministic fixture");
}

#[test]
fn r6_3_preview_reports_missing_and_corrupt_sources_without_creating_files() {
    let missing_root = temporary_probe_root("r6-3-missing");
    let missing = consolidation_preview_at(&missing_root);
    assert_eq!(missing.state, ConsolidationPreviewState::Unavailable);
    assert!(!missing_root.exists());

    let corrupt_root = temporary_probe_root("r6-3-corrupt");
    let memory = corrupt_root.join("memory");
    fs::create_dir_all(&memory).unwrap();
    fs::write(memory.join("records.json"), "not-json").unwrap();
    let before = file_hashes(&corrupt_root);
    let blocked = consolidation_preview_at(&corrupt_root);
    assert_eq!(blocked.state, ConsolidationPreviewState::Blocked);
    assert!(blocked.blocked_reason.is_some());
    assert_eq!(file_hashes(&corrupt_root), before);

    fs::remove_dir_all(corrupt_root).expect("remove corrupt fixture");
}

#[test]
fn r6_3_keep_separate_preserves_records_and_writes_verified_decision() {
    let root = temporary_probe_root("r6-3-keep-separate");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-a",
            "kind": "Enseñanza",
            "intention": "Forma de saludar",
            "startedAt": "2026-08-15T10:00:00Z",
            "finishedAt": "2026-08-15T10:01:00Z",
            "summary": "Alice saluda al entrar.",
            "memoryType": "semantic"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-b",
            "kind": "Enseñanza",
            "intention": "Forma de saludar",
            "startedAt": "2026-08-15T11:00:00Z",
            "finishedAt": "2026-08-15T11:01:00Z",
            "summary": "Alice saluda sólo si hay alguien presente.",
            "memoryType": "semantic"
        }))
        .unwrap(),
    ];
    let source = write_layered_fixture(&root, &records);
    let initial = consolidation_preview_at(&root);
    let candidate = initial.candidates[0].clone();
    let source_sha256 = initial.source_sha256.clone().unwrap();
    let result = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: source_sha256.clone(),
            candidate_id: candidate.candidate_id.clone(),
            expected_record_ids: candidate.record_ids.clone(),
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:00:00Z".into(),
    )
    .expect("record keep-separate decision");

    assert!(result.backup_created);
    assert!(!result.records_modified);
    assert!(!result.model_used);
    assert_eq!(result.preview.pending_candidate_count, 0);
    assert_eq!(result.preview.kept_separate_count, 1);
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).unwrap(),
        source
    );
    assert_eq!(
        fs::read_to_string(&result.source_backup_path).unwrap(),
        source
    );
    let ledger = fs::read_to_string(&result.ledger_path).unwrap();
    assert!(!ledger.contains("Alice saluda al entrar"));
    assert!(ledger.contains("keepSeparate"));
    let audit = fs::read_to_string(
        root.join("memory")
            .join("audit")
            .join("memory-events.jsonl"),
    )
    .unwrap();
    assert!(audit.contains("consolidation-keep-separate"));
    assert!(!audit.contains("Alice saluda"));

    let before_repeat = file_hashes(&root);
    let repeated = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: source_sha256,
            candidate_id: candidate.candidate_id,
            expected_record_ids: candidate.record_ids,
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:05:00Z".into(),
    )
    .expect("idempotent decision");
    assert!(!repeated.backup_created);
    assert_eq!(file_hashes(&root), before_repeat);

    fs::remove_file(&result.source_backup_path).expect("remove controlled source backup");
    let blocked_without_backup = consolidation_preview_at(&root);
    assert_eq!(
        blocked_without_backup.state,
        ConsolidationPreviewState::Blocked
    );
    assert!(blocked_without_backup
        .blocked_reason
        .as_deref()
        .is_some_and(|reason| reason.contains("respaldo canónico")));

    fs::remove_dir_all(root).expect("remove keep-separate fixture");
}

#[test]
fn r6_3_resolution_rejects_stale_or_unknown_candidates_without_writing() {
    let root = temporary_probe_root("r6-3-resolution-rejected");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-a",
            "kind": "Enseñanza",
            "intention": "Tema",
            "startedAt": "2026-08-15T10:00:00Z",
            "finishedAt": "2026-08-15T10:01:00Z",
            "summary": "Uno"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-b",
            "kind": "Enseñanza",
            "intention": "Tema",
            "startedAt": "2026-08-15T11:00:00Z",
            "finishedAt": "2026-08-15T11:01:00Z",
            "summary": "Dos"
        }))
        .unwrap(),
    ];
    write_layered_fixture(&root, &records);
    let preview = consolidation_preview_at(&root);
    let candidate = preview.candidates[0].clone();
    let before = file_hashes(&root);

    let stale = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: format!("sha256:{}", "0".repeat(64)),
            candidate_id: candidate.candidate_id.clone(),
            expected_record_ids: candidate.record_ids.clone(),
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:00:00Z".into(),
    );
    assert!(stale.unwrap_err().contains("cambió"));

    let unknown = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: preview.source_sha256.unwrap(),
            candidate_id: format!("sha256:{}", "f".repeat(64)),
            expected_record_ids: candidate.record_ids,
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:00:00Z".into(),
    );
    assert!(unknown.unwrap_err().contains("ya no existe"));
    assert_eq!(file_hashes(&root), before);

    fs::remove_dir_all(root).expect("remove rejected fixture");
}

#[test]
fn r6_3_resolution_rolls_back_decision_when_audit_is_unavailable() {
    let root = temporary_probe_root("r6-3-audit-rollback");
    let records = vec![
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-a",
            "kind": "Enseñanza",
            "intention": "Tema auditable",
            "startedAt": "2026-08-15T10:00:00Z",
            "finishedAt": "2026-08-15T10:01:00Z",
            "summary": "Uno"
        }))
        .unwrap(),
        serde_json::from_value::<MemorySession>(serde_json::json!({
            "id": "memory-b",
            "kind": "Enseñanza",
            "intention": "Tema auditable",
            "startedAt": "2026-08-15T11:00:00Z",
            "finishedAt": "2026-08-15T11:01:00Z",
            "summary": "Dos"
        }))
        .unwrap(),
    ];
    let source = write_layered_fixture(&root, &records);
    let preview = consolidation_preview_at(&root);
    let candidate = preview.candidates[0].clone();
    fs::write(root.join("memory").join("audit"), "blocked by fixture")
        .expect("create real audit failure");

    let result = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: preview.source_sha256.unwrap(),
            candidate_id: candidate.candidate_id,
            expected_record_ids: candidate.record_ids,
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:00:00Z".into(),
    );

    assert!(result.unwrap_err().contains("registro fue restaurado"));
    assert!(!consolidation_decision_path(&root).exists());
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).unwrap(),
        source
    );
    fs::remove_dir_all(root).expect("remove audit rollback fixture");
}

fn confirmed_learning_fixture() -> ConfirmedLearningAppendInput {
    ConfirmedLearningAppendInput {
        candidate_id: format!("sha256:{}", "a".repeat(64)),
        source_record_id: "legacy-1".into(),
        model: "qwen3.5:4b".into(),
        intention: "Tecnología confirmada".into(),
        summary: "Alice usa una arquitectura local-first.".into(),
        memory_type: "semantic".into(),
        importance: 4,
        confirmed_at: "2026-08-20T23:30:00Z".into(),
    }
}

fn confirmed_conversation_learning_fixture() -> ConfirmedConversationLearningAppendInput {
    ConfirmedConversationLearningAppendInput {
        affects: vec![crate::memory_affect::MemoryAffect {
            emotion: "joy".into(),
            intensity: 0.8,
            evidence: "Me siento feliz".into(),
        }],
        candidate_id: format!("sha256:{}", "b".repeat(64)),
        conversation_exchange_id: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7".into(),
        conversation_source_sha256: format!("sha256:{}", "c".repeat(64)),
        model: "gemma-local".into(),
        intention: "Me siento feliz con este avance".into(),
        summary: "Carlos expresó felicidad por el avance.".into(),
        memory_type: "episodic".into(),
        importance: 4,
        confirmed_at: "2026-09-08T21:30:00Z".into(),
    }
}

#[test]
fn confirmed_conversation_persists_reviewed_affect_once() {
    let root = temporary_probe_root("conversation-affect-confirm");
    let original = write_layered_fixture(&root, &[legacy_memory()]);
    let original_sha256 = memory_subject_digest(&original);

    let first = append_confirmed_conversation_learning_at(
        &root,
        &original_sha256,
        confirmed_conversation_learning_fixture(),
    )
    .expect("confirm conversation memory with affect");
    let stored = fs::read_to_string(root.join("memory").join("records.json"))
        .expect("read confirmed memory");
    let sessions: Vec<MemorySession> =
        serde_json::from_str(&stored).expect("decode confirmed memory");

    assert_eq!(sessions[0].affects.len(), 1);
    assert_eq!(sessions[0].affects[0].emotion, "joy");
    assert_eq!(sessions[0].importance, Some(4));
    assert!(first.audit_written);

    let retry = append_confirmed_conversation_learning_at(
        &root,
        &original_sha256,
        confirmed_conversation_learning_fixture(),
    )
    .expect("idempotent conversation confirmation");
    assert!(retry.already_confirmed);
    let mut changed = confirmed_conversation_learning_fixture();
    changed.affects[0].intensity = 0.4;
    assert!(
        append_confirmed_conversation_learning_at(&root, &original_sha256, changed)
            .unwrap_err()
            .contains("otro contenido")
    );
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).unwrap(),
        stored
    );
    fs::remove_dir_all(root).expect("remove conversation affect fixture");
}

#[test]
fn r6_4_c_appends_once_with_exact_backup_and_audit() {
    let root = temporary_probe_root("r6-4-c-confirm");
    let original = write_layered_fixture(&root, &[legacy_memory()]);
    let original_sha256 = memory_subject_digest(&original);

    let first = append_confirmed_learning_at(&root, &original_sha256, confirmed_learning_fixture())
        .expect("confirm learning candidate");
    let stored = fs::read_to_string(root.join("memory").join("records.json"))
        .expect("read confirmed memory");
    let backup = fs::read_to_string(
        root.join("memory")
            .join("backups")
            .join("records.backup.json"),
    )
    .expect("read exact backup");
    let sessions: Vec<MemorySession> =
        serde_json::from_str(&stored).expect("decode confirmed memory");

    assert_eq!(first.record_count, 2);
    assert!(!first.already_confirmed);
    assert!(first.audit_written);
    assert_eq!(backup, original);
    assert_eq!(first.backup_sha256, original_sha256);
    assert_eq!(first.source_sha256, memory_subject_digest(&stored));
    assert_eq!(sessions[0].id, first.record_id);
    assert_eq!(sessions[0].kind, "Enseñanza");
    assert_eq!(sessions[0].memory_status.as_deref(), Some("confirmed"));
    assert!(root
        .join("memory")
        .join("audit")
        .join("memory-events.jsonl")
        .is_file());

    let retry = append_confirmed_learning_at(&root, &original_sha256, confirmed_learning_fixture())
        .expect("idempotent retry");
    assert!(retry.already_confirmed);
    assert!(!retry.audit_written);
    assert_eq!(retry.record_id, first.record_id);
    assert_eq!(retry.record_count, 2);
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).unwrap(),
        stored
    );
    fs::remove_dir_all(root).expect("remove confirmation fixture");
}

#[test]
fn r6_4_c_rejects_stale_source_without_writing() {
    let root = temporary_probe_root("r6-4-c-stale");
    write_layered_fixture(&root, &[legacy_memory()]);
    let before = file_hashes(&root);
    let result = append_confirmed_learning_at(
        &root,
        &format!("sha256:{}", "f".repeat(64)),
        confirmed_learning_fixture(),
    );

    assert!(result.unwrap_err().contains("cambió"));
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove stale fixture");
}

#[test]
fn r6_4_c_rejects_changed_retry_without_writing() {
    let root = temporary_probe_root("r6-4-c-changed-retry");
    let original = write_layered_fixture(&root, &[legacy_memory()]);
    let original_sha256 = memory_subject_digest(&original);
    append_confirmed_learning_at(&root, &original_sha256, confirmed_learning_fixture())
        .expect("initial confirmation");
    let before = file_hashes(&root);
    let mut changed = confirmed_learning_fixture();
    changed.summary = "Contenido cambiado después de confirmar.".into();

    let result = append_confirmed_learning_at(&root, &original_sha256, changed);

    assert!(result.unwrap_err().contains("otro contenido"));
    assert_eq!(file_hashes(&root), before);
    fs::remove_dir_all(root).expect("remove changed retry fixture");
}

#[test]
fn r6_4_c_restores_source_when_memory_audit_fails() {
    let root = temporary_probe_root("r6-4-c-audit-rollback");
    let original = write_layered_fixture(&root, &[legacy_memory()]);
    fs::write(root.join("memory").join("audit"), "blocked by fixture")
        .expect("block memory audit directory");

    let result = append_confirmed_learning_at(
        &root,
        &memory_subject_digest(&original),
        confirmed_learning_fixture(),
    );

    assert!(result.unwrap_err().contains("fue restaurado"));
    assert_eq!(
        fs::read_to_string(root.join("memory").join("records.json")).unwrap(),
        original
    );
    fs::remove_dir_all(root).expect("remove audit failure fixture");
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_r6_3_preview_is_read_only() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let before = file_hashes(&root);
    let snapshot = consolidation_preview_at(&root);
    let after = file_hashes(&root);

    assert_eq!(after, before);
    assert_ne!(snapshot.state, ConsolidationPreviewState::Blocked);
    assert!(!snapshot.automatic_merge);
    assert!(!snapshot.records_modified);
    assert!(!snapshot.model_used);
    eprintln!(
        "R6_3_CANONICAL records={} eligible={} exact={} review={} filesIntact={}",
        snapshot.record_count,
        snapshot.eligible_record_count,
        snapshot.exact_duplicate_count,
        snapshot.review_required_count,
        before.len()
    );
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_r6_3_f_recovery_status_is_read_only() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let before = file_hashes(&root);
    let status = consolidation_recovery_status_at(&root);
    let after = file_hashes(&root);

    assert_eq!(after, before);
    assert!(!status.automatic_recovery);
    assert!(!status.merge_execution_available);
    assert!(!status.records_modified);
    assert!(!status.files_created);
    eprintln!(
        "R6_3F_CANONICAL state={:?} transactions={} receiptExists={} restorationAvailable={} filesIntact={}",
        status.state,
        status.transaction_count,
        status.receipt_file_exists,
        status.restoration_available,
        before.len()
    );
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_r6_3_resolution_rejects_unknown_candidate_without_writing() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let preview = consolidation_preview_at(&root);
    let source_sha256 = preview
        .source_sha256
        .clone()
        .expect("fuente canónica disponible");
    let before = file_hashes(&root);
    let rejected = resolve_consolidation_candidate_at(
        &root,
        ResolveConsolidationCandidateInput {
            expected_source_sha256: source_sha256,
            candidate_id: format!("sha256:{}", "0".repeat(64)),
            expected_record_ids: vec!["unknown-a".into(), "unknown-b".into()],
            action: ConsolidationResolutionAction::KeepSeparate,
            confirmed: true,
        },
        "2026-08-15T15:00:00Z".into(),
    );
    let after = file_hashes(&root);

    assert!(rejected.unwrap_err().contains("ya no existe"));
    assert_eq!(after, before);
    eprintln!(
        "R6_3B_CANONICAL rejectedUnknown=true filesIntact={}",
        before.len()
    );
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
fn live_canonical_r6_4_c_rejects_stale_confirmation_without_writing() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let source = read_validated_source_at(&root)
        .expect("leer memoria canónica")
        .expect("records.json canónico disponible");
    let source_record_id = source
        .1
        .iter()
        .find(|record| record.memory_status.as_deref() != Some("archived"))
        .map(|record| record.id.clone())
        .expect("al menos un recuerdo canónico activo");
    let before = file_hashes(&root);
    let rejected = append_confirmed_learning_at(
        &root,
        &format!("sha256:{}", "0".repeat(64)),
        ConfirmedLearningAppendInput {
            source_record_id,
            ..confirmed_learning_fixture()
        },
    );
    let after = file_hashes(&root);

    assert!(rejected.unwrap_err().contains("cambió"));
    assert_eq!(after, before);
    eprintln!(
        "R6_4C_CANONICAL staleRejected=true filesIntact={}",
        before.len()
    );
}

#[test]
#[ignore = "requiere ALICE_LIVE_DATA_DIR; sólo lee records.json y el catálogo Markdown"]
fn live_modular_memory_reads_preserve_canonical_files() {
    let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
        .map(PathBuf::from)
        .expect("ALICE_LIVE_DATA_DIR requerido");
    let before = file_hashes(&root);
    let snapshot = super::queries::load_memory_at(&root.join("memory/records.json")).unwrap();
    assert!(snapshot.existed);
    let catalog = super::queries::markdown_note_catalog_at(&root.join("memory")).unwrap();
    assert_eq!(catalog.note_count, catalog.notes.len());
    assert_eq!(before, file_hashes(&root));
    println!(
        "canonical reads: records={}, markdown={}, unchanged=true",
        snapshot.sessions.len(),
        catalog.note_count
    );
}
