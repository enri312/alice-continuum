use crate::memory_maintenance_model::{LifecycleRow, LifecycleStats, Maintenance, RecordPlan};
use crate::memory_page_ui::{notice, Notice};
use dioxus::prelude::*;
use serde_json::{json, Value};
use std::collections::BTreeMap;

type Handler = EventHandler<(Notice, Value)>;

pub struct ReviewDraft {
    pub suppression: String,
    pub archive_reason: String,
    pub archive_note: String,
    pub retention_reason: String,
    pub retention_note: String,
    pub sources: BTreeMap<String, String>,
}

impl Default for ReviewDraft {
    fn default() -> Self {
        Self {
            suppression: "ownerChoice".into(),
            archive_reason: "ownerChoice".into(),
            archive_note: String::new(),
            retention_reason: "ownerRequest".into(),
            retention_note: String::new(),
            sources: BTreeMap::new(),
        }
    }
}

pub fn action_button(
    label: &str,
    class: &str,
    disabled: bool,
    action: Value,
    run: Handler,
) -> Element {
    rsx! {
        button { r#type: "button", class, disabled,
            onclick: move |_| run.call((Notice::Main, action.clone())), "{label}" }
    }
}

fn counter(count: usize, label: &str, pending: bool) -> Element {
    rsx! {
        div { class: if pending { "review-counter pending" } else { "review-counter" },
            strong { "{count}" } span { "{label}" } }
    }
}

fn empty_section(mark: &str, title: &str, detail: &str) -> Element {
    rsx! { div { class: "memory-review-empty", div { span { "{mark}" } strong { "{title}" } } p { "{detail}" } } }
}

fn lifecycle_metrics(stats: &LifecycleStats, revisions: u32) -> Element {
    let rows = [
        (
            stats.current_count,
            "VIGENTES",
            "Estado confirmado explícito".into(),
            "",
        ),
        (
            stats.conflict_count,
            "CONFLICTOS",
            "Requieren corrección · excluidos del RAG".into(),
            "blocked",
        ),
        (
            stats.not_assessed_count,
            "VIGENCIA NO EVALUADA",
            "Registros históricos sin inferencia".into(),
            "pending",
        ),
        (
            stats.accessible_count,
            "ACCESIBLES EXPLÍCITOS",
            format!(
                "{} decisiones de accesibilidad",
                stats.accessibility_assessed_count
            ),
            "",
        ),
        (
            stats.dormant_count,
            "EN REPOSO",
            "Persisten, pero RAG no los recupera".into(),
            "pending",
        ),
        (
            stats.retrieval_blocked_count,
            "RECUPERACIÓN BLOQUEADA",
            format!(
                "{} conflictos · {} archivados · {} en reposo · {} suprimidos",
                stats.conflict_count,
                stats.archived_count,
                stats.dormant_count,
                stats.suppressed_count
            ),
            "blocked",
        ),
        (
            stats.retrieval_outcome_count,
            "RESULTADOS CONFIRMADOS",
            "Útil o no ayudó · sólo evidencia R6.5-F".into(),
            "",
        ),
        (
            stats.functional_assessment_count,
            "EVALUACIONES SUFICIENTES",
            format!(
                "{} requieren revisión humana",
                stats.weakening_review_required_count
            ),
            if stats.weakening_review_required_count > 0 {
                "pending"
            } else {
                ""
            },
        ),
        (
            stats.suppressed_count,
            "SUPRIMIDOS",
            "Decisiones voluntarias y reversibles R6.5-G".into(),
            "pending",
        ),
        (
            stats.reconsolidated_count,
            "RECONSOLIDADOS",
            "Versión anterior preservada · R6.5-H".into(),
            "",
        ),
    ];
    rsx! {
        div { class: "memory-lifecycle-grid",
            for (count, label, text, marker) in rows {
                article { key: "{label}", class: if count > 0 { marker } else { "" }, strong { "{count}" } span { "{label}" } small { "{text}" } }
            }
        }
        div { class: "memory-layer-evidence", span { "FUENTE · {stats.record_count} REGISTROS REALES" }
            code { "{stats.source_sha256}" } span { "{revisions} REVISIONES · POLÍTICA APLICADA POR RAG" } }
    }
}

