use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Maintenance {
    pub loading: bool,
    pub error: String,
    pub lifecycle: Option<Lifecycle>,
    pub rows: Vec<LifecycleRow>,
    pub evidence: Vec<Weakening>,
    pub pending_reviews: Vec<Teaching>,
    pub next_review: Option<String>,
    pub archive_plan: Option<RecordPlan>,
    pub retention_plan: Option<RecordPlan>,
    pub consolidation: Option<Consolidation>,
    pub recovery: Option<Recovery>,
    pub candidate_records: BTreeMap<String, CandidateRecord>,
    pub merges: BTreeMap<String, MergePlan>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lifecycle {
    pub state: String,
    pub source_sha256: Option<String>,
    pub active_revision_id: Option<String>,
    pub revision_count: u32,
    pub preview: Option<LifecycleStats>,
    pub blocked_reason: Option<String>,
    pub lifecycle_writes_available: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleStats {
    pub source_sha256: String,
    pub record_count: u32,
    pub current_count: u32,
    pub conflict_count: u32,
    pub archived_count: u32,
    pub not_assessed_count: u32,
    pub accessibility_assessed_count: u32,
    pub accessible_count: u32,
    pub dormant_count: u32,
    pub retrieval_blocked_count: u32,
    pub retrieval_outcome_count: u32,
    pub functional_assessment_count: u32,
    pub weakening_review_required_count: u32,
    pub suppressed_count: u32,
    pub reconsolidated_count: u32,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleRow {
    pub record_id: String,
    pub record_sha256: String,
    pub validity: String,
    pub accessibility: String,
    pub retrieval_policy: String,
    pub retention: String,
    pub suppressed: bool,
    pub archived: bool,
    pub title: String,
    pub source: String,
    pub date: String,
    pub kind: String,
    pub discardable: bool,
    pub eligible_at: Option<String>,
    pub eligible_at_ms: Option<f64>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Weakening {
    pub state: String,
    pub title: String,
    pub record_id: String,
    pub helpful_outcomes: u32,
    pub not_helpful_outcomes: u32,
    pub evidence_count: u32,
}

#[derive(Clone, Deserialize)]
pub struct Teaching {
    pub id: String,
    pub title: String,
    pub conflict: bool,
    pub stability: i64,
    pub importance: u8,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordPlan {
    pub id: String,
    pub record_id: String,
    pub label: String,
    pub detail: String,
    pub note: String,
    pub r#final: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Consolidation {
    pub state: String,
    pub source_sha256: Option<String>,
    pub record_count: u32,
    pub eligible_record_count: u32,
    pub archived_record_count: u32,
    pub candidate_count: u32,
    pub pending_candidate_count: u32,
    pub kept_separate_count: u32,
    pub exact_duplicate_count: u32,
    pub review_required_count: u32,
    pub candidates: Vec<Candidate>,
    pub blocked_reason: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub candidate_id: String,
    pub kind: String,
    pub record_ids: [String; 2],
    pub decision_id: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Clone, Deserialize)]
pub struct CandidateRecord {
    pub title: String,
    pub summary: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recovery {
    pub state: String,
    pub receipt: Option<Receipt>,
    pub source_relation: Option<String>,
    pub blocked_reason: Option<String>,
    pub restoration_available: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub transaction_id: String,
    pub state: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergePlan {
    pub survivor_record_id: String,
    pub duplicate_record_id: String,
    pub current_record_count: u32,
    pub projected_record_count: u32,
    pub projected_source_sha256: String,
    pub projected_source_byte_length: u64,
    pub differing_fields: Vec<String>,
    pub source_backup_status: String,
    pub layer_impact: String,
    pub recovery_steps: Vec<String>,
    pub active_layer_execution_blocked: bool,
    pub transaction_receipt_version: u8,
    pub transaction_receipt_file: String,
    pub restoration_command_available: bool,
}
