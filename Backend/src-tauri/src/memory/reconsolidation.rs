//! Versioned owner correction with recovery of the original source.
use super::lifecycle::{lifecycle_reference, memory_lifecycle_preview_at};
use super::model::{
    ConfirmMemoryReconsolidationInput, MemoryLifecyclePreviewState, MemoryReconsolidationField,
    MemoryReconsolidationPreview, MemoryReconsolidationReason, MemoryReconsolidationResult,
    MemoryReconsolidationRevision, MemorySession, MemoryValidityState,
    PreviewMemoryReconsolidationInput,
};
use super::storage::{
    append_memory_audit, atomic_replace_text_file, memory_subject_digest, read_validated_source_at,
};
use super::validation::{is_sha256, validate_memory_sessions};
use super::MEMORY_RECONSOLIDATION_SCHEMA_VERSION;
use crate::capabilities::validate_timestamp;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(super) fn reconsolidation_reason_code(reason: MemoryReconsolidationReason) -> &'static str {
    match reason {
        MemoryReconsolidationReason::OwnerCorrection => "ownerCorrection",
        MemoryReconsolidationReason::NewContext => "newContext",
        MemoryReconsolidationReason::Clarification => "clarification",
    }
}

pub(super) fn normalized_optional_reconsolidation_text(
    value: Option<String>,
    field: &str,
    maximum: usize,
) -> Result<Option<String>, String> {
    let normalized = value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty());
    if normalized
        .as_ref()
        .is_some_and(|text| text.chars().count() > maximum)
    {
        return Err(format!("{field} supera {maximum} caracteres"));
    }
    Ok(normalized)
}

pub(super) fn prepare_memory_reconsolidation_at(
    data_root: &Path,
    input: PreviewMemoryReconsolidationInput,
    planned_at: String,
) -> Result<
    (
        MemoryReconsolidationPreview,
        String,
        Vec<MemorySession>,
        MemorySession,
    ),
    String,
