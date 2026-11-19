use crate::memory_consolidation_ui::consolidation_panel;
use crate::memory_lifecycle_ui::{lifecycle_panel, ReviewDraft};
use crate::memory_maintenance_model::Maintenance;
use crate::memory_page_model::*;
use crate::memory_panels_ui::{
    layers_panel, learning_panel, profile_panel, safety_panel, working_panel,
};
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::BTreeMap;
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

fn emit(callback: &js_sys::Function, action: Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&action.to_string()));
}

#[derive(Clone, Copy, Default, PartialEq)]
pub enum Notice {
    #[default]
    Main,
    Study,
    Automatic,
}

#[derive(Clone)]
enum Command {
    View(View),
    Edit(String),
    Run(Notice, Value),
    InvalidatePlan(&'static str),
}

const SECTIONS: [(View, &str, &str); 4] = [
    (
        View::Learning,
        "Aprendizaje",
        "Autoestudio y aprendizaje de conversaciones.",
    ),
    (
        View::Records,
        "Recuerdos",
        "Registros conservados y perfil confirmado.",
    ),
    (
        View::Working,
        "En sesión",
        "Contexto temporal de la conversación actual.",
    ),
    (
        View::Review,
        "Mantenimiento",
        "Revisar, organizar y proteger la memoria.",
    ),
];

#[derive(Clone)]
pub struct AutomaticEdit {
    pub id: String,
    pub content: String,
}

fn open_editor(page: &Page, id: &str) -> Option<Edit> {
    page.records
        .iter()
        .find(|record| {
            record.id == id && !record.archived && record.status.as_deref() != Some("archived")
        })
        .map(Edit::from)
}

pub fn page(props: PageProps) -> Element {
    let Payload::Configure { setup } = &props.initial else {
        return rsx! { p { role: "alert", "Memoria no disponible." } };
    };
    let mut view = use_signal(|| setup.view);
    let mut data = use_signal(|| Page {
        memory_status: if setup.desktop { "loading" } else { "browser" }.into(),
        ..Page::default()
    });
    let mut editor = use_signal(|| None::<Edit>);
    let mut auto_edit = use_signal(|| None::<AutomaticEdit>);
    let mut plan = use_signal(|| None::<Plan>);
    let mut sequence = use_signal(|| 0_u32);
    let mut pending = use_signal(|| None::<(u32, Notice)>);
    let mut message = use_signal(String::new);
    let mut study_error = use_signal(String::new);
    let mut auto_error = use_signal(String::new);
    let mut layers = use_signal(|| None::<Layers>);
    let mut layers_loading = use_signal(|| false);
    let mut layer_error = use_signal(String::new);
    let mut maintenance = use_signal(Maintenance::default);
    let mut review_draft = use_signal(ReviewDraft::default);
    let mut selected_survivors = use_signal(BTreeMap::new);
    let query = use_signal(String::new);
    let callback = props.on_action.clone();
    let command = use_callback(move |command: Command| {
        if pending.peek().is_some() {
            return;
        }
        match command {
            Command::View(next) => {
                if next != *view.peek() {
                    maintenance.set(Maintenance::default());
                    selected_survivors.write().clear();
                    view.set(next);
                    message.set(String::new());
                    emit(&callback, json!({ "type": "view", "view": next }));
                }
            }
            Command::Edit(id) => {
                editor.set(open_editor(&data.peek(), &id));
                plan.set(None);
            }
            Command::Run(notice, mut action) => {
                let request = (*sequence.peek()).wrapping_add(1).max(1);
                sequence.set(request);
                pending.set(Some((request, notice)));
                match notice {
                    Notice::Main => message.set(String::new()),
                    Notice::Study => study_error.set(String::new()),
                    Notice::Automatic => auto_error.set(String::new()),
                }
                action["request"] = json!(request);
                emit(&callback, action);
            }
            Command::InvalidatePlan(group) => {
                match group {
                    "archive" => maintenance.write().archive_plan = None,
                    "retention" => maintenance.write().retention_plan = None,
                    _ => return,
                }
                emit(
                    &callback,
                    json!({ "type": "invalidateRecordPlan", "group": group }),
                );
            }
        }
    });
    let callback = props.on_action.clone();
    let rx = props.rx.clone();
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
                            emit(&callback, json!({ "type": "connect" }));
                            emit(&callback, json!({ "type": "view", "view": *view.peek() }));
                        }
                        Payload::Configure { .. } => {}
                        Payload::Page { page } => {
                            let stale = editor.peek().as_ref().is_some_and(|edit| {
                                !page
                                    .records
                                    .iter()
                                    .any(|record| record.id == edit.id && !record.archived)
                            });
                            if stale {
                                editor.set(None);
                                plan.set(None);
                            }
                            data.set(*page);
                        }
                        Payload::Layers {
                            layers: next,
                            loading,
                            error,
                        } => {
                            layers.set(next);
                            layers_loading.set(loading);
                            layer_error.set(error);
                        }
                        Payload::Maintenance { data: next } => {
                            if next.loading {
                                selected_survivors.write().clear();
                            }
                            maintenance.set(*next);
                        }
                        Payload::Result { request, result } => {
                            let expected = *pending.peek();
                            if let Some((id, notice)) = expected {
                                if id != request {
                                    continue;
                                }
                                pending.set(None);
                                let OperationResult {
                                    message: detail,
                                    error,
                                    close_edit,
                                    close_automatic_edit,
                                    plan: next,
                                    edit_record,
                                    clear_notes,
                                    clear_source,
                                } = result;
                                match notice {
                                    Notice::Main => {
                                        message.set(if error.is_empty() { detail } else { error })
                                    }
                                    Notice::Study => study_error.set(error),
                                    Notice::Automatic => auto_error.set(error),
                                }
                                if close_edit {
                                    editor.set(None);
                                    plan.set(None);
                                }
                                if close_automatic_edit {
                                    auto_edit.set(None);
                                }
                                if let Some(id) = edit_record {
                                    editor.set(open_editor(&data.peek(), &id));
                                    plan.set(None);
                                }
                                if let Some(id) = clear_source {
                                    review_draft.write().sources.remove(&id);
                                }
                                match clear_notes.as_deref() {
                                    Some("archive") => review_draft.write().archive_note.clear(),
                                    Some("retention") => {
                                        review_draft.write().retention_note.clear()
                                    }
                                    _ => {}
                                }
                                if let Some(next) = next {
                                    if editor
                                        .peek()
                                        .as_ref()
                                        .is_some_and(|edit| edit.id == next.record_id)
                                    {
                                        plan.set(Some(next));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });

    let current = view();
    let section = current.section();
    let page = data.read();
    let total = page.records.len() + page.profile_count;
    let running = pending().map(|(_, kind)| kind);
    let busy = running.is_some();
    let note = message.read();
    let maintenance = maintenance.read();
    let count = maintenance
        .consolidation
        .as_ref()
        .map(|data| data.pending_candidate_count);
    let storage_label = match page.memory_status.as_str() {
        "native" => "ARCHIVO LOCAL",
        "loading" => "CARGANDO",
        "error" => "ERROR DE MEMORIA",
        _ => "NAVEGADOR DEV",
    };
    let storage_title = if page.memory_path.is_empty() {
        "Almacenamiento aún no disponible"
    } else {
        &page.memory_path
    };
    let subsections = match section {
        View::Records => vec![
            (
                View::Records,
                "Registros",
                Some((page.records.len(), "registros")),
            ),
            (
                View::Profile,
                "Perfil",
                page.owner_profile
                    .as_ref()
                    .map(|_| (page.profile_count, "hechos de perfil")),
            ),
        ],
        View::Review => vec![
            (
                View::Review,
                "Revisión y ciclo",
                Some((page.due, "revisiones pendientes")),
            ),
            (View::Layers, "Capas", None),
            (
                View::Consolidate,
                "Consolidación",
                count.map(|value| (value as usize, "candidatos pendientes")),
            ),
            (View::Safety, "Respaldo", None),
        ],
        _ => Vec::new(),
    };
    let run = use_callback(move |(notice, value)| command.call(Command::Run(notice, value)));
    let invalidate = use_callback(move |group| command.call(Command::InvalidatePlan(group)));
    rsx! {
        section { class: "memory-page", "aria-labelledby": "memory-title",
            div { class: "memory-heading",
                div { p { class: "eyebrow", "ALMACÉN COGNITIVO · LOCAL" } h2 { id: "memory-title", "Memoria de Alice" }
                    p { "Consultá lo que Alice estudia, los recuerdos que conserva y el contexto de esta sesión. Las herramientas de revisión y respaldo están en Mantenimiento." } }
                div { class: "memory-side",
                    div { class: "memory-storage storage-{page.memory_status}", title: storage_title, i {} "{storage_label}" }
                    div { class: "memory-count memory-count-breakdown", "aria-label": "{total} elementos consultables: {page.records.len()} recuerdos y {page.profile_count} hechos de perfil",
                        strong { "{total}" } span { "elementos" br {} "consultables" }
                        small { b { "{page.records.len()}" } " recuerdos · " b { "{page.profile_count}" } " perfil" }
                    }
                }
            }
            nav { class: "memory-section-nav", "aria-label": "Secciones de memoria",
                for (item, label, description) in SECTIONS {
                    button { key: "{label}", r#type: "button", disabled: busy,
                        "aria-current": (section == item).then_some("page"), "aria-controls": "memory-current-view",
                        onclick: move |_| command.call(Command::View(item)), strong { "{label}" } small { "{description}" } }
                }
            }
            if !subsections.is_empty() {
                nav { class: "memory-subsection-nav", "aria-label": if section == View::Records { "Opciones de recuerdos" } else { "Herramientas de mantenimiento" },
                    for (item, label, count) in subsections {
                        button { key: "{label}", r#type: "button", disabled: busy,
                            "aria-current": (current == item).then_some("page"), "aria-controls": "memory-current-view",
                            "aria-label": count.map(|(number, name)| format!("{label}, {number} {name}")),
                            onclick: move |_| command.call(Command::View(item)), "{label}"
                            if let Some((number, _)) = count { span { class: "memory-nav-count", "aria-hidden": "true", "{number}" } }
                        }
                    }
                }
            }
            div { id: "memory-current-view", class: "memory-current-view",
                {match current {
                    View::Learning => learning_panel(&page.study, &page.automatic, auto_edit, running, &study_error.read(), &auto_error.read(), run),
                    View::Records => records_panel(&page, query, editor, plan, busy, &note, command, run),
                    View::Profile => profile_panel(page.owner_profile.as_ref(), &page.owner_profile_error),
                    View::Working => working_panel(page.working.as_ref(), busy, &note, run),
                    View::Layers => layers_panel(layers.read().as_ref(), layers_loading(), setup.desktop, busy, &layer_error.read(), &note, run),
                    View::Safety => safety_panel(&page.memory_path, busy, &note, run),
                    View::Review => lifecycle_panel(&maintenance, review_draft, page.due, setup.desktop, busy, &note, run, invalidate),
                    View::Consolidate => consolidation_panel(&maintenance, selected_survivors, setup.desktop, busy, &note, run),
                }}
            }
        }
    }
}

pub fn notice(message: &str) -> Element {
    rsx! { if !message.is_empty() { p { class: "memory-operation-message", role: "status", "{message}" } } }
}

fn records_panel(
    page: &Page,
    mut query: Signal<String>,
    editor: Signal<Option<Edit>>,
    plan: Signal<Option<Plan>>,
    busy: bool,
    message: &str,
    command: EventHandler<Command>,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let filter = query.read().trim().to_lowercase();
    let records: Vec<_> = page
        .records
        .iter()
        .filter(|record| record.matches(&filter))
        .collect();
    let has_records = !page.records.is_empty();
    let edit = editor.read();
    let plan_value = plan.read();
    let metrics = [
        (
            page.by_origin.conversation,
            "EPISODIOS CONVERSACIONALES",
            "Intercambios conservados; sus respuestas requieren evidencia aparte.",
        ),
        (
            page.by_origin.observation,
            "OBSERVACIONES",
            "Experiencias captadas desde el entorno y su incertidumbre.",
        ),
        (
            page.by_origin.teaching,
            "ENSEÑANZAS REGISTRADAS",
            "Contenido indicado explícitamente para Alice.",
        ),
        (
            page.profile_count,
            "HECHOS DE PERFIL",
            "Se consultan por separado en Perfil.",
        ),
    ];
    rsx! {
        div { class: "memory-view-panel",
            div { class: "memory-toolbar", label { class: "memory-search", span { "BUSCAR" }
                input { value: "{query.read()}", oninput: move |event| query.set(event.value()), placeholder: "Buscar una conversación o recuerdo" } } }
            div { class: "memory-records-summary", "aria-label": "Clasificación de los registros de memoria",
                for (total, label, text) in metrics {
                    article { key: "{label}", strong { "{total}" } span { "{label}" } small { "{text}" } }
                }
            }
            {notice(message)}
            if records.is_empty() {
                div { class: "memory-empty", span { "◌" }
                    h3 { if has_records { "No encontramos recuerdos con esa búsqueda." } else { "La memoria duradera todavía está vacía." } }
                    p { if has_records { "Probá con otras palabras." } else { "Una conversación u observación autorizada podrá producir candidatos; ninguno se consolidará automáticamente." } }
                }
            } else {
                div { class: "memory-list",
                    for record in records {
                        article { key: "{record.id}", class: "memory-record",
                            div { class: "memory-meta",
                                div { span { class: "tag", "{record.origin}" }
                                    if let Some(label) = &record.type_label { span { class: "memory-type", "{label}" } }
                                    else { span { class: "memory-type unclassified", "SIN CLASIFICAR" } }
                                    if let Some(version) = record.version { span { class: "memory-type version", "V{version}" } }
                                }
                                small { "{record.date}" }
                            }
                            div { class: "memory-body",
                                h3 { "{record.intention}" }
                                if let Some(draft) = edit.as_ref().filter(|draft| draft.id == record.id) {
                                    {record_editor(record, draft, plan_value.as_ref(), editor, plan, busy, run)}
                                } else {
                                    {record_details(record, busy, command, run)}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn record_details(
    record: &Record,
    busy: bool,
    command: EventHandler<Command>,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let edit_id = record.id.clone();
    let discard_id = record.id.clone();
    let archived = record.archived || record.status.as_deref() == Some("archived");
    let version = record.version.unwrap_or(1);
    rsx! {
        p { if record.summary.is_empty() { "Sin resumen todavía." } else { "{record.summary}" } }
        div { class: "memory-evidence",
            if !record.source.is_empty() { span { "ORIGEN · {record.source}" } }
            span { "VIGENCIA · {record.validity}" } span { "IMPORTANCIA · {record.importance}/5" }
            span { "ESTABILIDAD · {record.stability}%" } span { "RECUPERACIONES · {record.recalls}" }
            span { "REVISIONES · {record.reviews}" } span { "VERSIÓN · {version}" }
            if record.archived { span { "ARCHIVO · REVERSIBLE" } }
            if let Some(date) = &record.deletion_date { span { "ELIMINACIÓN · EN ESPERA HASTA {date}" } }
        }
        if let Some(proposal) = &record.proposal {
            div { class: "memory-review-proposal state-{proposal.state}", strong { "{proposal.label}" } span { "{proposal.reason}" }
                if proposal.state == "review" { button { r#type: "button", disabled: busy, onclick: move |_| command.call(Command::View(View::Review)), "Abrir ciclo de revisión" } }
            }
        }
        if !record.next_step.is_empty() { p { class: "next", strong { "Sigue:" } " {record.next_step}" } }
        div { class: "memory-actions",
            button { r#type: "button", disabled: busy || archived,
                title: if archived { "Restaurá el recuerdo antes de editarlo" } else { "Crear una versión sucesora" },
                onclick: move |_| command.call(Command::Edit(edit_id.clone())), "Editar con versión" }
            button { r#type: "button", class: "danger", disabled: busy || !record.discardable,
                title: if record.discardable { "Descartar registro heredado no evaluado" } else { "Los recuerdos durables se retiran desde Ciclo con archivo, espera y resguardo" },
                onclick: move |_| run.call((Notice::Main, json!({ "type": "discard", "id": discard_id }))), "Descartar" }
        }
    }
}

fn record_editor(
    record: &Record,
    draft: &Edit,
    reviewed: Option<&Plan>,
    mut edit: Signal<Option<Edit>>,
    mut plan: Signal<Option<Plan>>,
    busy: bool,
    run: EventHandler<(Notice, Value)>,
) -> Element {
    let change = move |modify: fn(&mut Edit, String), value: String| {
        let (mut edit, mut plan) = (edit, plan);
        if let Some(draft) = edit.write().as_mut() {
            modify(draft, value);
        }
        plan.set(None);
    };
    let operation = match reviewed {
        Some(plan) => json!({ "type": "confirmVersion", "planId": plan.plan_id }),
        None => json!({ "type": "save", "edit": draft }),
    };
    let label = if reviewed.is_some() {
        "Confirmar nueva versión"
    } else if record.versioned() {
        "Preparar versión"
    } else {
        "Guardar cambios"
    };
    let differences = reviewed
        .map(|item| item.changed_fields.join(" · "))
        .unwrap_or_default();
    rsx! {
        div { class: "memory-editor reconsolidation-editor",
            label { "Título o intención" input { value: "{draft.intention}", disabled: busy, oninput: move |event| change(|draft, v| draft.intention = v, event.value()) } }
            label { "Contenido" textarea { value: "{draft.summary}", disabled: busy, oninput: move |event| change(|draft, v| draft.summary = v, event.value()) } }
            label { "Próximo paso" input { value: "{draft.next_step}", disabled: busy, oninput: move |event| change(|draft, v| draft.next_step = v, event.value()) } }
            if record.teaching {
                label { "Fuente" input { value: "{draft.source}", disabled: busy, oninput: move |event| change(|draft, v| draft.source = v, event.value()) } }
            }
            if record.versioned() {
                div { class: "reconsolidation-controls",
                    p { strong { "R6.5-H · EDICIÓN VERSIONADA" } " La versión actual no se sobrescribirá. Primero se crea una vista previa y después pedirá una segunda confirmación." }
                    label { "Motivo" select { value: "{draft.reason}", disabled: busy, onchange: move |event| change(|draft, v| draft.reason = v, event.value()),
                        option { value: "ownerCorrection", "Corrección del propietario" }
                        option { value: "newContext", "Información o contexto nuevo" }
                        option { value: "clarification", "Aclaración" }
                    } }
                    label { "Por qué debe actualizarse" textarea { value: "{draft.note}", maxlength: 500, disabled: busy,
                        oninput: move |event| change(|draft, v| draft.note = v, event.value()), placeholder: "Explicá la evidencia o el contexto de esta actualización" } }
                    if let Some(preview) = reviewed {
                        div { class: "reconsolidation-preview",
                            strong { "PLAN VERIFICADO · V{preview.previous_version} → V{preview.projected_version}" }
                            span { "{differences}" } code { "{preview.plan_id}" }
                            small { "SIN ESCRITURAS · SIN ACCIÓN AUTOMÁTICA" }
                        }
                    }
                }
            } else if record.teaching {
                label { "Importancia: {draft.importance}/5"
                    input { r#type: "range", min: "1", max: "5", step: "1", value: "{draft.importance}", disabled: busy,
                        oninput: move |event| change(|draft, v| { if let Ok(value) = v.parse() { draft.importance = value; } }, event.value()) }
                }
            }
            div { class: "action-row",
                button { r#type: "button", class: "secondary", disabled: busy, onclick: move |_| { edit.set(None); plan.set(None); }, "Cancelar" }
                button { r#type: "button", class: "primary", disabled: busy, onclick: move |_| run.call((Notice::Main, operation.clone())), "{label}" }
            }
        }
    }
}
