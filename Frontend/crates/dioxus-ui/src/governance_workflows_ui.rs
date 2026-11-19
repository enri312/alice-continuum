use crate::governance_model::{Conversion, Entry, Metric, Pattern, Procedures, Skills};
use crate::governance_ui::{button, Action};
use dioxus::prelude::*;
use serde_json::json;

fn metrics(entries: &[Metric]) -> Element {
    rsx! { div { class: "skills-metrics",
        for (label, count, detail) in entries { div { key: "{label}", span { "{label}" } strong { "{count}" } small { "{detail}" } } }
    } }
}

fn message(busy: &str, error: &str, notice: &str) -> Element {
    let (code, value, class) = if !busy.is_empty() {
        ("…", busy, "")
    } else if !error.is_empty() {
        ("ERR", error, "is-error")
    } else {
        ("OK", notice, "is-success")
    };
    rsx! { if !value.is_empty() {
        div { class: "skills-message {class}", role: "status", span { "{code}" } strong { "{value}" } }
    } }
}

fn entry(item: &Entry, command: &str, disabled: bool, action: Action) -> Element {
    let event = json!({"type":command,"id":item.id});
    rsx! { button { r#type: "button", disabled, class: if item.selected { "selected" },
        onclick: move |_| action.call(event.clone()),
        strong { "{item.title}" } small { "{item.detail}" }
    } }
}

fn input(
    label: &str,
    id: &'static str,
    value: &str,
    limit: i64,
    multiline: bool,
    disabled: bool,
    action: Action,
) -> Element {
    let edit =
        move |event: FormEvent| action.call(json!({"type":"edit","id":id,"value":event.value()}));
    rsx! { label { "{label}"
        if multiline { textarea { value: "{value}", maxlength: limit, disabled, oninput: edit } }
        else { input { value: "{value}", maxlength: limit, disabled, oninput: edit } }
    } }
}

fn confirmed(
    id: &'static str,
    checked: bool,
    disabled: bool,
    label: &str,
    action: Action,
) -> Element {
    rsx! { label { class: "skills-confirm",
        input { r#type: "checkbox", checked, disabled,
            onchange: move |event| action.call(json!({"type":"confirm","id":id,"checked":event.checked()})) }
        span { "{label}" }
    } }
}

fn reason(
    label: &str,
    id: &'static str,
    value: &str,
    placeholder: &str,
    disabled: bool,
    action: Action,
) -> Element {
    let command = if id == "skill" { "reason" } else { "edit" };
    rsx! { label { "{label}"
        textarea { value: "{value}", maxlength: 600, placeholder: "{placeholder}", disabled,
            oninput: move |event| action.call(json!({"type":command,"id":id,"value":event.value()}))
        }
    } }
}

fn contract(entries: &[(&str, &str, &str)]) -> Element {
    rsx! { div { class: "skills-contract", for (label,value,detail) in entries {
        section { key: "{label}", span { "{label}" } strong { "{value}" } small { "{detail}" } }
    } } }
}

fn editor_heading(id: &str, detail: &str, flag: &str) -> Element {
    rsx! { header { class: "skills-editor-heading", div { span { "{id}" } strong { "{detail}" } } em { "{flag}" } } }
}

