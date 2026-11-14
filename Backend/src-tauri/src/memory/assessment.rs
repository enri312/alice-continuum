//! Validity, accessibility and suppression use cases.
use super::lifecycle::{lifecycle_reference, memory_lifecycle_preview_at};
use super::model::{
    AssessMemoryAccessibilityInput, AssessMemorySuppressionInput, AssessMemoryValidityInput,
    MemoryAccessibilityAssessmentAction, MemoryAccessibilityAssessmentResult,
    MemoryAccessibilityState, MemoryLifecyclePreviewState, MemorySuppressionAction,
    MemorySuppressionAssessmentResult, MemorySuppressionReason, MemoryValidityAssessmentAction,
    MemoryValidityAssessmentResult, MemoryValidityState,
};
use super::storage::{
    append_memory_audit, atomic_replace_text_file, memory_subject_digest, read_validated_source_at,
};
use super::validation::{is_sha256, validate_memory_sessions};
use crate::capabilities::validate_timestamp;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

pub(super) fn validity_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("validity-source-{}.json", &source_sha256[7..]))
}

pub(super) fn create_or_verify_validity_backup(
    data_root: &Path,
    source_content: &str,
    source_sha256: &str,
) -> Result<PathBuf, String> {
    let backup = validity_source_backup_path(data_root, source_sha256);
    let parent = backup
        .parent()
        .ok_or("El respaldo de vigencia no posee directorio")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar el respaldo de vigencia: {error}"))?;
    if backup.exists() {
        let stored = fs::read_to_string(&backup)
            .map_err(|error| format!("No se pudo verificar el respaldo de vigencia: {error}"))?;
        if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
            return Err("El respaldo existente de vigencia no coincide con records.json".into());
        }
        return Ok(backup);
    }
    atomic_replace_text_file(
        &backup,
        source_content,
        "validity-backup.tmp",
        "respaldo de vigencia",
    )?;
    let stored = fs::read_to_string(&backup)
        .map_err(|error| format!("No se pudo releer el respaldo de vigencia: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
        return Err("El respaldo de vigencia no coincide byte a byte".into());
    }
    Ok(backup)
}

