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
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::Instant;
use tauri::AppHandle;
use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Clone, Debug)]
pub(crate) struct ConfirmedLearningAppendInput {
    pub(crate) candidate_id: String,
    pub(crate) source_record_id: String,
    pub(crate) model: String,
    pub(crate) intention: String,
    pub(crate) summary: String,
    pub(crate) memory_type: String,
    pub(crate) importance: u8,
    pub(crate) confirmed_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmedLearningAppendResult {
    pub(crate) record_id: String,
    pub(crate) record_count: usize,
    pub(crate) source_sha256: String,
    pub(crate) backup_sha256: String,
    pub(crate) storage_path: String,
    pub(crate) already_confirmed: bool,
    pub(crate) audit_written: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownNoteCatalogEntry {
    relative_path: String,
    byte_length: u64,
    sha256: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownNoteCatalogSnapshot {
    vault_path: String,
    vault_exists: bool,
    note_count: usize,
    notes: Vec<MarkdownNoteCatalogEntry>,
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
const CONSOLIDATION_PREVIEW_SCHEMA_VERSION: u8 = 2;
const CONSOLIDATION_DECISION_SCHEMA_VERSION: u8 = 1;
const CONSOLIDATION_MERGE_PREVIEW_SCHEMA_VERSION: u8 = 4;
const CONSOLIDATION_TRANSACTION_SCHEMA_VERSION: u8 = 1;
const CONSOLIDATION_RECOVERY_STATUS_SCHEMA_VERSION: u8 = 1;
const CONSOLIDATION_DECISION_FILE: &str = "consolidation-decisions-v1.json";
const CONSOLIDATION_TRANSACTION_FILE: &str = "consolidation-merge-transactions-v1.json";
const CONSOLIDATION_MAX_RECORDS: usize = 1_000;
const CONSOLIDATION_MAX_CANDIDATES: usize = 2_000;
static MEMORY_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn acquire_memory_write_lock() -> Result<MutexGuard<'static, ()>, String> {
    MEMORY_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "El bloqueo de escritura de Memoria quedó dañado".into())
}

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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationCandidateKind {
    ExactDuplicate,
    ReviewRequired,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
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
    resolution: Option<ConsolidationResolutionAction>,
    decision_id: Option<String>,
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
    pending_candidate_count: usize,
    kept_separate_count: usize,
    exact_duplicate_count: usize,
    review_required_count: usize,
    candidates: Vec<ConsolidationCandidate>,
    blocked_reason: Option<String>,
    automatic_merge: bool,
    records_modified: bool,
    model_used: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationResolutionAction {
    KeepSeparate,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsolidationDecision {
    decision_id: String,
    candidate_id: String,
    source_sha256: String,
    candidate_kind: ConsolidationCandidateKind,
    reason_code: ConsolidationReasonCode,
    record_ids: Vec<String>,
    action: ConsolidationResolutionAction,
    decided_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsolidationDecisionDocument {
    schema_version: u8,
    decisions: Vec<ConsolidationDecision>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveConsolidationCandidateInput {
    expected_source_sha256: String,
    candidate_id: String,
    expected_record_ids: Vec<String>,
    action: ConsolidationResolutionAction,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationResolutionResult {
    schema_version: u8,
    decision: ConsolidationDecision,
    source_backup_path: String,
    ledger_path: String,
    backup_created: bool,
    records_modified: bool,
    model_used: bool,
    preview: ConsolidationPreviewSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationMergeDifferenceField {
    Kind,
    Intention,
    StartedAt,
    FinishedAt,
    Summary,
    NextStep,
    MemoryType,
    Source,
    Importance,
    StorageStrength,
    MemoryStatus,
    SuccessfulRecalls,
    FailedRecalls,
    LastRecalledAt,
    SuccessfulReviews,
    CorrectionCount,
    LastReviewedAt,
    ContextEvents,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationMergeBackupStatus {
    Missing,
    Verified,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationMergeLayerImpact {
    Absent,
    Inactive,
    ActiveRevisionWillBecomeStale,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationRecoveryStep {
    VerifySource,
    CreateOrVerifyBackup,
    PrepareProjectedSource,
    AtomicReplace,
    VerifyProjectedSource,
    WriteAudit,
    RestoreBackupOnFailure,
    VerifyRestoredSource,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationTransactionState {
    Prepared,
    Projected,
    Restored,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewConsolidationMergeInput {
    expected_source_sha256: String,
    candidate_id: String,
    expected_record_ids: Vec<String>,
    survivor_record_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationMergePreview {
    schema_version: u8,
    source_sha256: String,
    candidate_id: String,
    candidate_kind: ConsolidationCandidateKind,
    reason_code: ConsolidationReasonCode,
    record_ids: Vec<String>,
    survivor_record_id: String,
    duplicate_record_id: String,
    current_record_count: usize,
    projected_record_count: usize,
    projected_source_sha256: String,
    projected_source_byte_length: usize,
    normalized_content_equal: bool,
    differing_fields: Vec<ConsolidationMergeDifferenceField>,
    source_backup_path: String,
    source_backup_status: ConsolidationMergeBackupStatus,
    layer_impact: ConsolidationMergeLayerImpact,
    active_layer_revision_id: Option<String>,
    recovery_protocol_version: u8,
    recovery_steps: Vec<ConsolidationRecoveryStep>,
    byte_exact_backup_required: bool,
    atomic_replace_required: bool,
    audit_required: bool,
    restored_source_verification_required: bool,
    active_layer_execution_blocked: bool,
    transaction_receipt_version: u8,
    transaction_receipt_file: String,
    durable_receipt_required: bool,
    restart_recovery_required: bool,
    execution_available: bool,
    requires_final_confirmation: bool,
    restoration_command_available: bool,
    records_modified: bool,
    files_created: bool,
    audit_written: bool,
    model_used: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
// Deliberadamente desconectado de Tauri hasta que R6.3 autorice ejecución canónica.
#[allow(dead_code)]
struct ConsolidationRecoveryRehearsal {
    source_sha256: String,
    projected_source_sha256: String,
    restored_source_sha256: String,
    source_backup_path: String,
    backup_created: bool,
    projected_source_verified: bool,
    audit_written: bool,
    source_restored: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsolidationTransactionReceipt {
    transaction_id: String,
    candidate_id: String,
    record_ids: Vec<String>,
    survivor_record_id: String,
    duplicate_record_id: String,
    source_sha256: String,
    projected_source_sha256: String,
    source_backup_file: String,
    state: ConsolidationTransactionState,
    created_at: String,
    restored_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsolidationTransactionDocument {
    schema_version: u8,
    transactions: Vec<ConsolidationTransactionReceipt>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationRecoveryStatusState {
    Idle,
    RecoveryRequired,
    Restored,
    Blocked,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationSourceRelation {
    Original,
    Projected,
    Diverged,
    Missing,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationRecoveryReceiptView {
    transaction_id: String,
    candidate_id: String,
    source_sha256: String,
    projected_source_sha256: String,
    source_backup_file: String,
    state: ConsolidationTransactionState,
    created_at: String,
    restored_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationRecoveryStatusSnapshot {
    schema_version: u8,
    state: ConsolidationRecoveryStatusState,
    receipt_path: String,
    receipt_file_exists: bool,
    transaction_count: usize,
    receipt: Option<ConsolidationRecoveryReceiptView>,
    source_relation: Option<ConsolidationSourceRelation>,
    current_source_sha256: Option<String>,
    blocked_reason: Option<String>,
    restoration_available: bool,
    restoration_requires_confirmation: bool,
    automatic_recovery: bool,
    merge_execution_available: bool,
    records_modified: bool,
    files_created: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RestoreConsolidationTransactionInput {
    transaction_id: String,
    expected_source_sha256: String,
    expected_projected_source_sha256: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationRestorationResult {
    schema_version: u8,
    transaction_id: String,
    source_sha256: String,
    source_restored: bool,
    audit_written: bool,
    already_restored: bool,
    receipt_state: ConsolidationTransactionState,
    status: ConsolidationRecoveryStatusSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
struct ConsolidationRestartRecoveryResult {
    transaction_id: String,
    source_sha256: String,
    source_restored: bool,
    audit_written: bool,
    receipt_state: ConsolidationTransactionState,
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

fn consolidation_decision_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(CONSOLIDATION_DECISION_FILE)
}

fn consolidation_transaction_path(data_root: &Path) -> PathBuf {
    data_root
        .join("memory")
        .join(CONSOLIDATION_TRANSACTION_FILE)
}

fn consolidation_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("consolidation-source-{}.json", &source_sha256[7..]))
}

fn empty_consolidation_decisions() -> ConsolidationDecisionDocument {
    ConsolidationDecisionDocument {
        schema_version: CONSOLIDATION_DECISION_SCHEMA_VERSION,
        decisions: Vec::new(),
    }
}

fn validate_consolidation_decisions(
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

fn read_consolidation_decisions_at(
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

fn consolidation_merge_differences(
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
    compare!(successful_recalls, SuccessfulRecalls);
    compare!(failed_recalls, FailedRecalls);
    compare!(last_recalled_at, LastRecalledAt);
    compare!(successful_reviews, SuccessfulReviews);
    compare!(correction_count, CorrectionCount);
    compare!(last_reviewed_at, LastReviewedAt);
    compare!(context_events, ContextEvents);
    fields
}

fn preview_consolidation_merge_at(
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

fn projected_consolidation_source_at(
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

fn nul_terminated_path(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

fn atomic_replace_text_file(
    destination: &Path,
    content: &str,
    temporary_extension: &str,
    label: &str,
) -> Result<(), String> {
    let temporary = destination.with_extension(temporary_extension);
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal atómico {label}: {error}"))?;
    if let Err(error) = file
        .write_all(content.as_bytes())
        .and_then(|()| file.sync_all())
    {
        let _ = fs::remove_file(&temporary);
        return Err(format!("No se pudo preparar el reemplazo {label}: {error}"));
    }
    drop(file);
    let temporary_wide = nul_terminated_path(&temporary);
    let destination_wide = nul_terminated_path(destination);
    let replace = unsafe {
        MoveFileExW(
            PCWSTR(temporary_wide.as_ptr()),
            PCWSTR(destination_wide.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if let Err(error) = replace {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Falló el reemplazo atómico {label}: {error}"));
    }
    let stored = fs::read_to_string(destination)
        .map_err(|error| format!("No se pudo verificar {label} tras reemplazarlo: {error}"))?;
    if stored != content {
        return Err(format!("{label} no coincide con el contenido reemplazado"));
    }
    Ok(())
}

fn atomic_replace_memory_source(
    source_path: &Path,
    content: &str,
    expected_sha256: &str,
) -> Result<(), String> {
    let sessions = serde_json::from_str::<Vec<MemorySession>>(content)
        .map_err(|error| format!("El contenido R6.3-D preparado no es memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    if memory_subject_digest(content) != expected_sha256 {
        return Err("El contenido R6.3-D preparado no coincide con su SHA-256".into());
    }
    atomic_replace_text_file(source_path, content, "r6-3-d.tmp", "records.json")?;
    let stored = fs::read_to_string(source_path)
        .map_err(|error| format!("No se pudo verificar records.json: {error}"))?;
    if memory_subject_digest(&stored) != expected_sha256 {
        return Err("records.json no coincide con el SHA-256 R6.3-D esperado".into());
    }
    Ok(())
}

fn confirmed_learning_source(input: &ConfirmedLearningAppendInput) -> String {
    format!(
        "Ollama local · {} · recuerdo {} · candidato {}",
        input.model, input.source_record_id, input.candidate_id
    )
}

fn validate_confirmed_learning_append(input: &ConfirmedLearningAppendInput) -> Result<(), String> {
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

fn append_confirmed_learning_at(
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
        session.id == input.source_record_id && session.memory_status.as_deref() != Some("archived")
    }) {
        return Err("El recuerdo de origen ya no está disponible para confirmar".into());
    }

    let record_id = uuid::Uuid::new_v4().to_string();
    sessions.insert(
        0,
        MemorySession {
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
            successful_recalls: 0,
            failed_recalls: 0,
            last_recalled_at: None,
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

fn restore_rehearsal_source(
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
fn rehearse_consolidation_recovery_at(
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

fn validate_consolidation_transactions(
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

fn read_consolidation_transactions_at(
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

fn consolidation_recovery_receipt_view(
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

fn consolidation_recovery_status_at(data_root: &Path) -> ConsolidationRecoveryStatusSnapshot {
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

fn write_consolidation_transactions_at(
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

fn create_or_verify_transaction_backup(
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
fn prepare_interrupted_consolidation_at(
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
fn recover_interrupted_consolidation_at(
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

fn restore_consolidation_transaction_at(
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

fn write_consolidation_decisions_at(
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

fn resolve_consolidation_candidate_at(
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

fn collect_markdown_notes(
    directory: &Path,
    root: &Path,
    notes: &mut Vec<MarkdownNoteCatalogEntry>,
) -> Result<(), String> {
    if notes.len() >= 500 {
        return Err("La bóveda supera el límite de 500 notas para este catálogo inicial".into());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("No se pudo enumerar la bóveda: {error}"))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            if entry.file_name() != ".obsidian" {
                collect_markdown_notes(&path, root, notes)?;
            }
            continue;
        }
        if !file_type.is_file()
            || path.extension().and_then(|extension| extension.to_str()) != Some("md")
        {
            continue;
        }
        let bytes = fs::read(&path)
            .map_err(|error| format!("No se pudo leer la nota para calcular su huella: {error}"))?;
        let relative_path = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        notes.push(MarkdownNoteCatalogEntry {
            relative_path,
            byte_length: bytes.len() as u64,
            sha256: format!("sha256:{:x}", Sha256::digest(bytes)),
        });
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn markdown_note_catalog(app: AppHandle) -> Result<MarkdownNoteCatalogSnapshot, String> {
    let vault = alice_data_root_path(&app)?.join("memory").join("notes");
    if !vault.is_dir() {
        return Ok(MarkdownNoteCatalogSnapshot {
            vault_path: vault.display().to_string(),
            vault_exists: false,
            note_count: 0,
            notes: Vec::new(),
        });
    }
    let mut notes = Vec::new();
    collect_markdown_notes(&vault, &vault, &mut notes)?;
    notes.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(MarkdownNoteCatalogSnapshot {
        vault_path: vault.display().to_string(),
        vault_exists: true,
        note_count: notes.len(),
        notes,
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

#[tauri::command]
pub(crate) fn consolidation_recovery_status(
    app: AppHandle,
) -> Result<ConsolidationRecoveryStatusSnapshot, String> {
    Ok(consolidation_recovery_status_at(&alice_data_root_path(
        &app,
    )?))
}

#[tauri::command]
pub(crate) fn restore_consolidation_transaction(
    app: AppHandle,
    input: RestoreConsolidationTransactionInput,
) -> Result<ConsolidationRestorationResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let operation_id = new_operation_id();
    let subject_digest = input.transaction_id.clone();
    restore_consolidation_transaction_at(
        &data_root,
        input,
        current_utc_timestamp()?,
        |stage, outcome, duration_ms, reason_code| {
            record_producer_audit(
                &app,
                operation_id.clone(),
                AuditSource::Memory,
                "memory.records.restore".into(),
                "restore_consolidation_transaction".into(),
                stage,
                outcome,
                duration_ms,
                Some(subject_digest.clone()),
                reason_code,
            )
        },
    )
}

#[tauri::command]
pub(crate) fn preview_consolidation_merge(
    app: AppHandle,
    input: PreviewConsolidationMergeInput,
) -> Result<ConsolidationMergePreview, String> {
    preview_consolidation_merge_at(&alice_data_root_path(&app)?, input)
}

#[tauri::command]
pub(crate) fn resolve_consolidation_candidate(
    app: AppHandle,
    input: ResolveConsolidationCandidateInput,
) -> Result<ConsolidationResolutionResult, String> {
    let data_root = alice_data_root_path(&app)?;
    let subject_digest = input.candidate_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "resolve_consolidation_candidate",
        &subject_digest,
        "MEMORY_CONSOLIDATION_KEPT_SEPARATE",
        || resolve_consolidation_candidate_at(&data_root, input, current_utc_timestamp()?),
    )
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
    let _write_guard = acquire_memory_write_lock()?;
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
    let _write_guard = acquire_memory_write_lock()?;
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

    #[test]
    fn markdown_catalog_lists_only_notes_and_preserves_source_bytes() {
        let root = temporary_probe_root("markdown-catalog");
        fs::create_dir_all(root.join("nested")).expect("create nested vault path");
        fs::create_dir_all(root.join(".obsidian")).expect("create config path");
        fs::write(root.join("zeta.md"), "# Zeta").expect("write note");
        fs::write(root.join("nested").join("alpha.md"), "# Alpha").expect("write nested note");
        fs::write(root.join(".obsidian").join("ignored.md"), "internal")
            .expect("write internal file");
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
        let projected_sha256 =
            memory_subject_digest(std::str::from_utf8(&projected_bytes).unwrap());

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

    #[test]
    fn r6_4_c_appends_once_with_exact_backup_and_audit() {
        let root = temporary_probe_root("r6-4-c-confirm");
        let original = write_layered_fixture(&root, &[legacy_memory()]);
        let original_sha256 = memory_subject_digest(&original);

        let first =
            append_confirmed_learning_at(&root, &original_sha256, confirmed_learning_fixture())
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

        let retry =
            append_confirmed_learning_at(&root, &original_sha256, confirmed_learning_fixture())
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
}