pub fn lifecycle_panel(
    state: &Maintenance,
    draft: Signal<ReviewDraft>,
    due: usize,
    desktop: bool,
    busy: bool,
    message: &str,
    run: Handler,
    invalidate: EventHandler<&'static str>,
) -> Element {
    let lifecycle = state.lifecycle.as_ref();
    let status = lifecycle.map_or("unavailable", |value| value.state.as_str());
    let preview = lifecycle.and_then(|value| value.preview.as_ref());
    let source = lifecycle
        .and_then(|value| value.source_sha256.as_deref())
        .unwrap_or_default();
    let blocked = busy || state.loading || !desktop || source.is_empty();
    let label = match status {
        "active" => "ACTIVO",
        "rolledBack" => "REVERTIDO",
        "sourceChanged" => "FUENTE CAMBIÓ",
        _ => "referencias",
    };
    let metric_count = preview.map_or(0, |stats| stats.record_count) as usize;
    let revisions = lifecycle.map_or(0, |snapshot| snapshot.revision_count);
    let blocked_reason = lifecycle
        .and_then(|value| value.blocked_reason.as_deref())
        .unwrap_or(&state.error);
    rsx! {
        section { class: "memory-review-panel memory-view-panel state-{status}", "aria-labelledby": "memory-review-title",
            header {
                div { p { class: "eyebrow", "R6.5-I · ARCHIVO REVERSIBLE · CICLO GOBERNADO" }
                    h3 { id: "memory-review-title", "Ciclo, vigencia, accesibilidad y recuperación" }
                    p { "Vigencia, accesibilidad, debilitamiento, supresión, archivo y reconsolidación son decisiones separadas. El propietario autoriza las transiciones." }
                }
                {counter(metric_count, label, matches!(status, "blocked" | "sourceChanged"))}
            }
            if !blocked_reason.is_empty() { p { class: "memory-layer-blocked", role: "alert", "{blocked_reason}" } }
            if let Some(stats) = preview { {lifecycle_metrics(stats, revisions)} }
            else { div { class: "memory-layer-empty",
                if state.loading { "Verificando records.json…" }
                else if !desktop { "Abre Nyxia como aplicación de escritorio para consultar el ciclo nativo." }
                else { "No existe una vista previa disponible." }
            } }
            div { class: "memory-lifecycle-boundary",
                strong { "FRONTERA ACTUAL" }
                span { "R6.5-J exige archivo previo, siete días cancelables, otra vista previa, segunda confirmación, resguardo exacto y auditoría para retirar un recuerdo." }
                div { class: "memory-lifecycle-actions",
                    {action_button("Actualizar", "secondary", busy || state.loading || !desktop, json!({"type":"refreshMaintenance"}), run)}
                    if lifecycle.is_some_and(|value| value.lifecycle_writes_available && value.state != "active") {
                        {action_button("Revisé la huella · activar", "primary", blocked || preview.is_none(), json!({"type":"activateLifecycle", "source":source}), run)}
                    }
                    if let Some(id) = lifecycle.and_then(|value| value.active_revision_id.as_deref()) {
                        {action_button("Desactivar", "danger", busy || state.loading, json!({"type":"rollbackLifecycle", "id":id}), run)}
                    }
                }
            }
            {weakening_panel(state, preview.map_or(0, |stats| stats.weakening_review_required_count) as usize)}
            {suppression_panel(&state.rows, draft, source, blocked, run)}
            {archive_panel(state, draft, source, blocked, run, invalidate)}
            {retention_panel(state, draft, source, blocked, run, invalidate)}
            {validity_panel(&state.rows, draft, source, blocked, run)}
            {accessibility_panel(&state.rows, source, preview.map_or(0, |stats| stats.dormant_count) as usize, blocked, run)}
            {teaching_panel(state, due, busy || state.loading, run)}
            footer { "INTERVALOS EXPLICABLES · 1 · 3 · 7 · 14 · 30 · 60 · 120 DÍAS" }
            {notice(message)}
        }
    }
}

