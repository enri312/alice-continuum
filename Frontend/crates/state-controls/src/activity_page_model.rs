//! Cognitive Activity presentation. Session event production stays at the app boundary.
use crate::timeline_model::{self, Event, Module};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum View {
    Timeline,
    Events,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Filter {
    All,
    System,
    Perception,
    Memory,
    Workspace,
    Output,
    Security,
}
impl Filter {
    pub fn label(self) -> &'static str {
        match self {
            Self::All => "ALL",
            Self::System => "SYSTEM",
            Self::Perception => "PERCEPTION",
            Self::Memory => "MEMORY",
            Self::Workspace => "WORKSPACE",
            Self::Output => "OUTPUT",
            Self::Security => "SECURITY",
        }
    }
    pub fn from_label(raw: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::String(raw.into())).ok()
    }
    fn matches(self, module: Module) -> bool {
        self == Self::All || self.label() == module.label()
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub view: View,
    pub module: Filter,
    pub query: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub timeline: timeline_model::Payload,
    pub stream_times: Vec<String>,
    pub requested_view: String,
    pub settings: Option<Settings>,
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self =
            serde_json::from_str(raw).map_err(|_| "Actividad inválida".to_string())?;
        value.timeline.validate()?;
        if value.stream_times.len() != value.timeline.events.len()
            || value
                .stream_times
                .iter()
                .any(|time| time.trim().is_empty() || time.encode_utf16().count() > 64)
            || value
                .settings
                .as_ref()
                .is_some_and(|settings| settings.query.encode_utf16().count() > 8192)
        {
            return Err("Actividad fuera del contrato".into());
        }
        Ok(value)
    }
}
pub struct State {
    pub timeline: timeline_model::State,
    pub settings: Settings,
    stream_times: Vec<String>,
}
impl State {
    pub fn new(payload: Payload) -> Self {
        Self {
            timeline: timeline_model::State::new(payload.timeline),
            settings: payload.settings.unwrap_or(Settings {
                view: if payload.requested_view == "events" {
                    View::Events
                } else {
                    View::Timeline
                },
                module: Filter::All,
                query: String::new(),
            }),
            stream_times: payload.stream_times,
        }
    }
    pub fn update(&mut self, payload: Payload) {
        self.timeline.update(payload.timeline);
        self.stream_times = payload.stream_times;
    }
    pub fn set_query(&mut self, query: String) -> bool {
        if query.encode_utf16().count() > 8192 {
            return false;
        }
        self.settings.query = query;
        true
    }
    pub fn filtered(&self) -> Vec<(&Event, &str)> {
        let query = self.settings.query.trim().to_lowercase();
        self.timeline
            .events()
            .iter()
            .zip(&self.stream_times)
            .rev()
            .filter(|(event, _)| {
                self.settings.module.matches(event.module)
                    && format!("{} {} {}", event.module.label(), event.node, event.payload)
                        .to_lowercase()
                        .contains(&query)
            })
            .map(|(event, time)| (event, time.as_str()))
            .collect()
    }
    pub fn recovery(&self) -> String {
        serde_json::json!({"type":"state", "view":self.settings.view, "module":self.settings.module,
            "query":self.settings.query, "selectedId":self.timeline.selected().map_or("", |event| &event.id)}).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn payload() -> Payload {
        Payload::parse(&json!({"timeline":{"events":[
            {"id":"a","sequence":1,"timestampMs":0,"timeLabel":"00:00:00","module":"MEMORY","level":"INFO","node":"ÁRBOL","payload":"<b>literal</b>"},
            {"id":"b","sequence":2,"timestampMs":1,"timeLabel":"00:00:00","module":"OUTPUT","level":"WARN","node":"VOICE","payload":"Hola"},
            {"id":"c","sequence":3,"timestampMs":2,"timeLabel":"00:00:00","module":"MEMORY","level":"TRACE","node":"ÁRBOL","payload":"Otra señal"}
        ],"selectedId":""},"streamTimes":["00:00:00,000","00:00:00,001","00:00:00,002"],"requestedView":"events","settings":null}).to_string()).unwrap()
    }
    #[test]
    fn filters_in_reverse_source_order_without_losing_literal_content() {
        let mut state = State::new(payload());
        assert_eq!(state.settings.view, View::Events);
        assert_eq!(
            state
                .filtered()
                .iter()
                .map(|(event, _)| event.id.as_str())
                .collect::<Vec<_>>(),
            vec!["c", "b", "a"]
        );
        state.settings.module = Filter::Memory;
        assert!(state.set_query("  ÁRBOL  ".into()));
        assert_eq!(state.filtered().len(), 2);
        assert!(state.set_query("<B>".into()));
        assert_eq!(state.filtered()[0].0.payload, "<b>literal</b>");
        assert_eq!(state.filtered()[0].1, "00:00:00,000");
        state.settings.module = Filter::Output;
        assert!(state.filtered().is_empty());
        assert_eq!(state.timeline.total(), 3);
    }
    #[test]
    fn retains_filters_and_selection_on_refresh_and_restores_them_on_retry() {
        let mut state = State::new(payload());
        state.settings.module = Filter::Output;
        state.set_query("Hola".into());
        assert!(state.timeline.select("a"));
        state.update(payload());
        assert_eq!(state.filtered()[0].0.id, "b");
        assert_eq!(state.timeline.selected().unwrap().id, "a");
        let recovery: serde_json::Value = serde_json::from_str(&state.recovery()).unwrap();
        assert_eq!(recovery["selectedId"], "a");
        let mut retry = payload();
        retry.settings = Some(state.settings.clone());
        retry.timeline.selected_id = "a".into();
        let retry = State::new(retry);
        assert_eq!(retry.filtered()[0].0.id, "b");
        assert_eq!(retry.timeline.selected().unwrap().id, "a");
        let mut empty = payload();
        empty.timeline.events.clear();
        empty.stream_times.clear();
        state.update(empty);
        assert_eq!(state.settings.query, "Hola");
        assert!(state.filtered().is_empty());
        assert!(state.timeline.selected().is_none());
    }
    #[test]
    fn rejects_mismatched_clocks_ambiguous_events_and_unknown_settings() {
        let raw = json!({"timeline":{"events":[],"selectedId":""},"streamTimes":[],"requestedView":"audit","settings":null});
        assert_eq!(
            State::new(Payload::parse(&raw.to_string()).unwrap())
                .settings
                .view,
            View::Timeline
        );
        for mutation in ["clock", "view", "module", "query", "extra"] {
            let mut value = raw.clone();
            match mutation {
                "clock" => value["streamTimes"] = json!(["00:00:00"]),
                "view" => value["settings"] = json!({"view":"audit","module":"ALL","query":""}),
                "module" => value["settings"] = json!({"view":"events","module":"ROOT","query":""}),
                "query" => {
                    value["settings"] =
                        json!({"view":"events","module":"ALL","query":"x".repeat(8193)})
                }
                _ => value["command"] = json!("audit_snapshot"),
            }
            assert!(Payload::parse(&value.to_string()).is_err());
        }
        let mut state = State::new(payload());
        assert!(!state.set_query("🙂".repeat(4097)));
        assert_eq!(state.settings.query, "");
        let mut value: serde_json::Value = serde_json::from_str(&state.recovery()).unwrap();
        value["extra"] = json!(true);
        assert!(serde_json::from_value::<Settings>(value).is_err());
    }
}
