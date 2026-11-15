use crate::confirmation_model::{Kind, Payload};
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
fn emit(callback: &js_sys::Function, action: &str, token: &str) {
    let event = serde_json::json!({"type":action,"token":token});
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&event.to_string()));
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
    let snapshot = payload.read();
    let create = snapshot.kind == Kind::Create;
    let label = if create {
        "Confirmar relación revisada"
    } else {
        "Confirmar cambio de relación"
    };
    let confirm_label = if create {
        "Confirmar y guardar relación"
    } else {
        "Confirmar cambio"
    };
    rsx! {
        div { role: "region", "aria-label": label,
            if create {
                p { "Las dos citas coinciden con las fuentes actuales. Revisá si realmente querés relacionar estas experiencias:" }
                for (index, quote) in snapshot.quotes.iter().enumerate() { blockquote { key: "{index}", "{quote}" } }
            } else {
                p { "¿" if snapshot.withdrawn { "Restaurar" } else { "Retirar" } " esta relación? No modifica recuerdos y conserva las revisiones anteriores." }
            }
            button { r#type: "button", disabled: snapshot.busy,
                onclick: {
                    let token=snapshot.token.clone(); let callback=props.on_action.clone();
                    move |_| { if payload.read().accepts(&token,false) { emit(&callback,"confirm",&token); } }
                }, "{confirm_label}"
            }
            if !create {
                button { r#type: "button", disabled: snapshot.busy,
                    onclick: {
                        let token=snapshot.token.clone(); let callback=props.on_action.clone();
                        move |_| { if payload.read().accepts(&token,true) { emit(&callback,"cancel",&token); } }
                    }, "Cancelar"
                }
            }
        }
    }
}
