use crate::volume_page_model::{
    Dominant, Inspector, LearningActivity, LearningHistory, Legends, NodeLabel, Projection,
    SignalState, Signals, Swatch,
};
use crate::volume_page_ui::Command;
use dioxus::prelude::*;

pub fn learning_summary(data: &Projection, history: &LearningHistory) -> Element {
    let observed = history
        .baseline
        .filter(|_| data.learning_ready)
        .map_or_else(
            || "Esperando la lectura inicial".into(),
            |count| format!("Desde esta apertura · base {count}"),
        );
    let added = if history.added == 1 {
        "nuevo"
    } else {
        "nuevos"
    };
    let changed = if history.changed == 1 {
        "actualizado"
    } else {
        "actualizados"
    };
    let change_count = history.recent.len();
    let changes = match change_count {
        0 => String::new(),
        1 => " · 1 cambio".into(),
        count => format!(" · {count} cambios"),
    };
    let study_info = data.study.as_ref().map_or_else(
        || "Lecciones y ejercicios guardados".into(),
        |study| {
            format!(
                "{} disponibles · {} intentos",
                study.available, study.attempts
            )
        },
    );
    let metrics = [
        (
            "Autoestudio registrado",
            data.by_origin.study,
            study_info.as_str(),
        ),
        (
            "Aprendido al conversar",
            data.by_origin.automatic,
            "Declaraciones conservadas con su origen",
        ),
        (
            "Perfil del propietario",
            data.by_origin.profile,
            "Hechos de perfil identificados",
        ),
        (
            "Otros recuerdos",
            data.by_origin.record,
            "Episodios y registros existentes",
        ),
    ];
    let has_changes = history.added + history.changed > 0;
    rsx! {
        section { class: "volume-learning-summary", "data-has-changes": "{has_changes}", "aria-labelledby": "volume-learning-title",
            header {
                div { h4 { id: "volume-learning-title", "Así evoluciona su conocimiento" }
                    small { "Cada nodo conserva un registro real. Al incorporarse o cambiar, puedes ver qué lo originó." } }
                div { class: "volume-learning-observed",
                    span { "{observed}" } strong { "{history.added} {added} · {history.changed} {changed}" }
                }
            }
            dl { class: "volume-learning-metrics", "aria-label": "Fuentes de los conocimientos visibles",
                for (label, count, note) in metrics {
                    div { key: "{label}", dt { "{label}" } dd { "{count}" } small { "{note}" } }
                }
            }
            details { class: "volume-learning-changes", summary { "Cambios observados en esta vista{changes}" }
                if change_count == 0 {
                    p { "Los registros que ya estaban guardados forman el punto de partida. Las nuevas incorporaciones y modificaciones aparecerán aquí mientras esta vista siga abierta." }
                } else {
                    ul {
                        for (index, item) in history.recent.iter().enumerate() {
                            li { key: "{item.observed_at.now_ms}:{item.id}:{index}",
                                span { "{item.kind.label()}" } strong { "{item.label}" }
                                time { datetime: "{item.observed_at.iso_time}", "{item.observed_at.clock_label}" }
                            }
                        }
                    }
                }
                if history.removed > 0 {
                    p { "{history.removed} registros dejaron de aparecer en esta proyección. Esto no demuestra que se hayan borrado del almacenamiento." }
                }
            }
            p { class: "volume-learning-note", "Este seguimiento empieza al leer los datos actuales; no reconstruye un historial anterior. La escala y la malla son ilustrativas: más registros visibles no miden inteligencia ni modifican los pesos de Gemma." }
        }
    }
}

