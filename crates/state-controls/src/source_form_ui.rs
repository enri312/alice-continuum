use crate::source_form_model::Payload;
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::JsValue;

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
fn emit(callback: &js_sys::Function, action: serde_json::Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&action.to_string()));
}
pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
    let rx = props.rx.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        async move {
            if let Some(mut receiver) = receiver {
                while let Some(next) = receiver.next().await {
                    payload.set(next);
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    rsx! { Form { payload: payload.read().clone(), on_action: move |action| emit(&props.on_action, action) } }
}

#[component]
pub fn Form(payload: Payload, on_action: EventHandler<serde_json::Value>) -> Element {
    let snapshot = &payload;
    rsx! {
        if snapshot.sources.len() < 2 {
            p { "Se necesitan dos episodios recuperables para proponer una relación." }
        } else {
            fieldset { disabled: snapshot.busy, style: "border: 1px solid #315366; padding: 16px",
                legend { "Elegir fuentes y copiar una cita literal de cada entrada" }
                for index in 0..2 {
                    div { key: "{index}", style: "margin-bottom: 16px",
                        label { "Experiencia {index + 1}"
                            select { "aria-label": "Experiencia {index + 1}", value: "{snapshot.selected[index]}",
                                onchange: {
                                    let current = payload.clone();
                                    move |event: FormEvent| {
                                        let id = event.value();
                                        if !current.busy && (id.is_empty() || current.source(&id).is_some()) {
                                            on_action.call(serde_json::json!({"type":"selectSource","index":index,"id":id}));
                                        }
                                    }
                                },
                                option { value: "", "Seleccionar episodio" }
                                for source in &snapshot.sources {
                                    option { key: "{source.id}", value: "{source.id}", "{source.title}" }
                                }
                            }
                        }
                        if let Some(source) = snapshot.source(&snapshot.selected[index]) {
                            details {
                                summary { "Leer entrada original {index + 1}" }
                                pre { style: "white-space: pre-wrap", "{source.entry}" }
                            }
                        }
                        label { "Cita {index + 1}"
                            textarea { "aria-label": "Cita {index + 1}", value: "{snapshot.quotes[index]}", maxlength: 2048, rows: 2,
                                oninput: {
                                    let busy = snapshot.busy;
                                    move |event: FormEvent| {
                                        let quote = event.value();
                                        if !busy && quote.encode_utf16().count() <= 2048 {
                                            on_action.call(serde_json::json!({"type":"editQuote","index":index,"quote":quote}));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                button { r#type: "button", disabled: !snapshot.can_preview(),
                    onclick: { let allowed = snapshot.can_preview(); move |_| { if allowed { on_action.call(serde_json::json!({"type":"previewSources"})); } } },
                    "Revisar relación"
                }
            }
        }
    }
}
