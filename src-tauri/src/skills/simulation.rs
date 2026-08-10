use super::*;
use crate::capabilities::{
    current_capability_registry, CapabilityEffect, CapabilityHealthStatus, CapabilityMaturity,
    CapabilityPermissionEnforcer, CapabilityPermissionMode, CapabilityState,
};
use crate::observation::ObservationStore;
use crate::sensory::SensorLeaseStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, State};

pub(crate) const SKILL_SIMULATION_SCHEMA_VERSION: u32 = 1;
const SKILL_SIMULATION_METHOD: &str = "r4-static-plan-v1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillSimulationInput {
    manifest: SkillManifest,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillSimulationResult {
    schema_version: u32,
    method: String,
    generated_at: String,
    registry_schema_version: u32,
    manifest_sha256: String,
    plan_sha256: String,
    skill: SimulatedSkillIdentity,
    inputs: Vec<SimulatedInput>,
    outputs: Vec<SimulatedOutput>,
    required_capabilities: Vec<SimulatedCapability>,
    preconditions: Vec<SimulatedPrecondition>,
    steps: Vec<SimulatedStep>,
    success_checks: Vec<SimulatedSuccessCheck>,
    blocks: Vec<SimulationBlock>,
    can_execute: bool,
    adapter_invocation_count: u32,
    side_effects_applied: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedSkillIdentity {
    skill_id: String,
    version: u32,
    revision_id: String,
    title: String,
    status: SkillStatus,
    declared_risk: CapabilityRisk,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedInput {
    id: String,
    label: String,
    kind: SkillValueKind,
    required: bool,
    sensitive: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedOutput {
    id: String,
    label: String,
    kind: SkillValueKind,
    sensitive: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedCapability {
    capability_id: String,
    label: String,
    maturity: CapabilityMaturity,
    state: CapabilityState,
    health: CapabilityHealthStatus,
    risk: CapabilityRisk,
    operations: Vec<String>,
    effects: Vec<CapabilityEffect>,
    data_scopes: Vec<String>,
    requirements: Vec<String>,
    permission: SimulatedPermission,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedPermission {
    mode: CapabilityPermissionMode,
    enforced_by: CapabilityPermissionEnforcer,
    requires_user_decision: bool,
    summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedPrecondition {
    id: String,
    label: String,
    kind: SkillPreconditionKind,
    reference: String,
    evaluated: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedSuccessCheck {
    id: String,
    label: String,
    kind: SkillSuccessCheckKind,
    reference: String,
    evaluated: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulatedStep {
    position: u32,
    step_id: String,
    title: String,
    kind: SkillStepKind,
    capability_id: Option<String>,
    operation: Option<String>,
    input_ids: Vec<String>,
    readiness: SimulationStepReadiness,
    block_codes: Vec<SimulationBlockCode>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum SimulationStepReadiness {
    Available,
    ManualReview,
    Blocked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimulationBlock {
    code: SimulationBlockCode,
    capability_id: Option<String>,
    step_id: Option<String>,
    summary: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum SimulationBlockCode {
    ExecutionDisabled,
    StatusNotApproved,
    InputsNotProvided,
    PreconditionsUnevaluated,
    CapabilityPlanned,
    CapabilityUnavailable,
    CapabilityUnhealthy,
    PermissionUnavailable,
}

#[tauri::command]
pub(crate) fn simulate_skill_plan(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    input: SkillSimulationInput,
) -> Result<SkillSimulationResult, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    simulate_skill_plan_against_registry(&input.manifest, &registry)
}

fn simulate_skill_plan_against_registry(
    manifest: &SkillManifest,
    registry: &CapabilityRegistrySnapshot,
) -> Result<SkillSimulationResult, String> {
    manifest.validate_against_registry(registry)?;
    let manifest_sha256 = sha256_hex(
        &serde_json::to_vec(manifest)
            .map_err(|error| format!("No se pudo canonicalizar el manifiesto: {error}"))?,
    );
    let capability_by_id = registry
        .capabilities
        .iter()
        .map(|capability| (capability.id.as_str(), capability))
        .collect::<HashMap<_, _>>();

    let required_capabilities = manifest
        .required_capabilities
        .iter()
        .map(|requirement| {
            let capability = capability_by_id
                .get(requirement.capability_id.as_str())
                .expect("manifest validation resolved every capability");
            SimulatedCapability {
                capability_id: capability.id.clone(),
                label: capability.label.clone(),
                maturity: capability.maturity,
                state: capability.state,
                health: capability.health.status,
                risk: capability.risk,
                operations: requirement.operations.clone(),
                effects: capability.effects.clone(),
                data_scopes: capability.data_scopes.clone(),
                requirements: capability.requirements.clone(),
                permission: SimulatedPermission {
                    mode: capability.permission.mode,
                    enforced_by: capability.permission.enforced_by,
                    requires_user_decision: capability.permission.mode
                        != CapabilityPermissionMode::ImplicitRead,
                    summary: capability.permission.summary.clone(),
                },
            }
        })
        .collect::<Vec<_>>();

    let mut blocks = vec![SimulationBlock {
        code: SimulationBlockCode::ExecutionDisabled,
        capability_id: None,
        step_id: None,
        summary: "R4.3 analiza el plan, pero la ejecución de habilidades está deshabilitada."
            .into(),
    }];
    if manifest.status != SkillStatus::Approved {
        blocks.push(SimulationBlock {
            code: SimulationBlockCode::StatusNotApproved,
            capability_id: None,
            step_id: None,
            summary: "El manifiesto no está aprobado; R4.3 no cambia su estado.".into(),
        });
    }
    if manifest.inputs.iter().any(|input| input.required) {
        blocks.push(SimulationBlock {
            code: SimulationBlockCode::InputsNotProvided,
            capability_id: None,
            step_id: None,
            summary: "La simulación describe entradas obligatorias, pero no recibe sus valores."
                .into(),
        });
    }
    if !manifest.preconditions.is_empty() {
        blocks.push(SimulationBlock {
            code: SimulationBlockCode::PreconditionsUnevaluated,
            capability_id: None,
            step_id: None,
            summary: "Las precondiciones se muestran sin evaluarse ni solicitar permisos.".into(),
        });
    }

    let steps = manifest
        .steps
        .iter()
        .enumerate()
        .map(|(index, step)| {
            let mut block_codes = Vec::new();
            if let Some(capability_id) = &step.capability_id {
                let capability = capability_by_id
                    .get(capability_id.as_str())
                    .expect("manifest validation resolved every step capability");
                if capability.maturity == CapabilityMaturity::Planned {
                    add_step_block(
                        &mut blocks,
                        &mut block_codes,
                        SimulationBlockCode::CapabilityPlanned,
                        capability_id,
                        &step.id,
                        "La capacidad sólo está planificada y no tiene adaptador ejecutable.",
                    );
                }
                if matches!(
                    capability.state,
                    CapabilityState::Unavailable | CapabilityState::Disabled
                ) {
                    add_step_block(
                        &mut blocks,
                        &mut block_codes,
                        SimulationBlockCode::CapabilityUnavailable,
                        capability_id,
                        &step.id,
                        "La capacidad no está disponible en el snapshot R1 vigente.",
                    );
                }
                if matches!(
                    capability.state,
                    CapabilityState::Degraded | CapabilityState::Error
                ) || matches!(
                    capability.health.status,
                    CapabilityHealthStatus::Degraded | CapabilityHealthStatus::Error
                ) {
                    add_step_block(
                        &mut blocks,
                        &mut block_codes,
                        SimulationBlockCode::CapabilityUnhealthy,
                        capability_id,
                        &step.id,
                        "La salud o el estado de la capacidad impiden considerarla disponible.",
                    );
                }
                if capability.permission.enforced_by == CapabilityPermissionEnforcer::None {
                    add_step_block(
                        &mut blocks,
                        &mut block_codes,
                        SimulationBlockCode::PermissionUnavailable,
                        capability_id,
                        &step.id,
                        "La capacidad no tiene una autoridad de permisos aplicable.",
                    );
                }
            }
            let readiness = match step.kind {
                SkillStepKind::Manual => SimulationStepReadiness::ManualReview,
                SkillStepKind::Capability if block_codes.is_empty() => {
                    SimulationStepReadiness::Available
                }
                SkillStepKind::Capability => SimulationStepReadiness::Blocked,
            };
            SimulatedStep {
                position: u32::try_from(index + 1).expect("skill steps are limited to 64"),
                step_id: step.id.clone(),
                title: step.title.clone(),
                kind: step.kind,
                capability_id: step.capability_id.clone(),
                operation: step.operation.clone(),
                input_ids: step.input_ids.clone(),
                readiness,
                block_codes,
            }
        })
        .collect::<Vec<_>>();

    let mut result = SkillSimulationResult {
        schema_version: SKILL_SIMULATION_SCHEMA_VERSION,
        method: SKILL_SIMULATION_METHOD.into(),
        generated_at: registry.generated_at.clone(),
        registry_schema_version: registry.schema_version,
        manifest_sha256,
        plan_sha256: String::new(),
        skill: SimulatedSkillIdentity {
            skill_id: manifest.skill_id.clone(),
            version: manifest.version,
            revision_id: manifest.revision_id.clone(),
            title: manifest.title.clone(),
            status: manifest.status,
            declared_risk: manifest.declared_risk,
        },
        inputs: manifest
            .inputs
            .iter()
            .map(|input| SimulatedInput {
                id: input.id.clone(),
                label: input.label.clone(),
                kind: input.kind,
                required: input.required,
                sensitive: input.sensitive,
            })
            .collect(),
        outputs: manifest
            .outputs
            .iter()
            .map(|output| SimulatedOutput {
                id: output.id.clone(),
                label: output.label.clone(),
                kind: output.kind,
                sensitive: output.sensitive,
            })
            .collect(),
        required_capabilities,
        preconditions: manifest
            .preconditions
            .iter()
            .map(|condition| SimulatedPrecondition {
                id: condition.id.clone(),
                label: condition.label.clone(),
                kind: condition.kind,
                reference: condition.reference.clone(),
                evaluated: false,
            })
            .collect(),
        steps,
        success_checks: manifest
            .success_checks
            .iter()
            .map(|condition| SimulatedSuccessCheck {
                id: condition.id.clone(),
                label: condition.label.clone(),
                kind: condition.kind,
                reference: condition.reference.clone(),
                evaluated: false,
            })
            .collect(),
        blocks,
        can_execute: false,
        adapter_invocation_count: 0,
        side_effects_applied: false,
    };
    result.plan_sha256 = result.calculate_digest()?;
    Ok(result)
}

fn add_step_block(
    blocks: &mut Vec<SimulationBlock>,
    step_codes: &mut Vec<SimulationBlockCode>,
    code: SimulationBlockCode,
    capability_id: &str,
    step_id: &str,
    summary: &str,
) {
    step_codes.push(code);
    blocks.push(SimulationBlock {
        code,
        capability_id: Some(capability_id.into()),
        step_id: Some(step_id.into()),
        summary: summary.into(),
    });
}

impl SkillSimulationResult {
    fn calculate_digest(&self) -> Result<String, String> {
        let mut unsigned = self.clone();
        unsigned.plan_sha256.clear();
        serde_json::to_vec(&unsigned)
            .map(|bytes| sha256_hex(&bytes))
            .map_err(|error| format!("No se pudo calcular la integridad del plan: {error}"))
    }

    #[cfg(test)]
    fn validate_digest(&self) -> Result<(), String> {
        if valid_sha256(&self.manifest_sha256)
            && valid_sha256(&self.plan_sha256)
            && self.plan_sha256 == self.calculate_digest()?
        {
            Ok(())
        } else {
            Err("La integridad SHA-256 del resultado de simulación no coincide".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::avatar::AvatarCapabilityProbe;
    use crate::capabilities::{capability_registry_from_probes, CapabilityProbeSnapshot};
    use crate::cloud::CloudCapabilityProbe;
    use crate::memory::{MemoryCapabilityProbe, MemoryResourceState};
    use crate::observation::{ObservationCapabilityProbe, ObservationStore};
    use crate::sensory::SensorLeaseStore;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn registry() -> CapabilityRegistrySnapshot {
        capability_registry_from_probes(
            "2026-08-10T00:00:00-03:00".into(),
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
                sensory: Err("runtime no necesario para simulación estática".into()),
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
            description: "Prepara una lectura visible sin modificar registros.".into(),
            purpose: "Permitir una revisión humana antes de decidir cambios.".into(),
            provenance: SkillProvenance {
                author: "Carlos Nuñez".into(),
                origin: SkillOrigin::LocalUser,
                created_at: "2026-08-10T00:00:00-03:00".into(),
                updated_at: "2026-08-10T00:00:00-03:00".into(),
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
                reason: "Preparar una vista local.".into(),
            }],
            inputs: vec![SkillInput {
                id: "query".into(),
                label: "Consulta privada".into(),
                description: "Texto local que no debe aparecer en el plan.".into(),
                kind: SkillValueKind::Text,
                required: true,
                sensitive: true,
            }],
            outputs: vec![SkillOutput {
                id: "summary".into(),
                label: "Resumen".into(),
                description: "Resultado visible.".into(),
                kind: SkillValueKind::Text,
                sensitive: true,
            }],
            preconditions: vec![SkillPrecondition {
                id: "confirm-review".into(),
                label: "Confirmar revisión".into(),
                description: "Requiere confirmación humana.".into(),
                kind: SkillPreconditionKind::ManualConfirmation,
                reference: "user".into(),
            }],
            steps: vec![SkillStep {
                id: "read-memory".into(),
                title: "Preparar lectura".into(),
                description: "Representa la lectura sin ejecutarla.".into(),
                kind: SkillStepKind::Capability,
                capability_id: Some("memory.records.read".into()),
                operation: Some("load_memory".into()),
                input_ids: vec!["query".into()],
            }],
            success_checks: vec![SkillSuccessCheck {
                id: "summary-present".into(),
                label: "Resumen preparado".into(),
                description: "Comprueba la salida declarada.".into(),
                kind: SkillSuccessCheckKind::OutputPresent,
                reference: "summary".into(),
            }],
        }
    }

    #[test]
    fn simulation_resolves_real_registry_without_execution() {
        let result = simulate_skill_plan_against_registry(&manifest(), &registry()).unwrap();
        assert_eq!(result.required_capabilities.len(), 1);
        assert_eq!(
            result.required_capabilities[0].effects,
            vec![CapabilityEffect::LocalRead]
        );
        assert_eq!(
            result.steps[0].readiness,
            SimulationStepReadiness::Available
        );
        assert!(!result.can_execute);
        assert_eq!(result.adapter_invocation_count, 0);
        assert!(!result.side_effects_applied);
        assert!(result
            .blocks
            .iter()
            .any(|block| block.code == SimulationBlockCode::ExecutionDisabled));
        result.validate_digest().unwrap();
    }

    #[test]
    fn simulation_is_deterministic_for_the_same_manifest_and_registry() {
        let first = simulate_skill_plan_against_registry(&manifest(), &registry()).unwrap();
        let second = simulate_skill_plan_against_registry(&manifest(), &registry()).unwrap();
        assert_eq!(first, second);
        assert_eq!(first.plan_sha256.len(), 64);
    }

    #[test]
    fn planned_capability_reports_all_static_blocks() {
        let mut planned = manifest();
        planned.declared_risk = CapabilityRisk::High;
        planned.required_capabilities[0] = SkillCapabilityRequirement {
            capability_id: "perception.screen.observe".into(),
            operations: vec!["observeSelectedScreen".into()],
            reason: "Representar una pantalla futura.".into(),
        };
        planned.steps[0].capability_id = Some("perception.screen.observe".into());
        planned.steps[0].operation = Some("observeSelectedScreen".into());
        let result = simulate_skill_plan_against_registry(&planned, &registry()).unwrap();
        assert_eq!(result.steps[0].readiness, SimulationStepReadiness::Blocked);
        for expected in [
            SimulationBlockCode::CapabilityPlanned,
            SimulationBlockCode::CapabilityUnavailable,
            SimulationBlockCode::PermissionUnavailable,
        ] {
            assert!(result.blocks.iter().any(|block| block.code == expected));
        }
    }

    #[test]
    fn result_contains_no_input_values_or_manifest_descriptions() {
        let mut private = manifest();
        private.description = "SECRETO-DESCRIPCION".into();
        private.inputs[0].description = "SECRETO-ENTRADA".into();
        private.steps[0].description = "SECRETO-PASO".into();
        let json = serde_json::to_string(
            &simulate_skill_plan_against_registry(&private, &registry()).unwrap(),
        )
        .unwrap();
        assert!(!json.contains("SECRETO"));
        assert!(json.contains("\"sensitive\":true"));
    }

    #[test]
    fn simulation_does_not_modify_a_real_controlled_file() {
        let root = std::env::temp_dir().join(format!("alice-r4-simulation-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let sentinel = root.join("private-sentinel.json");
        fs::write(&sentinel, b"{\"private\":true}\n").unwrap();
        let before = fs::read(&sentinel).unwrap();
        simulate_skill_plan_against_registry(&manifest(), &registry()).unwrap();
        assert_eq!(fs::read(&sentinel).unwrap(), before);
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_manifest_and_unknown_input_fields_are_rejected() {
        let mut risk = manifest();
        risk.declared_risk = CapabilityRisk::Low;
        assert!(simulate_skill_plan_against_registry(&risk, &registry())
            .unwrap_err()
            .contains("riesgo"));
        assert!(
            serde_json::from_value::<SkillSimulationInput>(serde_json::json!({
                "manifest": manifest(),
                "execute": true
            }))
            .is_err()
        );
    }

    #[test]
    fn altered_simulation_digest_is_detected() {
        let mut result = simulate_skill_plan_against_registry(&manifest(), &registry()).unwrap();
        result.can_execute = true;
        assert!(result.validate_digest().is_err());
    }

    fn collect_files(root: &Path, current: &Path, files: &mut Vec<PathBuf>) {
        for entry in fs::read_dir(current).expect("read canonical data directory") {
            let path = entry.expect("read canonical data entry").path();
            if path.is_dir() {
                collect_files(root, &path, files);
            } else {
                assert!(path.starts_with(root));
                files.push(path);
            }
        }
    }

    fn directory_digest(root: &Path) -> (usize, String) {
        let mut files = Vec::new();
        collect_files(root, root, &mut files);
        files.sort();
        let mut hasher = Sha256::new();
        for path in &files {
            hasher.update(
                path.strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .as_bytes(),
            );
            hasher.update([0]);
            hasher.update(fs::read(path).expect("read canonical data file"));
            hasher.update([0xff]);
        }
        (files.len(), format!("{:x}", hasher.finalize()))
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_registry_simulation_is_read_only() {
        let root = PathBuf::from(
            std::env::var_os("ALICE_LIVE_DATA_DIR")
                .expect("ALICE_LIVE_DATA_DIR is required for the live R4.3 probe"),
        );
        assert!(root.is_absolute() && root.is_dir());
        let before = directory_digest(&root);
        let probes = CapabilityProbeSnapshot::collect(
            &root,
            &ObservationStore::default(),
            &SensorLeaseStore::default(),
        );
        let live_registry =
            capability_registry_from_probes("2026-08-10T01:00:00-03:00".into(), &probes).unwrap();
        assert_eq!(live_registry.capabilities.len(), 24);
        let result = simulate_skill_plan_against_registry(&manifest(), &live_registry).unwrap();
        assert!(!result.can_execute);
        assert_eq!(result.adapter_invocation_count, 0);
        assert!(!result.side_effects_applied);
        result.validate_digest().unwrap();
        assert_eq!(directory_digest(&root), before);
    }
}
