use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub(crate) const CAPABILITY_REGISTRY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityRegistrySnapshot {
    pub(crate) schema_version: u32,
    pub(crate) generated_at: String,
    pub(crate) capabilities: Vec<CapabilityDescriptor>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityDescriptor {
    pub(crate) id: String,
    pub(crate) version: u32,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) domain: CapabilityDomain,
    pub(crate) kind: CapabilityKind,
    pub(crate) maturity: CapabilityMaturity,
    pub(crate) adapter: String,
    pub(crate) operations: Vec<String>,
    pub(crate) state: CapabilityState,
    pub(crate) risk: CapabilityRisk,
    pub(crate) effects: Vec<CapabilityEffect>,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) requirements: Vec<String>,
    pub(crate) permission: CapabilityPermission,
    pub(crate) health: CapabilityHealth,
    pub(crate) last_execution: Option<CapabilityLastExecution>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityPermission {
    pub(crate) mode: CapabilityPermissionMode,
    pub(crate) enforced_by: CapabilityPermissionEnforcer,
    pub(crate) summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityHealth {
    pub(crate) status: CapabilityHealthStatus,
    pub(crate) summary: String,
    pub(crate) checked_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum CapabilityLastExecution {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityDomain {
    Cloud,
    Context,
    Memory,
    Avatar,
    Output,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityKind {
    Observation,
    Query,
    Mutation,
    Export,
    Process,
    Presentation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityMaturity {
    Implemented,
    Partial,
    Planned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityState {
    Unavailable,
    Disabled,
    Idle,
    Active,
    Degraded,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityRisk {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityEffect {
    None,
    LocalRead,
    LocalWrite,
    NetworkSend,
    ProcessLaunch,
    WindowMetadataRead,
    CredentialPresenceRead,
    AssetRender,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityHealthStatus {
    Unchecked,
    Healthy,
    Degraded,
    Unavailable,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityPermissionMode {
    ImplicitRead,
    SessionOptIn,
    ExplicitPreview,
    ExplicitConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityPermissionEnforcer {
    Native,
    CurrentUi,
    OperatingSystem,
    None,
}

impl CapabilityRegistrySnapshot {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.schema_version != CAPABILITY_REGISTRY_SCHEMA_VERSION {
            return Err(format!(
                "schemaVersion debe ser {}",
                CAPABILITY_REGISTRY_SCHEMA_VERSION
            ));
        }
        validate_timestamp("generatedAt", &self.generated_at)?;

        let mut identifiers = HashSet::with_capacity(self.capabilities.len());
        for capability in &self.capabilities {
            if !identifiers.insert(capability.id.as_str()) {
                return Err(format!(
                    "El identificador de capacidad '{}' está repetido",
                    capability.id
                ));
            }
            capability.validate()?;
        }

        Ok(())
    }
}

impl CapabilityDescriptor {
    fn validate(&self) -> Result<(), String> {
        if !is_valid_capability_id(&self.id) {
            return Err(format!(
                "El identificador de capacidad '{}' no es válido",
                self.id
            ));
        }
        if self.version == 0 {
            return Err(format!(
                "La versión de la capacidad '{}' debe ser positiva",
                self.id
            ));
        }

        validate_text(&self.id, "label", &self.label)?;
        validate_text(&self.id, "description", &self.description)?;
        validate_text(&self.id, "adapter", &self.adapter)?;
        validate_text(&self.id, "permission.summary", &self.permission.summary)?;
        validate_text(&self.id, "health.summary", &self.health.summary)?;
        validate_text_list(&self.id, "operations", &self.operations, true)?;
        validate_text_list(&self.id, "dataScopes", &self.data_scopes, false)?;
        validate_text_list(&self.id, "requirements", &self.requirements, false)?;

        if self.effects.is_empty() {
            return Err(format!(
                "La capacidad '{}' debe declarar al menos un efecto",
                self.id
            ));
        }
        if self.effects.contains(&CapabilityEffect::None) && self.effects.len() != 1 {
            return Err(format!(
                "La capacidad '{}' no puede combinar el efecto 'none' con otros efectos",
                self.id
            ));
        }

        self.validate_health()?;

        if self.last_execution.is_some() {
            return Err(format!(
                "La capacidad '{}' debe mantener lastExecution en null durante R1",
                self.id
            ));
        }

        if self.maturity == CapabilityMaturity::Planned {
            if self.adapter != "none" {
                return Err(format!(
                    "La capacidad planificada '{}' debe usar el adaptador 'none'",
                    self.id
                ));
            }
            if self.state != CapabilityState::Unavailable {
                return Err(format!(
                    "La capacidad planificada '{}' debe estar unavailable",
                    self.id
                ));
            }
            if self.health.status != CapabilityHealthStatus::Unavailable
                || self.health.checked_at.is_some()
            {
                return Err(format!(
                    "La capacidad planificada '{}' debe informar salud unavailable sin sonda",
                    self.id
                ));
            }
        } else if self.adapter == "none" {
            return Err(format!(
                "La capacidad implementada o parcial '{}' debe declarar un adaptador real",
                self.id
            ));
        }

        if self.state == CapabilityState::Active
            && (self.health.checked_at.is_none()
                || !matches!(
                    self.health.status,
                    CapabilityHealthStatus::Healthy | CapabilityHealthStatus::Degraded
                ))
        {
            return Err(format!(
                "La capacidad activa '{}' requiere una comprobación real y vigente",
                self.id
            ));
        }

        if self.state == CapabilityState::Degraded
            && self.health.status != CapabilityHealthStatus::Degraded
        {
            return Err(format!(
                "La capacidad degradada '{}' debe informar salud degraded",
                self.id
            ));
        }

        if self.state == CapabilityState::Error
            && self.health.status != CapabilityHealthStatus::Error
        {
            return Err(format!(
                "La capacidad con error '{}' debe informar salud error",
                self.id
            ));
        }

        Ok(())
    }

    fn validate_health(&self) -> Result<(), String> {
        if let Some(checked_at) = &self.health.checked_at {
            validate_timestamp("health.checkedAt", checked_at)?;
        }

        match self.health.status {
            CapabilityHealthStatus::Unchecked if self.health.checked_at.is_some() => Err(format!(
                "La salud unchecked de '{}' no puede tener checkedAt",
                self.id
            )),
            CapabilityHealthStatus::Healthy
            | CapabilityHealthStatus::Degraded
            | CapabilityHealthStatus::Error
                if self.health.checked_at.is_none() =>
            {
                Err(format!(
                    "La salud {:?} de '{}' requiere checkedAt",
                    self.health.status, self.id
                ))
            }
            _ => Ok(()),
        }
    }
}

fn validate_text(capability_id: &str, field: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!(
            "El campo {field} de la capacidad '{capability_id}' no puede estar vacío"
        ));
    }
    Ok(())
}

fn validate_text_list(
    capability_id: &str,
    field: &str,
    values: &[String],
    required: bool,
) -> Result<(), String> {
    if required && values.is_empty() {
        return Err(format!(
            "La capacidad '{capability_id}' debe declarar al menos un valor en {field}"
        ));
    }
    if values.iter().any(|value| value.trim().is_empty()) {
        return Err(format!(
            "La capacidad '{capability_id}' contiene un valor vacío en {field}"
        ));
    }
    Ok(())
}

fn is_valid_capability_id(value: &str) -> bool {
    let segments: Vec<_> = value.split('.').collect();
    segments.len() >= 2
        && segments.iter().all(|segment| {
            let mut characters = segment.chars();
            characters
                .next()
                .is_some_and(|first| first.is_ascii_lowercase())
                && characters
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        })
}

fn validate_timestamp(field: &str, value: &str) -> Result<(), String> {
    if is_iso_8601_timestamp(value) {
        Ok(())
    } else {
        Err(format!("El campo {field} debe contener una fecha ISO-8601"))
    }
}

fn is_iso_8601_timestamp(value: &str) -> bool {
    if !value.is_ascii() {
        return false;
    }

    let Some((date, time_with_zone)) = value.split_once('T') else {
        return false;
    };
    if !is_valid_date(date) {
        return false;
    }

    let time = if let Some(value) = time_with_zone.strip_suffix('Z') {
        value
    } else if time_with_zone.len() >= 6 {
        let zone_start = time_with_zone.len() - 6;
        let (candidate_time, zone) = time_with_zone.split_at(zone_start);
        if !is_valid_timezone(zone) {
            return false;
        }
        candidate_time
    } else {
        return false;
    };

    is_valid_time(time)
}

fn is_valid_date(value: &str) -> bool {
    if value.len() != 10 || &value[4..5] != "-" || &value[7..8] != "-" {
        return false;
    }

    let Some(year) = parse_number(&value[0..4]) else {
        return false;
    };
    let Some(month) = parse_number(&value[5..7]) else {
        return false;
    };
    let Some(day) = parse_number(&value[8..10]) else {
        return false;
    };
    if year == 0 || !(1..=12).contains(&month) {
        return false;
    }

    let days_in_month = match month {
        2 if is_leap_year(year) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    (1..=days_in_month).contains(&day)
}

fn is_valid_time(value: &str) -> bool {
    let mut parts = value.split(':');
    let (Some(hours), Some(minutes), Some(seconds), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };

    let Some(hours) = parse_number(hours) else {
        return false;
    };
    let Some(minutes) = parse_number(minutes) else {
        return false;
    };
    let (whole_seconds, fraction) = seconds
        .split_once('.')
        .map_or((seconds, None), |(whole, fraction)| (whole, Some(fraction)));
    let Some(seconds) = parse_number(whole_seconds) else {
        return false;
    };

    hours <= 23
        && minutes <= 59
        && seconds <= 59
        && fraction.is_none_or(|value| {
            !value.is_empty() && value.chars().all(|character| character.is_ascii_digit())
        })
}

fn is_valid_timezone(value: &str) -> bool {
    value.len() == 6
        && matches!(&value[0..1], "+" | "-")
        && &value[3..4] == ":"
        && parse_number(&value[1..3]).is_some_and(|hours| hours <= 23)
        && parse_number(&value[4..6]).is_some_and(|minutes| minutes <= 59)
}

fn parse_number(value: &str) -> Option<u32> {
    (!value.is_empty() && value.chars().all(|character| character.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn implemented_capability() -> CapabilityDescriptor {
        CapabilityDescriptor {
            id: "memory.records.read".into(),
            version: 1,
            label: "Leer memoria".into(),
            description: "Lee y valida los registros locales existentes.".into(),
            domain: CapabilityDomain::Memory,
            kind: CapabilityKind::Query,
            maturity: CapabilityMaturity::Partial,
            adapter: "memory".into(),
            operations: vec!["loadValidatedRecords".into()],
            state: CapabilityState::Idle,
            risk: CapabilityRisk::Medium,
            effects: vec![CapabilityEffect::LocalRead],
            data_scopes: vec!["memoryRecords".into()],
            requirements: vec!["Directorio de memoria válido".into()],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ImplicitRead,
                enforced_by: CapabilityPermissionEnforcer::CurrentUi,
                summary: "Lectura iniciada por la interfaz actual.".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Healthy,
                summary: "Estructura local disponible.".into(),
                checked_at: Some("2026-08-08T18:00:00-03:00".into()),
            },
            last_execution: None,
        }
    }

    fn planned_capability() -> CapabilityDescriptor {
        CapabilityDescriptor {
            id: "output.voice.synthesize".into(),
            version: 1,
            label: "Síntesis de voz".into(),
            description: "Representa un puente futuro todavía sin adaptador.".into(),
            domain: CapabilityDomain::Output,
            kind: CapabilityKind::Presentation,
            maturity: CapabilityMaturity::Planned,
            adapter: "none".into(),
            operations: vec!["synthesizeAuthorizedText".into()],
            state: CapabilityState::Unavailable,
            risk: CapabilityRisk::Low,
            effects: vec![CapabilityEffect::None],
            data_scopes: vec!["authorizedText".into()],
            requirements: vec!["Adaptador de voz revisado".into()],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ExplicitConfirmation,
                enforced_by: CapabilityPermissionEnforcer::None,
                summary: "No existe control porque el adaptador no está implementado.".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Unavailable,
                summary: "Capacidad planificada sin adaptador.".into(),
                checked_at: None,
            },
            last_execution: None,
        }
    }

    fn snapshot(capabilities: Vec<CapabilityDescriptor>) -> CapabilityRegistrySnapshot {
        CapabilityRegistrySnapshot {
            schema_version: CAPABILITY_REGISTRY_SCHEMA_VERSION,
            generated_at: "2026-08-08T18:00:00-03:00".into(),
            capabilities,
        }
    }

    #[test]
    fn snapshot_serializes_the_camel_case_contract() {
        let value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();

        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["generatedAt"], "2026-08-08T18:00:00-03:00");
        assert_eq!(value["capabilities"][0]["dataScopes"][0], "memoryRecords");
        assert_eq!(
            value["capabilities"][0]["permission"]["enforcedBy"],
            "currentUi"
        );
        assert_eq!(
            value["capabilities"][0]["health"]["checkedAt"],
            "2026-08-08T18:00:00-03:00"
        );
        assert_eq!(value["capabilities"][0]["lastExecution"], json!(null));
    }

    #[test]
    fn enumerations_serialize_the_approved_values() {
        assert_eq!(
            serde_json::to_value([
                CapabilityDomain::Cloud,
                CapabilityDomain::Context,
                CapabilityDomain::Memory,
                CapabilityDomain::Avatar,
                CapabilityDomain::Output,
            ])
            .unwrap(),
            json!(["cloud", "context", "memory", "avatar", "output"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityKind::Observation,
                CapabilityKind::Query,
                CapabilityKind::Mutation,
                CapabilityKind::Export,
                CapabilityKind::Process,
                CapabilityKind::Presentation,
            ])
            .unwrap(),
            json!([
                "observation",
                "query",
                "mutation",
                "export",
                "process",
                "presentation"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityMaturity::Implemented,
                CapabilityMaturity::Partial,
                CapabilityMaturity::Planned,
            ])
            .unwrap(),
            json!(["implemented", "partial", "planned"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityState::Unavailable,
                CapabilityState::Disabled,
                CapabilityState::Idle,
                CapabilityState::Active,
                CapabilityState::Degraded,
                CapabilityState::Error,
            ])
            .unwrap(),
            json!([
                "unavailable",
                "disabled",
                "idle",
                "active",
                "degraded",
                "error"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityRisk::None,
                CapabilityRisk::Low,
                CapabilityRisk::Medium,
                CapabilityRisk::High,
                CapabilityRisk::Critical,
            ])
            .unwrap(),
            json!(["none", "low", "medium", "high", "critical"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityEffect::None,
                CapabilityEffect::LocalRead,
                CapabilityEffect::LocalWrite,
                CapabilityEffect::NetworkSend,
                CapabilityEffect::ProcessLaunch,
                CapabilityEffect::WindowMetadataRead,
                CapabilityEffect::CredentialPresenceRead,
                CapabilityEffect::AssetRender,
            ])
            .unwrap(),
            json!([
                "none",
                "localRead",
                "localWrite",
                "networkSend",
                "processLaunch",
                "windowMetadataRead",
                "credentialPresenceRead",
                "assetRender"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityHealthStatus::Unchecked,
                CapabilityHealthStatus::Healthy,
                CapabilityHealthStatus::Degraded,
                CapabilityHealthStatus::Unavailable,
                CapabilityHealthStatus::Error,
            ])
            .unwrap(),
            json!(["unchecked", "healthy", "degraded", "unavailable", "error"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionMode::ExplicitConfirmation,
            ])
            .unwrap(),
            json!([
                "implicitRead",
                "sessionOptIn",
                "explicitPreview",
                "explicitConfirmation"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityPermissionEnforcer::Native,
                CapabilityPermissionEnforcer::CurrentUi,
                CapabilityPermissionEnforcer::OperatingSystem,
                CapabilityPermissionEnforcer::None,
            ])
            .unwrap(),
            json!(["native", "currentUi", "operatingSystem", "none"])
        );
    }

    #[test]
    fn validation_accepts_implemented_and_planned_capabilities() {
        assert_eq!(
            snapshot(vec![implemented_capability(), planned_capability()]).validate(),
            Ok(())
        );
    }

    #[test]
    fn validation_rejects_unknown_schema_and_duplicate_ids() {
        let mut invalid_schema = snapshot(vec![]);
        invalid_schema.schema_version = 2;
        assert_eq!(
            invalid_schema.validate(),
            Err("schemaVersion debe ser 1".into())
        );

        let duplicate = implemented_capability();
        assert!(snapshot(vec![duplicate.clone(), duplicate])
            .validate()
            .unwrap_err()
            .contains("está repetido"));
    }

    #[test]
    fn validation_rejects_invalid_ids_versions_and_timestamps() {
        let mut capability = implemented_capability();
        capability.id = "Memory.records.read".into();
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("no es válido"));

        let mut capability = implemented_capability();
        capability.version = 0;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("debe ser positiva"));

        let mut invalid_date = snapshot(vec![]);
        invalid_date.generated_at = "2026-02-30T18:00:00Z".into();
        assert!(invalid_date.validate().is_err());
    }

    #[test]
    fn validation_enforces_planned_capability_invariants() {
        let mut capability = planned_capability();
        capability.adapter = "voice".into();
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("adaptador 'none'"));

        let mut capability = planned_capability();
        capability.state = CapabilityState::Idle;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("debe estar unavailable"));

        let mut capability = planned_capability();
        capability.health.checked_at = Some("2026-08-08T18:00:00Z".into());
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("sin sonda"));
    }

    #[test]
    fn validation_requires_real_health_evidence_for_active_state() {
        let mut capability = implemented_capability();
        capability.state = CapabilityState::Active;
        capability.health.status = CapabilityHealthStatus::Unchecked;
        capability.health.checked_at = None;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("comprobación real y vigente"));
    }

    #[test]
    fn validation_keeps_last_execution_null_during_r1() {
        let mut value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();
        value["capabilities"][0]["lastExecution"] = json!({
            "correlationId": "event-1",
            "occurredAt": "2026-08-08T18:00:00Z",
            "outcome": "succeeded"
        });

        assert!(serde_json::from_value::<CapabilityRegistrySnapshot>(value).is_err());
    }

    #[test]
    fn deserialization_rejects_unknown_fields() {
        let mut value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();
        value["capabilities"][0]["inventedTelemetry"] = json!(42);

        assert!(serde_json::from_value::<CapabilityRegistrySnapshot>(value).is_err());
    }
}
