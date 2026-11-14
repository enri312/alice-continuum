use crate::model::{ActivityStatus, Availability, Payload};
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

fn emit(callback: &js_sys::Function, event: serde_json::Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&event.to_string()));
}
fn status(availability: &Availability) -> (&'static str, &'static str) {
    match availability {
        Availability::Ready => ("implemented", "IMPLEMENTADO"),
        Availability::Planned => ("planned", "FUTURO"),
    }
}

pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
    let mut selected_id = use_signal(|| props.initial.selected_id.clone());
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
    let on_ready = props.on_ready.clone();
    use_effect(move || {
        let _ = on_ready.call0(&JsValue::NULL);
    });
    let snap = payload.read();
    let recall = snap.retrieval.display();
    let selection = selected_id.read().clone();
    let (inspector_label, inspector_value, inspector_detail) = snap.inspector_for(&selection);
    let inspector_value = format!("{inspector_value:.3}");
    let memory_selected = selection == "retrieved-memory";
    let memory_callback = props.on_action.clone();
    let retrieval_aria = format!(
        "Memoria recuperada, {}: {}. {}. {}: {}. Abrir detalles en el inspector.",
        recall.type_label, recall.text, recall.status, recall.score_label, recall.score
    );
    let activity = &snap.activity;
    let view_state = activity.view_state();
    let audit_state = activity.audit_state();
    let activity_class = match activity.status {
        ActivityStatus::Loading => "loading",
        ActivityStatus::Ready => "ready",
        ActivityStatus::Unavailable => "unavailable",
    };
    let header_class = format!("neuro-heading nucleus-page-header is-{view_state}");
    let live_class = format!("neuro-live {view_state} is-{view_state}");
    let provenance_class = format!(
        "core-activity-provenance {activity_class} is-{view_state} {}",
        if audit_state == "degraded" {
            "degraded"
        } else {
            ""
        }
    );
    let method = activity
        .method
        .as_deref()
        .unwrap_or("r3-recency-motor-v2")
        .to_uppercase();
    let summary = activity.summary();
    let activity_label = activity.label();

    rsx! {
        section { class: "neuro-panel nucleus-page", "data-activity-state": "{view_state}", "aria-labelledby": "[03]-title",
            div { class: "{header_class}", "data-activity-state": "{view_state}",
                div { p { class: "eyebrow", "[03] · ESTADO VERIFICABLE" }
                    h2 { id: "[03]-title", "Estado y controles" }
                    p { class: "nucleus-page-description", "Señales verificables, memoria recuperada y ajustes disponibles para el próximo envío." }
                }
                span { class: "{live_class}", "data-activity-state": "{view_state}", "data-signal-present": view_state == "ready", role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-busy": view_state == "loading",
                    i { "aria-hidden": "true" } "{activity_label}"
                }
            }
            div { class: "{provenance_class}", "data-activity-state": "{view_state}", "data-audit-state": "{audit_state}", role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-busy": view_state == "loading",
                strong { "R3 · ACTIVIDAD DERIVADA" } span { "{summary}" }
                small { "HEURÍSTICA {method} · NO ES EMOCIÓN NI CONCIENCIA" }
            }
        div { class: "neuro-layout",
            div { class: "neuro-stage",
                div { class: if snap.has_activity { "internal-state has-activity" } else { "internal-state is-empty" },
                    div { class: "nucleus-panel-label state-panel-caption",
                        span { "[03]" } strong { "REPLY + AFFECT + DRIVE STATE" } small { "SEÑALES DE LECTURA · AJUSTES DE SESIÓN" }
                    }
                    header { class: "state-header",
                        div { span { class: "state-monogram", "ALI" } strong { "ALICE" } small { "MODELO INTERNO · SEÑALES Y AJUSTES DE SESIÓN" } }
                        span { class: "state-records", "{snap.local_records}" }
                    }
                    section { class: "state-section", "aria-label": "SEÑALES INTERNAS",
                        div { class: "state-section-title",
                            span { role: "heading", "aria-level": "3", "SEÑALES INTERNAS" }
                            small { if snap.has_activity { "DATOS VERIFICABLES" } else { "SIN ACTIVIDAD" } }
                        }
                        div { class: "metric-grid",
                            for metric in &snap.metrics {
                                {
                                    let (availability, label) = status(&metric.availability);
                                    let selected = if selection == metric.id { "selected" } else { "" };
                                    let ready = if metric.availability == Availability::Ready { "ready" } else { "planned" };
                                    let classes = format!("metric-row state-selection-target state-kind-metric state-availability-{ready} {ready} {selected}");
                                    let id = metric.id.clone(); let callback = props.on_action.clone();
                                    let value = format!("{:.3}", metric.value);
                                    let aria = format!("{}: {}. Estado: {}. Abrir en el inspector.", metric.label, value, label.to_lowercase());
                                    rsx! { button { key: "{metric.id}", r#type: "button", class: classes, "aria-pressed": !selected.is_empty(), "aria-label": aria,
                                        onclick: move |_| { selected_id.set(id.clone()); emit(&callback, serde_json::json!({"type":"select","id":id})); },
                                        span { class: "metric-label state-item-label", span { class: "state-item-name", "{metric.label}" } i { class: "state-status-chip state-status-{availability}", "{label}" } }
                                        span { class: "metric-track state-value-track", "aria-hidden": "true", i { style: "width: {metric.value * 100.0}%" } }
                                        strong { class: "state-value-output", "aria-hidden": "true", "{value}" }
                                    } }
                                }
                            }
                        }
                    }
                    section { class: "state-section retrieved-memory", "aria-label": "MEMORIA RECUPERADA",
                        div { class: "state-section-title", span { role: "heading", "aria-level": "3", "MEMORIA RECUPERADA" } }
                        button { r#type: "button", class: if memory_selected { "retrieved-row state-selection-target state-kind-retrieval selected" } else { "retrieved-row state-selection-target state-kind-retrieval" },
                            "aria-pressed": memory_selected, "aria-label": retrieval_aria,
                            onclick: move |_| { selected_id.set("retrieved-memory".into()); emit(&memory_callback, serde_json::json!({"type":"select","id":"retrieved-memory"})); },
                            span { "{recall.type_label}" } strong { "{recall.text}" } em { title: "{recall.score_label}", "{recall.score}" }
                        }
                    }
                    section { class: "state-section behavior-section", "aria-label": "CONTROLES DE COMPORTAMIENTO",
                        div { class: "state-section-title",
                            span { role: "heading", "aria-level": "3", "CONTROLES DE COMPORTAMIENTO" }
                            small { "AJUSTES DEL PRÓXIMO ENVÍO · BLOQUEO SEGÚN DISPONIBILIDAD" }
                        }
                        div { class: "control-grid",
                            for control in &snap.controls {
                                {
                                    let (availability, label) = status(&control.availability);
                                    let selected = if selection == control.id { "selected" } else { "" };
                                    let ready = if control.availability == Availability::Ready { "ready" } else { "planned" };
                                    let lock = if control.locked { "locked" } else { "available" };
                                    let lock_label = if control.locked { " Bloqueado." } else { " Ajuste de esta sesión." };
                                    let classes = format!("control-row state-control-slider state-selection-target state-kind-control state-availability-{ready} state-lock-{lock} {ready} {selected}");
                                    let value = format!("{:.2}", control.value);
                                    let aria = format!("{}: {}. Estado: {}.{} Abrir en el inspector.", control.label, value, label.to_lowercase(), lock_label);
                                    let inspect_id = control.id.clone(); let focus_id = control.id.clone(); let input_id = control.id.clone();
                                    let inspect_cb = props.on_action.clone(); let focus_cb = props.on_action.clone(); let input_cb = props.on_action.clone();
                                    rsx! { div { key: "{control.id}", class: classes,
                                        button { r#type: "button", class: "state-control-inspect", "aria-pressed": !selected.is_empty(), "aria-label": aria,
                                            onclick: move |_| { selected_id.set(inspect_id.clone()); emit(&inspect_cb, serde_json::json!({"type":"select","id":inspect_id})); },
                                            span { class: "state-item-name", "{control.label}" }
                                            span { class: "state-status-list",
                                                i { class: "state-status-chip state-status-{availability}", "{label}" }
                                                i { class: if control.locked { "state-status-chip state-status-locked" } else { "state-status-chip state-status-implemented" }, if control.locked { "BLOQUEADO" } else { "AJUSTABLE" } }
                                            }
                                        }
                                        input { r#type: "range", class: "state-behavior-range", min: "0", max: "1", step: "0.01", value: "{value}", disabled: control.locked,
                                            "aria-label": "{control.label}.{lock_label}", "aria-valuetext": "{value}",
                                            onfocus: move |_| { selected_id.set(focus_id.clone()); emit(&focus_cb, serde_json::json!({"type":"select","id":focus_id})); },
                                            oninput: move |event| { if let Ok(value) = event.value().parse::<f64>() { if payload.read().can_change(&input_id, value) { emit(&input_cb, serde_json::json!({"type":"changeBehavior","id":input_id,"value":value})); } } },
                                        }
                                        strong { class: "state-value-output", "aria-hidden": "true", "{value}" }
                                    } }
                                }
                            }
                        }
                    }
                }
            }
            aside { class: "neuro-inspector",
                p { class: "eyebrow", "INSPECTOR" }
                if memory_selected {
                    div { class: "state-retrieval-inspector",
                        h3 { "Memoria recuperada" } span { class: "state-retrieval-status", "{recall.status}" }
                        p { strong { "{recall.type_label}" } } p { "{recall.text}" }
                        dl { dt { "{recall.score_label}" } dd { "{recall.score}" } dt { "Coincidencias vigentes" } dd { "{recall.count}" } }
                        p { "{recall.detail}" }
                        if let Some(source) = &recall.source { small { "Fuente: {source}." } }
                    }
                } else {
                    h3 { "{inspector_label}" } span { class: "inspector-value", "{inspector_value}" } p { "{inspector_detail}" }
                    small { "Creatividad y estilo empático se aplican a la conversación local. Los controles bloqueados conservan sus límites." }
                }
            }
        }
        p { class: "neuro-footnote", "Los ajustes de estilo no conceden permisos. Las señales técnicas no representan emociones ni conciencia; los módulos pendientes conservan su bloqueo." }
        }
    }
}
