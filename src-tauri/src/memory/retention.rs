//! Governed archival, deletion scheduling and deletion use cases.
use super::lifecycle::{lifecycle_reference, memory_lifecycle_preview_at};
use super::model::{
    ConfirmMemoryArchiveInput, ConfirmMemoryDeletionInput, ConfirmMemoryDeletionScheduleInput,
    MemoryArchiveAction, MemoryArchivePreview, MemoryArchiveReason, MemoryArchiveResult,
    MemoryDeletionPreview, MemoryDeletionReason, MemoryDeletionResult,
    MemoryDeletionScheduleAction, MemoryDeletionSchedulePreview, MemoryDeletionScheduleResult,
    MemoryDeletionTombstone, MemoryLifecyclePreviewState, MemorySession, MemoryValidityState,
    PreviewMemoryArchiveInput, PreviewMemoryDeletionInput, PreviewMemoryDeletionScheduleInput,
};
use super::storage::{
    append_memory_audit, atomic_replace_text_file, create_or_verify_exact_file,
    memory_subject_digest, read_validated_source_at,
};
use super::validation::{is_sha256, validate_memory_sessions};
use super::{
    MEMORY_ARCHIVE_SCHEMA_VERSION, MEMORY_DELETION_SCHEMA_VERSION, MEMORY_DELETION_WAIT_SECONDS,
};
use crate::capabilities::validate_timestamp;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(super) fn archive_reason_code(reason: MemoryArchiveReason) -> &'static str {
    match reason {
        MemoryArchiveReason::OwnerChoice => "ownerChoice",
        MemoryArchiveReason::Superseded => "superseded",
        MemoryArchiveReason::NoLongerRelevant => "noLongerRelevant",
        MemoryArchiveReason::RelevantAgain => "relevantAgain",
    }
}

pub(super) fn archive_action_code(action: MemoryArchiveAction) -> &'static str {
    match action {
        MemoryArchiveAction::Archive => "archive",
        MemoryArchiveAction::Restore => "restore",
    }
}

pub(super) fn utc_timestamp_seconds(value: &str) -> Result<i64, String> {
    validate_timestamp("timestamp", value)?;
    if value.len() != 20 || !value.ends_with('Z') {
        return Err("La retención requiere una fecha UTC canónica con segundos".into());
    }
    let number = |range: std::ops::Range<usize>| -> Result<i64, String> {
        value[range]
            .parse::<i64>()
            .map_err(|_| "La retención contiene una fecha inválida".into())
    };
    let year = number(0..4)?;
    let month = number(5..7)?;
    let day = number(8..10)?;
    let hour = number(11..13)?;
    let minute = number(14..16)?;
    let second = number(17..19)?;
    let adjusted_year = year - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let month_prime = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    Ok(days * 86_400 + hour * 3_600 + minute * 60 + second)
}

pub(super) fn deletion_reason_code(reason: MemoryDeletionReason) -> &'static str {
    match reason {
        MemoryDeletionReason::OwnerRequest => "ownerRequest",
        MemoryDeletionReason::DuplicateAfterMerge => "duplicateAfterMerge",
        MemoryDeletionReason::PrivacyRemoval => "privacyRemoval",
    }
}

pub(super) fn deletion_schedule_action_code(action: MemoryDeletionScheduleAction) -> &'static str {
    match action {
        MemoryDeletionScheduleAction::Schedule => "schedule",
        MemoryDeletionScheduleAction::Cancel => "cancel",
    }
}