fn weakening_panel(state: &Maintenance, due: usize) -> Element {
    rsx! {
        section { class: "memory-accessibility-assessment memory-weakening-assessment", "aria-label": "Debilitamiento funcional evaluado",
            header { div { p { class: "eyebrow", "EVIDENCIA FUNCIONAL · MÍNIMO 3 RESULTADOS · SIN ACCIÓN AUTOMÁTICA" }
                h4 { "Utilidad de recuerdos recuperados" }
                p { "Después de usar RAG, Conversación pregunta si cada recuerdo ayudó. Dos tercios de resultados “no ayudó”, con al menos tres intentos, generan una señal para revisar." } }
                {counter(due, "por revisar", due > 0)} }
            if state.evidence.is_empty() {
                {empty_section("○", "Sin resultados explícitos todavía", "Los contadores anteriores a R6.5-F no se consideran evidencia. La próxima conversación real que use recuerdos permitirá evaluarlos.")}
            } else {
                div { class: "memory-accessibility-list",
                    for item in &state.evidence {
                        article { key: "{item.record_id}", class: "state-{item.state}",
                            div {
                                span { if item.state == "reviewRequired" { "REVISIÓN REQUERIDA" }
                                    else if item.state == "noWeakeningSignal" { "SIN SEÑAL DE DEBILITAMIENTO" }
                                    else { "EVIDENCIA AÚN INSUFICIENTE" } }
                                h4 { "{item.title}" }
                                small { "{item.helpful_outcomes} útil · {item.not_helpful_outcomes} no ayudó · {item.evidence_count}/3 mínimo" }
                            }
                            div { class: "memory-review-actions", small { "SIN CAMBIO AUTOMÁTICO" } }
                        }
                    }
                }
            }
        }
    }
}

fn row_action(row: &LifecycleRow, source: &str, operation: &str, decision: &str) -> Value {
    json!({"type":operation,"id":row.record_id,"hash":row.record_sha256,"source":source,"decision":decision})
}

fn short_hash(row: &LifecycleRow) -> &str {
    row.record_sha256.get(7..19).unwrap_or(&row.record_sha256)
}

fn reason_field(
    label: &str,
    selected: &str,
    values: &[(&str, &str)],
    blocked: bool,
    mut change: impl FnMut(String) + 'static,
) -> Element {
    rsx! {
        label { class: "suppression-reason", span { "{label}" }
            select { value: selected, disabled: blocked, onchange: move |event| change(event.value()),
                for (id, text) in values { option { key: "{id}", value: "{id}", "{text}" } }
            }
        }
    }
}