pub(super) fn assess_memory_validity_at(
    data_root: &Path,
    input: AssessMemoryValidityInput,
    now: String,
) -> Result<MemoryValidityAssessmentResult, String> {
    if !input.confirmed {
        return Err("Evaluar la vigencia requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La evaluación de vigencia contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La evaluación de vigencia contiene un ID inválido".into());
    }
    let declared_source = input
        .declared_source
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if input.declared_source.is_some()
        && (declared_source.is_none()
            || declared_source.is_some_and(|value| {
                value.chars().count() > 300 || value.chars().any(char::is_control)
            }))
    {
        return Err(
            "La procedencia declarada debe tener entre 1 y 300 caracteres sin controles".into(),
        );
    }
    validate_timestamp("reviewedAt", &now)?;
    let lifecycle_before = memory_lifecycle_preview_at(data_root);
    if matches!(
        lifecycle_before.state,
        MemoryLifecyclePreviewState::Unavailable | MemoryLifecyclePreviewState::Blocked
    ) {
        return Err(lifecycle_before
            .blocked_reason
            .unwrap_or_else(|| "La memoria no está disponible para evaluar vigencia".into()));
    }
    let source_path = data_root.join("memory").join("records.json");
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para evaluar vigencia")?;
    let source_sha256_before = memory_subject_digest(&source_content);
    if source_sha256_before != input.expected_source_sha256
        || lifecycle_before.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str())
    {
        return Err(
            "records.json cambió después de revisar el ciclo; actualizá antes de confirmar".into(),
        );
    }
    let session = sessions
        .iter_mut()
        .find(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let current_reference = lifecycle_reference(session)?;
    if current_reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de la vista previa".into());
    }
    if current_reference.validity != MemoryValidityState::NotAssessed
        || session.memory_status.is_some()
    {
        return Err("Sólo un recuerdo no evaluado admite esta operación inicial".into());
    }
    let source_declared = match session.source.as_deref() {
        Some(existing) => {
            if declared_source.is_some_and(|declared| declared != existing) {
                return Err(
                    "La evaluación de vigencia no puede reemplazar una procedencia existente"
                        .into(),
                );
            }
            false
        }
        None => {
            let declared = declared_source.ok_or(
                "Este recuerdo no tiene procedencia; declárala antes de confirmar su vigencia",
            )?;
            session.source = Some(declared.into());
            true
        }
    };
    let new_validity = match input.action {
        MemoryValidityAssessmentAction::ConfirmCurrent => {
            session.memory_status = Some("confirmed".into());
            session.successful_reviews = session.successful_reviews.saturating_add(1);
            MemoryValidityState::Current
        }
        MemoryValidityAssessmentAction::MarkConflict => {
            session.memory_status = Some("conflict".into());
            session.correction_count = session.correction_count.saturating_add(1);
            MemoryValidityState::Conflict
        }
    };
    session.last_reviewed_at = Some(now);
    validate_memory_sessions(&sessions)?;
    let projected = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo preparar la evaluación de vigencia: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected);
    let backup =
        create_or_verify_validity_backup(data_root, &source_content, &source_sha256_before)?;
    atomic_replace_text_file(
        &source_path,
        &projected,
        "validity-records.tmp",
        "records.json tras evaluar vigencia",
    )?;
    let stored = match read_validated_source_at(data_root) {
        Ok(Some(stored)) => stored,
        Ok(None) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "validity-restore.tmp",
                "restauración de records.json",
            )?;
            return Err("records.json desapareció después de evaluar vigencia".into());
        }
        Err(error) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "validity-restore.tmp",
                "restauración de records.json",
            )?;
            return Err(format!(
                "La evaluación produjo una fuente inválida y fue restaurada: {error}"
            ));
        }
    };
    if stored.0 != projected || memory_subject_digest(&stored.0) != source_sha256_after {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "validity-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La evaluación no coincidió al releerla y fue restaurada".into());
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "validity-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La evaluación volvió incoherente el ciclo y fue restaurada".into());
    }
    let audit_action = match (input.action, source_declared) {
        (MemoryValidityAssessmentAction::ConfirmCurrent, false) => "validity-confirm-current",
        (MemoryValidityAssessmentAction::ConfirmCurrent, true) => {
            "validity-confirm-current-with-provenance"
        }
        (MemoryValidityAssessmentAction::MarkConflict, false) => "validity-mark-conflict",
        (MemoryValidityAssessmentAction::MarkConflict, true) => {
            "validity-mark-conflict-with-provenance"
        }
    };
    if let Err(audit_error) =
        append_memory_audit(&source_path, audit_action, sessions.len(), &projected)
    {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "validity-restore.tmp",
            "restauración de records.json",
        ) {
            return Err(format!(
                "Falló la auditoría de vigencia ({audit_error}) y también la restauración ({restore_error})"
            ));
        }
        return Err(format!(
            "Falló la auditoría de vigencia y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(MemoryValidityAssessmentResult {
        schema_version: 1,
        record_id: input.record_id,
        action: input.action,
        previous_validity: MemoryValidityState::NotAssessed,
        new_validity,
        source_sha256_before: source_sha256_before.clone(),
        source_sha256_after,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}

pub(super) fn accessibility_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("accessibility-source-{}.json", &source_sha256[7..]))
}

pub(super) fn create_or_verify_accessibility_backup(
    data_root: &Path,
    source_content: &str,
    source_sha256: &str,
) -> Result<PathBuf, String> {
    let backup = accessibility_source_backup_path(data_root, source_sha256);
    let parent = backup
        .parent()
        .ok_or("El respaldo de accesibilidad no posee directorio")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar el respaldo de accesibilidad: {error}"))?;
    if backup.exists() {
        let stored = fs::read_to_string(&backup).map_err(|error| {
            format!("No se pudo verificar el respaldo de accesibilidad: {error}")
        })?;
        if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
            return Err(
                "El respaldo existente de accesibilidad no coincide con records.json".into(),
            );
        }
        return Ok(backup);
    }
    atomic_replace_text_file(
        &backup,
        source_content,
        "accessibility-backup.tmp",
        "respaldo de accesibilidad",
    )?;
    let stored = fs::read_to_string(&backup)
        .map_err(|error| format!("No se pudo releer el respaldo de accesibilidad: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
        return Err("El respaldo de accesibilidad no coincide byte a byte".into());
    }
    Ok(backup)
}

