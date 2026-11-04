//! Layered lifecycle activation, rollback and previews.
use super::model::{
    ActivateMemoryLifecycleInput, MemoryAccessibilityState, MemoryLifecycleDocument,
    MemoryLifecyclePreview, MemoryLifecyclePreviewSnapshot, MemoryLifecyclePreviewState,
    MemoryLifecycleReference, MemoryLifecycleRevision, MemoryLifecycleSource, MemoryRetentionState,
    MemoryRetrievalPolicy, MemorySession, MemoryValidityState, MemoryWeakeningAssessment,
    MemoryWeakeningAssessmentState, RollbackMemoryLifecycleInput,
};
use super::storage::{
    append_memory_audit, atomic_replace_text_file, memory_subject_digest, read_validated_source_at,
};
use super::validation::{is_sha256, validate_memory_lifecycle_document};
use super::{MEMORY_LIFECYCLE_FILE, MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION};
use crate::capabilities::validate_timestamp;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(super) fn lifecycle_reference(
    session: &MemorySession,
) -> Result<MemoryLifecycleReference, String> {
    let validity = match session.memory_status.as_deref() {
        Some("confirmed") => MemoryValidityState::Current,
        Some("conflict") => MemoryValidityState::Conflict,
        Some("archived") => MemoryValidityState::Archived,
        None => MemoryValidityState::NotAssessed,
        Some(_) => return Err("records.json contiene un estado de memoria no soportado".into()),
    };
    let accessibility = match session.accessibility_status.as_deref() {
        Some("accessible") => MemoryAccessibilityState::Accessible,
        Some("dormant") => MemoryAccessibilityState::Dormant,
        None => MemoryAccessibilityState::NotAssessed,
        Some(_) => return Err("records.json contiene una accesibilidad no soportada".into()),
    };
    let suppressed = match session.suppression_status.as_deref() {
        Some("suppressed") => true,
        None => false,
        Some(_) => return Err("records.json contiene una supresión no soportada".into()),
    };
    let archived = session.archive_status.as_deref() == Some("archived")
        || validity == MemoryValidityState::Archived;
    let retrieval_policy = match validity {
        _ if archived => MemoryRetrievalPolicy::BlockedByArchive,
        MemoryValidityState::Conflict => MemoryRetrievalPolicy::BlockedByConflict,
        MemoryValidityState::Current | MemoryValidityState::NotAssessed if suppressed => {
            MemoryRetrievalPolicy::BlockedBySuppression
        }
        MemoryValidityState::Current | MemoryValidityState::NotAssessed
            if accessibility == MemoryAccessibilityState::Dormant =>
        {
            MemoryRetrievalPolicy::BlockedByDormancy
        }
        MemoryValidityState::Current => MemoryRetrievalPolicy::Eligible,
        MemoryValidityState::NotAssessed => MemoryRetrievalPolicy::LegacyEligible,
        MemoryValidityState::Archived => MemoryRetrievalPolicy::BlockedByArchive,
    };
    let serialized = serde_json::to_string(session)
        .map_err(|error| format!("No se pudo calcular la huella del recuerdo: {error}"))?;
    let reconsolidation_count = session.memory_version.unwrap_or(1).saturating_sub(1);
    Ok(MemoryLifecycleReference {
        record_id: session.id.clone(),
        record_sha256: memory_subject_digest(&serialized),
        validity,
        accessibility,
        retrieval_policy,
        retention: if session.deletion_status.as_deref() == Some("scheduled") {
            MemoryRetentionState::DeletionScheduled
        } else {
            MemoryRetentionState::NotAssessed
        },
        suppressed,
        archived,
        base_version: 1,
        reconsolidation_count,
    })
}

pub(super) fn lifecycle_revision(
    source_content: &str,
    sessions: &[MemorySession],
    created_at: String,
) -> Result<MemoryLifecycleRevision, String> {
    let source_sha256 = memory_subject_digest(source_content);
    let references = sessions
        .iter()
        .map(lifecycle_reference)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(MemoryLifecycleRevision {
        revision_id: memory_subject_digest(&format!(
            "alice-memory-lifecycle:{}:{source_sha256}",
            MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION
        )),
        created_at,
        source: MemoryLifecycleSource {
            records_file: "records.json".into(),
            sha256: source_sha256,
            record_count: references.len(),
        },
        references,
    })
}

