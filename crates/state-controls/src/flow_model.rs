use crate::model::Activity;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Node {
    pub id: String,
    pub label: String,
    pub value: String,
    pub detail: String,
    pub group: String,
    pub activation: f64,
    pub availability: String,
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Link {
    pub id: String,
    pub signal: f64,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub nodes: Vec<Node>,
    pub links: Vec<Link>,
    pub selected_id: String,
    pub has_activity: bool,
    pub activity: Activity,
}
pub const CONNECTIONS: [(&str, &str, Option<&str>); 13] = [
    (
        "flow-inhibition",
        "flow-input",
        Some("permission-perception"),
    ),
    ("flow-input", "flow-workspace", Some("perception-workspace")),
    ("flow-memory", "flow-workspace", Some("memory-workspace")),
    (
        "flow-language",
        "flow-workspace",
        Some("language-workspace"),
    ),
    ("flow-workspace", "flow-response", Some("workspace-output")),
    ("flow-language", "flow-social", None),
    ("flow-memory", "flow-social", None),
    ("flow-social", "flow-self", None),
    ("flow-social", "flow-affect", None),
    ("flow-self", "flow-workspace", None),
    ("flow-affect", "flow-workspace", None),
    ("flow-workspace", "flow-face", None),
    ("flow-workspace", "flow-body", None),
];
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        let mut ids = std::collections::HashSet::new();
        if value.nodes.is_empty() || value.nodes.len() > 64 || value.links.len() > 64 {
            return Err("Grafo inválido".into());
        }
        if !value.activity.overall_signal.is_finite()
            || !(0.0..=1.0).contains(&value.activity.overall_signal)
        {
            return Err("Señal R3 inválida".into());
        }
        for node in &value.nodes {
            if node.id.is_empty()
                || !ids.insert(&node.id)
                || !matches!(node.group.as_str(), "input" | "memory" | "output")
                || !matches!(node.availability.as_str(), "ready" | "planned")
                || !node.activation.is_finite()
                || !(0.0..=1.0).contains(&node.activation)
                || !node.x.is_finite()
                || !node.y.is_finite()
                || !(0.0..=100.0).contains(&node.x)
                || !(0.0..=100.0).contains(&node.y)
            {
                return Err("Nodo inválido".into());
            }
        }
        let mut links = std::collections::HashSet::new();
        if value.links.iter().any(|link| {
            !links.insert(&link.id)
                || !link.signal.is_finite()
                || !(0.0..=1.0).contains(&link.signal)
        }) {
            return Err("Enlace inválido".into());
        }
        Ok(value)
    }
    pub fn selected(&self, id: &str) -> &Node {
        self.nodes
            .iter()
            .find(|node| node.id == id)
            .unwrap_or(&self.nodes[0])
    }
    pub fn signal(&self, evidence: Option<&str>) -> f64 {
        evidence
            .and_then(|id| self.links.iter().find(|link| link.id == id))
            .map_or(0.0, |link| link.signal)
    }
}
pub fn curve(from: &Node, to: &Node) -> String {
    let (x1, y1, x2, y2) = (from.x * 10.0, from.y * 4.3, to.x * 10.0, to.y * 4.3);
    let middle = (x1 + x2) / 2.0;
    format!("M {x1} {y1} C {middle} {y1}, {middle} {y2}, {x2} {y2}")
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> serde_json::Value {
        serde_json::json!({"nodes":[{"id":"flow-input","label":"Entrada","value":"0","detail":"Sin señal","group":"input","activation":0.0,"availability":"ready","x":10.0,"y":50.0}],"links":[{"id":"permission-perception","signal":0.7}],"selectedId":"flow-input","hasActivity":false,"activity":{"status":"unavailable","signalPresent":false,"auditHealthy":null,"windowEventCount":0,"windowMs":0,"overallSignal":0.0,"method":null}})
    }
    #[test]
    fn selection_and_evidence_never_invent_signals() {
        let payload = Payload::parse(&fixture().to_string()).unwrap();
        assert_eq!(payload.selected("removed-node").id, "flow-input");
        assert_eq!(payload.signal(None), 0.0);
        assert_eq!(payload.signal(Some("missing")), 0.0);
        assert_eq!(payload.signal(Some("permission-perception")), 0.7);
        assert_eq!(
            curve(&payload.nodes[0], &payload.nodes[0]),
            "M 100 215 C 100 215, 100 215, 100 215"
        );
    }
    #[test]
    fn rejects_empty_duplicates_invalid_geometry_and_signal() {
        let mut value = fixture();
        value["nodes"] = serde_json::json!([]);
        assert!(Payload::parse(&value.to_string()).is_err());
        let mut value = fixture();
        value["nodes"][0]["x"] = serde_json::json!(101);
        assert!(Payload::parse(&value.to_string()).is_err());
        let mut value = fixture();
        value["links"][0]["signal"] = serde_json::json!(-1);
        assert!(Payload::parse(&value.to_string()).is_err());
        let mut value = fixture();
        let duplicate = value["nodes"][0].clone();
        value["nodes"].as_array_mut().unwrap().push(duplicate);
        assert!(Payload::parse(&value.to_string()).is_err());
    }
}
