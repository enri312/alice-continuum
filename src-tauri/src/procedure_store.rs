use crate::audit::{append_audit_event, new_operation_id, AuditEvent, AuditOutcome, AuditStage};
use crate::capabilities::{
    current_capability_registry, current_utc_timestamp, validate_timestamp,
    CapabilityRegistrySnapshot, CapabilityRisk,
};
use crate::observation::ObservationStore;
use crate::procedure_learning::{
    detect_procedure_patterns, DetectedProcedurePattern, ProcedureCandidate,
    ProcedureCandidatePolicy, ProcedureCandidateStatus, ProcedureCandidateStep,
    ProcedureDetectionMethod, ProcedureEvidenceReference, ProcedureOccurrence,
    PROCEDURE_CANDIDATE_SCHEMA_VERSION,
};
use crate::sensory::SensorLeaseStore;
use crate::skills::{
    save_procedure_draft_guarded_at, skill_draft_records_guarded_at, validate_skill_id,
    SkillCapabilityRequirement, SkillDraftRecord, SkillDraftSaveInput, SkillDraftStore,
    SkillExecutionMode, SkillExecutionPolicy, SkillManifest, SkillOrigin, SkillOutput,
    SkillPrecondition, SkillPreconditionKind, SkillProcedureProvenance, SkillProvenance,
    SkillStatus, SkillStep, SkillStepKind, SkillSuccessCheck, SkillSuccessCheckKind,
    SkillValueKind, SKILL_MANIFEST_SCHEMA_VERSION,
};
use crate::util::{alice_data_root_path, timestamp_ms};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{AppHandle, State};
use uuid::Uuid;

pub(crate) const PROCEDURE_STORE_SCHEMA_VERSION: u32 = 1;
const PROCEDURE_STORE_FORMAT: &str = "alice-procedure-decisions";
const PROCEDURE_STORE_FILE: &str = "candidate-decisions-v1.json";
const MAX_PROCEDURE_DECISIONS: usize = 128;
const MAX_PROCEDURE_STORE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone, Default)]
pub(crate) struct ProcedureCandidateStore(Arc<Mutex<()>>);