> {
    validate_timestamp("plannedAt", &planned_at)?;
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La propuesta de reconsolidación contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La propuesta de reconsolidación contiene un ID inválido".into());
    }
    let note = input.note.trim();
    if note.is_empty() || note.chars().count() > 500 {
        return Err("La reconsolidación requiere una nota de 1 a 500 caracteres".into());
    }
    let proposed_intention = input.proposed_intention.trim().to_string();
    if proposed_intention.is_empty() || proposed_intention.chars().count() > 240 {
        return Err("El título propuesto debe contener de 1 a 240 caracteres".into());
    }
    let proposed_summary = normalized_optional_reconsolidation_text(
        input.proposed_summary,
        "El contenido propuesto",
        12_000,
    )?;
    let proposed_next_step = normalized_optional_reconsolidation_text(
        input.proposed_next_step,
        "El próximo paso propuesto",
        2_000,
    )?;
    let proposed_source = normalized_optional_reconsolidation_text(
        input.proposed_source,
        "La fuente propuesta",
        500,
    )?;
    let lifecycle_before = memory_lifecycle_preview_at(data_root);
    if matches!(
        lifecycle_before.state,
        MemoryLifecyclePreviewState::Unavailable | MemoryLifecyclePreviewState::Blocked
    ) {
        return Err(lifecycle_before.blocked_reason.unwrap_or_else(|| {
            "La memoria no está disponible para preparar una reconsolidación".into()
        }));
    }
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para preparar una reconsolidación")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256
        || lifecycle_before.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str())
    {
        return Err(
            "records.json cambió después de revisar el recuerdo; actualizá antes de continuar"
                .into(),
        );
    }
    let position = sessions
        .iter()
        .position(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let previous_record = sessions[position].clone();
    let previous_reference = lifecycle_reference(&previous_record)?;
    if previous_reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de preparar su edición".into());
    }
    if !matches!(
        previous_reference.validity,
        MemoryValidityState::Current | MemoryValidityState::Conflict
    ) {
        return Err("Sólo un recuerdo vigente o en conflicto admite reconsolidación".into());
    }
    if previous_reference.archived {
        return Err("Restaurá el recuerdo archivado antes de reconsolidarlo".into());
    }
    if previous_reference.validity == MemoryValidityState::Conflict
        && input.reason != MemoryReconsolidationReason::OwnerCorrection
    {
        return Err("Resolver un conflicto requiere el motivo corrección del propietario".into());
    }
    let mut changed_fields = Vec::new();
    if previous_record.intention != proposed_intention {
        changed_fields.push(MemoryReconsolidationField::Intention);
    }
    if previous_record.summary != proposed_summary {
        changed_fields.push(MemoryReconsolidationField::Summary);
    }
    if previous_record.next_step != proposed_next_step {
        changed_fields.push(MemoryReconsolidationField::NextStep);
    }
    if previous_record.source != proposed_source {
        changed_fields.push(MemoryReconsolidationField::Source);
    }
    if changed_fields.is_empty() {
        return Err("La propuesta no cambia ningún campo de contenido; no se creó un plan".into());
    }
    let previous_version = previous_record.memory_version.unwrap_or(1);
    let projected_version = previous_version
        .checked_add(1)
        .ok_or("El contador de versiones alcanzó su límite")?;
    {
        let projected = &mut sessions[position];
        projected.intention = proposed_intention;
        projected.summary = proposed_summary;
        projected.next_step = proposed_next_step;
        projected.source = proposed_source;
        projected.memory_version = Some(projected_version);
        projected.reconsolidated_at = Some(planned_at.clone());
        projected.reconsolidation_reason = Some(reconsolidation_reason_code(input.reason).into());
        projected.previous_version_sha256 = Some(previous_reference.record_sha256.clone());
        if previous_reference.validity == MemoryValidityState::Conflict {
            projected.memory_status = Some("confirmed".into());
            projected.last_reviewed_at = Some(planned_at.clone());
            projected.successful_reviews = projected.successful_reviews.saturating_add(1);
        }
    }
    validate_memory_sessions(&sessions)?;
    let projected_serialized = serde_json::to_string(&sessions[position])
        .map_err(|error| format!("No se pudo calcular la versión propuesta: {error}"))?;
    let projected_record_sha256 = memory_subject_digest(&projected_serialized);
    let note_sha256 = memory_subject_digest(note);
    let plan_id = memory_subject_digest(&format!(
        "alice-memory-reconsolidation:{}:{}:{}:{}:{}:{}:{}:{}:{}",
        MEMORY_RECONSOLIDATION_SCHEMA_VERSION,
        source_sha256,
        previous_reference.record_sha256,
        projected_record_sha256,
        previous_version,
        projected_version,
        reconsolidation_reason_code(input.reason),
        note_sha256,
        planned_at
    ));
    Ok((
        MemoryReconsolidationPreview {
            schema_version: MEMORY_RECONSOLIDATION_SCHEMA_VERSION,
            plan_id,
            planned_at,
            record_id: input.record_id,
            reason: input.reason,
            note_sha256,
            source_sha256,
            record_sha256_before: previous_reference.record_sha256,
            projected_record_sha256,
            previous_version,
            projected_version,
            changed_fields,
            records_modified: false,
            version_written: false,
            automatic_action: false,
        },
        source_content,
        sessions,
        previous_record,
    ))
}

pub(super) fn reconsolidation_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root.join("memory").join("backups").join(format!(
        "reconsolidation-source-{}.json",
        &source_sha256[7..]
    ))
}

pub(super) fn reconsolidation_revision_path(data_root: &Path, revision_id: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("revisions")
        .join(format!("reconsolidation-v1-{}.json", &revision_id[7..]))
}

