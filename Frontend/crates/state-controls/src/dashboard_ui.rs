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

fn navigation(callback: js_sys::Function, screen: &'static str) -> impl FnMut(MouseEvent) {
    move |_| {
        let action = json!({ "type": "navigate", "value": screen }).to_string();
        let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&action));
    }
}

pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
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
                section { class: "dashboard-panel dashboard-assistant", "aria-labelledby": "dashboard-assistant-title",
                    h2 { id: "dashboard-assistant-title", "Estado de Alice" }
                    dl { class: "dashboard-assistant-summary",
                        div { dt { "Motor seleccionado" } dd { "{view.assistant.provider}" } }
                        div { dt { "Recuerdos disponibles" } dd { "{view.assistant.memory_count}" } }
                        div { dt { "Eventos de esta sesión" } dd { "{view.assistant.event_count}" } }
                    }
                    p { "Usa las herramientas de abajo para pedir ayuda, consultar recuerdos y revisar acciones." }
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