pub(super) fn lifecycle_preview(
    revision: &MemoryLifecycleRevision,
    sessions: &[MemorySession],
) -> MemoryLifecyclePreview {
    let current_count = revision
        .references
        .iter()
        .filter(|item| item.validity == MemoryValidityState::Current)
        .count();
    let conflict_count = revision
        .references
        .iter()
        .filter(|item| item.validity == MemoryValidityState::Conflict)
        .count();
    let archived_count = revision
        .references
        .iter()
        .filter(|item| item.archived)
        .count();
    let not_assessed_count = revision
        .references
        .iter()
        .filter(|item| item.validity == MemoryValidityState::NotAssessed)
        .count();
    let accessible_count = revision
        .references
        .iter()
        .filter(|item| item.accessibility == MemoryAccessibilityState::Accessible)
        .count();
    let dormant_count = revision
        .references
        .iter()
        .filter(|item| item.accessibility == MemoryAccessibilityState::Dormant)
        .count();
    let retrieval_eligible_count = revision
        .references
        .iter()
        .filter(|item| {
            matches!(
                item.retrieval_policy,
                MemoryRetrievalPolicy::Eligible | MemoryRetrievalPolicy::LegacyEligible
            )
        })
        .count();
    let record_count = revision.references.len();
    let suppressed_count = revision
        .references
        .iter()
        .filter(|item| item.suppressed)
        .count();
    let reconsolidated_count = revision
        .references
        .iter()
        .filter(|reference| reference.reconsolidation_count > 0)
        .count();
    let weakening_assessments = sessions
        .iter()
        .map(|session| {
            let evidence_is_explicit = session.retrieval_evidence_version == Some(1);
            let helpful_outcomes = if evidence_is_explicit {
                session.successful_recalls
            } else {
                0
            };
            let not_helpful_outcomes = if evidence_is_explicit {
                session.failed_recalls
            } else {
                0
            };
            let evidence_count = helpful_outcomes.saturating_add(not_helpful_outcomes);
            let state = if !evidence_is_explicit || evidence_count == 0 {
                MemoryWeakeningAssessmentState::NotAssessed
            } else if evidence_count < 3 {
                MemoryWeakeningAssessmentState::InsufficientEvidence
            } else if not_helpful_outcomes >= 2
                && not_helpful_outcomes.saturating_mul(3) >= evidence_count.saturating_mul(2)
            {
                MemoryWeakeningAssessmentState::ReviewRequired
            } else {
                MemoryWeakeningAssessmentState::NoWeakeningSignal
            };
            MemoryWeakeningAssessment {
                record_id: session.id.clone(),
                helpful_outcomes,
                not_helpful_outcomes,
                evidence_count,
                state,
                automatic_action: false,
            }
        })
        .collect::<Vec<_>>();
    let retrieval_outcome_count = weakening_assessments
        .iter()
        .fold(0_u32, |total, assessment| {
            total.saturating_add(assessment.evidence_count)
        });
    let functional_assessment_count = weakening_assessments
        .iter()
        .filter(|assessment| {
            matches!(
                assessment.state,
                MemoryWeakeningAssessmentState::NoWeakeningSignal
                    | MemoryWeakeningAssessmentState::ReviewRequired
            )
        })
        .count();
    let weakening_review_required_count = weakening_assessments
        .iter()
        .filter(|assessment| assessment.state == MemoryWeakeningAssessmentState::ReviewRequired)
        .count();
    MemoryLifecyclePreview {
        source_sha256: revision.source.sha256.clone(),
        record_count,
        current_count,
        conflict_count,
        archived_count,
        not_assessed_count,
        accessibility_assessed_count: accessible_count + dormant_count,
        accessible_count,
        dormant_count,
        retrieval_eligible_count,
        retrieval_blocked_count: record_count.saturating_sub(retrieval_eligible_count),
        retrieval_outcome_count,
        functional_assessment_count,
        weakening_review_required_count,
        retention_assessed_count: revision
            .references
            .iter()
            .filter(|reference| reference.retention == MemoryRetentionState::DeletionScheduled)
            .count(),
        suppressed_count,
        reconsolidated_count,
        references: revision.references.clone(),
        weakening_assessments,
        records_modified: false,
        content_copied: false,
        automatic_inference: false,
    }
}

pub(super) fn memory_lifecycle_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(MEMORY_LIFECYCLE_FILE)
}

pub(super) fn read_memory_lifecycle_document_at(
    data_root: &Path,
) -> Result<Option<MemoryLifecycleDocument>, String> {
    let path = memory_lifecycle_path(data_root);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("No se pudo leer {MEMORY_LIFECYCLE_FILE}: {error}")),
    };
    let document = serde_json::from_str::<MemoryLifecycleDocument>(&content)
        .map_err(|error| format!("{MEMORY_LIFECYCLE_FILE} no es válido: {error}"))?;
    validate_memory_lifecycle_document(&document)?;
    Ok(Some(document))
}

pub(super) fn blocked_memory_lifecycle_snapshot(
    storage_path: String,
    source_sha256: Option<String>,
    revision_count: usize,
    reason: String,
) -> MemoryLifecyclePreviewSnapshot {
    MemoryLifecyclePreviewSnapshot {
        schema_version: MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
        state: MemoryLifecyclePreviewState::Blocked,
        storage_path,
        source_sha256,
        active_revision_id: None,
        revision_count,
        preview: None,
        blocked_reason: Some(reason),
        migration_requires_confirmation: true,
        lifecycle_writes_available: false,
        records_modified: false,
    }
}

