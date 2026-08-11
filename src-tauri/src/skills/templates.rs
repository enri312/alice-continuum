use super::*;
use crate::capabilities::{current_capability_registry, current_utc_timestamp};
use crate::observation::ObservationStore;
use crate::sensory::SensorLeaseStore;
use tauri::{AppHandle, State};

pub(crate) const READ_ONLY_TEMPLATE_SKILL_ID: &str = "local.revisar-proveedores-ia";
pub(crate) const READ_ONLY_TEMPLATE_CAPABILITY_ID: &str = "cloud.providers.inspect";
pub(crate) const READ_ONLY_TEMPLATE_OPERATION: &str = "cloud_status";

#[tauri::command]
pub(crate) fn prepare_read_only_skill_template(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
) -> Result<SkillManifest, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let manifest = read_only_provider_template(&current_utc_timestamp()?);
    manifest.validate_against_registry(&registry)?;
    Ok(manifest)
}

pub(super) fn read_only_provider_template(now: &str) -> SkillManifest {
    SkillManifest {
        schema_version: SKILL_MANIFEST_SCHEMA_VERSION,
        skill_id: READ_ONLY_TEMPLATE_SKILL_ID.into(),
        version: 1,
        revision_id: Uuid::new_v4().to_string(),
        title: "Revisar proveedores de IA locales".into(),
        description: "Prepara una consulta local que indica qué proveedores están configurados sin revelar credenciales ni enviar datos a Internet.".into(),
        purpose: "Permitir que el propietario compruebe las rutas de inferencia disponibles antes de autorizar una conversación.".into(),
        provenance: SkillProvenance {
            author: "Propietario local".into(),
            origin: SkillOrigin::LocalUser,
            created_at: now.into(),
            updated_at: now.into(),
            parent_revision_id: None,
        },
        status: SkillStatus::Draft,
        declared_risk: CapabilityRisk::Low,
        execution: SkillExecutionPolicy {
            mode: SkillExecutionMode::SimulationOnly,
            enabled: false,
            allow_network: false,
            allow_process_launch: false,
            allow_local_write: false,
        },
        required_capabilities: vec![SkillCapabilityRequirement {
            capability_id: READ_ONLY_TEMPLATE_CAPABILITY_ID.into(),
            operations: vec![READ_ONLY_TEMPLATE_OPERATION.into()],
            reason: "Leer únicamente presencia de configuración y modelos públicos declarados por los adaptadores locales.".into(),
        }],
        inputs: vec![],
        outputs: vec![SkillOutput {
            id: "provider-status".into(),
            label: "Estado visible de proveedores".into(),
            description: "Lista local de proveedores, disponibilidad de configuración y modelo inicial público.".into(),
            kind: SkillValueKind::Text,
            sensitive: false,
        }],
        preconditions: vec![SkillPrecondition {
            id: "capability-ready".into(),
            label: "Capacidad registrada".into(),
            description: "La consulta debe continuar registrada y saludable en el núcleo nativo.".into(),
            kind: SkillPreconditionKind::CapabilityAvailable,
            reference: READ_ONLY_TEMPLATE_CAPABILITY_ID.into(),
        }],
        steps: vec![SkillStep {
            id: "inspect-providers".into(),
            title: "Inspeccionar configuración presente".into(),
            description: "Consulta el estado sanitizado de adaptadores; no devuelve claves y no realiza solicitudes de red.".into(),
            kind: SkillStepKind::Capability,
            capability_id: Some(READ_ONLY_TEMPLATE_CAPABILITY_ID.into()),
            operation: Some(READ_ONLY_TEMPLATE_OPERATION.into()),
            input_ids: vec![],
        }],
        success_checks: vec![SkillSuccessCheck {
            id: "provider-status-present".into(),
            label: "Estado preparado".into(),
            description: "La consulta deberá producir el estado visible sin incluir secretos.".into(),
            kind: SkillSuccessCheckKind::OutputPresent,
            reference: "provider-status".into(),
        }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::lifecycle::{
        audited_transition_at, read_skill_lifecycle_at, SkillLifecycleAction, SkillLifecycleActor,
        SkillLifecycleConfirmation, SkillLifecycleTransitionInput,
    };
    use crate::skills::simulation::simulate_skill_plan_against_registry;
    use std::fs;

    struct RealFileFixture {
        root: std::path::PathBuf,
    }

    impl RealFileFixture {
        fn new() -> Self {
            Self {
                root: std::env::temp_dir()
                    .join(format!("alice-r45-read-only-e2e-{}", Uuid::new_v4())),
            }
        }
    }

    impl Drop for RealFileFixture {
        fn drop(&mut self) {
            if self.root.starts_with(std::env::temp_dir()) {
                let _ = fs::remove_dir_all(&self.root);
            }
        }
    }

    #[test]
    fn native_read_only_template_uses_real_registry_contract_without_write_or_network() {
        let registry = crate::skills::tests::registry();
        let manifest = read_only_provider_template("2026-08-10T12:00:00Z");
        manifest.validate_against_registry(&registry).unwrap();

        let capability = registry
            .capabilities
            .iter()
            .find(|capability| capability.id == READ_ONLY_TEMPLATE_CAPABILITY_ID)
            .unwrap();
        assert_eq!(capability.maturity, CapabilityMaturity::Implemented);
        assert_eq!(capability.risk, CapabilityRisk::Low);
        assert_eq!(capability.operations, vec![READ_ONLY_TEMPLATE_OPERATION]);
        assert!(!capability.effects.iter().any(|effect| matches!(
            effect,
            crate::capabilities::CapabilityEffect::LocalWrite
                | crate::capabilities::CapabilityEffect::NetworkSend
                | crate::capabilities::CapabilityEffect::ProcessLaunch
        )));
        assert!(!manifest.execution.enabled);
        assert!(!manifest.execution.allow_network);
        assert!(!manifest.execution.allow_local_write);
        assert!(!manifest.execution.allow_process_launch);
    }

    #[test]
    fn first_read_only_skill_completes_real_file_simulation_and_approval_flow() {
        let fixture = RealFileFixture::new();
        let registry = crate::skills::tests::registry();
        let manifest = read_only_provider_template("2026-08-10T12:00:00Z");
        let saved = save_skill_draft_at(
            &fixture.root,
            &registry,
            SkillDraftSaveInput {
                manifest: manifest.clone(),
                expected_revision_id: None,
            },
        )
        .unwrap();
        assert!(std::path::Path::new(&saved.storage_path).is_file());

        let simulation = simulate_skill_plan_against_registry(&saved.manifest, &registry).unwrap();
        let simulation_json = serde_json::to_value(simulation).unwrap();
        assert_eq!(simulation_json["adapterInvocationCount"], 0);
        assert_eq!(simulation_json["sideEffectsApplied"], false);
        assert_eq!(
            simulation_json["requiredCapabilities"][0]["capabilityId"],
            READ_ONLY_TEMPLATE_CAPABILITY_ID
        );

        let review = audited_transition_at(
            &fixture.root,
            &registry,
            SkillLifecycleTransitionInput {
                skill_id: saved.manifest.skill_id.clone(),
                expected_revision_id: saved.manifest.revision_id.clone(),
                action: SkillLifecycleAction::SubmitReview,
                confirmation: SkillLifecycleConfirmation {
                    actor: SkillLifecycleActor::LocalOwner,
                    confirmed: true,
                    expected_sha256: saved.sha256.clone(),
                    reason: "Validación E2E local de la primera habilidad de lectura".into(),
                },
            },
            |_| Ok(()),
        )
        .unwrap();
        let review_json = serde_json::to_value(&review).unwrap();
        let approved = audited_transition_at(
            &fixture.root,
            &registry,
            SkillLifecycleTransitionInput {
                skill_id: saved.manifest.skill_id.clone(),
                expected_revision_id: review_json["manifest"]["revisionId"]
                    .as_str()
                    .unwrap()
                    .into(),
                action: SkillLifecycleAction::Approve,
                confirmation: SkillLifecycleConfirmation {
                    actor: SkillLifecycleActor::LocalOwner,
                    confirmed: true,
                    expected_sha256: review_json["sha256"].as_str().unwrap().into(),
                    reason: "Aprobación E2E después de revisar identidad y huella".into(),
                },
            },
            |_| Ok(()),
        )
        .unwrap();
        let approved_json = serde_json::to_value(approved).unwrap();
        assert_eq!(approved_json["manifest"]["status"], "approved");
        assert_eq!(approved_json["executionEnabled"], false);
        assert_eq!(approved_json["manifest"]["execution"]["enabled"], false);
        assert!(fixture.root.join("skills").join("lifecycle.json").is_file());
        let reopened =
            read_skill_lifecycle_at(&fixture.root, &registry, READ_ONLY_TEMPLATE_SKILL_ID).unwrap();
        let reopened_json = serde_json::to_value(reopened).unwrap();
        assert_eq!(reopened_json["manifest"]["status"], "approved");
        assert_eq!(reopened_json["executionEnabled"], false);
    }
}
