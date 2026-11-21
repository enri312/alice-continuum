use crate::volume_page_model::{LearningHistory, Payload, Projection, Setup, Signals};
use crate::volume_panels_ui::{
    color_guide, inspector_panel, learning_activity, learning_summary, signal_console,
};
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

#[derive(Default)]
struct Controls {
    selected: Option<String>,
    demo: bool,
    paused: bool,
    orbit: bool,
    pan: bool,
    reduced: bool,
}

fn emit(callback: &js_sys::Function, action: &str) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(action));
}

fn publish_view(callback: &js_sys::Function, view: &Controls, inspect: bool, focus: bool) {
    emit(callback, &json!({
        "type": "view", "selected": view.selected, "demo": view.demo,
        "paused": view.paused, "orbit": view.orbit, "pan": view.pan, "inspect": inspect, "focus": focus,
    }).to_string());
}

#[derive(Clone)]
pub enum Command {
    Select(Option<String>, bool),
    Pan(bool),
    Demo(bool),
    Pause,
    Orbit,
    Browser(&'static str),
}

pub fn page(props: PageProps) -> Element {
    let Payload::Configure { setup } = &props.initial else {
        return rsx! { p { role: "alert", "Volumen cognitivo no disponible." } };
    };
    let mut projection = use_signal(|| None::<Projection>);
    let mut inspector = use_signal(|| None);
    let mut view = use_signal(Controls::default);
    let mut history = use_signal(LearningHistory::default);
    let mut now = use_signal(|| 0_u64);
    let mut signals = use_signal(Signals::default);
    let mut zoom = use_signal(|| 100_u16);
    let mut canvas_error = use_signal(|| false);
    let callback = props.on_action.clone();
    let command = use_callback(move |command: Command| {
        let (inspect, focus) = match command {
            Command::Browser(action) => {
                if action == "attachCanvas" {
                    canvas_error.set(false);
                }
                emit(&callback, &json!({ "type": action }).to_string());
                return;
            }
            Command::Select(id, focus) => {
                let id = id.filter(|id| {
                    projection
                        .peek()
                        .as_ref()
                        .is_some_and(|data| data.nodes.iter().any(|node| &node.id == id))
                });
                if id != view.peek().selected {
                    view.write().selected = id;
                    inspector.set(None);
                }
                (true, focus)
            }
            Command::Pan(pan) => {
                view.write().pan = pan;
                (false, true)
            }
            Command::Demo(demo) => {
                view.write().demo = demo;
                (false, false)
            }
            Command::Pause => {
                let mut state = view.write();
                if !state.reduced {
                    state.paused = !state.paused;
                }
                (false, false)
            }
            Command::Orbit => {
                let mut state = view.write();
                if !state.reduced {
                    state.orbit = !state.orbit;
                }
                (false, false)
            }
        };
        publish_view(&callback, &view.peek(), inspect, focus);
    });
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let callback = callback.clone();
        async move {
            let mut connected = false;
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    match payload {
                        Payload::Configure { .. } if !connected => {
                            connected = true;
                            emit(&callback, r#"{"type":"connect"}"#);
                        }
                        Payload::Configure { .. } => {}
                        Payload::Projection {
                            projection: mut next,
                        } => {
                            now.set(next.timestamp.now_ms);
                            if let Some(checkpoint) = next.checkpoint.take() {
                                let arrivals = history.write().observe(checkpoint, &next.timestamp);
                                if !arrivals.is_empty() {
                                    let changes: Vec<_> = arrivals.iter().map(|item| json!({
                                        "id": item.id, "kind": item.kind, "observedAt": item.observed_at.now_ms,
                                    })).collect();
                                    emit(
                                        &callback,
                                        &json!({ "type": "arrivals", "changes": changes })
                                            .to_string(),
                                    );
                                }
                            }
                            let selected = view.peek().selected.clone();
                            if let Some(id) = selected {
                                if !next.nodes.iter().any(|node| node.id == id) {
                                    view.write().selected = None;
                                    inspector.set(None);
                                } else if next.selected.as_ref().is_some_and(|node| node.id == id) {
                                    inspector.set(next.selected.take());
                                }
                            }
                            projection.set(Some(*next));
                        }
                        Payload::Signals {
                            signals: next,
                            now_ms,
                            reduced,
                        } => {
                            now.set(now_ms);
                            signals.set(next);
                            if view.peek().reduced != reduced {
                                view.write().reduced = reduced;
                            }
                        }
                        Payload::Picked { id } => command.call(Command::Select(id, false)),
                        Payload::Inspector { id, detail } => {
                            if id == view.peek().selected {
                                inspector.set(detail.filter(|node| id.as_ref() == Some(&node.id)));
                            }
                        }
                        Payload::Zoom { percent } => zoom.set(percent),
                        Payload::CanvasError => canvas_error.set(true),
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });

    let data = projection.read();
    let Some(data) = data.as_ref() else {
        return rsx! { p { class: "neuro-footnote", role: "status", "Preparando la red de recuerdos…" } };
    };
    let state = view.read();
    let details = inspector.read();
    let learning = history.read();
    let (activity, activity_label) = data.frame.view.display();
    let is_ready = activity == "ready";
    let is_loading = activity == "loading";
    let provenance_class = if data.frame.audit == "degraded" {
        "degraded"
    } else {
        ""
    };
    let (graph_status, graph_status_label, graph_help) = data
        .graph_status
        .display(data.invalidated_count, data.totals.shared_origin);
    let selected = state.selected.as_deref().unwrap_or_default();
    let selection_class = if details.is_some() {
        "has-selection"
    } else {
        ""
    };
    let rail_class = if details.is_some() {
        "has-side-rail"
    } else {
        ""
    };
    let mode = if state.pan { "pan" } else { "rotate" };
    let signal_mode = if state.demo { "demo" } else { "recorded" };
    let has_graph = !data.nodes.is_empty();
    let has_visual = has_graph || state.demo;
    let (grid_class, scene_class, tab_index) = if has_visual {
        ("has-graph", "has-activity", "0")
    } else {
        ("is-empty", "is-empty", "-1")
    };
    let labels = if state.demo {
        ("Demostración ilustrativa del flujo entre entrada, memoria, modelo, contexto y salida. No representa actividad cerebral medida.", "ESQUEMA FUNCIONAL · CONTADORES REALES CONSERVADOS")
    } else {
        ("Red 3D inspirada en formas neuronales. Los nodos muestran recuerdos y procesos registrados; el contorno cerebral es ilustrativo.", "MALLA ILUSTRATIVA · NODOS DE DATOS REALES")
    };
    let totals = &data.totals;
    let associations = if totals.associations == 1 {
        "ASOCIACIÓN CONFIRMADA"
    } else {
        "ASOCIACIONES CONFIRMADAS"
    };
    let drag_help = if state.pan { "MOVER" } else { "GIRAR" };
    let canvas_unavailable = canvas_error();
    rsx! {
        section { class: "neuro-panel nucleus-page", "data-activity-state": activity, "aria-labelledby": "[01]-title",
            div { class: "neuro-heading nucleus-page-header is-{activity}", "data-activity-state": activity,
                div { p { class: "eyebrow", "[01] · ESTADO VERIFICABLE" } h2 { id: "[01]-title", "Volumen cognitivo" }
                    p { class: "nucleus-page-description", "Explora los recuerdos de Nyxia, la evidencia de actividad y el recorrido visual de las señales." } }
                span { class: "neuro-live {activity} is-{activity}", "data-activity-state": activity,
                    "data-signal-present": "{is_ready}", role: "status", "aria-live": "polite",
                    "aria-atomic": "true", "aria-busy": "{is_loading}",
                    i { "aria-hidden": "true" } "{activity_label}"
                }
            }
            div { class: "core-activity-provenance {data.frame.status} is-{activity} {provenance_class}",
                "data-activity-state": activity, "data-audit-state": "{data.frame.audit}", role: "status", "aria-live": "polite",
                "aria-atomic": "true", "aria-busy": "{is_loading}",
                strong { "R3 · ACTIVIDAD DERIVADA" }
                span { "{data.frame.summary}" }
                small { "HEURÍSTICA {data.frame.method} · NO ES EMOCIÓN NI CONCIENCIA" }
            }
            div { class: "nucleus-page-stage volume-page-stage",
                div { class: "volume-workbench volume-observatory {selection_class}",
                    header { class: "observatory-header",
                        div { span { "ALICE / SU CEREBRO LÓGICO" } h3 { "Una memoria que crece al aprender" }
                            p { if data.frame.status == "ready" { "Núcleo disponible · " } "Explora cómo se organiza su conocimiento y qué cambia con cada aprendizaje" } }
                        div { class: "observatory-counts",
                            span { b { "{totals.records}" } " registros" }
                            span { b { "{totals.processes}" } " procesos / núcleo" }
                            span { b { "{totals.associations}" } " asociaciones" }
                        }
                    }
                    {learning_summary(data, &learning)}
                    if let Some(learning) = &data.learning_activity { {learning_activity(learning, command)} }
                    div { class: "observatory-graph-state {graph_status}", role: "status", i {} "ASOCIACIONES · {graph_status_label}" }
                    if has_graph {
                        details { class: "observatory-search", summary { "Buscar un recuerdo o proceso" }
                            label { class: "observatory-select", "Explorar un nodo"
                                select { value: selected,
                                    onchange: move |event| { let id = event.value(); command.call(Command::Select((!id.is_empty()).then_some(id), false)); },
                                    option { value: "", "Seleccioná en la vista o aquí" }
                                    for node in &data.nodes { option { key: "{node.id}", value: "{node.id}", "{node.label}" } }
                                }
                            }
                        }
                    }
                    div { class: "volume-workbench-grid {rail_class} {grid_class}",
                        div { class: "neural-volume traceable-volume mode-{mode} {scene_class}", "data-signal-mode": signal_mode,
                            role: "group", "aria-label": "Volumen cognitivo tridimensional trazable de Nyxia",
                            div { class: "nucleus-panel-label", span { "3D" } strong { "RED DE RECUERDOS" } small { "ARRASTRA PARA EXPLORAR" } }
                            canvas { id: "{setup.canvas_id}", tabindex: tab_index, "aria-label": labels.0,
                                onmounted: move |_| command.call(Command::Browser("attachCanvas")),
                            }
                            if state.demo { div { class: "volume-demo-badge", role: "status", "DEMOSTRACIÓN · rutas ilustrativas, sin eventos nuevos" } }
                            LearningPulse { history, now }
                            if canvas_unavailable {
                                div { class: "volume-empty",
                                    strong { role: "alert", "VISTA 3D NO DISPONIBLE" }
                                    small { "Los recuerdos y procesos se pueden explorar con el selector." }
                                    button { r#type: "button", class: "console-button", onclick: move |_| command.call(Command::Browser("attachCanvas")), "Reintentar la vista 3D" }
                                }
                            } else if has_visual {
                                div { class: "neural-visual-caption", "{labels.1}" }
                            } else {
                                div { class: "volume-empty", span { "000" } strong { "SIN NODOS COGNITIVOS" }
                                    small { "No existen recuerdos persistentes ni procesos R3 recientes. El volumen no genera estructura de relleno." } }
                            }
                        }
                        if let Some(detail) = details.as_ref() { {inspector_panel(detail, &setup.legends.affects, data.dominant.as_ref(), command)} }
                    }
                    if has_visual {
                        {camera_controls(setup, &state, zoom(), canvas_unavailable, command)}
                        div { class: "volume-stats-strip",
                            span { class: "volume-stats-growth", "{totals.records} REGISTROS · {totals.retrieved} RECUPERADOS · {totals.processes} PROCESOS · {totals.associations} {associations}" }
                            div { class: "volume-stats-routes", "aria-label": "Evidencia del grafo",
                                span { class: "input", i {} "R3 " strong { "{data.frame.event_count}" } }
                                span { class: "memory", i {} "NODOS " strong { "{totals.records}" } }
                                span { class: "output", i {} "ARISTAS " strong { "{totals.edges}" } }
                            }
                            span { class: "volume-stats-help", "{graph_help}  ·  CLIC · INSPECCIONAR   RUEDA · ZOOM   ARRASTRAR · {drag_help}   DOBLE CLIC · RESTABLECER" }
                        }
                        {color_guide(&setup.legends)}
                    }
                    SignalPanel { signals, now, demos: setup.demos.clone(), demo: state.demo, paused: state.paused, reduced: state.reduced, command }
                }
            }
            p { class: "neuro-footnote", "Los nodos permiten inspeccionar recuerdos y procesos registrados. Verde: origen compartido; violeta: asociación confirmada; ámbar: demostración explícita. El contorno cerebral es ilustrativo y no mide neuronas, emociones ni conciencia." }
        }
    }
}

#[component]
fn LearningPulse(history: Signal<LearningHistory>, now: Signal<u64>) -> Element {
    let history = history.read();
    let Some(change) = history.pulse(now()) else {
        return rsx! {};
    };
    rsx! {
        div { class: "volume-learning-burst", role: "status",
            strong { if change.kind == crate::volume_page_model::ChangeKind::Added { "Nuevo registro incorporado" } else { "Registro actualizado" } }
            span { "{change.label}" }
        }
    }
}

#[component]
fn SignalPanel(
    signals: Signal<Signals>,
    now: Signal<u64>,
    demos: Vec<crate::volume_page_model::NodeLabel>,
    demo: bool,
    paused: bool,
    reduced: bool,
    command: EventHandler<Command>,
) -> Element {
    signal_console(
        &signals.read(),
        &demos,
        demo,
        paused,
        reduced,
        now(),
        command,
    )
}

fn camera_icon(svg: &str) -> Element {
    // The host only sends icons compiled from Frontend/icons.
    rsx! { span { class: "camera-control-icon", "aria-hidden": "true", dangerous_inner_html: svg } }
}

fn camera_controls(
    setup: &Setup,
    view: &Controls,
    zoom: u16,
    unavailable: bool,
    command: EventHandler<Command>,
) -> Element {
    let orbit = if view.reduced {
        "movimiento reducido"
    } else if !view.orbit {
        "pausada"
    } else if view.paused {
        "activada · animación pausada"
    } else {
        "activada"
    };
    rsx! {
        div { class: "volume-control-dock",
            div { class: "volume-camera-controls", "aria-label": "Controles de cámara del volumen cognitivo",
                div { class: "volume-camera-modes", role: "group", "aria-label": "Modo de arrastre",
                    button { r#type: "button", title: "Girar al arrastrar", disabled: unavailable,
                        class: if view.pan { "" } else { "selected" }, "aria-pressed": "{!view.pan}",
                        onclick: move |_| command.call(Command::Pan(false)), {camera_icon(&setup.icons.orbit)} span { "Girar" } }
                    button { r#type: "button", title: "Mover al arrastrar", disabled: unavailable,
                        class: if view.pan { "selected" } else { "" }, "aria-pressed": "{view.pan}",
                        onclick: move |_| command.call(Command::Pan(true)), {camera_icon(&setup.icons.pan)} span { "Mover" } }
                }
                div { class: "volume-camera-actions", role: "group", "aria-label": "Zoom y restablecimiento",
                    button { r#type: "button", title: "Alejar", "aria-label": "Alejar volumen", disabled: unavailable,
                        onclick: move |_| command.call(Command::Browser("zoomOut")), {camera_icon(&setup.icons.zoom_out)} }
                    output { "aria-label": "Zoom {zoom} por ciento", "{zoom}%" }
                    button { r#type: "button", title: "Acercar", "aria-label": "Acercar volumen", disabled: unavailable,
                        onclick: move |_| command.call(Command::Browser("zoomIn")), {camera_icon(&setup.icons.zoom_in)} }
                    button { r#type: "button", title: "Restablecer vista", "aria-label": "Restablecer vista", disabled: unavailable,
                        onclick: move |_| command.call(Command::Browser("reset")), {camera_icon(&setup.icons.reset)} }
                }
            }
            button { class: "observatory-orbit", r#type: "button", "aria-pressed": "{view.orbit}",
                disabled: view.reduced || unavailable, onclick: move |_| command.call(Command::Orbit), "Órbita automática: {orbit}" }
        }
    }
}