fn suppression_panel(
    rows: &[LifecycleRow],
    mut draft: Signal<ReviewDraft>,
    source: &str,
    blocked: bool,
    run: Handler,
) -> Element {
    let candidates: Vec<_> = rows
        .iter()
        .filter(|row| row.validity == "current" || row.suppressed)
        .collect();
    let draft_read = draft.read();
    let reason = &draft_read.suppression;
    let reasons = [
        ("ownerChoice", "Elección del propietario"),
        ("sensitiveContext", "Contexto sensible"),
        ("temporaryBoundary", "Límite temporal"),
    ];
    let change = move |reason| draft.write().suppression = reason;
    rsx! {
        section { class: "memory-accessibility-assessment memory-suppression-assessment", "aria-label": "Supresión voluntaria de recuerdos",
            header { div { p { class: "eyebrow", "R6.5-G · DECISIÓN DEL PROPIETARIO · REVERSIBLE · AUDITADA" }
                h4 { "Supresión voluntaria" }
                p { "Impide que un recuerdo aparezca espontáneamente. Liberarlo restaura la política que corresponda por vigencia y accesibilidad, con su contenido y fuerza intactos." } }
                {reason_field("MOTIVO CERRADO", reason, &reasons, blocked, change)}
            }
            if candidates.is_empty() { {empty_section("○", "Sin recuerdos gobernables", "Se necesita un recuerdo vigente. Uno que ya está suprimido sigue disponible para liberación.")} }
            else {
                div { class: "memory-accessibility-list",
                    for row in candidates {
                        {
                            let mut suppress = row_action(row, source, "assessSuppression", "suppress");
                            let mut release = row_action(row, source, "assessSuppression", "release");
                            suppress["reason"] = json!(reason);
                            release["reason"] = json!(reason);
                            let validity = row.validity.to_uppercase();
                            rsx! {
                                article { key: "{row.record_id}", class: if row.suppressed { "state-suppressed" } else { "state-available" },
                                    div { span { if row.suppressed { "SUPRIMIDO · EXCLUIDO DEL RAG" } else { "NO SUPRIMIDO" } }
                                        h4 { "{row.title}" } small { "{validity} · huella {short_hash(row)}" } }
                                    div { class: "memory-review-actions",
                                        {action_button("Suprimir","secondary", blocked || row.suppressed, suppress, run)}
                                        {action_button("Liberar","primary", blocked || !row.suppressed, release, run)}
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

fn record_plan(plan: &RecordPlan, group: &str, blocked: bool, run: Handler) -> Element {
    let (style, label) = if plan.r#final {
        (
            "archive-plan deletion-final-plan",
            "Confirmar retiro de records.json",
        )
    } else {
        ("archive-plan", "Segunda confirmación")
    };
    rsx! {
        div { class: style, div { strong { "{plan.label}" } span { "{plan.record_id} · {plan.detail}" } code { "{plan.id}" } small { "{plan.note}" } }
            {action_button(label, "danger", blocked, json!({"type":"confirmRecordPlan","group":group,"planId":plan.id}), run)}
        }
    }
}

fn plan_action(
    row: &LifecycleRow,
    source: &str,
    kind: &str,
    decision: &str,
    reason: &str,
    note: &str,
) -> Value {
    let mut action = row_action(row, source, kind, decision);
    action["reason"] = json!(reason);
    action["note"] = json!(note);
    action
}

fn archive_panel(
    state: &Maintenance,
    mut draft: Signal<ReviewDraft>,
    source: &str,
    blocked: bool,
    run: Handler,
    invalidate: EventHandler<&'static str>,
) -> Element {
    let candidates: Vec<_> = state
        .rows
        .iter()
        .filter(|row| matches!(row.validity.as_str(), "current" | "conflict"))
        .collect();
    let draft_read = draft.read();
    let reason = &draft_read.archive_reason;
    let note = &draft_read.archive_note;
    let reasons = [
        ("ownerChoice", "Elección del propietario"),
        ("superseded", "Sustituido por otro recuerdo"),
        ("noLongerRelevant", "Ya no es relevante"),
    ];
    let change = move |reason| {
        draft.write().archive_reason = reason;
        invalidate.call("archive");
    };
    let disabled = blocked || note.trim().is_empty();
    rsx! {
        section { class: "memory-accessibility-assessment memory-archive-assessment", "aria-label": "Archivo reversible de recuerdos",
            header { div { p { class: "eyebrow", "R6.5-I · ARCHIVO INDEPENDIENTE · DOS CONFIRMACIONES · AUDITADO" }
                h4 { "Archivo reversible" }
                p { "Retira un recuerdo del RAG y conserva su vigencia, contenido, reposo, supresión y versión. Restaurar recupera la política que corresponda a esos estados." } }
                {reason_field("MOTIVO DE ARCHIVO", reason, &reasons, blocked, change)}
            }
            label { class: "archive-note", span { "NOTA OBLIGATORIA · SE CONSERVA SÓLO SU SHA-256" }
                textarea { value: note, maxlength: 500, disabled: blocked, placeholder: "Explicá por qué debe archivarse o por qué vuelve a ser relevante…",
                    oninput: move |event| { draft.write().archive_note = event.value(); invalidate.call("archive"); } }
            }
            if candidates.is_empty() { {empty_section("○", "Sin recuerdos con vigencia restaurable", "Los archivos heredados permanecen bloqueados porque carecen de su vigencia anterior.")} }
            else {
                div { class: "memory-accessibility-list",
                    for row in candidates {
                        {
                            let validity = row.validity.to_uppercase();
                            let accessibility = row.accessibility.to_uppercase();
                            let suppression = if row.suppressed { "SUPRIMIDO · " } else { "" };
                            let archive = plan_action(row, source, "previewArchive", "archive", reason, note);
                            let restore = plan_action(row, source, "previewArchive", "restore", reason, note);
                            rsx! {
                                article { key: "{row.record_id}", class: if row.archived { "state-archived" } else { "state-available" },
                                    div { span { if row.archived { "ARCHIVADO · EXCLUIDO DEL RAG" } else { "ACTIVO · NO ARCHIVADO" } }
                                        h4 { "{row.title}" } small { "VIGENCIA {validity} · {suppression}{accessibility} · huella {short_hash(row)}" } }
                                    div { class: "memory-review-actions",
                                        {action_button("Preparar archivo", "secondary", disabled || row.archived, archive, run)}
                                        {action_button("Preparar restauración", "primary", disabled || !row.archived, restore, run)}
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if let Some(plan) = &state.archive_plan { {record_plan(plan, "archive", disabled, run)} }
        }
    }
}

fn retention_panel(
    state: &Maintenance,
    mut draft: Signal<ReviewDraft>,
    source: &str,
    blocked: bool,
    run: Handler,
    invalidate: EventHandler<&'static str>,
) -> Element {
    let candidates: Vec<_> = state
        .rows
        .iter()
        .filter(|row| row.archived && row.validity != "archived")
        .collect();
    let draft_read = draft.read();
    let reason = &draft_read.retention_reason;
    let note = &draft_read.retention_note;
    let reasons = [
        ("ownerRequest", "Solicitud del propietario"),
        ("duplicateAfterMerge", "Duplicado tras consolidación"),
        ("privacyRemoval", "Retiro por privacidad"),
    ];
    let change = move |reason| {
        draft.write().retention_reason = reason;
        invalidate.call("retention");
    };
    let disabled = blocked || note.trim().is_empty();
    let now = js_sys::Date::now();
    rsx! {
        section { class: "memory-accessibility-assessment memory-deletion-assessment", "aria-label": "Retención y eliminación gobernada de recuerdos",
            header { div { p { class: "eyebrow", "R6.5-J · ARCHIVO PREVIO · 7 DÍAS · DOBLE CONFIRMACIÓN · RESGUARDO" }
                h4 { "Retención antes de eliminar" }
                p { "Primero se programa una espera cancelable. Al vencer, una nueva vista previa y confirmación pueden retirar el registro. El resguardo privado conserva una copia exacta." } }
                {reason_field("MOTIVO CERRADO", reason, &reasons, blocked, change)}
            }
            label { class: "archive-note", span { "NOTA OBLIGATORIA · SÓLO SE CONSERVA SU SHA-256" }
                textarea { value: note, maxlength: 500, disabled: blocked, placeholder: "Explicá por qué se programa, cancela o confirma el retiro…",
                    oninput: move |event| { draft.write().retention_note = event.value(); invalidate.call("retention"); } }
            }
            if candidates.is_empty() { {empty_section("○", "Sin recuerdos archivados elegibles", "Archivar es el paso previo. Para programar la espera también hace falta conservar la vigencia anterior.")} }
            else {
                div { class: "memory-accessibility-list",
                    for row in candidates {
                        {
                            let scheduled = row.retention == "deletionScheduled";
                            let eligible = row.eligible_at_ms.is_some_and(|time| time <= now);
                            let status = match (scheduled, eligible) {
                                (true, true) => "ESPERA CUMPLIDA · ELIMINACIÓN DISPONIBLE",
                                (true, false) => "ELIMINACIÓN PROGRAMADA · CANCELABLE",
                                _ => "ARCHIVADO · SIN ELIMINACIÓN PROGRAMADA",
                            };
                            let schedule = plan_action(row, source, "previewRetention", "schedule", reason, note);
                            let cancel = plan_action(row, source, "previewRetention", "cancel", reason, note);
                            let retire = plan_action(row, source, "previewRetirement", "retire", reason, note);
                            rsx! {
                                article { key: "{row.record_id}", class: if scheduled { "state-suppressed" } else { "state-archived" },
                                    div { span { "{status}" } h4 { "{row.title}" }
                                        small { if let Some(date) = row.eligible_at.as_deref().filter(|_| scheduled) { "ELEGIBLE {date}" }
                                            else { "ESPERA FIJA DE 7 DÍAS" } " · huella {short_hash(row)}" } }
                                    div { class: "memory-review-actions",
                                        {action_button("Programar espera", "secondary", disabled || scheduled, schedule, run)}
                                        {action_button("Cancelar", "primary", disabled || !scheduled, cancel, run)}
                                        {action_button("Preparar retiro final", "danger", disabled || !scheduled || !eligible, retire, run)}
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if let Some(plan) = &state.retention_plan { {record_plan(plan, "retention", disabled, run)} }
        }
    }
}

fn validity_panel(
    rows: &[LifecycleRow],
    mut draft: Signal<ReviewDraft>,
    source: &str,
    blocked: bool,
    run: Handler,
) -> Element {
    let candidates: Vec<_> = rows
        .iter()
        .filter(|row| row.validity == "notAssessed")
        .collect();
    let count = candidates.len();
    let state = draft.read();
    rsx! {
        section { class: "memory-validity-assessment", "aria-label": "Recuerdos sin vigencia evaluada",
            header { div { p { class: "eyebrow", "DECISIÓN HUMANA · PROCEDENCIA · RESPALDO EXACTO · AUDITORÍA" }
                h4 { "Recuerdos aún no evaluados" }
                p { "Si falta la procedencia, debe declararse junto con la primera decisión de vigencia. La operación conserva contenido, clase y fuerza." } }
                {counter(count, "sin evaluar", count > 0)} }
            if count == 0 { {empty_section("✓", "Todos poseen vigencia explícita", "La vigencia proviene de los registros consultados.")} }
            else {
                div { class: "memory-validity-list",
                    for row in candidates {
                        {
                            let id = row.record_id.clone();
                            let saved = state.sources.get(&id).map_or("", String::as_str);
                            let declared = if row.source.is_empty() { saved.trim() } else { &row.source };
                            let mut confirm = row_action(row, source, "assessValidity", "confirmCurrent");
                            let mut conflict = row_action(row, source, "assessValidity", "markConflict");
                            confirm["declaredSource"] = json!(declared);
                            conflict["declaredSource"] = json!(declared);
                            let disabled = blocked || declared.is_empty();
                            rsx! {
                                article { key: "{row.record_id}",
                                    div { span { "NO EVALUADO · {row.kind}" } h4 { "{row.title}" } small { "{row.date} · huella {short_hash(row)}" }
                                        if row.source.is_empty() {
                                            label { class: "memory-validity-source", span { "PROCEDENCIA OBLIGATORIA" }
                                                input { value: saved, maxlength: 300, disabled: blocked,
                                                    oninput: move |event| { draft.write().sources.insert(id.clone(), event.value()); },
                                                    placeholder: "Ej.: conversación directa, importación Gemini o perfil Claude" }
                                            }
                                        } else { em { class: "memory-validity-source-declared", "PROCEDENCIA DECLARADA · {row.source}" } }
                                    }
                                    div { class: "memory-review-actions",
                                        if row.discardable { {action_button("Descartar fragmento", "danger", blocked, json!({"type":"discard","id":row.record_id}), run)} }
                                        {action_button("Necesita corrección", "secondary", disabled, conflict, run)}
                                        {action_button("Confirmar vigente", "primary", disabled, confirm, run)}
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

fn accessibility_panel(
    rows: &[LifecycleRow],
    source: &str,
    dormant: usize,
    blocked: bool,
    run: Handler,
) -> Element {
    let candidates: Vec<_> = rows
        .iter()
        .filter(|row| row.validity == "current")
        .collect();
    rsx! {
        section { class: "memory-accessibility-assessment", "aria-label": "Accesibilidad de recuerdos vigentes",
            header { div { p { class: "eyebrow", "ACCESIBILIDAD · DIFERENTE DE VERDAD, VIGENCIA Y FUERZA" }
                h4 { "Disponibilidad para recuperación" }
                p { "Un recuerdo en reposo se conserva y puede volver a habilitarse. Conversación lo excluye del RAG mientras permanezca así." } }
                {counter(dormant, "en reposo", dormant > 0)} }
            if candidates.is_empty() { {empty_section("○", "Sin recuerdos vigentes", "Primero debe resolverse su vigencia.")} }
            else {
                div { class: "memory-accessibility-list",
                    for row in candidates {
                        {
                            let status = match row.accessibility.as_str() {
                                "dormant" => "EN REPOSO", "accessible" => "ACCESIBLE EXPLÍCITO", _ => "ACCESIBILIDAD NO EVALUADA",
                            };
                            let retrieval = if row.retrieval_policy.starts_with("blockedBy") { "EXCLUIDO DEL RAG" } else { "ELEGIBLE PARA RAG" };
                            rsx! {
                                article { key: "{row.record_id}", class: "state-{row.accessibility}",
                                    div { span { "{status}" } h4 { "{row.title}" } small { "{retrieval} · huella {short_hash(row)}" } }
                                    div { class: "memory-review-actions",
                                        {action_button("Poner en reposo", "secondary", blocked || row.accessibility == "dormant",
                                            row_action(row, source, "assessAccessibility", "setDormant"), run)}
                                        {action_button("Permitir recuperación", "primary", blocked || row.accessibility == "accessible",
                                            row_action(row, source, "assessAccessibility", "makeAccessible"), run)}
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

fn teaching_panel(state: &Maintenance, due: usize, blocked: bool, run: Handler) -> Element {
    let upcoming = state
        .next_review
        .as_deref()
        .unwrap_or("No hay enseñanzas ya evaluadas con un repaso programado.");
    rsx! {
        section { class: "memory-review-queue", "aria-label": "Repaso espaciado de enseñanzas evaluadas",
            header { div { p { class: "eyebrow", "REPASO ESPACIADO · SÓLO ENSEÑANZAS YA EVALUADAS" }
                h4 { "Cola de estabilidad" }
                p { "El repaso, posterior a la primera evaluación de vigencia, ajusta el indicador local de estabilidad." } }
                {counter(due, if due == 1 { "pendiente" } else { "pendientes" }, due > 0)} }
            if state.pending_reviews.is_empty() { {empty_section("✓", "Sin repasos pendientes", upcoming)} }
            else {
                div { class: "memory-review-list",
                    for item in &state.pending_reviews {
                        article { key: "{item.id}",
                            div { span { if item.conflict { "CORRECCIÓN NECESARIA" } else { "REPASO VENCIDO" } }
                                h4 { "{item.title}" } small { "Estabilidad {item.stability}% · importancia {item.importance}/5" } }
                            div { class: "memory-review-actions",
                                {action_button("Necesita corrección", "secondary", blocked, json!({"type":"reviewTeaching","id":item.id,"decision":"needs-correction"}), run)}
                                {action_button("Repaso correcto", "primary", blocked, json!({"type":"reviewTeaching","id":item.id,"decision":"confirmed"}), run)}
                            }
                        }
                    }
                }
            }
        }
    }
}