pub fn procedures(view: &Procedures, desktop: bool, action: Action) -> Element {
    if !desktop {
        return rsx! { section { class: "skills-page skills-unavailable",
            span { "R5 · GOBIERNO PROCEDIMENTAL" } h2 { "Procedimientos observados" }
            p { "Esta pantalla requiere la aplicación de escritorio: las decisiones se verifican contra evidencia R3 real y se guardan localmente con SHA-256." }
        } };
    }
    let busy = !view.busy.is_empty();
    rsx! {
        section { class: "skills-page procedures-page", "aria-labelledby": "procedures-title",
            header { class: "skills-heading procedures-heading",
                div { p { class: "eyebrow", "R5 · PATRONES OBSERVADOS" } h2 { id: "procedures-title", "Procedimientos observados" }
                    p { "Revisá las repeticiones registradas en Auditoría. Podés descartar un patrón o conservarlo y convertirlo en un borrador para el Taller de habilidades." } }
                span { class: "skills-safety", i {} "EJECUCIÓN 0 · BORRADORES R5→R4 {view.conversion_count}" }
            }
            {metrics(&view.metrics)}
            {message(&view.busy, &view.error, &view.notice)}
            div { class: "skills-layout procedures-layout",
                aside { class: "skills-library",
                    header { span { "[01] PATRONES VIGENTES" } strong { "{view.patterns.len()} PENDIENTES" } }
                    section {
                        if view.patterns.is_empty() { p { "Sin patrones nuevos en la evidencia R3 vigente." } }
                        for item in &view.patterns { Fragment { key: "{item.id}", {entry(item, "select", busy, action)} } }
                    }
                    header { span { "[02] DECISIONES INMUTABLES" } strong { "{view.decisions.len()} REGISTROS" } }
                    section {
                        if view.decisions.is_empty() { p { "El almacén aún no contiene decisiones." } }
                        for item in &view.decisions {
                            article { key: "{item.id}", class: "procedure-decision evidence-{item.state}",
                                strong { "{item.title}" } small { "{item.detail}" }
                                if !item.sha.is_empty() { small { "CANDIDATO {item.sha}" } }
                                em { "{item.status}" }
                                if item.convertible { {button("Preparar borrador R4", "conversion", &item.id, "", busy, action)} }
                            }
                        }
                    }
                }
                div { class: "skills-workbench",
                    if let Some(item) = &view.conversion { {conversion_form(item, busy, action)} }
                    else if let Some(item) = &view.pattern { {pattern_form(item, busy, action)} }
                    else {
                        div { class: "skills-empty", span { "R5" }
                            strong {
                                if !view.patterns.is_empty() { "Seleccioná un patrón verificable" }
                                else if view.decisions.iter().any(|item| item.convertible) { "Hay un candidato retenido listo para convertir" }
                                else { "Todavía no hay un procedimiento para decidir" }
                            }
                            p { "La detección es pasiva. Un borrador convertido seguirá esperando revisión humana en el Taller." }
                        }
                    }
                }
            }
            footer { class: "procedures-footnote", "{view.footer}" }
        }
    }
}

fn pattern_form(item: &Pattern, busy: bool, action: Action) -> Element {
    let retain = item.action == "retain";
    let (tone, kind) = if retain {
        ("is-warning", "candidato")
    } else {
        ("is-danger", "descarte")
    };
    rsx! {
        {editor_heading(&item.id, &item.detail, "EVIDENCIA R3 VIGENTE")}
        div { class: "procedure-steps",
            for (position, operation, capability) in &item.steps { article { key: "{position}",
                span { "{position}" } div { strong { "{operation}" } small { "{capability}" } }
            } }
        }
        section { class: "procedure-evidence-summary", "aria-label": "Resumen de evidencia y diferencias",
            header { span { "[EVIDENCIA] {item.evidence.len()} EJECUCIONES CORRELACIONADAS" } strong { "{item.event_count} EVENTOS R3" } }
            div { class: "procedure-occurrences",
                for (position, digest, count) in &item.evidence { article { key: "{position}", span { "{position}" } strong { "{digest}" } small { "{count}" } } }
            }
            div { class: "procedure-variations",
                if item.variations.is_empty() { p { "Sin diferencias de duración ni huella entre las ejecuciones observadas." } }
                for (index, (step, dimension, detail)) in item.variations.iter().enumerate() {
                    article { key: "{index}", span { "{step}" } strong { "{dimension}" } small { "{detail}" } }
                }
            }
            footer { "{item.window}" }
        }
        div { class: "procedure-choice", role: "group", "aria-label": "Decisión sobre el patrón",
            button { r#type: "button", class: if retain {"selected"}, "aria-pressed": retain, disabled: busy,
                onclick: move |_| action.call(json!({"type":"decision","id":"retain"})),
                strong { "CONSERVAR CANDIDATO" } small { "Guarda propuesta cerrada y su SHA-256; no la ejecuta." }
            }
            button { r#type: "button", class: if retain {"dismiss"} else {"selected dismiss"}, "aria-pressed": !retain, disabled: busy,
                onclick: move |_| action.call(json!({"type":"decision","id":"dismiss"})),
                strong { "DESCARTAR PATRÓN" } small { "Guarda sólo la decisión y digest del motivo." }
            }
        }
        if retain {
            div { class: "skills-editor",
                {input("TÍTULO", "title", &item.title, 120, false, busy, action)}
                {input("PROPÓSITO", "purpose", &item.purpose, 600, true, busy, action)}
                {input("ID SUGERIDO PARA UNA HABILIDAD FUTURA", "skill", &item.skill, 128, false, busy, action)}
            }
        }
        section { class: "skills-governance procedure-confirmation",
            header { span { "CONFIRMACIÓN DEL PROPIETARIO" } strong { "DECISIÓN IRREVERSIBLE PARA ESTA HUELLA" } }
            {confirmed("candidate", item.confirmed, busy, "Confirmo que revisé el patrón, su riesgo y la acción elegida. Esto no habilita ejecución.", action)}
            {reason("MOTIVO (SE CONSERVA SÓLO SU SHA-256)", "reason", &item.reason, "Mínimo 12 caracteres; el texto no queda almacenado.", busy, action)}
            div { class: "skills-lifecycle-actions",
                button { r#type: "button", class: "{tone}", disabled: !item.can_submit,
                    onclick: move |_| action.call(json!({"type":"submit"})),
                    "Registrar {kind}" small { "Se vuelve a validar contra la evidencia R3 antes de escribir." }
                }
            }
        }
    }
}

