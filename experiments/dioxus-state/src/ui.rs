use crate::model::{fixture, Item, Scenario};
use dioxus::prelude::*;

pub fn app() -> Element {
    let mut scenario = use_signal(|| Scenario::Ready);
    let selected = use_signal(|| "state-curiosity");
    let current = scenario();
    let snapshot = fixture(current);
    let inspected = snapshot.item(selected());
    let audit_label = match snapshot.audit_healthy {
        Some(true) => "Íntegra · simulada",
        Some(false) => "Degradada · simulada",
        None => "No disponible",
    };
    let memory_activity = snapshot.item("state-memory").value;
    let memory_caption = if snapshot.retrieved > 0 {
        format!("{} coincidencias locales · sintéticas", snapshot.retrieved)
    } else if memory_activity > 0.0 {
        "Registros disponibles, no utilizados".into()
    } else {
        "0 recuperaciones".into()
    };

    rsx! {
        div { class: "pilot-app", "data-pilot": "dioxus-state", "data-scenario": current.key(), "data-source": "synthetic",
            a { class: "skip-link", href: "#state-title", "Ir al contenido" }
            header { class: "lab-header",
                div { class: "lab-brand", span { class: "brand-mark", "A" } div { strong { "ALICE CONTINUUM" } small { "Laboratorio de interfaz / Dioxus-Web" } } }
                span { class: "demo-tag", "DEMO · DATOS SINTÉTICOS" }
            }
            main {
                section { class: "page-heading", "aria-labelledby": "state-title",
                    div { p { class: "eyebrow", "[03] / ESTADO VERIFICABLE" } h1 { id: "state-title", tabindex: "-1", "Estado y controles" } p { class: "description", "Indicadores implementados, valores planificados y controles aún bloqueados." } }
                    div { class: "signal-pill {current.key()}", role: "status", "aria-live": "polite", "aria-busy": current.busy(), span { class: "status-dot" } "{current.signal_label()}" }
                }
                aside { class: "demo-note", "aria-label": "Alcance del piloto",
                    strong { "Vista paralela, sin conexión a Alice" }
                    p { "Todos los valores de esta página son ejemplos. Cambiar de escenario o seleccionar un indicador sólo modifica esta demostración." }
                }
                section { class: "scenario-bar", "aria-labelledby": "scenario-title",
                    div { h2 { id: "scenario-title", "Escenario de prueba" } p { "Comprueba los estados de lectura y sus etiquetas." } }
                    div { class: "scenario-options",
                        for choice in Scenario::ALL {
                            button { key: "{choice.key()}", r#type: "button", class: if current == choice { "scenario-button selected" } else { "scenario-button" }, "aria-pressed": current == choice, onclick: move |_| scenario.set(choice), "{choice.label()}" }
                        }
                    }
                }
                section { class: "provenance {current.key()}", role: "status", "aria-live": "polite", "aria-busy": current.busy(), "aria-label": "Procedencia sintética de la actividad",
                    div { class: "provenance-title", span { class: "status-dot" } strong { "R3 · ACTIVIDAD DERIVADA" } span { class: "small-tag", "SIMULACIÓN" } }
                    p { "{snapshot.provenance()}" }
                    small { "HEURÍSTICA R3-RECENCY-MOTOR-V2 · NO ES EMOCIÓN NI CONCIENCIA" }
                }
                div { class: "workbench",
                    div { class: "state-content",
                        section { class: "state-summary", "aria-label": "Modelo interno de Alice",
                            div { span { class: "monogram", "ALI" } div { strong { "ALICE" } small { "MODELO INTERNO · SOLO LECTURA" } } }
                            span { class: "record-total", "{snapshot.records} RECUERDOS SINTÉTICOS" }
                        }
                        section { class: "panel", "aria-labelledby": "signals-title",
                            div { class: "panel-heading", h2 { id: "signals-title", "Señales internas" } span { if snapshot.records > 0 || current.has_signal() { "DATOS DE EJEMPLO" } else { "SIN ACTIVIDAD" } } }
                            div { class: "metric-grid",
                                for item in snapshot.metrics.iter().copied() {
                                    ItemCard { key: "{item.id}", item, selected, control: false }
                                }
                            }
                        }
                        section { class: "panel memory-panel", "aria-labelledby": "retrieved-title",
                            div { class: "panel-heading", h2 { id: "retrieved-title", "Memoria recuperada" } span { "{memory_caption}" } }
                            button { r#type: "button", class: if selected() == "state-memory" { "retrieved-card selected" } else { "retrieved-card" }, "aria-pressed": selected() == "state-memory", "aria-controls": "inspector", onclick: move |_| { let mut selected = selected; selected.set("state-memory"); }, "aria-label": format!("Memoria recuperada: {}. Actividad: {:.3}. Abrir en el inspector.", snapshot.memory_top, memory_activity),
                                div { span { class: "eyebrow", if snapshot.retrieved > 0 { "TIPO NO EXPUESTO" } else { "SIN TIPO" } } strong { "{snapshot.memory_top}" } }
                                span { class: "memory-value", "{memory_activity:.3}" }
                            }
                        }
                        section { class: "panel", "aria-labelledby": "behavior-title",
                            div { class: "panel-heading", h2 { id: "behavior-title", "Controles de comportamiento" } span { "BLOQUEADOS HASTA SU IMPLEMENTACIÓN" } }
                            p { class: "section-note", "Selecciona un control para consultar su descripción. Los valores son informativos y no son editables." }
                            div { class: "control-grid",
                                for item in snapshot.controls.iter().copied() {
                                    ItemCard { key: "{item.id}", item, selected, control: true }
                                }
                            }
                        }
                    }
                    aside { class: "inspector", id: "inspector", "aria-labelledby": "inspector-title", "aria-live": "polite", "data-selected-id": inspected.id,
                        p { class: "eyebrow", "INSPECTOR" }
                        h2 { id: "inspector-title", "{inspected.label}" }
                        div { class: "inspector-value", "{inspected.value:.3}" }
                        div { class: "inspector-tags", span { class: if inspected.implemented { "chip implemented" } else { "chip planned" }, "{inspected.status()}" } if inspected.locked { span { class: "chip locked", "BLOQUEADO" } } }
                        p { class: "inspector-detail", "{inspected.detail}" }
                        p { class: "inspector-footnote", "Los controles bloqueados no cambian el comportamiento de Alice." }
                        div { class: "inspector-source", span { "PROCEDENCIA" } strong { "Fixture local sintético" } p { "Sin IPC, sondeo, archivos privados o dispositivos." } }
                        dl { class: "inspector-audit", div { dt { "Auditoría" } dd { "{audit_label}" } } div { dt { "Módulo" } dd { if inspected.locked { "Control informativo" } else { "Señal interna" } } } }
                    }
                }
                footer { class: "page-footer",
                    p { "Permisos y memoria muestran señal técnica R3 en la aplicación principal; aquí se muestran fixtures. Las emociones y controles no implementados permanecen en cero. Ningún indicador prueba una experiencia interna." }
                    span { "DIOXUS-WEB · PILOTO AISLADO" }
                }
            }
        }
    }
}

#[component]
fn ItemCard(item: Item, mut selected: Signal<&'static str>, control: bool) -> Element {
    let is_selected = selected() == item.id;
    let width = format!("width: {}%", (item.value * 100.0).clamp(0.0, 100.0));
    let value = if control {
        format!("{:.2}", item.value)
    } else {
        format!("{:.3}", item.value)
    };
    let label = format!(
        "{}: {}. Estado: {}. {} Abrir en el inspector.",
        item.label,
        value,
        item.status(),
        if item.locked { "Bloqueado." } else { "" }
    );
    rsx! {
        button { r#type: "button", class: if is_selected { "item-card selected" } else { "item-card" }, "data-item-id": item.id, "aria-label": label, "aria-pressed": is_selected, "aria-controls": "inspector", onclick: move |_| selected.set(item.id),
            div { class: "item-top", strong { "{item.label}" } span { class: "item-value", "aria-hidden": "true", "{value}" } }
            div { class: "value-track", "aria-hidden": "true", span { style: width } }
            div { class: "item-bottom", span { class: if item.implemented { "chip implemented" } else { "chip planned" }, "{item.status()}" } if item.locked { span { class: "chip locked", "BLOQUEADO" } } }
        }
    }
}
