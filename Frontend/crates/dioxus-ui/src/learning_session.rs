use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum Status {
    #[default]
    Loading,
    Ready,
    Error,
}

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum Phase {
    #[default]
    Idle,
    Evaluating,
    Error,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum SourceId {
    Study,
    Automatic,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Source {
    snapshot: Option<Value>,
    status: Status,
    updated_at: Option<u64>,
    error: Option<String>,
    event_error: String,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LearningSession {
    study: Source,
    automatic: Source,
    automatic_phase: Phase,
    automatic_process_error: String,
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum Action {
    Initialize {
        session: LearningSession,
    },
    Received {
        source: SourceId,
        snapshot: Value,
        updated_at: u64,
    },
    ReadFailed {
        source: SourceId,
        error: String,
    },
    ListenerFailed {
        source: SourceId,
        error: String,
    },
    AutomaticSignal {
        phase: Option<Phase>,
        error: String,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceProjection<'a> {
    // Omitted fields retain their previous projection in the WebView adapter.
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshot: Option<&'a Value>,
    status: Status,
    updated_at: Option<u64>,
    error: Option<&'a str>,
    event_error: &'a str,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Projection<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    study: Option<SourceProjection<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    approved_study_indices: Option<Vec<usize>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic: Option<SourceProjection<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic_phase: Option<Phase>,
    #[serde(skip_serializing_if = "Option::is_none")]
    automatic_process_error: Option<&'a str>,
}

impl Source {
    fn project(&self, include_snapshot: bool) -> SourceProjection<'_> {
        SourceProjection {
            snapshot: if include_snapshot {
                self.snapshot.as_ref()
            } else {
                None
            },
            status: self.status,
            updated_at: self.updated_at,
            error: self.error.as_deref(),
            event_error: &self.event_error,
        }
    }
}

impl LearningSession {
    fn approved_study_indices(&self) -> Vec<usize> {
        let records = self
            .study
            .snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.get("records"))
            .and_then(Value::as_array);
        records
            .into_iter()
            .flatten()
            .enumerate()
            .filter_map(|(index, record)| {
                let active = record.get("active")?.as_bool()?;
                let last_passed = record.get("lastPassed")?.as_bool()?;
                let passes = record.get("passes")?.as_u64()?;
                (active && last_passed && passes > 0).then_some(index)
            })
            .collect()
    }

    fn source(&mut self, id: &SourceId) -> &mut Source {
        match id {
            SourceId::Study => &mut self.study,
            SourceId::Automatic => &mut self.automatic,
        }
    }

    fn project_source(&self, id: SourceId, include_snapshot: bool) -> Projection<'_> {
        match id {
            SourceId::Study => Projection {
                study: Some(self.study.project(include_snapshot)),
                approved_study_indices: include_snapshot.then(|| self.approved_study_indices()),
                ..Projection::default()
            },
            SourceId::Automatic => Projection {
                automatic: Some(self.automatic.project(include_snapshot)),
                ..Projection::default()
            },
        }
    }

    fn apply(&mut self, action: Action) -> Projection<'_> {
        match action {
            Action::Initialize { session } => {
                *self = session;
                Projection {
                    study: Some(self.study.project(true)),
                    approved_study_indices: Some(self.approved_study_indices()),
                    automatic: Some(self.automatic.project(true)),
                    automatic_phase: Some(self.automatic_phase),
                    automatic_process_error: Some(&self.automatic_process_error),
                }
            }
            Action::Received {
                source,
                snapshot,
                updated_at,
            } => {
                let entry = self.source(&source);
                let changed = entry.snapshot.as_ref() != Some(&snapshot);
                if changed {
                    entry.snapshot = Some(snapshot);
                }
                entry.status = Status::Ready;
                entry.updated_at = Some(updated_at);
                entry.error = None;
                self.project_source(source, changed)
            }
            Action::ReadFailed { source, error } => {
                let entry = self.source(&source);
                entry.status = Status::Error;
                entry.error = Some(error);
                self.project_source(source, false)
            }
            Action::ListenerFailed { source, error } => {
                self.source(&source).event_error = error;
                self.project_source(source, false)
            }
            Action::AutomaticSignal { phase, error } => {
                if let Some(phase) = phase {
                    self.automatic_phase = phase;
                }
                self.automatic_process_error = error;
                Projection {
                    automatic_phase: Some(self.automatic_phase),
                    automatic_process_error: Some(&self.automatic_process_error),
                    ..Projection::default()
                }
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::LearningSession;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! {
        static SESSION: RefCell<LearningSession> = RefCell::new(LearningSession::default());
    }

    #[wasm_bindgen]
    pub fn update_learning_session(raw: &str) -> Result<String, JsValue> {
        let action =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        SESSION.with(|state| {
            serde_json::to_string(&state.borrow_mut().apply(action))
                .map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn apply(session: &mut LearningSession, action: Value) -> Value {
        serde_json::to_value(session.apply(serde_json::from_value(action).unwrap())).unwrap()
    }

    #[test]
    fn keeps_sources_independent_and_retains_last_valid_data_across_failures() {
        let mut session = LearningSession::default();
        let snapshot = json!({"enabled":false,"records":[{"id":"study:logic"}]});
        let received = apply(
            &mut session,
            json!({
                "type":"received", "source":"study", "snapshot":snapshot, "updatedAt":1000
            }),
        );
        assert_eq!(received["study"]["snapshot"], snapshot);
        assert!(received.get("automatic").is_none());

        let repeated = apply(
            &mut session,
            json!({"type":"received","source":"study","snapshot":snapshot,"updatedAt":1500}),
        );
        assert!(repeated["study"].get("snapshot").is_none());
        assert_eq!(repeated["study"]["updatedAt"], 1500);

        let failed = apply(
            &mut session,
            json!({"type":"readFailed","source":"study","error":"Temporal"}),
        );
        assert_eq!(failed["study"]["status"], "error");
        assert_eq!(failed["study"]["updatedAt"], 1500);
        assert!(failed["study"].get("snapshot").is_none());
        assert_eq!(session.study.snapshot.as_ref(), Some(&snapshot));

        apply(
            &mut session,
            json!({"type":"listenerFailed","source":"study","error":"Sin eventos"}),
        );
        let recovered = apply(
            &mut session,
            json!({
                "type":"received","source":"study","snapshot":{"enabled":true},"updatedAt":2000
            }),
        );
        assert_eq!(recovered["study"]["status"], "ready");
        assert_eq!(recovered["study"]["eventError"], "Sin eventos");
        assert!(recovered["study"]["error"].is_null());
    }

    #[test]
    fn transfers_the_fallback_view_and_projects_automatic_phase_separately() {
        let mut session = LearningSession::default();
        let initialized = apply(
            &mut session,
            json!({"type":"initialize","session":{
                "study":{"snapshot":null,"status":"loading","updatedAt":null,"error":null,"eventError":""},
                "automatic":{"snapshot":{"enabled":true},"status":"ready","updatedAt":1000,"error":null,"eventError":""},
                "automaticPhase":"evaluating","automaticProcessError":""
            }}),
        );
        assert_eq!(initialized["automatic"]["snapshot"]["enabled"], true);
        assert_eq!(initialized["automaticPhase"], "evaluating");
        let interrupted = apply(
            &mut session,
            json!({"type":"automaticSignal","phase":"error","error":"Interrumpido"}),
        );
        assert_eq!(
            interrupted,
            json!({"automaticPhase":"error","automaticProcessError":"Interrumpido"})
        );
    }

    #[test]
    fn selects_only_active_lessons_with_a_passed_latest_exercise() {
        let mut session = LearningSession::default();
        let projection = apply(
            &mut session,
            json!({
                "type": "received", "source": "study", "updatedAt": 1500, "snapshot": {"records": [
                    {"active":true,"lastPassed":false,"passes":1},
                    {"active":true,"lastPassed":true,"passes":2},
                    {"active":false,"lastPassed":true,"passes":2},
                    {"active":true,"lastPassed":true,"passes":0}
                ]}
            }),
        );
        assert_eq!(projection["approvedStudyIndices"], json!([1]));
        assert_eq!(
            projection["study"]["snapshot"]["records"]
                .as_array()
                .unwrap()
                .len(),
            4
        );
    }
}
