//! Stored contracts and lesson data; independent of Tauri and file I/O.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Lesson {
    pub(super) id: String,
    pub(super) track: String,
    pub(super) domain: String,
    pub(super) title: String,
    pub(super) content: String,
    pub(super) source_url: String,
    pub(super) source_title: String,
    pub(super) question: String,
    pub(super) options: Vec<String>,
    pub(super) correct_option: usize,
    pub(super) explanation: String,
    pub(super) level: u8,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Curriculum {
    pub(super) schema_version: u8,
    pub(super) biblical_tradition: String,
    pub(super) lessons: Vec<Lesson>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StudyRecord {
    pub(super) id: String,
    pub(super) lesson_id: String,
    pub(super) track: String,
    pub(super) domain: String,
    pub(super) title: String,
    pub(super) content: String,
    pub(super) source_url: String,
    pub(super) source_title: String,
    pub(super) lesson_sha256: String,
    pub(super) studied_at: String,
    pub(super) attempts: u32,
    pub(super) passes: u32,
    pub(super) last_passed: bool,
    pub(super) active: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StudySnapshot {
    pub(super) schema_version: u8,
    pub(super) enabled: bool,
    pub(super) biblical_tradition: String,
    pub(super) phase: String,
    pub(super) last_started_at: Option<String>,
    pub(super) last_completed_at: Option<String>,
    pub(super) last_error: Option<String>,
    pub(super) records: Vec<StudyRecord>,
}
impl Default for StudySnapshot {
    fn default() -> Self {
        Self {
            schema_version: 1,
            enabled: true,
            biblical_tradition: "catholic".into(),
            phase: "idle".into(),
            last_started_at: None,
            last_completed_at: None,
            last_error: None,
            records: Vec::new(),
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetStudyEnabled {
    pub(super) enabled: bool,
}