pub(super) fn create_or_verify_reconsolidation_source_backup(
    data_root: &Path,
    source_content: &str,
    source_sha256: &str,
) -> Result<PathBuf, String> {
    let path = reconsolidation_source_backup_path(data_root, source_sha256);
    let parent = path
        .parent()
        .ok_or("El respaldo de reconsolidación no posee directorio")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar el respaldo de reconsolidación: {error}"))?;
    if path.exists() {
        let stored = fs::read_to_string(&path).map_err(|error| {
            format!("No se pudo verificar el respaldo de reconsolidación: {error}")
        })?;
        if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
            return Err(
                "El respaldo existente de reconsolidación no coincide con records.json".into(),
            );
        }
        return Ok(path);
    }
    atomic_replace_text_file(
        &path,
        source_content,
        "reconsolidation-backup.tmp",
        "respaldo de reconsolidación",
    )?;
    let stored = fs::read_to_string(&path)
        .map_err(|error| format!("No se pudo releer el respaldo de reconsolidación: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
        return Err("El respaldo de reconsolidación no coincide byte a byte".into());
    }
    Ok(path)
}

pub(super) fn remove_created_reconsolidation_revision(
    path: &Path,
    created: bool,
) -> Result<(), String> {
    if !created {
        return Ok(());
    }
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("No se pudo retirar la versión incompleta: {error}")),
    }
}

pub(super) fn restore_failed_reconsolidation(
    source_path: &Path,
    source_content: &str,
    revision_path: &Path,
    revision_created: bool,
) -> Result<(), String> {
    atomic_replace_text_file(
        source_path,
        source_content,
        "reconsolidation-restore.tmp",
        "restauración de records.json",
    )?;
    remove_created_reconsolidation_revision(revision_path, revision_created)
}

