use super::model::{
    ActivateLayeredMemoryInput, LayeredMemoryDocument, LayeredMemoryLayers, LayeredMemoryPreview,
    LayeredMemoryReference, LayeredMemoryRevision, LayeredMemorySnapshot, LayeredMemorySource,
    LayeredMemoryState, LayeredProceduralMemoryReference, MemorySession, ProceduralMemoryLinkState,
    RollbackLayeredMemoryInput, UnclassifiedMemoryReason, UnclassifiedMemoryReference,
};
use super::storage::{append_memory_audit, memory_subject_digest, read_validated_source_at};
use super::validation::{is_sha256, validate_layered_document};
use super::LAYERED_MEMORY_FILE;
use super::LAYERED_MEMORY_SCHEMA_VERSION;
use crate::capabilities::validate_timestamp;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(super) fn classify_layered_memory(
    source_content: &str,
    sessions: &[MemorySession],
    created_at: String,
) -> LayeredMemoryRevision {
    let source_sha256 = memory_subject_digest(source_content);
    let revision_id = memory_subject_digest(&format!(
        "alice-layered-memory:{}:{source_sha256}",
        LAYERED_MEMORY_SCHEMA_VERSION
    ));
    let mut episodic = Vec::new();
    let mut taught_facts = Vec::new();
    let mut procedural = Vec::new();
    let mut unclassified = Vec::new();

    for session in sessions {
        let reference = LayeredMemoryReference {
            record_id: session.id.clone(),
        };
        if session.kind == "Conversación" || session.memory_type.as_deref() == Some("episodic") {
            episodic.push(reference);
        } else if session.kind == "Enseñanza" && session.memory_type.as_deref() == Some("semantic")
        {
            taught_facts.push(reference);
        } else if session.memory_type.as_deref() == Some("procedural") {
            procedural.push(LayeredProceduralMemoryReference {
                record_id: reference.record_id,
                link_state: ProceduralMemoryLinkState::PendingR5,
            });
        } else {
            let reason = match session.memory_type.as_deref() {
                Some("preference") => UnclassifiedMemoryReason::PreferenceNeedsOwnLayer,
                None => UnclassifiedMemoryReason::MissingExplicitType,
                Some(_) => UnclassifiedMemoryReason::UnsupportedExplicitType,
            };
            unclassified.push(UnclassifiedMemoryReference {
                record_id: session.id.clone(),
                reason,
            });
        }
    }

    LayeredMemoryRevision {
        revision_id,
        created_at,
        source: LayeredMemorySource {
            records_file: "records.json".into(),
            sha256: source_sha256,
            record_count: sessions.len(),
        },
        layers: LayeredMemoryLayers {
            working: Vec::new(),
            episodic,
            taught_facts,
            procedural,
        },
        unclassified,
    }
}

pub(super) fn layered_preview(revision: &LayeredMemoryRevision) -> LayeredMemoryPreview {
    LayeredMemoryPreview {
        source_sha256: revision.source.sha256.clone(),
        record_count: revision.source.record_count,
        working_count: revision.layers.working.len(),
        episodic_count: revision.layers.episodic.len(),
        taught_fact_count: revision.layers.taught_facts.len(),
        procedural_count: revision.layers.procedural.len(),
        unclassified_count: revision.unclassified.len(),
        procedural_pending_count: revision
            .layers
            .procedural
            .iter()
            .filter(|item| item.link_state == ProceduralMemoryLinkState::PendingR5)
            .count(),
        preference_pending_count: revision
            .unclassified
            .iter()
            .filter(|item| item.reason == UnclassifiedMemoryReason::PreferenceNeedsOwnLayer)
            .count(),
        content_copied: false,
        automatic_classification: false,
    }
}

pub(super) fn revision_matches_projection(
    stored: &LayeredMemoryRevision,
    expected: &LayeredMemoryRevision,
) -> bool {
    stored.revision_id == expected.revision_id
        && stored.source == expected.source
        && stored.layers == expected.layers
        && stored.unclassified == expected.unclassified
}

pub(super) fn read_layered_document_at(
    data_root: &Path,
) -> Result<Option<LayeredMemoryDocument>, String> {
    let path = layered_memory_path(data_root);
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("No se pudo leer {LAYERED_MEMORY_FILE}: {error}")),
    };
    let document = serde_json::from_str::<LayeredMemoryDocument>(&content)
        .map_err(|error| format!("{LAYERED_MEMORY_FILE} no es válido: {error}"))?;
    validate_layered_document(&document)?;
    Ok(Some(document))
}

