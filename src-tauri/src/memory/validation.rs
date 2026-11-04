//! Pure checks on records and governed documents; no filesystem or Tauri calls.
use super::model::{
    ConfirmedConversationLearningAppendInput, ConfirmedLearningAppendInput,
    ConsolidationDecisionDocument, ConsolidationTransactionDocument, ConsolidationTransactionState,
    LayeredMemoryDocument, MemoryAccessibilityState, MemoryGraphEvidenceUse,
    MemoryLifecycleDocument, MemoryLifecycleReference, MemoryRetentionState, MemoryRetrievalPolicy,
    MemorySession, MemoryValidityState,
};
use super::queries::graph_references_from_source;
use super::storage::memory_subject_digest;
use super::{
    CONSOLIDATION_DECISION_SCHEMA_VERSION, CONSOLIDATION_TRANSACTION_SCHEMA_VERSION,
    LAYERED_MEMORY_SCHEMA_VERSION, MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION,
};
use crate::capabilities::validate_timestamp;
use std::collections::HashSet;

// R8.2 only accepts exact author input from eligible episodes, never model replies.
pub(crate) fn validate_graph_episode_evidence(
    content: &str,
    id: &str,
    version: u32,
    hash: &str,
    quote: &str,
) -> Result<(usize, usize), String> {
    if quote.trim().is_empty() || quote.len() > 2048 {
        return Err("La evidencia debe contener texto y no superar 2048 bytes".into());
    }
    let references = graph_references_from_source(content)?;
    let reference = references
        .iter()
        .find(|r| r.lifecycle.record_id == id)
        .ok_or("La fuente ya no existe")?;
    if reference.record_version != version || reference.lifecycle.record_sha256 != hash {
        return Err("La fuente cambió: reconstruya la propuesta".into());
    }
    if reference.evidence_use != MemoryGraphEvidenceUse::EpisodeOnly {
        return Err("La fuente no es un episodio recuperable".into());
    }
    let sessions: Vec<MemorySession> =
        serde_json::from_str(content).map_err(|_| "Fuente inválida")?;
    let session = sessions
        .iter()
        .find(|r| r.id == id)
        .ok_or("La fuente ya no existe")?;
    let start = session
        .intention
        .find(quote)
        .ok_or("La cita no aparece en la entrada del episodio")?;
    Ok((start, start + quote.len()))
}