pub(super) fn assess_memory_accessibility_at(
    data_root: &Path,
    input: AssessMemoryAccessibilityInput,
    now: String,
) -> Result<MemoryAccessibilityAssessmentResult, String> {
    if !input.confirmed {
        return Err("Cambiar la accesibilidad requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La evaluación de accesibilidad contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La evaluación de accesibilidad contiene un ID inválido".into());
    }
    validate_timestamp("accessibilityUpdatedAt", &now)?;
    let lifecycle_before = memory_lifecycle_preview_at(data_root);
    if matches!(
        lifecycle_before.state,
        MemoryLifecyclePreviewState::Unavailable | MemoryLifecyclePreviewState::Blocked
    ) {
        return Err(lifecycle_before
            .blocked_reason
            .unwrap_or_else(|| "La memoria no está disponible para evaluar accesibilidad".into()));
    }
    let source_path = data_root.join("memory").join("records.json");
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para evaluar accesibilidad")?;
    let source_sha256_before = memory_subject_digest(&source_content);
    if source_sha256_before != input.expected_source_sha256
        || lifecycle_before.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str())
    {
        return Err(
            "records.json cambió después de revisar la accesibilidad; actualizá antes de confirmar"
                .into(),
        );
    }
    let session = sessions
        .iter_mut()
        .find(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let current_reference = lifecycle_reference(session)?;
    if current_reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de revisar su accesibilidad".into());
    }
    if current_reference.validity != MemoryValidityState::Current {
        return Err("Sólo un recuerdo confirmado y vigente admite accesibilidad explícita".into());
    }
    let previous_accessibility = current_reference.accessibility;
    let new_accessibility = match input.action {
        MemoryAccessibilityAssessmentAction::MakeAccessible => MemoryAccessibilityState::Accessible,
        MemoryAccessibilityAssessmentAction::SetDormant => MemoryAccessibilityState::Dormant,
    };
    if previous_accessibility == new_accessibility {
        return Err("El recuerdo ya posee esa accesibilidad; no se escribió nada".into());
    }
    session.accessibility_status = Some(
        match new_accessibility {
            MemoryAccessibilityState::Accessible => "accessible",
            MemoryAccessibilityState::Dormant => "dormant",
            MemoryAccessibilityState::NotAssessed => unreachable!(),
        }
        .into(),
    );
    session.accessibility_updated_at = Some(now);
    validate_memory_sessions(&sessions)?;
    let projected = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo preparar la accesibilidad: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected);
    let backup =
        create_or_verify_accessibility_backup(data_root, &source_content, &source_sha256_before)?;
    atomic_replace_text_file(
        &source_path,
        &projected,
        "accessibility-records.tmp",
        "records.json tras evaluar accesibilidad",
    )?;
    let stored = match read_validated_source_at(data_root) {
        Ok(Some(stored)) => stored,
        Ok(None) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "accessibility-restore.tmp",
                "restauración de records.json",
            )?;
            return Err("records.json desapareció después de evaluar accesibilidad".into());
        }
        Err(error) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "accessibility-restore.tmp",
                "restauración de records.json",
            )?;
            return Err(format!(
                "La accesibilidad produjo una fuente inválida y fue restaurada: {error}"
            ));
        }
    };
    if stored.0 != projected || memory_subject_digest(&stored.0) != source_sha256_after {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "accessibility-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La accesibilidad no coincidió al releerla y fue restaurada".into());
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "accessibility-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La accesibilidad volvió incoherente el ciclo y fue restaurada".into());
    }
    let audit_action = match input.action {
        MemoryAccessibilityAssessmentAction::MakeAccessible => "accessibility-make-accessible",
        MemoryAccessibilityAssessmentAction::SetDormant => "accessibility-set-dormant",
    };
    if let Err(audit_error) =
        append_memory_audit(&source_path, audit_action, sessions.len(), &projected)
    {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "accessibility-restore.tmp",
            "restauración de records.json",
        ) {
            return Err(format!(
                "Falló la auditoría de accesibilidad ({audit_error}) y también la restauración ({restore_error})"
            ));
        }
        return Err(format!(
            "Falló la auditoría de accesibilidad y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(MemoryAccessibilityAssessmentResult {
        schema_version: 1,
        record_id: input.record_id,
        action: input.action,
        previous_accessibility,
        new_accessibility,
        source_sha256_before: source_sha256_before.clone(),
        source_sha256_after,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}

pub(super) fn suppression_reason_code(reason: MemorySuppressionReason) -> &'static str {
    match reason {
        MemorySuppressionReason::OwnerChoice => "ownerChoice",
        MemorySuppressionReason::SensitiveContext => "sensitiveContext",
        MemorySuppressionReason::TemporaryBoundary => "temporaryBoundary",
    }
}