pub(super) fn layered_memory_status_at(data_root: &Path) -> LayeredMemorySnapshot {
    let storage_path = layered_memory_path(data_root).display().to_string();
    let source = match read_validated_source_at(data_root) {
        Ok(Some(source)) => source,
        Ok(None) => {
            return LayeredMemorySnapshot {
                schema_version: LAYERED_MEMORY_SCHEMA_VERSION,
                state: LayeredMemoryState::Unavailable,
                storage_path,
                source_sha256: None,
                active_revision_id: None,
                revision_count: 0,
                preview: None,
                blocked_reason: None,
                migration_requires_confirmation: true,
                automatic_migration: false,
                content_copied: false,
            }
        }
        Err(error) => {
            return blocked_layered_snapshot(storage_path, None, 0, error);
        }
    };
    let source_sha256 = memory_subject_digest(&source.0);
    let preview_revision =
        classify_layered_memory(&source.0, &source.1, "1970-01-01T00:00:00Z".into());
    let preview = layered_preview(&preview_revision);
    let document = match read_layered_document_at(data_root) {
        Ok(document) => document,
        Err(error) => {
            return blocked_layered_snapshot(storage_path, Some(source_sha256), 0, error);
        }
    };
    let Some(document) = document else {
        return LayeredMemorySnapshot {
            schema_version: LAYERED_MEMORY_SCHEMA_VERSION,
            state: LayeredMemoryState::Ready,
            storage_path,
            source_sha256: Some(source_sha256),
            active_revision_id: None,
            revision_count: 0,
            preview: Some(preview),
            blocked_reason: None,
            migration_requires_confirmation: true,
            automatic_migration: false,
            content_copied: false,
        };
    };
    if document
        .revisions
        .iter()
        .find(|revision| revision.source.sha256 == source_sha256)
        .is_some_and(|revision| !revision_matches_projection(revision, &preview_revision))
    {
        return blocked_layered_snapshot(
            storage_path,
            Some(source_sha256),
            document.revisions.len(),
            "La revisión R6 no coincide con la proyección determinista de records.json".into(),
        );
    }
    let matching_revision = document
        .revisions
        .iter()
        .find(|revision| revision.source.sha256 == source_sha256);
    let state = match (&document.active_revision_id, matching_revision) {
        (Some(active), Some(revision)) if active == &revision.revision_id => {
            LayeredMemoryState::Active
        }
        (None, Some(_)) => LayeredMemoryState::RolledBack,
        (Some(_), _) => LayeredMemoryState::SourceChanged,
        (None, None) => LayeredMemoryState::Ready,
    };
    LayeredMemorySnapshot {
        schema_version: LAYERED_MEMORY_SCHEMA_VERSION,
        state,
        storage_path,
        source_sha256: Some(source_sha256),
        active_revision_id: document.active_revision_id,
        revision_count: document.revisions.len(),
        preview: Some(preview),
        blocked_reason: None,
        migration_requires_confirmation: true,
        automatic_migration: false,
        content_copied: false,
    }
}

pub(super) fn blocked_layered_snapshot(
    storage_path: String,
    source_sha256: Option<String>,
    revision_count: usize,
    reason: String,
) -> LayeredMemorySnapshot {
    LayeredMemorySnapshot {
        schema_version: LAYERED_MEMORY_SCHEMA_VERSION,
        state: LayeredMemoryState::Blocked,
        storage_path,
        source_sha256,
        active_revision_id: None,
        revision_count,
        preview: None,
        blocked_reason: Some(reason),
        migration_requires_confirmation: true,
        automatic_migration: false,
        content_copied: false,
    }
}

pub(super) fn write_layered_document_at(
    data_root: &Path,
    document: &LayeredMemoryDocument,
) -> Result<(), String> {
    validate_layered_document(document)?;
    let memory = data_root.join("memory");
    let backups = memory.join("backups");
    fs::create_dir_all(&backups)
        .map_err(|error| format!("No se pudo crear memory/backups: {error}"))?;
    let path = layered_memory_path(data_root);
    if path.exists() {
        fs::copy(&path, backups.join("layer-index-v3.backup.json"))
            .map_err(|error| format!("No se pudo respaldar el índice R6: {error}"))?;
    }
    let content = serde_json::to_string_pretty(document).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, &content)
        .map_err(|error| format!("No se pudo preparar el índice R6: {error}"))?;
    fs::copy(&temporary, &path)
        .map_err(|error| format!("No se pudo guardar el índice R6: {error}"))?;
    fs::remove_file(&temporary)
        .map_err(|error| format!("No se pudo limpiar el temporal R6: {error}"))?;
    append_memory_audit(
        &path,
        "layer-index-update",
        document.revisions.len(),
        &content,
    )
}

pub(super) fn activate_layered_memory_at(
    data_root: &Path,
    input: ActivateLayeredMemoryInput,
    now: String,
) -> Result<LayeredMemorySnapshot, String> {
    if !input.confirmed {
        return Err("La migración R6.1 requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) {
        return Err("La huella esperada de records.json no es válida".into());
    }
    validate_timestamp("createdAt", &now)?;
    let (source_content, sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para proyectar en capas")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256 {
        return Err(
            "records.json cambió después de la vista previa; actualizá y revisá otra vez".into(),
        );
    }
    let revision = classify_layered_memory(&source_content, &sessions, now);
    let mut document = read_layered_document_at(data_root)?.unwrap_or(LayeredMemoryDocument {
        schema_version: LAYERED_MEMORY_SCHEMA_VERSION,
        active_revision_id: None,
        revisions: Vec::new(),
    });
    let revision_id = revision.revision_id.clone();
    if let Some(stored) = document
        .revisions
        .iter()
        .find(|stored| stored.revision_id == revision_id)
    {
        if !revision_matches_projection(stored, &revision) {
            return Err("La revisión R6 existente fue alterada y no puede activarse".into());
        }
    } else {
        document.revisions.push(revision);
    }
    document.active_revision_id = Some(revision_id);
    write_layered_document_at(data_root, &document)?;
    Ok(layered_memory_status_at(data_root))
}

pub(super) fn rollback_layered_memory_at(
    data_root: &Path,
    input: RollbackLayeredMemoryInput,
) -> Result<LayeredMemorySnapshot, String> {
    if !input.confirmed {
        return Err("La reversión R6.1 requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_revision_id) {
        return Err("El ID esperado de la revisión R6 no es válido".into());
    }
    let mut document = read_layered_document_at(data_root)?
        .ok_or("Todavía no existe una proyección R6 para revertir")?;
    if document.active_revision_id.as_deref() != Some(input.expected_revision_id.as_str()) {
        return Err("La revisión activa cambió; actualizá el estado antes de revertir".into());
    }
    document.active_revision_id = None;
    write_layered_document_at(data_root, &document)?;
    Ok(layered_memory_status_at(data_root))
}

pub(super) fn layered_memory_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(LAYERED_MEMORY_FILE)
}
