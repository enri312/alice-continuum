use crate::capabilities::{
    validate_timestamp, CapabilityMaturity, CapabilityRegistrySnapshot, CapabilityRisk,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub(crate) const SKILL_MANIFEST_SCHEMA_VERSION: u32 = 1;

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

fn validate_skill_id(value: &str) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::avatar::AvatarCapabilityProbe;
    use crate::capabilities::{capability_registry_from_probes, CapabilityProbeSnapshot};
    use crate::cloud::CloudCapabilityProbe;
    use crate::memory::{MemoryCapabilityProbe, MemoryResourceState};
    use crate::observation::ObservationCapabilityProbe;
    use std::fs;

    fn registry() -> CapabilityRegistrySnapshot {
        capability_registry_from_probes(
            "2026-08-09T21:00:00-03:00".into(),
            &CapabilityProbeSnapshot {
                cloud: CloudCapabilityProbe {
                    provider_count: 6,
                    configured_provider_count: 0,
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
            },
        )
        .unwrap()
    }

    fn manifest() -> SkillManifest {
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
    fn valid_draft_uses_the_real_24_capability_registry() {
        let registry = registry();
        assert_eq!(registry.capabilities.len(), 24);
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
}
