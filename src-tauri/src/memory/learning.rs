//! Confirmed learning append use cases and idempotency.
use super::model::{
    ConfirmedConversationLearningAppendInput, ConfirmedLearningAppendInput,
    ConfirmedLearningAppendResult, MemorySession,
};
use super::storage::{append_memory_audit, atomic_replace_text_file, memory_subject_digest};
use super::validation::{
    is_sha256, validate_confirmed_conversation_learning_append, validate_confirmed_learning_append,
    validate_memory_sessions,
};
use super::{acquire_memory_write_lock, audited_memory_operation};
use crate::util::alice_data_root_path;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

pub(super) fn confirmed_learning_source(input: &ConfirmedLearningAppendInput) -> String {
    format!(
        "Ollama local · {} · recuerdo {} · candidato {}",
        input.model, input.source_record_id, input.candidate_id
    )
}

pub(super) fn append_confirmed_learning_at(
    data_root: &Path,
    expected_source_sha256: &str,
    input: ConfirmedLearningAppendInput,
) -> Result<ConfirmedLearningAppendResult, String> {
    if !is_sha256(expected_source_sha256) {
        return Err("La huella esperada de records.json no es válida".into());
    }
    validate_confirmed_learning_append(&input)?;
    let source_path = data_root.join("memory").join("records.json");
    let source_content = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo releer records.json para confirmar: {error}"))?;
    let mut sessions = serde_json::from_str::<Vec<MemorySession>>(&source_content)
        .map_err(|error| format!("records.json no es una memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let current_source_sha256 = memory_subject_digest(&source_content);
    let provenance = confirmed_learning_source(&input);
    if let Some(existing) = sessions.iter().find(|session| {
        session.kind == "Enseñanza" && session.source.as_deref() == Some(provenance.as_str())
    }) {
        let exact_retry = existing.intention == input.intention.trim()
            && existing.summary.as_deref() == Some(input.summary.trim())
            && existing.memory_type.as_deref() == Some(input.memory_type.as_str())
            && existing.importance == Some(input.importance)
            && existing.memory_status.as_deref() == Some("confirmed");
        if !exact_retry {
            return Err(
                "El candidato ya fue confirmado con otro contenido; revisá el recuerdo existente"
                    .into(),
            );
        }
        return Ok(ConfirmedLearningAppendResult {
            record_id: existing.id.clone(),
            record_count: sessions.len(),
            source_sha256: current_source_sha256,
            backup_sha256: expected_source_sha256.to_string(),
            storage_path: source_path.display().to_string(),
            already_confirmed: true,
            audit_written: false,
        });
    }
    if current_source_sha256 != expected_source_sha256 {
        return Err(
            "records.json cambió después de la vista previa; analizá el recuerdo otra vez".into(),
        );
    }
    if !sessions.iter().any(|session| {
        session.id == input.source_record_id
            && session.memory_status.as_deref() != Some("archived")
            && session.archive_status.as_deref() != Some("archived")
    }) {
        return Err("El recuerdo de origen ya no está disponible para confirmar".into());
    }

    let record_id = uuid::Uuid::new_v4().to_string();
    sessions.insert(
        0,
        MemorySession {
            affects: Vec::new(),
            id: record_id.clone(),
            kind: "Enseñanza".into(),
            intention: input.intention.trim().to_string(),
            started_at: input.confirmed_at.clone(),
            finished_at: Some(input.confirmed_at),
            summary: Some(input.summary.trim().to_string()),
            next_step: None,
            memory_type: Some(input.memory_type),
            source: Some(provenance),
            importance: Some(input.importance),
            storage_strength: Some(0.18),
            memory_status: Some("confirmed".into()),
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
            context_events: Vec::new(),
        },
    );
    validate_memory_sessions(&sessions)?;
    let projected = serde_json::to_string_pretty(&sessions).map_err(|error| error.to_string())?;
    let backup_path = data_root
        .join("memory")
        .join("backups")
        .join("records.backup.json");
    fs::create_dir_all(
        backup_path
            .parent()
            .ok_or("El respaldo R6.4-C no posee directorio")?,
    )
    .map_err(|error| format!("No se pudo preparar el respaldo R6.4-C: {error}"))?;
    atomic_replace_text_file(
        &backup_path,
        &source_content,
        "r6-4-c-backup.tmp",
        "respaldo R6.4-C",
    )?;
    atomic_replace_text_file(
        &source_path,
        &projected,
        "r6-4-c-records.tmp",
        "records.json R6.4-C",
    )?;
    if let Err(audit_error) = append_memory_audit(
        &source_path,
        "confirm-learning-candidate",
        sessions.len(),
        &projected,
    ) {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "r6-4-c-restore.tmp",
            "restauración R6.4-C",
        ) {
            return Err(format!(
                "Falló la auditoría R6.4-C ({audit_error}) y también la restauración ({restore_error})"
            ));
        }
        return Err(format!(
            "La auditoría R6.4-C falló y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(ConfirmedLearningAppendResult {
        record_id,
        record_count: sessions.len(),
        source_sha256: memory_subject_digest(&projected),
        backup_sha256: current_source_sha256,
        storage_path: source_path.display().to_string(),
        already_confirmed: false,
        audit_written: true,
    })
}

pub(crate) fn append_confirmed_learning(
    app: &AppHandle,
    expected_source_sha256: &str,
    input: ConfirmedLearningAppendInput,
) -> Result<ConfirmedLearningAppendResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(app)?;
    let subject_digest = input.candidate_id.clone();
    audited_memory_operation(
        app,
        "memory.records.write",
        "memory.learning.confirm",
        &subject_digest,
        "LOCAL_LEARNING_CANDIDATE_CONFIRMED",
        || append_confirmed_learning_at(&data_root, expected_source_sha256, input),
    )
}

pub(super) fn confirmed_conversation_learning_source(
    input: &ConfirmedConversationLearningAppendInput,
) -> String {
    format!(
        "Gemma local · {} · intercambio {} · fuente {} · candidato {}",
        input.model,
        input.conversation_exchange_id,
        input.conversation_source_sha256,
        input.candidate_id
    )
}

pub(super) fn append_confirmed_conversation_learning_at(
    data_root: &Path,
    expected_memory_sha256: &str,
    input: ConfirmedConversationLearningAppendInput,
) -> Result<ConfirmedLearningAppendResult, String> {
    if !is_sha256(expected_memory_sha256) {
        return Err("La huella revisada de la memoria no es válida".into());
    }
    validate_confirmed_conversation_learning_append(&input)?;
    let source_path = data_root.join("memory").join("records.json");
    let source_content = fs::read_to_string(&source_path)
        .map_err(|error| format!("No se pudo releer records.json para confirmar: {error}"))?;
    let mut sessions = serde_json::from_str::<Vec<MemorySession>>(&source_content)
        .map_err(|error| format!("records.json no es una memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let current_memory_sha256 = memory_subject_digest(&source_content);
    let provenance = confirmed_conversation_learning_source(&input);
    if let Some(existing) = sessions.iter().find(|session| {
        session.kind == "Enseñanza" && session.source.as_deref() == Some(provenance.as_str())
    }) {
        let exact_retry = existing.intention == input.intention.trim()
            && existing.summary.as_deref() == Some(input.summary.trim())
            && existing.memory_type.as_deref() == Some(input.memory_type.as_str())
            && existing.importance == Some(input.importance)
            && existing.affects == input.affects
            && existing.memory_status.as_deref() == Some("confirmed");
        if !exact_retry {
            return Err(
                "La propuesta ya fue confirmada con otro contenido; revisá el recuerdo existente"
                    .into(),
            );
        }
        return Ok(ConfirmedLearningAppendResult {
            record_id: existing.id.clone(),
            record_count: sessions.len(),
            source_sha256: current_memory_sha256,
            backup_sha256: expected_memory_sha256.to_string(),
            storage_path: source_path.display().to_string(),
            already_confirmed: true,
            audit_written: false,
        });
    }
    if current_memory_sha256 != expected_memory_sha256 {
        return Err(
            "La memoria cambió después de la vista previa; revisá la propuesta nuevamente".into(),
        );
    }
    let record_id = uuid::Uuid::new_v4().to_string();
    sessions.insert(
        0,
        MemorySession {
            affects: input.affects,
            id: record_id.clone(),
            kind: "Enseñanza".into(),
            intention: input.intention.trim().to_string(),
            started_at: input.confirmed_at.clone(),
            finished_at: Some(input.confirmed_at),
            summary: Some(input.summary.trim().to_string()),
            next_step: None,
            memory_type: Some(input.memory_type),
            source: Some(provenance),
            importance: Some(input.importance),
            storage_strength: Some(0.18),
            memory_status: Some("confirmed".into()),
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
            context_events: Vec::new(),
        },
    );
    validate_memory_sessions(&sessions)?;
    let projected = serde_json::to_string_pretty(&sessions).map_err(|error| error.to_string())?;
    let backup_path = data_root
        .join("memory")
        .join("backups")
        .join("records.backup.json");
    fs::create_dir_all(
        backup_path
            .parent()
            .ok_or("El respaldo no posee directorio")?,
    )
    .map_err(|error| format!("No se pudo preparar el respaldo de memoria: {error}"))?;
    atomic_replace_text_file(
        &backup_path,
        &source_content,
        "conversation-learning-backup.tmp",
        "respaldo de aprendizaje",
    )?;
    atomic_replace_text_file(
        &source_path,
        &projected,
        "conversation-learning-records.tmp",
        "records.json de aprendizaje",
    )?;
    if let Err(audit_error) = append_memory_audit(
        &source_path,
        "confirm-conversation-learning",
        sessions.len(),
        &projected,
    ) {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "conversation-learning-restore.tmp",
            "restauración de aprendizaje",
        ) {
            return Err(format!(
                "Falló la auditoría ({audit_error}) y también la restauración ({restore_error})"
            ));
        }
        return Err(format!(
            "La auditoría falló y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(ConfirmedLearningAppendResult {
        record_id,
        record_count: sessions.len(),
        source_sha256: memory_subject_digest(&projected),
        backup_sha256: current_memory_sha256,
        storage_path: source_path.display().to_string(),
        already_confirmed: false,
        audit_written: true,
    })
}

pub(crate) fn append_confirmed_conversation_learning(
    app: &AppHandle,
    expected_memory_sha256: &str,
    input: ConfirmedConversationLearningAppendInput,
) -> Result<ConfirmedLearningAppendResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(app)?;
    let subject_digest = input.candidate_id.clone();
    audited_memory_operation(
        app,
        "memory.records.write",
        "memory.conversationlearning.confirm",
        &subject_digest,
        "CONVERSATION_LEARNING_CONFIRMED",
        || append_confirmed_conversation_learning_at(&data_root, expected_memory_sha256, input),
    )
}