pub(super) fn validate_memory_sessions(sessions: &[MemorySession]) -> Result<(), String> {
    let mut ids = HashSet::with_capacity(sessions.len());
    for (index, session) in sessions.iter().enumerate() {
        crate::memory_affect::validate_affects(&session.affects, None)?;
        let record = index + 1;
        if session.id.trim().is_empty() || !ids.insert(session.id.trim()) {
            return Err(format!(
                "El recuerdo {record} tiene un identificador vacío o duplicado"
            ));
        }
        if session.intention.trim().is_empty() || session.started_at.trim().is_empty() {
            return Err(format!(
                "El recuerdo {record} no tiene tema o fecha de inicio"
            ));
        }
        if !matches!(
            session.kind.as_str(),
            "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza"
        ) {
            return Err(format!("El recuerdo {record} tiene un tipo desconocido"));
        }
        if let Some(memory_type) = session.memory_type.as_deref() {
            if !matches!(
                memory_type,
                "semantic" | "procedural" | "preference" | "episodic"
            ) {
                return Err(format!(
                    "El recuerdo {record} tiene una clase de memoria desconocida"
                ));
            }
        }
        if let Some(status) = session.memory_status.as_deref() {
            if !matches!(status, "confirmed" | "conflict" | "archived") {
                return Err(format!("El recuerdo {record} tiene un estado desconocido"));
            }
        }
        if let Some(accessibility) = session.accessibility_status.as_deref() {
            if !matches!(accessibility, "accessible" | "dormant") {
                return Err(format!(
                    "El recuerdo {record} tiene una accesibilidad desconocida"
                ));
            }
            if session.accessibility_updated_at.is_none() {
                return Err(format!(
                    "El recuerdo {record} no conserva cuándo se decidió su accesibilidad"
                ));
            }
        } else if session.accessibility_updated_at.is_some() {
            return Err(format!(
                "El recuerdo {record} tiene fecha de accesibilidad sin una decisión"
            ));
        }
        if let Some(updated_at) = session.accessibility_updated_at.as_deref() {
            validate_timestamp("accessibilityUpdatedAt", updated_at)?;
        }
        if let Some(status) = session.suppression_status.as_deref() {
            if status != "suppressed"
                || !matches!(
                    session.suppression_reason.as_deref(),
                    Some("ownerChoice" | "sensitiveContext" | "temporaryBoundary")
                )
                || session.suppression_updated_at.is_none()
            {
                return Err(format!(
                    "El recuerdo {record} declara una supresión incoherente"
                ));
            }
        } else if session.suppression_reason.is_some() || session.suppression_updated_at.is_some() {
            return Err(format!(
                "El recuerdo {record} conserva metadatos de supresión sin estar suprimido"
            ));
        }
        if let Some(updated_at) = session.suppression_updated_at.as_deref() {
            validate_timestamp("suppressionUpdatedAt", updated_at)?;
        }
        if let Some(status) = session.archive_status.as_deref() {
            if status != "archived"
                || !matches!(
                    session.archive_reason.as_deref(),
                    Some("ownerChoice" | "superseded" | "noLongerRelevant")
                )
                || session.archive_updated_at.is_none()
                || session.memory_status.as_deref() == Some("archived")
            {
                return Err(format!(
                    "El recuerdo {record} declara un archivo reversible incoherente"
                ));
            }
        } else if session.archive_reason.is_some() || session.archive_updated_at.is_some() {
            return Err(format!(
                "El recuerdo {record} conserva metadatos de archivo sin estar archivado"
            ));
        }
        if let Some(updated_at) = session.archive_updated_at.as_deref() {
            validate_timestamp("archiveUpdatedAt", updated_at)?;
        }
        if let Some(status) = session.deletion_status.as_deref() {
            if status != "scheduled"
                || !matches!(
                    session.deletion_reason.as_deref(),
                    Some("ownerRequest" | "duplicateAfterMerge" | "privacyRemoval")
                )
                || session.deletion_requested_at.is_none()
                || session.deletion_eligible_at.is_none()
                || session.archive_status.as_deref() != Some("archived")
            {
                return Err(format!(
                    "El recuerdo {record} declara una eliminación programada incoherente"
                ));
            }
        } else if session.deletion_reason.is_some()
            || session.deletion_requested_at.is_some()
            || session.deletion_eligible_at.is_some()
        {
            return Err(format!(
                "El recuerdo {record} conserva metadatos de eliminación sin estar programado"
            ));
        }
        if let Some(requested_at) = session.deletion_requested_at.as_deref() {
            validate_timestamp("deletionRequestedAt", requested_at)?;
        }
        if let Some(eligible_at) = session.deletion_eligible_at.as_deref() {
            validate_timestamp("deletionEligibleAt", eligible_at)?;
            if session
                .deletion_requested_at
                .as_deref()
                .is_some_and(|requested_at| eligible_at <= requested_at)
            {
                return Err(format!(
                    "El recuerdo {record} no conserva una espera de eliminación válida"
                ));
            }
        }
        match session.memory_version {
            Some(version) => {
                if version < 2
                    || session.reconsolidated_at.is_none()
                    || !matches!(
                        session.reconsolidation_reason.as_deref(),
                        Some("ownerCorrection" | "newContext" | "clarification")
                    )
                    || !session
                        .previous_version_sha256
                        .as_deref()
                        .is_some_and(is_sha256)
                {
                    return Err(format!(
                        "El recuerdo {record} declara una reconsolidación incoherente"
                    ));
                }
            }
            None => {
                if session.reconsolidated_at.is_some()
                    || session.reconsolidation_reason.is_some()
                    || session.previous_version_sha256.is_some()
                {
                    return Err(format!(
                        "El recuerdo {record} conserva metadatos de reconsolidación sin versión"
                    ));
                }
            }
        }
        if let Some(updated_at) = session.reconsolidated_at.as_deref() {
            validate_timestamp("reconsolidatedAt", updated_at)?;
        }
        if let Some(version) = session.retrieval_evidence_version {
            if version != 1
                || session.kind != "Enseñanza"
                || session
                    .successful_recalls
                    .saturating_add(session.failed_recalls)
                    == 0
                || session.last_recalled_at.is_none()
            {
                return Err(format!(
                    "El recuerdo {record} declara evidencia de recuperación incoherente"
                ));
            }
            validate_timestamp(
                "lastRecalledAt",
                session.last_recalled_at.as_deref().unwrap_or_default(),
            )?;
        }
        if session
            .importance
            .is_some_and(|value| !(1..=5).contains(&value))
        {
            return Err(format!(
                "El recuerdo {record} tiene una importancia fuera de 1 a 5"
            ));
        }
        if session
            .storage_strength
            .is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
        {
            return Err(format!(
                "El recuerdo {record} tiene una consolidación fuera de 0 a 1"
            ));
        }
    }
    Ok(())
}

