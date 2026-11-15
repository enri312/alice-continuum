use crate::{
    associations_model,
    core_activity_model::Snapshot,
    flow_model,
    model::{Activity, ActivityStatus},
};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Base {
    pub nodes: Vec<flow_model::Node>,
    pub persistent_memory_count: u64,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Payload {
    Configure {
        desktop_app: bool,
        base: Base,
        selected_id: String,
    },
    ActivitySuccess {
        id: u32,
        value: serde_json::Value,
    },
    ActivityFailure {
        id: u32,
    },
    Associations {
        response: associations_model::Payload,
    },
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        if let Self::Configure { base, .. } = &value {
            if base.persistent_memory_count > 9_007_199_254_740_991 {
                return Err("Conteo de memoria inválido".into());
            }
            let mut view = State::new(base.clone(), false, String::new()).view();
            view.nodes = base.nodes.clone();
            view.validate()?;
        }
        Ok(value)
    }
}
pub struct State {
    base: Base,
    pub desktop_app: bool,
    selected_id: String,
    configured: bool,
    snapshot: Option<Snapshot>,
    status: ActivityStatus,
    next_id: u32,
    pending: Option<u32>,
}
impl State {
    pub fn new(base: Base, desktop_app: bool, selected_id: String) -> Self {
        Self {
            base,
            desktop_app,
            selected_id,
            configured: false,
            snapshot: None,
            status: if desktop_app {
                ActivityStatus::Loading
            } else {
                ActivityStatus::Unavailable
            },
            next_id: 0,
            pending: None,
        }
    }
    pub fn configure(&mut self, base: Base, desktop_app: bool, selected_id: String) -> Option<u32> {
        self.base = base;
        if !self.configured {
            self.selected_id = selected_id;
        }
        if !self
            .base
            .nodes
            .iter()
            .any(|node| node.id == self.selected_id)
        {
            self.selected_id = self.base.nodes[0].id.clone();
        }
        if self.configured && self.desktop_app == desktop_app {
            return None;
        }
        self.configured = true;
        self.desktop_app = desktop_app;
        self.snapshot = None;
        self.pending = None;
        self.status = if desktop_app {
            ActivityStatus::Loading
        } else {
            ActivityStatus::Unavailable
        };
        self.begin_read()
    }
    pub fn begin_read(&mut self) -> Option<u32> {
        if !self.can_read() {
            return None;
        }
        self.next_id = self.next_id.wrapping_add(1).max(1);
        self.pending = Some(self.next_id);
        Some(self.next_id)
    }
    pub fn can_read(&self) -> bool {
        self.configured && self.desktop_app && self.pending.is_none()
    }
    pub fn complete(&mut self, id: u32, value: Option<serde_json::Value>) {
        if self.pending != Some(id) {
            return;
        }
        self.pending = None;
        self.snapshot = value.and_then(|value| Snapshot::parse(value).ok());
        self.status = if self.snapshot.is_some() {
            ActivityStatus::Ready
        } else {
            ActivityStatus::Unavailable
        };
    }
    pub fn select(&mut self, id: &str) -> bool {
        if !self.base.nodes.iter().any(|node| node.id == id) {
            return false;
        }
        self.selected_id = id.into();
        true
    }
    pub fn view(&self) -> flow_model::Payload {
        let activity = self
            .snapshot
            .as_ref()
            .map(Snapshot::activity)
            .unwrap_or_else(|| Activity {
                status: self.status.clone(),
                signal_present: false,
                audit_healthy: None,
                window_event_count: 0,
                window_ms: 0,
                overall_signal: 0.0,
                method: None,
            });
        let nodes = self.base.nodes.iter().map(|node| {
            let mut node = node.clone(); node.activation = 0.0;
            if let Some(evidence) = self.snapshot.as_ref().and_then(|s| s.region_for_node(&node.id)) {
                node.activation = evidence.signal;
                node.value = if evidence.event_count > 0 { format!("{} eventos R3", evidence.event_count) } else { "sin señal reciente".into() };
                node.detail = if evidence.event_count > 0 { format!("{}: {} eventos técnicos dentro de la ventana. Intensidad heurística {:.3}.", evidence.label, evidence.event_count, evidence.signal) }
                    else { format!("{}: no hay eventos R3 dentro de la ventana temporal.", evidence.label) };
            }
            node
        }).collect();
        flow_model::Payload {
            nodes,
            selected_id: self.selected_id.clone(),
            has_activity: self.base.persistent_memory_count > 0 || activity.signal_present,
            links: self
                .snapshot
                .as_ref()
                .map(|s| {
                    s.links
                        .iter()
                        .map(|link| flow_model::Link {
                            id: link.id.clone(),
                            signal: link.signal,
                        })
                        .collect()
                })
                .unwrap_or_default(),
            activity,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core_activity_model::tests::{active, idle};
    fn base() -> Base {
        Base {
            persistent_memory_count: 1,
            nodes: ["flow-input", "flow-social", "flow-body"]
                .iter()
                .map(|id| flow_model::Node {
                    id: (*id).into(),
                    label: (*id).into(),
                    value: "base".into(),
                    detail: "original".into(),
                    group: "input".into(),
                    activation: 0.8,
                    availability: "planned".into(),
                    x: 10.0,
                    y: 50.0,
                })
                .collect(),
        }
    }
    #[test]
    fn one_read_at_a_time_and_bad_or_late_results_never_fabricate_activity() {
        let mut state = State::new(base(), true, "flow-input".into());
        assert!(state.begin_read().is_none());
        let id = state.configure(base(), true, "flow-input".into()).unwrap();
        assert!(state.begin_read().is_none());
        state.complete(id + 1, Some(active()));
        assert_eq!(state.view().activity.view_state(), "loading");
        state.complete(id, Some(active()));
        assert_eq!(state.view().nodes[0].activation, 0.3);
        assert_eq!(state.view().nodes[1].activation, 0.0);
        assert_eq!(state.view().nodes[2].activation, 0.3);
        assert_eq!(state.view().nodes[0].value, "1 eventos R3");
        assert_eq!(state.view().nodes[1].detail, "original");
        let next = state.begin_read().unwrap();
        state.complete(next, Some(serde_json::json!({"overallSignal":0.9})));
        assert_eq!(state.view().activity.view_state(), "unavailable");
        assert!(state.view().links.is_empty());
        assert!(state.view().nodes.iter().all(|node| node.activation == 0.0));
        state.complete(id, Some(active()));
        assert_eq!(state.view().activity.view_state(), "unavailable");
    }
    #[test]
    fn updates_base_without_new_poller_and_preserves_selection_and_idle_structure() {
        let mut state = State::new(base(), true, "flow-input".into());
        let id = state.configure(base(), true, "flow-input".into()).unwrap();
        state.complete(id, Some(idle()));
        assert_eq!(state.view().activity.view_state(), "idle");
        assert!(state.view().has_activity);
        assert!(state.select("flow-body"));
        assert!(!state.select("missing"));
        let mut updated = base();
        updated.persistent_memory_count = 0;
        assert!(state
            .configure(updated, true, "flow-input".into())
            .is_none());
        assert_eq!(state.view().selected_id, "flow-body");
        assert!(!state.view().has_activity);
        let pending = state.begin_read().unwrap();
        state.configure(base(), false, String::new());
        state.complete(pending, Some(active()));
        assert_eq!(state.view().activity.view_state(), "unavailable");
        assert!(state.begin_read().is_none());
    }
}