pub(super) fn prepare_memory_archive_at(
    data_root: &Path,
    input: PreviewMemoryArchiveInput,
    planned_at: String,
) -> Result<(MemoryArchivePreview, String, Vec<MemorySession>), String> {
    validate_timestamp("plannedAt", &planned_at)?;
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La propuesta de archivo contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La propuesta de archivo contiene un ID inválido".into());
    }
    let note = input.note.trim();
    if note.is_empty() || note.chars().count() > 500 {
        return Err("El archivo reversible requiere una nota de 1 a 500 caracteres".into());
    }
    match (input.action, input.reason) {
        (MemoryArchiveAction::Archive, MemoryArchiveReason::RelevantAgain) => {
            return Err("Archivar requiere un motivo de archivo, no de restauración".into())
        }
        (MemoryArchiveAction::Restore, reason) if reason != MemoryArchiveReason::RelevantAgain => {
            return Err("Restaurar requiere el motivo relevantAgain".into())
        }
        _ => {}
    }
    let lifecycle_before = memory_lifecycle_preview_at(data_root);
    if matches!(
        lifecycle_before.state,
        MemoryLifecyclePreviewState::Unavailable | MemoryLifecyclePreviewState::Blocked
    ) {
        return Err(lifecycle_before.blocked_reason.unwrap_or_else(|| {
            "La memoria no está disponible para preparar un archivo reversible".into()
        }));
    }
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para preparar un archivo reversible")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256
        || lifecycle_before.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str())
    {
        return Err(
            "records.json cambió después de revisar el archivo; actualizá antes de continuar"
                .into(),
        );
    }
    let position = sessions
        .iter()
        .position(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let previous_reference = lifecycle_reference(&sessions[position])?;
    if previous_reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de preparar el archivo".into());
    }
    if previous_reference.validity == MemoryValidityState::Archived {
        return Err("Un archivo heredado no conserva su vigencia previa y no puede restaurarse automáticamente".into());
    }
    if sessions[position].deletion_status.as_deref() == Some("scheduled") {
        return Err(
            "Cancelá primero la eliminación programada antes de cambiar el archivo reversible"
                .into(),
        );
    }
    let previous_archived = previous_reference.archived;
    let projected_archived = input.action == MemoryArchiveAction::Archive;
    if previous_archived == projected_archived {
        return Err("El recuerdo ya posee ese estado de archivo; no se creó un plan".into());
    }
    if projected_archived
        && !matches!(
            previous_reference.validity,
            MemoryValidityState::Current | MemoryValidityState::Conflict
        )
    {
        return Err("Sólo un recuerdo vigente o en conflicto puede archivarse".into());
    }
    let projected = &mut sessions[position];
    if projected_archived {
        projected.archive_status = Some("archived".into());
        projected.archive_reason = Some(archive_reason_code(input.reason).into());
        projected.archive_updated_at = Some(planned_at.clone());
    } else {
        projected.archive_status = None;
        projected.archive_reason = None;
        projected.archive_updated_at = None;
    }
    validate_memory_sessions(&sessions)?;
    let projected_serialized = serde_json::to_string(&sessions[position])
        .map_err(|error| format!("No se pudo calcular el archivo propuesto: {error}"))?;
    let projected_record_sha256 = memory_subject_digest(&projected_serialized);
    let note_sha256 = memory_subject_digest(note);
    let plan_id = memory_subject_digest(&format!(
        "alice-memory-archive:{}:{}:{}:{}:{}:{}:{}:{}",
        MEMORY_ARCHIVE_SCHEMA_VERSION,
        source_sha256,
        previous_reference.record_sha256,
        projected_record_sha256,
        archive_action_code(input.action),
        archive_reason_code(input.reason),
        note_sha256,
        planned_at
    ));
    Ok((
        MemoryArchivePreview {
            schema_version: MEMORY_ARCHIVE_SCHEMA_VERSION,
            plan_id,
            planned_at,
            record_id: input.record_id,
            action: input.action,
            reason: input.reason,
            note_sha256,
            source_sha256,
            record_sha256_before: previous_reference.record_sha256,
            projected_record_sha256,
            previous_archived,
            projected_archived,
            records_modified: false,
            automatic_action: false,
        },
        source_content,
        sessions,
    ))
}

pub(super) fn archive_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("archive-source-{}.json", &source_sha256[7..]))
}

