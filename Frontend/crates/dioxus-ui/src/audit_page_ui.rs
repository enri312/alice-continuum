use crate::audit_page_model::{size_label, DiagnosticCategory, Payload, State, View};
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

fn emit(callback: &js_sys::Function, value: serde_json::Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&value.to_string()));
}

fn read(callback: &js_sys::Function, request: Option<(View, u32)>) {
    if let Some((view, id)) = request {
        let view = if view == View::Audit {
            "audit"
        } else {
            "diagnostic"
        };
        emit(
            callback,
            serde_json::json!({"type": "read", "view": view, "id": id}),
        );
    }
}

pub fn page(props: PageProps) -> Element {
    let Payload::Configure {
        desktop_app,
        capability,
        view,
    } = &props.initial
    else {
        return rsx! { p { role: "alert", "Configuración de Auditoría no disponible." } };
    };
    let mut state = use_signal(|| State::new(*desktop_app, capability.clone(), *view));
    let receiver = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = receiver.borrow_mut().take();
        let callback = callback.clone();
        async move {
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    let requests = state.write().update(payload);
                    for request in requests {
                        read(&callback, Some(request));
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });

    let snapshot = state.read();
    let total = snapshot
        .audit
        .snapshot
        .as_ref()
        .map_or(0, |report| report.total_valid_events);
    let refresh = EventHandler::new({
        let callback = props.on_action.clone();
        move |view| read(&callback, state.write().request(view))
    });
    rsx! {
        section { class: "activity-page", "aria-labelledby": "activity-title",
            div { class: "activity-heading",
                div {
                    p { class: "eyebrow", "R3 · INSPECCIÓN LOCAL" }
                    h2 { id: "activity-title", "Auditoría y diagnóstico" }
                    p { "Evidencia persistente y salud técnica para inspección del propietario." }
                }
                div { class: if total > 0 { "activity-status" } else { "activity-status idle" }, i {}
                    if total > 0 { "EVIDENCIA REAL" } else { "EN ESPERA" }
                }
            }
            div { class: "activity-view-tabs", role: "tablist", "aria-label": "Herramientas de auditoría y diagnóstico",
                for (view, id, panel, number, label) in [
                    (View::Audit, "audit-tab", "native-audit-panel", "[08]", "Registro de auditoría"),
                    (View::Diagnostic, "diagnostic-tab", "passive-diagnostic-panel", "[09]", "Diagnóstico pasivo"),
                ] {
                    {
                        let callback = props.on_action.clone();
                        rsx! {
                            button { id, r#type: "button", role: "tab", "aria-controls": panel, "aria-selected": snapshot.view == view,
                                class: if snapshot.view == view { "selected" } else { "" },
                                onclick: move |_| read(&callback, state.write().select(view)),
                                span { "{number}" } "{label}"
                            }
                        }
                    }
                }
            }
            if snapshot.view == View::Audit {
                {audit_panel(&snapshot, total, refresh, props.on_action.clone())}
            } else {
                {diagnostic_panel(&snapshot, refresh)}
            }
        }
    }
}

