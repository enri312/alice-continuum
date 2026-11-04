use crate::capabilities::{
    current_capability_registry, validate_timestamp, CapabilityMaturity,
    CapabilityRegistrySnapshot, CapabilityRisk,
};
use crate::observation::ObservationStore;
use crate::sensory::SensorLeaseStore;
use crate::util::{alice_data_root_path, timestamp_ms};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::{AppHandle, State};
use uuid::Uuid;

mod lifecycle;
mod simulation;
mod templates;
pub(crate) use lifecycle::{
    read_skill_lifecycle, skill_lifecycle_status, transition_skill_lifecycle,
};
pub(crate) use simulation::simulate_skill_plan;
pub(crate) use templates::prepare_read_only_skill_template;

pub(crate) const SKILL_MANIFEST_SCHEMA_VERSION: u32 = 1;
pub(crate) const SKILL_DRAFT_STORE_SCHEMA_VERSION: u32 = 1;
const SKILL_DRAFT_STORE_FORMAT: &str = "alice-skill-drafts";
const MAX_SKILL_DRAFTS: usize = 128;
const MAX_SKILL_FILE_BYTES: usize = 256 * 1024;

#[derive(Clone, Default)]
pub(crate) struct SkillDraftStore(Arc<Mutex<()>>);

impl SkillDraftStore {
    fn lock(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.0
            .lock()
            .map_err(|_| "El almacén de borradores quedó bloqueado por un fallo anterior".into())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillDraftReadInput {
    pub(crate) skill_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillDraftSaveInput {
    pub(crate) manifest: SkillManifest,
    pub(crate) expected_revision_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillDraftStoreIndex {
    schema_version: u32,
    format: String,
    updated_at_ms: u64,
    drafts: Vec<SkillDraftIndexEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillDraftIndexEntry {
    skill_id: String,
    version: u32,
    revision_id: String,
    file_name: String,
    sha256: String,
    backup_sha256: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillDraftSummary {
    skill_id: String,
    title: String,
    version: u32,
    revision_id: String,
    updated_at: String,
    declared_risk: CapabilityRisk,
    sha256: String,
    backup_available: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillDraftStoreSnapshot {
    schema_version: u32,
    storage_path: String,
    existed: bool,
    drafts: Vec<SkillDraftSummary>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillDraftRecord {
    pub(crate) manifest: SkillManifest,
    pub(crate) sha256: String,
    pub(crate) storage_path: String,
    pub(crate) backup_available: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillManifest {
    pub(crate) schema_version: u32,
    pub(crate) skill_id: String,
    pub(crate) version: u32,
    pub(crate) revision_id: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) purpose: String,
    pub(crate) provenance: SkillProvenance,
    pub(crate) status: SkillStatus,
    pub(crate) declared_risk: CapabilityRisk,
    pub(crate) execution: SkillExecutionPolicy,
    pub(crate) required_capabilities: Vec<SkillCapabilityRequirement>,
    pub(crate) inputs: Vec<SkillInput>,
    pub(crate) outputs: Vec<SkillOutput>,
    pub(crate) preconditions: Vec<SkillPrecondition>,
    pub(crate) steps: Vec<SkillStep>,
    pub(crate) success_checks: Vec<SkillSuccessCheck>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillProvenance {
    pub(crate) author: String,
    pub(crate) origin: SkillOrigin,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) parent_revision_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) procedure: Option<SkillProcedureProvenance>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillProcedureProvenance {
    pub(crate) decision_id: String,
    pub(crate) candidate_id: String,
    pub(crate) fingerprint: String,
    pub(crate) candidate_sha256: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillOrigin {
    LocalUser,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillStatus {
    Draft,
    InReview,
    Approved,
    Disabled,
    Retired,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillExecutionPolicy {
    pub(crate) mode: SkillExecutionMode,
    pub(crate) enabled: bool,
    pub(crate) allow_network: bool,
    pub(crate) allow_process_launch: bool,
    pub(crate) allow_local_write: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillExecutionMode {
    SimulationOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillCapabilityRequirement {
    pub(crate) capability_id: String,
    pub(crate) operations: Vec<String>,
    pub(crate) reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillInput {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) kind: SkillValueKind,
    pub(crate) required: bool,
    pub(crate) sensitive: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillOutput {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) kind: SkillValueKind,
    pub(crate) sensitive: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillValueKind {
    Text,
    Number,
    Boolean,
    Path,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillPrecondition {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) kind: SkillPreconditionKind,
    pub(crate) reference: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillPreconditionKind {
    ManualConfirmation,
    InputPresent,
    CapabilityAvailable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillStep {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) kind: SkillStepKind,
    pub(crate) capability_id: Option<String>,
    pub(crate) operation: Option<String>,
    pub(crate) input_ids: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillStepKind {
    Manual,
    Capability,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillSuccessCheck {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) kind: SkillSuccessCheckKind,
    pub(crate) reference: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillSuccessCheckKind {
    ManualConfirmation,
    OutputPresent,
    CapabilityHealthy,
}

impl SkillManifest {
    pub(crate) fn validate_against_registry(
        &self,
        registry: &CapabilityRegistrySnapshot,
    ) -> Result<(), String> {
        registry.validate()?;
        if self.schema_version != SKILL_MANIFEST_SCHEMA_VERSION {
            return Err(format!(
                "schemaVersion debe ser {SKILL_MANIFEST_SCHEMA_VERSION}"
            ));
        }
        validate_skill_id(&self.skill_id)?;
        if self.version == 0 {
            return Err("La versión de la habilidad debe ser positiva".into());
        }
        validate_uuid_v4("revisionId", &self.revision_id)?;
        validate_text("title", &self.title, 120)?;
        validate_text("description", &self.description, 600)?;
        validate_text("purpose", &self.purpose, 600)?;
        validate_text("provenance.author", &self.provenance.author, 120)?;
        validate_timestamp("provenance.createdAt", &self.provenance.created_at)?;
        validate_timestamp("provenance.updatedAt", &self.provenance.updated_at)?;
        if let Some(parent) = &self.provenance.parent_revision_id {
            validate_uuid_v4("provenance.parentRevisionId", parent)?;
            if parent == &self.revision_id {
                return Err("parentRevisionId no puede ser igual a revisionId".into());
            }
        }
        if let Some(procedure) = &self.provenance.procedure {
            validate_uuid_v4("provenance.procedure.decisionId", &procedure.decision_id)?;
            validate_uuid_v4("provenance.procedure.candidateId", &procedure.candidate_id)?;
            validate_sha256("provenance.procedure.fingerprint", &procedure.fingerprint)?;
            validate_sha256(
                "provenance.procedure.candidateSha256",
                &procedure.candidate_sha256,
            )?;
        }
        self.validate_execution_policy()?;
        if self.steps.is_empty() || self.steps.len() > 64 {
            return Err("steps debe contener entre 1 y 64 pasos visibles".into());
        }
        if self.outputs.is_empty() || self.outputs.len() > 32 {
            return Err("outputs debe contener entre 1 y 32 resultados".into());
        }
        if self.success_checks.is_empty() || self.success_checks.len() > 32 {
            return Err("successChecks debe contener entre 1 y 32 comprobaciones".into());
        }
        if self.required_capabilities.len() > 24
            || self.inputs.len() > 32
            || self.preconditions.len() > 32
        {
            return Err("El manifiesto excede los límites estructurales de R4".into());
        }

        let registry_by_id = registry
            .capabilities
            .iter()
            .map(|capability| (capability.id.as_str(), capability))
            .collect::<HashMap<_, _>>();
        let mut requirement_ids = HashSet::new();
        let mut declared_operations = HashSet::new();
        let mut maximum_risk = CapabilityRisk::None;
        for requirement in &self.required_capabilities {
            if !requirement_ids.insert(requirement.capability_id.as_str()) {
                return Err(format!(
                    "La capacidad '{}' está repetida",
                    requirement.capability_id
                ));
            }
            validate_text("requiredCapabilities.reason", &requirement.reason, 300)?;
            if requirement.operations.is_empty() {
                return Err(format!(
                    "La capacidad '{}' debe declarar operaciones",
                    requirement.capability_id
                ));
            }
            let capability = registry_by_id
                .get(requirement.capability_id.as_str())
                .ok_or_else(|| {
                    format!(
                        "La capacidad '{}' no está registrada en R1",
                        requirement.capability_id
                    )
                })?;
            maximum_risk = maximum_risk.max_by_rank(capability.risk);
            let mut operations = HashSet::new();
            for operation in &requirement.operations {
                validate_operation(operation)?;
                if !operations.insert(operation.as_str()) {
                    return Err(format!(
                        "La operación '{operation}' está repetida para '{}'",
                        requirement.capability_id
                    ));
                }
                if !capability.operations.contains(operation) {
                    return Err(format!(
                        "La operación '{operation}' no pertenece a '{}'",
                        requirement.capability_id
                    ));
                }
                declared_operations
                    .insert((requirement.capability_id.as_str(), operation.as_str()));
            }
            if self.status == SkillStatus::Approved
                && capability.maturity == CapabilityMaturity::Planned
            {
                return Err(format!(
                    "Una habilidad aprobada no puede depender de la capacidad planificada '{}'",
                    requirement.capability_id
                ));
            }
        }
        if risk_rank(self.declared_risk) < risk_rank(maximum_risk) {
            return Err("declaredRisk no puede ser menor que el riesgo de sus capacidades".into());
        }

        let input_ids = validate_fields(&self.inputs)?;
        let output_ids = validate_outputs(&self.outputs)?;
        let mut step_ids = HashSet::new();
        let mut used_operations = HashSet::new();
        for step in &self.steps {
            validate_local_id("step.id", &step.id)?;
            if !step_ids.insert(step.id.as_str()) {
                return Err(format!("El paso '{}' está repetido", step.id));
            }
            validate_text("step.title", &step.title, 120)?;
            validate_text("step.description", &step.description, 500)?;
            validate_references("step.inputIds", &step.input_ids, &input_ids)?;
            match step.kind {
                SkillStepKind::Manual
                    if step.capability_id.is_some() || step.operation.is_some() =>
                {
                    return Err(format!(
                        "El paso manual '{}' no puede declarar capacidad u operación",
                        step.id
                    ));
                }
                SkillStepKind::Capability => {
                    let capability_id = step
                        .capability_id
                        .as_deref()
                        .ok_or_else(|| format!("El paso '{}' requiere capabilityId", step.id))?;
                    let operation = step
                        .operation
                        .as_deref()
                        .ok_or_else(|| format!("El paso '{}' requiere operation", step.id))?;
                    if !declared_operations.contains(&(capability_id, operation)) {
                        return Err(format!(
                            "El paso '{}' usa una capacidad u operación no declarada",
                            step.id
                        ));
                    }
                    used_operations.insert((capability_id, operation));
                }
                _ => {}
            }
        }
        if used_operations != declared_operations {
            return Err(
                "requiredCapabilities contiene privilegios no utilizados por los pasos".into(),
            );
        }
        self.validate_preconditions(&input_ids, &requirement_ids)?;
        self.validate_success_checks(&output_ids, &requirement_ids)?;
        Ok(())
    }

    pub(crate) fn validate_new_draft(
        &self,
        registry: &CapabilityRegistrySnapshot,
    ) -> Result<(), String> {
        self.validate_against_registry(registry)?;
        if self.version != 1
            || self.status != SkillStatus::Draft
            || self.provenance.parent_revision_id.is_some()
        {
            return Err("Una habilidad nueva debe comenzar como draft versión 1 sin padre".into());
        }
        Ok(())
    }

    fn validate_execution_policy(&self) -> Result<(), String> {
        if self.execution.mode != SkillExecutionMode::SimulationOnly
            || self.execution.enabled
            || self.execution.allow_network
            || self.execution.allow_process_launch
            || self.execution.allow_local_write
        {
            return Err("R4.1 exige simulationOnly, desactivada y sin efectos externos".into());
        }
        Ok(())
    }

    fn validate_preconditions(
        &self,
        input_ids: &HashSet<&str>,
        capability_ids: &HashSet<&str>,
    ) -> Result<(), String> {
        let mut ids = HashSet::new();
        for condition in &self.preconditions {
            validate_local_id("precondition.id", &condition.id)?;
            if !ids.insert(condition.id.as_str()) {
                return Err(format!("La precondición '{}' está repetida", condition.id));
            }
            validate_text("precondition.label", &condition.label, 120)?;
            validate_text("precondition.description", &condition.description, 400)?;
            let valid = match condition.kind {
                SkillPreconditionKind::ManualConfirmation => condition.reference == "user",
                SkillPreconditionKind::InputPresent => {
                    input_ids.contains(condition.reference.as_str())
                }
                SkillPreconditionKind::CapabilityAvailable => {
                    capability_ids.contains(condition.reference.as_str())
                }
            };
            if !valid {
                return Err(format!(
                    "La referencia de la precondición '{}' no es válida",
                    condition.id
                ));
            }
        }
        Ok(())
    }

    fn validate_success_checks(
        &self,
        output_ids: &HashSet<&str>,
        capability_ids: &HashSet<&str>,
    ) -> Result<(), String> {
        let mut ids = HashSet::new();
        for check in &self.success_checks {
            validate_local_id("successCheck.id", &check.id)?;
            if !ids.insert(check.id.as_str()) {
                return Err(format!("La comprobación '{}' está repetida", check.id));
            }
            validate_text("successCheck.label", &check.label, 120)?;
            validate_text("successCheck.description", &check.description, 400)?;
            let valid = match check.kind {
                SkillSuccessCheckKind::ManualConfirmation => check.reference == "user",
                SkillSuccessCheckKind::OutputPresent => {
                    output_ids.contains(check.reference.as_str())
                }
                SkillSuccessCheckKind::CapabilityHealthy => {
                    capability_ids.contains(check.reference.as_str())
                }
            };
            if !valid {
                return Err(format!(
                    "La referencia de la comprobación '{}' no es válida",
                    check.id
                ));
            }
        }
        Ok(())
    }
}

trait CapabilityRiskRank {
    fn max_by_rank(self, other: Self) -> Self;
}

impl CapabilityRiskRank for CapabilityRisk {
    fn max_by_rank(self, other: Self) -> Self {
        if risk_rank(self) >= risk_rank(other) {
            self
        } else {
            other
        }
    }
}

fn risk_rank(risk: CapabilityRisk) -> u8 {
    match risk {
        CapabilityRisk::None => 0,
        CapabilityRisk::Low => 1,
        CapabilityRisk::Medium => 2,
        CapabilityRisk::High => 3,
        CapabilityRisk::Critical => 4,
    }
}

fn validate_fields(inputs: &[SkillInput]) -> Result<HashSet<&str>, String> {
    let mut ids = HashSet::new();
    for input in inputs {
        validate_local_id("input.id", &input.id)?;
        if !ids.insert(input.id.as_str()) {
            return Err(format!("La entrada '{}' está repetida", input.id));
        }
        validate_text("input.label", &input.label, 120)?;
        validate_text("input.description", &input.description, 400)?;
        if input.kind == SkillValueKind::Path && !input.sensitive {
            return Err(format!(
                "La entrada de ruta '{}' debe marcarse sensitive",
                input.id
            ));
        }
    }
    Ok(ids)
}

fn validate_outputs(outputs: &[SkillOutput]) -> Result<HashSet<&str>, String> {
    let mut ids = HashSet::new();
    for output in outputs {
        validate_local_id("output.id", &output.id)?;
        if !ids.insert(output.id.as_str()) {
            return Err(format!("El resultado '{}' está repetido", output.id));
        }
        validate_text("output.label", &output.label, 120)?;
        validate_text("output.description", &output.description, 400)?;
        if output.kind == SkillValueKind::Path && !output.sensitive {
            return Err(format!(
                "El resultado de ruta '{}' debe marcarse sensitive",
                output.id
            ));
        }
    }
    Ok(ids)
}

fn validate_references(
    field: &str,
    references: &[String],
    allowed: &HashSet<&str>,
) -> Result<(), String> {
    let mut unique = HashSet::new();
    for reference in references {
        if !unique.insert(reference.as_str()) || !allowed.contains(reference.as_str()) {
            return Err(format!(
                "{field} contiene una referencia inválida o repetida"
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_skill_id(value: &str) -> Result<(), String> {
    if value.starts_with("local.") && canonical_dotted_id(value) {
        Ok(())
    } else {
        Err(
            "skillId debe usar el espacio local y formato canónico, por ejemplo local.mi-habilidad"
                .into(),
        )
    }
}

fn canonical_dotted_id(value: &str) -> bool {
    value.len() <= 96
        && value.split('.').count() >= 2
        && value.split('.').all(|segment| {
            !segment.is_empty()
                && segment.len() <= 48
                && segment
                    .chars()
                    .next()
                    .is_some_and(|first| first.is_ascii_lowercase())
                && segment.chars().all(|character| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                })
                && !segment.ends_with('-')
        })
}

fn validate_local_id(field: &str, value: &str) -> Result<(), String> {
    let valid = (1..=64).contains(&value.len())
        && value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_lowercase())
        && value.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
        && !value.ends_with('-');
    if valid {
        Ok(())
    } else {
        Err(format!("{field} no tiene formato canónico"))
    }
}

fn validate_operation(value: &str) -> Result<(), String> {
    let valid = (1..=96).contains(&value.len())
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        });
    if valid {
        Ok(())
    } else {
        Err("La operación no tiene formato canónico".into())
    }
}

fn validate_text(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    if !value.trim().is_empty() && value.len() <= maximum && !value.chars().any(char::is_control) {
        Ok(())
    } else {
        Err(format!(
            "{field} debe ser texto visible de hasta {maximum} caracteres"
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

fn validate_sha256(field: &str, value: &str) -> Result<(), String> {
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

#[derive(Clone)]
struct LoadedSkillDraft {
    manifest: SkillManifest,
    bytes: Vec<u8>,
    sha256: String,
    path: PathBuf,
    backup_available: bool,
}

#[tauri::command]
pub(crate) fn skill_draft_store_status(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
) -> Result<SkillDraftStoreSnapshot, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let _guard = skill_store.lock()?;
    skill_draft_store_status_at(&alice_data_root_path(&app)?, &registry)
}

#[tauri::command]
pub(crate) fn read_skill_draft(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
    input: SkillDraftReadInput,
) -> Result<SkillDraftRecord, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let _guard = skill_store.lock()?;
    read_skill_draft_at(&alice_data_root_path(&app)?, &registry, &input.skill_id)
}

#[tauri::command]
pub(crate) fn save_skill_draft(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
    input: SkillDraftSaveInput,
) -> Result<SkillDraftRecord, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    save_skill_draft_guarded_at(&skill_store, &alice_data_root_path(&app)?, &registry, input)
}

fn save_skill_draft_guarded_at(
    store: &SkillDraftStore,
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: SkillDraftSaveInput,
) -> Result<SkillDraftRecord, String> {
    let _guard = store.lock()?;
    save_skill_draft_at(data_root, registry, input)
}

pub(crate) fn save_procedure_draft_guarded_at(
    store: &SkillDraftStore,
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: SkillDraftSaveInput,
    fingerprint: &str,
) -> Result<SkillDraftRecord, String> {
    let _guard = store.lock()?;
    let skills_root = data_root.join("skills");
    let (index, _) = read_skill_index(&skills_root)?;
    let loaded = load_indexed_drafts(&skills_root, registry, &index)?;
    if loaded.iter().any(|draft| {
        draft
            .manifest
            .provenance
            .procedure
            .as_ref()
            .is_some_and(|procedure| procedure.fingerprint == fingerprint)
    }) {
        return Err("Este candidato R5 ya fue convertido en un borrador R4".into());
    }
    if loaded
        .iter()
        .any(|draft| draft.manifest.skill_id == input.manifest.skill_id)
    {
        return Err(
            "El skillId elegido ya pertenece a otro borrador; elegí una identidad nueva".into(),
        );
    }
    save_skill_draft_at(data_root, registry, input)
}

pub(crate) fn skill_draft_records_guarded_at(
    store: &SkillDraftStore,
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
) -> Result<Vec<SkillDraftRecord>, String> {
    let _guard = store.lock()?;
    let skills_root = data_root.join("skills");
    let (index, _) = read_skill_index(&skills_root)?;
    load_indexed_drafts(&skills_root, registry, &index)
        .map(|drafts| drafts.into_iter().map(skill_draft_record).collect())
}

fn skill_draft_store_status_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
) -> Result<SkillDraftStoreSnapshot, String> {
    let skills_root = data_root.join("skills");
    let (index, existed) = read_skill_index(&skills_root)?;
    let loaded = load_indexed_drafts(&skills_root, registry, &index)?;
    let mut drafts = loaded
        .into_iter()
        .map(|draft| SkillDraftSummary {
            skill_id: draft.manifest.skill_id,
            title: draft.manifest.title,
            version: draft.manifest.version,
            revision_id: draft.manifest.revision_id,
            updated_at: draft.manifest.provenance.updated_at,
            declared_risk: draft.manifest.declared_risk,
            sha256: draft.sha256,
            backup_available: draft.backup_available,
        })
        .collect::<Vec<_>>();
    drafts.sort_by(|left, right| left.skill_id.cmp(&right.skill_id));
    Ok(SkillDraftStoreSnapshot {
        schema_version: SKILL_DRAFT_STORE_SCHEMA_VERSION,
        storage_path: skills_root.display().to_string(),
        existed,
        drafts,
    })
}

fn read_skill_draft_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    skill_id: &str,
) -> Result<SkillDraftRecord, String> {
    validate_skill_id(skill_id)?;
    let skills_root = data_root.join("skills");
    let (index, existed) = read_skill_index(&skills_root)?;
    if !existed {
        return Err("Todavía no existe un almacén local de borradores".into());
    }
    let entry = index
        .drafts
        .iter()
        .find(|entry| entry.skill_id == skill_id)
        .ok_or_else(|| format!("No existe el borrador '{skill_id}'"))?;
    let loaded = load_indexed_draft(&skills_root, registry, entry)?;
    Ok(skill_draft_record(loaded))
}

fn save_skill_draft_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: SkillDraftSaveInput,
) -> Result<SkillDraftRecord, String> {
    registry.validate()?;
    validate_skill_id(&input.manifest.skill_id)?;
    if let Some(expected) = &input.expected_revision_id {
        validate_uuid_v4("expectedRevisionId", expected)?;
    }

    let skills_root = data_root.join("skills");
    let (mut index, index_existed) = read_skill_index(&skills_root)?;
    let loaded = load_indexed_drafts(&skills_root, registry, &index)?;
    let existing = loaded
        .iter()
        .find(|draft| draft.manifest.skill_id == input.manifest.skill_id)
        .cloned();

    match &existing {
        None => {
            if input.expected_revision_id.is_some() {
                return Err(
                    "expectedRevisionId sólo puede usarse al editar un borrador existente".into(),
                );
            }
            if index.drafts.len() >= MAX_SKILL_DRAFTS {
                return Err(format!(
                    "El almacén admite como máximo {MAX_SKILL_DRAFTS} borradores"
                ));
            }
            input.manifest.validate_new_draft(registry)?;
        }
        Some(previous) => {
            let expected = input
                .expected_revision_id
                .as_deref()
                .ok_or("Editar un borrador exige expectedRevisionId para evitar sobreescrituras")?;
            if expected != previous.manifest.revision_id {
                return Err(
                    "Conflicto de revisión: el borrador cambió desde la última lectura".into(),
                );
            }
            validate_edited_draft(&input.manifest, &previous.manifest, registry)?;
        }
    }

    let draft_bytes = serialize_json(&input.manifest)?;
    if draft_bytes.len() > MAX_SKILL_FILE_BYTES {
        return Err(format!(
            "El manifiesto excede el límite de {MAX_SKILL_FILE_BYTES} bytes"
        ));
    }
    let digest = sha256_hex(&draft_bytes);
    let file_name = skill_file_name(&input.manifest.skill_id);
    let draft_path = skills_root.join("drafts").join(&file_name);
    let backup_path = skills_root
        .join("backups")
        .join(skill_backup_file_name(&input.manifest.skill_id));

    let new_entry = SkillDraftIndexEntry {
        skill_id: input.manifest.skill_id.clone(),
        version: input.manifest.version,
        revision_id: input.manifest.revision_id.clone(),
        file_name,
        sha256: digest.clone(),
        backup_sha256: existing.as_ref().map(|previous| previous.sha256.clone()),
    };
    if let Some(position) = index
        .drafts
        .iter()
        .position(|entry| entry.skill_id == new_entry.skill_id)
    {
        index.drafts[position] = new_entry;
    } else {
        index.drafts.push(new_entry);
    }
    index
        .drafts
        .sort_by(|left, right| left.skill_id.cmp(&right.skill_id));
    index.updated_at_ms = u64::try_from(timestamp_ms()?)
        .map_err(|_| "La fecha del sistema excede el rango admitido")?;
    validate_skill_index(&index)?;
    let index_path = skills_root.join("manifest.json");
    let previous_index = if index_existed {
        Some(read_bounded(&index_path, MAX_SKILL_FILE_BYTES)?)
    } else {
        None
    };
    let index_bytes = serialize_json(&index)?;
    let manifest_backup_path = skills_root.join("backups").join("manifest.backup.json");
    let previous_skill_backup = read_optional_bounded(&backup_path, MAX_SKILL_FILE_BYTES)?;
    let previous_manifest_backup =
        read_optional_bounded(&manifest_backup_path, MAX_SKILL_FILE_BYTES)?;
    let previous_draft = existing.as_ref().map(|draft| draft.bytes.as_slice());

    fs::create_dir_all(skills_root.join("drafts"))
        .map_err(|error| format!("No se pudo crear data/skills/drafts: {error}"))?;
    fs::create_dir_all(skills_root.join("backups"))
        .map_err(|error| format!("No se pudo crear data/skills/backups: {error}"))?;

    let write_result = (|| {
        if let Some(previous) = &existing {
            atomic_replace(&backup_path, &previous.bytes)?;
        }
        if let Some(bytes) = &previous_index {
            atomic_replace(&manifest_backup_path, bytes)?;
        }
        atomic_replace(&draft_path, &draft_bytes)?;
        atomic_replace(&index_path, &index_bytes)
    })();
    if let Err(error) = write_result {
        let rollback = rollback_skill_transaction(
            &draft_path,
            previous_draft,
            &backup_path,
            previous_skill_backup.as_deref(),
            &manifest_backup_path,
            previous_manifest_backup.as_deref(),
            &index_path,
            previous_index.as_deref(),
        );
        return match rollback {
            Ok(()) => Err(format!(
                "No se pudo completar el guardado; se restauró el estado anterior: {error}"
            )),
            Err(rollback) => Err(format!(
                "No se pudo completar el guardado ({error}) ni restaurar todo el estado ({rollback})"
            )),
        };
    }

    Ok(SkillDraftRecord {
        manifest: input.manifest,
        sha256: digest,
        storage_path: draft_path.display().to_string(),
        backup_available: existing.is_some(),
    })
}

fn validate_edited_draft(
    candidate: &SkillManifest,
    previous: &SkillManifest,
    registry: &CapabilityRegistrySnapshot,
) -> Result<(), String> {
    candidate.validate_against_registry(registry)?;
    if candidate.status != SkillStatus::Draft {
        return Err("R4.2 sólo permite guardar manifiestos con status draft".into());
    }
    if candidate.skill_id != previous.skill_id
        || candidate.version != previous.version
        || candidate.provenance.author != previous.provenance.author
        || candidate.provenance.created_at != previous.provenance.created_at
        || candidate.provenance.procedure != previous.provenance.procedure
    {
        return Err(
            "Una edición no puede cambiar skillId, version, author, procedencia R5 ni provenance.createdAt".into(),
        );
    }
    if candidate.provenance.updated_at == previous.provenance.updated_at {
        return Err("Una edición debe actualizar provenance.updatedAt".into());
    }
    if candidate.revision_id == previous.revision_id
        || candidate.provenance.parent_revision_id.as_deref() != Some(previous.revision_id.as_str())
    {
        return Err("Una edición requiere un revisionId nuevo y parentRevisionId anterior".into());
    }
    Ok(())
}

fn read_skill_index(skills_root: &Path) -> Result<(SkillDraftStoreIndex, bool), String> {
    let path = skills_root.join("manifest.json");
    if !path.exists() {
        let drafts = skills_root.join("drafts");
        if drafts.exists()
            && fs::read_dir(&drafts)
                .map_err(|error| format!("No se pudo inspeccionar data/skills/drafts: {error}"))?
                .next()
                .is_some()
        {
            return Err("data/skills contiene borradores sin un manifest.json verificable".into());
        }
        return Ok((empty_skill_index(), false));
    }
    let bytes = read_bounded(&path, MAX_SKILL_FILE_BYTES)?;
    let index: SkillDraftStoreIndex = serde_json::from_slice(&bytes)
        .map_err(|error| format!("data/skills/manifest.json no es válido: {error}"))?;
    validate_skill_index(&index)?;
    Ok((index, true))
}

fn empty_skill_index() -> SkillDraftStoreIndex {
    SkillDraftStoreIndex {
        schema_version: SKILL_DRAFT_STORE_SCHEMA_VERSION,
        format: SKILL_DRAFT_STORE_FORMAT.into(),
        updated_at_ms: 0,
        drafts: Vec::new(),
    }
}

fn validate_skill_index(index: &SkillDraftStoreIndex) -> Result<(), String> {
    if index.schema_version != SKILL_DRAFT_STORE_SCHEMA_VERSION
        || index.format != SKILL_DRAFT_STORE_FORMAT
    {
        return Err("El índice de habilidades no usa el formato R4.2 esperado".into());
    }
    if index.updated_at_ms == 0 {
        return Err("El índice de habilidades no tiene una fecha de actualización válida".into());
    }
    if index.drafts.len() > MAX_SKILL_DRAFTS {
        return Err("El índice de habilidades excede el límite de borradores".into());
    }
    let mut ids = HashSet::new();
    let mut files = HashSet::new();
    for entry in &index.drafts {
        validate_skill_id(&entry.skill_id)?;
        validate_uuid_v4("draft.revisionId", &entry.revision_id)?;
        if entry.version == 0
            || entry.file_name != skill_file_name(&entry.skill_id)
            || !valid_sha256(&entry.sha256)
            || entry
                .backup_sha256
                .as_deref()
                .is_some_and(|digest| !valid_sha256(digest))
            || !ids.insert(entry.skill_id.as_str())
            || !files.insert(entry.file_name.as_str())
        {
            return Err("El índice de habilidades contiene una entrada inválida o repetida".into());
        }
    }
    Ok(())
}

fn load_indexed_drafts(
    skills_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    index: &SkillDraftStoreIndex,
) -> Result<Vec<LoadedSkillDraft>, String> {
    index
        .drafts
        .iter()
        .map(|entry| load_indexed_draft(skills_root, registry, entry))
        .collect()
}

fn load_indexed_draft(
    skills_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    entry: &SkillDraftIndexEntry,
) -> Result<LoadedSkillDraft, String> {
    let path = skills_root.join("drafts").join(&entry.file_name);
    let bytes = read_bounded(&path, MAX_SKILL_FILE_BYTES)?;
    let digest = sha256_hex(&bytes);
    if digest != entry.sha256 {
        return Err(format!(
            "La integridad SHA-256 del borrador '{}' no coincide con el índice",
            entry.skill_id
        ));
    }
    let manifest: SkillManifest = serde_json::from_slice(&bytes).map_err(|error| {
        format!(
            "El borrador '{}' no es JSON válido: {error}",
            entry.skill_id
        )
    })?;
    manifest.validate_against_registry(registry)?;
    if manifest.status != SkillStatus::Draft
        || manifest.skill_id != entry.skill_id
        || manifest.version != entry.version
        || manifest.revision_id != entry.revision_id
    {
        return Err(format!(
            "El borrador '{}' no coincide con su entrada del índice",
            entry.skill_id
        ));
    }
    let backup_path = skills_root
        .join("backups")
        .join(skill_backup_file_name(&entry.skill_id));
    let backup_available = if let Some(expected) = &entry.backup_sha256 {
        let backup_bytes = read_bounded(&backup_path, MAX_SKILL_FILE_BYTES)?;
        if sha256_hex(&backup_bytes) != *expected {
            return Err(format!(
                "La integridad SHA-256 del respaldo de '{}' no coincide con el índice",
                entry.skill_id
            ));
        }
        true
    } else {
        if backup_path.exists() {
            return Err(format!(
                "El borrador '{}' tiene un respaldo no declarado por el índice",
                entry.skill_id
            ));
        }
        false
    };
    Ok(LoadedSkillDraft {
        manifest,
        bytes,
        sha256: digest,
        path,
        backup_available,
    })
}

fn skill_draft_record(draft: LoadedSkillDraft) -> SkillDraftRecord {
    SkillDraftRecord {
        manifest: draft.manifest,
        sha256: draft.sha256,
        storage_path: draft.path.display().to_string(),
        backup_available: draft.backup_available,
    }
}

fn skill_file_name(skill_id: &str) -> String {
    format!("{skill_id}.json")
}

fn skill_backup_file_name(skill_id: &str) -> String {
    format!("{skill_id}.backup.json")
}

fn serialize_json<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn read_bounded(path: &Path, maximum: usize) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("No se pudo inspeccionar '{}': {error}", path.display()))?;
    if metadata.len() > maximum as u64 {
        return Err(format!("'{}' excede el límite de tamaño", path.display()));
    }
    fs::read(path).map_err(|error| format!("No se pudo leer '{}': {error}", path.display()))
}

fn read_optional_bounded(path: &Path, maximum: usize) -> Result<Option<Vec<u8>>, String> {
    if path.exists() {
        read_bounded(path, maximum).map(Some)
    } else {
        Ok(None)
    }
}

#[allow(clippy::too_many_arguments)]
fn rollback_skill_transaction(
    draft_path: &Path,
    previous_draft: Option<&[u8]>,
    backup_path: &Path,
    previous_backup: Option<&[u8]>,
    manifest_backup_path: &Path,
    previous_manifest_backup: Option<&[u8]>,
    index_path: &Path,
    previous_index: Option<&[u8]>,
) -> Result<(), String> {
    let targets = [
        (draft_path, previous_draft),
        (backup_path, previous_backup),
        (manifest_backup_path, previous_manifest_backup),
        (index_path, previous_index),
    ];
    let mut errors = Vec::new();
    for (path, previous) in targets {
        if let Err(error) = restore_optional_file(path, previous) {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn restore_optional_file(path: &Path, previous: Option<&[u8]>) -> Result<(), String> {
    match previous {
        Some(bytes) => atomic_replace(path, bytes),
        None if path.exists() => fs::remove_file(path)
            .map_err(|error| format!("No se pudo retirar '{}': {error}", path.display())),
        None => Ok(()),
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    crate::util::encode_hex_lower(Sha256::digest(bytes))
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .chars()
            .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character))
}

fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("'{}' no tiene directorio padre", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear '{}': {error}", parent.display()))?;
    let token = Uuid::new_v4();
    let temporary = parent.join(format!(".alice-{token}.tmp"));
    let displaced = parent.join(format!(".alice-{token}.previous"));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo preparar '{}': {error}", path.display()))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!(
            "No se pudo sincronizar '{}': {error}",
            path.display()
        ));
    }
    drop(file);

    let had_previous = path.exists();
    if had_previous {
        if let Err(error) = fs::rename(path, &displaced) {
            let _ = fs::remove_file(&temporary);
            return Err(format!("No se pudo proteger '{}': {error}", path.display()));
        }
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        if had_previous {
            let _ = fs::rename(&displaced, path);
        }
        return Err(format!(
            "No se pudo reemplazar '{}': {error}",
            path.display()
        ));
    }
    if had_previous {
        if let Err(error) = fs::remove_file(&displaced) {
            let failed_new = parent.join(format!(".alice-{token}.failed-new"));
            let rollback = fs::rename(path, &failed_new)
                .and_then(|_| fs::rename(&displaced, path))
                .and_then(|_| fs::remove_file(&failed_new));
            return match rollback {
                Ok(()) => Err(format!(
                    "No se pudo completar el reemplazo de '{}'; se restauró el archivo anterior: {error}",
                    path.display()
                )),
                Err(rollback) => Err(format!(
                    "No se pudo limpiar ni restaurar completamente '{}': {error}; {rollback}",
                    path.display()
                )),
            };
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::avatar::AvatarCapabilityProbe;
    use crate::capabilities::{capability_registry_from_probes, CapabilityProbeSnapshot};
    use crate::cloud::CloudCapabilityProbe;
    use crate::memory::{MemoryCapabilityProbe, MemoryResourceState};
    use crate::observation::ObservationCapabilityProbe;
    use crate::tasks::{TaskCapabilityProbe, TaskRegistryState};
    use std::fs;

    pub(super) fn registry() -> CapabilityRegistrySnapshot {
        capability_registry_from_probes(
            "2026-08-09T21:00:00-03:00".into(),
            &CapabilityProbeSnapshot {
                cloud: CloudCapabilityProbe {
                    provider_count: 6,
                    configured_provider_count: 0,
                    ollama_configured: false,
                },
                observation: Ok(ObservationCapabilityProbe {
                    enabled: false,
                    has_latest_context: false,
                }),
                memory: MemoryCapabilityProbe {
                    directory_exists: true,
                    manifest: MemoryResourceState::Valid,
                    records: MemoryResourceState::Valid,
                    backup: MemoryResourceState::Valid,
                },
                avatar: Ok(AvatarCapabilityProbe {
                    available: false,
                    size_bytes: 0,
                }),
                sensory: Err("runtime no necesario para validar manifiestos".into()),
                tasks: TaskCapabilityProbe {
                    state: TaskRegistryState::Missing,
                    task_count: 0,
                },
            },
        )
        .unwrap()
    }

    pub(super) fn manifest() -> SkillManifest {
        SkillManifest {
            schema_version: 1,
            skill_id: "local.revisar-memoria".into(),
            version: 1,
            revision_id: "9f8dc476-51f6-4a7d-858a-c18c9b953bf9".into(),
            title: "Revisar memoria local".into(),
            description: "Prepara una lectura visible de la memoria local sin modificar registros."
                .into(),
            purpose:
                "Permitir que Carlos inspeccione sus registros antes de decidir cualquier cambio."
                    .into(),
            provenance: SkillProvenance {
                author: "Carlos Nuñez".into(),
                origin: SkillOrigin::LocalUser,
                created_at: "2026-08-09T21:00:00-03:00".into(),
                updated_at: "2026-08-09T21:00:00-03:00".into(),
                parent_revision_id: None,
                procedure: None,
            },
            status: SkillStatus::Draft,
            declared_risk: CapabilityRisk::Medium,
            execution: SkillExecutionPolicy {
                mode: SkillExecutionMode::SimulationOnly,
                enabled: false,
                allow_network: false,
                allow_process_launch: false,
                allow_local_write: false,
            },
            required_capabilities: vec![SkillCapabilityRequirement {
                capability_id: "memory.records.read".into(),
                operations: vec!["load_memory".into()],
                reason: "Leer registros validados para preparar una vista local.".into(),
            }],
            inputs: vec![],
            outputs: vec![SkillOutput {
                id: "summary".into(),
                label: "Resumen visible".into(),
                description: "Resultado local preparado para revisión.".into(),
                kind: SkillValueKind::Text,
                sensitive: true,
            }],
            preconditions: vec![SkillPrecondition {
                id: "confirm-review".into(),
                label: "Confirmar simulación".into(),
                description: "Carlos confirma que desea ver el plan simulado.".into(),
                kind: SkillPreconditionKind::ManualConfirmation,
                reference: "user".into(),
            }],
            steps: vec![SkillStep {
                id: "read-memory".into(),
                title: "Preparar lectura".into(),
                description: "Representa la operación registrada sin ejecutarla durante R4.1."
                    .into(),
                kind: SkillStepKind::Capability,
                capability_id: Some("memory.records.read".into()),
                operation: Some("load_memory".into()),
                input_ids: vec![],
            }],
            success_checks: vec![SkillSuccessCheck {
                id: "summary-present".into(),
                label: "Resumen preparado".into(),
                description: "La simulación declara el resultado que deberá existir.".into(),
                kind: SkillSuccessCheckKind::OutputPresent,
                reference: "summary".into(),
            }],
        }
    }

    #[test]
    fn valid_draft_uses_the_real_42_capability_registry() {
        let registry = registry();
        assert_eq!(registry.capabilities.len(), 42);
        manifest().validate_new_draft(&registry).unwrap();
    }

    #[test]
    fn serialization_is_closed_and_camel_case() {
        let value = serde_json::to_value(manifest()).unwrap();
        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["execution"]["mode"], "simulationOnly");
        assert_eq!(
            value["requiredCapabilities"][0]["capabilityId"],
            "memory.records.read"
        );
        let mut unknown = value;
        unknown["script"] = serde_json::json!("powershell");
        assert!(serde_json::from_value::<SkillManifest>(unknown).is_err());
        assert!(
            serde_json::from_value::<SkillDraftReadInput>(serde_json::json!({
                "skillId": "local.revisar-memoria",
                "path": "E:/escape"
            }))
            .is_err()
        );
        assert!(
            serde_json::from_value::<SkillDraftSaveInput>(serde_json::json!({
                "manifest": manifest(),
                "expectedRevisionId": null,
                "execute": true
            }))
            .is_err()
        );
    }

    #[test]
    fn rejects_unknown_capability_and_operation() {
        let registry = registry();
        let mut unknown = manifest();
        unknown.required_capabilities[0].capability_id = "system.shell.execute".into();
        unknown.steps[0].capability_id = Some("system.shell.execute".into());
        assert!(unknown
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("no está registrada"));

        let mut operation = manifest();
        operation.required_capabilities[0].operations[0] = "delete_everything".into();
        operation.steps[0].operation = Some("delete_everything".into());
        assert!(operation
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("no pertenece"));
    }

    #[test]
    fn rejects_underdeclared_risk_and_unused_privileges() {
        let registry = registry();
        let mut risk = manifest();
        risk.declared_risk = CapabilityRisk::Low;
        assert!(risk
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("riesgo"));

        let mut privilege = manifest();
        privilege
            .required_capabilities
            .push(SkillCapabilityRequirement {
                capability_id: "context.foreground.read".into(),
                operations: vec!["get_foreground_context".into()],
                reason: "Privilegio adicional que ningún paso utiliza.".into(),
            });
        assert!(privilege
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("privilegios no utilizados"));
    }

    #[test]
    fn rejects_execution_flags_and_unprotected_paths() {
        let registry = registry();
        let mut enabled = manifest();
        enabled.execution.enabled = true;
        assert!(enabled
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("simulationOnly"));

        let mut path = manifest();
        path.inputs.push(SkillInput {
            id: "folder".into(),
            label: "Carpeta".into(),
            description: "Ruta local".into(),
            kind: SkillValueKind::Path,
            required: true,
            sensitive: false,
        });
        assert!(path
            .validate_against_registry(&registry)
            .unwrap_err()
            .contains("sensitive"));
    }

    #[test]
    fn new_skill_must_start_as_draft_version_one_without_parent() {
        let registry = registry();
        let mut approved = manifest();
        approved.status = SkillStatus::Approved;
        assert!(approved
            .validate_new_draft(&registry)
            .unwrap_err()
            .contains("draft"));
    }

    #[test]
    fn real_json_file_round_trip_preserves_manifest_without_execution() {
        let registry = registry();
        let root = std::env::temp_dir().join(format!("alice-r4-manifest-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("skill.json");
        let expected = manifest();
        fs::write(&path, serde_json::to_vec_pretty(&expected).unwrap()).unwrap();
        let parsed: SkillManifest = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        parsed.validate_new_draft(&registry).unwrap();
        assert_eq!(parsed, expected);
        assert!(!parsed.execution.enabled);
        fs::remove_dir_all(root).unwrap();
    }

    struct SkillStoreFixture {
        root: PathBuf,
    }

    impl SkillStoreFixture {
        fn new() -> Self {
            Self {
                root: std::env::temp_dir().join(format!("alice-r4-store-{}", Uuid::new_v4())),
            }
        }
    }

    impl Drop for SkillStoreFixture {
        fn drop(&mut self) {
            if self.root.exists() {
                fs::remove_dir_all(&self.root).expect("remove controlled skill fixture");
            }
        }
    }

    fn save_new(fixture: &SkillStoreFixture) -> SkillDraftRecord {
        save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: manifest(),
                expected_revision_id: None,
            },
        )
        .expect("save a valid skill draft")
    }

    #[test]
    fn passive_status_does_not_create_the_skills_directory() {
        let fixture = SkillStoreFixture::new();
        let snapshot = skill_draft_store_status_at(&fixture.root, &registry()).unwrap();
        assert!(!snapshot.existed);
        assert!(snapshot.drafts.is_empty());
        assert!(!fixture.root.exists());
    }

    #[test]
    fn new_draft_is_written_to_real_files_with_verified_sha256() {
        let fixture = SkillStoreFixture::new();
        let saved = save_new(&fixture);
        let draft_path = fixture
            .root
            .join("skills/drafts/local.revisar-memoria.json");
        let bytes = fs::read(&draft_path).expect("read stored draft");
        assert_eq!(saved.sha256, sha256_hex(&bytes));
        assert!(!saved.backup_available);
        assert!(fixture.root.join("skills/manifest.json").is_file());
        assert!(!fixture
            .root
            .join("skills/backups/local.revisar-memoria.backup.json")
            .exists());

        let loaded =
            read_skill_draft_at(&fixture.root, &registry(), "local.revisar-memoria").unwrap();
        assert_eq!(loaded.manifest, manifest());
        assert_eq!(loaded.sha256, saved.sha256);
    }

    #[test]
    fn editing_requires_parent_revision_and_preserves_the_previous_file() {
        let fixture = SkillStoreFixture::new();
        let first = save_new(&fixture);
        let first_bytes = fs::read(&first.storage_path).unwrap();
        let mut edited = first.manifest.clone();
        edited.revision_id = "5c848f83-37df-4b32-8124-6b06402dd195".into();
        edited.provenance.parent_revision_id = Some(first.manifest.revision_id.clone());
        edited.provenance.updated_at = "2026-08-09T22:00:00-03:00".into();
        edited.description =
            "Prepara una lectura visible y resumida sin modificar registros.".into();

        let saved = save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: edited.clone(),
                expected_revision_id: Some(first.manifest.revision_id),
            },
        )
        .unwrap();
        assert!(saved.backup_available);
        assert_eq!(saved.manifest, edited);
        assert_eq!(
            fs::read(
                fixture
                    .root
                    .join("skills/backups/local.revisar-memoria.backup.json")
            )
            .unwrap(),
            first_bytes
        );
        assert!(fixture
            .root
            .join("skills/backups/manifest.backup.json")
            .is_file());
    }

    #[test]
    fn stale_revision_is_rejected_without_changing_disk_bytes() {
        let fixture = SkillStoreFixture::new();
        let first = save_new(&fixture);
        let before_draft = fs::read(&first.storage_path).unwrap();
        let before_index = fs::read(fixture.root.join("skills/manifest.json")).unwrap();
        let mut edited = first.manifest;
        edited.revision_id = "5c848f83-37df-4b32-8124-6b06402dd195".into();
        edited.provenance.parent_revision_id = Some(edited.revision_id.clone());

        let error = save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: edited,
                expected_revision_id: Some("6dcb4379-9057-4cad-a1d0-570c29f426fd".into()),
            },
        )
        .unwrap_err();
        assert!(error.contains("Conflicto de revisión"));
        assert_eq!(fs::read(&first.storage_path).unwrap(), before_draft);
        assert_eq!(
            fs::read(fixture.root.join("skills/manifest.json")).unwrap(),
            before_index
        );
    }

    #[test]
    fn non_draft_status_never_creates_storage() {
        let fixture = SkillStoreFixture::new();
        let mut invalid = manifest();
        invalid.status = SkillStatus::Approved;
        let error = save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: invalid,
                expected_revision_id: None,
            },
        )
        .unwrap_err();
        assert!(error.contains("draft"));
        assert!(!fixture.root.exists());
    }

    #[test]
    fn traversal_like_skill_id_is_rejected_without_touching_disk() {
        let fixture = SkillStoreFixture::new();
        let error = read_skill_draft_at(&fixture.root, &registry(), "local.../escape").unwrap_err();
        assert!(error.contains("formato canónico"));
        assert!(!fixture.root.exists());
    }

    #[test]
    fn tampered_draft_is_detected_by_the_index_digest() {
        let fixture = SkillStoreFixture::new();
        let saved = save_new(&fixture);
        fs::write(&saved.storage_path, b"{}\n").unwrap();
        let error = skill_draft_store_status_at(&fixture.root, &registry()).unwrap_err();
        assert!(error.contains("integridad SHA-256"));
        assert_eq!(fs::read(&saved.storage_path).unwrap(), b"{}\n");
    }

    #[test]
    fn tampered_previous_backup_is_also_detected() {
        let fixture = SkillStoreFixture::new();
        let first = save_new(&fixture);
        let mut edited = first.manifest.clone();
        edited.revision_id = "5c848f83-37df-4b32-8124-6b06402dd195".into();
        edited.provenance.parent_revision_id = Some(first.manifest.revision_id.clone());
        edited.provenance.updated_at = "2026-08-09T22:00:00-03:00".into();
        save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: edited,
                expected_revision_id: Some(first.manifest.revision_id),
            },
        )
        .unwrap();
        fs::write(
            fixture
                .root
                .join("skills/backups/local.revisar-memoria.backup.json"),
            b"{}\n",
        )
        .unwrap();
        let error = skill_draft_store_status_at(&fixture.root, &registry()).unwrap_err();
        assert!(error.contains("integridad SHA-256 del respaldo"));
    }

    #[test]
    fn transaction_rollback_restores_draft_backup_and_both_indexes() {
        let fixture = SkillStoreFixture::new();
        let first = save_new(&fixture);
        let mut edited = first.manifest.clone();
        edited.revision_id = "5c848f83-37df-4b32-8124-6b06402dd195".into();
        edited.provenance.parent_revision_id = Some(first.manifest.revision_id.clone());
        edited.provenance.updated_at = "2026-08-09T22:00:00-03:00".into();
        save_skill_draft_at(
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: edited,
                expected_revision_id: Some(first.manifest.revision_id),
            },
        )
        .unwrap();

        let draft = fixture
            .root
            .join("skills/drafts/local.revisar-memoria.json");
        let backup = fixture
            .root
            .join("skills/backups/local.revisar-memoria.backup.json");
        let manifest_backup = fixture.root.join("skills/backups/manifest.backup.json");
        let index = fixture.root.join("skills/manifest.json");
        let originals = [
            fs::read(&draft).unwrap(),
            fs::read(&backup).unwrap(),
            fs::read(&manifest_backup).unwrap(),
            fs::read(&index).unwrap(),
        ];
        for path in [&draft, &backup, &manifest_backup, &index] {
            atomic_replace(path, b"partial transaction\n").unwrap();
        }

        rollback_skill_transaction(
            &draft,
            Some(&originals[0]),
            &backup,
            Some(&originals[1]),
            &manifest_backup,
            Some(&originals[2]),
            &index,
            Some(&originals[3]),
        )
        .unwrap();
        for (path, expected) in [&draft, &backup, &manifest_backup, &index]
            .into_iter()
            .zip(originals)
        {
            assert_eq!(fs::read(path).unwrap(), expected);
        }
        skill_draft_store_status_at(&fixture.root, &registry()).unwrap();
    }

    #[test]
    fn concurrent_edits_accept_exactly_one_revision_and_reject_the_stale_one() {
        let fixture = SkillStoreFixture::new();
        let store = SkillDraftStore::default();
        let first = save_skill_draft_guarded_at(
            &store,
            &fixture.root,
            &registry(),
            SkillDraftSaveInput {
                manifest: manifest(),
                expected_revision_id: None,
            },
        )
        .unwrap();
        let mut left = first.manifest.clone();
        left.revision_id = "5c848f83-37df-4b32-8124-6b06402dd195".into();
        left.provenance.parent_revision_id = Some(first.manifest.revision_id.clone());
        left.provenance.updated_at = "2026-08-09T22:00:00-03:00".into();
        let mut right = left.clone();
        right.revision_id = "6dcb4379-9057-4cad-a1d0-570c29f426fd".into();

        let expected = first.manifest.revision_id;
        let run = |candidate: SkillManifest| {
            let root = fixture.root.clone();
            let store = store.clone();
            let registry = registry();
            let expected = expected.clone();
            std::thread::spawn(move || {
                save_skill_draft_guarded_at(
                    &store,
                    &root,
                    &registry,
                    SkillDraftSaveInput {
                        manifest: candidate,
                        expected_revision_id: Some(expected),
                    },
                )
            })
        };
        let left_handle = run(left);
        let right_handle = run(right);
        let outcomes = [left_handle.join().unwrap(), right_handle.join().unwrap()];
        assert_eq!(outcomes.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            outcomes
                .iter()
                .filter(|result| result
                    .as_ref()
                    .is_err_and(|error| error.contains("Conflicto de revisión")))
                .count(),
            1
        );
        skill_draft_store_status_at(&fixture.root, &registry()).unwrap();
    }
}