pub(super) fn create_or_verify_archive_backup(
    data_root: &Path,
    source_content: &str,
    source_sha256: &str,
) -> Result<PathBuf, String> {
    let path = archive_source_backup_path(data_root, source_sha256);
    let parent = path
        .parent()
        .ok_or("El respaldo de archivo no posee directorio")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar el respaldo de archivo: {error}"))?;
    if path.exists() {
        let stored = fs::read_to_string(&path)
            .map_err(|error| format!("No se pudo verificar el respaldo de archivo: {error}"))?;
        if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
            return Err("El respaldo existente de archivo no coincide con records.json".into());
        }
        return Ok(path);
    }
    atomic_replace_text_file(
        &path,
        source_content,
        "archive-backup.tmp",
        "respaldo de archivo reversible",
    )?;
    let stored = fs::read_to_string(&path)
        .map_err(|error| format!("No se pudo releer el respaldo de archivo: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
        return Err("El respaldo de archivo no coincide byte a byte".into());
    }
    Ok(path)
}

pub(super) fn confirm_memory_archive_at(
    data_root: &Path,
    input: ConfirmMemoryArchiveInput,
) -> Result<MemoryArchiveResult, String> {
    if !input.confirmed {
        return Err(
            "Confirmar el archivo reversible requiere una segunda autorización explícita".into(),
        );
    }
    if !is_sha256(&input.expected_plan_id) {
        return Err("El plan esperado de archivo no es válido".into());
    }
    let expected_plan_id = input.expected_plan_id.clone();
    let (preview, source_content, sessions) = prepare_memory_archive_at(
        data_root,
        PreviewMemoryArchiveInput {
            expected_source_sha256: input.expected_source_sha256,
            record_id: input.record_id,
            expected_record_sha256: input.expected_record_sha256,
            action: input.action,
            reason: input.reason,
            note: input.note,
        },
        input.planned_at,
    )?;
    if preview.plan_id != expected_plan_id {
        return Err(
            "La propuesta de archivo cambió después de la vista previa; volvé a revisarla".into(),
        );
    }
    let source_path = data_root.join("memory").join("records.json");
    let projected_source = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo serializar la fuente archivada: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected_source);
    let backup =
        create_or_verify_archive_backup(data_root, &source_content, &preview.source_sha256)?;
    atomic_replace_text_file(
        &source_path,
        &projected_source,
        "archive-records.tmp",
        "records.json tras archivo reversible",
    )?;
    let stored = match read_validated_source_at(data_root) {
        Ok(Some(stored)) => stored,
        Ok(None) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "archive-restore.tmp",
                "restauración de records.json",
            )?;
            return Err("records.json desapareció después del archivo reversible".into());
        }
        Err(error) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "archive-restore.tmp",
                "restauración de records.json",
            )?;
            return Err(format!(
                "El archivo produjo una fuente inválida y fue restaurada: {error}"
            ));
        }
    };
    if stored.0 != projected_source || memory_subject_digest(&stored.0) != source_sha256_after {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "archive-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("El archivo no coincidió al releerlo y fue restaurado".into());
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "archive-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("El archivo volvió incoherente el ciclo y fue restaurado".into());
    }
    let audit_action = format!(
        "archive-{}-{}",
        archive_action_code(preview.action),
        archive_reason_code(preview.reason)
    );
    if let Err(audit_error) = append_memory_audit(
        &source_path,
        &audit_action,
        sessions.len(),
        &projected_source,
    ) {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "archive-restore.tmp",
            "restauración de records.json",
        ) {
            return Err(format!("Falló la auditoría de archivo ({audit_error}) y también la restauración ({restore_error})"));
        }
        return Err(format!(
            "Falló la auditoría de archivo y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(MemoryArchiveResult {
        schema_version: MEMORY_ARCHIVE_SCHEMA_VERSION,
        plan_id: preview.plan_id,
        record_id: preview.record_id,
        action: preview.action,
        reason: preview.reason,
        previous_archived: preview.previous_archived,
        new_archived: preview.projected_archived,
        source_sha256_before: preview.source_sha256,
        source_sha256_after,
        record_sha256_before: preview.record_sha256_before,
        record_sha256_after: preview.projected_record_sha256,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}

pub(super) fn prepare_memory_deletion_schedule_at(
    data_root: &Path,
    input: PreviewMemoryDeletionScheduleInput,
    planned_at: String,
    eligible_at: String,
) -> Result<(MemoryDeletionSchedulePreview, String, Vec<MemorySession>), String> {
    let planned_seconds = utc_timestamp_seconds(&planned_at)?;
    let eligible_seconds = utc_timestamp_seconds(&eligible_at)?;
    if eligible_seconds != planned_seconds + MEMORY_DELETION_WAIT_SECONDS {
        return Err("La eliminación requiere exactamente siete días completos de espera".into());
    }
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La programación de eliminación contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La programación de eliminación contiene un ID inválido".into());
    }
    let note = input.note.trim();
    if note.is_empty() || note.chars().count() > 500 {
        return Err(
            "Programar o cancelar una eliminación requiere una nota de 1 a 500 caracteres".into(),
        );
    }
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para programar una eliminación")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256 {
        return Err("records.json cambió después de revisar la programación".into());
    }
    let position = sessions
        .iter()
        .position(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let reference = lifecycle_reference(&sessions[position])?;
    if reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de revisar la programación".into());
    }
    if sessions[position].archive_status.as_deref() != Some("archived")
        || reference.validity == MemoryValidityState::Archived
    {
        return Err("Sólo un recuerdo archivado mediante el contrato reversible puede programarse para eliminación".into());
    }
    let previous_scheduled = sessions[position].deletion_status.as_deref() == Some("scheduled");
    let projected_scheduled = input.action == MemoryDeletionScheduleAction::Schedule;
    if previous_scheduled == projected_scheduled {
        return Err("El recuerdo ya posee ese estado de retención".into());
    }
    if input.action == MemoryDeletionScheduleAction::Cancel
        && sessions[position].deletion_reason.as_deref() != Some(deletion_reason_code(input.reason))
    {
        return Err("Cancelar requiere conservar el motivo original de la programación".into());
    }
    let projected = &mut sessions[position];
    if projected_scheduled {
        projected.deletion_status = Some("scheduled".into());
        projected.deletion_reason = Some(deletion_reason_code(input.reason).into());
        projected.deletion_requested_at = Some(planned_at.clone());
        projected.deletion_eligible_at = Some(eligible_at.clone());
    } else {
        projected.deletion_status = None;
        projected.deletion_reason = None;
        projected.deletion_requested_at = None;
        projected.deletion_eligible_at = None;
    }
    validate_memory_sessions(&sessions)?;
    let projected_record = serde_json::to_string(&sessions[position])
        .map_err(|error| format!("No se pudo calcular la retención propuesta: {error}"))?;
    let projected_record_sha256 = memory_subject_digest(&projected_record);
    let note_sha256 = memory_subject_digest(note);
    let plan_id = memory_subject_digest(&format!(
        "alice-memory-deletion-schedule:{}:{}:{}:{}:{}:{}:{}:{}:{}",
        MEMORY_DELETION_SCHEMA_VERSION,
        source_sha256,
        reference.record_sha256,
        projected_record_sha256,
        deletion_schedule_action_code(input.action),
        deletion_reason_code(input.reason),
        note_sha256,
        planned_at,
        eligible_at
    ));
    Ok((
        MemoryDeletionSchedulePreview {
            schema_version: MEMORY_DELETION_SCHEMA_VERSION,
            plan_id,
            planned_at,
            eligible_at,
            record_id: input.record_id,
            action: input.action,
            reason: input.reason,
            note_sha256,
            source_sha256,
            record_sha256_before: reference.record_sha256,
            projected_record_sha256,
            previous_scheduled,
            projected_scheduled,
            wait_seconds: MEMORY_DELETION_WAIT_SECONDS,
            records_modified: false,
            automatic_action: false,
        },
        source_content,
        sessions,
    ))
}

