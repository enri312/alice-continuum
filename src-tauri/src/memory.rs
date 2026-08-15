use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::capabilities::{current_utc_timestamp, validate_timestamp};
use crate::util::{alice_data_root, alice_data_root_path, timestamp_ms};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::AppHandle;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryContextEvent {
    #[serde(rename = "type")]
    event_type: String,
    recorded_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySession {
    id: String,
    kind: String,
    intention: String,
    started_at: String,
    finished_at: Option<String>,
    summary: Option<String>,
    next_step: Option<String>,
    memory_type: Option<String>,
    source: Option<String>,
    importance: Option<u8>,
    storage_strength: Option<f64>,
    memory_status: Option<String>,
    #[serde(default)]
    successful_recalls: u32,
    #[serde(default)]
    failed_recalls: u32,
    last_recalled_at: Option<String>,
    #[serde(default)]
    successful_reviews: u32,
    #[serde(default)]
    correction_count: u32,
    last_reviewed_at: Option<String>,
    #[serde(default)]
    context_events: Vec<MemoryContextEvent>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySnapshot {
    sessions: Vec<MemorySession>,
    storage_path: String,
    existed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MemoryResourceState {
    Missing,
    Valid,
    Invalid,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MemoryCapabilityProbe {
    pub(crate) directory_exists: bool,
    pub(crate) manifest: MemoryResourceState,
    pub(crate) records: MemoryResourceState,
    pub(crate) backup: MemoryResourceState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryAuditEntry {
    timestamp_ms: u128,
    action: String,
    session_count: usize,
    sha256: String,
}

const LAYERED_MEMORY_SCHEMA_VERSION: u8 = 1;
const LAYERED_MEMORY_FILE: &str = "layer-index-v2.json";
const CONSOLIDATION_PREVIEW_SCHEMA_VERSION: u8 = 1;
const CONSOLIDATION_MAX_RECORDS: usize = 1_000;
const CONSOLIDATION_MAX_CANDIDATES: usize = 2_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum LayeredMemoryState {
    Unavailable,
    Ready,
    Active,
    SourceChanged,
    RolledBack,
    Blocked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredMemorySource {
    records_file: String,
    sha256: String,
    record_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredMemoryReference {
    record_id: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum UnclassifiedMemoryReason {
    ProceduralNeedsR5Link,
    PreferenceNeedsOwnLayer,
    MissingExplicitType,
    UnsupportedExplicitType,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UnclassifiedMemoryReference {
    record_id: String,
    reason: UnclassifiedMemoryReason,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredMemoryLayers {
    working: Vec<LayeredMemoryReference>,
    episodic: Vec<LayeredMemoryReference>,
    taught_facts: Vec<LayeredMemoryReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredMemoryRevision {
    revision_id: String,
    created_at: String,
    source: LayeredMemorySource,
    layers: LayeredMemoryLayers,
    unclassified: Vec<UnclassifiedMemoryReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredMemoryDocument {
    schema_version: u8,
    active_revision_id: Option<String>,
    revisions: Vec<LayeredMemoryRevision>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LayeredMemoryPreview {
    source_sha256: String,
    record_count: usize,
    working_count: usize,
    episodic_count: usize,
    taught_fact_count: usize,
    unclassified_count: usize,
    procedural_pending_count: usize,
    preference_pending_count: usize,
    content_copied: bool,
    automatic_classification: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LayeredMemorySnapshot {
    schema_version: u8,
    state: LayeredMemoryState,
    storage_path: String,
    source_sha256: Option<String>,
    active_revision_id: Option<String>,
    revision_count: usize,
    preview: Option<LayeredMemoryPreview>,
    blocked_reason: Option<String>,
    migration_requires_confirmation: bool,
    automatic_migration: bool,
    content_copied: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationPreviewState {
    Unavailable,
    Ready,
    Blocked,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationCandidateKind {
    ExactDuplicate,
    ReviewRequired,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationReasonCode {
    ExactNormalizedContent,
    SameNormalizedIntentionDifferentContent,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationCandidate {
    candidate_id: String,
    kind: ConsolidationCandidateKind,
    record_ids: Vec<String>,
    reason_code: ConsolidationReasonCode,
    requires_human_review: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationPreviewSnapshot {
    schema_version: u8,
    state: ConsolidationPreviewState,
    storage_path: String,
    source_sha256: Option<String>,
    record_count: usize,
    eligible_record_count: usize,
    archived_record_count: usize,
    candidate_count: usize,
    exact_duplicate_count: usize,
    review_required_count: usize,
    candidates: Vec<ConsolidationCandidate>,
    blocked_reason: Option<String>,
    automatic_merge: bool,
    records_modified: bool,
    model_used: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ActivateLayeredMemoryInput {
    expected_source_sha256: String,
    confirmed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RollbackLayeredMemoryInput {
    expected_revision_id: String,
    confirmed: bool,
}

fn validate_memory_sessions(sessions: &[MemorySession]) -> Result<(), String> {
    let mut ids = HashSet::with_capacity(sessions.len());
    for (index, session) in sessions.iter().enumerate() {
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

fn inspect_memory_records(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<Vec<MemorySession>>(&content) {
            Ok(sessions) if validate_memory_sessions(&sessions).is_ok() => {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

fn inspect_memory_manifest(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(value)
                if value.get("format").and_then(|item| item.as_str()) == Some("alice-memory")
                    && value.get("version").and_then(|item| item.as_u64()) == Some(1)
                    && value.get("recordsFile").and_then(|item| item.as_str())
                        == Some("records.json") =>
            {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

pub(crate) fn memory_capability_probe(data_root: &Path) -> MemoryCapabilityProbe {
    let directory = data_root.join("memory");
    MemoryCapabilityProbe {
        directory_exists: directory.is_dir(),
        manifest: inspect_memory_manifest(&directory.join("manifest.json")),
        records: inspect_memory_records(&directory.join("records.json")),
        backup: inspect_memory_records(&directory.join("backups").join("records.backup.json")),
    }
}

fn append_memory_audit(
    path: &Path,
    action: &str,
    session_count: usize,
    content: &str,
) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?;
    let entry = MemoryAuditEntry {
        timestamp_ms: timestamp_ms()?,
        action: action.to_string(),
        session_count,
        sha256: format!("{:x}", Sha256::digest(content.as_bytes())),
    };
    let line = serde_json::to_string(&entry).map_err(|error| error.to_string())?;
    let audit_directory = directory.join("audit");
    fs::create_dir_all(&audit_directory)
        .map_err(|error| format!("No se pudo crear la carpeta de auditoría: {error}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(audit_directory.join("memory-events.jsonl"))
        .map_err(|error| format!("No se pudo abrir la auditoría de memoria: {error}"))?;
    writeln!(file, "{line}").map_err(|error| format!("No se pudo registrar la auditoría: {error}"))
}

fn memory_subject_digest(content: &str) -> String {
    format!("sha256:{:x}", Sha256::digest(content.as_bytes()))
}

fn is_sha256(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn layered_memory_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(LAYERED_MEMORY_FILE)
}

fn read_validated_source_at(
    data_root: &Path,
) -> Result<Option<(String, Vec<MemorySession>)>, String> {
    let path = data_root.join("memory").join("records.json");
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("No se pudo leer records.json: {error}")),
    };
    let sessions = serde_json::from_str::<Vec<MemorySession>>(&content)
        .map_err(|error| format!("records.json no es una memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    Ok(Some((content, sessions)))
}

fn normalize_consolidation_text(value: &str) -> String {
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

fn normalized_memory_signature(session: &MemorySession) -> String {
    [
        normalize_consolidation_text(&session.kind),
        normalize_consolidation_text(session.memory_type.as_deref().unwrap_or("")),
        normalize_consolidation_text(&session.intention),
        normalize_consolidation_text(session.summary.as_deref().unwrap_or("")),
        normalize_consolidation_text(session.next_step.as_deref().unwrap_or("")),
    ]
    .join("\u{1f}")
}

fn empty_consolidation_snapshot(
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
        exact_duplicate_count: 0,
        review_required_count: 0,
        candidates: Vec::new(),
        blocked_reason,
        automatic_merge: false,
        records_modified: false,
        model_used: false,
    }
}

fn consolidation_preview_at(data_root: &Path) -> ConsolidationPreviewSnapshot {
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
        .filter(|session| session.memory_status.as_deref() == Some("archived"))
        .count();
    let mut eligible = sessions
        .iter()
        .filter(|session| {
            session.finished_at.is_some() && session.memory_status.as_deref() != Some("archived")
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
            });
        }
    }

    let exact_duplicate_count = candidates
        .iter()
        .filter(|candidate| candidate.kind == ConsolidationCandidateKind::ExactDuplicate)
        .count();
    let review_required_count = candidates.len() - exact_duplicate_count;
    ConsolidationPreviewSnapshot {
        schema_version: CONSOLIDATION_PREVIEW_SCHEMA_VERSION,
        state: ConsolidationPreviewState::Ready,
        storage_path,
        source_sha256: Some(source_sha256),
        record_count: sessions.len(),
        eligible_record_count: eligible.len(),
        archived_record_count,
        candidate_count: candidates.len(),
        exact_duplicate_count,
        review_required_count,
        candidates,
        blocked_reason: None,
        automatic_merge: false,
        records_modified: false,
        model_used: false,
    }
}

fn classify_layered_memory(
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
        } else {
            let reason = match session.memory_type.as_deref() {
                Some("procedural") => UnclassifiedMemoryReason::ProceduralNeedsR5Link,
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
        },
        unclassified,
    }
}

fn layered_preview(revision: &LayeredMemoryRevision) -> LayeredMemoryPreview {
    LayeredMemoryPreview {
        source_sha256: revision.source.sha256.clone(),
        record_count: revision.source.record_count,
        working_count: revision.layers.working.len(),
        episodic_count: revision.layers.episodic.len(),
        taught_fact_count: revision.layers.taught_facts.len(),
        unclassified_count: revision.unclassified.len(),
        procedural_pending_count: revision
            .unclassified
            .iter()
            .filter(|item| item.reason == UnclassifiedMemoryReason::ProceduralNeedsR5Link)
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

fn revision_matches_projection(
    stored: &LayeredMemoryRevision,
    expected: &LayeredMemoryRevision,
) -> bool {
    stored.revision_id == expected.revision_id
        && stored.source == expected.source
        && stored.layers == expected.layers
        && stored.unclassified == expected.unclassified
}

fn validate_layered_document(document: &LayeredMemoryDocument) -> Result<(), String> {
    if document.schema_version != LAYERED_MEMORY_SCHEMA_VERSION {
        return Err("layer-index-v2.json usa una versión desconocida".into());
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

fn read_layered_document_at(data_root: &Path) -> Result<Option<LayeredMemoryDocument>, String> {
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

fn layered_memory_status_at(data_root: &Path) -> LayeredMemorySnapshot {
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

fn blocked_layered_snapshot(
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

fn write_layered_document_at(
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
        fs::copy(&path, backups.join("layer-index-v2.backup.json"))
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

fn memory_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = alice_data_root(app)?.join("memory");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    for child in ["backups", "exports", "audit", "attachments", "indexes"] {
        fs::create_dir_all(directory.join(child))
            .map_err(|error| format!("No se pudo crear memory/{child}: {error}"))?;
    }
    let manifest = directory.join("manifest.json");
    if !manifest.exists() {
        let content = serde_json::to_string_pretty(&serde_json::json!({
            "format": "alice-memory",
            "version": 1,
            "recordsFile": "records.json",
            "auditFile": "audit/memory-events.jsonl",
            "private": true,
            "description": "Memoria local, revisable y exportable de Alice"
        }))
        .map_err(|error| error.to_string())?;
        fs::write(&manifest, content)
            .map_err(|error| format!("No se pudo crear el manifiesto de memoria: {error}"))?;
    }
    let legacy_backup = directory.join("sessions.backup.json");
    let current_backup = directory.join("backups").join("records.backup.json");
    if legacy_backup.exists() && !current_backup.exists() {
        fs::copy(&legacy_backup, &current_backup)
            .map_err(|error| format!("No se pudo conservar el respaldo anterior: {error}"))?;
    }
    Ok(directory)
}

fn memory_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = memory_directory(app)?;
    let current = directory.join("records.json");
    let legacy = directory.join("sessions.json");
    if !current.exists() && legacy.exists() {
        let content = fs::read_to_string(&legacy)
            .map_err(|error| format!("No se pudo leer sessions.json: {error}"))?;
        let sessions = serde_json::from_str::<Vec<MemorySession>>(&content)
            .map_err(|error| format!("sessions.json no es una memoria válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        let digest = memory_subject_digest(&content);
        audited_memory_operation(
            app,
            "memory.records.write",
            "memory.migrate",
            &digest,
            "MEMORY_MIGRATED",
            || {
                fs::write(&current, &content).map_err(|error| {
                    format!("No se pudo migrar la memoria a records.json: {error}")
                })?;
                append_memory_audit(
                    &current,
                    "migrate-sessions-to-records",
                    sessions.len(),
                    &content,
                )
            },
        )?;
    }
    Ok(current)
}

#[tauri::command]
pub(crate) fn load_memory(app: AppHandle) -> Result<MemorySnapshot, String> {
    let path = memory_file(&app)?;
    let existed = path.exists();
    let sessions = if existed {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let sessions: Vec<MemorySession> = serde_json::from_str(&content)
            .map_err(|error| format!("La memoria local no es válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        sessions
    } else {
        Vec::new()
    };
    Ok(MemorySnapshot {
        sessions,
        storage_path: path.display().to_string(),
        existed,
    })
}

#[tauri::command]
pub(crate) fn layered_memory_status(app: AppHandle) -> Result<LayeredMemorySnapshot, String> {
    Ok(layered_memory_status_at(&alice_data_root_path(&app)?))
}

#[tauri::command]
pub(crate) fn consolidation_preview(
    app: AppHandle,
) -> Result<ConsolidationPreviewSnapshot, String> {
    Ok(consolidation_preview_at(&alice_data_root_path(&app)?))
}

fn activate_layered_memory_at(
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

fn rollback_layered_memory_at(
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
    let path = memory_file(&app)?;
    let backup = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("backups")
        .join("records.backup.json");
    let temporary = path.with_extension("tmp");
    let content = serde_json::to_string_pretty(&sessions).map_err(|error| error.to_string())?;
    let digest = memory_subject_digest(&content);
    audited_memory_operation(
        &app,
        "memory.records.write",
        "memory.save",
        &digest,
        "MEMORY_SAVED",
        || {
            if path.exists() {
                fs::copy(&path, &backup)
                    .map_err(|error| format!("No se pudo respaldar la memoria: {error}"))?;
            }
            fs::write(&temporary, &content)
                .map_err(|error| format!("No se pudo preparar la memoria: {error}"))?;
            fs::copy(&temporary, &path)
                .map_err(|error| format!("No se pudo guardar la memoria: {error}"))?;
            fs::remove_file(&temporary)
                .map_err(|error| format!("No se pudo limpiar el archivo temporal: {error}"))?;
            append_memory_audit(&path, "save", sessions.len(), &content)
        },
    )?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub(crate) fn export_memory(app: AppHandle) -> Result<String, String> {
    let path = memory_file(&app)?;
    if !path.exists() {
        return Err("Todavía no existe una memoria local para exportar".into());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let sessions: Vec<MemorySession> = serde_json::from_str(&content)
        .map_err(|error| format!("La memoria local no es válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let export_directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("exports");
    fs::create_dir_all(&export_directory).map_err(|error| error.to_string())?;
    let digest = memory_subject_digest(&content);
    let export_path = audited_memory_operation(
        &app,
        "memory.records.export",
        "memory.export",
        &digest,
        "MEMORY_EXPORTED",
        || {
            let export_path =
                export_directory.join(format!("alice-memory-{}.json", timestamp_ms()?));
            fs::write(&export_path, &content)
                .map_err(|error| format!("No se pudo exportar la memoria: {error}"))?;
            append_memory_audit(&path, "export", sessions.len(), &content)?;
            Ok(export_path)
        },
    )?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
pub(crate) fn restore_memory_backup(app: AppHandle) -> Result<MemorySnapshot, String> {
    let path = memory_file(&app)?;
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?;
    let backup_directory = directory.join("backups");
    let backup = backup_directory.join("records.backup.json");
    if !backup.exists() {
        return Err("No existe un respaldo de memoria para restaurar".into());
    }
    let content = fs::read_to_string(&backup).map_err(|error| error.to_string())?;
    let sessions: Vec<MemorySession> = serde_json::from_str(&content)
        .map_err(|error| format!("El respaldo no es válido: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let digest = memory_subject_digest(&content);
    audited_memory_operation(
        &app,
        "memory.records.restore",
        "memory.restore",
        &digest,
        "MEMORY_RESTORED",
        || {
            if path.exists() {
                fs::copy(&path, backup_directory.join("records.pre-restore.json"))
                    .map_err(|error| format!("No se pudo proteger la memoria actual: {error}"))?;
            }
            fs::write(&path, &content)
                .map_err(|error| format!("No se pudo restaurar la memoria: {error}"))?;
            append_memory_audit(&path, "restore", sessions.len(), &content)
        },
    )?;
    Ok(MemorySnapshot {
        sessions,
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
    #[cfg(not(target_os = "windows"))]
    return Err("Abrir la carpeta está implementado solo para Windows en esta fase".into());
    Ok(directory.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
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
            successful_recalls: 0,
            failed_recalls: 0,
            last_recalled_at: None,
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
        assert_eq!(decoded.successful_recalls, 0);
        assert_eq!(decoded.failed_recalls, 0);
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
                        format!("{:x}", Sha256::digest(content)),
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
            preview.episodic_count + preview.taught_fact_count + preview.unclassified_count,
            preview.record_count
        );
        eprintln!(
            "R6_CANONICAL records={} working={} episodic={} taughtFacts={} unclassified={} filesIntact={}",
            preview.record_count,
            preview.working_count,
            preview.episodic_count,
            preview.taught_fact_count,
            preview.unclassified_count,
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
        let source =
            write_layered_fixture(&root, &[conversation, semantic, procedural, preference]);
        let before = fs::read(root.join("memory").join("records.json")).unwrap();
        let snapshot = layered_memory_status_at(&root);
        let preview = snapshot.preview.expect("preview R6");

        assert_eq!(snapshot.state, LayeredMemoryState::Ready);
        assert_eq!(preview.record_count, 4);
        assert_eq!(preview.working_count, 0);
        assert_eq!(preview.episodic_count, 1);
        assert_eq!(preview.taught_fact_count, 1);
        assert_eq!(preview.unclassified_count, 2);
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
        let audit_json = fs::read_to_string(root.join("audit").join("events-v1.jsonl"))
            .expect("read real R3 JSONL");
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
}
