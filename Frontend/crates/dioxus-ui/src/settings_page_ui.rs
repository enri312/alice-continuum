use crate::settings_page_model::{Payload, Runtime, RuntimeOperation};
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::{json, Value};
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

pub fn page(props: PageProps) -> Element {
    let Payload::Configure { settings } = &props.initial else {
        return rsx! { p { role: "alert", "Configuración no disponible." } };
    };
    let mut settings = use_signal(|| settings.clone());
    let mut runtime = use_signal(Runtime::default);
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
                        Payload::Configure { settings: next } => {
                            settings.set(next);
                            // The first update acknowledges that the host can accept actions.
                            if !connected {
                                connected = true;
                                let _ = callback.call1(
                                    &JsValue::NULL,
                                    &JsValue::from_str(r#"{"type":"connect"}"#),
                                );
                            }
                        }
                        Payload::Runtime { runtime: next } => runtime.set(next),
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let dispatch = use_callback(move |action: Value| {
        let _ = props
            .on_action
            .call1(&JsValue::NULL, &JsValue::from_str(&action.to_string()));
    });
    let settings = settings.read();
    let runtime = runtime.read();
    let count = settings
        .providers
        .iter()
        .filter(|item| item.configured)
        .count();
    let status = match count {
        0 => "SIN PROVEEDOR LISTO".to_string(),
        1 => "1 PROVEEDOR LISTO".to_string(),
        _ => format!("{count} PROVEEDORES LISTOS"),
    };
    let selected = settings
        .providers
        .iter()
        .find(|option| option.id == settings.provider);
    let placeholder = selected
        .map(|option| option.default_model.as_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("Identificador del modelo");
    let policy = selected
        .map(|option| option.retention_mode.as_str())
        .unwrap_or("Seleccioná un proveedor para consultar su política.");
    let engine_state = if runtime.running {
        "INICIADO"
    } else {
        "APAGADO O SIN VERIFICAR"
    };
    rsx! {
        section { class: "settings-page", "aria-labelledby": "settings-title",
            header { class: "settings-heading",
                div { p { class: "eyebrow", "CONFIGURACIÓN LOCAL · SISTEMA" } h2 { id: "settings-title", "Configuración de Alice" }
                    p { "Las decisiones técnicas permanecen aquí para que Conversación se concentre únicamente en hablar, revisar permisos y enviar." } }
                div { class: if count > 0 { "cloud-status ready" } else { "cloud-status offline" }, i {} "{status}" }
            }
            div { class: "settings-grid",
                section { class: "settings-card", "aria-labelledby": "conversation-display-title",
                    header { div { p { class: "eyebrow", "CONVERSACIÓN" } h3 { id: "conversation-display-title", "Historial visible" } } }
                    label { class: "context-toggle",
                        input { r#type: "checkbox", checked: settings.show_full_history,
                            onchange: move |event| dispatch.call(json!({"type":"history","enabled":event.checked()})) }
                        span { strong { "Mostrar todo el historial en el chat" } small { "Desactivado: sólo los últimos 12 mensajes. Cambia la vista, no borra conversaciones ni modifica el contexto autorizado o los recuerdos. Se aplica durante esta sesión de la aplicación." } }
                    }
                }
                section { class: "settings-card inference-settings", "aria-labelledby": "inference-settings-title",
                    header { span { "01" } div { p { class: "eyebrow", "RUTA DE INFERENCIA" } h3 { id: "inference-settings-title", "Proveedor y modelo" } } }
                    p { "Elegí explícitamente la ruta local. OpenRouter permanece pausado. Iniciar Gemma también lo selecciona; cambiar una tarjeta de proveedor no inicia ni apaga modelos." }
                    div { class: "settings-policy settings-runtime",
                        strong { "GEMMA LOCAL · {engine_state}" }
                        p { "Un solo motor. Si Ollama conserva un modelo cargado, el inicio se rechazará; no se cerrará una sesión ajena. La conversación, transcripción y memoria automática usan Gemma. Los adaptadores antiguos que requieren Ollama quedan bloqueados mientras Gemma está activo." }
                        div { class: "settings-runtime-actions",
                            button { class: "runtime-start", r#type: "button", disabled: !runtime.can_start(settings.desktop_app),
                                onclick: move |_| dispatch.call(json!({"type":"runtime","operation":"start"})), "Iniciar Gemma local" }
                            button { class: "runtime-stop", r#type: "button", disabled: !runtime.can_stop(settings.desktop_app),
                                onclick: move |_| dispatch.call(json!({"type":"runtime","operation":"stop"})),
                                if runtime.pending == Some(RuntimeOperation::Start) { "Cancelar inicio / apagar" } else { "Apagar Gemma" }
                            }
                        }
                        p { role: "status", "aria-live": "polite", "{runtime.message}" }
                    }
                    div { class: "settings-provider-list", role: "radiogroup", "aria-label": "Proveedor predeterminado",
                        for option in &settings.providers {
                            {
                                let id = option.id.clone();
                                let selected = id == settings.provider;
                                let gemma = id == "llamacpp";
                                let status = if gemma { "INICIO MANUAL" } else if option.configured { "LISTO" }
                                    else if id == "ollama" { "NO INICIADO" } else { "SIN CLAVE" };
                                rsx! {
                                    button { key: "{option.id}", r#type: "button", role: "radio", "aria-checked": selected,
                                        disabled: runtime.running && !gemma, class: if selected { "selected" } else { "" },
                                        onclick: move |_| dispatch.call(json!({"type":"provider","id":id})),
                                        span { strong { "{option.label}" } small { "{option.protocol}" } }
                                        em { class: if option.configured { "ready" } else { "offline" }, "{status}" }
                                    }
                                }
                            }
                        }
                    }
                    label { class: "settings-model-field", "MODELO PREDETERMINADO"
                        input { value: "{settings.model}", readonly: settings.provider == "llamacpp", placeholder: "{placeholder}",
                            oninput: move |event| dispatch.call(json!({"type":"model","model":event.value()})) }
                    }
                    div { class: "settings-policy", strong { "POLÍTICA DEL ADAPTADOR" } span { "{policy}" } }
                    small { class: "settings-security-note", "Las claves API no se muestran ni se escriben aquí. Ollama no usa clave y su adaptador sólo acepta el servidor local fijado a 127.0.0.1." }
                }
                section { class: "settings-card", "aria-labelledby": "privacy-settings-title",
                    header { span { "02" } div { p { class: "eyebrow", "PRIVACIDAD Y EJECUCIÓN" } h3 { id: "privacy-settings-title", "Estado local" } } }
                    dl {
                        div { dt { "Aplicación" } dd { if settings.desktop_app { "ESCRITORIO NATIVO" } else { "NAVEGADOR DE DESARROLLO" } } }
                        div { dt { "Revisión antes de enviar" } dd { "OBLIGATORIA" } }
                        div { dt { "Memoria" } dd { "LOCAL Y EDITABLE" } }
                        div { dt { "Herramientas remotas" } dd { "DESACTIVADAS" } }
                    }
                }
                section { class: "settings-card", "aria-labelledby": "hardware-settings-title",
                    header { span { "03" } div { p { class: "eyebrow", "CUERPO Y ROSTRO" } h3 { id: "hardware-settings-title", "Dispositivos externos" } } }
                    div { class: "settings-device", i {} div { strong { "SIN DISPOSITIVO CONFIGURADO" } small { "Las salidas físicas del cuerpo y el rostro están desactivadas." } } }
                    p { "Los visores y controladores VR se incorporarán mediante adaptadores independientes cuando exista el hardware. La lógica cognitiva no dependerá de una marca concreta." }
                }
            }
        }
    }
}
