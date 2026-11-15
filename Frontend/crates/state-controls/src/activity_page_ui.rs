use crate::activity_page_model::{Filter, Payload, State, View};
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
fn publish(state: Signal<State>, callback: &js_sys::Function) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&state.read().recovery()));
}

pub fn page(props: PageProps) -> Element {
    let mut state = use_signal(|| State::new(props.initial.clone()));
    let rx = props.rx.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        async move {
            if let Some(mut receiver) = receiver {
                while let Some(next) = receiver.next().await {
                    state.write().update(next);
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let callback = props.on_action.clone();
    let select = EventHandler::new(move |id: String| {
        let changed = state.write().timeline.select(&id);
        if changed {
            publish(state, &callback);
        }
    });
    let view = state.read();
    let total = view.timeline.total();
    let filtered = view.filtered();
    let query_callback = props.on_action.clone();
    let module_callback = props.on_action.clone();
    let clear_callback = props.on_action.clone();
    rsx! {
        section { class: "activity-page", "aria-labelledby": "activity-title",
            div { class: "activity-heading",
                div { p { class: "eyebrow", "[06—07] COGNITIVE ACTIVITY · LOCAL" }
                    h2 { id: "activity-title", "Actividad cognitiva" }
                    p { "Línea temporal y eventos observables de la conducta actual de Alice." }
                }
                div { class: if total > 0 { "activity-status" } else { "activity-status idle" }, i {}
                    if total > 0 { "EVIDENCIA REAL" } else { "EN ESPERA" }
                }
            }
            div { class: "activity-view-tabs", role: "tablist", "aria-label": "Visualizaciones de actividad cognitiva",
                for (tab, number, label) in [(View::Timeline, "[06]", "COGNITIVE TIMELINE"), (View::Events, "[07]", "EVENT STREAM")] {
                    {
                        let callback = props.on_action.clone();
                        rsx! { button { r#type: "button", role: "tab", "aria-selected": view.settings.view == tab,
                            class: if view.settings.view == tab { "selected" } else { "" },
                            onclick: move |_| { state.write().settings.view = tab; publish(state, &callback); },
                            span { "{number}" } "{label}"
                        } }
                    }
                }
            }
            if view.settings.view == View::Timeline {
                {crate::timeline_ui::panel(&view.timeline, select)}
            } else {
                div { class: "event-console-title", span { "[07]" } strong { "EVENT STREAM / LOCAL CONSOLE" } small { "{total} RECORDS" } }
                div { class: "activity-controls",
                    input { "aria-label": "Buscar eventos", value: "{view.settings.query}", placeholder: "Buscar nodo o contenido", maxlength: 8192,
                        oninput: move |event| { let changed = state.write().set_query(event.value()); if changed { publish(state, &query_callback); } }
                    }
                    select { "aria-label": "Filtrar módulo", value: view.settings.module.label(),
                        onchange: move |event| { if let Some(module) = Filter::from_label(&event.value()) { state.write().settings.module = module; publish(state, &module_callback); } },
                        for module in [Filter::All, Filter::System, Filter::Perception, Filter::Memory, Filter::Workspace, Filter::Output, Filter::Security] {
                            option { value: module.label(), if module == Filter::All { "TODOS LOS MÓDULOS" } else { "{module.label()}" } }
                        }
                    }
                    button { class: "console-button", r#type: "button", disabled: total == 0,
                        onclick: move |_| { if state.read().timeline.total() > 0 { let _ = clear_callback.call1(&JsValue::NULL, &JsValue::from_str("{\"type\":\"clear\"}")); } },
                        "Limpiar vista"
                    }
                }
                div { class: "event-console",
                    div { class: "event-row event-header", span { "SEQ" } span { "TIME" } span { "MODULE" } span { "LEVEL" } span { "NODE" } span { "PAYLOAD" } }
                    if filtered.is_empty() {
                        div { class: "event-empty", "No hay eventos que coincidan con este filtro." }
                    } else {
                        for (event, time) in filtered {
                            div { class: "event-row", key: "{event.id}",
                                span { "{event.sequence:05}" } span { "{time}" }
                                span { class: "module module-{event.module.class()}", "{event.module.label()}" }
                                span { "{event.level.label()}" } span { "{event.node}" }
                                span { title: "{event.payload}", "{event.payload}" }
                            }
                        }
                    }
                }
                div { class: "console-prompt", strong { "ALICE_CORE@LOCAL_PROCESS:~$" }
                    span { "{total} eventos temporales · limpiar no modifica la auditoría nativa" }
                }
            }
        }
    }
}