pub(super) fn confirm_memory_reconsolidation_at(
    data_root: &Path,
    input: ConfirmMemoryReconsolidationInput,
) -> Result<MemoryReconsolidationResult, String> {
    if !input.confirmed {
        return Err(
            "Confirmar la reconsolidación requiere una segunda autorización explícita".into(),
        );
    }
    if !is_sha256(&input.expected_plan_id) {
        return Err("El plan esperado de reconsolidación no es válido".into());
    }
    let expected_plan_id = input.expected_plan_id.clone();
    let (preview, source_content, sessions, previous_record) = prepare_memory_reconsolidation_at(
        data_root,
        PreviewMemoryReconsolidationInput {
            expected_source_sha256: input.expected_source_sha256,
            record_id: input.record_id,
            expected_record_sha256: input.expected_record_sha256,
            reason: input.reason,
            note: input.note,
            proposed_intention: input.proposed_intention,
            proposed_summary: input.proposed_summary,
            proposed_next_step: input.proposed_next_step,
            proposed_source: input.proposed_source,
        },
        input.planned_at,
    )?;
    if preview.plan_id != expected_plan_id {
        return Err("La propuesta cambió después de la vista previa; volvé a revisarla".into());
    }
    let source_path = data_root.join("memory").join("records.json");
    let projected_source = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo serializar la fuente reconsolidada: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected_source);
    let revision_id = memory_subject_digest(&format!(
        "alice-memory-reconsolidation-revision:{}:{}:{}:{}",
        MEMORY_RECONSOLIDATION_SCHEMA_VERSION,
        preview.plan_id,
        preview.record_sha256_before,
        preview.projected_record_sha256
    ));
    let revision = MemoryReconsolidationRevision {
        schema_version: MEMORY_RECONSOLIDATION_SCHEMA_VERSION,
        revision_id: revision_id.clone(),
        plan_id: preview.plan_id.clone(),
        record_id: preview.record_id.clone(),
        previous_version: preview.previous_version,
        successor_version: preview.projected_version,
        reason: preview.reason,
        note_sha256: preview.note_sha256.clone(),
        superseded_at: preview.planned_at.clone(),
        source_sha256_before: preview.source_sha256.clone(),
        source_sha256_after: source_sha256_after.clone(),
        record_sha256_before: preview.record_sha256_before.clone(),
        record_sha256_after: preview.projected_record_sha256.clone(),
        record: previous_record,
    };
    let revision_content = serde_json::to_string_pretty(&revision)
        .map_err(|error| format!("No se pudo serializar la versión anterior: {error}"))?;
    let revision_sha256 = memory_subject_digest(&revision_content);
    let revision_path = reconsolidation_revision_path(data_root, &revision_id);
    let revision_parent = revision_path
        .parent()
        .ok_or("La versión anterior no posee directorio")?;
    fs::create_dir_all(revision_parent)
        .map_err(|error| format!("No se pudo preparar memory/revisions: {error}"))?;
    let backup = create_or_verify_reconsolidation_source_backup(
        data_root,
        &source_content,
        &preview.source_sha256,
    )?;
    let revision_created = if revision_path.exists() {
        let stored = fs::read_to_string(&revision_path)
            .map_err(|error| format!("No se pudo verificar la versión anterior: {error}"))?;
        if stored != revision_content {
            return Err("La ruta de versión ya contiene evidencia diferente".into());
        }
        false
    } else {
        atomic_replace_text_file(
            &revision_path,
            &revision_content,
            "reconsolidation-revision.tmp",
            "versión anterior de memoria",
        )?;
        true
    };
    let stored_revision = fs::read_to_string(&revision_path)
        .map_err(|error| format!("No se pudo releer la versión anterior: {error}"))?;
    if stored_revision != revision_content
        || memory_subject_digest(&stored_revision) != revision_sha256
    {
        remove_created_reconsolidation_revision(&revision_path, revision_created)?;
        return Err("La versión anterior no coincidió byte a byte".into());
    }
    if let Err(error) = atomic_replace_text_file(
        &source_path,
        &projected_source,
        "reconsolidation-records.tmp",
        "records.json reconsolidado",
    ) {
        remove_created_reconsolidation_revision(&revision_path, revision_created)?;
        return Err(error);
    }
    let stored = match read_validated_source_at(data_root) {
        Ok(Some(stored)) => stored,
        Ok(None) => {
            restore_failed_reconsolidation(
                &source_path,
                &source_content,
                &revision_path,
                revision_created,
            )?;
            return Err("records.json desapareció después de reconsolidar".into());
        }
        Err(error) => {
            restore_failed_reconsolidation(
                &source_path,
                &source_content,
                &revision_path,
                revision_created,
            )?;
            return Err(format!(
                "La versión nueva fue inválida y se restauró: {error}"
            ));
        }
    };
    if stored.0 != projected_source || memory_subject_digest(&stored.0) != source_sha256_after {
        restore_failed_reconsolidation(
            &source_path,
            &source_content,
            &revision_path,
            revision_created,
        )?;
        return Err("La versión nueva cambió al releerla y fue restaurada".into());
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        restore_failed_reconsolidation(
            &source_path,
            &source_content,
            &revision_path,
            revision_created,
        )?;
        return Err("La reconsolidación volvió incoherente el ciclo y fue restaurada".into());
    }
    let audit_action = format!(
        "reconsolidation-v{}-to-v{}-{}",
        preview.previous_version,
        preview.projected_version,
        reconsolidation_reason_code(preview.reason)
    );
    if let Err(audit_error) = append_memory_audit(
        &source_path,
        &audit_action,
        sessions.len(),
        &projected_source,
    ) {
        if let Err(restore_error) = restore_failed_reconsolidation(
            &source_path,
            &source_content,
            &revision_path,
            revision_created,
        ) {
            return Err(format!(
                "Falló la auditoría de reconsolidación ({audit_error}) y también la restauración ({restore_error})"
            ));
        }
        return Err(format!(
            "Falló la auditoría de reconsolidación y la fuente fue restaurada: {audit_error}"
        ));
    }
    Ok(MemoryReconsolidationResult {
        schema_version: MEMORY_RECONSOLIDATION_SCHEMA_VERSION,
        plan_id: preview.plan_id,
        revision_id,
        record_id: preview.record_id,
        reason: preview.reason,
        previous_version: preview.previous_version,
        new_version: preview.projected_version,
        source_sha256_before: preview.source_sha256.clone(),
        source_sha256_after,
        record_sha256_before: preview.record_sha256_before,
        record_sha256_after: preview.projected_record_sha256,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        revision_sha256,
        records_modified: true,
        version_written: true,
        audit_written: true,
        lifecycle,
    })
}