impl ProcedureCandidateStore {
    fn lock(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.0
            .lock()
            .map_err(|_| "El almacén R5 quedó bloqueado por un fallo anterior".into())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProcedurePatternDecision {
    Retain,
    Dismiss,
}

impl ProcedurePatternDecision {
    fn operation(self) -> &'static str {
        match self {
            Self::Retain => "procedure.candidate.retain",
            Self::Dismiss => "procedure.candidate.dismiss",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProcedureDecisionActor {
    LocalOwner,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureDecisionConfirmation {
    actor: ProcedureDecisionActor,
    confirmed: bool,
    expected_fingerprint: String,
    reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedurePatternDecisionInput {
    fingerprint: String,
    action: ProcedurePatternDecision,
    title: Option<String>,
    purpose: Option<String>,
    suggested_skill_id: Option<String>,
    confirmation: ProcedureDecisionConfirmation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProcedureStoreDocument {
    schema_version: u32,
    format: String,
    updated_at_ms: u64,
    decisions: Vec<StoredProcedureDecision>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredProcedureDecision {
    decision_id: String,
    fingerprint: String,
    action: ProcedurePatternDecision,
    decided_at: String,
    reason_digest: String,
    candidate_sha256: Option<String>,
    candidate: Option<ProcedureCandidate>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedureDecisionSummary {
    decision_id: String,
    fingerprint: String,
    action: ProcedurePatternDecision,
    decided_at: String,
    candidate_id: Option<String>,
    title: Option<String>,
    suggested_skill_id: Option<String>,
    declared_risk: Option<CapabilityRisk>,
    step_count: usize,
    occurrence_count: usize,
    candidate_sha256: Option<String>,
    execution_enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedureCandidateStoreSnapshot {
    schema_version: u32,
    storage_path: String,
    existed: bool,
    decisions: Vec<ProcedureDecisionSummary>,
    execution_enabled: bool,
    skill_draft_created: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedurePatternDecisionResult {
    operation_id: String,
    decision: ProcedureDecisionSummary,
    storage_path: String,
    execution_enabled: bool,
    skill_draft_created: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureDraftConversionInput {
    fingerprint: String,
    expected_candidate_sha256: String,
    skill_id: String,
    title: String,
    description: String,
    purpose: String,
    confirmation: ProcedureDraftConversionConfirmation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureDraftConversionConfirmation {
    actor: ProcedureDecisionActor,
    confirmed: bool,
    expected_fingerprint: String,
    expected_candidate_sha256: String,
    reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedureDraftConversionSummary {
    fingerprint: String,
    decision_id: String,
    candidate_id: String,
    candidate_sha256: String,
    skill_id: String,
    revision_id: String,
    draft_sha256: String,
    updated_at: String,
    execution_enabled: bool,
    approved: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedureDraftConversionSnapshot {
    schema_version: u32,
    conversions: Vec<ProcedureDraftConversionSummary>,
    execution_enabled: bool,
    automatic_approval: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProcedureDraftConversionResult {
    operation_id: String,
    source_fingerprint: String,
    source_candidate_id: String,
    source_candidate_sha256: String,
    draft: SkillDraftRecord,
    execution_enabled: bool,
    approved: bool,
}

#[tauri::command]
pub(crate) fn procedure_candidate_store_status(
    app: AppHandle,
    store: State<ProcedureCandidateStore>,
) -> Result<ProcedureCandidateStoreSnapshot, String> {
    let _guard = store.lock()?;
    procedure_candidate_store_status_at(&alice_data_root_path(&app)?)
}

#[tauri::command]
pub(crate) fn record_procedure_pattern_decision(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    store: State<ProcedureCandidateStore>,
    input: ProcedurePatternDecisionInput,
) -> Result<ProcedurePatternDecisionResult, String> {
    let data_root = alice_data_root_path(&app)?;
    let (audit_healthy, events) = crate::audit::validated_visible_events_at(&data_root)?;
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let generated_at = current_utc_timestamp()?;
    let detection =
        detect_procedure_patterns(generated_at.clone(), audit_healthy, &registry, &events)?;
    let pattern = detection
        .patterns
        .iter()
        .find(|pattern| pattern.fingerprint == input.fingerprint)
        .ok_or("El patrón ya no está presente en la evidencia R3 vigente")?;
    validate_decision_input(&input, pattern)?;

    let operation_id = new_operation_id();
    append_audit_event(
        &app,
        &AuditEvent::procedure_decision(
            operation_id.clone(),
            input.action.operation().into(),
            AuditStage::Request,
            AuditOutcome::Pending,
            input.fingerprint.clone(),
            "PROCEDURE_DECISION_ACCEPTED",
        )?,
    )?;

    let _guard = store.lock()?;
    let decision = record_procedure_pattern_decision_at(
        &data_root,
        &registry,
        &events,
        pattern,
        generated_at,
        input,
    )?;
    append_audit_event(
        &app,
        &AuditEvent::procedure_decision(
            operation_id.clone(),
            decision.action.operation().into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            decision.fingerprint.clone(),
            "PROCEDURE_DECISION_RECORDED",
        )?,
    )?;
    Ok(ProcedurePatternDecisionResult {
        operation_id,
        decision: decision_summary(&decision),
        storage_path: procedure_store_path(&data_root).display().to_string(),
        execution_enabled: false,
        skill_draft_created: false,
    })
}

#[tauri::command]
pub(crate) fn procedure_draft_conversion_status(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    procedure_store: State<ProcedureCandidateStore>,
    skill_store: State<SkillDraftStore>,
) -> Result<ProcedureDraftConversionSnapshot, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let _guard = procedure_store.lock()?;
    procedure_draft_conversion_status_at(&alice_data_root_path(&app)?, &registry, &skill_store)
}

#[tauri::command]
pub(crate) fn convert_procedure_candidate_to_draft(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    procedure_store: State<ProcedureCandidateStore>,
    skill_store: State<SkillDraftStore>,
    input: ProcedureDraftConversionInput,
) -> Result<ProcedureDraftConversionResult, String> {
    let data_root = alice_data_root_path(&app)?;
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let now = current_utc_timestamp()?;
    let _guard = procedure_store.lock()?;
    let prepared = prepare_procedure_draft_at(&data_root, &registry, input, &now)?;
    let operation_id = new_operation_id();
    append_audit_event(
        &app,
        &AuditEvent::procedure_decision(
            operation_id.clone(),
            "procedure.candidate.convert".into(),
            AuditStage::Request,
            AuditOutcome::Pending,
            prepared.source_fingerprint.clone(),
            "PROCEDURE_CONVERSION_ACCEPTED",
        )?,
    )?;
    let draft = save_procedure_draft_guarded_at(
        &skill_store,
        &data_root,
        &registry,
        SkillDraftSaveInput {
            manifest: prepared.manifest,
            expected_revision_id: None,
        },
        &prepared.source_fingerprint,
    )?;
    append_audit_event(
        &app,
        &AuditEvent::procedure_decision(
            operation_id.clone(),
            "procedure.candidate.convert".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            prepared.source_fingerprint.clone(),
            "PROCEDURE_DRAFT_CREATED",
        )?,
    )?;
    Ok(ProcedureDraftConversionResult {
        operation_id,
        source_fingerprint: prepared.source_fingerprint,
        source_candidate_id: prepared.source_candidate_id,
        source_candidate_sha256: prepared.source_candidate_sha256,
        draft,
        execution_enabled: false,
        approved: false,
    })
}

struct PreparedProcedureDraft {
    source_fingerprint: String,
    source_candidate_id: String,
    source_candidate_sha256: String,
    manifest: SkillManifest,
}

fn prepare_procedure_draft_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: ProcedureDraftConversionInput,
    now: &str,
) -> Result<PreparedProcedureDraft, String> {
    validate_conversion_input(&input)?;
    let path = procedure_store_path(data_root);
    let (document, existed) = read_store(&path)?;
    if !existed {
        return Err("Todavía no existe un almacén de decisiones R5".into());
    }
    let decision = document
        .decisions
        .iter()
        .find(|decision| decision.fingerprint == input.fingerprint)
        .ok_or("No existe una decisión del propietario para esta huella")?;
    if decision.action != ProcedurePatternDecision::Retain {
        return Err("Un patrón descartado no puede convertirse en borrador".into());
    }
    let candidate = decision
        .candidate
        .as_ref()
        .ok_or("La decisión retain no conserva un candidato válido")?;
    let candidate_sha256 = decision
        .candidate_sha256
        .as_ref()
        .ok_or("La decisión retain no conserva SHA-256")?;
    if candidate_sha256 != &input.expected_candidate_sha256
        || input.confirmation.expected_candidate_sha256 != input.expected_candidate_sha256
        || input.confirmation.expected_fingerprint != input.fingerprint
    {
        return Err("La confirmación no coincide con el candidato R5 conservado".into());
    }

    let manifest = manifest_from_candidate(decision, candidate, &input, now)?;
    manifest.validate_new_draft(registry)?;
    Ok(PreparedProcedureDraft {
        source_fingerprint: decision.fingerprint.clone(),
        source_candidate_id: candidate.candidate_id.clone(),
        source_candidate_sha256: candidate_sha256.clone(),
        manifest,
    })
}

fn validate_conversion_input(input: &ProcedureDraftConversionInput) -> Result<(), String> {
    validate_digest("fingerprint", &input.fingerprint)?;
    validate_digest("expectedCandidateSha256", &input.expected_candidate_sha256)?;
    validate_skill_id(&input.skill_id)?;
    validate_text("title", &input.title, 1, 120)?;
    validate_text("description", &input.description, 1, 600)?;
    validate_text("purpose", &input.purpose, 1, 600)?;
    if input.confirmation.actor != ProcedureDecisionActor::LocalOwner
        || !input.confirmation.confirmed
    {
        return Err("La conversión exige confirmación explícita del propietario local".into());
    }
    validate_digest(
        "confirmation.expectedFingerprint",
        &input.confirmation.expected_fingerprint,
    )?;
    validate_digest(
        "confirmation.expectedCandidateSha256",
        &input.confirmation.expected_candidate_sha256,
    )?;
    validate_text("confirmation.reason", &input.confirmation.reason, 12, 600)
}

fn manifest_from_candidate(
    decision: &StoredProcedureDecision,
    candidate: &ProcedureCandidate,
    input: &ProcedureDraftConversionInput,
    now: &str,
) -> Result<SkillManifest, String> {
    let mut requirements = Vec::<SkillCapabilityRequirement>::new();
    for step in &candidate.steps {
        if let Some(requirement) = requirements
            .iter_mut()
            .find(|requirement| requirement.capability_id == step.capability_id)
        {
            if !requirement.operations.contains(&step.operation) {
                requirement.operations.push(step.operation.clone());
            }
        } else {
            requirements.push(SkillCapabilityRequirement {
                capability_id: step.capability_id.clone(),
                operations: vec![step.operation.clone()],
                reason: "Operación observada en un procedimiento R5 retenido por el propietario."
                    .into(),
            });
        }
    }
    let preconditions = requirements
        .iter()
        .enumerate()
        .map(|(index, requirement)| SkillPrecondition {
            id: format!("capability-{}", index + 1),
            label: format!("Capacidad {} disponible", index + 1),
            description:
                "La capacidad observada debe continuar registrada antes de cualquier simulación."
                    .into(),
            kind: SkillPreconditionKind::CapabilityAvailable,
            reference: requirement.capability_id.clone(),
        })
        .collect();
    let steps = candidate
        .steps
        .iter()
        .map(|step| SkillStep {
            id: step.id.clone(),
            title: format!("Paso {} · {}", step.position, step.operation),
            description: "Paso observado; el borrador sólo puede inspeccionarse y simularse en R4."
                .into(),
            kind: SkillStepKind::Capability,
            capability_id: Some(step.capability_id.clone()),
            operation: Some(step.operation.clone()),
            input_ids: vec![],
        })
        .collect();
    Ok(SkillManifest {
        schema_version: SKILL_MANIFEST_SCHEMA_VERSION,
        skill_id: input.skill_id.clone(),
        version: 1,
        revision_id: Uuid::new_v4().to_string(),
        title: input.title.clone(),
        description: input.description.clone(),
        purpose: input.purpose.clone(),
        provenance: SkillProvenance {
            author: "Propietario local".into(),
            origin: SkillOrigin::LocalUser,
            created_at: now.into(),
            updated_at: now.into(),
            parent_revision_id: None,
            procedure: Some(SkillProcedureProvenance {
                decision_id: decision.decision_id.clone(),
                candidate_id: candidate.candidate_id.clone(),
                fingerprint: decision.fingerprint.clone(),
                candidate_sha256: decision
                    .candidate_sha256
                    .clone()
                    .ok_or("Falta candidateSha256")?,
            }),
        },
        status: SkillStatus::Draft,
        declared_risk: candidate.declared_risk,
        execution: SkillExecutionPolicy {
            mode: SkillExecutionMode::SimulationOnly,
            enabled: false,
            allow_network: false,
            allow_process_launch: false,
            allow_local_write: false,
        },
        required_capabilities: requirements,
        inputs: vec![],
        outputs: vec![SkillOutput {
            id: "procedure-review".into(),
            label: "Resultado pendiente de revisión".into(),
            description:
                "Resultado declarado para inspección; el borrador no ejecuta el procedimiento."
                    .into(),
            kind: SkillValueKind::Text,
            sensitive: true,
        }],
        preconditions,
        steps,
        success_checks: vec![SkillSuccessCheck {
            id: "owner-review".into(),
            label: "Revisión del propietario".into(),
            description:
                "El propietario deberá revisar el plan simulado antes de cualquier transición R4."
                    .into(),
            kind: SkillSuccessCheckKind::ManualConfirmation,
            reference: "user".into(),
        }],
    })
}

fn procedure_draft_conversion_status_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    skill_store: &SkillDraftStore,
) -> Result<ProcedureDraftConversionSnapshot, String> {
    let (procedure_document, _) = read_store(&procedure_store_path(data_root))?;
    let mut conversions = skill_draft_records_guarded_at(skill_store, data_root, registry)?
        .into_iter()
        .filter_map(|draft| {
            let procedure = draft.manifest.provenance.procedure.clone()?;
            Some((draft, procedure))
        })
        .map(|(draft, procedure)| {
            let decision = procedure_document
                .decisions
                .iter()
                .find(|decision| decision.fingerprint == procedure.fingerprint)
                .ok_or("Un borrador declara procedencia R5 sin decisión verificable")?;
            let candidate = decision
                .candidate
                .as_ref()
                .ok_or("Un borrador R5 enlaza una decisión sin candidato")?;
            if decision.action != ProcedurePatternDecision::Retain
                || decision.decision_id != procedure.decision_id
                || candidate.candidate_id != procedure.candidate_id
                || decision.candidate_sha256.as_deref() != Some(&procedure.candidate_sha256)
            {
                return Err("La procedencia R5 del borrador no coincide con el almacén".into());
            }
            Ok(ProcedureDraftConversionSummary {
                fingerprint: procedure.fingerprint.clone(),
                decision_id: procedure.decision_id.clone(),
                candidate_id: procedure.candidate_id.clone(),
                candidate_sha256: procedure.candidate_sha256.clone(),
                skill_id: draft.manifest.skill_id.clone(),
                revision_id: draft.manifest.revision_id.clone(),
                draft_sha256: draft.sha256,
                updated_at: draft.manifest.provenance.updated_at.clone(),
                execution_enabled: false,
                approved: false,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    conversions.sort_by(|left, right| left.skill_id.cmp(&right.skill_id));
    Ok(ProcedureDraftConversionSnapshot {
        schema_version: 1,
        conversions,
        execution_enabled: false,
        automatic_approval: false,
    })
}

fn procedure_candidate_store_status_at(
    data_root: &Path,
) -> Result<ProcedureCandidateStoreSnapshot, String> {
    let path = procedure_store_path(data_root);
    let (document, existed) = read_store(&path)?;
    let mut decisions = document
        .decisions
        .iter()
        .map(decision_summary)
        .collect::<Vec<_>>();
    decisions.sort_by(|left, right| right.decided_at.cmp(&left.decided_at));
    Ok(ProcedureCandidateStoreSnapshot {
        schema_version: PROCEDURE_STORE_SCHEMA_VERSION,
        storage_path: data_root.join("procedures").display().to_string(),
        existed,
        decisions,
        execution_enabled: false,
        skill_draft_created: false,
    })
}

fn record_procedure_pattern_decision_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    audit_events: &[crate::audit::AuditEvent],
    pattern: &DetectedProcedurePattern,
    decided_at: String,
    input: ProcedurePatternDecisionInput,
) -> Result<StoredProcedureDecision, String> {
    validate_decision_input(&input, pattern)?;
    let path = procedure_store_path(data_root);
    let (mut document, _) = read_store(&path)?;
    if document
        .decisions
        .iter()
        .any(|decision| decision.fingerprint == input.fingerprint)
    {
        return Err("Este patrón ya tiene una decisión inmutable del propietario".into());
    }
    if document.decisions.len() >= MAX_PROCEDURE_DECISIONS {
        return Err(format!(
            "El almacén admite como máximo {MAX_PROCEDURE_DECISIONS} decisiones"
        ));
    }

    let candidate = if input.action == ProcedurePatternDecision::Retain {
        let candidate = candidate_from_pattern(pattern, &decided_at, &input)?;
        candidate.validate_against(registry, audit_events)?;
        Some(candidate)
    } else {
        None
    };
    let candidate_sha256 = candidate
        .as_ref()
        .map(serialize_json)
        .transpose()?
        .map(|bytes| sha256_digest(&bytes));
    let stored = StoredProcedureDecision {
        decision_id: Uuid::new_v4().to_string(),
        fingerprint: input.fingerprint,
        action: input.action,
        decided_at,
        reason_digest: sha256_digest(input.confirmation.reason.trim().as_bytes()),
        candidate_sha256,
        candidate,
    };
    document.updated_at_ms = u64::try_from(timestamp_ms()?)
        .map_err(|_| "El reloj excede el rango del almacén R5".to_string())?;
    document.decisions.push(stored.clone());
    validate_store_document(&document)?;
    atomic_replace(&path, &serialize_json(&document)?)?;
    Ok(stored)
}

fn validate_decision_input(
    input: &ProcedurePatternDecisionInput,
    pattern: &DetectedProcedurePattern,
) -> Result<(), String> {
    validate_digest("fingerprint", &input.fingerprint)?;
    if input.fingerprint != pattern.fingerprint
        || input.confirmation.expected_fingerprint != input.fingerprint
    {
        return Err("La confirmación no corresponde al patrón R5 vigente".into());
    }
    if input.confirmation.actor != ProcedureDecisionActor::LocalOwner
        || !input.confirmation.confirmed
    {
        return Err("La decisión exige confirmación explícita del propietario local".into());
    }
    validate_text("confirmation.reason", &input.confirmation.reason, 12, 600)?;
    match input.action {
        ProcedurePatternDecision::Retain => {
            validate_text(
                "title",
                input.title.as_deref().ok_or("Conservar exige title")?,
                1,
                120,
            )?;
            validate_text(
                "purpose",
                input.purpose.as_deref().ok_or("Conservar exige purpose")?,
                1,
                600,
            )?;
            validate_skill_id(
                input
                    .suggested_skill_id
                    .as_deref()
                    .ok_or("Conservar exige suggestedSkillId")?,
            )?;
        }
        ProcedurePatternDecision::Dismiss => {
            if input.title.is_some()
                || input.purpose.is_some()
                || input.suggested_skill_id.is_some()
            {
                return Err("Descartar no admite metadatos de candidato".into());
            }
        }
    }
    Ok(())
}

fn candidate_from_pattern(
    pattern: &DetectedProcedurePattern,
    generated_at: &str,
    input: &ProcedurePatternDecisionInput,
) -> Result<ProcedureCandidate, String> {
    Ok(ProcedureCandidate {
        schema_version: PROCEDURE_CANDIDATE_SCHEMA_VERSION,
        candidate_id: Uuid::new_v4().to_string(),
        generated_at: generated_at.into(),
        method: ProcedureDetectionMethod::R5AuditedRepetitionV1,
        status: ProcedureCandidateStatus::Proposed,
        title: input.title.clone().ok_or("Falta title")?,
        purpose: input.purpose.clone().ok_or("Falta purpose")?,
        suggested_skill_id: input
            .suggested_skill_id
            .clone()
            .ok_or("Falta suggestedSkillId")?,
        declared_risk: pattern.declared_risk,
        policy: ProcedureCandidatePolicy {
            proposal_only: true,
            auto_activation: false,
            execution_enabled: false,
            writes_durable_memory: false,
        },
        steps: pattern
            .steps
            .iter()
            .map(|step| ProcedureCandidateStep {
                id: step.id.clone(),
                position: step.position,
                capability_id: step.capability_id.clone(),
                operation: step.operation.clone(),
            })
            .collect(),
        occurrences: pattern
            .occurrences
            .iter()
            .map(|occurrence| ProcedureOccurrence {
                operation_id: occurrence.operation_id.clone(),
                evidence: pattern
                    .steps
                    .iter()
                    .zip(&occurrence.evidence_event_ids)
                    .map(|(step, event_id)| ProcedureEvidenceReference {
                        step_id: step.id.clone(),
                        event_id: event_id.clone(),
                    })
                    .collect(),
            })
            .collect(),
        variations: pattern.variations.clone(),
    })
}

fn decision_summary(decision: &StoredProcedureDecision) -> ProcedureDecisionSummary {
    ProcedureDecisionSummary {
        decision_id: decision.decision_id.clone(),
        fingerprint: decision.fingerprint.clone(),
        action: decision.action,
        decided_at: decision.decided_at.clone(),
        candidate_id: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.candidate_id.clone()),
        title: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.title.clone()),
        suggested_skill_id: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.suggested_skill_id.clone()),
        declared_risk: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.declared_risk),
        step_count: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.steps.len())
            .unwrap_or(0),
        occurrence_count: decision
            .candidate
            .as_ref()
            .map(|candidate| candidate.occurrences.len())
            .unwrap_or(0),
        candidate_sha256: decision.candidate_sha256.clone(),
        execution_enabled: false,
    }
}

fn procedure_store_path(data_root: &Path) -> PathBuf {
    data_root.join("procedures").join(PROCEDURE_STORE_FILE)
}

fn empty_store() -> ProcedureStoreDocument {
    ProcedureStoreDocument {
        schema_version: PROCEDURE_STORE_SCHEMA_VERSION,
        format: PROCEDURE_STORE_FORMAT.into(),
        updated_at_ms: 0,
        decisions: Vec::new(),
    }
}

fn read_store(path: &Path) -> Result<(ProcedureStoreDocument, bool), String> {
    if !path.exists() {
        return Ok((empty_store(), false));
    }
    let metadata = fs::metadata(path)
        .map_err(|error| format!("No se pudo inspeccionar '{}': {error}", path.display()))?;
    if metadata.len() > MAX_PROCEDURE_STORE_BYTES as u64 {
        return Err("El almacén R5 excede el límite de tamaño".into());
    }
    let bytes =
        fs::read(path).map_err(|error| format!("No se pudo leer '{}': {error}", path.display()))?;
    let document: ProcedureStoreDocument = serde_json::from_slice(&bytes)
        .map_err(|error| format!("El almacén R5 no es válido: {error}"))?;
    validate_store_document(&document)?;
    Ok((document, true))
}

fn validate_store_document(document: &ProcedureStoreDocument) -> Result<(), String> {
    if document.schema_version != PROCEDURE_STORE_SCHEMA_VERSION
        || document.format != PROCEDURE_STORE_FORMAT
        || document.decisions.len() > MAX_PROCEDURE_DECISIONS
    {
        return Err("El encabezado del almacén R5 no es compatible".into());
    }
    let mut fingerprints = HashSet::new();
    let mut decision_ids = HashSet::new();
    for decision in &document.decisions {
        validate_uuid_v4("decisionId", &decision.decision_id)?;
        validate_digest("fingerprint", &decision.fingerprint)?;
        validate_digest("reasonDigest", &decision.reason_digest)?;
        validate_timestamp("decidedAt", &decision.decided_at)?;
        if !decision_ids.insert(decision.decision_id.as_str())
            || !fingerprints.insert(decision.fingerprint.as_str())
        {
            return Err("El almacén R5 contiene decisiones repetidas".into());
        }
        match decision.action {
            ProcedurePatternDecision::Retain => {
                let candidate = decision
                    .candidate
                    .as_ref()
                    .ok_or("Una decisión retain perdió su candidato")?;
                let expected = decision
                    .candidate_sha256
                    .as_deref()
                    .ok_or("Una decisión retain perdió su SHA-256")?;
                validate_digest("candidateSha256", expected)?;
                let actual = sha256_digest(&serialize_json(candidate)?);
                if actual != expected {
                    return Err("El candidato R5 no coincide con su SHA-256".into());
                }
            }
            ProcedurePatternDecision::Dismiss => {
                if decision.candidate.is_some() || decision.candidate_sha256.is_some() {
                    return Err("Una decisión dismiss no puede contener candidato".into());
                }
            }
        }
    }
    Ok(())
}

fn validate_text(field: &str, value: &str, minimum: usize, maximum: usize) -> Result<(), String> {
    let length = value.trim().chars().count();
    if (minimum..=maximum).contains(&length) && !value.chars().any(char::is_control) {
        Ok(())
    } else {
        Err(format!(
            "{field} debe ser texto visible de {minimum} a {maximum} caracteres"
        ))
    }
}

fn validate_uuid_v4(field: &str, value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} debe ser UUID v4"))?;
    if parsed.get_version_num() == 4 && parsed.to_string() == value.to_ascii_lowercase() {
        Ok(())
    } else {
        Err(format!("{field} debe ser UUID v4 canónico"))
    }
}

fn validate_digest(field: &str, value: &str) -> Result<(), String> {
    let valid = value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .chars()
            .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character));
    if valid {
        Ok(())
    } else {
        Err(format!("{field} debe ser SHA-256 canónico"))
    }
}

fn sha256_digest(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn serialize_json<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > MAX_PROCEDURE_STORE_BYTES {
        return Err("El almacén R5 excede el límite de tamaño".into());
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("'{}' no tiene directorio padre", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear '{}': {error}", parent.display()))?;
    let temporary = parent.join(format!(".alice-procedure-{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo preparar el almacén R5: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("No se pudo sincronizar el almacén R5: {error}"));
    }
    drop(file);
    let displaced = parent.join(format!(".alice-procedure-{}.previous", Uuid::new_v4()));
    let had_previous = path.exists();
    if had_previous {
        if let Err(error) = fs::rename(path, &displaced) {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "No se pudo preservar el almacén R5 anterior: {error}"
            ));
        }
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        if had_previous {
            if let Err(rollback_error) = fs::rename(&displaced, path) {
                return Err(format!(
                    "No se pudo publicar el almacén R5 ({error}) ni restaurar el anterior ({rollback_error}); la copia preservada está en '{}'",
                    displaced.display()
                ));
            }
        }
        return Err(format!("No se pudo publicar el almacén R5: {error}"));
    }
    if had_previous {
        fs::remove_file(&displaced).map_err(|error| {
            format!(
                "El almacén R5 nuevo fue publicado, pero no se pudo retirar la copia anterior '{}': {error}",
                displaced.display()
            )
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::{AuditSource, AUDIT_MAX_BYTES};
    use crate::capabilities::{
        capability_registry_from_probes, CapabilityDescriptor, CapabilityDomain, CapabilityEffect,
        CapabilityHealth, CapabilityHealthStatus, CapabilityKind, CapabilityMaturity,
        CapabilityPermission, CapabilityPermissionEnforcer, CapabilityPermissionMode,
        CapabilityProbeSnapshot, CapabilityState, CAPABILITY_REGISTRY_SCHEMA_VERSION,
    };

    fn registry() -> CapabilityRegistrySnapshot {
        let capability = |id: &str, operation: &str, risk: CapabilityRisk| CapabilityDescriptor {
            id: id.into(),
            version: 1,
            label: id.into(),
            description: "Fixture R5.3".into(),
            domain: CapabilityDomain::Memory,
            kind: CapabilityKind::Query,
            maturity: CapabilityMaturity::Implemented,
            adapter: "fixture".into(),
            operations: vec![operation.into()],
            state: CapabilityState::Idle,
            risk,
            effects: vec![CapabilityEffect::LocalRead],
            data_scopes: vec!["fixture".into()],
            requirements: vec![],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ImplicitRead,
                enforced_by: CapabilityPermissionEnforcer::Native,
                summary: "Fixture local".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Healthy,
                summary: "Disponible".into(),
                checked_at: Some("2026-08-11T12:00:00Z".into()),
            },
            last_execution: None,
        };
        CapabilityRegistrySnapshot {
            schema_version: CAPABILITY_REGISTRY_SCHEMA_VERSION,
            generated_at: "2026-08-11T12:00:00Z".into(),
            capabilities: vec![
                capability(
                    "memory.records.read",
                    "loadValidatedRecords",
                    CapabilityRisk::Medium,
                ),
                capability(
                    "cloud.providers.inspect",
                    "cloud_status",
                    CapabilityRisk::Low,
                ),
            ],
        }
    }

    fn evidence_and_pattern() -> (Vec<crate::audit::AuditEvent>, DetectedProcedurePattern) {
        let mut events = Vec::new();
        for run in 0..3_u64 {
            let operation_id = Uuid::new_v4().to_string();
            let mut first = AuditEvent::producer(
                operation_id.clone(),
                AuditSource::Memory,
                "memory.records.read".into(),
                "loadValidatedRecords".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(2 + run),
                None,
                "MEMORY_READ_COMPLETED",
            )
            .unwrap();
            first.timestamp_ms = 1_786_280_000_000 + run * 10;
            let mut second = AuditEvent::producer(
                operation_id,
                AuditSource::Cloud,
                "cloud.providers.inspect".into(),
                "cloud_status".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(1),
                None,
                "PROVIDERS_INSPECTED",
            )
            .unwrap();
            second.timestamp_ms = first.timestamp_ms + 1;
            events.extend([first, second]);
        }
        let snapshot =
            detect_procedure_patterns("2026-08-11T13:00:00Z".into(), true, &registry(), &events)
                .unwrap();
        (events, snapshot.patterns[0].clone())
    }

    fn input(
        pattern: &DetectedProcedurePattern,
        action: ProcedurePatternDecision,
    ) -> ProcedurePatternDecisionInput {
        ProcedurePatternDecisionInput {
            fingerprint: pattern.fingerprint.clone(),
            action,
            title: (action == ProcedurePatternDecision::Retain)
                .then(|| "Revisar memoria y proveedores".into()),
            purpose: (action == ProcedurePatternDecision::Retain).then(|| {
                "Conservar la secuencia detectada únicamente para revisión humana posterior.".into()
            }),
            suggested_skill_id: (action == ProcedurePatternDecision::Retain)
                .then(|| "local.revisar-memoria-proveedores".into()),
            confirmation: ProcedureDecisionConfirmation {
                actor: ProcedureDecisionActor::LocalOwner,
                confirmed: true,
                expected_fingerprint: pattern.fingerprint.clone(),
                reason: "La evidencia repetida merece revisión manual.".into(),
            },
        }
    }

    fn conversion_input(stored: &StoredProcedureDecision) -> ProcedureDraftConversionInput {
        ProcedureDraftConversionInput {
            fingerprint: stored.fingerprint.clone(),
            expected_candidate_sha256: stored.candidate_sha256.clone().unwrap(),
            skill_id: "local.procedimiento-observado".into(),
            title: "Procedimiento observado revisable".into(),
            description: "Borrador derivado de evidencia repetida y conservada por el propietario."
                .into(),
            purpose: "Permitir inspección y simulación antes de cualquier aprobación futura."
                .into(),
            confirmation: ProcedureDraftConversionConfirmation {
                actor: ProcedureDecisionActor::LocalOwner,
                confirmed: true,
                expected_fingerprint: stored.fingerprint.clone(),
                expected_candidate_sha256: stored.candidate_sha256.clone().unwrap(),
                reason: "Convertir la propuesta retenida en un borrador revisable.".into(),
            },
        }
    }

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!("alice-r5-store-{}", Uuid::new_v4()))
    }

    fn tree_snapshot(root: &Path) -> Vec<(PathBuf, String)> {
        fn visit(base: &Path, current: &Path, files: &mut Vec<(PathBuf, String)>) {
            if !current.exists() {
                return;
            }
            for entry in fs::read_dir(current).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if path.is_dir() {
                    visit(base, &path, files);
                } else {
                    files.push((
                        path.strip_prefix(base).unwrap().to_path_buf(),
                        sha256_digest(&fs::read(path).unwrap()),
                    ));
                }
            }
        }
        let mut files = Vec::new();
        visit(root, root, &mut files);
        files.sort_by(|left, right| left.0.cmp(&right.0));
        files
    }

    #[test]
    fn passive_status_does_not_create_storage() {
        let root = temp_root();
        let status = procedure_candidate_store_status_at(&root).unwrap();
        assert!(!status.existed);
        assert!(status.decisions.is_empty());
        assert!(!root.exists());
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_store_status_is_read_only() {
        let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
            .map(PathBuf::from)
            .expect("ALICE_LIVE_DATA_DIR");
        let path = procedure_store_path(&root);
        let parent_existed = path.parent().is_some_and(Path::exists);
        let before = fs::read(&path).ok();
        let status = procedure_candidate_store_status_at(&root).expect("estado R5.3 canónico");
        let after = fs::read(&path).ok();

        assert_eq!(after, before);
        assert_eq!(path.parent().is_some_and(Path::exists), parent_existed);
        assert_eq!(status.existed, before.is_some());
        assert!(!status.execution_enabled);
        assert!(!status.skill_draft_created);
        eprintln!(
            "R5.3 real: {} decisiones, almacén existente={}, ejecución=false, borrador R4=false",
            status.decisions.len(),
            status.existed
        );
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_conversion_status_is_read_only() {
        let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
            .map(PathBuf::from)
            .expect("ALICE_LIVE_DATA_DIR");
        let before = tree_snapshot(&root);
        let probes = CapabilityProbeSnapshot::collect(
            &root,
            &ObservationStore::default(),
            &SensorLeaseStore::default(),
        );
        let registry =
            capability_registry_from_probes("2026-08-11T15:00:00Z".into(), &probes).unwrap();
        let status =
            procedure_draft_conversion_status_at(&root, &registry, &SkillDraftStore::default())
                .unwrap();
        assert_eq!(tree_snapshot(&root), before);
        assert!(!status.execution_enabled);
        assert!(!status.automatic_approval);
        eprintln!(
            "R5.4 real: {} conversiones, ejecución=false, aprobación automática=false",
            status.conversions.len()
        );
    }

    #[test]
    fn retain_writes_real_candidate_with_verified_sha_and_no_execution() {
        let root = temp_root();
        let (events, pattern) = evidence_and_pattern();
        let stored = record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:00:00Z".into(),
            input(&pattern, ProcedurePatternDecision::Retain),
        )
        .unwrap();
        assert!(stored.candidate.is_some());
        let status = procedure_candidate_store_status_at(&root).unwrap();
        assert_eq!(status.decisions.len(), 1);
        assert!(!status.decisions[0].execution_enabled);
        assert!(!status.skill_draft_created);
        let text = fs::read_to_string(procedure_store_path(&root)).unwrap();
        assert!(!text.contains("La evidencia repetida merece"));
        let tampered = text.replace(
            "Revisar memoria y proveedores",
            "Revisar memoria y proveedores alterados",
        );
        fs::write(procedure_store_path(&root), tampered).unwrap();
        assert!(procedure_candidate_store_status_at(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn dismiss_persists_only_digest_and_is_immutable() {
        let root = temp_root();
        let (events, pattern) = evidence_and_pattern();
        let request = input(&pattern, ProcedurePatternDecision::Dismiss);
        record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:00:00Z".into(),
            request.clone(),
        )
        .unwrap();
        let before = fs::read(procedure_store_path(&root)).unwrap();
        assert!(record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:01:00Z".into(),
            request,
        )
        .is_err());
        assert_eq!(before, fs::read(procedure_store_path(&root)).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn confirmation_and_metadata_fail_closed() {
        let (_, pattern) = evidence_and_pattern();
        let mut retain = input(&pattern, ProcedurePatternDecision::Retain);
        retain.confirmation.confirmed = false;
        assert!(validate_decision_input(&retain, &pattern).is_err());
        let mut dismiss = input(&pattern, ProcedurePatternDecision::Dismiss);
        dismiss.title = Some("No permitido".into());
        assert!(validate_decision_input(&dismiss, &pattern).is_err());
    }

    #[test]
    fn procedure_audit_is_real_and_contains_no_reason_text() {
        let root = temp_root();
        let fingerprint = format!("sha256:{}", "a".repeat(64));
        let operation_id = new_operation_id();
        let event = AuditEvent::procedure_decision(
            operation_id,
            "procedure.candidate.retain".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            fingerprint,
            "PROCEDURE_DECISION_RECORDED",
        )
        .unwrap();
        crate::audit::append_event_at(&root, &event, AUDIT_MAX_BYTES).unwrap();
        let text = fs::read_to_string(root.join("audit").join("events-v1.jsonl")).unwrap();
        assert!(!text.contains("La evidencia repetida merece"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn retained_candidate_creates_real_r4_draft_with_r5_provenance() {
        let root = temp_root();
        let (events, pattern) = evidence_and_pattern();
        let stored = record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:00:00Z".into(),
            input(&pattern, ProcedurePatternDecision::Retain),
        )
        .unwrap();
        let procedure_bytes = fs::read(procedure_store_path(&root)).unwrap();
        let prepared = prepare_procedure_draft_at(
            &root,
            &registry(),
            conversion_input(&stored),
            "2026-08-11T14:00:00Z",
        )
        .unwrap();
        let skill_store = SkillDraftStore::default();
        let draft = save_procedure_draft_guarded_at(
            &skill_store,
            &root,
            &registry(),
            SkillDraftSaveInput {
                manifest: prepared.manifest,
                expected_revision_id: None,
            },
            &prepared.source_fingerprint,
        )
        .unwrap();

        assert_eq!(draft.manifest.status, SkillStatus::Draft);
        assert!(!draft.manifest.execution.enabled);
        let provenance = draft.manifest.provenance.procedure.as_ref().unwrap();
        assert_eq!(provenance.fingerprint, stored.fingerprint);
        assert_eq!(
            provenance.candidate_id,
            stored.candidate.unwrap().candidate_id
        );
        assert_eq!(
            fs::read(procedure_store_path(&root)).unwrap(),
            procedure_bytes
        );
        let status =
            procedure_draft_conversion_status_at(&root, &registry(), &skill_store).unwrap();
        assert_eq!(status.conversions.len(), 1);
        assert!(!status.execution_enabled);
        assert!(!status.automatic_approval);
        let path = procedure_store_path(&root);
        let (mut altered, _) = read_store(&path).unwrap();
        altered.decisions[0].decision_id = Uuid::new_v4().to_string();
        atomic_replace(&path, &serialize_json(&altered).unwrap()).unwrap();
        assert!(procedure_draft_conversion_status_at(&root, &registry(), &skill_store).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn conversion_is_single_use_and_never_overwrites_a_draft() {
        let root = temp_root();
        let (events, pattern) = evidence_and_pattern();
        let stored = record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:00:00Z".into(),
            input(&pattern, ProcedurePatternDecision::Retain),
        )
        .unwrap();
        let skill_store = SkillDraftStore::default();
        let first = prepare_procedure_draft_at(
            &root,
            &registry(),
            conversion_input(&stored),
            "2026-08-11T14:00:00Z",
        )
        .unwrap();
        save_procedure_draft_guarded_at(
            &skill_store,
            &root,
            &registry(),
            SkillDraftSaveInput {
                manifest: first.manifest,
                expected_revision_id: None,
            },
            &first.source_fingerprint,
        )
        .unwrap();
        let index_path = root.join("skills").join("manifest.json");
        let before = fs::read(&index_path).unwrap();
        let second = prepare_procedure_draft_at(
            &root,
            &registry(),
            conversion_input(&stored),
            "2026-08-11T14:01:00Z",
        )
        .unwrap();
        assert!(save_procedure_draft_guarded_at(
            &skill_store,
            &root,
            &registry(),
            SkillDraftSaveInput {
                manifest: second.manifest,
                expected_revision_id: None,
            },
            &second.source_fingerprint,
        )
        .is_err());
        assert_eq!(fs::read(index_path).unwrap(), before);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn dismissed_or_mismatched_candidate_never_creates_a_skill_store() {
        let root = temp_root();
        let (events, pattern) = evidence_and_pattern();
        let dismissed = record_procedure_pattern_decision_at(
            &root,
            &registry(),
            &events,
            &pattern,
            "2026-08-11T13:00:00Z".into(),
            input(&pattern, ProcedurePatternDecision::Dismiss),
        )
        .unwrap();
        let mut request = ProcedureDraftConversionInput {
            fingerprint: dismissed.fingerprint.clone(),
            expected_candidate_sha256: format!("sha256:{}", "b".repeat(64)),
            skill_id: "local.procedimiento-descartado".into(),
            title: "No debe crearse".into(),
            description: "Un patrón descartado no puede cruzar la frontera R5 a R4.".into(),
            purpose: "Demostrar que la conversión falla de forma cerrada.".into(),
            confirmation: ProcedureDraftConversionConfirmation {
                actor: ProcedureDecisionActor::LocalOwner,
                confirmed: true,
                expected_fingerprint: dismissed.fingerprint,
                expected_candidate_sha256: format!("sha256:{}", "b".repeat(64)),
                reason: "Esta solicitud sólo verifica el rechazo controlado.".into(),
            },
        };
        assert!(prepare_procedure_draft_at(
            &root,
            &registry(),
            request.clone(),
            "2026-08-11T14:00:00Z"
        )
        .is_err());
        request.confirmation.confirmed = false;
        assert!(
            prepare_procedure_draft_at(&root, &registry(), request, "2026-08-11T14:00:00Z")
                .is_err()
        );
        assert!(!root.join("skills").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