pub(super) fn memory_lifecycle_preview_at(data_root: &Path) -> MemoryLifecyclePreviewSnapshot {
    let storage_path = memory_lifecycle_path(data_root).display().to_string();
    let source = match read_validated_source_at(data_root) {
        Ok(Some(source)) => source,
        Ok(None) => {
            return MemoryLifecyclePreviewSnapshot {
                schema_version: MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
                state: MemoryLifecyclePreviewState::Unavailable,
                storage_path,
                source_sha256: None,
                active_revision_id: None,
                revision_count: 0,
                preview: None,
                blocked_reason: None,
                migration_requires_confirmation: true,
                lifecycle_writes_available: false,
                records_modified: false,
            }
        }
        Err(error) => return blocked_memory_lifecycle_snapshot(storage_path, None, 0, error),
    };
    let source_sha256 = memory_subject_digest(&source.0);
    let projected_revision =
        match lifecycle_revision(&source.0, &source.1, "1970-01-01T00:00:00Z".into()) {
            Ok(revision) => revision,
            Err(error) => {
                return blocked_memory_lifecycle_snapshot(
                    storage_path,
                    Some(source_sha256),
                    0,
                    error,
                )
            }
        };
    let preview = lifecycle_preview(&projected_revision, &source.1);
    let document = match read_memory_lifecycle_document_at(data_root) {
        Ok(document) => document,
        Err(error) => {
            return blocked_memory_lifecycle_snapshot(storage_path, Some(source_sha256), 0, error)
        }
    };
    let Some(document) = document else {
        return MemoryLifecyclePreviewSnapshot {
            schema_version: MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
            state: MemoryLifecyclePreviewState::Ready,
            storage_path,
            source_sha256: Some(source_sha256),
            active_revision_id: None,
            revision_count: 0,
            preview: Some(preview),
            blocked_reason: None,
            migration_requires_confirmation: true,
            lifecycle_writes_available: true,
            records_modified: false,
        };
    };
    if document
        .revisions
        .iter()
        .find(|revision| revision.source.sha256 == source_sha256)
        .is_some_and(|revision| revision.references != projected_revision.references)
    {
        return blocked_memory_lifecycle_snapshot(
            storage_path,
            Some(source_sha256),
            document.revisions.len(),
            "La revisión durable no coincide con la proyección determinista de records.json".into(),
        );
    }
    let matching_revision = document
        .revisions
        .iter()
        .find(|revision| revision.source.sha256 == source_sha256);
    let state = match (&document.active_revision_id, matching_revision) {
        (Some(active), Some(revision)) if active == &revision.revision_id => {
            MemoryLifecyclePreviewState::Active
        }
        (None, Some(_)) => MemoryLifecyclePreviewState::RolledBack,
        (Some(_), _) => MemoryLifecyclePreviewState::SourceChanged,
        (None, None) => MemoryLifecyclePreviewState::Ready,
    };
    MemoryLifecyclePreviewSnapshot {
        schema_version: MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
        state,
        storage_path,
        source_sha256: Some(source_sha256),
        active_revision_id: document.active_revision_id,
        revision_count: document.revisions.len(),
        preview: Some(preview),
        blocked_reason: None,
        migration_requires_confirmation: true,
        lifecycle_writes_available: true,
        records_modified: false,
    }
}

pub(super) fn lifecycle_revision_matches(
    stored: &MemoryLifecycleRevision,
    expected: &MemoryLifecycleRevision,
) -> bool {
    stored.revision_id == expected.revision_id
        && stored.source == expected.source
        && stored.references == expected.references
}

pub(super) fn rollback_lifecycle_index(path: &Path, previous: Option<&str>) -> Result<(), String> {
    match previous {
        Some(content) => atomic_replace_text_file(
            path,
            content,
            "lifecycle-rollback.tmp",
            "restauración de lifecycle-index-v1.json",
        ),
        None => match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!(
                "No se pudo retirar lifecycle-index-v1.json después del fallo: {error}"
            )),
        },
    }
}

