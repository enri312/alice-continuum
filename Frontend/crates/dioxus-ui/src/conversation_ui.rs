use crate::conversation_model::{LearningCandidate, Payload, Review};
use crate::conversation_tools_ui::{DocumentPanel, VisionPanel};
use crate::conversation_voice_ui::{InputDiagnostics, VoiceControls, VoiceOutput};
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};

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

fn focus_review() {
    let element = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.get_element_by_id("alice-send-review"));
    if let Some(element) = element {
        element.scroll_into_view();
        if let Ok(focus) = js_sys::Reflect::get(element.as_ref(), &JsValue::from_str("focus")) {
            if let Some(function) = focus.dyn_ref::<js_sys::Function>() {
                let _ = function.call0(element.as_ref());
            }
        }
    }
}

pub fn page(props: PageProps) -> Element {
    let mut payload = use_signal(|| props.initial.clone());
    let receiver = props.rx.clone();
    use_future(move || {
        let receiver = receiver.borrow_mut().take();
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
        let _ = ready.call0(&JsValue::NULL);
    });
    let mut previous_messages = use_signal(|| {
        props
            .initial
            .messages
            .last()
            .map(|message| message.id.clone())
    });
    use_effect(move || {
        let last = payload
            .read()
            .messages
            .last()
            .map(|message| message.id.clone());
        if last == *previous_messages.peek() {
            return;
        }
        previous_messages.set(last);
        if let Some(stream) = web_sys::window()
            .and_then(|window| window.document())
            .and_then(|document| document.get_element_by_id("alice-message-stream"))
        {
            stream.set_scroll_top(stream.scroll_height());
        }
    });

    let action = props.on_action.clone();
    let dispatch = EventHandler::new(move |value: Value| {
        let _ = action.call1(&JsValue::NULL, &JsValue::from_str(&value.to_string()));
    });
    let voice_dispatch =
        EventHandler::new(move |action| dispatch.call(json!({"type":"voice","action":action})));
    let view = payload.read();
    let draft_present = !view.draft.trim().is_empty();
    let writing_disabled = view.sending || view.voice_busy;
    let status_class = format!("conversation-status is-{}", view.status_tone);
    let status_provider = if view.configured_provider.is_empty() {
        "Selecciona un modelo en Configuración"
    } else {
        &view.configured_provider
    };
    rsx! {
        section { class: "conversation-home", "aria-labelledby": "conversation-home-title",
            header { class: "conversation-home-heading",
                div { h2 { id: "conversation-home-title", "Conversación con Nyxia" } p { "Escribe o habla. Este es tu espacio para conversar." } }
                span { class: "conversation-home-label", "TEXTO Y VOZ" }
            }
            div { class: "conversation-home-main",
                section { class: "conversation-page embedded", "aria-label": "Conversación real con Nyxia",
                    div { class: status_class, role: "status", "aria-live": "polite",
                        i { "aria-hidden": "true" } strong { "{view.status_label}" } span { "{status_provider}" }
                    }
                    VisionPanel { view: view.vision.clone(), on_action: dispatch }
                    div { class: "conversation-layout conversation-layout-focused",
                        div { class: "chat-column",
                            div { id: "alice-message-stream", class: if view.messages.is_empty() { "message-stream is-empty" } else { "message-stream has-messages" }, "aria-live": "polite",
                                if view.messages.is_empty() {
                                    div { class: "chat-empty", span { "A" } h3 { "Estoy lista para conversar." } p { "Puedes escribir una pregunta o comenzar un turno de voz." } }
                                }
                                for message in &view.messages {
                                    article { key: "{message.id}", class: "chat-message {message.role}",
                                        div { class: "message-author",
                                            if message.role == "user" { "CARLOS NUÑEZ" } else { "ALICE" }
                                            small { "{message.time}" }
                                        }
                                        p { "{message.text}" }
                                        if let Some(model) = &message.model { span { class: "message-model", "{model}" } }
                                        if let Some(exchange_id) = &message.exchange_id {
                                            {
                                                let voice_id = exchange_id.clone();
                                                let learning_id = exchange_id.clone();
                                                rsx! {
                                                    div { class: "conversation-message-actions",
                                                        div { class: "conversation-voice-trigger",
                                                            button { r#type: "button", class: "secondary", disabled: !view.desktop_app || writing_disabled || view.voice_pending.is_some(),
                                                                onclick: move |_| voice_dispatch.call(json!({"type":"preview","exchangeId":voice_id})),
                                                                if view.voice_pending.as_deref() == Some("preview") { "Preparando voz…" } else { "Escuchar con la voz de Nyxia" }
                                                            }
                                                            small { "Manual · revisás el texto antes de enviar una copia a Fish Audio." }
                                                        }
                                                        div { class: "conversation-learning-trigger",
                                                            button { r#type: "button", class: "secondary", disabled: !view.can_learn || view.learning_pending.is_some(),
                                                                onclick: move |_| dispatch.call(json!({"type":"propose","value":learning_id})),
                                                                if view.learning_pending.as_ref() == Some(exchange_id) { "Revisando tu mensaje…" } else { "Proponer recuerdo de este intercambio" }
                                                            }
                                                            small { "Manual · sólo analiza tu mensaje, nunca esta respuesta." }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            VoiceOutput { view: view.voice.clone(), on_action: voice_dispatch }
                            {learning(&view, dispatch)}
                            {feedback(&view, dispatch)}
                            if !view.error.is_empty() && view.review.is_none() { p { class: "cloud-error", role: "alert", "{view.error}" } }
                            div { class: "composer",
                                if let Some(label) = &view.automatic_label {
                                    div { class: "conversation-learning-status", span { i {} "{label}" }
                                        button { r#type: "button", onclick: move |_| dispatch.call(json!({"type":"openMemory"})), "Ver memoria" }
                                    }
                                }
                                label { r#for: "alice-message", "Tu mensaje" }
                                VoiceControls { view: view.voice.clone(), on_action: voice_dispatch }
                                textarea {
                                    id: "alice-message",
                                    disabled: writing_disabled,
                                    value: "{view.draft}",
                                    oninput: move |event| dispatch.call(json!({"type":"draft","value":event.value()})),
                                    placeholder: "Preguntá, explicá una idea o pedí ayuda…"
                                }
                                div { class: "composer-footer",
                                    span {
                                        if view.local_inference { "Revisa el contexto del mensaje. Las vistas activas toman una imagen al procesarlo." }
                                        else { "Primero verás exactamente qué datos saldrán de tu PC." }
                                    }
                                    button { r#type: "button", class: "primary", disabled: !view.can_review,
                                        title: "Abre la previsualización de privacidad; todavía no procesa el mensaje",
                                        onclick: move |_| dispatch.call(json!({"type":"review"})),
                                        if view.local_inference { "Revisar mensaje " } else { "Ver qué se enviará " }
                                        span { "→" }
                                    }
                                }
                            }
                        }
                        {context(&view, draft_present, dispatch)}
                    }
                    if let Some(review) = &view.review {
                        {review_panel(&view, review, dispatch)}
                    }
                }
            }
            div { class: "conversation-secondary-tools", "aria-label": "Herramientas complementarias",
                details { class: "conversation-secondary-panel",
                    summary { "Diagnóstico de entrada" span { "Ver cómo se analiza el mensaje" } }
                    InputDiagnostics { view: view.identification.clone(), on_action: dispatch }
                }
                details { class: "conversation-secondary-panel",
                    summary { "Documentos locales" span { "Abrir una vista previa independiente del chat" } }
                    DocumentPanel { view: view.document.clone(), on_action: dispatch }
                }
            }
        }
    }
}

fn context(view: &Payload, has_draft: bool, dispatch: EventHandler<Value>) -> Element {
    let local = view.local_inference;
    let history_available = view.history_available;
    let history_class = if history_available {
        "context-toggle available"
    } else {
        "context-toggle waiting"
    };
    let memory_class = if has_draft {
        "context-toggle available"
    } else {
        "context-toggle waiting"
    };
    let includes_window =
        view.include_window && view.observation_enabled && view.window_process.is_some();
    rsx! {
        details { class: "conversation-context-drawer",
            summary { "Contexto y permisos "
                span {
                    if view.include_history { "Historial activo" } else { "Sin historial" }
                    " · "
                    if view.include_memory { "Recuerdos activos" } else { "Sin recuerdos" }
                    " · "
                    if includes_window { "Ventana incluida" } else { "Sin ventana" }
                }
            }
            aside { class: "cloud-control",
                p { class: "eyebrow", "CONTROL DE CONTEXTO" }
                h3 { if local { "Qué puede procesar" } else { "Qué puede salir" } }
                if view.delegated_actions {
                    p { class: "conversation-delegated-actions",
                        "Acciones autorizadas: Spotify · Tus me gusta · playlist configurada en Windows · YouTube en Chrome · discos D: y E: en Windows. Pide «abre Spotify y reproduce la playlist [nombre]», «pausa Spotify» o «reproduce [canción] en YouTube»."
                    }
                }
                div { class: "context-section-label", strong { if local { "CONTEXTO LOCAL AUTORIZADO" } else { "SALIDA A LA NUBE" } } span { "FUENTES SELECCIONADAS · DATOS REALES" } }
                label { class: history_class,
                    input { r#type: "checkbox", disabled: view.voice_busy || view.sending, checked: view.include_history,
                        onchange: move |event| dispatch.call(json!({"type":"history","included":event.checked()})) }
                    span { strong { "Historial reciente" }
                        small {
                            if history_available { "{view.history_count} mensajes tuyos disponibles · respuestas previas de Nyxia no se reutilizan como hechos" }
                            else { "seleccionado · todavía no hay mensajes guardados" }
                        }
                    }
                }
                label { class: memory_class,
                    input { r#type: "checkbox", disabled: view.voice_busy || view.sending, checked: view.include_memory,
                        onchange: move |event| dispatch.call(json!({"type":"memory","included":event.checked()})) }
                    span { strong { if local { "RAG local de recuerdos" } else { "Recuerdos relevantes" } }
                        small {
                            if has_draft { "{view.memory_matches.len()} coincidencias de {view.memory_count} recuerdos · {view.dormant_count} en reposo · {view.suppressed_count} suprimidos" }
                            else { "seleccionado · espera un mensaje para buscar" }
                        }
                    }
                }
                if has_draft && !view.memory_matches.is_empty() && !view.include_memory {
                    p { class: "memory-authorization-warning", role: "status",
                        "Nyxia encontró {view.memory_matches.len()} recuerdos, pero quedan fuera del contexto mientras esta casilla siga desmarcada."
                    }
                }
                if has_draft {
                    div { class: if view.hybrid_active { "memory-retrieval-preview hybrid" } else { "memory-retrieval-preview" }, "aria-live": "polite",
                        div { strong { "RECUPERACIÓN LOCAL" }
                            span { if view.hybrid_active { "GEMMA · TOP 3 · REVISABLE" } else { "LEXICAL · MÁX. 3 · REPOSO Y SUPRESIÓN EXCLUIDOS" } }
                        }
                        if view.memory_matches.is_empty() {
                            p { class: "retrieval-empty", "No hay recuerdos accesibles relacionados. No se adjuntará memoria." }
                        }
                        for (index, matched) in view.memory_matches.iter().enumerate() {
                            article { key: "{index}", header { strong { "{matched.title}" } span { "{matched.rank}" } } p { "{matched.reason}" } }
                        }
                        if view.hybrid_count >= 3 {
                            footer { class: "hybrid-retrieval-control",
                                button { r#type: "button", class: "hybrid-retrieval-action", disabled: view.hybrid_pending || view.sending,
                                    onclick: move |_| dispatch.call(json!({"type":"hybrid"})),
                                    if view.hybrid_pending { "Gemma está revisando…" } else if view.hybrid_active { "Revisar otra vez con Gemma" } else { "Ampliar con Gemma" }
                                }
                                small { "Acción manual · compara hasta {view.hybrid_count} recuerdos · no guarda ni confirma contenido" }
                                if let Some(elapsed) = &view.hybrid_elapsed { em { "{elapsed} ms · requiere tu revisión" } }
                            }
                        }
                    }
                }
                label { class: if view.window_process.is_some() { "context-toggle available" } else { "context-toggle waiting" },
                    input { r#type: "checkbox", disabled: !view.observation_enabled || view.window_process.is_none() || view.voice_busy || view.sending,
                        checked: includes_window, onchange: move |event| dispatch.call(json!({"type":"window","included":event.checked()})) }
                    span { strong { "Ventana actual" }
                        small {
                            if let Some(name) = &view.window_process { "{name} · metadatos disponibles" }
                            else { "no seleccionable · observador sin contexto" }
                        }
                    }
                }
                div { class: if view.observation_enabled { "conversation-observer-state active" } else { "conversation-observer-state" },
                    i {}
                    span {
                        strong { if view.observation_enabled { "OBSERVADOR LOCAL ACTIVO" } else { "OBSERVADOR LOCAL INACTIVO" } }
                        small {
                            if view.observation_enabled {
                                if local { "Hay metadatos locales. Sólo se procesarán al marcar Ventana actual y autorizar." }
                                else { "Hay metadatos locales. Sólo saldrán al marcar Ventana actual y autorizar." }
                            } else { "No está autorizado ni está capturando metadatos de la ventana." }
                        }
                    }
                }
                if view.desktop_app {
                    button { r#type: "button", class: if view.observation_enabled { "console-button observing" } else { "console-button" },
                        onclick: move |_| dispatch.call(json!({"type":"toggleObservation"})),
                        if view.observation_enabled { "Administrar observador en Gateway" } else { "Configurar observador en Gateway" }
                    }
                }
                p { class: "context-sensor-boundary", "El observador aporta metadatos. Para imágenes de cámara y escritorio usa Vista de Nyxia. Gemma las procesa mientras la vista está activa." }
                div { class: "context-section-label local", strong { "CONTINUIDAD LOCAL" } span { "HISTORIAL + RAM" } }
                div { class: "conversation-working-memory", i {} span { strong { "CONVERSACIÓN GUARDADA LOCALMENTE" }
                    small { "Cada intercambio exitoso se conserva para continuar después de reiniciar. También entra en la RAM inmediata, sin convertirse automáticamente en recuerdo ni en hecho confirmado." }
                } }
                div { class: "conversation-route", strong { "MOTOR SELECCIONADO · SIN HERRAMIENTAS" }
                    span { "{view.configured_provider}" } small { if view.model.is_empty() { "modelo sin configurar" } else { "{view.model}" } }
                }
                div { class: "cloud-rule",
                    strong { if local { "POLÍTICA DE INFERENCIA" } else { "POLÍTICA DE ENVÍO" } }
                    span {
                        "{view.protocol} · {view.retention} · "
                        if local { "contexto 4096 · máximo 900 tokens de salida" } else { "máximo 1200 tokens de salida" }
                        " · sin herramientas · previsualización obligatoria"
                    }
                }
                button { r#type: "button", class: "conversation-settings-link",
                    onclick: move |_| dispatch.call(json!({"type":"openSettings"})), "Cambiar proveedor o modelo en Configuración"
                }
            }
        }
    }
}

fn review_panel(view: &Payload, review: &Review, dispatch: EventHandler<Value>) -> Element {
    rsx! {
        div { id: "alice-send-review", class: "send-review", tabindex: "-1", onmounted: move |_| focus_review(),
            div { class: "review-heading",
                div { p { class: "eyebrow", "PREVISUALIZACIÓN OBLIGATORIA" }
                    h3 {
                        if review.local { "Esto se procesará localmente con " } else { "Esto se enviará a " }
                        "{review.provider}"
                    }
                }
                span { "{review.model}" }
            }
            div { class: "payload-budget", "aria-label": "Presupuesto del texto autorizado",
                header {
                    strong { if review.local { "PRESUPUESTO DE CONTEXTO LOCAL" } else { "PRESUPUESTO DE SALIDA" } }
                    span { "CARACTERES · BYTES UTF-8" }
                }
                for fragment in &review.fragments {
                    div { key: "{fragment.id}", class: if fragment.included { "included" } else { "excluded" },
                        span { "{fragment.label}" } strong { "{fragment.characters}" } em { "{fragment.bytes} B" }
                        small { if fragment.included { "INCLUIDO" } else { "NO AUTORIZADO" } }
                    }
                }
                div { class: "separators", span { "Separadores de secciones" }
                    strong { "{review.separator_characters}" } em { "{review.separator_bytes} B" } small { "FORMATO" }
                }
                footer {
                    span { "TOTAL DEL TEXTO REVISADO" }
                    strong { "{review.total_characters} caracteres" } em { "{review.total_bytes} bytes UTF-8" }
                }
            }
            if review.local {
                p { class: "review-note",
                    "Con Vista de Nyxia activa se agregan imágenes recientes al procesar. Gemma recibe hasta 700 caracteres finales de las referencias y el mensaje actual completo (hasta 1600 caracteres). El presupuesto de arriba corresponde al texto revisado antes de ese ajuste."
                }
            }
            details { class: "payload-detail",
                summary { "Ver texto exacto autorizado" }
                p { "El resumen de arriba indica qué fuentes se incluirán. Abrí este detalle si querés revisar el contenido literal antes de enviarlo." }
                pre { "{review.payload}" }
            }
            p { class: "review-note",
                "Además se incluye una política breve: responder en español, describir las acciones realizadas y pedir aprobación antes de acciones externas o costosas. La respuesta se guardará en el historial local de Nyxia."
            }
            if !view.desktop_app {
                p { class: "cloud-error", "La inferencia sólo funciona desde la aplicación de escritorio." }
            }
            if view.desktop_app && !view.configured {
                p { class: "cloud-error",
                    if review.local { "El motor local no está disponible. Verificá que esté instalado e iniciá Nyxia desde su lanzador." }
                    else { "Configurá las variables de entorno de este proveedor para poder enviar la consulta." }
                }
            }
            if !view.error.is_empty() {
                p { class: "cloud-error", role: "alert", "{view.error}" }
            }
            div { class: "review-actions",
                button { r#type: "button", class: "secondary", disabled: view.sending,
                    onclick: move |_| dispatch.call(json!({"type":"cancelReview"})), "Volver a editar"
                }
                button { r#type: "button", class: "primary", disabled: !review.can_send,
                    onclick: move |_| dispatch.call(json!({"type":"authorize"})),
                    if view.sending { "Consultando…" } else if review.local { "Autorizar y procesar localmente" } else { "Autorizar y enviar a la nube" }
                }
            }
        }
    }
}

fn learning(view: &Payload, dispatch: EventHandler<Value>) -> Element {
    if view.learning.is_none() && view.learning_message.is_empty() {
        return rsx! {};
    }
    let pending = view.learning_pending.clone();
    rsx! {
        section { class: "conversation-learning-review", "aria-live": "polite",
            header {
                div { strong { "PROPUESTA DE RECUERDO · REVISIÓN HUMANA" } span { "Gemma local · tu mensaje es la única evidencia" } }
                button { r#type: "button", class: "secondary", disabled: pending.is_some(),
                    onclick: move |_| dispatch.call(json!({"type":"closeLearning"})), "Cerrar"
                }
            }
            if let Some(candidates) = &view.learning {
                for candidate in candidates { {learning_candidate(candidate, pending.as_deref(), dispatch)} }
                if candidates.is_empty() {
                    p { class: "retrieval-empty", "No hay propuesta. El intercambio sigue sólo en el historial local." }
                }
            }
            if !view.learning_message.is_empty() {
                p { class: "memory-operation-message", role: "status", "{view.learning_message}" }
            }
        }
    }
}

fn learning_candidate(
    candidate: &LearningCandidate,
    pending: Option<&str>,
    dispatch: EventHandler<Value>,
) -> Element {
    let importance_id = candidate.id.clone();
    let confirm_id = candidate.id.clone();
    rsx! {
        article { key: "{candidate.id}",
            div { strong { "{candidate.title}" } span { "{candidate.score}" } }
            p { "{candidate.description}" }
            blockquote { span { "EVIDENCIA LITERAL DE TU MENSAJE" } "{candidate.evidence}" }
            if !candidate.affects.is_empty() {
                div { class: "learning-emotions",
                    strong { "Interpretación emocional de tu mensaje · revisá antes de guardar" }
                    for affect in &candidate.affects {
                        p { key: "{affect.id}",
                            span { i { style: "background-color: {affect.color}" } "{affect.label} · intensidad {affect.intensity}%" }
                            q { "{affect.evidence}" }
                        }
                    }
                    small { "Confirmar el recuerdo conserva también esta interpretación de tu mensaje." }
                }
            }
            label { class: "learning-importance", "Importancia del recuerdo"
                select {
                    value: "{candidate.importance}", disabled: pending.is_some(),
                    onchange: move |event| {
                        if let Ok(value) = event.value().parse::<u8>() {
                            dispatch.call(json!({"type":"importance","key":importance_id,"value":value}));
                        }
                    },
                    for (value, label) in [(1, "Baja"), (2, "Menor"), (3, "Media"), (4, "Alta"), (5, "Muy alta")] {
                        option { value: "{value}", "{value}/5 · {label}" }
                    }
                }
                small { "Elegí cuánto importa conservarlo." }
            }
            footer {
                small { "Revisá el contenido y juzgá la exactitud antes de guardarlo." }
                button {
                    r#type: "button", class: "primary", disabled: pending.is_some(),
                    onclick: move |_| dispatch.call(json!({"type":"confirmLearning","value":confirm_id})),
                    if pending == Some(candidate.id.as_str()) { "Confirmando…" } else { "Confirmar recuerdo" }
                }
            }
        }
    }
}

fn feedback(view: &Payload, dispatch: EventHandler<Value>) -> Element {
    let count = view.retrievals.len();
    if count == 0 {
        return rsx! {};
    }
    rsx! {
        section { class: "retrieval-outcome-review", "aria-label": "Evaluación real de recuerdos recuperados",
            header {
                div { strong { "R6.5-F · RESULTADO DE RECUPERACIÓN" } span { "Confirmación humana · evaluación de utilidad" } }
                em { if count == 1 { "1 pendiente" } else { "{count} pendientes" } }
            }
            for item in &view.retrievals {
                {
                    let yes = item.key.clone();
                    let no = item.key.clone();
                    rsx! {
                        article { key: "{item.key}",
                            div { span { "¿ESTE RECUERDO AYUDÓ?" } strong { "{item.title}" } }
                            div {
                                button { r#type: "button", class: "secondary", disabled: view.feedback_pending.is_some(),
                                    onclick: move |_| dispatch.call(json!({"type":"feedback","key":no,"value":"not-helpful"})), "No ayudó"
                                }
                                button { r#type: "button", class: "primary", disabled: view.feedback_pending.is_some(),
                                    onclick: move |_| dispatch.call(json!({"type":"feedback","key":yes,"value":"helpful"})), "Sí, fue útil"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
