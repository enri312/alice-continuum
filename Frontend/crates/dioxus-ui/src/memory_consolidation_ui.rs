use crate::memory_lifecycle_ui::action_button;
use crate::memory_maintenance_model::{Candidate, Consolidation, Maintenance, MergePlan, Recovery};
use crate::memory_page_ui::{notice, Notice};
use dioxus::prelude::*;
use serde_json::{json, Value};
use std::collections::BTreeMap;

type Handler = EventHandler<(Notice, Value)>;

pub fn consolidation_panel(
    data: &Maintenance,
    survivor: Signal<BTreeMap<String, String>>,
    desktop: bool,
    busy: bool,
    message: &str,
    run: Handler,
) -> Element {
    let state = data.consolidation.as_ref();
    let status = state.map_or("unavailable", |value| value.state.as_str());
    let label = match (
        data.recovery.as_ref().map(|value| value.state.as_str()),
        state,
    ) {
        (Some("recoveryRequired"), _) => "RECUPERACIÓN REQUERIDA".into(),
        (Some("blocked"), _) => "RECUPERACIÓN BLOQUEADA".into(),
        (_, Some(value)) if status == "ready" => {
            format!("{} PENDIENTES", value.pending_candidate_count)
        }
        (_, Some(_)) if status == "blocked" => "BLOQUEADA".into(),
        (_, Some(_)) => "SIN FUENTE".into(),
        _ if data.loading => "CONSULTANDO FUENTE".into(),
        _ => "SIN BACKEND".into(),
    };
    let blocked = busy || data.loading || !desktop;
    let reason = state
        .and_then(|value| value.blocked_reason.as_deref())
        .unwrap_or(&data.error);
    rsx! {
        section { class: "consolidation-preview memory-view-panel state-{status}", "aria-labelledby": "consolidation-preview-title",
            header { div { p { class: "eyebrow", "R6.3-F · ESTADO NATIVO · RESTAURACIÓN GOBERNADA" }
                h3 { id: "consolidation-preview-title", "Candidatos de consolidación" }
                p { "Compara registros terminados y consulta el recibo durable. Ante una interrupción, puedes restaurar la fuente original con confirmación y auditoría. La fusión tiene una vista previa de solo lectura." } } span { "{label}" } }
            {recovery_status(data.recovery.as_ref(), blocked, run)}
            if !reason.is_empty() { p { class: "consolidation-blocked", role: "alert", "{reason}" } }
            if let Some(value) = state.filter(|value| value.state == "ready") {
                {candidate_list(data, value, survivor, blocked, run)}
            } else if state.is_some_and(|value| value.state == "unavailable") {
                div { class: "consolidation-empty", strong { "SIN ARCHIVO CANÓNICO" }
                    p { "Rust no encontró " code { "records.json" } ". La lectura no crea candidatos ni archivos." } }
            } else if state.is_none() {
                div { class: "consolidation-empty", strong { if data.loading { "LEYENDO SNAPSHOT NATIVO" } else { "SNAPSHOT NATIVO NO DISPONIBLE" } }
                    p { if !desktop { "Abre Alice como aplicación de escritorio para analizar el archivo canónico." }
                        else if !data.loading { "Actualizá la vista previa para volver a consultar la fuente." } } }
            }
            footer {
                div { strong { "CERO CAMBIOS AUTOMÁTICOS" } span { "Sin LLM · sin fusión · sin archivado · planes manuales ligados al SHA-256" } }
                {action_button("Actualizar vista previa", "secondary", blocked, json!({"type":"refreshMaintenance"}), run)}
            }
            {notice(message)}
        }
    }
}

