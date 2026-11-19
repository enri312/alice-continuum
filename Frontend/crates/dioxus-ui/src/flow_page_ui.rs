use crate::{
    associations_model,
    associations_ui::Session,
    flow_page_model::{Payload, State},
    flow_ui::Graph,
};
use dioxus::prelude::*;
use futures_channel::mpsc::{unbounded, UnboundedReceiver};
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
fn emit(callback: &js_sys::Function, value: serde_json::Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&value.to_string()));
}
fn read(callback: &js_sys::Function, id: Option<u32>) {
    if let Some(id) = id {
        emit(callback, serde_json::json!({"scope":"activity","id":id}));
    }
}
pub fn page(props: PageProps) -> Element {
    let Payload::Configure {
        base,
        desktop_app,
        selected_id,
    } = &props.initial
    else {
        return rsx! { p { role: "alert", "Configuración de Flujo no disponible." } };
    };
    let mut state = use_signal(|| State::new(base.clone(), *desktop_app, selected_id.clone()));
    let (associations_tx, associations_rx) = use_hook(|| {
        let (tx, rx) = unbounded::<associations_model::Payload>();
        (tx, Rc::new(RefCell::new(Some(rx))))
    });
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let tx = associations_tx.clone();
        let callback = callback.clone();
        async move {
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    match payload {
                        Payload::Configure {
                            base,
                            desktop_app,
                            selected_id,
                        } => {
                            let id = state.write().configure(base, desktop_app, selected_id);
                            let _ = tx.unbounded_send(associations_model::Payload::Configure {
                                desktop_app,
                            });
                            read(&callback, id);
                        }
                        Payload::ActivitySuccess { id, value } => {
                            state.write().complete(id, Some(value))
                        }
                        Payload::ActivityFailure { id } => state.write().complete(id, None),
                        Payload::Associations { response } => {
                            let _ = tx.unbounded_send(response);
                        }
                    }
                }
            }
        }
    });
    let callback = props.on_action.clone();
    use_future(move || {
        let callback = callback.clone();
        async move {
            loop {
                if crate::browser_timer::delay(5_000).await.is_err() {
                    break;
                }
                if state.peek().can_read() {
                    let id = state.write().begin_read();
                    read(&callback, id);
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let view = state.read().view();
    let activity_state = view.activity.view_state();
    let selection_callback = props.on_action.clone();
    rsx! {
        section { class: "neuro-panel nucleus-page", "data-activity-state": activity_state, "aria-labelledby": "[02]-title",
            div { "data-renderer": "dioxus", Graph { payload: view.clone(), on_select: move |id: String| {
                if state.write().select(&id) { emit(&selection_callback, serde_json::json!({"scope":"selection","id":id})); }
            } } }
            div { "data-associations-renderer": "dioxus", Session { desktop_app: state.read().desktop_app, rx: associations_rx.clone(),
                on_request: move |request: associations_model::Request| emit(&props.on_action, serde_json::json!({"scope":"associations","request":request}))
            } }
            p { class: "neuro-footnote", "Los enlaces se iluminan solo cuando tienen evidencia R3 reciente. Las rutas futuras continúan visibles como planificadas y no representan actividad real." }
        }
    }
}
