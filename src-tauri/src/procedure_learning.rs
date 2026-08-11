use crate::audit::{AuditEvent, AuditOutcome, AuditSource, AuditStage};
use crate::capabilities::{
    validate_timestamp, CapabilityMaturity, CapabilityRegistrySnapshot, CapabilityRisk,
};
use crate::skills::validate_skill_id;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub(crate) const PROCEDURE_CANDIDATE_SCHEMA_VERSION: u32 = 1;
const MIN_OCCURRENCES: usize = 3;
const MAX_OCCURRENCES: usize = 32;
const MIN_STEPS: usize = 2;
const MAX_STEPS: usize = 16;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureCandidate {
    pub(crate) schema_version: u32,
    pub(crate) candidate_id: String,
    pub(crate) generated_at: String,
    pub(crate) method: ProcedureDetectionMethod,
    pub(crate) status: ProcedureCandidateStatus,
    pub(crate) title: String,
    pub(crate) purpose: String,
    pub(crate) suggested_skill_id: String,
    pub(crate) declared_risk: CapabilityRisk,
    pub(crate) policy: ProcedureCandidatePolicy,
    pub(crate) steps: Vec<ProcedureCandidateStep>,
    pub(crate) occurrences: Vec<ProcedureOccurrence>,
    pub(crate) variations: Vec<ProcedureVariation>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProcedureDetectionMethod {
    R5AuditedRepetitionV1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProcedureCandidateStatus {
    Proposed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureCandidatePolicy {
    pub(crate) proposal_only: bool,
    pub(crate) auto_activation: bool,
    pub(crate) execution_enabled: bool,
    pub(crate) writes_durable_memory: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureCandidateStep {
    pub(crate) id: String,
    pub(crate) position: u32,
    pub(crate) capability_id: String,
    pub(crate) operation: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureOccurrence {
    pub(crate) operation_id: String,
    pub(crate) evidence: Vec<ProcedureEvidenceReference>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureEvidenceReference {
    pub(crate) step_id: String,
    pub(crate) event_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcedureVariation {
    pub(crate) step_id: String,
    pub(crate) dimension: ProcedureVariationDimension,
    pub(crate) distinct_values: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ProcedureVariationDimension {
    DurationMs,
    SubjectDigest,
}

impl ProcedureCandidate {
    pub(crate) fn validate_against(
        &self,
        registry: &CapabilityRegistrySnapshot,
        audit_events: &[AuditEvent],
    ) -> Result<(), String> {
        registry.validate()?;
        if self.schema_version != PROCEDURE_CANDIDATE_SCHEMA_VERSION {
            return Err(format!(
                "schemaVersion debe ser {PROCEDURE_CANDIDATE_SCHEMA_VERSION}"
            ));
        }
        validate_uuid_v4("candidateId", &self.candidate_id)?;
        validate_timestamp("generatedAt", &self.generated_at)?;
        validate_text("title", &self.title, 120)?;
        validate_text("purpose", &self.purpose, 600)?;
        validate_skill_id(&self.suggested_skill_id)?;
        self.validate_policy()?;

        if !(MIN_STEPS..=MAX_STEPS).contains(&self.steps.len()) {
            return Err(format!(
                "steps debe contener entre {MIN_STEPS} y {MAX_STEPS} pasos para excluir tareas triviales"
            ));
        }
        if !(MIN_OCCURRENCES..=MAX_OCCURRENCES).contains(&self.occurrences.len()) {
            return Err(format!(
                "occurrences debe contener entre {MIN_OCCURRENCES} y {MAX_OCCURRENCES} ejecuciones exitosas"
            ));
        }

        let capabilities = registry
            .capabilities
            .iter()
            .map(|capability| (capability.id.as_str(), capability))
            .collect::<HashMap<_, _>>();
        let mut step_ids = HashSet::new();
        let mut maximum_risk = CapabilityRisk::None;
        for (index, step) in self.steps.iter().enumerate() {
            validate_local_id("step.id", &step.id)?;
            if !step_ids.insert(step.id.as_str()) {
                return Err(format!("El paso '{}' está repetido", step.id));
            }
            let expected_position = u32::try_from(index + 1)
                .map_err(|_| "La posición del paso excede el rango admitido")?;
            if step.position != expected_position {
                return Err("Las posiciones de steps deben ser consecutivas desde 1".into());
            }
            let capability = capabilities
                .get(step.capability_id.as_str())
                .ok_or_else(|| {
                    format!(
                        "La capacidad '{}' no está registrada en R1",
                        step.capability_id
                    )
                })?;
            if capability.maturity == CapabilityMaturity::Planned {
                return Err(format!(
                    "El candidato no puede atribuir ejecuciones a la capacidad planificada '{}'",
                    step.capability_id
                ));
            }
            if !capability.operations.contains(&step.operation) {
                return Err(format!(
                    "La operación '{}' no pertenece a '{}'",
                    step.operation, step.capability_id
                ));
            }
            maximum_risk = maximum_risk.max_by_rank(capability.risk);
        }
        if risk_rank(self.declared_risk) < risk_rank(maximum_risk) {
            return Err("declaredRisk no puede ser menor que el riesgo observado".into());
        }

        let mut events_by_id = HashMap::new();
        for event in audit_events {
            event.validate()?;
            if events_by_id
                .insert(event.event_id.as_str(), event)
                .is_some()
            {
                return Err(format!("El evento R3 '{}' está repetido", event.event_id));
            }
        }

        let mut occurrence_ids = HashSet::new();
        let mut used_event_ids = HashSet::new();
        let mut evidence_by_step = self
            .steps
            .iter()
            .map(|step| (step.id.as_str(), Vec::with_capacity(self.occurrences.len())))
            .collect::<HashMap<_, Vec<&AuditEvent>>>();

        for occurrence in &self.occurrences {
            validate_uuid_v4("occurrence.operationId", &occurrence.operation_id)?;
            if !occurrence_ids.insert(occurrence.operation_id.as_str()) {
                return Err(format!(
                    "La ocurrencia '{}' está repetida",
                    occurrence.operation_id
                ));
            }
            if occurrence.evidence.len() != self.steps.len() {
                return Err("Cada ocurrencia debe aportar una evidencia por paso".into());
            }

            let mut previous_timestamp = 0;
            for (step, reference) in self.steps.iter().zip(&occurrence.evidence) {
                if reference.step_id != step.id {
                    return Err("La evidencia debe conservar el orden exacto de steps".into());
                }
                validate_uuid_v4("evidence.eventId", &reference.event_id)?;
                if !used_event_ids.insert(reference.event_id.as_str()) {
                    return Err(format!(
                        "El evento '{}' no puede probar más de una ocurrencia",
                        reference.event_id
                    ));
                }
                let event = events_by_id
                    .get(reference.event_id.as_str())
                    .ok_or_else(|| {
                        format!("No existe evidencia R3 para '{}'", reference.event_id)
                    })?;
                validate_successful_execution(event, occurrence, step)?;
                if event.timestamp_ms < previous_timestamp {
                    return Err(
                        "La evidencia de una ocurrencia no respeta el orden temporal".into(),
                    );
                }
                previous_timestamp = event.timestamp_ms;
                evidence_by_step
                    .get_mut(step.id.as_str())
                    .expect("step previamente indexado")
                    .push(event);
            }
        }

        let expected_variations = expected_variations(&self.steps, &evidence_by_step)?;
        let actual_variations = self.variations.iter().cloned().collect::<HashSet<_>>();
        if actual_variations.len() != self.variations.len() {
            return Err("variations contiene duplicados".into());
        }
        if actual_variations != expected_variations {
            return Err(
                "variations debe describir exactamente las diferencias comprobables en R3".into(),
            );
        }
        Ok(())
    }

    fn validate_policy(&self) -> Result<(), String> {
        if !self.policy.proposal_only
            || self.policy.auto_activation
            || self.policy.execution_enabled
            || self.policy.writes_durable_memory
        {
            return Err(
                "R5.1 exige sólo propuesta, sin autoactivación, ejecución ni memoria duradera"
                    .into(),
            );
        }
        Ok(())
    }
}

fn validate_successful_execution(
    event: &AuditEvent,
    occurrence: &ProcedureOccurrence,
    step: &ProcedureCandidateStep,
) -> Result<(), String> {
    if event.operation_id != occurrence.operation_id
        || event.capability_id.as_deref() != Some(step.capability_id.as_str())
        || event.operation != step.operation
    {
        return Err(format!(
            "La evidencia '{}' no coincide con la ocurrencia y el paso declarados",
            event.event_id
        ));
    }
    if !matches!(
        event.source,
        AuditSource::Capability | AuditSource::Memory | AuditSource::Cloud
    ) || event.stage != AuditStage::Execution
        || event.outcome != AuditOutcome::Success
        || event.decision.is_some()
    {
        return Err(format!(
            "La evidencia '{}' no es una ejecución productora exitosa",
            event.event_id
        ));
    }
    Ok(())
}

fn expected_variations(
    steps: &[ProcedureCandidateStep],
    evidence_by_step: &HashMap<&str, Vec<&AuditEvent>>,
) -> Result<HashSet<ProcedureVariation>, String> {
    let mut variations = HashSet::new();
    for step in steps {
        let events = evidence_by_step
            .get(step.id.as_str())
            .ok_or_else(|| format!("Falta evidencia para el paso '{}'", step.id))?;
        let durations = events
            .iter()
            .map(|event| event.duration_ms)
            .collect::<HashSet<_>>();
        let digests = events
            .iter()
            .map(|event| event.subject_digest.as_deref())
            .collect::<HashSet<_>>();
        add_variation(
            &mut variations,
            &step.id,
            ProcedureVariationDimension::DurationMs,
            durations.len(),
        )?;
        add_variation(
            &mut variations,
            &step.id,
            ProcedureVariationDimension::SubjectDigest,
            digests.len(),
        )?;
    }
    Ok(variations)
}

fn add_variation(
    variations: &mut HashSet<ProcedureVariation>,
    step_id: &str,
    dimension: ProcedureVariationDimension,
    distinct_values: usize,
) -> Result<(), String> {
    if distinct_values > 1 {
        variations.insert(ProcedureVariation {
            step_id: step_id.to_string(),
            dimension,
            distinct_values: u32::try_from(distinct_values)
                .map_err(|_| "La variación excede el rango admitido")?,
        });
    }
    Ok(())
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

fn validate_uuid_v4(field: &str, value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} debe ser UUID v4"))?;
    if parsed.get_version_num() != 4 || parsed.to_string() != value.to_ascii_lowercase() {
        return Err(format!("{field} debe ser UUID v4 canónico"));
    }
    Ok(())
}

fn validate_local_id(field: &str, value: &str) -> Result<(), String> {
    let valid = (1..=64).contains(&value.len())
        && value
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_lowercase())
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

fn validate_text(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    if value.trim().is_empty()
        || value.len() > maximum
        || value.chars().any(|character| character.is_control())
    {
        Err(format!(
            "{field} debe ser texto visible de hasta {maximum} caracteres"
        ))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::{
        CapabilityDescriptor, CapabilityDomain, CapabilityEffect, CapabilityHealth,
        CapabilityHealthStatus, CapabilityKind, CapabilityPermission, CapabilityPermissionEnforcer,
        CapabilityPermissionMode, CapabilityState, CAPABILITY_REGISTRY_SCHEMA_VERSION,
    };
    use serde_json::json;

    fn capability(
        id: &str,
        operation: &str,
        domain: CapabilityDomain,
        risk: CapabilityRisk,
    ) -> CapabilityDescriptor {
        CapabilityDescriptor {
            id: id.into(),
            version: 1,
            label: format!("Capacidad {id}"),
            description: "Capacidad aislada para validar el contrato R5.".into(),
            domain,
            kind: CapabilityKind::Query,
            maturity: CapabilityMaturity::Implemented,
            adapter: "test-contract".into(),
            operations: vec![operation.into()],
            state: CapabilityState::Idle,
            risk,
            effects: vec![CapabilityEffect::LocalRead],
            data_scopes: vec!["isolatedFixture".into()],
            requirements: vec![],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ImplicitRead,
                enforced_by: CapabilityPermissionEnforcer::Native,
                summary: "Prueba local sin efectos.".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Healthy,
                summary: "Contrato disponible.".into(),
                checked_at: Some("2026-08-11T12:00:00Z".into()),
            },
            last_execution: None,
        }
    }

    fn registry() -> CapabilityRegistrySnapshot {
        CapabilityRegistrySnapshot {
            schema_version: CAPABILITY_REGISTRY_SCHEMA_VERSION,
            generated_at: "2026-08-11T12:00:00Z".into(),
            capabilities: vec![
                capability(
                    "memory.records.read",
                    "loadValidatedRecords",
                    CapabilityDomain::Memory,
                    CapabilityRisk::Medium,
                ),
                capability(
                    "cloud.providers.inspect",
                    "cloud_status",
                    CapabilityDomain::Cloud,
                    CapabilityRisk::Low,
                ),
            ],
        }
    }

    fn evidence() -> (Vec<AuditEvent>, Vec<ProcedureOccurrence>) {
        let mut events = Vec::new();
        let mut occurrences = Vec::new();
        for index in 0..3_u64 {
            let operation_id = Uuid::new_v4().to_string();
            let memory = AuditEvent::producer(
                operation_id.clone(),
                AuditSource::Memory,
                "memory.records.read".into(),
                "loadValidatedRecords".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(4 + index),
                Some(format!("sha256:{}", "a".repeat(64))),
                "MEMORY_READ_COMPLETED",
            )
            .expect("evento memory");
            let cloud = AuditEvent::producer(
                operation_id.clone(),
                AuditSource::Cloud,
                "cloud.providers.inspect".into(),
                "cloud_status".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(2),
                None,
                "PROVIDERS_INSPECTED",
            )
            .expect("evento cloud");
            occurrences.push(ProcedureOccurrence {
                operation_id,
                evidence: vec![
                    ProcedureEvidenceReference {
                        step_id: "leer-memoria".into(),
                        event_id: memory.event_id.clone(),
                    },
                    ProcedureEvidenceReference {
                        step_id: "revisar-proveedores".into(),
                        event_id: cloud.event_id.clone(),
                    },
                ],
            });
            events.extend([memory, cloud]);
        }
        (events, occurrences)
    }

    fn candidate_fixture() -> (ProcedureCandidate, Vec<AuditEvent>) {
        let (events, occurrences) = evidence();
        (
            ProcedureCandidate {
                schema_version: PROCEDURE_CANDIDATE_SCHEMA_VERSION,
                candidate_id: Uuid::new_v4().to_string(),
                generated_at: "2026-08-11T12:05:00Z".into(),
                method: ProcedureDetectionMethod::R5AuditedRepetitionV1,
                status: ProcedureCandidateStatus::Proposed,
                title: "Revisión local repetida".into(),
                purpose: "Consultar memoria y disponibilidad de proveedores de forma visible."
                    .into(),
                suggested_skill_id: "local.revision-repetida".into(),
                declared_risk: CapabilityRisk::Medium,
                policy: ProcedureCandidatePolicy {
                    proposal_only: true,
                    auto_activation: false,
                    execution_enabled: false,
                    writes_durable_memory: false,
                },
                steps: vec![
                    ProcedureCandidateStep {
                        id: "leer-memoria".into(),
                        position: 1,
                        capability_id: "memory.records.read".into(),
                        operation: "loadValidatedRecords".into(),
                    },
                    ProcedureCandidateStep {
                        id: "revisar-proveedores".into(),
                        position: 2,
                        capability_id: "cloud.providers.inspect".into(),
                        operation: "cloud_status".into(),
                    },
                ],
                occurrences,
                variations: vec![ProcedureVariation {
                    step_id: "leer-memoria".into(),
                    dimension: ProcedureVariationDimension::DurationMs,
                    distinct_values: 3,
                }],
            },
            events,
        )
    }

    #[test]
    fn accepts_three_real_correlated_occurrences_without_side_effects() {
        let (candidate, events) = candidate_fixture();
        let untouched = std::env::temp_dir().join(format!(
            "alice-r5-contract-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        assert!(!untouched.exists());
        assert_eq!(candidate.validate_against(&registry(), &events), Ok(()));
        assert!(!untouched.exists());
    }

    #[test]
    fn serializes_closed_policy_and_rejects_unknown_fields() {
        let (candidate, _) = candidate_fixture();
        let value = serde_json::to_value(&candidate).expect("serialización");
        assert_eq!(value["method"], json!("r5AuditedRepetitionV1"));
        assert_eq!(value["policy"]["proposalOnly"], json!(true));
        assert_eq!(value["policy"]["executionEnabled"], json!(false));

        let mut unknown = value;
        unknown["inventedLearning"] = json!(true);
        assert!(serde_json::from_value::<ProcedureCandidate>(unknown).is_err());
    }

    #[test]
    fn rejects_single_occurrence_and_trivial_single_step() {
        let (mut candidate, events) = candidate_fixture();
        candidate.occurrences.truncate(1);
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("occurrences"));

        let (mut candidate, events) = candidate_fixture();
        candidate.steps.truncate(1);
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("steps"));
    }

    #[test]
    fn rejects_unverified_or_reused_evidence() {
        let (candidate, mut events) = candidate_fixture();
        events[0].stage = AuditStage::Request;
        events[0].outcome = AuditOutcome::Pending;
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("no es una ejecución productora exitosa"));

        let (mut second, events) = candidate_fixture();
        second.occurrences[1].evidence[0].event_id =
            second.occurrences[0].evidence[0].event_id.clone();
        assert!(second
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("no puede probar más de una ocurrencia"));
    }

    #[test]
    fn rejects_invented_variations_and_unsafe_policy() {
        let (mut candidate, events) = candidate_fixture();
        candidate.variations.clear();
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("exactamente las diferencias"));

        let (mut candidate, events) = candidate_fixture();
        candidate.policy.auto_activation = true;
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("sin autoactivación"));
    }

    #[test]
    fn rejects_unknown_capabilities_operations_and_understated_risk() {
        let (mut candidate, events) = candidate_fixture();
        candidate.steps[0].capability_id = "memory.invented.read".into();
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("no está registrada"));

        let (mut candidate, events) = candidate_fixture();
        candidate.steps[0].operation = "invented_operation".into();
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("no pertenece"));

        let (mut candidate, events) = candidate_fixture();
        candidate.declared_risk = CapabilityRisk::Low;
        assert!(candidate
            .validate_against(&registry(), &events)
            .unwrap_err()
            .contains("riesgo observado"));
    }
}