fn recovery_status(recovery: Option<&Recovery>, blocked: bool, run: Handler) -> Element {
    let Some(recovery) = recovery else {
        return rsx! {
            section { class: "consolidation-recovery-status state-unavailable",
                div { strong { "ESTADO NATIVO NO DISPONIBLE" } span { "El recibo se consulta en la aplicación de escritorio." } }
                em { "FUSIÓN NO DISPONIBLE" }
            }
        };
    };
    let (label, detail) = match recovery.state.as_str() {
        "idle" => (
            "SIN TRANSACCIONES PENDIENTES",
            "No existe un recibo que requiera intervención.".into(),
        ),
        "recoveryRequired" => {
            let receipt = recovery
                .receipt
                .as_ref()
                .map_or("", |value| value.state.as_str())
                .to_uppercase();
            let source = recovery
                .source_relation
                .as_deref()
                .unwrap_or_default()
                .to_uppercase();
            (
                "RESTAURACIÓN DE SEGURIDAD DISPONIBLE",
                format!("RECIBO {receipt} · FUENTE {source}"),
            )
        }
        "restored" => (
            "ÚLTIMA TRANSACCIÓN RESTAURADA",
            "FUENTE ORIGINAL VERIFICADA · AUDITORÍA CERRADA".into(),
        ),
        _ => (
            "RECUPERACIÓN BLOQUEADA",
            recovery.blocked_reason.clone().unwrap_or_default(),
        ),
    };
    rsx! {
        section { class: "consolidation-recovery-status state-{recovery.state}", "aria-label": "Estado nativo de recuperación R6.3-F",
            div { strong { "{label}" } span { "{detail}" } }
            if let Some(receipt) = &recovery.receipt {
                code { "{receipt.transaction_id}" }
                if recovery.restoration_available {
                    {action_button("Confirmar y restaurar original", "danger", blocked || receipt.state == "restored",
                        json!({"type":"restoreConsolidation","id":receipt.transaction_id}), run)}
                }
            }
            em { "FUSIÓN NO DISPONIBLE" }
        }
    }
}

fn candidate_list(
    data: &Maintenance,
    state: &Consolidation,
    survivor: Signal<BTreeMap<String, String>>,
    blocked: bool,
    run: Handler,
) -> Element {
    let source = state.source_sha256.as_deref().unwrap_or_default();
    let metrics = [
        (
            state.record_count,
            "REGISTROS LEÍDOS",
            format!(
                "{} elegibles · {} archivados",
                state.eligible_record_count, state.archived_record_count
            ),
        ),
        (
            state.pending_candidate_count,
            "DECISIONES PENDIENTES",
            format!("{} pares detectados", state.candidate_count),
        ),
        (
            state.exact_duplicate_count,
            "DUPLICADOS EXACTOS",
            "Mismo contenido normalizado".into(),
        ),
        (
            state.review_required_count,
            "REVISIÓN REQUERIDA",
            "Mismo tema, contenido diferente".into(),
        ),
        (
            state.kept_separate_count,
            "MANTENER SEPARADOS",
            "Decisiones humanas registradas".into(),
        ),
    ];
    rsx! {
        div { class: "consolidation-summary",
            for (count, title, detail) in metrics {
                article { key: "{title}", strong { "{count}" } span { "{title}" } small { "{detail}" } }
            }
        }
        if state.candidates.is_empty() {
            div { class: "consolidation-empty", strong { "SIN CANDIDATOS" }
                p { "Los registros actuales no comparten una intención normalizada. No hay pares para revisar en R6.3." } }
        } else {
            div { class: "consolidation-candidates",
                for candidate in &state.candidates {
                    {candidate_row(data, candidate, source, survivor, blocked || source.is_empty(), run)}
                }
            }
        }
        div { class: "consolidation-source", span { "FUENTE VERIFICADA · SIN ESCRITURA" } code { "{source}" } }
    }
}