pub(super) fn deletion_schedule_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root.join("memory").join("backups").join(format!(
        "deletion-schedule-source-{}.json",
        &source_sha256[7..]
    ))
}

pub(super) fn confirm_memory_deletion_schedule_at(
    data_root: &Path,
    input: ConfirmMemoryDeletionScheduleInput,
) -> Result<MemoryDeletionScheduleResult, String> {
    if !input.confirmed {
        return Err("La retención requiere una segunda autorización explícita".into());
    }
    if !is_sha256(&input.expected_plan_id) {
        return Err("El plan esperado de retención no es válido".into());
    }
    let expected_plan_id = input.expected_plan_id.clone();
    let (preview, source_content, sessions) = prepare_memory_deletion_schedule_at(
        data_root,
        PreviewMemoryDeletionScheduleInput {
            expected_source_sha256: input.expected_source_sha256,
            record_id: input.record_id,
            expected_record_sha256: input.expected_record_sha256,
            action: input.action,
            reason: input.reason,
            note: input.note,
        },
        input.planned_at,
        input.eligible_at,
    )?;
    if preview.plan_id != expected_plan_id {
        return Err("La programación cambió después de la vista previa".into());
    }
    let source_path = data_root.join("memory").join("records.json");
    let projected_source = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo serializar la retención: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected_source);
    let backup = deletion_schedule_backup_path(data_root, &preview.source_sha256);
    create_or_verify_exact_file(
        &backup,
        &source_content,
        &preview.source_sha256,
        "deletion-schedule-backup.tmp",
        "el respaldo de retención",
    )?;
    atomic_replace_text_file(
        &source_path,
        &projected_source,
        "deletion-schedule-records.tmp",
        "records.json tras retención",
    )?;
    let rollback = |message: String| -> Result<MemoryDeletionScheduleResult, String> {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "deletion-schedule-restore.tmp",
            "restauración de records.json",
        )?;
        Err(message)
    };
    match read_validated_source_at(data_root) {
        Ok(Some((stored, _))) if stored == projected_source => {}
        Ok(_) => return rollback("La retención no coincidió al releerla y fue restaurada".into()),
        Err(error) => return rollback(format!("La retención fue inválida y se restauró: {error}")),
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        return rollback("La retención volvió incoherente el ciclo y fue restaurada".into());
    }
    if let Err(error) = append_memory_audit(
        &source_path,
        &format!(
            "deletion-{}-{}",
            deletion_schedule_action_code(preview.action),
            deletion_reason_code(preview.reason)
        ),
        sessions.len(),
        &projected_source,
    ) {
        return rollback(format!(
            "Falló la auditoría de retención y records.json fue restaurado: {error}"
        ));
    }
    Ok(MemoryDeletionScheduleResult {
        schema_version: MEMORY_DELETION_SCHEMA_VERSION,
        plan_id: preview.plan_id,
        record_id: preview.record_id,
        action: preview.action,
        reason: preview.reason,
        previous_scheduled: preview.previous_scheduled,
        new_scheduled: preview.projected_scheduled,
        eligible_at: preview.projected_scheduled.then_some(preview.eligible_at),
        source_sha256_before: preview.source_sha256,
        source_sha256_after,
        record_sha256_before: preview.record_sha256_before,
        record_sha256_after: preview.projected_record_sha256,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(&backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}

pub(super) fn prepare_memory_deletion_at(
    data_root: &Path,
    input: PreviewMemoryDeletionInput,
    planned_at: String,
) -> Result<(MemoryDeletionPreview, String, Vec<MemorySession>, usize), String> {
    let planned_seconds = utc_timestamp_seconds(&planned_at)?;
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La propuesta de eliminación contiene una huella inválida".into());
    }
    let note = input.note.trim();
    if note.is_empty() || note.chars().count() > 500 {
        return Err("La eliminación final requiere una nota de 1 a 500 caracteres".into());
    }
    let (source_content, sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para preparar la eliminación")?;
    let source_sha256 = memory_subject_digest(&source_content);
    if source_sha256 != input.expected_source_sha256 {
        return Err("records.json cambió después de revisar la eliminación".into());
    }
    let position = sessions
        .iter()
        .position(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let reference = lifecycle_reference(&sessions[position])?;
    if reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de revisar la eliminación".into());
    }
    let session = &sessions[position];
    if session.archive_status.as_deref() != Some("archived")
        || session.deletion_status.as_deref() != Some("scheduled")
    {
        return Err("La eliminación final exige archivo reversible y retención programada".into());
    }
    let requested_at = session
        .deletion_requested_at
        .clone()
        .ok_or("Falta la fecha de solicitud")?;
    let eligible_at = session
        .deletion_eligible_at
        .clone()
        .ok_or("Falta la fecha de elegibilidad")?;
    if planned_seconds < utc_timestamp_seconds(&eligible_at)? {
        return Err(format!(
            "La espera todavía no terminó; la eliminación será elegible el {eligible_at}"
        ));
    }
    let reason = match session.deletion_reason.as_deref() {
        Some("ownerRequest") => MemoryDeletionReason::OwnerRequest,
        Some("duplicateAfterMerge") => MemoryDeletionReason::DuplicateAfterMerge,
        Some("privacyRemoval") => MemoryDeletionReason::PrivacyRemoval,
        _ => return Err("El motivo durable de eliminación es desconocido".into()),
    };
    let note_sha256 = memory_subject_digest(note);
    let plan_id = memory_subject_digest(&format!(
        "alice-memory-delete:{}:{}:{}:{}:{}:{}:{}:{}",
        MEMORY_DELETION_SCHEMA_VERSION,
        source_sha256,
        reference.record_sha256,
        deletion_reason_code(reason),
        requested_at,
        eligible_at,
        note_sha256,
        planned_at
    ));
    Ok((
        MemoryDeletionPreview {
            schema_version: MEMORY_DELETION_SCHEMA_VERSION,
            plan_id,
            planned_at,
            record_id: input.record_id,
            reason,
            note_sha256,
            source_sha256,
            record_sha256: reference.record_sha256,
            requested_at,
            eligible_at,
            safeguard_required: true,
            tombstone_contains_content: false,
            records_modified: false,
            automatic_action: false,
        },
        source_content,
        sessions,
        position,
    ))
}

pub(super) fn confirm_memory_deletion_at(
    data_root: &Path,
    input: ConfirmMemoryDeletionInput,
    confirmed_at: String,
) -> Result<MemoryDeletionResult, String> {
    if !input.confirmed {
        return Err("Eliminar requiere una segunda autorización explícita".into());
    }
    if !is_sha256(&input.expected_plan_id) {
        return Err("El plan esperado de eliminación no es válido".into());
    }
    let expected_plan_id = input.expected_plan_id.clone();
    let (preview, source_content, mut sessions, position) = prepare_memory_deletion_at(
        data_root,
        PreviewMemoryDeletionInput {
            expected_source_sha256: input.expected_source_sha256,
            record_id: input.record_id,
            expected_record_sha256: input.expected_record_sha256,
            note: input.note,
        },
        input.planned_at,
    )?;
    if preview.plan_id != expected_plan_id {
        return Err("La propuesta de eliminación cambió después de la vista previa".into());
    }
    if utc_timestamp_seconds(&confirmed_at)? < utc_timestamp_seconds(&preview.eligible_at)? {
        return Err("La espera terminó sólo en el plan, no en el reloj real del sistema".into());
    }
    sessions.remove(position);
    validate_memory_sessions(&sessions)?;
    let projected_source = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo serializar la fuente sin el recuerdo: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected_source);
    let safeguard_path = data_root
        .join("memory")
        .join("private-deletion-safeguards")
        .join(format!("source-{}.json", &preview.source_sha256[7..]));
    create_or_verify_exact_file(
        &safeguard_path,
        &source_content,
        &preview.source_sha256,
        "deletion-safeguard.tmp",
        "el resguardo privado previo a eliminación",
    )?;
    let tombstone = MemoryDeletionTombstone {
        schema_version: MEMORY_DELETION_SCHEMA_VERSION,
        plan_id: preview.plan_id.clone(),
        record_id_sha256: memory_subject_digest(&preview.record_id),
        record_sha256: preview.record_sha256.clone(),
        source_sha256_before: preview.source_sha256.clone(),
        source_sha256_after: source_sha256_after.clone(),
        reason: preview.reason,
        requested_at: preview.requested_at.clone(),
        eligible_at: preview.eligible_at.clone(),
        deleted_at: confirmed_at,
        note_sha256: preview.note_sha256.clone(),
        safeguard_sha256: preview.source_sha256.clone(),
        content_included: false,
    };
    let tombstone_content = serde_json::to_string_pretty(&tombstone)
        .map_err(|error| format!("No se pudo serializar la lápida de eliminación: {error}"))?;
    let tombstone_sha256 = memory_subject_digest(&tombstone_content);
    let tombstone_path = data_root
        .join("memory")
        .join("deletion-tombstones")
        .join(format!("{}.json", &preview.plan_id[7..]));
    let source_path = data_root.join("memory").join("records.json");
    atomic_replace_text_file(
        &source_path,
        &projected_source,
        "deletion-records.tmp",
        "records.json tras eliminación gobernada",
    )?;
    let rollback = |message: String| -> Result<MemoryDeletionResult, String> {
        let restore = atomic_replace_text_file(
            &source_path,
            &source_content,
            "deletion-restore.tmp",
            "restauración de records.json",
        );
        if tombstone_path.exists() {
            let _ = fs::remove_file(&tombstone_path);
        }
        restore?;
        Err(message)
    };
    match read_validated_source_at(data_root) {
        Ok(Some((stored, _))) if stored == projected_source => {}
        Ok(_) => {
            return rollback("La eliminación no coincidió al releerla y fue restaurada".into())
        }
        Err(error) => {
            return rollback(format!(
                "La eliminación produjo una fuente inválida y fue restaurada: {error}"
            ))
        }
    }
    if let Err(error) = create_or_verify_exact_file(
        &tombstone_path,
        &tombstone_content,
        &tombstone_sha256,
        "deletion-tombstone.tmp",
        "la lápida sin contenido",
    ) {
        return rollback(format!(
            "No se pudo cerrar la lápida y records.json fue restaurado: {error}"
        ));
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        return rollback("La eliminación volvió incoherente el ciclo y fue restaurada".into());
    }
    if let Err(error) = append_memory_audit(
        &source_path,
        &format!("delete-final-{}", deletion_reason_code(preview.reason)),
        sessions.len(),
        &projected_source,
    ) {
        return rollback(format!(
            "Falló la auditoría de eliminación y records.json fue restaurado: {error}"
        ));
    }
    Ok(MemoryDeletionResult {
        schema_version: MEMORY_DELETION_SCHEMA_VERSION,
        plan_id: preview.plan_id,
        record_id: preview.record_id,
        reason: preview.reason,
        source_sha256_before: preview.source_sha256.clone(),
        source_sha256_after,
        record_sha256: preview.record_sha256,
        safeguard_sha256: memory_subject_digest(
            &fs::read_to_string(&safeguard_path)
                .map_err(|error| format!("No se pudo verificar el resguardo final: {error}"))?,
        ),
        tombstone_sha256,
        remaining_record_count: sessions.len(),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}
