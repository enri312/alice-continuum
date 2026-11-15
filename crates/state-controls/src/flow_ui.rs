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
    let snap = payload.read();
    let selected_id = selected.read().clone();
    let inspector = snap.selected(&selected_id);
    let activity_class = if snap.has_activity {
        "has-activity"
    } else {
        "is-empty"
    };
    let signal_label = if snap.activity.window_event_count > 0 {
        "SEÑAL R3 DERIVADA"
    } else {
        "SIN EVENTOS R3 RECIENTES"
    };
    let summary = if snap.activity.status == ActivityStatus::Ready {
        format!(
            "{} eventos · heurística {}",
            snap.activity.window_event_count,
            snap.activity.method.as_deref().unwrap_or("")
        )
    } else {
        "snapshot no disponible".into()
    };
    rsx! {
        ActivityIntro { activity: snap.activity.clone(), code: "[02]", title: "Flujo cognitivo", description: "Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida." }
        div { class: "neuro-layout",
        div { class: "neuro-stage", div { class: "cognitive-flow {activity_class}",
            div { class:"nucleus-panel-label", span {"[02]"} strong {"COGNITIVE GRAPH / GLOBAL WORKSPACE"} small {"FUNCTIONAL FLOW"} }
            div { class:"flow-state", span {"{signal_label}"} strong {"{summary}"} }
            svg { view_box:"0 0 1000 430", role:"img", "aria-label":"Flujo funcional verificable de Alice",
                g { class:"flow-connections",
                    for (from_id,to_id,evidence) in CONNECTIONS {
                        if let (Some(from),Some(to))=(snap.nodes.iter().find(|n|n.id==from_id),snap.nodes.iter().find(|n|n.id==to_id)) {
                            path { key:"{from_id}-{to_id}", d:curve(from,to), style:format!("--signal: {}",snap.signal(evidence)) }
                        }
                    }
                }
                g { class:"flow-nodes",
                    for node in &snap.nodes {
                        g { key:"{node.id}", class:format!("flow-node {} {} {}",node.group,node.availability,if inspector.id==node.id {"selected"} else {""}),
                            style:format!("--signal: {}",node.activation), transform:format!("translate({} {})",node.x*10.0,node.y*4.3), role:"button", tabindex:"0",
                            "aria-label":format!("{}: {}, activación {:.3}",node.label,node.value,node.activation),
                            onclick:{ let id=node.id.clone(); let callback=props.on_action.clone(); move |_| { selected.set(id.clone()); let _=callback.call1(&wasm_bindgen::JsValue::NULL,&wasm_bindgen::JsValue::from_str(&serde_json::json!({"type":"select","id":id}).to_string())); } },
                            onkeydown:{ let id=node.id.clone(); let callback=props.on_action.clone(); move |event: KeyboardEvent| { if event.key()==Key::Enter || event.key()==Key::Character(" ".into()) { event.prevent_default(); selected.set(id.clone()); let _=callback.call1(&wasm_bindgen::JsValue::NULL,&wasm_bindgen::JsValue::from_str(&serde_json::json!({"type":"select","id":id}).to_string())); } } },
                            circle { class:"flow-node-halo", r:"28" } circle { class:"flow-node-core", r:"11" }
                            text { class:"flow-score", y:"-23", text_anchor:"middle", {format!("{:.3}",node.activation)} }
                            text { class:"flow-label", y:"35", text_anchor:"middle", {node.label.to_uppercase()} }
                            if node.availability=="planned" { text { class:"flow-planned", y:"49", text_anchor:"middle", "NO IMPLEMENTADO" } }
                        }
                    }
                }
            }
            div { class:"flow-legend", span { class:"ready", "evidencia R3" } span { class:"planned", "fase futura" } span {"valor = intensidad heurística"} }
        } }
        aside { class:"neuro-inspector", p { class:"eyebrow", "INSPECTOR" } h3 {"{inspector.label}"} span { class:"inspector-value", "{inspector.value}" } p {"{inspector.detail}"} small {"La activación es una señal técnica derivada, no una experiencia interna."} }
    } }
}