fn conversion_form(item: &Conversion, busy: bool, action: Action) -> Element {
    rsx! {
        {editor_heading(&item.id, &item.detail, "SÓLO NUEVO BORRADOR")}
        {contract(&[("DECISIÓN R5", &item.fingerprint, "decisión de conservación registrada"),
            ("CANDIDATO", &item.sha, "SHA-256 verificado"), ("RESULTADO", "BORRADOR · V1", "sin aprobar · sin ejecutar")])}
        div { class: "skills-editor",
            {input("IDENTIFICADOR DE LA NUEVA HABILIDAD", "conversionSkillId", &item.skill, 128, false, busy, action)}
            {input("TÍTULO CORREGIBLE", "conversionTitle", &item.title, 120, false, busy, action)}
            {input("DESCRIPCIÓN", "conversionDescription", &item.description, 600, true, busy, action)}
            {input("PROPÓSITO", "conversionPurpose", &item.purpose, 600, true, busy, action)}
        }
        section { class: "skills-governance procedure-confirmation",
            header { span { "[R5→R4] CONFIRMACIÓN DEL PROPIETARIO" } strong { "NO ACTIVA LA HABILIDAD" } }
            {confirmed("conversion", item.confirmed, busy, "Confirmo la huella del candidato y que deseo crear un borrador nuevo para revisarlo en el Taller.", action)}
            {reason("MOTIVO (NO SE COPIA AL BORRADOR)", "conversionReason", &item.reason, "Mínimo 12 caracteres.", busy, action)}
            div { class: "skills-lifecycle-actions",
                button { r#type: "button", class: "is-warning", disabled: !item.can_submit,
                    onclick: move |_| action.call(json!({"type":"convert"})),
                    "Crear borrador R4" small { "Conserva procedencia R5; ejecución y aprobación permanecen deshabilitadas." }
                }
            }
        }
    }
}

