use crate::conversation_tools_model::{DocumentView, VisionView};
use serde::Deserialize;
use serde_json::Value;

#[derive(Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Payload {
    pub draft: String,
    pub sending: bool,
    pub error: String,
    pub configured: bool,
    pub desktop_app: bool,
    pub local_inference: bool,
    pub configured_provider: String,
    pub model: String,
    pub protocol: String,
    pub retention: String,
    pub automatic_label: Option<String>,
    pub include_history: bool,
    pub include_memory: bool,
    pub include_window: bool,
    pub observation_enabled: bool,
    pub window_process: Option<String>,
    pub delegated_actions: bool,
    pub voice_busy: bool,
    pub voice_pending: Option<String>,
    pub status_label: String,
    pub status_tone: String,
    pub can_review: bool,
    pub review: Option<Review>,
    pub history_available: bool,
    pub history_count: usize,
    pub memory_count: usize,
    pub dormant_count: usize,
    pub suppressed_count: usize,
    pub memory_matches: Vec<MemoryMatch>,
    pub hybrid_count: usize,
    pub hybrid_active: bool,
    pub hybrid_pending: bool,
    pub hybrid_elapsed: Option<String>,
    pub messages: Vec<Message>,
    pub can_learn: bool,
    pub learning_message: String,
    pub learning_pending: Option<String>,
    pub learning: Option<Vec<LearningCandidate>>,
    pub retrievals: Vec<Retrieval>,
    pub feedback_pending: Option<String>,
    #[serde(default)]
    pub voice: Value,
    #[serde(default)]
    pub identification: Value,
    #[serde(default)]
    pub document: DocumentView,
    #[serde(default)]
    pub vision: VisionView,
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub model: String,
    pub provider: String,
    pub local: bool,
    pub payload: String,
    pub can_send: bool,
    pub fragments: Vec<Fragment>,
    pub separator_characters: String,
    pub separator_bytes: String,
    pub total_characters: String,
    pub total_bytes: String,
}

#[derive(Clone, Deserialize, PartialEq)]
pub struct Fragment {
    pub id: String,
    pub label: String,
    pub included: bool,
    pub characters: String,
    pub bytes: String,
}

#[derive(Clone, Deserialize, PartialEq)]
pub struct MemoryMatch {
    pub title: String,
    pub rank: String,
    pub reason: String,
}

#[derive(Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub role: String,
    pub text: String,
    pub model: Option<String>,
    pub time: String,
    pub exchange_id: Option<String>,
}

#[derive(Clone, Deserialize, PartialEq)]
pub struct LearningCandidate {
    pub id: String,
    pub title: String,
    pub description: String,
    pub score: String,
    pub evidence: String,
    pub importance: u8,
    pub affects: Vec<Affect>,
}

#[derive(Clone, Deserialize, PartialEq)]
pub struct Affect {
    pub id: String,
    pub color: String,
    pub label: String,
    pub intensity: u8,
    pub evidence: String,
}

#[derive(Clone, Deserialize, PartialEq)]
pub struct Retrieval {
    pub key: String,
    pub title: String,
}
