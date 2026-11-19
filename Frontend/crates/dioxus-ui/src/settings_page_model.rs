use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub label: String,
    pub configured: bool,
    pub default_model: String,
    pub protocol: String,
    pub retention_mode: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub desktop_app: bool,
    pub providers: Vec<Provider>,
    pub provider: String,
    pub model: String,
    pub show_full_history: bool,
}

#[derive(Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Payload {
    Configure { settings: Settings },
    Runtime { runtime: Runtime },
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Runtime {
    pub running: bool,
    pub pending: Option<RuntimeOperation>,
    pub message: String,
}

#[derive(Clone, Copy, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeOperation {
    Start,
    Stop,
}

impl Runtime {
    pub fn can_start(&self, desktop: bool) -> bool {
        desktop && !self.running && self.pending.is_none()
    }
    pub fn can_stop(&self, desktop: bool) -> bool {
        desktop
            && (self.running || self.pending == Some(RuntimeOperation::Start))
            && self.pending != Some(RuntimeOperation::Stop)
    }
}