fn audit_panel(
    state: &State,
    total: u64,
    refresh: EventHandler<View>,
    callback: js_sys::Function,
) -> Element {
    let reading = &state.audit;
    let loading = reading.loading();
    let capability = state.capability.as_deref();
    rsx! {
        section { id: "native-audit-panel", class: "native-audit", role: "tabpanel", "aria-labelledby": "audit-tab",
            header { class: "event-console-title",
                span { "[08]" }
                strong { id: "native-audit-title", "AUDITORÍA LOCAL · ESQUEMA V1" }
                small { "{total} EVENTOS VÁLIDOS" }
            }
            div { class: "native-audit-toolbar",
                p { "Metadatos mínimos correlacionados. Nunca guarda mensajes, imágenes, audio, parámetros privados ni claves." }
                button { class: "console-button", r#type: "button", disabled: !state.desktop_app || loading,
                    onclick: move |_| refresh.call(View::Audit),
                    if loading { "Leyendo…" } else { "Actualizar lectura" }
                }
            }
            if let Some(capability) = capability {
                div { class: "native-audit-toolbar",
                    p { "Capacidad seleccionada · " strong { "{capability}" } }
                    button { class: "console-button", r#type: "button", onclick: move |_| emit(&callback, serde_json::json!({"type":"clearCapability"})),
                        "Mostrar todas las operaciones"
                    }
                }
            }
            if !state.desktop_app {
                div { class: "event-empty", "La auditoría nativa está disponible únicamente en Alice de escritorio." }
            } else if let Some(error) = &reading.error {
                div { class: "native-audit-error", role: "alert", strong { "LECTURA NO DISPONIBLE" } span { "{error}" } }
            } else if let Some(audit) = &reading.snapshot {
                {
                    let state_class = if audit.healthy { "healthy" } else { "warning" };
                    let health = if audit.healthy { "ÍNTEGRA" } else { "REVISAR" };
                    let actual = size_label(audit.current_bytes);
                    let maximum = size_label(audit.maximum_current_bytes);
                    let rotation = size_label(audit.rotated_bytes);
                    let visible: Vec<_> = audit.events.iter().rev()
                        .filter(|event| capability.is_none() || event.capability_id.as_deref() == capability)
                        .collect();
                    rsx! {
                        dl { class: "native-audit-summary",
                            div { dt { "ESTADO" } dd { class: state_class, "{health}" } }
                            div { dt { "ARCHIVO ACTUAL" } dd { "{actual} / {maximum}" } }
                            div { dt { "ROTACIÓN ANTERIOR" } dd { "{rotation}" } }
                            div { dt { "LÍNEAS INVÁLIDAS" } dd { "{audit.invalid_lines}" } }
                        }
                        div { class: "native-audit-path",
                            span { "FUENTE LOCAL" }
                            strong { title: "{audit.storage_path}",
                                if audit.storage_path.is_empty() { "El archivo se creará al registrar el primer evento." }
                                else { "{audit.storage_path}" }
                            }
                            small { "Solo lectura desde esta pantalla · límite actual 5 MiB + una rotación" }
                        }
                        div { class: "event-console native",
                            div { class: "native-event-row event-header",
                                span { "HORA" } span { "ORIGEN" } span { "ETAPA" } span { "OPERACIÓN" }
                                span { "RESULTADO" } span { "MOTIVO / CORRELACIÓN" }
                            }
                            if visible.is_empty() {
                                div { class: "event-empty",
                                    if capability.is_some() { "Sin operaciones de esta capacidad en los eventos disponibles." }
                                    else { "Todavía no existen eventos nativos en el archivo R3." }
                                }
                            } else {
                                for event in visible {
                                    {
                                        let (outcome_class, outcome_label) = event.outcome.display();
                                        let title = event.capability_id.as_ref()
                                            .map_or_else(|| event.operation.clone(), |id| format!("{id} / {}", event.operation));
                                        let operation_prefix: String = event.operation_id.chars().take(8).collect();
                                        rsx! {
                                            div { class: "native-event-row", key: "{event.event_id}",
                                                span { "{event.local_time}" }
                                                span { "{event.source.label()}" }
                                                span { "{event.stage.label()}" }
                                                span { title, "{event.operation}" }
                                                span { class: "audit-outcome {outcome_class}", "{outcome_label}" }
                                                span { title: "{event.operation_id}", "{event.reason_code} · {operation_prefix}" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                div { class: "event-empty", role: "status", "Leyendo auditoría nativa…" }
            }
        }
    }
}

fn diagnostic_panel(state: &State, refresh: EventHandler<View>) -> Element {
    let reading = &state.diagnostic;
    let loading = reading.loading();
    let total = reading
        .snapshot
        .as_ref()
        .map_or(0, |report| report.summary.total);
    rsx! {
        section { id: "passive-diagnostic-panel", class: "passive-diagnostic", role: "tabpanel", "aria-labelledby": "diagnostic-tab",
            header { class: "event-console-title",
                span { "[09]" }
                strong { id: "passive-diagnostic-title", "DIAGNÓSTICO DEL SISTEMA · ESQUEMA V1" }
                small { "{total} COMPROBACIONES" }
            }
            div { class: "native-audit-toolbar",
                p { "Solo inspecciona. No abre dispositivos, no envía red, no solicita permisos y no corrige archivos." }
                button { class: "console-button", r#type: "button", disabled: !state.desktop_app || loading,
                    onclick: move |_| refresh.call(View::Diagnostic),
                    if loading { "Inspeccionando…" } else { "Actualizar diagnóstico" }
                }
            }
            if !state.desktop_app {
                div { class: "event-empty", "El diagnóstico nativo está disponible únicamente en Alice de escritorio." }
            } else if let Some(error) = &reading.error {
                div { class: "native-audit-error", role: "alert", strong { "DIAGNÓSTICO NO DISPONIBLE" } span { "{error}" } }
            } else if let Some(report) = &reading.snapshot {
                {
                    let (status_class, status) = report.overall_status.display();
                    rsx! {
                        dl { class: "diagnostic-summary",
                            div { dt { "ESTADO" } dd { class: "diagnostic-{status_class}", "{status}" } }
                            div { dt { "SALUDABLES" } dd { "{report.summary.healthy}" } }
                            div { dt { "CONFIG. PENDIENTE" } dd { "{report.summary.configuration_pending}" } }
                            div { dt { "NO DISPONIBLES" } dd { "{report.summary.unavailable}" } }
                            div { dt { "ERRORES" } dd { "{report.summary.errors}" } }
                        }
                        div { class: "diagnostic-groups",
                            for category in DiagnosticCategory::ALL {
                                {
                                    let checks: Vec<_> = report.checks.iter().filter(|item| item.category == category).collect();
                                    let count = checks.len();
                                    let label = category.label();
                                    rsx! {
                                        section { key: "{label}", "aria-label": label,
                                            header { strong { "{label}" } span { "{count}" } }
                                            div {
                                                for item in checks {
                                                    {
                                                        let (status_class, status) = item.status.display();
                                                        rsx! {
                                                            article { key: "{item.id}", class: "diagnostic-check status-{status_class}", i {}
                                                                div { strong { "{item.label}" } p { "{item.summary}" } }
                                                                span { "{status}" }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        footer { class: "diagnostic-footnote", "GENERADO LOCALMENTE · {report.generated_at} · SIN EFECTOS LATERALES" }
                    }
                }
            } else {
                div { class: "event-empty", role: "status", "Leyendo diagnóstico pasivo…" }
            }
        }
    }
}
