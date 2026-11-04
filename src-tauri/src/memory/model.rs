//! Memory contracts and serialized data; fields remain within the memory module.
use serde::Deserialize;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryContextEvent {
    #[serde(rename = "type")]
    pub(super) event_type: String,
    pub(super) recorded_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySession {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(super) affects: Vec<crate::memory_affect::MemoryAffect>,
    pub(super) id: String,
    pub(super) kind: String,
    pub(super) intention: String,
    pub(super) started_at: String,
    pub(super) finished_at: Option<String>,
    pub(super) summary: Option<String>,
    pub(super) next_step: Option<String>,
    pub(super) memory_type: Option<String>,
    pub(super) source: Option<String>,
    pub(super) importance: Option<u8>,
    pub(super) storage_strength: Option<f64>,
    pub(super) memory_status: Option<String>,
    pub(super) accessibility_status: Option<String>,
    pub(super) accessibility_updated_at: Option<String>,
    pub(super) suppression_status: Option<String>,
    pub(super) suppression_reason: Option<String>,
    pub(super) suppression_updated_at: Option<String>,
    pub(super) archive_status: Option<String>,
    pub(super) archive_reason: Option<String>,
    pub(super) archive_updated_at: Option<String>,
    pub(super) deletion_status: Option<String>,
    pub(super) deletion_reason: Option<String>,
    pub(super) deletion_requested_at: Option<String>,
    pub(super) deletion_eligible_at: Option<String>,
    pub(super) memory_version: Option<u32>,
    pub(super) reconsolidated_at: Option<String>,
    pub(super) reconsolidation_reason: Option<String>,
    pub(super) previous_version_sha256: Option<String>,
    #[serde(default)]
    pub(super) successful_recalls: u32,
    #[serde(default)]
    pub(super) failed_recalls: u32,
    pub(super) last_recalled_at: Option<String>,
    pub(super) retrieval_evidence_version: Option<u8>,
    #[serde(default)]
    pub(super) successful_reviews: u32,
    #[serde(default)]
    pub(super) correction_count: u32,
    pub(super) last_reviewed_at: Option<String>,
    #[serde(default)]
    pub(super) context_events: Vec<MemoryContextEvent>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySnapshot {
    pub(super) sessions: Vec<MemorySession>,
    pub(super) storage_path: String,
    pub(super) existed: bool,
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
    pub(super) relative_path: String,
    pub(super) byte_length: u64,
    pub(super) sha256: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkdownNoteCatalogSnapshot {
    pub(super) vault_path: String,
    pub(super) vault_exists: bool,
    pub(super) note_count: usize,
    pub(super) notes: Vec<MarkdownNoteCatalogEntry>,
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
pub(super) struct MemoryAuditEntry {
    pub(super) timestamp_ms: u128,
    pub(super) action: String,
    pub(super) session_count: usize,
    pub(super) sha256: String,
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
pub(super) struct LayeredMemorySource {
    pub(super) records_file: String,
    pub(super) sha256: String,
    pub(super) record_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LayeredMemoryReference {
    pub(super) record_id: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum ProceduralMemoryLinkState {
    PendingR5,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LayeredProceduralMemoryReference {
    pub(super) record_id: String,
    pub(super) link_state: ProceduralMemoryLinkState,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum UnclassifiedMemoryReason {
    PreferenceNeedsOwnLayer,
    MissingExplicitType,
    UnsupportedExplicitType,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct UnclassifiedMemoryReference {
    pub(super) record_id: String,
    pub(super) reason: UnclassifiedMemoryReason,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LayeredMemoryLayers {
    pub(super) working: Vec<LayeredMemoryReference>,
    pub(super) episodic: Vec<LayeredMemoryReference>,
    pub(super) taught_facts: Vec<LayeredMemoryReference>,
    pub(super) procedural: Vec<LayeredProceduralMemoryReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LayeredMemoryRevision {
    pub(super) revision_id: String,
    pub(super) created_at: String,
    pub(super) source: LayeredMemorySource,
    pub(super) layers: LayeredMemoryLayers,
    pub(super) unclassified: Vec<UnclassifiedMemoryReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct LayeredMemoryDocument {
    pub(super) schema_version: u8,
    pub(super) active_revision_id: Option<String>,
    pub(super) revisions: Vec<LayeredMemoryRevision>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LayeredMemoryPreview {
    pub(super) source_sha256: String,
    pub(super) record_count: usize,
    pub(super) working_count: usize,
    pub(super) episodic_count: usize,
    pub(super) taught_fact_count: usize,
    pub(super) procedural_count: usize,
    pub(super) unclassified_count: usize,
    pub(super) procedural_pending_count: usize,
    pub(super) preference_pending_count: usize,
    pub(super) content_copied: bool,
    pub(super) automatic_classification: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LayeredMemorySnapshot {
    pub(super) schema_version: u8,
    pub(super) state: LayeredMemoryState,
    pub(super) storage_path: String,
    pub(super) source_sha256: Option<String>,
    pub(super) active_revision_id: Option<String>,
    pub(super) revision_count: usize,
    pub(super) preview: Option<LayeredMemoryPreview>,
    pub(super) blocked_reason: Option<String>,
    pub(super) migration_requires_confirmation: bool,
    pub(super) automatic_migration: bool,
    pub(super) content_copied: bool,
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
    pub(super) record_id: String,
    pub(super) helpful_outcomes: u32,
    pub(super) not_helpful_outcomes: u32,
    pub(super) evidence_count: u32,
    pub(super) state: MemoryWeakeningAssessmentState,
    pub(super) automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MemoryLifecycleReference {
    pub(super) record_id: String,
    pub(super) record_sha256: String,
    pub(super) validity: MemoryValidityState,
    pub(super) accessibility: MemoryAccessibilityState,
    pub(super) retrieval_policy: MemoryRetrievalPolicy,
    pub(super) retention: MemoryRetentionState,
    pub(super) suppressed: bool,
    pub(super) archived: bool,
    pub(super) base_version: u32,
    pub(super) reconsolidation_count: u32,
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
    pub(super) node_id: String,
    pub(super) record_version: u32,
    pub(super) lifecycle: MemoryLifecycleReference,
    pub(super) layer: MemoryGraphLayer,
    pub(super) has_declared_source: bool,
    pub(super) evidence_use: MemoryGraphEvidenceUse,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MemoryLifecycleSource {
    pub(super) records_file: String,
    pub(super) sha256: String,
    pub(super) record_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MemoryLifecycleRevision {
    pub(super) revision_id: String,
    pub(super) created_at: String,
    pub(super) source: MemoryLifecycleSource,
    pub(super) references: Vec<MemoryLifecycleReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MemoryLifecycleDocument {
    pub(super) schema_version: u8,
    pub(super) active_revision_id: Option<String>,
    pub(super) revisions: Vec<MemoryLifecycleRevision>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryLifecyclePreview {
    pub(super) source_sha256: String,
    pub(super) record_count: usize,
    pub(super) current_count: usize,
    pub(super) conflict_count: usize,
    pub(super) archived_count: usize,
    pub(super) not_assessed_count: usize,
    pub(super) accessibility_assessed_count: usize,
    pub(super) accessible_count: usize,
    pub(super) dormant_count: usize,
    pub(super) retrieval_eligible_count: usize,
    pub(super) retrieval_blocked_count: usize,
    pub(super) retrieval_outcome_count: u32,
    pub(super) functional_assessment_count: usize,
    pub(super) weakening_review_required_count: usize,
    pub(super) retention_assessed_count: usize,
    pub(super) suppressed_count: usize,
    pub(super) reconsolidated_count: usize,
    pub(super) references: Vec<MemoryLifecycleReference>,
    pub(super) weakening_assessments: Vec<MemoryWeakeningAssessment>,
    pub(super) records_modified: bool,
    pub(super) content_copied: bool,
    pub(super) automatic_inference: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryLifecyclePreviewSnapshot {
    pub(super) schema_version: u8,
    pub(super) state: MemoryLifecyclePreviewState,
    pub(super) storage_path: String,
    pub(super) source_sha256: Option<String>,
    pub(super) active_revision_id: Option<String>,
    pub(super) revision_count: usize,
    pub(super) preview: Option<MemoryLifecyclePreview>,
    pub(super) blocked_reason: Option<String>,
    pub(super) migration_requires_confirmation: bool,
    pub(super) lifecycle_writes_available: bool,
    pub(super) records_modified: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ActivateMemoryLifecycleInput {
    pub(super) expected_source_sha256: String,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RollbackMemoryLifecycleInput {
    pub(super) expected_revision_id: String,
    pub(super) confirmed: bool,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryValidityAssessmentAction,
    pub(super) declared_source: Option<String>,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryValidityAssessmentResult {
    pub(super) schema_version: u8,
    pub(super) record_id: String,
    pub(super) action: MemoryValidityAssessmentAction,
    pub(super) previous_validity: MemoryValidityState,
    pub(super) new_validity: MemoryValidityState,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryAccessibilityAssessmentAction,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryAccessibilityAssessmentResult {
    pub(super) schema_version: u8,
    pub(super) record_id: String,
    pub(super) action: MemoryAccessibilityAssessmentAction,
    pub(super) previous_accessibility: MemoryAccessibilityState,
    pub(super) new_accessibility: MemoryAccessibilityState,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemorySuppressionAction,
    pub(super) reason: MemorySuppressionReason,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySuppressionAssessmentResult {
    pub(super) schema_version: u8,
    pub(super) record_id: String,
    pub(super) action: MemorySuppressionAction,
    pub(super) reason: MemorySuppressionReason,
    pub(super) previous_suppressed: bool,
    pub(super) new_suppressed: bool,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryArchiveAction,
    pub(super) reason: MemoryArchiveReason,
    pub(super) note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryArchiveInput {
    pub(super) expected_plan_id: String,
    pub(super) planned_at: String,
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryArchiveAction,
    pub(super) reason: MemoryArchiveReason,
    pub(super) note: String,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryArchivePreview {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) planned_at: String,
    pub(super) record_id: String,
    pub(super) action: MemoryArchiveAction,
    pub(super) reason: MemoryArchiveReason,
    pub(super) note_sha256: String,
    pub(super) source_sha256: String,
    pub(super) record_sha256_before: String,
    pub(super) projected_record_sha256: String,
    pub(super) previous_archived: bool,
    pub(super) projected_archived: bool,
    pub(super) records_modified: bool,
    pub(super) automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryArchiveResult {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) record_id: String,
    pub(super) action: MemoryArchiveAction,
    pub(super) reason: MemoryArchiveReason,
    pub(super) previous_archived: bool,
    pub(super) new_archived: bool,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) record_sha256_before: String,
    pub(super) record_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryDeletionScheduleAction,
    pub(super) reason: MemoryDeletionReason,
    pub(super) note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryDeletionScheduleInput {
    pub(super) expected_plan_id: String,
    pub(super) planned_at: String,
    pub(super) eligible_at: String,
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) action: MemoryDeletionScheduleAction,
    pub(super) reason: MemoryDeletionReason,
    pub(super) note: String,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionSchedulePreview {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) planned_at: String,
    pub(super) eligible_at: String,
    pub(super) record_id: String,
    pub(super) action: MemoryDeletionScheduleAction,
    pub(super) reason: MemoryDeletionReason,
    pub(super) note_sha256: String,
    pub(super) source_sha256: String,
    pub(super) record_sha256_before: String,
    pub(super) projected_record_sha256: String,
    pub(super) previous_scheduled: bool,
    pub(super) projected_scheduled: bool,
    pub(super) wait_seconds: i64,
    pub(super) records_modified: bool,
    pub(super) automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionScheduleResult {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) record_id: String,
    pub(super) action: MemoryDeletionScheduleAction,
    pub(super) reason: MemoryDeletionReason,
    pub(super) previous_scheduled: bool,
    pub(super) new_scheduled: bool,
    pub(super) eligible_at: Option<String>,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) record_sha256_before: String,
    pub(super) record_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewMemoryDeletionInput {
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryDeletionInput {
    pub(super) expected_plan_id: String,
    pub(super) planned_at: String,
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) note: String,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionPreview {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) planned_at: String,
    pub(super) record_id: String,
    pub(super) reason: MemoryDeletionReason,
    pub(super) note_sha256: String,
    pub(super) source_sha256: String,
    pub(super) record_sha256: String,
    pub(super) requested_at: String,
    pub(super) eligible_at: String,
    pub(super) safeguard_required: bool,
    pub(super) tombstone_contains_content: bool,
    pub(super) records_modified: bool,
    pub(super) automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryDeletionResult {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) record_id: String,
    pub(super) reason: MemoryDeletionReason,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) record_sha256: String,
    pub(super) safeguard_sha256: String,
    pub(super) tombstone_sha256: String,
    pub(super) remaining_record_count: usize,
    pub(super) records_modified: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MemoryDeletionTombstone {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) record_id_sha256: String,
    pub(super) record_sha256: String,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) reason: MemoryDeletionReason,
    pub(super) requested_at: String,
    pub(super) eligible_at: String,
    pub(super) deleted_at: String,
    pub(super) note_sha256: String,
    pub(super) safeguard_sha256: String,
    pub(super) content_included: bool,
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
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) reason: MemoryReconsolidationReason,
    pub(super) note: String,
    pub(super) proposed_intention: String,
    pub(super) proposed_summary: Option<String>,
    pub(super) proposed_next_step: Option<String>,
    pub(super) proposed_source: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmMemoryReconsolidationInput {
    pub(super) expected_plan_id: String,
    pub(super) planned_at: String,
    pub(super) expected_source_sha256: String,
    pub(super) record_id: String,
    pub(super) expected_record_sha256: String,
    pub(super) reason: MemoryReconsolidationReason,
    pub(super) note: String,
    pub(super) proposed_intention: String,
    pub(super) proposed_summary: Option<String>,
    pub(super) proposed_next_step: Option<String>,
    pub(super) proposed_source: Option<String>,
    pub(super) confirmed: bool,
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
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) planned_at: String,
    pub(super) record_id: String,
    pub(super) reason: MemoryReconsolidationReason,
    pub(super) note_sha256: String,
    pub(super) source_sha256: String,
    pub(super) record_sha256_before: String,
    pub(super) projected_record_sha256: String,
    pub(super) previous_version: u32,
    pub(super) projected_version: u32,
    pub(super) changed_fields: Vec<MemoryReconsolidationField>,
    pub(super) records_modified: bool,
    pub(super) version_written: bool,
    pub(super) automatic_action: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MemoryReconsolidationRevision {
    pub(super) schema_version: u8,
    pub(super) revision_id: String,
    pub(super) plan_id: String,
    pub(super) record_id: String,
    pub(super) previous_version: u32,
    pub(super) successor_version: u32,
    pub(super) reason: MemoryReconsolidationReason,
    pub(super) note_sha256: String,
    pub(super) superseded_at: String,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) record_sha256_before: String,
    pub(super) record_sha256_after: String,
    pub(super) record: MemorySession,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryReconsolidationResult {
    pub(super) schema_version: u8,
    pub(super) plan_id: String,
    pub(super) revision_id: String,
    pub(super) record_id: String,
    pub(super) reason: MemoryReconsolidationReason,
    pub(super) previous_version: u32,
    pub(super) new_version: u32,
    pub(super) source_sha256_before: String,
    pub(super) source_sha256_after: String,
    pub(super) record_sha256_before: String,
    pub(super) record_sha256_after: String,
    pub(super) backup_sha256: String,
    pub(super) revision_sha256: String,
    pub(super) records_modified: bool,
    pub(super) version_written: bool,
    pub(super) audit_written: bool,
    pub(super) lifecycle: MemoryLifecyclePreviewSnapshot,
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
    pub(super) candidate_id: String,
    pub(super) kind: ConsolidationCandidateKind,
    pub(super) record_ids: Vec<String>,
    pub(super) reason_code: ConsolidationReasonCode,
    pub(super) requires_human_review: bool,
    pub(super) resolution: Option<ConsolidationResolutionAction>,
    pub(super) decision_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationPreviewSnapshot {
    pub(super) schema_version: u8,
    pub(super) state: ConsolidationPreviewState,
    pub(super) storage_path: String,
    pub(super) source_sha256: Option<String>,
    pub(super) record_count: usize,
    pub(super) eligible_record_count: usize,
    pub(super) archived_record_count: usize,
    pub(super) candidate_count: usize,
    pub(super) pending_candidate_count: usize,
    pub(super) kept_separate_count: usize,
    pub(super) exact_duplicate_count: usize,
    pub(super) review_required_count: usize,
    pub(super) candidates: Vec<ConsolidationCandidate>,
    pub(super) blocked_reason: Option<String>,
    pub(super) automatic_merge: bool,
    pub(super) records_modified: bool,
    pub(super) model_used: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConsolidationResolutionAction {
    KeepSeparate,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ConsolidationDecision {
    pub(super) decision_id: String,
    pub(super) candidate_id: String,
    pub(super) source_sha256: String,
    pub(super) candidate_kind: ConsolidationCandidateKind,
    pub(super) reason_code: ConsolidationReasonCode,
    pub(super) record_ids: Vec<String>,
    pub(super) action: ConsolidationResolutionAction,
    pub(super) decided_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ConsolidationDecisionDocument {
    pub(super) schema_version: u8,
    pub(super) decisions: Vec<ConsolidationDecision>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ResolveConsolidationCandidateInput {
    pub(super) expected_source_sha256: String,
    pub(super) candidate_id: String,
    pub(super) expected_record_ids: Vec<String>,
    pub(super) action: ConsolidationResolutionAction,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationResolutionResult {
    pub(super) schema_version: u8,
    pub(super) decision: ConsolidationDecision,
    pub(super) source_backup_path: String,
    pub(super) ledger_path: String,
    pub(super) backup_created: bool,
    pub(super) records_modified: bool,
    pub(super) model_used: bool,
    pub(super) preview: ConsolidationPreviewSnapshot,
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
    pub(super) expected_source_sha256: String,
    pub(super) candidate_id: String,
    pub(super) expected_record_ids: Vec<String>,
    pub(super) survivor_record_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationMergePreview {
    pub(super) schema_version: u8,
    pub(super) source_sha256: String,
    pub(super) candidate_id: String,
    pub(super) candidate_kind: ConsolidationCandidateKind,
    pub(super) reason_code: ConsolidationReasonCode,
    pub(super) record_ids: Vec<String>,
    pub(super) survivor_record_id: String,
    pub(super) duplicate_record_id: String,
    pub(super) current_record_count: usize,
    pub(super) projected_record_count: usize,
    pub(super) projected_source_sha256: String,
    pub(super) projected_source_byte_length: usize,
    pub(super) normalized_content_equal: bool,
    pub(super) differing_fields: Vec<ConsolidationMergeDifferenceField>,
    pub(super) source_backup_path: String,
    pub(super) source_backup_status: ConsolidationMergeBackupStatus,
    pub(super) layer_impact: ConsolidationMergeLayerImpact,
    pub(super) active_layer_revision_id: Option<String>,
    pub(super) recovery_protocol_version: u8,
    pub(super) recovery_steps: Vec<ConsolidationRecoveryStep>,
    pub(super) byte_exact_backup_required: bool,
    pub(super) atomic_replace_required: bool,
    pub(super) audit_required: bool,
    pub(super) restored_source_verification_required: bool,
    pub(super) active_layer_execution_blocked: bool,
    pub(super) transaction_receipt_version: u8,
    pub(super) transaction_receipt_file: String,
    pub(super) durable_receipt_required: bool,
    pub(super) restart_recovery_required: bool,
    pub(super) execution_available: bool,
    pub(super) requires_final_confirmation: bool,
    pub(super) restoration_command_available: bool,
    pub(super) records_modified: bool,
    pub(super) files_created: bool,
    pub(super) audit_written: bool,
    pub(super) model_used: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
// Deliberadamente desconectado de Tauri hasta que R6.3 autorice ejecución canónica.
#[allow(dead_code)]
pub(super) struct ConsolidationRecoveryRehearsal {
    pub(super) source_sha256: String,
    pub(super) projected_source_sha256: String,
    pub(super) restored_source_sha256: String,
    pub(super) source_backup_path: String,
    pub(super) backup_created: bool,
    pub(super) projected_source_verified: bool,
    pub(super) audit_written: bool,
    pub(super) source_restored: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ConsolidationTransactionReceipt {
    pub(super) transaction_id: String,
    pub(super) candidate_id: String,
    pub(super) record_ids: Vec<String>,
    pub(super) survivor_record_id: String,
    pub(super) duplicate_record_id: String,
    pub(super) source_sha256: String,
    pub(super) projected_source_sha256: String,
    pub(super) source_backup_file: String,
    pub(super) state: ConsolidationTransactionState,
    pub(super) created_at: String,
    pub(super) restored_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ConsolidationTransactionDocument {
    pub(super) schema_version: u8,
    pub(super) transactions: Vec<ConsolidationTransactionReceipt>,
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
    pub(super) transaction_id: String,
    pub(super) candidate_id: String,
    pub(super) source_sha256: String,
    pub(super) projected_source_sha256: String,
    pub(super) source_backup_file: String,
    pub(super) state: ConsolidationTransactionState,
    pub(super) created_at: String,
    pub(super) restored_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationRecoveryStatusSnapshot {
    pub(super) schema_version: u8,
    pub(super) state: ConsolidationRecoveryStatusState,
    pub(super) receipt_path: String,
    pub(super) receipt_file_exists: bool,
    pub(super) transaction_count: usize,
    pub(super) receipt: Option<ConsolidationRecoveryReceiptView>,
    pub(super) source_relation: Option<ConsolidationSourceRelation>,
    pub(super) current_source_sha256: Option<String>,
    pub(super) blocked_reason: Option<String>,
    pub(super) restoration_available: bool,
    pub(super) restoration_requires_confirmation: bool,
    pub(super) automatic_recovery: bool,
    pub(super) merge_execution_available: bool,
    pub(super) records_modified: bool,
    pub(super) files_created: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RestoreConsolidationTransactionInput {
    pub(super) transaction_id: String,
    pub(super) expected_source_sha256: String,
    pub(super) expected_projected_source_sha256: String,
    pub(super) confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConsolidationRestorationResult {
    pub(super) schema_version: u8,
    pub(super) transaction_id: String,
    pub(super) source_sha256: String,
    pub(super) source_restored: bool,
    pub(super) audit_written: bool,
    pub(super) already_restored: bool,
    pub(super) receipt_state: ConsolidationTransactionState,
    pub(super) status: ConsolidationRecoveryStatusSnapshot,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub(super) struct ConsolidationRestartRecoveryResult {
    pub(super) transaction_id: String,
    pub(super) source_sha256: String,
    pub(super) source_restored: bool,
    pub(super) audit_written: bool,
    pub(super) receipt_state: ConsolidationTransactionState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ActivateLayeredMemoryInput {
    pub(super) expected_source_sha256: String,
    pub(super) confirmed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RollbackLayeredMemoryInput {
    pub(super) expected_revision_id: String,
    pub(super) confirmed: bool,
}
