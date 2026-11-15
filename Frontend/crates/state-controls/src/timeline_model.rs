//! Temporary cognitive timeline. Selection and geometry have no native side effects.
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum Module {
    System,
    Perception,
    Memory,
    Workspace,
    Output,
    Security,
}
impl Module {
    pub fn label(self) -> &'static str {
        match self {
            Self::System => "SYSTEM",
            Self::Perception => "PERCEPTION",
            Self::Memory => "MEMORY",
            Self::Workspace => "WORKSPACE",
            Self::Output => "OUTPUT",
            Self::Security => "SECURITY",
        }
    }
    pub fn class(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Perception => "perception",
            Self::Memory => "memory",
            Self::Workspace => "workspace",
            Self::Output => "output",
            Self::Security => "security",
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Level {
    Info,
    Trace,
    Warn,
}
impl Level {
    pub fn label(self) -> &'static str {
        match self {
            Self::Info => "INFO",
            Self::Trace => "TRACE",
            Self::Warn => "WARN",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Event {
    pub id: String,
    pub sequence: u64,
    pub timestamp_ms: i64,
    pub time_label: String,
    pub module: Module,
    pub level: Level,
    pub node: String,
    pub payload: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub events: Vec<Event>,
    pub selected_id: String,
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self =
            serde_json::from_str(raw).map_err(|_| "Eventos temporales inválidos".to_string())?;
        let mut ids = HashSet::new();
        if value.events.len() > 200
            || value.events.iter().any(|event| {
                event.id.trim().is_empty()
                    || event.id.encode_utf16().count() > 128
                    || !ids.insert(&event.id)
                    || event.sequence > 9_007_199_254_740_991
                    || event.timestamp_ms.unsigned_abs() > 8_640_000_000_000_000
                    || event.time_label.trim().is_empty()
                    || event.time_label.encode_utf16().count() > 64
            })
        {
            return Err("Eventos temporales fuera del contrato".into());
        }
        Ok(value)
    }
}
pub struct State {
    events: Vec<Event>,
    selected_id: String,
}
impl State {
    pub fn new(payload: Payload) -> Self {
        Self {
            events: payload.events,
            selected_id: payload.selected_id,
        }
    }
    pub fn update(&mut self, payload: Payload) {
        self.events = payload.events;
    }
    pub fn visible(&self) -> &[Event] {
        &self.events[self.events.len().saturating_sub(24)..]
    }
    pub fn total(&self) -> usize {
        self.events.len()
    }
    pub fn selected(&self) -> Option<&Event> {
        self.visible()
            .iter()
            .find(|event| event.id == self.selected_id)
            .or_else(|| self.visible().last())
    }
    pub fn select(&mut self, id: &str) -> bool {
        if !self.visible().iter().any(|event| event.id == id) {
            return false;
        }
        self.selected_id = id.into();
        true
    }
    pub fn span(&self) -> u64 {
        self.visible()
            .first()
            .zip(self.visible().last())
            .map_or(0, |(first, last)| {
                (last.timestamp_ms - first.timestamp_ms).max(0) as u64
            })
    }
    pub fn position(&self, event: &Event) -> f64 {
        if self.visible().len() == 1 {
            return 50.0;
        }
        let first = self.visible().first().map_or(0, |event| event.timestamp_ms);
        4.0 + (event.timestamp_ms - first) as f64 / self.span().max(1) as f64 * 92.0
    }
    pub fn modules(&self) -> usize {
        self.visible()
            .iter()
            .map(|event| event.module)
            .collect::<HashSet<_>>()
            .len()
    }
}
pub fn elapsed_label(ms: u64) -> String {
    if ms < 1_000 {
        format!("{ms} ms")
    } else if ms < 60_000 {
        format!("{} s", decimal_one(ms as f64 / 1_000.0))
    } else {
        format!("{} min", decimal_one(ms as f64 / 60_000.0))
    }
}
fn decimal_one(value: f64) -> String {
    // Positive Number.toFixed(1) rounds ties upward. Use its exact binary value
    // rather than Rust's ties-to-even formatter or a second floating-point rounding.
    // Elapsed seconds/minutes here are >= 1 and <= u64::MAX / 60_000.
    let bits = value.to_bits();
    let shift = 1075 - ((bits >> 52) & 0x7ff);
    let significand = (bits & ((1_u64 << 52) - 1)) | (1_u64 << 52);
    let tenths = (significand * 10 + (1_u64 << (shift - 1))) >> shift;
    format!("{}.{:01}", tenths / 10, tenths % 10)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn row(index: u64) -> serde_json::Value {
        json!({"id":format!("event-{index}"),"sequence":index,"timestampMs":index*250,"timeLabel":"10:00:00","module":if index%2==0 {"SYSTEM"} else {"MEMORY"},"level":"INFO","node":"NODE","payload":"<b>literal</b>"})
    }
    fn payload(count: u64) -> Payload {
        Payload::parse(
            &json!({"events":(0..count).map(row).collect::<Vec<_>>(),"selectedId":""}).to_string(),
        )
        .unwrap()
    }
    #[test]
    fn bounds_the_visible_window_without_discarding_source_counts_or_payloads() {
        let state = State::new(payload(30));
        assert_eq!(state.total(), 30);
        assert_eq!(state.visible().len(), 24);
        assert_eq!(state.visible()[0].id, "event-6");
        assert_eq!(state.modules(), 2);
        assert_eq!(state.span(), 5750);
        assert_eq!(state.position(&state.visible()[0]), 4.0);
        assert_eq!(state.position(state.visible().last().unwrap()), 96.0);
        assert_eq!(state.selected().unwrap().id, "event-29");
        assert_eq!(state.selected().unwrap().payload, "<b>literal</b>");
    }
    #[test]
    fn keeps_selection_through_updates_and_falls_back_after_eviction_or_clear() {
        let mut state = State::new(payload(25));
        assert!(!state.select("event-0"));
        assert!(state.select("event-4"));
        state.update(payload(26));
        assert_eq!(state.selected().unwrap().id, "event-4");
        state.update(payload(30));
        assert_eq!(state.selected().unwrap().id, "event-29");
        state.update(payload(0));
        assert!(state.selected().is_none());
        assert_eq!(state.modules(), 0);
    }
    #[test]
    fn rejects_ambiguous_events_invalid_dates_and_uncontracted_fields() {
        let valid = json!({"events":[row(1)],"selectedId":"event-1"});
        for mutation in ["duplicate", "sequence", "date", "module", "extra"] {
            let mut value = valid.clone();
            match mutation {
                "duplicate" => value["events"].as_array_mut().unwrap().push(row(1)),
                "sequence" => value["events"][0]["sequence"] = json!(9_007_199_254_740_992_u64),
                "date" => value["events"][0]["timestampMs"] = json!(null),
                "module" => value["events"][0]["module"] = json!("UNKNOWN"),
                _ => value["command"] = json!("not allowed"),
            }
            assert!(Payload::parse(&value.to_string()).is_err());
        }
        assert!(Payload::parse(
            &json!({"events":(0..201).map(row).collect::<Vec<_>>(),"selectedId":""}).to_string()
        )
        .is_err());
    }
    #[test]
    fn preserves_empty_single_event_equal_clock_and_elapsed_thresholds() {
        let empty = State::new(payload(0));
        assert_eq!(empty.span(), 0);
        assert!(empty.visible().is_empty());
        let single = State::new(payload(1));
        assert_eq!(single.position(&single.visible()[0]), 50.0);
        let mut equal = payload(2);
        equal.events[1].timestamp_ms = 0;
        let equal = State::new(equal);
        assert_eq!(equal.span(), 0);
        assert_eq!(equal.position(&equal.visible()[1]), 4.0);
        assert_eq!(elapsed_label(999), "999 ms");
        assert_eq!(elapsed_label(1000), "1.0 s");
        assert_eq!(elapsed_label(60000), "1.0 min");
        assert_eq!(elapsed_label(1250), "1.3 s");
        assert_eq!(elapsed_label(1150), "1.1 s");
        assert_eq!(elapsed_label(75000), "1.3 min");
    }
}
