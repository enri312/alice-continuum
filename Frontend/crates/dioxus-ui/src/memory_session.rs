use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum StorageStatus {
    Browser,
    #[default]
    Loading,
    Native,
    Error,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkingMemory {
    generation: u64,
    expires_in_seconds: Option<u64>,
    #[serde(flatten)]
    fields: Map<String, Value>,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Session {
    sessions: Vec<Value>,
    memory_status: StorageStatus,
    memory_path: String,
    working_memory: Option<WorkingMemory>,
    owner_profile: Option<Value>,
    owner_profile_error: String,
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum Action {
    Initialize {
        snapshot: Session,
    },
    Stored {
        sessions: Vec<Value>,
        memory_status: StorageStatus,
        memory_path: String,
    },
    StorageError,
    ProfileLoaded {
        profile: Value,
    },
    ProfileFailed {
        error: String,
    },
    WorkingMemory {
        snapshot: WorkingMemory,
    },
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Projection<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    sessions: Option<&'a [Value]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    finished_indices: Option<Vec<usize>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    memory_status: Option<StorageStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    memory_path: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    working_memory: Option<&'a WorkingMemory>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_profile: Option<Option<&'a Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_profile_error: Option<&'a str>,
}

impl Session {
    fn records(&self) -> Projection<'_> {
        let finished = self
            .sessions
            .iter()
            .enumerate()
            .filter_map(|(index, record)| {
                record
                    .get("finishedAt")?
                    .as_str()
                    .filter(|date| !date.is_empty())?;
                Some(index)
            });
        Projection {
            sessions: Some(&self.sessions),
            finished_indices: Some(finished.collect()),
            memory_status: Some(self.memory_status),
            memory_path: Some(&self.memory_path),
            ..Projection::default()
        }
    }

    fn profile(&self) -> Projection<'_> {
        Projection {
            owner_profile: Some(self.owner_profile.as_ref()),
            owner_profile_error: Some(&self.owner_profile_error),
            ..Projection::default()
        }
    }

    fn apply(&mut self, action: Action) -> Projection<'_> {
        match action {
            Action::Initialize { snapshot } => {
                *self = snapshot;
                Projection {
                    working_memory: self.working_memory.as_ref(),
                    owner_profile: Some(self.owner_profile.as_ref()),
                    owner_profile_error: Some(&self.owner_profile_error),
                    ..self.records()
                }
            }
            Action::Stored {
                sessions,
                memory_status,
                memory_path,
            } => {
                self.sessions = sessions;
                self.memory_status = memory_status;
                self.memory_path = memory_path;
                self.records()
            }
            Action::StorageError => {
                self.memory_status = StorageStatus::Error;
                Projection {
                    memory_status: Some(self.memory_status),
                    ..Projection::default()
                }
            }
            Action::ProfileLoaded { profile } => {
                self.owner_profile = Some(profile);
                self.owner_profile_error.clear();
                self.profile()
            }
            Action::ProfileFailed { error } => {
                self.owner_profile = None;
                self.owner_profile_error = error;
                self.profile()
            }
            Action::WorkingMemory { snapshot } => {
                if let Some(current) = &self.working_memory {
                    if snapshot.generation < current.generation
                        || (snapshot.generation == current.generation
                            && snapshot.expires_in_seconds >= current.expires_in_seconds)
                    {
                        return Projection::default();
                    }
                }
                self.working_memory = Some(snapshot);
                Projection {
                    working_memory: self.working_memory.as_ref(),
                    ..Projection::default()
                }
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::Session;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! {
        static SESSION: RefCell<Session> = RefCell::new(Session::default());
    }

    #[wasm_bindgen]
    pub fn update_memory_session(raw: &str) -> Result<String, JsValue> {
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

    fn apply(session: &mut Session, action: Value) -> Value {
        let action = serde_json::from_value(action).unwrap();
        serde_json::to_value(session.apply(action)).unwrap()
    }

    #[test]
    fn projects_storage_failures_without_replacing_records_or_losing_fields() {
        let records = json!([
            {"id": "abierto"},
            {"id": "relato", "finishedAt": "2026-11-19T12:00:00Z", "importance": 2.5, "oldField": ["valor"]},
            {"id": "vacio", "finishedAt": ""}
        ]);
        let mut session = Session::default();
        let stored = apply(
            &mut session,
            json!({
                "type": "stored", "sessions": records, "memoryStatus": "native", "memoryPath": "records.json"
            }),
        );
        assert_eq!(stored["sessions"], records);
        assert_eq!(stored["finishedIndices"], json!([1]));
        assert_eq!(
            apply(&mut session, json!({"type": "storageError"})),
            json!({"memoryStatus": "error"})
        );
        assert_eq!(
            session.sessions.as_slice(),
            records.as_array().unwrap().as_slice()
        );
    }

    #[test]
    fn invalidated_profile_is_removed_without_changing_record_membership() {
        let mut session = Session::default();
        let profile = json!({"state": "available", "records": [{"id": "confirmado"}]});
        let loaded = apply(
            &mut session,
            json!({"type":"profileLoaded","profile":profile}),
        );
        assert_eq!(loaded["ownerProfile"], profile);
        assert_eq!(loaded["ownerProfileError"], "");
        let failed = apply(
            &mut session,
            json!({"type":"profileFailed","error":"Fuente alterada"}),
        );
        assert_eq!(
            failed,
            json!({"ownerProfile":null,"ownerProfileError":"Fuente alterada"})
        );
        assert!(session.owner_profile.is_none());
    }

    #[test]
    fn ignores_stale_working_memory_after_a_clear_and_stale_expiry_reads() {
        let mut session = Session::default();
        let ram = |generation, expires| {
            json!({
                "type": "workingMemory", "snapshot": {"generation": generation, "expiresInSeconds": expires}
            })
        };
        assert_eq!(
            apply(&mut session, ram(41, Some(120)))["workingMemory"]["generation"],
            41
        );
        assert_eq!(
            apply(&mut session, ram(41, Some(115)))["workingMemory"]["expiresInSeconds"],
            115
        );
        assert_eq!(apply(&mut session, ram(41, Some(118))), json!({}));
        assert_eq!(
            apply(&mut session, ram(42, None))["workingMemory"]["generation"],
            42
        );
        assert_eq!(apply(&mut session, ram(41, Some(100))), json!({}));
    }
}
