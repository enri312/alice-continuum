use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::capabilities::{
    current_unix_seconds, current_utc_timestamp, format_utc_timestamp, validate_timestamp,
};
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySession {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    affects: Vec<crate::memory_affect::MemoryAffect>,
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
    accessibility_status: Option<String>,
    accessibility_updated_at: Option<String>,
    suppression_status: Option<String>,
    suppression_reason: Option<String>,
    suppression_updated_at: Option<String>,
    archive_status: Option<String>,
    archive_reason: Option<String>,
    archive_updated_at: Option<String>,
    deletion_status: Option<String>,
    deletion_reason: Option<String>,
    deletion_requested_at: Option<String>,
    deletion_eligible_at: Option<String>,
    memory_version: Option<u32>,
    reconsolidated_at: Option<String>,
    reconsolidation_reason: Option<String>,
    previous_version_sha256: Option<String>,
    #[serde(default)]
    successful_recalls: u32,
    #[serde(default)]
    failed_recalls: u32,
    last_recalled_at: Option<String>,
    retrieval_evidence_version: Option<u8>,
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

#[derive(Clone, Debug)]
pub(crate) struct ConfirmedConversationLearningAppendInput {
    pub(crate) affects: Vec<crate::memory_affect::MemoryAffect>,
    pub(crate) candidate_id: String,
    pub(crate) conversation_exchange_id: String,
    pub(crate) conversation_source_sha256: String,
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

const LAYERED_MEMORY_SCHEMA_VERSION: u8 = 2;
const LAYERED_MEMORY_FILE: &str = "layer-index-v3.json";
const MEMORY_LIFECYCLE_PREVIEW_SCHEMA_VERSION: u8 = 1;
const MEMORY_LIFECYCLE_FILE: &str = "lifecycle-index-v1.json";
const MEMORY_RECONSOLIDATION_SCHEMA_VERSION: u8 = 1;
const MEMORY_ARCHIVE_SCHEMA_VERSION: u8 = 1;
const MEMORY_DELETION_SCHEMA_VERSION: u8 = 1;
const MEMORY_DELETION_WAIT_SECONDS: i64 = 7 * 24 * 60 * 60;
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
enum ProceduralMemoryLinkState {
    PendingR5,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LayeredProceduralMemoryReference {
    record_id: String,
    link_state: ProceduralMemoryLinkState,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum UnclassifiedMemoryReason {
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
    procedural: Vec<LayeredProceduralMemoryReference>,
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
    procedural_count: usize,
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
pub(crate) enum MemoryLifecyclePreviewState {
    Unavailable,
    Ready,
    Active,
    SourceChanged,
    RolledBack,
    Blocked,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryValidityState {
    Current,
    Conflict,
    Archived,
    NotAssessed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryRetrievalPolicy {
    Eligible,
    LegacyEligible,
    BlockedBySuppression,
    BlockedByDormancy,
    BlockedByConflict,
    BlockedByArchive,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryAccessibilityState {
    NotAssessed,
    Accessible,
    Dormant,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryRetentionState {
    NotAssessed,
    DeletionScheduled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryWeakeningAssessmentState {
    NotAssessed,
    InsufficientEvidence,
    NoWeakeningSignal,
    ReviewRequired,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryWeakeningAssessment {
    record_id: String,
    helpful_outcomes: u32,
    not_helpful_outcomes: u32,
    evidence_count: u32,
    state: MemoryWeakeningAssessmentState,
    automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MemoryLifecycleReference {
    record_id: String,
    record_sha256: String,
    validity: MemoryValidityState,
    accessibility: MemoryAccessibilityState,
    retrieval_policy: MemoryRetrievalPolicy,
    retention: MemoryRetentionState,
    suppressed: bool,
    archived: bool,
    base_version: u32,
    reconsolidation_count: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryGraphLayer {
    Episodic,
    TaughtFact,
    Procedural,
    Unclassified,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryGraphEvidenceUse {
    Blocked,
    EpisodeOnly,
    OwnerConfirmedContent,
    ProcedureReferenceOnly,
    ReviewRequired,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryGraphReference {
    node_id: String,
    record_version: u32,
    lifecycle: MemoryLifecycleReference,
    layer: MemoryGraphLayer,
    has_declared_source: bool,
    evidence_use: MemoryGraphEvidenceUse,
}

// R8 consumes the existing R6 validation and classification rather than inferring
// facts from model responses or maintaining a second lifecycle policy.
pub(crate) fn graph_references_from_source(
    content: &str,
) -> Result<Vec<MemoryGraphReference>, String> {
    let sessions: Vec<MemorySession> = serde_json::from_str(content)
        .map_err(|_| "La fuente del grafo no contiene registros de memoria válidos".to_string())?;
    if sessions.len() > 10_000 {
        return Err("La fuente del grafo supera el límite de 10.000 registros".into());
    }
    validate_memory_sessions(&sessions)?;
    let classified = classify_layered_memory(content, &sessions, String::new());
    let episodic: HashSet<_> = classified
        .layers
        .episodic
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let taught: HashSet<_> = classified
        .layers
        .taught_facts
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let procedural: HashSet<_> = classified
        .layers
        .procedural
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let mut references = Vec::with_capacity(sessions.len());
    for session in &sessions {
        let lifecycle = lifecycle_reference(session)?;
        let layer = if episodic.contains(session.id.as_str()) {
            MemoryGraphLayer::Episodic
        } else if taught.contains(session.id.as_str()) {
            MemoryGraphLayer::TaughtFact
        } else if procedural.contains(session.id.as_str()) {
            MemoryGraphLayer::Procedural
        } else {
            MemoryGraphLayer::Unclassified
        };
        let has_declared_source = session
            .source
            .as_deref()
            .is_some_and(|s| !s.trim().is_empty());
        let evidence_use = if !matches!(
            lifecycle.retrieval_policy,
            MemoryRetrievalPolicy::Eligible | MemoryRetrievalPolicy::LegacyEligible
        ) {
            MemoryGraphEvidenceUse::Blocked
        } else {
            match layer {
                MemoryGraphLayer::Episodic => MemoryGraphEvidenceUse::EpisodeOnly,
                MemoryGraphLayer::TaughtFact
                    if has_declared_source
                        && lifecycle.validity == MemoryValidityState::Current =>
                {
                    MemoryGraphEvidenceUse::OwnerConfirmedContent
                }
                MemoryGraphLayer::Procedural => MemoryGraphEvidenceUse::ProcedureReferenceOnly,
                _ => MemoryGraphEvidenceUse::ReviewRequired,
            }
        };
        references.push(MemoryGraphReference {
            node_id: format!("record:{}", session.id),
            record_version: session.memory_version.unwrap_or(1),
            lifecycle,
            layer,
            has_declared_source,
            evidence_use,
        });
    }
    references.sort_by(|left, right| left.node_id.cmp(&right.node_id));
    Ok(references)
}

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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryLifecycleSource {
    records_file: String,
    sha256: String,
    record_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryLifecycleRevision {
    revision_id: String,
    created_at: String,
    source: MemoryLifecycleSource,
    references: Vec<MemoryLifecycleReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryLifecycleDocument {
    schema_version: u8,
    active_revision_id: Option<String>,
    revisions: Vec<MemoryLifecycleRevision>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryLifecyclePreview {
    source_sha256: String,
    record_count: usize,
    current_count: usize,
    conflict_count: usize,
    archived_count: usize,
    not_assessed_count: usize,
    accessibility_assessed_count: usize,
    accessible_count: usize,
    dormant_count: usize,
    retrieval_eligible_count: usize,
    retrieval_blocked_count: usize,
    retrieval_outcome_count: u32,
    functional_assessment_count: usize,
    weakening_review_required_count: usize,
    retention_assessed_count: usize,
    suppressed_count: usize,
    reconsolidated_count: usize,
    references: Vec<MemoryLifecycleReference>,
    weakening_assessments: Vec<MemoryWeakeningAssessment>,
    records_modified: bool,
    content_copied: bool,
    automatic_inference: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryLifecyclePreviewSnapshot {
    schema_version: u8,
    state: MemoryLifecyclePreviewState,
    storage_path: String,
    source_sha256: Option<String>,
    active_revision_id: Option<String>,
    revision_count: usize,
    preview: Option<MemoryLifecyclePreview>,
    blocked_reason: Option<String>,
    migration_requires_confirmation: bool,
    lifecycle_writes_available: bool,
    records_modified: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ActivateMemoryLifecycleInput {
    expected_source_sha256: String,
    confirmed: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RollbackMemoryLifecycleInput {
    expected_revision_id: String,
    confirmed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryValidityAssessmentAction {
    ConfirmCurrent,
    MarkConflict,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssessMemoryValidityInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryValidityAssessmentAction,
    declared_source: Option<String>,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryValidityAssessmentResult {
    schema_version: u8,
    record_id: String,
    action: MemoryValidityAssessmentAction,
    previous_validity: MemoryValidityState,
    new_validity: MemoryValidityState,
    source_sha256_before: String,
    source_sha256_after: String,
    backup_sha256: String,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryAccessibilityAssessmentAction {
    MakeAccessible,
    SetDormant,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssessMemoryAccessibilityInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryAccessibilityAssessmentAction,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryAccessibilityAssessmentResult {
    schema_version: u8,
    record_id: String,
    action: MemoryAccessibilityAssessmentAction,
    previous_accessibility: MemoryAccessibilityState,
    new_accessibility: MemoryAccessibilityState,
    source_sha256_before: String,
    source_sha256_after: String,
    backup_sha256: String,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemorySuppressionAction {
    Suppress,
    Release,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemorySuppressionReason {
    OwnerChoice,
    SensitiveContext,
    TemporaryBoundary,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AssessMemorySuppressionInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemorySuppressionAction,
    reason: MemorySuppressionReason,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySuppressionAssessmentResult {
    schema_version: u8,
    record_id: String,
    action: MemorySuppressionAction,
    reason: MemorySuppressionReason,
    previous_suppressed: bool,
    new_suppressed: bool,
    source_sha256_before: String,
    source_sha256_after: String,
    backup_sha256: String,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryArchiveAction {
    Archive,
    Restore,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryArchiveReason {
    OwnerChoice,
    Superseded,
    NoLongerRelevant,
    RelevantAgain,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewMemoryArchiveInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryArchiveAction,
    reason: MemoryArchiveReason,
    note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryArchiveInput {
    expected_plan_id: String,
    planned_at: String,
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryArchiveAction,
    reason: MemoryArchiveReason,
    note: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryArchivePreview {
    schema_version: u8,
    plan_id: String,
    planned_at: String,
    record_id: String,
    action: MemoryArchiveAction,
    reason: MemoryArchiveReason,
    note_sha256: String,
    source_sha256: String,
    record_sha256_before: String,
    projected_record_sha256: String,
    previous_archived: bool,
    projected_archived: bool,
    records_modified: bool,
    automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryArchiveResult {
    schema_version: u8,
    plan_id: String,
    record_id: String,
    action: MemoryArchiveAction,
    reason: MemoryArchiveReason,
    previous_archived: bool,
    new_archived: bool,
    source_sha256_before: String,
    source_sha256_after: String,
    record_sha256_before: String,
    record_sha256_after: String,
    backup_sha256: String,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryDeletionScheduleAction {
    Schedule,
    Cancel,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryDeletionReason {
    OwnerRequest,
    DuplicateAfterMerge,
    PrivacyRemoval,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewMemoryDeletionScheduleInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryDeletionScheduleAction,
    reason: MemoryDeletionReason,
    note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryDeletionScheduleInput {
    expected_plan_id: String,
    planned_at: String,
    eligible_at: String,
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    action: MemoryDeletionScheduleAction,
    reason: MemoryDeletionReason,
    note: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionSchedulePreview {
    schema_version: u8,
    plan_id: String,
    planned_at: String,
    eligible_at: String,
    record_id: String,
    action: MemoryDeletionScheduleAction,
    reason: MemoryDeletionReason,
    note_sha256: String,
    source_sha256: String,
    record_sha256_before: String,
    projected_record_sha256: String,
    previous_scheduled: bool,
    projected_scheduled: bool,
    wait_seconds: i64,
    records_modified: bool,
    automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionScheduleResult {
    schema_version: u8,
    plan_id: String,
    record_id: String,
    action: MemoryDeletionScheduleAction,
    reason: MemoryDeletionReason,
    previous_scheduled: bool,
    new_scheduled: bool,
    eligible_at: Option<String>,
    source_sha256_before: String,
    source_sha256_after: String,
    record_sha256_before: String,
    record_sha256_after: String,
    backup_sha256: String,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewMemoryDeletionInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryDeletionInput {
    expected_plan_id: String,
    planned_at: String,
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    note: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionPreview {
    schema_version: u8,
    plan_id: String,
    planned_at: String,
    record_id: String,
    reason: MemoryDeletionReason,
    note_sha256: String,
    source_sha256: String,
    record_sha256: String,
    requested_at: String,
    eligible_at: String,
    safeguard_required: bool,
    tombstone_contains_content: bool,
    records_modified: bool,
    automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionResult {
    schema_version: u8,
    plan_id: String,
    record_id: String,
    reason: MemoryDeletionReason,
    source_sha256_before: String,
    source_sha256_after: String,
    record_sha256: String,
    safeguard_sha256: String,
    tombstone_sha256: String,
    remaining_record_count: usize,
    records_modified: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryDeletionTombstone {
    schema_version: u8,
    plan_id: String,
    record_id_sha256: String,
    record_sha256: String,
    source_sha256_before: String,
    source_sha256_after: String,
    reason: MemoryDeletionReason,
    requested_at: String,
    eligible_at: String,
    deleted_at: String,
    note_sha256: String,
    safeguard_sha256: String,
    content_included: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryReconsolidationReason {
    OwnerCorrection,
    NewContext,
    Clarification,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewMemoryReconsolidationInput {
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    reason: MemoryReconsolidationReason,
    note: String,
    proposed_intention: String,
    proposed_summary: Option<String>,
    proposed_next_step: Option<String>,
    proposed_source: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryReconsolidationInput {
    expected_plan_id: String,
    planned_at: String,
    expected_source_sha256: String,
    record_id: String,
    expected_record_sha256: String,
    reason: MemoryReconsolidationReason,
    note: String,
    proposed_intention: String,
    proposed_summary: Option<String>,
    proposed_next_step: Option<String>,
    proposed_source: Option<String>,
    confirmed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MemoryReconsolidationField {
    Intention,
    Summary,
    NextStep,
    Source,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryReconsolidationPreview {
    schema_version: u8,
    plan_id: String,
    planned_at: String,
    record_id: String,
    reason: MemoryReconsolidationReason,
    note_sha256: String,
    source_sha256: String,
    record_sha256_before: String,
    projected_record_sha256: String,
    previous_version: u32,
    projected_version: u32,
    changed_fields: Vec<MemoryReconsolidationField>,
    records_modified: bool,
    version_written: bool,
    automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MemoryReconsolidationRevision {
    schema_version: u8,
    revision_id: String,
    plan_id: String,
    record_id: String,
    previous_version: u32,
    successor_version: u32,
    reason: MemoryReconsolidationReason,
    note_sha256: String,
    superseded_at: String,
    source_sha256_before: String,
    source_sha256_after: String,
    record_sha256_before: String,
    record_sha256_after: String,
    record: MemorySession,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryReconsolidationResult {
    schema_version: u8,
    plan_id: String,
    revision_id: String,
    record_id: String,
    reason: MemoryReconsolidationReason,
    previous_version: u32,
    new_version: u32,
    source_sha256_before: String,
    source_sha256_after: String,
    record_sha256_before: String,
    record_sha256_after: String,
    backup_sha256: String,
    revision_sha256: String,
    records_modified: bool,
    version_written: bool,
    audit_written: bool,
    lifecycle: MemoryLifecyclePreviewSnapshot,
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
    SuppressionStatus,
    SuppressionReason,
    SuppressionUpdatedAt,
    ArchiveStatus,
    ArchiveReason,
    ArchiveUpdatedAt,
    DeletionStatus,
    DeletionReason,
    DeletionRequestedAt,
    DeletionEligibleAt,
    MemoryVersion,
    ReconsolidatedAt,
    ReconsolidationReason,
    PreviousVersionSha256,
    SuccessfulRecalls,
    FailedRecalls,
    LastRecalledAt,
    RetrievalEvidenceVersion,
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
        sha256: crate::util::encode_hex_lower(Sha256::digest(content.as_bytes())),
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
    format!(
        "sha256:{}",
        crate::util::encode_hex_lower(Sha256::digest(content.as_bytes()))
    )
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

fn lifecycle_reference(session: &MemorySession) -> Result<MemoryLifecycleReference, String> {
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

fn lifecycle_revision(
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

fn lifecycle_preview(
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

fn lifecycle_reference_is_consistent(reference: &MemoryLifecycleReference) -> bool {
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

fn validate_memory_lifecycle_document(document: &MemoryLifecycleDocument) -> Result<(), String> {
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

fn memory_lifecycle_path(data_root: &Path) -> PathBuf {
    data_root.join("memory").join(MEMORY_LIFECYCLE_FILE)
}

fn read_memory_lifecycle_document_at(
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

fn blocked_memory_lifecycle_snapshot(
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

fn memory_lifecycle_preview_at(data_root: &Path) -> MemoryLifecyclePreviewSnapshot {
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

fn lifecycle_revision_matches(
    stored: &MemoryLifecycleRevision,
    expected: &MemoryLifecycleRevision,
) -> bool {
    stored.revision_id == expected.revision_id
        && stored.source == expected.source
        && stored.references == expected.references
}

fn rollback_lifecycle_index(path: &Path, previous: Option<&str>) -> Result<(), String> {
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

fn write_memory_lifecycle_document_at(
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

fn activate_memory_lifecycle_at(
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

fn rollback_memory_lifecycle_at(
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

fn validity_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("validity-source-{}.json", &source_sha256[7..]))
}

fn create_or_verify_validity_backup(
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

fn assess_memory_validity_at(
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

fn accessibility_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("accessibility-source-{}.json", &source_sha256[7..]))
}

fn create_or_verify_accessibility_backup(
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

fn assess_memory_accessibility_at(
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

fn suppression_reason_code(reason: MemorySuppressionReason) -> &'static str {
    match reason {
        MemorySuppressionReason::OwnerChoice => "ownerChoice",
        MemorySuppressionReason::SensitiveContext => "sensitiveContext",
        MemorySuppressionReason::TemporaryBoundary => "temporaryBoundary",
    }
}

fn suppression_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("suppression-source-{}.json", &source_sha256[7..]))
}

fn create_or_verify_suppression_backup(
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

fn assess_memory_suppression_at(
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

fn archive_reason_code(reason: MemoryArchiveReason) -> &'static str {
    match reason {
        MemoryArchiveReason::OwnerChoice => "ownerChoice",
        MemoryArchiveReason::Superseded => "superseded",
        MemoryArchiveReason::NoLongerRelevant => "noLongerRelevant",
        MemoryArchiveReason::RelevantAgain => "relevantAgain",
    }
}

fn archive_action_code(action: MemoryArchiveAction) -> &'static str {
    match action {
        MemoryArchiveAction::Archive => "archive",
        MemoryArchiveAction::Restore => "restore",
    }
}

fn utc_timestamp_seconds(value: &str) -> Result<i64, String> {
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

fn deletion_reason_code(reason: MemoryDeletionReason) -> &'static str {
    match reason {
        MemoryDeletionReason::OwnerRequest => "ownerRequest",
        MemoryDeletionReason::DuplicateAfterMerge => "duplicateAfterMerge",
        MemoryDeletionReason::PrivacyRemoval => "privacyRemoval",
    }
}

fn deletion_schedule_action_code(action: MemoryDeletionScheduleAction) -> &'static str {
    match action {
        MemoryDeletionScheduleAction::Schedule => "schedule",
        MemoryDeletionScheduleAction::Cancel => "cancel",
    }
}

fn prepare_memory_archive_at(
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

fn archive_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("backups")
        .join(format!("archive-source-{}.json", &source_sha256[7..]))
}

fn create_or_verify_archive_backup(
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

fn confirm_memory_archive_at(
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

fn prepare_memory_deletion_schedule_at(
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

fn deletion_schedule_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root.join("memory").join("backups").join(format!(
        "deletion-schedule-source-{}.json",
        &source_sha256[7..]
    ))
}

fn create_or_verify_exact_file(
    path: &Path,
    content: &str,
    expected_sha256: &str,
    temporary_name: &str,
    description: &str,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{description} no posee directorio"))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar {description}: {error}"))?;
    if path.exists() {
        let stored = fs::read_to_string(path)
            .map_err(|error| format!("No se pudo verificar {description}: {error}"))?;
        if stored != content || memory_subject_digest(&stored) != expected_sha256 {
            return Err(format!("{description} existente no coincide con la fuente"));
        }
        return Ok(());
    }
    atomic_replace_text_file(path, content, temporary_name, description)?;
    let stored = fs::read_to_string(path)
        .map_err(|error| format!("No se pudo releer {description}: {error}"))?;
    if stored != content || memory_subject_digest(&stored) != expected_sha256 {
        return Err(format!("{description} no coincide byte a byte"));
    }
    Ok(())
}

fn confirm_memory_deletion_schedule_at(
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

fn prepare_memory_deletion_at(
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

fn confirm_memory_deletion_at(
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

fn reconsolidation_reason_code(reason: MemoryReconsolidationReason) -> &'static str {
    match reason {
        MemoryReconsolidationReason::OwnerCorrection => "ownerCorrection",
        MemoryReconsolidationReason::NewContext => "newContext",
        MemoryReconsolidationReason::Clarification => "clarification",
    }
}

fn normalized_optional_reconsolidation_text(
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

fn prepare_memory_reconsolidation_at(
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

fn reconsolidation_source_backup_path(data_root: &Path, source_sha256: &str) -> PathBuf {
    data_root.join("memory").join("backups").join(format!(
        "reconsolidation-source-{}.json",
        &source_sha256[7..]
    ))
}

fn reconsolidation_revision_path(data_root: &Path, revision_id: &str) -> PathBuf {
    data_root
        .join("memory")
        .join("revisions")
        .join(format!("reconsolidation-v1-{}.json", &revision_id[7..]))
}

fn create_or_verify_reconsolidation_source_backup(
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

fn remove_created_reconsolidation_revision(path: &Path, created: bool) -> Result<(), String> {
    if !created {
        return Ok(());
    }
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("No se pudo retirar la versión incompleta: {error}")),
    }
}

fn restore_failed_reconsolidation(
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

fn confirm_memory_reconsolidation_at(
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
        .filter(|session| {
            session.memory_status.as_deref() == Some("archived")
                || session.archive_status.as_deref() == Some("archived")
        })
        .count();
    let mut eligible = sessions
        .iter()
        .filter(|session| {
            session.finished_at.is_some()
                && session.memory_status.as_deref() != Some("archived")
                && session.archive_status.as_deref() != Some("archived")
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
    compare!(suppression_status, SuppressionStatus);
    compare!(suppression_reason, SuppressionReason);
    compare!(suppression_updated_at, SuppressionUpdatedAt);
    compare!(archive_status, ArchiveStatus);
    compare!(archive_reason, ArchiveReason);
    compare!(archive_updated_at, ArchiveUpdatedAt);
    compare!(deletion_status, DeletionStatus);
    compare!(deletion_reason, DeletionReason);
    compare!(deletion_requested_at, DeletionRequestedAt);
    compare!(deletion_eligible_at, DeletionEligibleAt);
    compare!(memory_version, MemoryVersion);
    compare!(reconsolidated_at, ReconsolidatedAt);
    compare!(reconsolidation_reason, ReconsolidationReason);
    compare!(previous_version_sha256, PreviousVersionSha256);
    compare!(successful_recalls, SuccessfulRecalls);
    compare!(failed_recalls, FailedRecalls);
    compare!(last_recalled_at, LastRecalledAt);
    compare!(retrieval_evidence_version, RetrievalEvidenceVersion);
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

fn confirmed_conversation_learning_source(
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

fn validate_confirmed_conversation_learning_append(
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

fn append_confirmed_conversation_learning_at(
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

fn layered_preview(revision: &LayeredMemoryRevision) -> LayeredMemoryPreview {
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
    for child in [
        "backups",
        "exports",
        "audit",
        "attachments",
        "indexes",
        "revisions",
    ] {
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
            sha256: format!(
                "sha256:{}",
                crate::util::encode_hex_lower(Sha256::digest(bytes))
            ),
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
pub(crate) fn memory_lifecycle_preview(
    app: AppHandle,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    Ok(memory_lifecycle_preview_at(&alice_data_root_path(&app)?))
}

#[tauri::command]
pub(crate) fn activate_memory_lifecycle(
    app: AppHandle,
    input: ActivateMemoryLifecycleInput,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let source_digest = input.expected_source_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "activate_memory_lifecycle",
        &source_digest,
        "MEMORY_LIFECYCLE_ACTIVATED",
        || activate_memory_lifecycle_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn rollback_memory_lifecycle(
    app: AppHandle,
    input: RollbackMemoryLifecycleInput,
) -> Result<MemoryLifecyclePreviewSnapshot, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let revision_digest = input.expected_revision_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.restore",
        "rollback_memory_lifecycle",
        &revision_digest,
        "MEMORY_LIFECYCLE_ROLLED_BACK",
        || rollback_memory_lifecycle_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_validity(
    app: AppHandle,
    input: AssessMemoryValidityInput,
) -> Result<MemoryValidityAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_validity",
        &record_digest,
        "MEMORY_VALIDITY_ASSESSED",
        || assess_memory_validity_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_accessibility(
    app: AppHandle,
    input: AssessMemoryAccessibilityInput,
) -> Result<MemoryAccessibilityAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_accessibility",
        &record_digest,
        "MEMORY_ACCESSIBILITY_ASSESSED",
        || assess_memory_accessibility_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn assess_memory_suppression(
    app: AppHandle,
    input: AssessMemorySuppressionInput,
) -> Result<MemorySuppressionAssessmentResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let record_digest = input.expected_record_sha256.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "assess_memory_suppression",
        &record_digest,
        "MEMORY_SUPPRESSION_ASSESSED",
        || assess_memory_suppression_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_archive(
    app: AppHandle,
    input: PreviewMemoryArchiveInput,
) -> Result<MemoryArchivePreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _) = prepare_memory_archive_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_archive(
    app: AppHandle,
    input: ConfirmMemoryArchiveInput,
) -> Result<MemoryArchiveResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_archive",
        &plan_digest,
        "MEMORY_ARCHIVE_CHANGED",
        || confirm_memory_archive_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_deletion_schedule(
    app: AppHandle,
    input: PreviewMemoryDeletionScheduleInput,
) -> Result<MemoryDeletionSchedulePreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let planned_seconds = current_unix_seconds()?;
    let (preview, _, _) = prepare_memory_deletion_schedule_at(
        &data_root,
        input,
        format_utc_timestamp(planned_seconds),
        format_utc_timestamp(planned_seconds + MEMORY_DELETION_WAIT_SECONDS),
    )?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_deletion_schedule(
    app: AppHandle,
    input: ConfirmMemoryDeletionScheduleInput,
) -> Result<MemoryDeletionScheduleResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_deletion_schedule",
        &plan_digest,
        "MEMORY_DELETION_RETENTION_CHANGED",
        || confirm_memory_deletion_schedule_at(&data_root, input),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_deletion(
    app: AppHandle,
    input: PreviewMemoryDeletionInput,
) -> Result<MemoryDeletionPreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _, _) =
        prepare_memory_deletion_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_deletion(
    app: AppHandle,
    input: ConfirmMemoryDeletionInput,
) -> Result<MemoryDeletionResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_deletion",
        &plan_digest,
        "MEMORY_DELETED_AFTER_RETENTION",
        || confirm_memory_deletion_at(&data_root, input, current_utc_timestamp()?),
    )
}

#[tauri::command]
pub(crate) fn preview_memory_reconsolidation(
    app: AppHandle,
    input: PreviewMemoryReconsolidationInput,
) -> Result<MemoryReconsolidationPreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let (preview, _, _, _) =
        prepare_memory_reconsolidation_at(&data_root, input, current_utc_timestamp()?)?;
    Ok(preview)
}

#[tauri::command]
pub(crate) fn confirm_memory_reconsolidation(
    app: AppHandle,
    input: ConfirmMemoryReconsolidationInput,
) -> Result<MemoryReconsolidationResult, String> {
    let _write_guard = acquire_memory_write_lock()?;
    let data_root = alice_data_root_path(&app)?;
    let plan_digest = input.expected_plan_id.clone();
    audited_memory_operation(
        &app,
        "memory.records.write",
        "confirm_memory_reconsolidation",
        &plan_digest,
        "MEMORY_RECONSOLIDATED",
        || confirm_memory_reconsolidation_at(&data_root, input),
    )
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

fn validate_generic_memory_update(
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

#[tauri::command]
pub(crate) fn save_memory(app: AppHandle, sessions: Vec<MemorySession>) -> Result<String, String> {
    validate_memory_sessions(&sessions)?;
    let _write_guard = acquire_memory_write_lock()?;
    let path = memory_file(&app)?;
    if path.exists() {
        let existing_content = fs::read_to_string(&path)
            .map_err(|error| format!("No se pudo verificar la memoria anterior: {error}"))?;
        let existing: Vec<MemorySession> = serde_json::from_str(&existing_content)
            .map_err(|error| format!("La memoria anterior no es válida: {error}"))?;
        validate_memory_sessions(&existing)?;
        validate_generic_memory_update(&existing, &sessions)?;
    }
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

        let mut reviewed_after_retrieval: MemorySession =
            serde_json::from_value(serde_json::json!({
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
            fs::read_to_string(root.join("memory").join("records.json"))
                .expect("read second records"),
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
        let lifecycle_document_before = fs::read_to_string(memory_lifecycle_path(&root))
            .expect("read lifecycle before assessment");

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
        assert!(
            assess_memory_validity_at(&root, unconfirmed, "2026-08-22T10:20:00Z".into()).is_err()
        );
        let mut missing_source = base_input.clone();
        missing_source.declared_source = None;
        assert!(
            assess_memory_validity_at(&root, missing_source, "2026-08-22T10:20:00Z".into())
                .is_err()
        );
        let mut stale_source = base_input.clone();
        stale_source.expected_source_sha256 = format!("sha256:{}", "a".repeat(64));
        assert!(
            assess_memory_validity_at(&root, stale_source, "2026-08-22T10:20:00Z".into()).is_err()
        );
        let mut stale_record = base_input;
        stale_record.expected_record_sha256 = format!("sha256:{}", "b".repeat(64));
        assert!(
            assess_memory_validity_at(&root, stale_record, "2026-08-22T10:20:00Z".into()).is_err()
        );
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
            fs::read_to_string(root.join("memory").join("records.json"))
                .expect("read restored source"),
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
            assess_memory_accessibility_at(&root, noncurrent, "2026-08-22T11:10:00Z".into())
                .is_err()
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
            assess_memory_accessibility_at(&root, base.clone(), "2026-08-22T11:10:00Z".into())
                .is_err()
        );
        let mut unconfirmed = base.clone();
        unconfirmed.confirmed = false;
        assert!(
            assess_memory_accessibility_at(&root, unconfirmed, "2026-08-22T11:10:00Z".into())
                .is_err()
        );
        let mut stale = base;
        stale.expected_record_sha256 = format!("sha256:{}", "c".repeat(64));
        assert!(
            assess_memory_accessibility_at(&root, stale, "2026-08-22T11:10:00Z".into()).is_err()
        );
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
            assess_memory_suppression_at(&root, input.clone(), "2026-08-22T12:10:00Z".into())
                .is_err()
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
    fn final_deletion_removes_active_record_only_after_safeguard_and_writes_content_free_tombstone()
    {
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
        assert!(confirm_memory_deletion_at(
            &root,
            confirmation.clone(),
            "2026-08-27T11:00:01Z".into(),
        )
        .is_err());
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
        let (preview, _, _, _) = prepare_memory_reconsolidation_at(
            &root,
            proposal.clone(),
            "2026-08-23T13:00:00Z".into(),
        )
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
            prepare_memory_reconsolidation_at(&root, unchanged, "2026-08-23T13:10:00Z".into())
                .is_err()
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
        let (preview, _, _, _) = prepare_memory_reconsolidation_at(
            &root,
            proposal.clone(),
            "2026-08-23T13:11:00Z".into(),
        )
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
