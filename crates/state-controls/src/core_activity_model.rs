//! Closed R3 read contract, matching core/cognitive/core-activity.ts.
use crate::model::{Activity, ActivityStatus};
use serde::{Deserialize, Deserializer};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
const REGIONS: [&str; 7] = [
    "perception",
    "permission",
    "memory",
    "language",
    "workspace",
    "output",
    "motor",
];
const LINKS: [(&str, &str, &str); 5] = [
    ("permission-perception", "permission", "perception"),
    ("perception-workspace", "perception", "workspace"),
    ("memory-workspace", "memory", "workspace"),
    ("language-workspace", "language", "workspace"),
    ("workspace-output", "workspace", "output"),
];
fn nullable<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<u64>, D::Error> {
    Option::<u64>::deserialize(deserializer)
}
fn timestamp(value: Option<u64>) -> bool {
    value.is_none_or(|value| value > 0 && value <= MAX_SAFE_INTEGER)
}
fn signal(value: f64) -> bool {
    value.is_finite() && (0.0..=1.0).contains(&value)
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Region {
    pub id: String,
    pub label: String,
    pub event_count: u64,
    pub signal: f64,
    #[serde(deserialize_with = "nullable")]
    pub last_event_at_ms: Option<u64>,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Link {
    pub id: String,
    pub from: String,
    pub to: String,
    pub evidence_count: u64,
    pub signal: f64,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    schema_version: u32,
    generated_at_ms: u64,
    method: String,
    heuristic: bool,
    pub window_ms: u64,
    pub audit_healthy: bool,
    visible_event_count: u64,
    pub window_event_count: u64,
    #[serde(deserialize_with = "nullable")]
    latest_event_at_ms: Option<u64>,
    pub overall_signal: f64,
    pub regions: Vec<Region>,
    pub links: Vec<Link>,
}
impl Snapshot {
    pub fn parse(value: serde_json::Value) -> Result<Self, String> {
        let value: Self = serde_json::from_value(value)
            .map_err(|_| "Snapshot de actividad R3 inválido".to_string())?;
        if value.schema_version != 2
            || value.generated_at_ms == 0
            || value.generated_at_ms > MAX_SAFE_INTEGER
            || value.method != "r3-recency-motor-v2"
            || !value.heuristic
            || value.window_ms == 0
            || value.window_ms > MAX_SAFE_INTEGER
            || value.visible_event_count > MAX_SAFE_INTEGER
            || value.window_event_count > value.visible_event_count
            || !timestamp(value.latest_event_at_ms)
            || !signal(value.overall_signal)
            || value.regions.len() != REGIONS.len()
            || value.links.len() != LINKS.len()
        {
            return Err("Snapshot de actividad R3 inválido".into());
        }
        let mut ids = std::collections::HashSet::new();
        for region in &value.regions {
            if !REGIONS.contains(&region.id.as_str())
                || !ids.insert(&region.id)
                || !crate::source_form_model::nonempty_quote(&region.label)
                || region.label.encode_utf16().count() > 80
                || region.event_count > MAX_SAFE_INTEGER
                || !signal(region.signal)
                || !timestamp(region.last_event_at_ms)
                || (region.event_count == 0) != (region.signal == 0.0)
                || (region.event_count == 0) != region.last_event_at_ms.is_none()
            {
                return Err("Región de actividad R3 inválida".into());
            }
        }
        let mut ids = std::collections::HashSet::new();
        for link in &value.links {
            if !LINKS
                .iter()
                .any(|(id, from, to)| link.id == *id && link.from == *from && link.to == *to)
                || !ids.insert(&link.id)
                || link.evidence_count > MAX_SAFE_INTEGER
                || !signal(link.signal)
                || (link.evidence_count == 0) != (link.signal == 0.0)
            {
                return Err("Enlace de actividad R3 inválido".into());
            }
        }
        if (value.window_event_count == 0 && value.overall_signal != 0.0)
            || (value.overall_signal == 0.0) != value.latest_event_at_ms.is_none()
            || (value.overall_signal == 0.0
                && (value.regions.iter().any(|r| r.event_count > 0)
                    || value.links.iter().any(|l| l.evidence_count > 0)))
        {
            return Err("Cobertura de actividad R3 incoherente".into());
        }
        Ok(value)
    }
    pub fn activity(&self) -> Activity {
        Activity {
            status: ActivityStatus::Ready,
            signal_present: self.overall_signal > 0.0 && self.latest_event_at_ms.is_some(),
            audit_healthy: Some(self.audit_healthy),
            window_event_count: self.window_event_count,
            window_ms: self.window_ms,
            overall_signal: self.overall_signal,
            method: Some(self.method.clone()),
        }
    }
    pub fn region_for_node(&self, id: &str) -> Option<&Region> {
        let region = match id {
            "flow-input" => "perception",
            "flow-language" => "language",
            "flow-memory" => "memory",
            "flow-inhibition" => "permission",
            "flow-workspace" => "workspace",
            "flow-response" => "output",
            "flow-body" => "motor",
            _ => return None,
        };
        self.regions.iter().find(|r| r.id == region)
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::{json, Value};
    pub fn idle() -> Value {
        json!({"schemaVersion":2,"generatedAtMs":1000,"method":"r3-recency-motor-v2","heuristic":true,"windowMs":300000,
            "auditHealthy":true,"visibleEventCount":1,"windowEventCount":1,"latestEventAtMs":null,"overallSignal":0,
            "regions":REGIONS.iter().map(|id| json!({"id":id,"label":id,"eventCount":0,"signal":0,"lastEventAtMs":null})).collect::<Vec<_>>(),
            "links":LINKS.iter().map(|(id,from,to)| json!({"id":id,"from":from,"to":to,"evidenceCount":0,"signal":0})).collect::<Vec<_>>()})
    }
    pub fn active() -> Value {
        let mut value = idle();
        value["overallSignal"] = json!(0.3);
        value["latestEventAtMs"] = json!(1000);
        for index in [0, 1, 4, 6] {
            value["regions"][index]["eventCount"] = json!(1);
            value["regions"][index]["signal"] = json!(0.3);
            value["regions"][index]["lastEventAtMs"] = json!(1000);
        }
        value["links"][0]["evidenceCount"] = json!(1);
        value["links"][0]["signal"] = json!(0.3);
        value
    }
    #[test]
    fn preserves_procedure_only_idle_and_manual_motor_evidence() {
        let procedure = Snapshot::parse(idle()).unwrap();
        assert_eq!(procedure.activity().view_state(), "idle");
        let active = Snapshot::parse(active()).unwrap();
        assert_eq!(active.activity().view_state(), "ready");
        assert_eq!(active.region_for_node("flow-body").unwrap().signal, 0.3);
        assert!(active.region_for_node("flow-face").is_none());
    }
    #[test]
    fn rejects_unknown_fields_missing_nullable_fields_duplicates_and_wrong_topology() {
        let mut invalid = idle();
        invalid["private"] = json!("not accepted");
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = idle();
        invalid.as_object_mut().unwrap().remove("latestEventAtMs");
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = idle();
        invalid["regions"][0]
            .as_object_mut()
            .unwrap()
            .remove("lastEventAtMs");
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = idle();
        invalid["regions"][0] = invalid["regions"][1].clone();
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = idle();
        invalid["links"][0]["to"] = json!("memory");
        assert!(Snapshot::parse(invalid).is_err());
    }
    #[test]
    fn rejects_invalid_numbers_and_incoherent_evidence() {
        for (key, number) in [
            ("generatedAtMs", 0),
            ("windowMs", 0),
            ("windowEventCount", 2),
            ("visibleEventCount", MAX_SAFE_INTEGER + 1),
        ] {
            let mut invalid = idle();
            invalid[key] = json!(number);
            assert!(Snapshot::parse(invalid).is_err());
        }
        let mut invalid = active();
        invalid["overallSignal"] = json!(1.1);
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = active();
        invalid["overallSignal"] = json!(0);
        invalid["latestEventAtMs"] = Value::Null;
        assert!(Snapshot::parse(invalid).is_err());
        let mut invalid = idle();
        invalid["regions"][0]["signal"] = json!(0.5);
        assert!(Snapshot::parse(invalid).is_err());
    }
}