pub(super) fn is_sha256(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

pub(super) fn validate_consolidation_decisions(
    document: &ConsolidationDecisionDocument,
) -> Result<(), String> {
    if document.schema_version != CONSOLIDATION_DECISION_SCHEMA_VERSION {
        return Err("El registro de decisiones R6.3 usa una versión incompatible".into());
    }
    let mut decision_ids = HashSet::with_capacity(document.decisions.len());
    let mut candidate_sources = HashSet::with_capacity(document.decisions.len());
    for decision in &document.decisions {
        if !is_sha256(&decision.decision_id)
            || !is_sha256(&decision.candidate_id)
            || !is_sha256(&decision.source_sha256)
        {
            return Err("El registro de decisiones R6.3 contiene una huella inválida".into());
        }
        if decision.record_ids.len() != 2
            || decision.record_ids.iter().any(|id| id.trim().is_empty())
            || decision.record_ids[0] >= decision.record_ids[1]
        {
            return Err("El registro de decisiones R6.3 contiene un par inválido".into());
        }
        validate_timestamp("decidedAt", &decision.decided_at)?;
        if !decision_ids.insert(decision.decision_id.clone())
            || !candidate_sources.insert(format!(
                "{}:{}",
                decision.source_sha256, decision.candidate_id
            ))
        {
            return Err("El registro de decisiones R6.3 contiene decisiones repetidas".into());
        }
    }
    Ok(())
}

pub(super) fn lifecycle_reference_is_consistent(reference: &MemoryLifecycleReference) -> bool {
    let policy_matches = matches!(
        (
            reference.validity,
            reference.accessibility,
            reference.suppressed,
            reference.archived,
            reference.retrieval_policy
        ),
        (_, _, _, true, MemoryRetrievalPolicy::BlockedByArchive)
            | (
                MemoryValidityState::Current,
                _,
                true,
                false,
                MemoryRetrievalPolicy::BlockedBySuppression
            )
            | (
                MemoryValidityState::NotAssessed,
                _,
                true,
                false,
                MemoryRetrievalPolicy::BlockedBySuppression
            )
            | (
                MemoryValidityState::Current,
                MemoryAccessibilityState::NotAssessed | MemoryAccessibilityState::Accessible,
                false,
                false,
                MemoryRetrievalPolicy::Eligible
            )
            | (
                MemoryValidityState::Current | MemoryValidityState::NotAssessed,
                MemoryAccessibilityState::Dormant,
                false,
                false,
                MemoryRetrievalPolicy::BlockedByDormancy
            )
            | (
                MemoryValidityState::Conflict,
                _,
                _,
                false,
                MemoryRetrievalPolicy::BlockedByConflict
            )
            | (
                MemoryValidityState::NotAssessed,
                MemoryAccessibilityState::NotAssessed | MemoryAccessibilityState::Accessible,
                false,
                false,
                MemoryRetrievalPolicy::LegacyEligible
            )
    );
    !reference.record_id.trim().is_empty()
        && is_sha256(&reference.record_sha256)
        && policy_matches
        && matches!(
            reference.retention,
            MemoryRetentionState::NotAssessed | MemoryRetentionState::DeletionScheduled
        )
        && reference.base_version == 1
}

pub(super) fn validate_memory_lifecycle_document(
    document: &MemoryLifecycleDocument,
) -> Result<(), String> {
    if document.schema_version != MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION {
        return Err("lifecycle-index-v1.json usa una versión incompatible".into());
    }
    if document.revisions.len() > 100 {
        return Err("lifecycle-index-v1.json supera 100 revisiones".into());
    }
    let mut revision_ids = HashSet::with_capacity(document.revisions.len());
    for revision in &document.revisions {
        if !is_sha256(&revision.revision_id) || !revision_ids.insert(&revision.revision_id) {
            return Err("El ciclo de memoria contiene una revisión inválida o repetida".into());
        }
        validate_timestamp("createdAt", &revision.created_at)?;
        if revision.source.records_file != "records.json"
            || !is_sha256(&revision.source.sha256)
            || revision.source.record_count != revision.references.len()
        {
            return Err("Una revisión del ciclo no corresponde a una fuente válida".into());
        }
        let expected_revision_id = memory_subject_digest(&format!(
            "alice-memory-lifecycle:{}:{}",
            MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION, revision.source.sha256
        ));
        if revision.revision_id != expected_revision_id {
            return Err("Una revisión del ciclo no coincide con la huella de su fuente".into());
        }
        let mut record_ids = HashSet::with_capacity(revision.references.len());
        if revision.references.iter().any(|reference| {
            !lifecycle_reference_is_consistent(reference)
                || !record_ids.insert(reference.record_id.as_str())
        }) {
            return Err("Una revisión del ciclo contiene referencias inválidas".into());
        }
    }
    if document
        .active_revision_id
        .as_ref()
        .is_some_and(|active| !revision_ids.contains(active))
    {
        return Err("La revisión activa del ciclo no existe".into());
    }
    Ok(())
}

pub(super) fn validate_confirmed_learning_append(
    input: &ConfirmedLearningAppendInput,
) -> Result<(), String> {
    if !is_sha256(&input.candidate_id) {
        return Err("El candidato de aprendizaje no posee una huella válida".into());
    }
    if input.source_record_id.trim().is_empty() || input.source_record_id.len() > 160 {
        return Err("El recuerdo de origen no posee un identificador válido".into());
    }
    if input.model.trim().is_empty() || input.model.len() > 160 {
        return Err("El modelo de origen no posee un identificador válido".into());
    }
    if input.intention.trim().is_empty()
        || input.intention.chars().count() > 100
        || input.summary.trim().is_empty()
        || input.summary.chars().count() > 420
        || !matches!(
            input.memory_type.as_str(),
            "semantic" | "procedural" | "preference" | "episodic"
        )
        || !(1..=5).contains(&input.importance)
    {
        return Err("La edición confirmada del candidato está fuera del contrato R6.4-C".into());
    }
    validate_timestamp("confirmedAt", &input.confirmed_at)
}

pub(super) fn validate_confirmed_conversation_learning_append(
    input: &ConfirmedConversationLearningAppendInput,
) -> Result<(), String> {
    if !is_sha256(&input.candidate_id) || !is_sha256(&input.conversation_source_sha256) {
        return Err("La propuesta de conversación no posee huellas válidas".into());
    }
    if uuid::Uuid::parse_str(&input.conversation_exchange_id)
        .map(|id| id.to_string() != input.conversation_exchange_id)
        .unwrap_or(true)
    {
        return Err("El intercambio de conversación no posee un UUID válido".into());
    }
    validate_confirmed_learning_append(&ConfirmedLearningAppendInput {
        candidate_id: input.candidate_id.clone(),
        source_record_id: input.conversation_exchange_id.clone(),
        model: input.model.clone(),
        intention: input.intention.clone(),
        summary: input.summary.clone(),
        memory_type: input.memory_type.clone(),
        importance: input.importance,
        confirmed_at: input.confirmed_at.clone(),
    })
}

pub(super) fn validate_consolidation_transactions(
    document: &ConsolidationTransactionDocument,
) -> Result<(), String> {
    if document.schema_version != CONSOLIDATION_TRANSACTION_SCHEMA_VERSION {
        return Err("El recibo R6.3-E usa una versión incompatible".into());
    }
    if document.transactions.len() > 100 {
        return Err("El recibo R6.3-E supera 100 transacciones".into());
    }
    let mut transaction_ids = HashSet::new();
    let mut active_count = 0usize;
    for receipt in &document.transactions {
        if !is_sha256(&receipt.transaction_id)
            || !is_sha256(&receipt.candidate_id)
            || !is_sha256(&receipt.source_sha256)
            || !is_sha256(&receipt.projected_source_sha256)
        {
            return Err("El recibo R6.3-E contiene una huella inválida".into());
        }
        if !transaction_ids.insert(receipt.transaction_id.clone()) {
            return Err("El recibo R6.3-E repite un ID de transacción".into());
        }
        if receipt.record_ids.len() != 2
            || receipt.record_ids[0] >= receipt.record_ids[1]
            || !receipt.record_ids.contains(&receipt.survivor_record_id)
            || !receipt.record_ids.contains(&receipt.duplicate_record_id)
            || receipt.survivor_record_id == receipt.duplicate_record_id
        {
            return Err("El recibo R6.3-E contiene un par incoherente".into());
        }
        validate_timestamp("createdAt", &receipt.created_at)?;
        if let Some(restored_at) = &receipt.restored_at {
            validate_timestamp("restoredAt", restored_at)?;
        }
        let expected_backup = format!("consolidation-source-{}.json", &receipt.source_sha256[7..]);
        if receipt.source_backup_file != expected_backup
            || receipt.source_backup_file.contains(['/', '\\'])
        {
            return Err("El recibo R6.3-E contiene un respaldo inesperado".into());
        }
        match receipt.state {
            ConsolidationTransactionState::Restored if receipt.restored_at.is_none() => {
                return Err("Una transacción restaurada requiere restoredAt".into());
            }
            ConsolidationTransactionState::Prepared | ConsolidationTransactionState::Projected => {
                if receipt.restored_at.is_some() {
                    return Err("Una transacción activa no puede declarar restoredAt".into());
                }
                active_count += 1;
            }
            ConsolidationTransactionState::Restored => {}
        }
    }
    if active_count > 1 {
        return Err("R6.3-E admite una sola transacción sin restaurar".into());
    }
    Ok(())
}

pub(super) fn validate_layered_document(document: &LayeredMemoryDocument) -> Result<(), String> {
    if document.schema_version != LAYERED_MEMORY_SCHEMA_VERSION {
        return Err("layer-index-v3.json usa una versión desconocida".into());
    }
    let mut revision_ids = HashSet::with_capacity(document.revisions.len());
    for (index, revision) in document.revisions.iter().enumerate() {
        let number = index + 1;
        if !is_sha256(&revision.revision_id) || !revision_ids.insert(&revision.revision_id) {
            return Err(format!(
                "La revisión R6 {number} tiene un ID inválido o duplicado"
            ));
        }
        validate_timestamp("createdAt", &revision.created_at)?;
        if revision.source.records_file != "records.json" || !is_sha256(&revision.source.sha256) {
            return Err(format!("La revisión R6 {number} tiene una fuente inválida"));
        }
        if !revision.layers.working.is_empty() {
            return Err("R6.1 no admite memoria de trabajo persistente".into());
        }
        let mut record_ids = HashSet::with_capacity(revision.source.record_count);
        for record_id in revision
            .layers
            .episodic
            .iter()
            .chain(revision.layers.taught_facts.iter())
            .map(|item| item.record_id.as_str())
            .chain(
                revision
                    .layers
                    .procedural
                    .iter()
                    .map(|item| item.record_id.as_str()),
            )
            .chain(
                revision
                    .unclassified
                    .iter()
                    .map(|item| item.record_id.as_str()),
            )
        {
            if record_id.trim().is_empty() || !record_ids.insert(record_id) {
                return Err(format!(
                    "La revisión R6 {number} contiene una referencia vacía o duplicada"
                ));
            }
        }
        if record_ids.len() != revision.source.record_count {
            return Err(format!(
                "La revisión R6 {number} no clasifica exactamente todos sus registros"
            ));
        }
        let expected_revision_id = memory_subject_digest(&format!(
            "alice-layered-memory:{}:{}",
            LAYERED_MEMORY_SCHEMA_VERSION, revision.source.sha256
        ));
        if revision.revision_id != expected_revision_id {
            return Err(format!(
                "La revisión R6 {number} no coincide con la huella de su fuente"
            ));
        }
    }
    if document
        .active_revision_id
        .as_ref()
        .is_some_and(|active| !revision_ids.contains(active))
    {
        return Err("La revisión activa R6 no existe en el historial".into());
    }
    Ok(())
}

pub(super) fn validate_generic_memory_update(
    existing: &[MemorySession],
    sessions: &[MemorySession],
) -> Result<(), String> {
    for previous in existing {
        let protected = matches!(
            previous.memory_status.as_deref(),
            Some("confirmed" | "conflict" | "archived")
        ) || previous.memory_version.is_some()
            || previous.archive_status.is_some()
            || previous.deletion_status.is_some();
        let Some(next) = sessions.iter().find(|session| session.id == previous.id) else {
            if protected {
                return Err(format!(
                    "El recuerdo '{}' posee estado durable: no puede eliminarse mediante el guardado genérico",
                    previous.id
                ));
            }
            continue;
        };
        if matches!(
            previous.memory_status.as_deref(),
            Some("confirmed" | "conflict")
        ) && (previous.intention != next.intention
            || previous.summary != next.summary
            || previous.next_step != next.next_step
            || previous.source != next.source)
        {
            return Err(format!(
                "El recuerdo '{}' está confirmado o en conflicto: su contenido sólo puede cambiar mediante reconsolidación versionada",
                previous.id
            ));
        }
        if previous.memory_version != next.memory_version
            || previous.reconsolidated_at != next.reconsolidated_at
            || previous.reconsolidation_reason != next.reconsolidation_reason
            || previous.previous_version_sha256 != next.previous_version_sha256
        {
            return Err(format!(
                "El historial versionado de '{}' sólo puede cambiar mediante reconsolidación",
                previous.id
            ));
        }
        if previous.archive_status != next.archive_status
            || previous.archive_reason != next.archive_reason
            || previous.archive_updated_at != next.archive_updated_at
        {
            return Err(format!(
                "El archivo reversible de '{}' sólo puede cambiar mediante su contrato gobernado",
                previous.id
            ));
        }
        if previous.deletion_status != next.deletion_status
            || previous.deletion_reason != next.deletion_reason
            || previous.deletion_requested_at != next.deletion_requested_at
            || previous.deletion_eligible_at != next.deletion_eligible_at
        {
            return Err(format!(
                "La retención de eliminación de '{}' sólo puede cambiar mediante su contrato gobernado",
                previous.id
            ));
        }
    }
    if sessions.iter().any(|session| {
        !existing.iter().any(|previous| previous.id == session.id)
            && (session.memory_version.is_some()
                || session.reconsolidated_at.is_some()
                || session.reconsolidation_reason.is_some()
                || session.previous_version_sha256.is_some()
                || session.archive_status.is_some()
                || session.archive_reason.is_some()
                || session.archive_updated_at.is_some()
                || session.deletion_status.is_some()
                || session.deletion_reason.is_some()
                || session.deletion_requested_at.is_some()
                || session.deletion_eligible_at.is_some())
    }) {
        return Err("Un recuerdo nuevo debe comenzar en su versión base".into());
    }
    Ok(())
}
