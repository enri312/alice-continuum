use crate::activity_ui::ActivityIntro;
use crate::flow_model::{curve, Payload, CONNECTIONS};
use crate::model::ActivityStatus;
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use std::{cell::RefCell, rc::Rc};

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
pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
    let mut selected = use_signal(|| props.initial.selected_id.clone());
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
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&wasm_bindgen::JsValue::NULL);
    });
    let mut view = payload.read().clone();
    view.selected_id = selected.read().clone();
    rsx! { Graph { payload: view, on_select: move |id: String| {
        if payload.read().nodes.iter().any(|node| node.id == id) {
            selected.set(id.clone());
            let _ = props.on_action.call1(&wasm_bindgen::JsValue::NULL, &wasm_bindgen::JsValue::from_str(&serde_json::json!({"type":"select","id":id}).to_string()));
        }
    } } }
}

#[component]
pub fn Graph(payload: Payload, on_select: EventHandler<String>) -> Element {
    let snap = &payload;
    let selected_id = snap.selected_id.clone();
    let inspector = snap.selected(&selected_id);
    let active_routes = CONNECTIONS
        .iter()
        .filter(|(_, _, evidence)| snap.signal(*evidence) > 0.0)
        .count();
    let summary = match snap.activity.status {
        ActivityStatus::Loading => "Leyendo auditoría…".into(),
        ActivityStatus::Unavailable => "Lectura no disponible".into(),
        ActivityStatus::Ready if active_routes == 1 => "1 ruta con señal".into(),
        ActivityStatus::Ready => format!("{active_routes} rutas con señal"),
    };
    rsx! {
        ActivityIntro { activity: snap.activity.clone(), code: "[02]", title: "Flujo cognitivo", description: "Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida." }
        div { class: "neuro-layout",
        div { class: "neuro-stage", div { class: "cognitive-flow",
            header { class: "flow-heading", h3 { "Rutas del espacio de trabajo" } span { "{summary}" } }
            div { class: "flow-viewport", role: "region", tabindex: "0", "aria-label": "Mapa de conexiones",
            svg { view_box:"0 0 1000 430", role:"group", "aria-label":"Flujo funcional verificable de Nyxia",
                g { class:"flow-connections",
                    for (from_id,to_id,evidence) in CONNECTIONS {
                        if let (Some(from),Some(to))=(snap.nodes.iter().find(|n|n.id==from_id),snap.nodes.iter().find(|n|n.id==to_id)) {
                            {
                                let signal = snap.signal(evidence);
                                rsx! { path { key:"{from_id}-{to_id}", d:curve(from,to),
                                    "data-route": if signal > 0.0 { "signal" } else if evidence.is_some() { "idle" } else { "planned" },
                                    style:format!("--signal: {signal}") } }
                            }
                        }
                    }
                }
                g { class:"flow-nodes",
                    for node in &snap.nodes {
                        g { key:"{node.id}", class:format!("flow-node {} {} {}",node.group,node.availability,if inspector.id==node.id {"selected"} else {""}),
                            style:format!("--signal: {}",node.activation), transform:format!("translate({} {})",node.x*10.0,node.y*4.3), role:"button", tabindex:"0", "aria-pressed": inspector.id == node.id,
                            "aria-label":format!("{}: {}, activación {:.3}",node.label,node.value,node.activation),
                            onclick:{ let id=node.id.clone(); move |_| on_select.call(id.clone()) },
                            onkeydown:{ let id=node.id.clone(); move |event: KeyboardEvent| { if event.key()==Key::Enter || event.key()==Key::Character(" ".into()) { event.prevent_default(); on_select.call(id.clone()); } } },
                            circle { class:"flow-node-halo", r:"28" } circle { class:"flow-node-core", r:"11" }
                            text { class:"flow-score", y:"-23", text_anchor:"middle", {format!("{:.3}",node.activation)} }
                            text { class:"flow-label", y:"35", text_anchor:"middle", {node.label.to_uppercase()} }
                            if node.availability=="planned" { text { class:"flow-planned", y:"49", text_anchor:"middle", "NO IMPLEMENTADO" } }
                        }
                    }
                }
            }
            }
            div { class:"flow-legend", span { class:"ready", "Señal reciente" } span { "Sin señal" } span { class:"planned", "Ruta prevista" } }
        } }
        aside { class:"neuro-inspector", p { class:"eyebrow", "INSPECTOR" } h3 {"{inspector.label}"} span { class:"inspector-value", "{inspector.value}" } p {"{inspector.detail}"} small {"La activación es una señal técnica derivada, no una experiencia interna."} }
    } }
}
