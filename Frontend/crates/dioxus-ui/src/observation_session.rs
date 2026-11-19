use serde::{Deserialize, Serialize};

#[derive(PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Grant {
    id: String,
    expires_at: u64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ForegroundContext {
    window_title: String,
    process_name: String,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Session {
    grant: Option<Grant>,
    revision: u64,
    foreground_context: Option<ForegroundContext>,
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum Action {
    Initialize {
        session: Session,
        now: u64,
    },
    Grant {
        revision: Option<u64>,
        grant: Option<Grant>,
        now: u64,
    },
    Sample {
        revision: u64,
        grant: Option<Grant>,
        context: Option<ForegroundContext>,
        now: u64,
    },
}

impl Session {
    fn set_grant(&mut self, grant: Option<Grant>, invalidate: bool) {
        if invalidate || self.grant != grant {
            self.grant = grant;
            self.revision = self.revision.saturating_add(1);
            self.foreground_context = None;
        }
    }

    fn apply(&mut self, action: Action) {
        match action {
            Action::Initialize { session, now } => {
                *self = session;
                if !self
                    .grant
                    .as_ref()
                    .is_some_and(|grant| now < grant.expires_at)
                {
                    self.set_grant(None, false);
                    self.foreground_context = None;
                }
            }
            Action::Grant {
                revision,
                grant,
                now,
            } => {
                if revision.is_none_or(|revision| revision == self.revision) {
                    self.set_grant(
                        grant.filter(|grant| now < grant.expires_at),
                        revision.is_none(),
                    );
                }
            }
            Action::Sample {
                revision,
                grant,
                context,
                now,
            } if revision == self.revision => {
                let verified = grant.filter(|grant| now < grant.expires_at);
                if verified.is_some() && self.grant == verified {
                    self.foreground_context = context;
                } else {
                    self.set_grant(None, false);
                }
            }
            Action::Sample { .. } => {}
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
    pub fn update_observation_session(raw: &str) -> Result<String, JsValue> {
        let action =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        SESSION.with(|cell| {
            let mut state = cell.borrow_mut();
            state.apply(action);
            serde_json::to_string(&*state).map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn grant(id: &str) -> Value {
        json!({"id": id, "expiresAt": 500})
    }

    fn update(session: &mut Session, action: Value) {
        session.apply(serde_json::from_value(action).unwrap());
    }

    fn sample(revision: u64, id: &str, now: u64) -> Value {
        json!({
            "type": "sample", "revision": revision, "grant": grant(id), "now": now,
            "context": {"processName":"editor.exe","windowTitle":"Prueba aislada"}
        })
    }

    #[test]
    fn revocation_invalidates_delayed_gateway_reads_and_window_samples() {
        let mut session = Session::default();
        update(
            &mut session,
            json!({"type":"grant","grant":grant("first"),"now":100}),
        );
        update(&mut session, sample(1, "first", 101));
        assert!(session.foreground_context.is_some());
        update(&mut session, json!({"type":"grant","grant":null,"now":104}));
        update(
            &mut session,
            json!({"type":"grant","revision":1,"grant":grant("first"),"now":105}),
        );
        update(&mut session, sample(1, "first", 106));
        assert_eq!(session.revision, 2);
        assert!(session.grant.is_none() && session.foreground_context.is_none());
    }

    #[test]
    fn unchanged_grant_preserves_context_and_expiry_clears_it() {
        let mut session = Session::default();
        update(
            &mut session,
            json!({"type":"grant","grant":grant("first"),"now":100}),
        );
        update(&mut session, sample(1, "first", 200));
        update(
            &mut session,
            json!({"type":"grant","revision":1,"grant":grant("first"),"now":201}),
        );
        assert_eq!(session.revision, 1);
        assert!(session.foreground_context.is_some());
        update(&mut session, sample(1, "first", 500));
        assert!(session.grant.is_none() && session.foreground_context.is_none());
    }

    #[test]
    fn mismatched_grant_cannot_persist_a_sample_across_sessions() {
        let mut session = Session::default();
        update(
            &mut session,
            json!({"type":"grant","grant":grant("first"),"now":100}),
        );
        update(&mut session, sample(1, "first", 101));
        update(
            &mut session,
            json!({"type":"grant","grant":grant("second"),"now":200}),
        );
        assert!(session.foreground_context.is_none());
        update(&mut session, sample(1, "first", 201));
        assert_eq!(session.grant.as_ref().unwrap().id, "second");
        update(&mut session, sample(2, "first", 202));
        assert!(session.grant.is_none() && session.foreground_context.is_none());
    }
}
