//! Session controller only. Durable evidence, permissions and writes remain in Tauri.
use crate::{confirmation_model, relations_model, source_form_model};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Payload {
    Configure { desktop_app: bool },
    Success { id: u32, value: Value },
    Failure { id: u32, error: String },
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Action {
    Refresh {},
    SelectSource { index: usize, id: String },
    EditQuote { index: usize, quote: String },
    PreviewSources {},
    ReviewRelation { id: String },
    Confirm { token: String },
    Cancel { token: String },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub record_id: String,
    pub record_version: u64,
    pub record_sha256: String,
    pub quote: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Node {
    evidence_use: String,
    record_version: u64,
    lifecycle: Lifecycle,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Lifecycle {
    record_id: String,
    record_sha256: String,
}
#[derive(Clone, Debug, Deserialize)]
struct Record {
    id: String,
    intention: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Relation {
    id: String,
    withdrawn: bool,
    sources_current: bool,
    evidence: Vec<Reference>,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Reference {
    record_id: String,
}
#[derive(Clone, Debug, Deserialize)]
struct Status {
    revision: u64,
    associations: Vec<Relation>,
}
#[derive(Deserialize)]
struct RefreshResult {
    graph: Graph,
    memory: Memory,
    relations: Status,
}
#[derive(Deserialize)]
struct Graph {
    nodes: Vec<Node>,
}
#[derive(Deserialize)]
struct Memory {
    sessions: Vec<Record>,
}

// A request carries data derived from the loaded session, never arbitrary commands.
#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Request {
    Refresh {
        id: u32,
    },
    Preview {
        id: u32,
        evidence: Vec<Evidence>,
    },
    Create {
        id: u32,
        evidence: Vec<Evidence>,
        expected_revision: u64,
    },
    Change {
        id: u32,
        relation_id: String,
        withdrawn: bool,
        expected_revision: u64,
    },
}
impl Request {
    pub fn id(&self) -> u32 {
        match self {
            Self::Refresh { id }
            | Self::Preview { id, .. }
            | Self::Create { id, .. }
            | Self::Change { id, .. } => *id,
        }
    }
}
#[derive(Clone, Debug)]
enum Operation {
    Refresh {
        message: String,
    },
    Preview {
        evidence: Vec<Evidence>,
        revision: u64,
    },
    Create,
    Change,
}
#[derive(Clone, Debug)]
struct Pending {
    id: u32,
    operation: Operation,
}
#[derive(Clone, Debug)]
struct Review {
    token: String,
    evidence: Vec<Evidence>,
    revision: u64,
}
#[derive(Clone, Debug)]
struct Decision {
    token: String,
    id: String,
    withdrawn: bool,
    revision: u64,
}

#[derive(Clone, Debug)]
pub struct State {
    pub desktop_app: bool,
    pub error: String,
    pub message: String,
    nodes: Vec<Node>,
    records: BTreeMap<String, String>,
    status: Option<Status>,
    selected: [String; 2],
    quotes: [String; 2],
    review: Option<Review>,
    decision: Option<Decision>,
    pending: Option<Pending>,
    configured: bool,
    next_id: u32,
    next_confirmation: u64,
}
impl State {
    pub fn new(desktop_app: bool) -> Self {
        Self {
            desktop_app,
            error: String::new(),
            message: String::new(),
            nodes: vec![],
            records: BTreeMap::new(),
            status: None,
            selected: Default::default(),
            quotes: Default::default(),
            review: None,
            decision: None,
            pending: None,
            configured: false,
            next_id: 0,
            next_confirmation: 0,
        }
    }
    pub fn busy(&self) -> bool {
        self.pending.is_some()
    }
    pub fn summary(&self) -> Option<(usize, u64)> {
        self.status.as_ref().map(|status| {
            (
                status
                    .associations
                    .iter()
                    .filter(|r| !r.withdrawn && r.sources_current)
                    .count(),
                status.revision,
            )
        })
    }
    fn title(&self, id: &str) -> String {
        self.records
            .get(id)
            .map(|entry| {
                entry
                    .chars()
                    .scan(0, |length, ch| {
                        *length += ch.len_utf16();
                        (*length <= 90).then_some(ch)
                    })
                    .collect::<String>()
            })
            .filter(|title| !title.is_empty())
            .unwrap_or_else(|| id.into())
    }
    pub fn form(&self) -> source_form_model::Payload {
        source_form_model::Payload {
            busy: self.busy(),
            selected: self.selected.clone(),
            quotes: self.quotes.clone(),
            sources: self
                .nodes
                .iter()
                .map(|node| {
                    let id = &node.lifecycle.record_id;
                    source_form_model::Source {
                        id: id.clone(),
                        title: self.title(id),
                        entry: if self.selected.contains(id) {
                            self.records.get(id).cloned().unwrap_or_default()
                        } else {
                            String::new()
                        },
                    }
                })
                .collect(),
        }
    }
    pub fn relations(&self) -> relations_model::Payload {
        relations_model::Payload {
            busy: self.busy(),
            relations: self
                .status
                .as_ref()
                .map(|status| {
                    status
                        .associations
                        .iter()
                        .map(|relation| relations_model::Relation {
                            id: relation.id.clone(),
                            withdrawn: relation.withdrawn,
                            sources_current: relation.sources_current,
                            title: relation
                                .evidence
                                .iter()
                                .map(|e| self.title(&e.record_id))
                                .collect::<Vec<_>>()
                                .join(" ↔ "),
                        })
                        .collect()
                })
                .unwrap_or_default(),
        }
    }
    pub fn review(&self) -> Option<confirmation_model::Payload> {
        self.review
            .as_ref()
            .map(|review| confirmation_model::Payload {
                kind: confirmation_model::Kind::Create,
                token: review.token.clone(),
                busy: self.busy(),
                withdrawn: false,
                quotes: review.evidence.iter().map(|e| e.quote.clone()).collect(),
            })
    }
    pub fn decision(&self) -> Option<confirmation_model::Payload> {
        self.decision
            .as_ref()
            .map(|decision| confirmation_model::Payload {
                kind: confirmation_model::Kind::Change,
                token: decision.token.clone(),
                busy: self.busy(),
                withdrawn: decision.withdrawn,
                quotes: vec![],
            })
    }
    fn begin(&mut self, operation: Operation) -> u32 {
        self.next_id = self.next_id.wrapping_add(1).max(1);
        self.pending = Some(Pending {
            id: self.next_id,
            operation,
        });
        self.error.clear();
        self.message.clear();
        self.next_id
    }
    fn refresh(&mut self, message: String) -> Request {
        let id = self.begin(Operation::Refresh { message });
        Request::Refresh { id }
    }
    fn token(&mut self, prefix: &str) -> String {
        self.next_confirmation += 1;
        format!("{prefix}-{}", self.next_confirmation)
    }
    pub fn act(&mut self, action: Action) -> Option<Request> {
        if !self.desktop_app || self.busy() {
            return None;
        }
        match action {
            Action::Refresh {} => Some(self.refresh(String::new())),
            Action::SelectSource { index, id }
                if index < 2 && (id.is_empty() || self.form().source(&id).is_some()) =>
            {
                self.selected[index] = id;
                self.quotes[index].clear();
                self.review = None;
                None
            }
            Action::EditQuote { index, quote }
                if index < 2 && quote.encode_utf16().count() <= 2048 =>
            {
                self.quotes[index] = quote;
                self.review = None;
                None
            }
            Action::PreviewSources {} if self.status.is_some() && self.form().can_preview() => {
                let evidence = self
                    .selected
                    .iter()
                    .enumerate()
                    .map(|(index, id)| {
                        let node = self
                            .nodes
                            .iter()
                            .find(|node| node.lifecycle.record_id == *id)
                            .expect("source checked above");
                        Evidence {
                            record_id: id.clone(),
                            record_version: node.record_version,
                            record_sha256: node.lifecycle.record_sha256.clone(),
                            quote: self.quotes[index].clone(),
                        }
                    })
                    .collect::<Vec<_>>();
                self.review = None;
                let revision = self.status.as_ref()?.revision;
                let id = self.begin(Operation::Preview {
                    evidence: evidence.clone(),
                    revision,
                });
                Some(Request::Preview { id, evidence })
            }
            Action::ReviewRelation { id } if self.relations().can_review(&id) => {
                let relation = self
                    .status
                    .as_ref()?
                    .associations
                    .iter()
                    .find(|r| r.id == id)?
                    .clone();
                let revision = self.status.as_ref()?.revision;
                self.decision = Some(Decision {
                    token: self.token("change"),
                    id,
                    withdrawn: relation.withdrawn,
                    revision,
                });
                None
            }
            Action::Cancel { token }
                if self
                    .decision
                    .as_ref()
                    .is_some_and(|decision| decision.token == token) =>
            {
                self.decision = None;
                None
            }
            Action::Confirm { token } => {
                if let Some(review) = self
                    .review
                    .as_ref()
                    .filter(|review| review.token == token)
                    .cloned()
                {
                    let id = self.begin(Operation::Create);
                    Some(Request::Create {
                        id,
                        evidence: review.evidence,
                        expected_revision: review.revision,
                    })
                } else if let Some(decision) = self
                    .decision
                    .as_ref()
                    .filter(|decision| decision.token == token)
                    .cloned()
                {
                    let id = self.begin(Operation::Change);
                    Some(Request::Change {
                        id,
                        relation_id: decision.id,
                        withdrawn: !decision.withdrawn,
                        expected_revision: decision.revision,
                    })
                } else {
                    None
                }
            }
            _ => None,
        }
    }
    pub fn receive(&mut self, payload: Payload) -> Option<Request> {
        let (id, result) = match payload {
            Payload::Configure { desktop_app } => {
                if self.configured && desktop_app == self.desktop_app {
                    return None;
                }
                self.configured = true;
                self.desktop_app = desktop_app;
                self.pending = None;
                self.review = None;
                self.decision = None;
                if !desktop_app {
                    self.status = None;
                    self.nodes.clear();
                    self.records.clear();
                    self.error.clear();
                    self.message.clear();
                    return None;
                }
                return Some(self.refresh(String::new()));
            }
            Payload::Success { id, value } => (id, Ok(value)),
            Payload::Failure { id, error } => (id, Err(error)),
        };
        if self.pending.as_ref().is_none_or(|pending| pending.id != id) {
            return None;
        }
        let operation = self.pending.take()?.operation;
        let result = result.and_then(|value| self.finish(operation, value));
        match result {
            Ok(request) => request,
            Err(error) => {
                self.error = error;
                self.review = None;
                self.decision = None;
                None
            }
        }
    }
    fn finish(&mut self, operation: Operation, value: Value) -> Result<Option<Request>, String> {
        match operation {
            Operation::Refresh { message } => {
                let mut data: RefreshResult = serde_json::from_value(value)
                    .map_err(|_| "No se pudieron comprobar los datos de relaciones.".to_string())?;
                data.graph
                    .nodes
                    .retain(|node| node.evidence_use == "episodeOnly");
                let mut ids = std::collections::HashSet::new();
                if data.graph.nodes.iter().any(|node| {
                    node.lifecycle.record_id.is_empty()
                        || !ids.insert(&node.lifecycle.record_id)
                        || node.record_version > 9_007_199_254_740_991
                        || node.lifecycle.record_sha256.len() != 64
                        || !node
                            .lifecycle
                            .record_sha256
                            .bytes()
                            .all(|b| b.is_ascii_hexdigit())
                }) || data.relations.revision > 9_007_199_254_740_991
                {
                    return Err("Las fuentes o la revisión de relaciones no son válidas.".into());
                }
                let mut ids = std::collections::HashSet::new();
                if data
                    .memory
                    .sessions
                    .iter()
                    .any(|record| record.id.is_empty() || !ids.insert(&record.id))
                {
                    return Err("Los identificadores de recuerdos no son válidos.".into());
                }
                let mut ids = std::collections::HashSet::new();
                if data
                    .relations
                    .associations
                    .iter()
                    .any(|r| r.id.is_empty() || !ids.insert(&r.id))
                {
                    return Err("Los identificadores de relaciones no son válidos.".into());
                }
                self.nodes = data.graph.nodes;
                self.records = data
                    .memory
                    .sessions
                    .into_iter()
                    .map(|record| (record.id, record.intention))
                    .collect();
                self.status = Some(data.relations);
                self.review = None;
                self.decision = None;
                self.message = message;
                Ok(None)
            }
            Operation::Preview { evidence, revision } => {
                self.review = Some(Review {
                    token: self.token("create"),
                    evidence,
                    revision,
                });
                Ok(None)
            }
            Operation::Create => Ok(Some(
                self.refresh("Relación guardada por tu confirmación.".into()),
            )),
            Operation::Change => Ok(Some(
                self.refresh("Cambio guardado en el historial de relaciones.".into()),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn data() -> Value {
        json!({"graph":{"nodes":[
            {"evidenceUse":"episodeOnly","recordVersion":2,"lifecycle":{"recordId":"a","recordSha256":"a".repeat(64)}},
            {"evidenceUse":"episodeOnly","recordVersion":3,"lifecycle":{"recordId":"b","recordSha256":"b".repeat(64)}},
            {"evidenceUse":"notAnEpisode","recordVersion":1,"lifecycle":{"recordId":"c","recordSha256":"c".repeat(64)}}]},
            "memory":{"sessions":[{"id":"a","intention":"Entrada A"},{"id":"b","intention":"Entrada B"}]},
            "relations":{"revision":7,"associations":[{"id":"active","withdrawn":false,"sourcesCurrent":true,"evidence":[{"recordId":"a"},{"recordId":"b"}]},{"id":"blocked","withdrawn":true,"sourcesCurrent":false,"evidence":[]}]}})
    }
    fn loaded() -> State {
        let mut state = State::new(true);
        let request = state
            .receive(Payload::Configure { desktop_app: true })
            .unwrap();
        assert!(state
            .receive(Payload::Success {
                id: request.id(),
                value: data()
            })
            .is_none());
        state
    }
    fn fill(state: &mut State) {
        for (index, id) in ["a", "b"].iter().enumerate() {
            state.act(Action::SelectSource {
                index,
                id: (*id).into(),
            });
            state.act(Action::EditQuote {
                index,
                quote: format!("Entrada {}", id.to_uppercase()),
            });
        }
    }
    fn reviewed(state: &mut State) -> String {
        fill(state);
        let request = state.act(Action::PreviewSources {}).unwrap();
        state.receive(Payload::Success {
            id: request.id(),
            value: Value::Null,
        });
        state.review().unwrap().token
    }
    #[test]
    fn preview_derives_evidence_and_confirm_requires_fresh_review_once() {
        let mut state = loaded();
        fill(&mut state);
        let request = state.act(Action::PreviewSources {}).unwrap();
        let serialized = serde_json::to_value(&request).unwrap();
        assert_eq!(serialized["evidence"][0]["recordVersion"], 2);
        assert_eq!(serialized["evidence"][1]["recordSha256"], "b".repeat(64));
        assert!(state
            .act(Action::Confirm {
                token: "guessed".into()
            })
            .is_none());
        state.receive(Payload::Success {
            id: request.id(),
            value: Value::Null,
        });
        let token = state.review().unwrap().token;
        assert!(state
            .act(Action::Confirm {
                token: "old".into()
            })
            .is_none());
        let write = state
            .act(Action::Confirm {
                token: token.clone(),
            })
            .unwrap();
        assert!(matches!(
            write,
            Request::Create {
                expected_revision: 7,
                ..
            }
        ));
        assert!(state.act(Action::Confirm { token }).is_none());
        let refresh = state
            .receive(Payload::Success {
                id: write.id(),
                value: Value::Null,
            })
            .unwrap();
        assert!(matches!(refresh, Request::Refresh { .. }));
        assert!(state.busy());
        state.receive(Payload::Success {
            id: refresh.id(),
            value: data(),
        });
        assert!(!state.busy());
        assert!(state.review().is_none());
        assert!(state.message.contains("guardada"));
    }
    #[test]
    fn editing_or_refresh_invalidates_review_and_busy_blocks_mutations() {
        let mut state = loaded();
        let token = reviewed(&mut state);
        state.act(Action::EditQuote {
            index: 0,
            quote: "Entrada".into(),
        });
        assert!(state.act(Action::Confirm { token }).is_none());
        let token = reviewed(&mut state);
        let request = state.act(Action::Refresh {}).unwrap();
        assert!(state
            .act(Action::SelectSource {
                index: 0,
                id: "b".into()
            })
            .is_none());
        assert_eq!(state.form().selected[0], "a");
        assert!(state
            .receive(Payload::Success {
                id: request.id() + 1,
                value: data()
            })
            .is_none());
        assert!(state.busy());
        state.receive(Payload::Success {
            id: request.id(),
            value: data(),
        });
        assert!(state.act(Action::Confirm { token }).is_none());
        state.act(Action::SelectSource {
            index: 0,
            id: "b".into(),
        });
        assert_eq!(state.form().quotes[0], "");
        assert!(!state.form().can_preview());
    }
    #[test]
    fn change_cancel_and_failure_never_replay_a_write() {
        let mut state = loaded();
        state.act(Action::ReviewRelation {
            id: "blocked".into(),
        });
        assert!(state.decision().is_none());
        state.act(Action::ReviewRelation {
            id: "active".into(),
        });
        let token = state.decision().unwrap().token;
        state.act(Action::Cancel {
            token: token.clone(),
        });
        assert!(state.act(Action::Confirm { token }).is_none());
        state.act(Action::ReviewRelation {
            id: "active".into(),
        });
        let token = state.decision().unwrap().token;
        let request = state
            .act(Action::Confirm {
                token: token.clone(),
            })
            .unwrap();
        assert!(matches!(
            request,
            Request::Change {
                withdrawn: true,
                expected_revision: 7,
                ..
            }
        ));
        state.receive(Payload::Failure {
            id: request.id(),
            error: "Actualizá antes de repetir".into(),
        });
        assert!(!state.busy());
        assert!(state.error.contains("Actualizá"));
        assert!(state.act(Action::Confirm { token }).is_none());
        assert!(state
            .receive(Payload::Success {
                id: request.id(),
                value: Value::Null
            })
            .is_none());
    }
    #[test]
    fn source_constraints_and_closed_actions_preserve_the_boundary() {
        let mut state = loaded();
        assert_eq!(state.form().sources.len(), 2);
        assert!(state.form().sources.iter().all(|s| s.entry.is_empty()));
        fill(&mut state);
        assert_eq!(state.form().sources[0].entry, "Entrada A");
        state.act(Action::EditQuote {
            index: 0,
            quote: "😀".repeat(1025),
        });
        assert_eq!(state.form().quotes[0], "Entrada A");
        state.act(Action::SelectSource {
            index: 5,
            id: "b".into(),
        });
        state.act(Action::SelectSource {
            index: 0,
            id: "c".into(),
        });
        assert_eq!(state.form().selected[0], "a");
        assert!(serde_json::from_value::<Action>(
            json!({"type":"confirm","token":"x","confirmed":true})
        )
        .is_err());
        assert!(serde_json::from_value::<Action>(
            json!({"type":"previewSources","expectedRevision":8})
        )
        .is_err());
    }
    #[test]
    fn desktop_switch_and_bad_refresh_discard_pending_decisions() {
        let mut state = loaded();
        reviewed(&mut state);
        let request = state.act(Action::Refresh {}).unwrap();
        state.receive(Payload::Success {
            id: request.id(),
            value: json!({"memory":null}),
        });
        assert!(!state.error.is_empty());
        assert!(state.review().is_none());
        assert!(!state.busy());
        let request = state.act(Action::Refresh {}).unwrap();
        state.receive(Payload::Configure { desktop_app: false });
        state.receive(Payload::Success {
            id: request.id(),
            value: data(),
        });
        assert!(state.summary().is_none());
        assert!(!state.busy());
        assert!(state.form().sources.is_empty());
        assert!(state.act(Action::Refresh {}).is_none());
    }
}