pub fn skills(view: &Skills, desktop: bool, action: Action) -> Element {
    if !desktop {
        return rsx! { section { class: "skills-page skills-unavailable", span { "R4 · TALLER NATIVO" }
            h2 { "Taller de habilidades" } p { "Abrí la aplicación de escritorio para usar el almacén privado y la simulación nativa." }
        } };
    }
    let busy = !view.busy.is_empty();
    rsx! {
        section { class: "skills-page", "aria-labelledby": "skills-title",
            header { class: "skills-heading",
                div { p { class: "eyebrow", "R4 · EDICIÓN Y SIMULACIÓN" } h2 { id: "skills-title", "Taller de habilidades" }
                    p { "Editá borradores, simulá sus pasos y revisá las versiones antes de aprobarlas. Aquí también aparecen los borradores creados desde Procedimientos." }
                }
                span { class: "skills-safety", i {} "EJECUCIÓN BLOQUEADA" }
            }
            {metrics(&view.metrics)}
            {message(&view.busy, &view.error, &view.notice)}
            div { class: "skills-layout",
                aside { class: "skills-library",
                    header { span { "[01] BIBLIOTECA LOCAL" } strong { "{view.drafts.len() + view.lifecycle.len()} REGISTROS" } }
                    button { r#type: "button", class: "skills-template", disabled: busy || !view.ready,
                        onclick: move |_| action.call(json!({"type":"prepare"})),
                        span { "PLANTILLA NATIVA · SOLO LECTURA" }
                        strong { "Revisar proveedores de IA" }
                        small { "Presencia de configuración y modelos públicos · sin claves · sin red" }
                    }
                    section { h3 { "BORRADORES" }
                        if view.drafts.is_empty() { p { "Sin borradores canónicos." } }
                        for item in &view.drafts { Fragment { key: "{item.id}", {entry(item, "draft", busy, action)} } }
                    }
                    section { h3 { "CICLO DE VIDA" }
                        if view.lifecycle.is_empty() { p { "Sin habilidades gobernadas." } }
                        for item in &view.lifecycle { Fragment { key: "{item.id}", {entry(item, "lifecycle", busy, action)} } }
                    }
                }
                div { class: "skills-workbench",
                    if let Some(item) = &view.manifest {
                        {editor_heading(&item.id, &format!("{} · RIESGO {}", item.status, item.risk), if item.dirty { "CAMBIOS SIN GUARDAR" }
                            else if item.saved { &item.sha } else { "NO GUARDADA" })}
                        div { class: "skills-editor",
                            {input("TÍTULO", "title", &item.title, 120, false, busy || !item.editable, action)}
                            {input("DESCRIPCIÓN", "description", &item.description, 600, true, busy || !item.editable, action)}
                            {input("PROPÓSITO", "purpose", &item.purpose, 600, true, busy || !item.editable, action)}
                        }
                        {contract(&[("CAPACIDAD",&item.capability,&item.operations),
                            ("EFECTOS PERMITIDOS","LECTURA SANITIZADA","sin escritura · sin red · sin procesos"), ("RESULTADO",&item.output,"no sensible")])}
                        div { class: "skills-primary-actions",
                            {button("Guardar borrador", "save", "", "", busy || !item.editable || !item.dirty, action)}
                            {button("Simular plan", "simulate", "", "", busy, action)}
                        }
                        if let Some(result) = &view.simulation {
                            section { class: "skills-simulation",
                                header { span { "[SIM] PLAN ESTÁTICO VERIFICADO" } strong { "{result.steps.len()} PASOS · {result.blocks.len()} BLOQUEOS" } }
                                div { class: "skills-simulation-grid",
                                    for (label,value) in &result.metrics { div { key: "{label}", span { "{label}" } strong { "{value}" } } }
                                }
                                for step in &result.steps {
                                    article { key: "{step.position}", span { "{step.position}" }
                                        div { strong { "{step.title}" } small { "{step.detail}" } } em { "{step.readiness}" } }
                                }
                                ul { for (index,(code,summary)) in result.blocks.iter().enumerate() {
                                    li { key: "{index}", strong { "{code}" } " · {summary}" }
                                } }
                            }
                        }
                        if item.saved {
                            section { class: "skills-governance",
                                header { span { "CONFIRMACIÓN DEL PROPIETARIO" }
                                    strong { if item.actions.is_empty() { "CICLO CERRADO" } else { "DECISIÓN REQUERIDA" } }
                                }
                                if item.actions.is_empty() {
                                    p { "Esta habilidad está retirada. Su historial permanece verificable, pero no admite nuevas transiciones." }
                                } else {
                                    {confirmed("skill", item.confirmed, busy, "Confirmo que revisé la identidad, el SHA-256 y el efecto de esta transición.", action)}
                                    {reason("MOTIVO VISIBLE", "skill", &item.reason, "Explicá por qué corresponde este cambio (mínimo 12 caracteres).", busy, action)}
                                    div { class: "skills-lifecycle-actions",
                                        for choice in &item.actions {
                                            {
                                                let event = json!({"type":"transition","id":choice.action});
                                                rsx! { button { key: "{choice.action}", r#type: "button", class: "is-{choice.tone}",
                                                    title: "{choice.detail}", disabled: busy || !item.can_confirm,
                                                    onclick: move |_| action.call(event.clone()), "{choice.label}" small { "{choice.detail}" }
                                                } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        div { class: "skills-empty", span { "R4" } strong { "Prepará la primera habilidad real" }
                            p { "La plantilla se mantiene en memoria hasta que pulses “Guardar borrador”." }
                        }
                    }
                }
            }
        }
    }
}
