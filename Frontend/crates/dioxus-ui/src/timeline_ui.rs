use crate::timeline_model::{elapsed_label, Module, State};
use dioxus::prelude::*;

pub fn panel(view: &State, on_select: EventHandler<String>) -> Element {
    let visible = view.visible();
    let selected = view.selected();
    let modules = view.modules();
    let span = elapsed_label(view.span());
    let selected_sequence = selected
        .map(|event| format!("{:05}", event.sequence))
        .unwrap_or_default();
    rsx! {
        section { class: "cognitive-timeline", "aria-labelledby": "timeline-title",
            header { div { span { "[06]" } strong { id: "timeline-title", "COGNITIVE TIMELINE" } } small { if visible.is_empty() { "WAITING FOR EVENTS" } else { "LOCAL EVENT CLOCK" } } }
            dl { class: "timeline-summary",
                div { dt { "VISIBLE EVENTS" } dd { "{visible.len()} / {view.total()}" } }
                div { dt { "MODULES" } dd { "{modules}" } }
                div { dt { "TIME SPAN" } dd { "{span}" } }
                div { dt { "RETENTION" } dd { "TEMPORAL" } }
            }
            div { class: "timeline-stage",
                if visible.is_empty() {
                    div { class: "timeline-empty", span { "000" } strong { "SIN EVENTOS COGNITIVOS" } small { "La línea aparecerá cuando Nyxia registre actividad local verificable." } }
                } else {
                    div { class: "timeline-axis", span { "{visible[0].time_label}" } i {} span { "{visible[visible.len()-1].time_label}" } }
                    div { class: "timeline-rail", role: "list", "aria-label": "Últimos eventos cognitivos",
                        for (index, event) in visible.iter().enumerate() {
                            {
                                let id = event.id.clone();
                                let selected_class = if selected.is_some_and(|selected| selected.id == event.id) { "selected" } else { "" };
                                let class = format!("timeline-node module-{} {selected_class} lane-{}", event.module.class(), index % 3);
                                let position = view.position(event);
                                let label = format!("{}, {}, {}", event.module.label(), event.node, event.time_label);
                                let sequence = format!("{:04}", event.sequence);
                                rsx! { button { key: "{event.id}", r#type: "button", role: "listitem", class,
                                    style: "--timeline-left: {position}%", "aria-label": label,
                                    onclick: move |_| on_select.call(id.clone()),
                                    i {} span { "{sequence}" }
                                } }
                            }
                        }
                    }
                }
            }
            div { class: "timeline-inspector", "aria-live": "polite",
                if let Some(event) = selected {
                    span { "{event.time_label} · SEQ {selected_sequence}" }
                    strong { "{event.module.label()} / {event.node}" }
                    p { "{event.payload}" } em { "{event.level.label()}" }
                } else { span { "NO SELECTION" } strong { "NINGÚN EVENTO DISPONIBLE" } p { "La inspección permanece vacía." } em { "—" } }
            }
            div { class: "timeline-legend",
                for module in [Module::System, Module::Perception, Module::Memory, Module::Workspace, Module::Output, Module::Security] {
                    span { class: "module-{module.class()}", "{module.label()}" }
                }
            }
        }
    }
}
