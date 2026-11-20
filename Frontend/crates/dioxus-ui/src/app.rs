use crate::navigation_model::{Request, Screen};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct App {
    screen: Screen,
    request: Option<Request>,
    audit_capability: Option<String>,
    sequence: u32,
}

impl Default for App {
    fn default() -> Self {
        Self {
            screen: Screen::Dashboard,
            request: None,
            audit_capability: None,
            sequence: 0,
        }
    }
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Action {
    Initialize { screen: Screen },
    Navigate { screen: Screen },
    Route { screen: Screen, clear_audit: bool },
    OpenAudit { capability: Option<String> },
    ClearAudit,
}

impl App {
    fn navigate(&mut self, screen: Screen) {
        self.sequence = self.sequence.wrapping_add(1);
        self.request = Some(Request {
            id: self.sequence,
            screen,
        });
    }

    fn update(&mut self, action: Action) {
        match action {
            Action::Initialize { screen } => {
                *self = Self {
                    screen,
                    ..Self::default()
                }
            }
            Action::Navigate { screen } => self.navigate(screen),
            Action::Route {
                screen,
                clear_audit,
            } => {
                self.screen = screen;
                if clear_audit {
                    self.audit_capability = None;
                }
                if self.request.is_some_and(|request| request.screen == screen) {
                    self.request = None;
                }
            }
            Action::OpenAudit { capability } => {
                self.audit_capability = capability;
                self.navigate(Screen::Auditoria);
            }
            Action::ClearAudit => self.audit_capability = None,
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub(crate) mod browser {
    use super::App;
    use crate::navigation_model::Payload;
    use crate::navigation_ui::frame;
    use dioxus::prelude::*;
    use futures_channel::mpsc::UnboundedReceiver;
    use futures_util::StreamExt;
    use serde_json::json;
    use std::{cell::RefCell, rc::Rc};
    use wasm_bindgen::prelude::*;

    thread_local! { static APP: RefCell<App> = RefCell::new(App::default()); }

    #[derive(Clone)]
    pub struct PageProps {
        pub initial: Payload,
        pub rx: Rc<RefCell<Option<UnboundedReceiver<Payload>>>>,
        pub on_action: js_sys::Function,
        pub on_ready: js_sys::Function,
    }

    impl PartialEq for PageProps {
        fn eq(&self, _: &Self) -> bool {
            true
        }
    }

    pub fn page(props: PageProps) -> Element {
        let mut selected = use_signal(|| (props.initial.initial_screen, false));
        let mut counters = use_signal(|| (props.initial.memories, props.initial.events));
        let receiver = props.rx.clone();
        use_future(move || {
            let receiver = receiver.borrow_mut().take();
            async move {
                let mut last_request = None;
                if let Some(mut receiver) = receiver {
                    while let Some(payload) = receiver.next().await {
                        counters.set((payload.memories, payload.events));
                        if let Some(request) =
                            payload.request.filter(|item| Some(item.id) != last_request)
                        {
                            last_request = Some(request.id);
                            selected.set((request.screen, false));
                        }
                    }
                }
            }
        });
        let on_ready = props.on_ready.clone();
        use_effect(move || {
            let _ = on_ready.call0(&JsValue::NULL);
        });
        let on_action = props.on_action.clone();
        use_effect(move || {
            let (screen, clear_audit) = selected();
            let message = json!({ "type": "route", "screen": screen, "clearAudit": clear_audit });
            let _ = on_action.call1(&JsValue::NULL, &JsValue::from_str(&message.to_string()));
        });
        frame(selected().0, counters(), selected)
    }

    #[wasm_bindgen]
    pub fn update_app(raw: &str) -> Result<String, JsValue> {
        let action =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        APP.with(|app| {
            let mut app = app.borrow_mut();
            app.update(action);
            serde_json::to_string(&*app).map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audit_from_inventory_keeps_filter_until_the_audit_tab_clears_it() {
        let mut app = App::default();
        app.update(Action::OpenAudit {
            capability: Some("context.foreground.control".into()),
        });
        app.update(Action::Route {
            screen: Screen::Puentes,
            clear_audit: false,
        });
        assert_eq!(app.request.unwrap().screen, Screen::Auditoria);
        app.update(Action::Route {
            screen: Screen::Auditoria,
            clear_audit: false,
        });
        assert_eq!(app.screen, Screen::Auditoria);
        assert!(app.request.is_none());
        assert_eq!(
            app.audit_capability.as_deref(),
            Some("context.foreground.control")
        );
        app.update(Action::Route {
            screen: Screen::Auditoria,
            clear_audit: true,
        });
        assert!(app.audit_capability.is_none());
    }

    #[test]
    fn repeated_destinations_have_distinct_requests_and_keep_the_latest() {
        let mut app = App::default();
        app.update(Action::Initialize {
            screen: Screen::Avatar,
        });
        assert_eq!(app.screen, Screen::Avatar);
        app.update(Action::Navigate {
            screen: Screen::Memoria,
        });
        let first = app.request.unwrap();
        app.update(Action::Navigate {
            screen: Screen::Memoria,
        });
        assert_ne!(first.id, app.request.unwrap().id);
        app.update(Action::Route {
            screen: Screen::Puentes,
            clear_audit: false,
        });
        assert_eq!(app.request.unwrap().screen, Screen::Memoria);
        app.audit_capability = Some("test".into());
        app.update(Action::ClearAudit);
        assert!(app.audit_capability.is_none());
    }
}
