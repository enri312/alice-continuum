use crate::dashboard_model::Payload;
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::json;
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

fn emit(callback: &js_sys::Function, kind: &str, value: &str) {
    let action = json!({ "type": kind, "value": value }).to_string();
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&action));
}

fn navigation(callback: js_sys::Function, screen: &'static str) -> impl FnMut(MouseEvent) {
    move |_| emit(&callback, "navigate", screen)
}

pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
    // The mounted page owns the field. Updates from IPC refresh the metrics
    // without overwriting what the owner is currently typing.
    let mut draft = use_signal(|| props.initial.draft.clone());
    let receiver = props.rx.clone();
    use_future(move || {
        let receiver = receiver.borrow_mut().take();
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

    let view = payload.read();
    let metrics = view.metrics();
    let ram_style = format!("--ram-use: {}%", view.ram_percent().unwrap_or(0.0));
    let submit = props.on_action.clone();
    let edit = props.on_action.clone();
    let shortcuts = [
        (
            "identificacion",
            &view.assets.conversation,
            "Conversación",
            "Pide ayuda por texto o por voz.",
        ),
        (
            "planificador",
            &view.assets.planner,
            "Planificador",
            "Revisa acciones y los pasos que requieren tu aprobación.",
        ),
        (
            "memoria",
            &view.assets.memory,
            "Memoria",
            "Consulta recuerdos, enseñanzas y aprendizaje.",
        ),
        (
            "puentes",
            &view.assets.permissions,
            "Capacidades y permisos",
            "Revisa qué puede hacer Alice y qué acceso tiene.",
        ),
    ];

    rsx! {
        main { class: "alice-dashboard", "aria-labelledby": "dashboard-title",
            header { class: "dashboard-brand",
                img { src: view.assets.emblem.as_str(), width: "48", height: "48", alt: "" }
                div { h1 { id: "dashboard-title", "Alice Continuum" } p { "Asistente personal" } }
                button { r#type: "button", class: "dashboard-link", onclick: navigation(props.on_action.clone(), "configuracion"),
                    "Configuración " span { "aria-hidden": "true", "↗" }
                }
            }
            div { class: "dashboard-overview",
                section { class: "dashboard-panel dashboard-request", "aria-labelledby": "dashboard-request-title",
                    h2 { id: "dashboard-request-title", "¿En qué te ayudo?" }
                    p { "Escribe lo que necesitas. Puedes continuar en Conversación y revisar tu solicitud antes de enviarla." }
                    form {
                        onsubmit: move |event| {
                            event.prevent_default();
                            if !draft.read().trim().is_empty() {
                                emit(&submit, "navigate", "identificacion");
                            }
                        },
                        label { r#for: "dashboard-request", class: "dashboard-field-label", "Tu solicitud" }
                        textarea {
                            id: "dashboard-request", rows: "3", value: "{draft}",
                            placeholder: "Explícame un tema o ayúdame a organizar una tarea…",
                            oninput: move |event| {
                                let value = event.value();
                                emit(&edit, "draft", &value);
                                draft.set(value);
                            }
                        }
                        button { r#type: "submit", class: "dashboard-primary", disabled: draft.read().trim().is_empty(),
                            "Continuar en Conversación " span { "aria-hidden": "true", "→" }
                        }
                    }
                }
                section { class: "dashboard-panel dashboard-system", "aria-labelledby": "dashboard-system-title",
                    header { class: "dashboard-panel-heading",
                        h2 { id: "dashboard-system-title", "Estado del equipo" }
                        span { class: "dashboard-reading-status", role: "status", "{view.reading_status()}" }
                    }
                    div { class: "dashboard-system-content",
                        dl { class: "dashboard-metrics",
                            for row in metrics {
                                div { class: "dashboard-metric", key: "{row.label}",
                                    dt { span { "aria-hidden": "true", "{row.symbol}" } "{row.label}" }
                                    dd { "{row.value}" if let Some(detail) = row.detail { small { "{detail}" } } }
                                }
                            }
                        }
                        div { class: "dashboard-gauge", style: "{ram_style}", "aria-hidden": "true",
                            div { class: "dashboard-gauge-ring" }
                            div { class: "dashboard-gauge-value", strong { "{view.ram_text()}" } span { "RAM en uso" } }
                        }
                    }
                }
            }
            section { class: "dashboard-workspace", "aria-labelledby": "dashboard-workspace-title",
                div { class: "dashboard-panel-heading",
                    h2 { id: "dashboard-workspace-title", "Herramientas de Alice" }
                    button { r#type: "button", class: "dashboard-link", onclick: navigation(props.on_action.clone(), "actividad"),
                        "Ver actividad " span { "aria-hidden": "true", "↗" }
                    }
                }
                ul { class: "dashboard-shortcuts",
                    for (screen, icon, title, detail) in shortcuts {
                        li { key: "{screen}",
                            button { r#type: "button", class: "dashboard-panel dashboard-shortcut", onclick: navigation(props.on_action.clone(), screen),
                                img { src: icon.as_str(), width: "78", height: "78", alt: "" }
                                span { class: "dashboard-shortcut-text", strong { "{title}" } small { "{detail}" } }
                                span { class: "dashboard-arrow", "aria-hidden": "true", "↗" }
                            }
                        }
                    }
                }
            }
        }
    }
}
