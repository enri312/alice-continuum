use crate::relations_model::Payload;
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
    rsx! { List { payload: payload.read().clone(), on_action: move |event: serde_json::Value| {
        let _ = props.on_action.call1(&JsValue::NULL, &JsValue::from_str(&event.to_string()));
    } } }
}

#[component]
pub fn List(payload: Payload, on_action: EventHandler<serde_json::Value>) -> Element {
    let snapshot = &payload;
    rsx! {
        h4 { "Relaciones guardadas" }
        if snapshot.relations.is_empty() {
            p { "No hay relaciones guardadas. No se crearon conexiones automáticas." }
        }
        for relation in &snapshot.relations {
            article { key: "{relation.id}", style: "border-top: 1px solid #315366; padding: 14px 0",
                p { "{relation.title}" }
                p { {relation.label()} }
                button { r#type: "button", disabled: relation.disabled(snapshot.busy),
                    onclick: {
                        let id = relation.id.clone(); let allowed = snapshot.can_review(&id);
                        move |_| {
                            if allowed {
                                let event = serde_json::json!({"type":"reviewRelation","id":id});
                                on_action.call(event);
                            }
                        }
                    },
                    {relation.action_label()}
                }
            }
        }
    }
}
