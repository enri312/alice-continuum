use serde::{Deserialize, Serialize};

#[derive(Clone, Default, PartialEq, Deserialize, Serialize)]
struct Selection {
    provider: String,
    model: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Provider {
    id: String,
    label: String,
    configured: bool,
    default_model: String,
    protocol: String,
    retention_mode: String,
}

#[derive(Deserialize, Serialize)]
struct Status {
    providers: Vec<Provider>,
}

#[derive(Clone, Copy, Serialize)]
struct Behavior {
    creativity: f64,
    empathy: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Control {
    Creativity,
    Empathy,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    User,
    Assistant,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Message {
    id: String,
    role: Role,
    text: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exchange_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Initial {
    desktop_app: bool,
    cloud_status: Status,
    cloud_selection: Selection,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Action {
    Status { status: Status },
    ResolveSelection,
    SelectProvider { provider: String },
    SelectModel { model: String },
    Draft { draft: String },
    ShowFullHistory { enabled: bool },
    Behavior { key: Control, value: f64 },
    BeginTurn,
    EndTurn,
    InitialHistory { messages: Vec<Message> },
    ReplaceHistory { messages: Vec<Message> },
    AppendTurn { messages: [Message; 2] },
}

struct Session {
    status: Status,
    selection: Selection,
    selection_ready: bool,
    draft: String,
    full_history: bool,
    behavior: Behavior,
    pending: bool,
    messages: Vec<Message>,
    initial_history_settled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Projection<'a> {
    cloud_status: Option<&'a Status>,
    cloud_selection: &'a Selection,
    persist_selection: bool,
    draft: &'a str,
    show_full_history: bool,
    behavior: Behavior,
    pending: bool,
    messages: Option<&'a [Message]>,
}

impl Session {
    fn new(initial: Initial) -> Self {
        let mut session = Self {
            status: initial.cloud_status,
            selection: initial.cloud_selection,
            selection_ready: !initial.desktop_app,
            draft: String::new(),
            full_history: false,
            behavior: Behavior {
                creativity: 0.2,
                empathy: 0.5,
            },
            pending: false,
            messages: Vec::new(),
            initial_history_settled: false,
        };
        if session.selection_ready || session.selection.provider.is_empty() {
            session.resolve_selection();
        }
        session
    }

    fn resolve_selection(&mut self) {
        if let Some(provider) = self
            .status
            .providers
            .iter()
            .find(|p| p.id == self.selection.provider)
        {
            if self.selection.model.trim().is_empty() {
                self.selection.model = provider.default_model.clone();
            }
            return;
        }
        let providers = &self.status.providers;
        if let Some(provider) = providers
            .iter()
            .find(|p| p.id == "ollama")
            .or_else(|| providers.iter().find(|p| p.configured))
            .or_else(|| providers.first())
        {
            self.selection = Selection {
                provider: provider.id.clone(),
                model: provider.default_model.clone(),
            };
        }
    }

    fn project(&self, include_status: bool, include_messages: bool) -> Projection<'_> {
        Projection {
            cloud_status: include_status.then_some(&self.status),
            cloud_selection: &self.selection,
            persist_selection: self.selection_ready,
            draft: &self.draft,
            show_full_history: self.full_history,
            behavior: self.behavior,
            pending: self.pending,
            messages: include_messages.then_some(&self.messages),
        }
    }

    fn apply(&mut self, action: Action) -> Result<Projection<'_>, &'static str> {
        let mut changed_status = false;
        let mut changed_messages = false;
        match action {
            Action::Status { status } => {
                self.status = status;
                self.selection_ready = true;
                self.resolve_selection();
                changed_status = true;
            }
            Action::ResolveSelection => {
                self.selection_ready = true;
                self.resolve_selection();
            }
            Action::SelectProvider { provider } => {
                if let Some(item) = self.status.providers.iter().find(|p| p.id == provider) {
                    self.selection = Selection {
                        provider,
                        model: item.default_model.clone(),
                    };
                    self.selection_ready = true;
                }
            }
            Action::SelectModel { model } => {
                self.selection.model = model;
                if let Some(provider) = self
                    .status
                    .providers
                    .iter()
                    .find(|p| p.id == self.selection.provider)
                {
                    if self.selection.model.trim().is_empty() {
                        self.selection.model = provider.default_model.clone();
                    }
                    self.selection_ready = true;
                }
            }
            Action::Draft { draft } => self.draft = draft,
            Action::ShowFullHistory { enabled } => self.full_history = enabled,
            Action::Behavior { key, value }
                if !self.pending
                    && (0.0..=1.0).contains(&value)
                    && matches!(self.selection.provider.as_str(), "llamacpp" | "ollama") =>
            {
                let value = (value * 100.0).round() / 100.0;
                match key {
                    Control::Creativity => self.behavior.creativity = value,
                    Control::Empathy => self.behavior.empathy = value,
                }
            }
            Action::Behavior { .. } => {}
            Action::BeginTurn if self.pending => return Err("Ya hay una respuesta en curso."),
            Action::BeginTurn => self.pending = true,
            Action::EndTurn => self.pending = false,
            Action::InitialHistory { mut messages } if !self.initial_history_settled => {
                // Earlier responses without a persistent snapshot are part of this session.
                messages.append(&mut self.messages);
                self.messages = messages;
                self.initial_history_settled = true;
                changed_messages = true;
            }
            Action::InitialHistory { .. } => {}
            Action::ReplaceHistory { messages } => {
                self.messages = messages;
                self.initial_history_settled = true;
                changed_messages = true;
            }
            Action::AppendTurn { messages } => {
                self.messages.extend(messages);
                changed_messages = true;
            }
        }
        Ok(self.project(changed_status, changed_messages))
    }
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::{Action, Initial, Session};
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! {
        static SESSION: RefCell<Option<Session>> = const { RefCell::new(None) };
    }

    #[wasm_bindgen]
    pub fn init_conversation_session(raw: &str) -> Result<String, JsValue> {
        let initial: Initial =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        SESSION.with(|cell| {
            let mut state = cell.borrow_mut();
            let session = state.get_or_insert_with(|| Session::new(initial));
            serde_json::to_string(&session.project(true, true))
                .map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }

    #[wasm_bindgen]
    pub fn update_conversation_session(raw: &str) -> Result<String, JsValue> {
        let action: Action =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        SESSION.with(|cell| {
            let mut state = cell.borrow_mut();
            let session = state
                .as_mut()
                .ok_or_else(|| JsValue::from_str("Sesión sin inicializar"))?;
            let next = session.apply(action).map_err(JsValue::from_str)?;
            serde_json::to_string(&next).map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn provider(id: &str, model: &str) -> Value {
        json!({"id":id,"label":id,"configured":true,"defaultModel":model,"protocol":"local","retentionMode":"local"})
    }

    fn session(provider_id: &str, model: &str) -> Session {
        Session::new(
            serde_json::from_value(json!({
                "desktopApp":true, "cloudStatus":{"providers":[provider("ollama","default")]},
                "cloudSelection":{"provider":provider_id,"model":model}
            }))
            .unwrap(),
        )
    }

    fn apply(session: &mut Session, raw: Value) -> Value {
        let action = serde_json::from_value(raw).unwrap();
        serde_json::to_value(session.apply(action).unwrap()).unwrap()
    }

    fn message(id: &str, role: &str) -> Value {
        json!({"id":id,"role":role,"text":"Prueba","createdAt":"2026-11-19T12:00:00Z"})
    }

    #[test]
    fn keeps_the_saved_model_until_the_real_providers_arrive() {
        let mut session = session("otro", "guardado");
        let initial = serde_json::to_value(session.project(true, true)).unwrap();
        assert_eq!(initial["cloudSelection"]["model"], "guardado");
        assert_eq!(initial["persistSelection"], false);
        let resolved = apply(
            &mut session,
            json!({
                "type":"status","status":{"providers":[provider("otro","nuevo"),provider("ollama","default")]}
            }),
        );
        assert_eq!(
            resolved["cloudSelection"],
            json!({"provider":"otro","model":"guardado"})
        );
        assert_eq!(resolved["persistSelection"], true);
        let choice = apply(
            &mut session,
            json!({"type":"selectProvider","provider":"ollama"}),
        );
        assert_eq!(
            choice["cloudSelection"],
            json!({"provider":"ollama","model":"default"})
        );
    }

    #[test]
    fn draft_and_preferences_survive_pending_and_history_updates() {
        let mut session = session("ollama", "guardado");
        apply(&mut session, json!({"type":"draft","draft":"Mi borrador"}));
        apply(
            &mut session,
            json!({"type":"showFullHistory","enabled":true}),
        );
        apply(
            &mut session,
            json!({"type":"behavior","key":"empathy","value":0.877}),
        );
        apply(&mut session, json!({"type":"beginTurn"}));
        assert!(session.apply(Action::BeginTurn).is_err());
        let busy = apply(
            &mut session,
            json!({"type":"behavior","key":"empathy","value":0.1}),
        );
        assert_eq!(busy["behavior"]["empathy"], 0.88);
        let settled = apply(&mut session, json!({"type":"endTurn"}));
        assert_eq!(settled["draft"], "Mi borrador");
        assert_eq!(settled["showFullHistory"], true);
        assert_eq!(settled["pending"], false);
        assert!(settled["messages"].is_null());
    }

    #[test]
    fn startup_history_does_not_overwrite_a_newer_turn() {
        let mut session = session("ollama", "guardado");
        let append = apply(
            &mut session,
            json!({
                "type":"appendTurn","messages":[message("user-local","user"),message("assistant-local","assistant")]
            }),
        );
        assert_eq!(append["messages"].as_array().unwrap().len(), 2);
        let startup = apply(
            &mut session,
            json!({"type":"initialHistory","messages":[message("old","user")]}),
        );
        assert_eq!(startup["messages"][0]["id"], "old");
        assert_eq!(startup["messages"][1]["id"], "user-local");
        apply(
            &mut session,
            json!({"type":"replaceHistory","messages":[message("latest","assistant")]}),
        );
        let ignored = apply(
            &mut session,
            json!({"type":"initialHistory","messages":[message("stale","user")]}),
        );
        assert!(ignored["messages"].is_null());
        assert_eq!(session.messages[0].id, "latest");
    }
}