pub fn learning_activity(data: &LearningActivity, command: EventHandler<Command>) -> Element {
    if !data.native {
        return rsx! { p { class: "volume-learning-offline", role: "status", "La lectura del aprendizaje está disponible en la aplicación de escritorio." } };
    }
    let records_label = match data.records_status.as_str() {
        "ready" => "Lectura inicial completa",
        "error" => "No se pudo completar la lectura",
        _ => "Leyendo los registros iniciales…",
    };
    rsx! {
        section { class: "volume-learning-activity", "data-state": "{data.status}", "aria-label": "Estado del aprendizaje de Nyxia",
            div { class: "volume-learning-source-states",
                for source in &data.sources {
                    div { key: "{source.id}", "data-state": "{source.status}",
                        strong { "{source.label}" }
                        span { role: "status",
                            if source.status == "error" { "No se pudo actualizar la lectura" }
                            else if source.status == "loading" { "Conectando con Nyxia…" } else { "{source.detail}" }
                        }
                        small { if let Some(updated) = &source.updated { "Última lectura correcta · {updated}" } else { "Sin lectura confirmada" } }
                        if source.polling_only { small { "Actualizando mediante consultas periódicas" } }
                        if let Some(warning) = &source.warning {
                            details { summary { "Ver aviso de conexión" } p { "{warning}" } p { "La última lectura válida se conserva. Se reintenta automáticamente." } }
                        }
                    }
                }
                div { "data-state": "{data.records_status}", strong { "Recuerdos y perfil" } span { role: "status", "{records_label}" }
                    if !data.records_error.is_empty() { small { "{data.records_error}" } }
                }
            }
            div { class: "volume-learning-refresh",
                span { if data.status == "error" { "Se conserva el último estado conocido; una fuente puede estar desactualizada." }
                    else { "Los cambios se incorporan al volumen cuando Nyxia los guarda." } }
                button { r#type: "button", onclick: move |_| command.call(Command::Browser("refresh")), "Actualizar lectura" }
            }
            if let Some(error) = &data.cycle_error { p { class: "volume-learning-cycle-error", role: "status", "Autoestudio: {error}" } }
        }
    }
}

pub fn inspector_panel(
    node: &Inspector,
    affects: &[Swatch],
    dominant: Option<&Dominant>,
    command: EventHandler<Command>,
) -> Element {
    let affect_class = if dominant.is_some() {
        "active"
    } else {
        "standby"
    };
    let affect_style = dominant.map(|item| format!("--affect-color:{}", item.color));
    let affect_label = dominant.map_or("10 CANALES · EN ESPERA", |item| item.label.as_str());
    let related = node.associations.len();
    let plural = if related == 1 { "" } else { "s" };
    rsx! {
        div { class: "volume-side-rail",
            aside { class: "volume-inspector-rail", "aria-label": "Inspector del volumen cognitivo",
                header { class: "volume-inspector-heading", span { "RECUERDO / PROCESO" }
                    button { r#type: "button", class: "observatory-orbit", onclick: move |_| command.call(Command::Select(None, true)), "Cerrar ficha" } }
                if let Some(memory) = &node.memory {
                    div { class: "volume-learning-meta",
                        strong { "{memory.origin}" } span { "{memory.recorded_at}" }
                        if memory.study_date { small { "La fecha de repaso no indica cuándo nació este conocimiento." } }
                    }
                    div { class: "volume-memory-appearance", "aria-label": "Color y marcas del recuerdo",
                        "data-fill-mode": "{memory.fill_mode}", "data-fill-color": "{memory.fill_color}",
                        "data-state": "{memory.marker}", "data-retrieved": "{memory.retrieved}",
                        i { class: "volume-memory-fill-swatch", style: "background-color:rgb({memory.fill_color})", "aria-hidden": "true" }
                        div { strong { "{memory.fill_label}" } small { "{memory.markers}" }
                            small { if memory.retrieved { "Recuperado en la consulta actual · anillo blanco" } else { "Seleccionado · sin recuperación en la consulta actual" } } }
                    }
                    if let Some(state) = &memory.study_state {
                        p { class: "review-note", strong { "{state}" } br {}
                            "{memory.study_passes} ejercicios aprobados registrados. Su presencia en el volumen no habilita su uso en conversación." }
                    }
                    p { class: "review-note", "Importancia: {memory.importance}. {memory.affect_label}." }
                    for affect in &memory.affects {
                        p { class: "review-note", key: "{affect.id}", strong { "{affect.label}" } br {} "“{affect.evidence}”" }
                    }
                }
                div { class: "volume-node-inspector selected", "aria-live": "polite",
                    if let Some(memory) = &node.memory {
                        span { "NODO DE MEMORIA" } strong { "{node.label}" }
                        if let Some(content) = memory.content.as_deref().filter(|value| !value.is_empty()) {
                            p { class: "neural-memory-content", "{content}" }
                        }
                        small { "{memory.state_summary}" }
                        details { class: "observatory-provenance", summary { "Fuente y detalles técnicos" }
                            code { "{memory.id}" }
                            dl { for (title, value) in &memory.provenance { div { key: "{title}", dt { "{title}" } dd { "{value}" } } } }
                        }
                    } else {
                        span { "NODO DE PROCESO" } strong { "{node.label}" } small { "{node.detail}" } code { "{node.id}" }
                    }
                }
                if related > 0 {
                    section { class: "observatory-associations", "aria-label": "Evidencia de asociaciones confirmadas",
                        header { strong { "ASOCIACIONES CONFIRMADAS" } span { "{related} relacionada{plural}" } }
                        for association in &node.associations {
                            details { key: "{association.id}",
                                summary { "Abrir evidencia de la relación" }
                                p { "Decisión confirmada por vos. Las citas pertenecen al campo original de cada recuerdo y siguen vigentes." }
                                for evidence in &association.evidence {
                                    blockquote { key: "{evidence.id}", strong { "{evidence.label}" }
                                        span { "{evidence.quote}" } small { "{evidence.reference}" } }
                                }
                                code { "{association.id}" }
                            }
                        }
                    }
                }
                div { class: "volume-affect-status {affect_class}", style: affect_style, i {}
                    span { strong { "CAPA AFECTIVA" } small { "{affect_label}" } }
                }
                div { class: "observatory-emotions",
                    header { strong { "Paleta de asociaciones emocionales" } span { "Referencia · la evidencia figura en la ficha" } }
                    div { for affect in affects { span { key: "{affect.id}", i { style: "background-color:{affect.color}" } "{affect.label}" } } }
                }
            }
        }
    }
}

pub fn color_guide(legends: &Legends) -> Element {
    rsx! {
        details { class: "volume-color-guide", summary { "Colores de los recuerdos" }
            div { class: "volume-colour-guide-content",
                section { h4 { "Relleno por tipo" } p { "Cuando no hay una asociación emocional confirmada y vigente, el relleno muestra el tipo de memoria." }
                    div { class: "volume-layer-legend", "aria-label": "Tipos de memoria",
                        for layer in &legends.layers { span { key: "{layer.id}", "data-layer": "{layer.id}", style: "color:{layer.color}", i { style: "background-color:{layer.color}" } "{layer.label}" } }
                    }
                }
                section { h4 { "Relleno con asociación emocional revisada" } p { "Usa la emoción registrada con evidencia. Si hay varias, mezcla sus colores según las intensidades guardadas; la ficha explica el tono resultante." }
                    div { class: "volume-affect-legend", "aria-label": "Colores de las asociaciones emocionales",
                        for affect in &legends.affects { span { key: "{affect.id}", "data-affect": "{affect.id}", i { style: "background-color:{affect.color}" } "{affect.label}" } }
                    }
                    small { "Son asociaciones del recuerdo revisadas por el propietario; no sentimientos atribuidos a Nyxia." }
                }
                section { h4 { "Contorno y estado" } p { "El estado cambia el contorno o la atenuación y conserva el relleno. La ficha muestra todos los estados; el contorno usa el primero que corresponda en este orden." }
                    div { class: "volume-state-legend", "aria-label": "Marcas de estado de los recuerdos",
                        for state in &legends.states {
                            span { key: "{state.id}", "data-state": "{state.id}",
                                svg { view_box: "0 0 22 22", "aria-hidden": "true",
                                    circle { cx: "11", cy: "11", r: "7", fill: "none", stroke: "{state.color}", stroke_width: "1.5", stroke_dasharray: state.dash.as_deref().unwrap_or_default() }
                                }
                                "{state.label}"
                            }
                        }
                    }
                }
                section { h4 { "Recuperación y selección" } p { i { class: "volume-retrieval-key" }
                    " Un anillo blanco señala recuperación actual, selección o el puntero sobre un nodo. El relleno permanece igual; la ficha indica si el recuerdo fue recuperado. Los rombos representan procesos y conservan su propia codificación." }
                }
            }
        }
    }
}

pub fn signal_console(
    signals: &Signals,
    demos: &[NodeLabel],
    demo: bool,
    paused: bool,
    reduced: bool,
    now_ms: u64,
    command: EventHandler<Command>,
) -> Element {
    let (state, state_label) = signals.state.display();
    let mode = if demo { "demo" } else { "recorded" };
    let static_view = paused || reduced;
    let has_sample = signals.generated_at.is_some();
    let no_sample = "—";
    let active_routes = signals
        .routes
        .iter()
        .filter(|route| route.animatable)
        .count();
    let audited_minutes = if has_sample {
        format!(
            "{:.0} min de auditoría",
            (signals.window_seconds / 60.0).round()
        )
    } else {
        "Sin muestra nativa".into()
    };
    let events = if has_sample {
        signals.recent_event_count.to_string()
    } else {
        no_sample.into()
    };
    let routes = if has_sample {
        active_routes.to_string()
    } else {
        no_sample.into()
    };
    let signal = if has_sample {
        format!("{:.3}", signals.overall_signal)
    } else {
        no_sample.into()
    };
    let age = signals.generated_at.map_or_else(
        || no_sample.into(),
        |timestamp| format!("{}s", now_ms.saturating_sub(timestamp) / 1_000),
    );
    let age_label = if matches!(signals.state, SignalState::Stale) {
        "Animación real detenida"
    } else {
        "Consulta nominal cada 5 s"
    };
    let route_label = if demo {
        "Rutas ilustrativas de la demostración"
    } else {
        "Rutas respaldadas por auditoría"
    };
    let (pause_label, pause_note) = if reduced {
        (
            "Movimiento reducido",
            "Movimiento reducido del equipo: vista estática",
        )
    } else if paused {
        (
            "Reanudar animación",
            "La evidencia sigue actualizándose; sólo se pausa el movimiento",
        )
    } else {
        ("Pausar animación", "Pulsos visibles sobre las conexiones")
    };
    rsx! {
        section { class: "volume-signal-console", "data-mode": mode, "data-state": state, "data-paused": "{static_view}", "aria-labelledby": "volume-signals-title",
            header { class: "volume-signal-console-header",
                div { span { class: "eyebrow", "TRÁFICO DE SEÑALES" } h3 { id: "volume-signals-title", "Actividad y conexiones" }
                    p { "Observa la evidencia reciente o explora un recorrido ilustrativo." } }
                nav { class: "volume-signal-modes", "aria-label": "Origen de las señales",
                    button { r#type: "button", "aria-pressed": "{!demo}", onclick: move |_| command.call(Command::Demo(false)), "Actividad registrada" }
                    button { r#type: "button", "data-mode": "demo", "aria-pressed": "{demo}", onclick: move |_| command.call(Command::Demo(true)), "Demostración" }
                }
            }
            div { class: "volume-signal-status", "data-mode": mode, "data-state": state, role: "status",
                i { "aria-hidden": "true" }
                strong { if demo { "DEMOSTRACIÓN VISUAL" } else { "{state_label}" } }
                span { if demo { "Rutas de ejemplo · los contadores reales se conservan" } else { "{signals.description}" } }
            }
            dl { class: "volume-signal-metrics", "aria-label": "Actividad registrada, independiente de la demostración",
                div { dt { "Eventos en la ventana" } dd { "{events}" } small { "{audited_minutes}" } }
                div { dt { "Rutas con señal vigente" } dd { "{routes}" } small { "Evidencia por conexión" } }
                div { dt { "Señal técnica R3" } dd { "{signal}" } small { "Índice heurístico · no es un porcentaje cerebral" } }
                div { dt { "Edad de la muestra" } dd { "{age}" } small { "{age_label}" } }
            }
            ul { class: "volume-signal-route-list", "aria-label": route_label,
                if demo {
                    for route in demos {
                        li { key: "{route.id}", "data-animating": "{!static_view}", "data-demo": "true",
                            div { strong { "{route.label}" } span { "Ejemplo visual" } }
                            div { class: "signal-route-track", style: "--signal-strength:.65", "aria-hidden": "true", i {} }
                        }
                    }
                } else if signals.routes.is_empty() {
                    li { class: "volume-signal-note", "Las rutas registradas aparecerán cuando la aplicación pueda consultar la auditoría local." }
                } else {
                    for route in &signals.routes {
                        {
                            let animating = route.animatable && !static_view;
                            let suffix = if route.event_count == 1 { "" } else { "s" };
                            rsx! {
                                li { key: "{route.id}", "data-animating": "{animating}",
                                    div { strong { "{route.label}" } span { "{route.event_count} evidencia{suffix}" } }
                                    div { class: "signal-route-track", style: "--signal-strength:{route.signal}", "aria-hidden": "true", i {} }
                                }
                            }
                        }
                    }
                }
            }
            div { class: "volume-signal-tools",
                button { r#type: "button", "aria-pressed": "{static_view}", disabled: reduced, onclick: move |_| command.call(Command::Pause), "{pause_label}" }
                span { "{pause_note}" }
            }
            p { class: "volume-signal-note",
                if demo { "Esta demostración no ejecuta el modelo, no genera recuerdos y no envía datos. Las estaciones y los pulsos son ilustrativos." }
                else { "Las rutas y sus conteos proceden de eventos de la aplicación. La velocidad y cantidad de partículas son ilustrativas; no muestran neuronas ni activaciones internas de Gemma." }
            }
            details { class: "volume-signal-explanation", summary { "¿Qué representa esta actividad?" }
                p { "Los nodos conservan los recuerdos y procesos que puedes inspeccionar. La evidencia reciente se resume en una ventana temporal; no indica que cada proceso siga ejecutándose ahora. Las asociaciones confirmadas y los recuerdos del mismo intercambio conservan sus significados y colores." }
                p { "Inspirarse en el cerebro significa modelar mecanismos concretos, como propagación con retardos, activación por umbral, inhibición y reposo. Esta vista representa el flujo funcional de Nyxia; no simula todavía esas neuronas biológicas ni mide conciencia." }
            }
        }
    }
}