pub(super) fn suppression_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("suppression-source-{}.json", &source_sha256[7..]))
}

pub(super) fn create_or_verify_suppression_backup(
    data_root: &Path,
    source_content: &str,
    source_sha256: &str,
) -> Result<PathBuf, String> {
    let backup = suppression_source_backup_path(data_root, source_sha256);
    let parent = backup
        .parent()
        .ok_or("El respaldo de supresión no posee directorio")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar el respaldo de supresión: {error}"))?;
    if backup.exists() {
        let stored = fs::read_to_string(&backup)
            .map_err(|error| format!("No se pudo verificar el respaldo de supresión: {error}"))?;
        if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
            return Err("El respaldo existente de supresión no coincide con records.json".into());
        }
        return Ok(backup);
    }
    atomic_replace_text_file(
        &backup,
        source_content,
        "suppression-backup.tmp",
        "respaldo de supresión",
    )?;
    let stored = fs::read_to_string(&backup)
        .map_err(|error| format!("No se pudo releer el respaldo de supresión: {error}"))?;
    if stored != source_content || memory_subject_digest(&stored) != source_sha256 {
        return Err("El respaldo de supresión no coincide byte a byte".into());
    }
    Ok(backup)
}

pub(super) fn assess_memory_suppression_at(
    data_root: &Path,
    input: AssessMemorySuppressionInput,
    now: String,
) -> Result<MemorySuppressionAssessmentResult, String> {
    if !input.confirmed {
        return Err("Cambiar la supresión requiere confirmación explícita".into());
    }
    if !is_sha256(&input.expected_source_sha256) || !is_sha256(&input.expected_record_sha256) {
        return Err("La decisión de supresión contiene una huella inválida".into());
    }
    if input.record_id.trim().is_empty() || input.record_id.len() > 160 {
        return Err("La decisión de supresión contiene un ID inválido".into());
    }
    validate_timestamp("suppressionUpdatedAt", &now)?;
    let lifecycle_before = memory_lifecycle_preview_at(data_root);
    if matches!(
        lifecycle_before.state,
        MemoryLifecyclePreviewState::Unavailable | MemoryLifecyclePreviewState::Blocked
    ) {
        return Err(lifecycle_before
            .blocked_reason
            .unwrap_or_else(|| "La memoria no está disponible para cambiar su supresión".into()));
    }
    let source_path = data_root.join("memory").join("records.json");
    let (source_content, mut sessions) = read_validated_source_at(data_root)?
        .ok_or("No existe records.json para cambiar la supresión")?;
    let source_sha256_before = memory_subject_digest(&source_content);
    if source_sha256_before != input.expected_source_sha256
        || lifecycle_before.source_sha256.as_deref() != Some(input.expected_source_sha256.as_str())
    {
        return Err(
            "records.json cambió después de revisar la supresión; actualizá antes de confirmar"
                .into(),
        );
    }
    let session = sessions
        .iter_mut()
        .find(|session| session.id == input.record_id)
        .ok_or("El recuerdo ya no existe")?;
    let current_reference = lifecycle_reference(session)?;
    if current_reference.record_sha256 != input.expected_record_sha256 {
        return Err("El recuerdo cambió después de revisar su supresión".into());
    }
    let previous_suppressed = current_reference.suppressed;
    let new_suppressed = input.action == MemorySuppressionAction::Suppress;
    if previous_suppressed == new_suppressed {
        return Err("El recuerdo ya posee ese estado de supresión; no se escribió nada".into());
    }
    if new_suppressed && current_reference.validity != MemoryValidityState::Current {
        return Err("Sólo un recuerdo confirmado y vigente puede suprimirse".into());
    }
    if new_suppressed {
        session.suppression_status = Some("suppressed".into());
        session.suppression_reason = Some(suppression_reason_code(input.reason).into());
        session.suppression_updated_at = Some(now);
    } else {
        session.suppression_status = None;
        session.suppression_reason = None;
        session.suppression_updated_at = None;
    }
    validate_memory_sessions(&sessions)?;
    let projected = serde_json::to_string_pretty(&sessions)
        .map_err(|error| format!("No se pudo preparar la decisión de supresión: {error}"))?;
    let source_sha256_after = memory_subject_digest(&projected);
    let backup =
        create_or_verify_suppression_backup(data_root, &source_content, &source_sha256_before)?;
    atomic_replace_text_file(
        &source_path,
        &projected,
        "suppression-records.tmp",
        "records.json tras cambiar la supresión",
    )?;
    let stored = match read_validated_source_at(data_root) {
        Ok(Some(stored)) => stored,
        Ok(None) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "suppression-restore.tmp",
                "restauración de records.json",
            )?;
            return Err("records.json desapareció después de cambiar la supresión".into());
        }
        Err(error) => {
            atomic_replace_text_file(
                &source_path,
                &source_content,
                "suppression-restore.tmp",
                "restauración de records.json",
            )?;
            return Err(format!(
                "La supresión produjo una fuente inválida y fue restaurada: {error}"
            ));
        }
    };
    if stored.0 != projected || memory_subject_digest(&stored.0) != source_sha256_after {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "suppression-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La supresión no coincidió al releerla y fue restaurada".into());
    }
    let lifecycle = memory_lifecycle_preview_at(data_root);
    if lifecycle.state == MemoryLifecyclePreviewState::Blocked {
        atomic_replace_text_file(
            &source_path,
            &source_content,
            "suppression-restore.tmp",
            "restauración de records.json",
        )?;
        return Err("La supresión volvió incoherente el ciclo y fue restaurada".into());
    }
    let audit_action = format!(
        "suppression-{}-{}",
        if new_suppressed {
            "suppress"
        } else {
            "release"
        },
        suppression_reason_code(input.reason)
    );
    if let Err(audit_error) =
        append_memory_audit(&source_path, &audit_action, sessions.len(), &projected)
    {
        if let Err(restore_error) = atomic_replace_text_file(
            &source_path,
            &source_content,
            "suppression-restore.tmp",
            "restauración de records.json",
        ) {
            return Err(format!("Falló la auditoría de supresión ({audit_error}) y también la restauración ({restore_error})"));
        }
        return Err(format!(
            "Falló la auditoría de supresión y records.json fue restaurado: {audit_error}"
        ));
    }
    Ok(MemorySuppressionAssessmentResult {
        schema_version: 1,
        record_id: input.record_id,
        action: input.action,
        reason: input.reason,
        previous_suppressed,
        new_suppressed,
        source_sha256_before: source_sha256_before.clone(),
        source_sha256_after,
        backup_sha256: memory_subject_digest(
            &fs::read_to_string(backup)
                .map_err(|error| format!("No se pudo verificar el respaldo final: {error}"))?,
        ),
        records_modified: true,
        audit_written: true,
        lifecycle,
    })
}