pub(super) fn write_memory_lifecycle_document_at(
    data_root: &Path,
    document: &MemoryLifecycleDocument,
) -> Result<(), String> {
    validate_memory_lifecycle_document(document)?;
    let path = memory_lifecycle_path(data_root);
    let memory = data_root.join("memory");
    let backups = memory.join("backups");
    fs::create_dir_all(&backups)
        .map_err(|error| format!("No se pudo crear memory/backups: {error}"))?;
    let previous = match fs::read_to_string(&path) {
        Ok(content) => Some(content),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return Err(format!(
                "No se pudo leer el índice anterior antes de reemplazarlo: {error}"
            ))
        }
    };
    if let Some(previous_content) = previous.as_deref() {
        let previous_sha256 = memory_subject_digest(previous_content);
        let backup = backups.join(format!("lifecycle-index-v1-{}.json", &previous_sha256[7..]));
        if backup.exists() {
            let stored = fs::read_to_string(&backup)
                .map_err(|error| format!("No se pudo verificar el respaldo del ciclo: {error}"))?;
            if stored != previous_content {
                return Err("El respaldo existente del ciclo no coincide con el índice".into());
            }
        } else {
            fs::write(&backup, previous_content)
                .map_err(|error| format!("No se pudo respaldar el índice del ciclo: {error}"))?;
            let stored = fs::read_to_string(&backup)
                .map_err(|error| format!("No se pudo releer el respaldo del ciclo: {error}"))?;
            if stored != previous_content {
                return Err("El respaldo nuevo del ciclo no coincide byte a byte".into());
            }
        }
    }
    let content = serde_json::to_string_pretty(document)
        .map_err(|error| format!("No se pudo serializar el índice del ciclo: {error}"))?;
    atomic_replace_text_file(
        &path,
        &content,
        "lifecycle-v1.tmp",
        "lifecycle-index-v1.json",
    )?;
    let stored = read_memory_lifecycle_document_at(data_root)?
        .ok_or("El índice del ciclo desapareció después de guardarlo")?;
    if stored != *document {
        rollback_lifecycle_index(&path, previous.as_deref())?;
        return Err("El índice del ciclo cambió al releerlo y fue restaurado".into());
    }
    if let Err(audit_error) = append_memory_audit(
        &path,
        "lifecycle-index-update",
        document.revisions.len(),
        &content,
    ) {
        if let Err(rollback_error) = rollback_lifecycle_index(&path, previous.as_deref()) {
            return Err(format!(
                "Falló la auditoría del ciclo ({audit_error}) y también la restauración ({rollback_error})"
            ));
        }
        return Err(format!(
            "Falló la auditoría del ciclo y el índice fue restaurado: {audit_error}"
        ));
    }
    Ok(())
}

pub(super) fn activate_memory_lifecycle_at(
    data_root: &Path,
    input: ActivateMemoryLifecycleInput,
    now: String,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    if !input.confirmed {
        return Err("La activación del ciclo requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) {
        return Err("La huella esperada de records.json no es válida".into());
    }
    validate_timestamp("createdAt", &now)?;
    let (source_content, sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para activar el ciclo")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256 {
        return Err(
            "records.json cambió después de la vista previa; actualizá y revisá otra vez".into(),
        );
    }
    let revision = lifecycle_revision(&source_content, &sessions, now)?;
    let revision_id = revision.revision_id.clone();
    let mut document =
        read_memory_lifecycle_document_at(data_root)?.unwrap_or(MemoryLifecycleDocument {
            schema_version: MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
            active_revision_id: None,
            revisions: Vec::new(),
        });
    if let Some(stored) = document
        .revisions
        .iter()
        .find(|stored| stored.revision_id == revision_id)
    {
        if !lifecycle_revision_matches(stored, &revision) {
            return Err("La revisión durable del ciclo fue alterada".into());
        }
    } else {
        document.revisions.push(revision);
    }
    if document.active_revision_id.as_deref() == Some(revision_id.as_str()) {
        return Ok(memory_lifecycle_preview_at(data_root));
    }
    document.active_revision_id = Some(revision_id);
    write_memory_lifecycle_document_at(data_root, &document)?;
    let snapshot = memory_lifecycle_preview_at(data_root);
    if snapshot.state != MemoryLifecyclePreviewState::Active {
        return Err("El ciclo se escribió pero no quedó activo al releerlo".into());
    }
    Ok(snapshot)
}

pub(super) fn rollback_memory_lifecycle_at(
    data_root: &Path,
    input: RollbackMemoryLifecycleInput,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    if !input.confirmed {
        return Err("La reversión del ciclo requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_revision_id) {
        return Err("El ID esperado de la revisión del ciclo no es válido".into());
    }
    let mut document = read_memory_lifecycle_document_at(data_root)?
        .ok_or("Todavía no existe un índice del ciclo para revertir")?;
    if document.active_revision_id.as_deref() != Some(input.expected_revision_id.as_str()) {
        return Err("La revisión activa cambió; actualizá antes de revertir".into());
    }
    document.active_revision_id = None;
    write_memory_lifecycle_document_at(data_root, &document)?;
    let snapshot = memory_lifecycle_preview_at(data_root);
    if snapshot.state != MemoryLifecyclePreviewState::RolledBack {
        return Err("El índice del ciclo no quedó revertido al releerlo".into());
    }
    Ok(snapshot)
}
