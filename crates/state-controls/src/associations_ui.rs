use crate::associations_model::{Action, Payload, Request, State};
use crate::{confirmation_ui::Confirmation, relations_ui::List, source_form_ui::Form};
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
fn emit(callback: &js_sys::Function, request: Option<Request>) {
    if let Some(request) = request {
        let _ = callback.call1(
            &JsValue::NULL,
            &JsValue::from_str(&serde_json::to_string(&request).expect("serializable request")),
        );
    }
}
pub fn page(props: PageProps) -> Element {
    let desktop_app = matches!(props.initial, Payload::Configure { desktop_app: true });
    let mut state = use_signal(|| State::new(desktop_app));
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let callback = callback.clone();
        async move {
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    let request = state.write().receive(payload);
                    emit(&callback, request);
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let dispatch = EventHandler::new(move |raw: serde_json::Value| {
        if let Ok(action) = serde_json::from_value::<Action>(raw) {
            let request = state.write().act(action);
            emit(&props.on_action, request);
        }
    });
    let snapshot = state.read();
    rsx! {
        section { class: "perception-vector document-preview memory-associations", "aria-labelledby": "associations-title",
            header { h3 { id: "associations-title", "RELACIONES ENTRE RECUERDOS" } }
            p { "Relacioná dos experiencias por decisión tuya. Una relación confirmada expresa tu criterio; no demuestra causalidad ni convierte respuestas del modelo en hechos." }
            if !snapshot.desktop_app {
                p { "Disponible en la aplicación de escritorio." }
            } else {
                button { r#type: "button", disabled: snapshot.busy(), onclick: move |_| dispatch.call(serde_json::json!({"type":"refresh"})), "Actualizar relaciones" }
                if let Some((count, revision)) = snapshot.summary() {
                    div {
                        p { "{count} vigentes · revisión {revision} · estado comprobado al actualizar" }
                        div { "data-source-form-renderer": "dioxus", Form { payload: snapshot.form(), on_action: dispatch } }
                        if let Some(pending) = snapshot.review() {
                            div { "data-confirmation-renderer": "dioxus", Confirmation { payload: pending, on_action: dispatch } }
                        }
                        div { "data-relations-renderer": "dioxus", List { payload: snapshot.relations(), on_action: dispatch } }
                        if let Some(pending) = snapshot.decision() {
                            div { "data-confirmation-renderer": "dioxus", Confirmation { payload: pending, on_action: dispatch } }
                        }
                    }
                }
            }
            if snapshot.busy() { p { role: "status", "Comprobando fuentes…" } }
            if !snapshot.error.is_empty() { p { role: "alert", "{snapshot.error}" } }
            if !snapshot.message.is_empty() { p { role: "status", "{snapshot.message}" } }
        }
    }
}