fn candidate_row(
    data: &Maintenance,
    candidate: &Candidate,
    source: &str,
    mut survivor: Signal<BTreeMap<String, String>>,
    blocked: bool,
    run: Handler,
) -> Element {
    let resolved = candidate.resolution.is_some();
    let exact = candidate.kind == "exactDuplicate";
    let marker = if resolved { "resolved" } else { "" };
    let label = if resolved {
        "MANTENER SEPARADOS"
    } else if exact {
        "DUPLICADO EXACTO"
    } else {
        "POSIBLE SOLAPAMIENTO"
    };
    let detail = if resolved {
        "El registro de decisión conserva ambos recuerdos sin cambiar records.json."
    } else if exact {
        "El contenido normalizado coincide. Seleccioná el superviviente para calcular un plan."
    } else {
        "El título normalizado coincide. La revisión humana determina el significado del solapamiento."
    };
    let selection = survivor.read();
    let selected = selection
        .get(&candidate.candidate_id)
        .map_or("", String::as_str);
    let plan = data
        .merges
        .get(&candidate.candidate_id)
        .filter(|item| !resolved && item.survivor_record_id == selected);
    let receipt = candidate
        .decision_id
        .as_deref()
        .unwrap_or(&candidate.candidate_id);
    rsx! {
        article { key: "{candidate.candidate_id}", class: "{candidate.kind} {marker}",
            header { span { "{label}" } small { if resolved { "DECISIÓN HUMANA REGISTRADA" } else { "REVISIÓN HUMANA OBLIGATORIA" } } }
            div {
                for (index, record_id) in candidate.record_ids.iter().enumerate() {
                    {
                        let record = data.candidate_records.get(record_id);
                        let title = record.map_or("Registro no cargado", |item| item.title.as_str());
                        let summary = record.map_or("Sin resumen", |item| item.summary.as_str());
                        let pair_id = candidate.candidate_id.clone();
                        let choice = record_id.clone();
                        rsx! {
                            section { key: "{record_id}",
                                small { "REGISTRO {index + 1} · {record_id}" }
                                strong { "{title}" }
                                p { "{summary}" }
                                if exact && !resolved {
                                    label { class: "merge-survivor-choice",
                                        input { r#type: "radio", name: "merge-survivor-{candidate.candidate_id}", checked: selected == record_id, disabled: blocked,
                                            onchange: move |_| { survivor.write().insert(pair_id.clone(), choice.clone()); } }
                                        span { "CONSERVAR ESTE REGISTRO" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            footer { div { code { "{receipt}" } span { "{detail}" } }
                if !resolved {
                    div { class: "consolidation-candidate-actions",
                        if exact { {action_button("Previsualizar fusión", "secondary", blocked || selected.is_empty(),
                            json!({"type":"previewMerge","id":candidate.candidate_id,"source":source,"survivor":selected}), run)} }
                        {action_button("Mantener separados", "secondary", blocked, json!({"type":"keepSeparate","id":candidate.candidate_id,"source":source}), run)}
                    }
                }
            }
            if let Some(plan) = plan { {merge_preview(plan)} }
        }
    }
}

fn merge_preview(plan: &MergePlan) -> Element {
    let difference = if plan.differing_fields.is_empty() {
        "Ninguna. Ambos registros también coinciden sin normalización.".into()
    } else {
        plan.differing_fields
            .iter()
            .map(|field| difference_label(field))
            .collect::<Vec<_>>()
            .join(" · ")
    };
    let backup = if plan.source_backup_status == "verified" {
        "YA VERIFICADO"
    } else {
        "AÚN NO CREADO"
    };
    let layers = match plan.layer_impact.as_str() {
        "activeRevisionWillBecomeStale" => "REVISIÓN ACTIVA QUEDARÍA OBSOLETA",
        "inactive" => "ÍNDICE INACTIVO",
        _ => "SIN ÍNDICE",
    };
    let report = if plan.restoration_command_available {
        "RESTAURACIÓN R6.3-F DISPONIBLE SÓLO CON RECIBO"
    } else {
        "RESTAURACIÓN DESCONECTADA"
    };
    rsx! {
        section { class: "merge-preview-plan", "aria-label": "Plan de fusión sin ejecución",
            header { div { strong { "PLAN R6.3-F VERIFICADO" } span { "SOLO LECTURA · NO EJECUTABLE" } } code { "{plan.projected_source_sha256}" } }
            dl {
                div { dt { "SUPERVIVIENTE" } dd { "{plan.survivor_record_id}" } }
                div { dt { "SE RETIRARÍA" } dd { "{plan.duplicate_record_id}" } }
                div { dt { "REGISTROS" } dd { "{plan.current_record_count} → {plan.projected_record_count}" } }
                div { dt { "TAMAÑO PROYECTADO" } dd { "{plan.projected_source_byte_length} bytes" } }
                div { dt { "RESPALDO" } dd { "{backup}" } }
                div { dt { "CAPAS R6.1" } dd { "{layers}" } }
            }
            p { strong { "DIFERENCIAS ORIGINALES" } "{difference}" }
            div { class: "merge-recovery-chain",
                strong { "PROTOCOLO R6.3-D · {plan.recovery_steps.len()} PASOS" }
                ol {
                    for (index, step) in plan.recovery_steps.iter().enumerate() {
                        li { key: "{step}", span { "{index + 1:02}" } "{step_label(step)}" }
                    }
                }
            }
            div { class: "merge-transaction-receipt",
                div { strong { "RECIBO R6.3-E · V{plan.transaction_receipt_version}" } span { "RECUPERACIÓN TRAS REINICIO OBLIGATORIA" } }
                code { "{plan.transaction_receipt_file}" } em { "{report}" }
            }
            footer { strong { "FUSIÓN NO DISPONIBLE" }
                span { if plan.active_layer_execution_blocked { "La proyección R6.1 activa debe cerrarse antes de cualquier ensayo. " }
                    else { "El protocolo exige respaldo byte a byte, reemplazo atómico, auditoría y restauración verificada. " }
                    "Esta vista no modificó archivos."
                }
            }
        }
    }
}

fn step_label(step: &str) -> &str {
    match step {
        "verifySource" => "VERIFICAR FUENTE",
        "createOrVerifyBackup" => "RESPALDO EXACTO",
        "prepareProjectedSource" => "PREPARAR PROYECCIÓN",
        "atomicReplace" => "REEMPLAZO ATÓMICO",
        "verifyProjectedSource" => "VERIFICAR RESULTADO",
        "writeAudit" => "AUDITAR",
        "restoreBackupOnFailure" => "RESTAURAR SI FALLA",
        "verifyRestoredSource" => "VERIFICAR RESTAURACIÓN",
        _ => step,
    }
}

fn difference_label(field: &str) -> &str {
    match field {
        "kind" => "tipo",
        "intention" => "título original",
        "startedAt" => "inicio",
        "finishedAt" => "cierre",
        "summary" => "contenido original",
        "nextStep" => "próximo paso original",
        "memoryType" => "clase de memoria",
        "source" => "fuente",
        "importance" => "importancia",
        "storageStrength" => "fuerza",
        "memoryStatus" => "estado",
        "suppressionStatus" => "estado de supresión",
        "suppressionReason" => "motivo de supresión",
        "suppressionUpdatedAt" => "fecha de supresión",
        "archiveStatus" => "estado de archivo",
        "archiveReason" => "motivo de archivo",
        "archiveUpdatedAt" => "fecha de archivo",
        "deletionStatus" => "retención para eliminación",
        "deletionReason" => "motivo de eliminación",
        "deletionRequestedAt" => "solicitud de eliminación",
        "deletionEligibleAt" => "fin de espera",
        "memoryVersion" => "versión de memoria",
        "reconsolidatedAt" => "fecha de reconsolidación",
        "reconsolidationReason" => "motivo de reconsolidación",
        "previousVersionSha256" => "huella de versión anterior",
        "successfulRecalls" => "usos correctos",
        "failedRecalls" => "usos fallidos",
        "lastRecalledAt" => "último uso",
        "retrievalEvidenceVersion" => "versión de evidencia de recuperación",
        "successfulReviews" => "revisiones",
        "correctionCount" => "correcciones",
        "lastReviewedAt" => "última revisión",
        "contextEvents" => "eventos de contexto",
        _ => field,
    }
}
