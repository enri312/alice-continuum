use crate::memory_page_model::{Automatic, Layers, Profile, Study, Working};
use crate::memory_page_ui::{notice, AutomaticEdit, Notice};
use dioxus::prelude::*;
use serde_json::{json, Value};

pub fn learning_panel(
    study: &Study,
    automatic: &Automatic,
    mut editor: Signal<Option<AutomaticEdit>>,
    running: Option<Notice>,
    study_error: &str,
    auto_error: &str,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let study_error = if study_error.is_empty() {
        &study.error
    } else {
        study_error
    };
    let auto_error = if auto_error.is_empty() {
        &automatic.error
    } else {
        auto_error
    };
    let busy = running.is_some();
    let edit = editor.read();
    let phase = if study.phase.is_empty() {
        "Cargando estado del autoestudio…"
    } else {
        &study.phase
    };
    rsx! {
        section { class: "memory-learning-view", "aria-label": "Aprendizaje de Nyxia",
            section { class: "automatic-memory-panel", "aria-labelledby": "self-study-title",
                header {
                    div { span { class: "eyebrow", "AUTOESTUDIO CON FUENTES" } h3 { id: "self-study-title", "Lo que Nyxia está estudiando" }
                        p { "Matemáticas, historia bíblica de tradición católica, psicología e inteligencia emocional, empatía, solidaridad, humildad, pensamiento crítico y ética. Cada lección conserva su fuente y una comprobación mediante ejercicios." } }
                    label {
                        input { r#type: "checkbox", checked: study.enabled, disabled: !study.ready || busy,
                            onchange: move |event| run.call((Notice::Study, json!({ "type": "toggleStudy", "enabled": event.checked() }))) }
                        "Autoestudio al iniciar"
                    }
                }
                div { class: "automatic-memory-summary",
                    strong { "{study.available} lecciones disponibles · {study.studied} estudiadas" }
                    span { role: "status", "{phase}" }
                }
                p { "Se recuperan en conversación las lecciones activas cuyo último ejercicio fue aprobado. El resultado comprueba ese ejercicio; no equivale a dominio general ni a una declaración tuya." }
                if !study_error.is_empty() { p { role: "alert", "{study_error}" } }
                details { summary { "Materias permitidas" } p { "{study.tracks}" } }
                div { class: "automatic-memory-list",
                    if study.records.is_empty() {
                        p { class: "automatic-memory-empty", "Todavía no hay lecciones estudiadas. El ciclo de inicio utilizará únicamente el currículo de las materias permitidas." }
                    } else {
                        for record in &study.records {
                            article { key: "{record.id}", class: if record.available { "" } else { "is-withdrawn" },
                                header { span { "{record.track}" } small { if record.available { "Disponible para conversación" } else { "Fuera del contexto · requiere repaso" } } }
                                h4 { "{record.title}" } p { "{record.content}" }
                                details { summary { "Fuente y comprobación" }
                                    a { href: "{record.url}", target: "_blank", rel: "noopener noreferrer", "{record.source}" }
                                    p { "{record.passes} ejercicios aprobados de {record.attempts} intentos · último resultado: " if record.passed { "aprobado" } else { "no aprobado" } }
                                    small { "{record.date}" } code { "{record.sha}" }
                                }
                            }
                        }
                    }
                }
            }
            section { class: "automatic-memory-panel", "aria-labelledby": "automatic-memory-title",
                header {
                    div { span { class: "eyebrow", "APRENDER CONVERSANDO" } h3 { id: "automatic-memory-title", "Lo que Nyxia decide conservar" }
                        p { "Recuerdos seleccionados de tus palabras. Puedes corregirlos o retirarlos del contexto sin borrar su procedencia." } }
                    label {
                        input { r#type: "checkbox", checked: automatic.enabled, disabled: !automatic.ready || busy,
                            onchange: move |event| run.call((Notice::Automatic, json!({ "type": "toggleAutomatic", "enabled": event.checked() }))) }
                        "Aprendizaje automático"
                    }
                }
                div { class: "automatic-memory-summary", strong { "{automatic.count} recuerdos activos" } span { role: "status", "{automatic.phase}" } }
                if !auto_error.is_empty() { p { role: "alert", "{auto_error}" } }
                div { class: "automatic-memory-list",
                    if automatic.records.is_empty() {
                        p { class: "automatic-memory-empty", "Todavía no seleccionó recuerdos. Las próximas conversaciones pueden aportar preferencias, datos o experiencias útiles; no necesita guardar cada mensaje." }
                    } else {
                        for record in &automatic.records {
                            {
                                let row = AutomaticEdit { id: record.id.clone(), content: record.content.clone() };
                                let id = record.id.clone();
                                let decision = if record.active { "withdraw" } else { "restore" };
                                rsx! {
                                    article { key: "{record.id}", class: if record.active { "" } else { "is-withdrawn" },
                                        header { span { "{record.type_label}" }
                                            small {
                                                if record.corrected { "Corregido por ti" } else { "Elegido por Nyxia · sin revisión manual" }
                                                if !record.active { " · retirado del RAG" }
                                            }
                                        }
                                        if let Some(draft) = edit.as_ref().filter(|draft| draft.id == record.id) {
                                            {
                                                let valid = !draft.content.trim().is_empty();
                                                let action = json!({ "type": "reviewAutomatic", "id": draft.id, "decision": "correct", "content": draft.content });
                                                rsx! {
                                                    form { onsubmit: move |event| { event.prevent_default(); if !busy && valid { run.call((Notice::Automatic, action.clone())); } },
                                                        label { "Corregir este recuerdo"
                                                            textarea { autofocus: true, maxlength: 1000, disabled: busy, value: "{draft.content}",
                                                                oninput: move |event| if let Some(value) = editor.write().as_mut() { value.content = event.value(); } }
                                                        }
                                                        div { button { r#type: "submit", disabled: busy || !valid, "Guardar corrección" }
                                                            button { r#type: "button", disabled: busy, onclick: move |_| editor.set(None), "Cancelar" } }
                                                    }
                                                }
                                            }
                                        } else { p { "{record.content}" } }
                                        details { summary { "Origen del recuerdo" } blockquote { "{record.evidence}" }
                                            small { "Importancia elegida: {record.importance}/5 · {record.date}" } code { "Intercambio {record.source}" } }
                                        footer {
                                            button { r#type: "button", disabled: busy, onclick: move |_| editor.set(Some(row.clone())), "Corregir" }
                                            button { r#type: "button", disabled: busy,
                                                onclick: move |_| run.call((Notice::Automatic, json!({ "type": "reviewAutomatic", "id": id, "decision": decision }))),
                                                if record.active { "Retirar del contexto" } else { "Volver a usar" } }
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
}

pub fn profile_panel(profile: Option<&Profile>, error: &str) -> Element {
    let verified = profile.filter(|profile| profile.state == "available");
    let title = verified
        .and_then(|profile| profile.owner_name.as_ref())
        .map_or_else(
            || "Perfil del propietario".into(),
            |owner| format!("Lo que Nyxia conoce de {owner}"),
        );
    rsx! {
        section { class: "memory-view-panel owner-profile-panel", "aria-labelledby": "owner-profile-title",
            header { div { p { class: "eyebrow", "PERFIL DEL PROPIETARIO · PRIVADO · SOLO LECTURA" }
                h3 { id: "owner-profile-title", "{title}" }
                p { "Hechos confirmados por el propietario y derivados de fuentes preservadas. Las instrucciones internas de esos documentos no se ejecutan." } }
                span { if verified.is_some() { "CONFIRMADO" } else { "NO DISPONIBLE" } }
            }
            if !error.is_empty() { p { class: "memory-layer-blocked", role: "alert", "{error}" } }
            if let Some(profile) = verified {
                div { class: "memory-evidence", span { "{profile.records.len()} RECUERDOS DE PERFIL" } span { "{profile.source_files.len()} FUENTES" }
                    if let Some(owner) = &profile.confirmed_by { span { "CONFIRMÓ · {owner}" } }
                }
                div { class: "memory-list",
                    for record in &profile.records {
                        article { class: "memory-record", key: "{record.id}",
                            div { class: "memory-meta", span { class: "tag", "PERFIL" } small { "{record.id}" } }
                            div { class: "memory-body", h3 { "{record.intention}" } p { "{record.summary}" }
                                div { class: "memory-evidence", span { "FUENTE · {record.source}" } span { "ESTADO · CONFIRMADO" } }
                            }
                        }
                    }
                }
                footer { code { "{profile.storage_path}" } span { "Solo se adjunta a una conversación cuando autorizás “Recuerdos relevantes”." } }
            } else {
                div { class: "memory-empty", h3 { "Perfil privado no cargado" } p { "Abre Nyxia como aplicación de escritorio para validar el archivo local." } }
            }
        }
    }
}

pub fn working_panel(
    working: Option<&Working>,
    busy: bool,
    message: &str,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let state = working.map_or("unavailable", |info| info.state.as_str());
    let label = match state {
        "active" => "ACTIVA",
        "expired" => "EXPIRADA",
        "empty" => "VACÍA",
        _ => "SIN BACKEND",
    };
    rsx! {
        section { class: "working-memory-panel memory-view-panel state-{state}", "aria-labelledby": "working-memory-title",
            header {
                div { p { class: "eyebrow", "R6.2-B · CONTEXTO EFÍMERO NATIVO" } h3 { id: "working-memory-title", "Memoria de trabajo de la sesión" }
                    p { "Contexto conversacional reciente dentro del proceso. No es un recuerdo, aprendizaje ni archivo local." } }
                span { "{label}" }
            }
            if let Some(data) = working {
                {
                    let generation = data.generation;
                    rsx! {
                        div { class: "working-memory-grid",
                            article { strong { "{data.message_count}" small { " / {data.max_messages}" } } span { "MENSAJES" }
                                small { "{data.exchange_count} / {data.max_messages / 2} intercambios completos" } }
                            article { strong { "{data.characters}" small { " / {data.max_characters}" } } span { "CARACTERES" }
                                small { "Presupuesto usado: {data.usage}%" } }
                            article { strong { "{data.remaining}" } span { "VENCIMIENTO" } small { "Actualización nativa cada 5 segundos" } }
                            article { strong { "{generation}" } span { "GENERACIÓN" } small { "Evita vaciar estado no revisado" } }
                        }
                        div { class: "working-memory-budget", "aria-label": "Presupuesto de caracteres utilizado: {data.usage}%", span { style: "width:{data.usage}%" } }
                        if data.exchanges.is_empty() {
                            div { class: "working-memory-empty",
                                strong { if state == "expired" { "EL CONTEXTO VENCIÓ" } else { "SIN CONTEXTO ACTIVO" } }
                                span { if state == "expired" { "Rust eliminó los mensajes al cumplirse el TTL." } else { "Aparecerá aquí después de una respuesta real del proveedor." } }
                            }
                        } else {
                            div { class: "working-memory-exchanges",
                                header { span { "INTERCAMBIOS EN RAM" } small { "METADATOS · SIN REPETIR CONTENIDO" } }
                                for (index, exchange) in data.exchanges.iter().enumerate() {
                                    article { key: "{exchange.id}", span { "{index + 1:02}" }
                                        div { strong { "{exchange.provider} · {exchange.model}" } small { "{exchange.date} · {exchange.source}" } }
                                        em { "2 MENSAJES" }
                                    }
                                }
                            }
                        }
                        footer { div { strong { "SOLO RAM · NO PERSISTENTE" } span { "Al cerrar Nyxia se descarta · R3 conserva únicamente SHA-256" } }
                            button { class: "danger", r#type: "button", disabled: busy || data.message_count == 0,
                                onclick: move |_| run.call((Notice::Main, json!({ "type": "clear", "generation": generation }))), "Vaciar memoria de trabajo" }
                        }
                    }
                }
            } else {
                div { class: "working-memory-empty", strong { "SNAPSHOT NATIVO NO DISPONIBLE" } span { "Abre Nyxia como aplicación de escritorio para consultar el estado real." } }
            }
            {notice(message)}
        }
    }
}

pub fn safety_panel(
    path: &str,
    busy: bool,
    message: &str,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    rsx! {
        div { class: "memory-view-panel memory-safety-view",
            div { class: "memory-tools", "aria-label": "Herramientas de respaldo",
                div { p { class: "eyebrow", "SEGURIDAD DE DATOS" } p { "La memoria privada vive fuera del repositorio." }
                    if !path.is_empty() { code { class: "memory-path", "{path}" } } }
                div { class: "memory-tool-actions",
                    button { class: "console-button", r#type: "button", disabled: busy,
                        onclick: move |_| run.call((Notice::Main, json!({ "type": "openDirectory" }))), "Abrir carpeta de memoria" }
                    button { class: "console-button", r#type: "button", disabled: busy,
                        onclick: move |_| run.call((Notice::Main, json!({ "type": "export" }))), "Exportar memoria" }
                    button { class: "console-button restore", r#type: "button", disabled: busy,
                        onclick: move |_| run.call((Notice::Main, json!({ "type": "restore" }))), "Restaurar respaldo" }
                }
            }
            {notice(message)}
        }
    }
}

pub fn layers_panel(
    layers: Option<&Layers>,
    loading: bool,
    desktop: bool,
    busy: bool,
    error: &str,
    message: &str,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let state = layers.map_or(if desktop { "loading" } else { "unavailable" }, |data| {
        data.state.as_str()
    });
    let label = match state {
        "active" => "ACTIVA",
        "sourceChanged" => "FUENTE CAMBIÓ",
        "rolledBack" => "REVERTIDA",
        "blocked" => "BLOQUEADA",
        "unavailable" => "SIN FUENTE",
        _ => "LISTA PARA REVISAR",
    };
    let preview = layers.and_then(|data| data.preview.as_ref());
    let revision_count = layers.map_or(0, |data| data.revision_count);
    let disabled = busy || loading || !desktop;
    let reason = layers
        .and_then(|data| data.blocked_reason.as_deref())
        .unwrap_or(error);
    rsx! {
        section { class: "memory-layer-panel memory-view-panel state-{state}", "aria-labelledby": "memory-layer-title",
            header { div { p { class: "eyebrow", "R6.6-A · ÍNDICE V3 REVERSIBLE" } h3 { id: "memory-layer-title", "Memoria por capas" }
                p { "Clasifica referencias explícitas sin copiar contenido ni modificar " code { "records.json" } ". Un procedimiento sin enlace R5 conserva su capa, pero no se presenta como habilidad ejecutable." } } span { "{label}" } }
            {notice(message)}
            if !reason.is_empty() { p { class: "memory-layer-blocked", role: "alert", "{reason}" } }
            if state == "sourceChanged" {
                p { class: "memory-layer-blocked", "La revisión activa corresponde a una versión anterior de records.json. La vista previa inferior ya refleja la fuente actual; revisala antes de activar una revisión nueva." }
            }
            if let Some(data) = preview {
                div { class: "memory-layer-grid",
                    article { strong { "{data.working_count}" } span { "TRABAJO EN ÍNDICE" } small { "La RAM real se consulta en En sesión" } }
                    article { strong { "{data.episodic_count}" } span { "EPISODIOS" } small { "Conversaciones y experiencias explícitas" } }
                    article { strong { "{data.taught_fact_count}" } span { "HECHOS ENSEÑADOS" } small { "Sólo enseñanza semántica directa" } }
                    article { class: if data.procedural_pending_count > 0 || data.unclassified_count > 0 { "pending" } else { "" },
                        strong { "{data.procedural_count}" } span { "PROCEDIMIENTOS" } small { "{data.procedural_pending_count} sin enlace R5 · {data.unclassified_count} sin clasificar" } }
                }
                div { class: "memory-layer-evidence", span { "FUENTE · {data.record_count} REGISTROS" } code { "{data.source_sha256}" } span { "{revision_count} REVISIONES INMUTABLES V3" } }
            } else {
                div { class: "memory-layer-empty", if loading { "Verificando la fuente local…" } else { "No existe una vista previa disponible." } }
            }
            footer {
                div { strong { "CERO CONTENIDO COPIADO" } span { "Sin LLM · sin señal sensorial · sin migración automática" } }
                div {
                    button { class: "secondary", r#type: "button", disabled,
                        onclick: move |_| run.call((Notice::Main, json!({ "type": "refreshLayers" }))), "Actualizar vista previa" }
                    if matches!(state, "ready" | "rolledBack" | "sourceChanged") {
                        button { class: "primary", r#type: "button", disabled: disabled || preview.is_none(),
                            onclick: move |_| run.call((Notice::Main, json!({ "type": "activateLayers" }))), "Revisé la huella · activar" }
                    }
                    if matches!(state, "active" | "sourceChanged") {
                        button { class: "danger", r#type: "button", disabled: disabled || layers.is_none_or(|data| data.active_revision_id.is_none()),
                            onclick: move |_| run.call((Notice::Main, json!({ "type": "rollbackLayers" }))), "Desactivar proyección" }
                    }
                }
            }
        }
    }
}
