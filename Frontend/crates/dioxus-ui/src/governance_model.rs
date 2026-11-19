use serde::Deserialize;

pub type Metric = (String, String, String);
pub type Field = (String, String);

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum View {
    Registry,
    Procedures,
    Skills,
}

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Payload {
    Configure { view: View, desktop: bool },
    Registry(Registry),
    Permissions(Permissions),
    Procedures(Procedures),
    Skills(Skills),
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub groups: Vec<Group>,
    pub registry_icon: String,
    pub permissions_icon: String,
    pub source: String,
    pub error: String,
    pub loading: bool,
    pub metrics: Vec<Metric>,
}

#[derive(Clone, Deserialize)]
pub struct Group {
    pub id: String,
    pub label: String,
    pub capabilities: Vec<Capability>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capability {
    pub id: String,
    pub label: String,
    pub description: String,
    pub state: String,
    pub state_label: String,
    pub glyph: String,
    pub maturity: String,
    pub fields: Vec<Field>,
    pub health: String,
    pub permission: String,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub policy: Vec<Field>,
    pub requests: Vec<Request>,
    pub grants: Vec<Grant>,
    pub pending: Option<Pending>,
    pub status: String,
    pub detail: String,
    pub busy: String,
    pub commands: bool,
    pub execution: bool,
    pub has_snapshot: bool,
    pub failed: bool,
}

#[derive(Clone, Deserialize)]
pub struct Request {
    pub id: String,
    pub capability: String,
    pub detail: String,
    pub label: String,
    pub review: bool,
}

#[derive(Clone, Deserialize)]
pub struct Grant {
    pub id: String,
    pub capability: String,
    pub detail: String,
    pub label: String,
    pub revoke: bool,
    pub execute: String,
}

#[derive(Clone, Deserialize)]
pub struct Pending {
    pub id: String,
    pub summary: String,
    pub warnings: Vec<String>,
    pub digest: String,
    pub fields: Vec<Field>,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Procedures {
    pub busy: String,
    pub error: String,
    pub notice: String,
    pub metrics: Vec<Metric>,
    pub patterns: Vec<Entry>,
    pub decisions: Vec<Decision>,
    pub pattern: Option<Pattern>,
    pub conversion: Option<Conversion>,
    pub conversion_count: usize,
    pub footer: String,
}

#[derive(Clone, Deserialize)]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub selected: bool,
}

#[derive(Clone, Deserialize)]
pub struct Decision {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub sha: String,
    pub state: String,
    pub status: String,
    pub convertible: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pattern {
    pub id: String,
    pub detail: String,
    pub steps: Vec<Metric>,
    pub evidence: Vec<Metric>,
    pub event_count: usize,
    pub variations: Vec<Metric>,
    pub window: String,
    pub action: String,
    pub title: String,
    pub purpose: String,
    pub skill: String,
    pub reason: String,
    pub confirmed: bool,
    pub can_submit: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversion {
    pub id: String,
    pub detail: String,
    pub fingerprint: String,
    pub sha: String,
    pub title: String,
    pub description: String,
    pub purpose: String,
    pub skill: String,
    pub reason: String,
    pub confirmed: bool,
    pub can_submit: bool,
}

#[derive(Clone, Default, Deserialize)]
pub struct Skills {
    pub busy: String,
    pub error: String,
    pub notice: String,
    pub ready: bool,
    pub metrics: Vec<Metric>,
    pub drafts: Vec<Entry>,
    pub lifecycle: Vec<Entry>,
    pub manifest: Option<Manifest>,
    pub simulation: Option<Simulation>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub id: String,
    pub status: String,
    pub risk: String,
    pub title: String,
    pub description: String,
    pub purpose: String,
    pub editable: bool,
    pub capability: String,
    pub operations: String,
    pub output: String,
    pub saved: bool,
    pub dirty: bool,
    pub sha: String,
    pub confirmed: bool,
    pub reason: String,
    pub can_confirm: bool,
    pub actions: Vec<Transition>,
}

#[derive(Clone, Deserialize)]
pub struct Transition {
    pub action: String,
    pub label: String,
    pub tone: String,
    pub detail: String,
}

#[derive(Clone, Deserialize)]
pub struct Simulation {
    pub steps: Vec<SimulationStep>,
    pub blocks: Vec<Field>,
    pub metrics: Vec<Field>,
}

#[derive(Clone, Deserialize)]
pub struct SimulationStep {
    pub position: String,
    pub title: String,
    pub detail: String,
    pub readiness: String,
}
