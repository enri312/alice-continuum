use crate::conversation_tools_model::{DocumentView, VisionView};
use dioxus::prelude::*;
use serde_json::{json, Value};

#[component]
pub fn VisionPanel(view: VisionView, on_action: EventHandler<Value>) -> Element {
    let active = view.camera || view.desktop;
    let status = if view.busy {
        "Preparando vista…"
    } else if active {
        "Vista activa · Gemma local"
    } else {
        "Vista de Alice"
    };
    let description = if !active {
        "Activa una vista para hablar de lo que tienes delante o de tu pantalla.".to_owned()
    } else if view.last_frame.is_empty() {
        "Imagen nueva al responder por voz o texto. Pregúntame qué veo.".to_owned()
    } else {
        format!(
            "Imagen nueva al responder por voz o texto. Último turno visual: {}.",
            view.last_frame
        )
    };
    let desktop_image = view.preview.starts_with("data:image/png;base64,");
    rsx! {
        section {
            class: if active { "conversation-vision active" } else { "conversation-vision" },
            aria_label: "Vista de Alice",
            div { class: "vision-toolbar",
                span { class: "vision-status", i {} "{status}" }
                button { r#type: "button", aria_pressed: view.camera, disabled: !view.available || view.busy,
                    onclick: move |_| on_action.call(json!({"type":"visionCamera"})),
                    if view.camera { "Apagar cámara" } else { "Activar cámara" }
                }
                button { r#type: "button", aria_pressed: view.desktop, disabled: !view.available || view.busy,
                    onclick: move |_| on_action.call(json!({"type":"visionDesktop"})),
                    if view.desktop { "Dejar de compartir" } else { "Compartir escritorio" }
                }
                if active || view.busy {
                    button { r#type: "button", class: "vision-stop",
                        onclick: move |_| on_action.call(json!({"type":"visionStop"})), "Detener vistas" }
                }
                if active {
                    button { r#type: "button", aria_expanded: view.expanded,
                        onclick: move |_| on_action.call(json!({"type":"visionExpand"})),
                        if view.expanded { "Ocultar vistas" } else { "Ver vistas" }
                    }
                }
            }
            if view.camera {
                label { class: "vision-device", "Cámara "
                    select { aria_label: "Cámara para Alice", value: "{view.device_id}", disabled: view.busy,
                        onchange: move |event| on_action.call(json!({"type":"visionDevice","value":event.value()})),
                        for device in view.devices.iter() {
                            option { key: "{device.id}", value: "{device.id}", selected: device.id == view.device_id, "{device.label}" }
                        }
                    }
                }
            }
            p { "{description}" }
            if active {
                div { class: "vision-previews", hidden: !view.expanded,
                    if view.camera {
                        figure {
                            video { autoplay: true, muted: true, playsinline: true,
                                onmounted: move |_| on_action.call(json!({"type":"visionVideoReady"})) }
                            figcaption { "Cámara · vista en directo" }
                        }
                    }
                    if view.desktop {
                        figure {
                            if desktop_image {
                                img { src: "{view.preview}", alt: "Vista inicial del escritorio compartido" }
                            }
                            figcaption { "Escritorio · vista inicial de la sesión" }
                        }
                    }
                }
            }
            if view.expanded && active {
                small { "Las imágenes se procesan en este equipo. El chat conserva las respuestas. Al compartir el escritorio se incluyen todos los monitores visibles." }
            }
            if !view.error.is_empty() {
                p { role: "alert", class: "vision-error", "{view.error}" }
            }
        }
    }
}

#[component]
pub fn DocumentPanel(view: DocumentView, on_action: EventHandler<Value>) -> Element {
    rsx! {
        section { class: "perception-vector document-preview", aria_labelledby: "document-preview-title",
            header { h3 { id: "document-preview-title", "DOCUMENTO LOCAL · VISTA PREVIA" } }
            p { "Seleccioná un documento y autorizá su lectura. La vista previa muestra el texto localmente, por separado del chat y la memoria." }
            input { r#type: "file", accept: ".pdf,.md,.txt", disabled: view.busy,
                aria_label: "Seleccionar documento local",
                onchange: move |_| on_action.call(json!({"type":"documentSelect"})) }
            button { r#type: "button", disabled: !view.has_file || view.busy,
                onclick: move |_| on_action.call(json!({"type":"documentRead"})),
                if view.busy { "Leyendo…" } else { "Autorizar lectura y ver texto" }
            }
            button { r#type: "button", disabled: view.busy || (!view.has_file && view.preview.is_none()),
                onclick: move |_| on_action.call(json!({"type":"documentDiscard"})), "Descartar vista previa" }
            if !view.error.is_empty() {
                p { role: "alert", "{view.error}" }
            }
            if let Some(preview) = view.preview.as_ref() {
                div { aria_live: "polite",
                    p {
                        "{preview.total_pages} "
                        if preview.total_pages == 1 { "página" } else { "páginas" }
                        " · {preview.chunks.len()} fragmentos · lectura local"
                    }
                    if preview.status == "noText" {
                        p { "El documento carece de texto extraíble. La vista previa admite PDF con capa de texto." }
                    }
                    small { "SHA-256: {preview.source_sha256}" }
                    div { style: "max-height:24rem;overflow:auto;overflow-wrap:anywhere",
                        for (index, part) in preview.chunks.iter().enumerate() {
                            details { key: "{index}",
                                summary { "Página {part.page} · fragmento {index + 1} · caracteres {part.start_char}–{part.end_char}" }
                                pre { style: "white-space:pre-wrap", "{part.text}" }
                            }
                        }
                    }
                }
            }
        }
    }
}
