use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Payload {
    Configure {
        setup: Setup,
    },
    Page {
        page: Box<Page>,
    },
    Layers {
        layers: Option<Layers>,
        loading: bool,
        error: String,
    },
    EditRecord {
        id: String,
    },
    Maintenance {
        count: Option<u32>,
        busy: bool,
    },
    Result {
        request: u32,
        result: OperationResult,
    },
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setup {
    pub view: View,
    pub slot: String,
    pub desktop: bool,
}

#[derive(Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum View {
    #[default]
    Learning,
    Records,
    Working,
    Profile,
    Review,
    Layers,
    Consolidate,
    Safety,
}

impl View {
    pub fn section(self) -> Self {
        match self {
            Self::Profile => Self::Records,
            Self::Layers | Self::Consolidate | Self::Safety => Self::Review,
            _ => self,
        }
    }
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub memory_status: String,
    pub memory_path: String,
    pub records: Vec<Record>,
    pub by_origin: Origins,
    pub profile_count: usize,
    pub due: usize,
    pub owner_profile: Option<Profile>,
    pub owner_profile_error: String,
    pub working: Option<Working>,
    pub study: Study,
    pub automatic: Automatic,
}

#[derive(Clone, Default, Deserialize)]
pub struct Origins {
    pub conversation: usize,
    pub observation: usize,
    pub teaching: usize,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub id: String,
    pub intention: String,
    pub summary: String,
    pub source: String,
    pub next_step: String,
    pub status: Option<String>,
    pub teaching: bool,
    pub validity: String,
    pub archived: bool,
    pub version: Option<u32>,
    pub deletion_date: Option<String>,
    pub importance: u8,
    pub stability: i64,
    pub recalls: u64,
    pub reviews: u64,
    pub type_label: Option<String>,
    pub memory_type: String,
    pub origin: String,
    pub date: String,
    pub discardable: bool,
    pub proposal: Option<Proposal>,
}

impl Record {
    pub fn versioned(&self) -> bool {
        matches!(self.status.as_deref(), Some("confirmed" | "conflict"))
    }

    pub fn matches(&self, query: &str) -> bool {
        query.is_empty()
            || format!(
                "{} {} {} {} {}",
                self.intention, self.summary, self.next_step, self.source, self.memory_type
            )
            .to_lowercase()
            .contains(query)
    }
}

#[derive(Clone, Deserialize)]
pub struct Proposal {
    pub state: String,
    pub label: String,
    pub reason: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Edit {
    pub id: String,
    pub intention: String,
    pub summary: String,
    pub next_step: String,
    pub source: String,
    pub importance: u8,
    pub reason: String,
    pub note: String,
}

impl From<&Record> for Edit {
    fn from(record: &Record) -> Self {
        Self {
            id: record.id.clone(),
            intention: record.intention.clone(),
            summary: record.summary.clone(),
            next_step: record.next_step.clone(),
            source: record.source.clone(),
            importance: record.importance,
            reason: if record.status.as_deref() == Some("conflict") {
                "ownerCorrection"
            } else {
                "clarification"
            }
            .into(),
            note: String::new(),
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub plan_id: String,
    pub record_id: String,
    pub previous_version: u32,
    pub projected_version: u32,
    pub changed_fields: Vec<String>,
}

#[derive(Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OperationResult {
    pub close_edit: bool,
    pub close_automatic_edit: bool,
    pub message: String,
    pub error: String,
    pub plan: Option<Plan>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub state: String,
    pub storage_path: String,
    pub owner_name: Option<String>,
    pub confirmed_by: Option<String>,
    pub source_files: Vec<serde_json::Value>,
    pub records: Vec<ProfileRecord>,
}

#[derive(Clone, Deserialize)]
pub struct ProfileRecord {
    pub id: String,
    pub intention: String,
    pub summary: String,
    pub source: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Working {
    pub state: String,
    pub generation: u64,
    pub message_count: u32,
    pub max_messages: u32,
    pub exchange_count: u32,
    pub characters: String,
    pub max_characters: String,
    pub usage: u32,
    pub remaining: String,
    pub exchanges: Vec<Exchange>,
}

#[derive(Clone, Deserialize)]
pub struct Exchange {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub date: String,
    pub source: String,
}

#[derive(Clone, Default, Deserialize)]
pub struct Study {
    pub ready: bool,
    pub enabled: bool,
    pub error: String,
    pub phase: String,
    pub studied: u32,
    pub available: u32,
    pub tracks: String,
    pub records: Vec<Lesson>,
}

#[derive(Clone, Deserialize)]
pub struct Lesson {
    pub id: String,
    pub available: bool,
    pub track: String,
    pub title: String,
    pub content: String,
    pub url: String,
    pub source: String,
    pub date: String,
    pub sha: String,
    pub passes: u32,
    pub attempts: u32,
    pub passed: bool,
}

#[derive(Clone, Default, Deserialize)]
pub struct Automatic {
    pub ready: bool,
    pub enabled: bool,
    pub count: u32,
    pub error: String,
    pub phase: String,
    pub records: Vec<AutomaticRecord>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomaticRecord {
    pub id: String,
    pub active: bool,
    pub corrected: bool,
    pub type_label: String,
    pub content: String,
    pub evidence: String,
    pub importance: u8,
    pub date: String,
    pub source: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layers {
    pub state: String,
    pub active_revision_id: Option<String>,
    pub blocked_reason: Option<String>,
    pub revision_count: u32,
    pub preview: Option<LayerPreview>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerPreview {
    pub source_sha256: String,
    pub record_count: u32,
    pub working_count: u32,
    pub episodic_count: u32,
    pub taught_fact_count: u32,
    pub procedural_count: u32,
    pub unclassified_count: u32,
    pub procedural_pending_count: u32,
}
