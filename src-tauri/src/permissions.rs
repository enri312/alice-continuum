use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

mod gateway;

use crate::observation::ObservationStore;
pub(crate) use gateway::{AuthorizedExecution, PermissionGateway, PermissionGatewayStatus};
use serde_json::json;
use tauri::State;

pub(crate) const PERMISSION_GATEWAY_SCHEMA_VERSION: u32 = 1;
pub(crate) const HIGH_RISK_DECISION_TTL_SECONDS: u64 = 60;
pub(crate) const STANDARD_DECISION_TTL_SECONDS: u64 = 300;
pub(crate) const MAX_SESSION_DURATION_SECONDS: u32 = 300;

const MAX_ID_LENGTH: usize = 128;
const MAX_OPERATION_LENGTH: usize = 96;
const MAX_PURPOSE_LENGTH: usize = 280;
const MAX_SUMMARY_LENGTH: usize = 320;
const MAX_WARNING_LENGTH: usize = 240;
const MAX_RESOURCE_LABEL_LENGTH: usize = 160;

const FOREGROUND_CONTROL_CAPABILITY: &str = "context.foreground.control";
const FOREGROUND_CONTROL_OPERATION: &str = "setContextObservationEnabled";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreparePermissionRequestInput {
    pub(crate) idempotency_key: String,
    pub(crate) capability_id: String,
    pub(crate) operation: String,
    pub(crate) purpose: String,
    pub(crate) parameters: ForegroundControlParameters,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ForegroundControlParameters {
    pub(crate) enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CancelPermissionRequestInput {
    pub(crate) request_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RevokePermissionGrantInput {
    pub(crate) grant_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ExecutePermissionGrantInput {
    pub(crate) grant_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContextObservationExecutionResult {
    pub(crate) grant: PermissionGrant,
    pub(crate) enabled: bool,
}

#[tauri::command]
pub(crate) fn permission_gateway_status(
    gateway: State<'_, PermissionGateway>,
) -> Result<PermissionGatewayStatus, String> {
    gateway.status()
}

#[tauri::command]
pub(crate) fn prepare_permission_request(
    input: PreparePermissionRequestInput,
    gateway: State<'_, PermissionGateway>,
) -> Result<PreparedPermissionRequest, String> {
    prepare_supported_permission_request(&gateway, input)
}

#[tauri::command]
pub(crate) fn decide_permission_request(
    input: PermissionDecisionInput,
    gateway: State<'_, PermissionGateway>,
) -> Result<Option<PermissionGrant>, String> {
    gateway.decide(input)
}

#[tauri::command]
pub(crate) fn cancel_permission_request(
    input: CancelPermissionRequestInput,
    gateway: State<'_, PermissionGateway>,
) -> Result<PreparedPermissionRequest, String> {
    input.validate()?;
    gateway.cancel_request(&input.request_id)
}

#[tauri::command]
pub(crate) fn revoke_permission_grant(
    input: RevokePermissionGrantInput,
    gateway: State<'_, PermissionGateway>,
    observation: State<'_, ObservationStore>,
) -> Result<PermissionGrant, String> {
    revoke_permission_grant_impl(&gateway, &observation, input)
}

#[tauri::command]
pub(crate) fn execute_context_observation_grant(
    input: ExecutePermissionGrantInput,
    gateway: State<'_, PermissionGateway>,
    observation: State<'_, ObservationStore>,
) -> Result<ContextObservationExecutionResult, String> {
    execute_context_observation_grant_impl(&gateway, &observation, input)
}

fn revoke_permission_grant_impl(
    gateway: &PermissionGateway,
    observation: &ObservationStore,
    input: RevokePermissionGrantInput,
) -> Result<PermissionGrant, String> {
    input.validate()?;
    gateway.with_adapter_transition(|| revoke_permission_grant_locked(gateway, observation, &input))
}

fn revoke_permission_grant_locked(
    gateway: &PermissionGateway,
    observation: &ObservationStore,
    input: &RevokePermissionGrantInput,
) -> Result<PermissionGrant, String> {
    let previous = gateway.grant(&input.grant_id)?;
    let revoked = gateway.revoke_grant(&input.grant_id)?;
    if previous.capability_id == FOREGROUND_CONTROL_CAPABILITY
        && previous.operation == FOREGROUND_CONTROL_OPERATION
        && previous.mode == PermissionMode::Session
        && previous.state == PermissionGrantState::Active
    {
        observation.disable_for_grant(&input.grant_id)?;
    }
    Ok(revoked)
}

fn execute_context_observation_grant_impl(
    gateway: &PermissionGateway,
    observation: &ObservationStore,
    input: ExecutePermissionGrantInput,
) -> Result<ContextObservationExecutionResult, String> {
    input.validate()?;
    gateway.with_adapter_transition(|| {
        execute_context_observation_grant_locked(gateway, observation, &input)
    })
}

fn execute_context_observation_grant_locked(
    gateway: &PermissionGateway,
    observation: &ObservationStore,
    input: &ExecutePermissionGrantInput,
) -> Result<ContextObservationExecutionResult, String> {
    let grant = gateway.grant(&input.grant_id)?;
    if grant.capability_id != FOREGROUND_CONTROL_CAPABILITY
        || grant.operation != FOREGROUND_CONTROL_OPERATION
    {
        return Err("El grant no autoriza context.foreground.control".into());
    }

    match grant.mode {
        PermissionMode::Session => {
            if let Some(active_grant_id) = observation.active_grant_id()? {
                if active_grant_id != input.grant_id {
                    return Err(
                        "Ya existe una sesión de observación activa; deténgala o revóquela primero"
                            .into(),
                    );
                }
            }
            let execution = gateway.start_session(&input.grant_id)?;
            let enabled = foreground_execution_enabled(&execution)?;
            if !enabled {
                let _ = gateway.revoke_grant(&input.grant_id);
                return Err("Un grant session de observación debe activar la capacidad".into());
            }
            if let Err(error) = observation.apply_authorized_state(true, Some(&input.grant_id)) {
                let _ = gateway.revoke_grant(&input.grant_id);
                return Err(error);
            }
            Ok(ContextObservationExecutionResult {
                grant: execution.grant,
                enabled: true,
            })
        }
        PermissionMode::OneShot => {
            let execution = gateway.authorize_one_shot(&input.grant_id)?;
            let enabled = match foreground_execution_enabled(&execution) {
                Ok(enabled) => enabled,
                Err(error) => {
                    let _ = gateway.complete_one_shot(&input.grant_id, false);
                    return Err(error);
                }
            };
            if enabled {
                let _ = gateway.complete_one_shot(&input.grant_id, false);
                return Err(
                    "Un grant oneShot de observación solo puede detener la capacidad".into(),
                );
            }

            if let Some(active_grant_id) = observation.active_grant_id()? {
                if let Err(error) = gateway.stop_session(&active_grant_id) {
                    let _ = observation.disable_for_grant(&active_grant_id);
                    let _ = gateway.complete_one_shot(&input.grant_id, false);
                    return Err(error);
                }
            }
            if let Err(error) = observation.apply_authorized_state(false, None) {
                let _ = gateway.complete_one_shot(&input.grant_id, false);
                return Err(error);
            }
            let completed = gateway.complete_one_shot(&input.grant_id, true)?;
            Ok(ContextObservationExecutionResult {
                grant: completed,
                enabled: false,
            })
        }
        PermissionMode::ImplicitRead => Err("implicitRead no crea grants ejecutables".into()),
    }
}

fn foreground_execution_enabled(execution: &AuthorizedExecution) -> Result<bool, String> {
    let object = execution
        .parameters
        .as_object()
        .ok_or_else(|| "El plan privado de observación no es un objeto".to_string())?;
    if object.len() != 1 || !object.contains_key("enabled") {
        return Err("El plan privado de observación contiene campos inesperados".into());
    }
    object
        .get("enabled")
        .and_then(serde_json::Value::as_bool)
        .ok_or_else(|| "El plan privado de observación no contiene enabled booleano".to_string())
}

fn prepare_supported_permission_request(
    gateway: &PermissionGateway,
    input: PreparePermissionRequestInput,
) -> Result<PreparedPermissionRequest, String> {
    if input.capability_id != FOREGROUND_CONTROL_CAPABILITY
        || input.operation != FOREGROUND_CONTROL_OPERATION
    {
        return Err(
            "R2 solo permite preparar context.foreground.control/setContextObservationEnabled en este incremento"
                .into(),
        );
    }

    let enabled = input.parameters.enabled;
    let draft = PermissionRequestDraft {
        schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
        request_id: "assigned_by_gateway".into(),
        idempotency_key: input.idempotency_key,
        capability_id: input.capability_id,
        capability_version: 1,
        operation: input.operation,
        mode: if enabled {
            PermissionMode::Session
        } else {
            PermissionMode::OneShot
        },
        purpose: input.purpose,
        resource: PermissionResource {
            kind: PermissionResourceKind::Window,
            stable_id: "foreground-window".into(),
            label: "Ventana en primer plano".into(),
        },
        data_scopes: vec!["windowMetadata".into()],
        effects: vec![PermissionEffect::WindowMetadataRead],
        risk: PermissionRisk::Medium,
        created_at: "1970-01-01T00:00:00Z".into(),
        decision_expires_at: "1970-01-01T00:00:01Z".into(),
        requested_duration_seconds: enabled.then_some(MAX_SESSION_DURATION_SECONDS),
        maximum_duration_seconds: enabled.then_some(MAX_SESSION_DURATION_SECONDS),
        summary: if enabled {
            "Alice solicita observar temporalmente los metadatos de la ventana activa.".into()
        } else {
            "Alice solicita detener la observación de la ventana activa.".into()
        },
        warnings: if enabled {
            vec!["El título y proceso de la aplicación activa serán visibles localmente.".into()]
        } else {
            Vec::new()
        },
    };
    gateway.prepare_request(draft, json!({ "enabled": enabled }))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreparedPermissionRequest {
    pub(crate) schema_version: u32,
    pub(crate) request_id: String,
    pub(crate) idempotency_key: String,
    pub(crate) capability_id: String,
    pub(crate) capability_version: u32,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) purpose: String,
    pub(crate) resource: PermissionResource,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) effects: Vec<PermissionEffect>,
    pub(crate) risk: PermissionRisk,
    pub(crate) created_at: String,
    pub(crate) decision_expires_at: String,
    pub(crate) requested_duration_seconds: Option<u32>,
    pub(crate) maximum_duration_seconds: Option<u32>,
    pub(crate) execution_plan_digest: String,
    pub(crate) preview_digest: String,
    pub(crate) state: PermissionRequestState,
    pub(crate) summary: String,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionRequestDraft {
    pub(crate) schema_version: u32,
    pub(crate) request_id: String,
    pub(crate) idempotency_key: String,
    pub(crate) capability_id: String,
    pub(crate) capability_version: u32,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) purpose: String,
    pub(crate) resource: PermissionResource,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) effects: Vec<PermissionEffect>,
    pub(crate) risk: PermissionRisk,
    pub(crate) created_at: String,
    pub(crate) decision_expires_at: String,
    pub(crate) requested_duration_seconds: Option<u32>,
    pub(crate) maximum_duration_seconds: Option<u32>,
    pub(crate) summary: String,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionResource {
    pub(crate) kind: PermissionResourceKind,
    pub(crate) stable_id: String,
    pub(crate) label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionDecisionInput {
    pub(crate) request_id: String,
    pub(crate) preview_digest: String,
    pub(crate) decision: PermissionDecision,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionGrant {
    pub(crate) schema_version: u32,
    pub(crate) grant_id: String,
    pub(crate) request_id: String,
    pub(crate) preview_digest: String,
    pub(crate) capability_id: String,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) issued_at: String,
    pub(crate) expires_at: String,
    pub(crate) remaining_uses: Option<u32>,
    pub(crate) state: PermissionGrantState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionMode {
    ImplicitRead,
    OneShot,
    Session,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionRisk {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionEffect {
    None,
    LocalRead,
    LocalWrite,
    NetworkSend,
    ProcessLaunch,
    WindowMetadataRead,
    CameraObserve,
    MicrophoneObserve,
    ScreenObserve,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionResourceKind {
    Camera,
    Microphone,
    Screen,
    File,
    Directory,
    NetworkEndpoint,
    Process,
    Window,
    Memory,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionRequestState {
    AwaitingDecision,
    Approved,
    Denied,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionDecision {
    Approve,
    Deny,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionGrantState {
    Approved,
    Consuming,
    Completed,
    Error,
    Active,
    Stopped,
    Revoked,
    Expired,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalPermissionPreview<'a> {
    schema_version: u32,
    request_id: &'a str,
    idempotency_key: &'a str,
    capability_id: &'a str,
    capability_version: u32,
    operation: &'a str,
    mode: PermissionMode,
    purpose: &'a str,
    resource: &'a PermissionResource,
    data_scopes: &'a [String],
    effects: &'a [PermissionEffect],
    risk: PermissionRisk,
    created_at: &'a str,
    decision_expires_at: &'a str,
    requested_duration_seconds: Option<u32>,
    maximum_duration_seconds: Option<u32>,
    execution_plan_digest: &'a str,
    summary: &'a str,
    warnings: &'a [String],
}

impl PreparedPermissionRequest {
    pub(crate) fn from_draft(draft: PermissionRequestDraft) -> Result<Self, String> {
        let empty_plan_digest = sha256_digest(b"{}");
        Self::from_draft_with_execution_digest(draft, empty_plan_digest)
    }

    fn from_draft_with_execution_digest(
        draft: PermissionRequestDraft,
        execution_plan_digest: String,
    ) -> Result<Self, String> {
        let mut request = Self {
            schema_version: draft.schema_version,
            request_id: draft.request_id,
            idempotency_key: draft.idempotency_key,
            capability_id: draft.capability_id,
            capability_version: draft.capability_version,
            operation: draft.operation,
            mode: draft.mode,
            purpose: draft.purpose,
            resource: draft.resource,
            data_scopes: draft.data_scopes,
            effects: draft.effects,
            risk: draft.risk,
            created_at: draft.created_at,
            decision_expires_at: draft.decision_expires_at,
            requested_duration_seconds: draft.requested_duration_seconds,
            maximum_duration_seconds: draft.maximum_duration_seconds,
            execution_plan_digest,
            preview_digest: String::new(),
            state: PermissionRequestState::AwaitingDecision,
            summary: draft.summary,
            warnings: draft.warnings,
        };

        request.validate_without_digest()?;
        request.preview_digest = request.compute_preview_digest()?;
        request.validate()?;
        Ok(request)
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        self.validate_without_digest()?;
        validate_digest(&self.preview_digest)?;
        let expected = self.compute_preview_digest()?;
        if self.preview_digest != expected {
            return Err("El digest no coincide con la previsualización preparada".into());
        }
        Ok(())
    }

    pub(crate) fn canonical_preview_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.canonical_preview()).map_err(|error| error.to_string())
    }

    fn compute_preview_digest(&self) -> Result<String, String> {
        let bytes =
            serde_json::to_vec(&self.canonical_preview()).map_err(|error| error.to_string())?;
        let digest = Sha256::digest(bytes);
        Ok(format!("sha256:{}", encode_hex(&digest)))
    }

    fn canonical_preview(&self) -> CanonicalPermissionPreview<'_> {
        CanonicalPermissionPreview {
            schema_version: self.schema_version,
            request_id: &self.request_id,
            idempotency_key: &self.idempotency_key,
            capability_id: &self.capability_id,
            capability_version: self.capability_version,
            operation: &self.operation,
            mode: self.mode,
            purpose: &self.purpose,
            resource: &self.resource,
            data_scopes: &self.data_scopes,
            effects: &self.effects,
            risk: self.risk,
            created_at: &self.created_at,
            decision_expires_at: &self.decision_expires_at,
            requested_duration_seconds: self.requested_duration_seconds,
            maximum_duration_seconds: self.maximum_duration_seconds,
            execution_plan_digest: &self.execution_plan_digest,
            summary: &self.summary,
            warnings: &self.warnings,
        }
    }

    fn validate_without_digest(&self) -> Result<(), String> {
        validate_schema(self.schema_version)?;
        validate_opaque_id("requestId", &self.request_id)?;
        validate_opaque_id("idempotencyKey", &self.idempotency_key)?;
        validate_capability_id(&self.capability_id)?;
        if self.capability_version == 0 {
            return Err("capabilityVersion debe ser positiva".into());
        }
        validate_identifier("operation", &self.operation, MAX_OPERATION_LENGTH)?;
        validate_text("purpose", &self.purpose, MAX_PURPOSE_LENGTH)?;
        self.resource.validate()?;
        validate_identifier_list("dataScopes", &self.data_scopes, true)?;
        validate_effects(&self.effects)?;
        validate_digest(&self.execution_plan_digest)?;
        validate_text("summary", &self.summary, MAX_SUMMARY_LENGTH)?;
        validate_text_list("warnings", &self.warnings, MAX_WARNING_LENGTH)?;

        if self.mode == PermissionMode::ImplicitRead {
            return Err("implicitRead no crea solicitudes ni grants en R2".into());
        }

        let created = parse_utc_timestamp("createdAt", &self.created_at)?;
        let expires = parse_utc_timestamp("decisionExpiresAt", &self.decision_expires_at)?;
        validate_positive_ttl(
            "decisionExpiresAt",
            created,
            expires,
            self.risk.decision_ttl_seconds(),
        )?;

        match self.mode {
            PermissionMode::Session => {
                let requested = self
                    .requested_duration_seconds
                    .ok_or_else(|| "Una sesión requiere requestedDurationSeconds".to_string())?;
                let maximum = self
                    .maximum_duration_seconds
                    .ok_or_else(|| "Una sesión requiere maximumDurationSeconds".to_string())?;
                if requested == 0
                    || maximum == 0
                    || requested > maximum
                    || maximum > MAX_SESSION_DURATION_SECONDS
                {
                    return Err(format!(
                        "La sesión debe solicitar 1..={MAX_SESSION_DURATION_SECONDS} segundos sin superar su máximo"
                    ));
                }
            }
            PermissionMode::OneShot => {
                if self.requested_duration_seconds.is_some()
                    || self.maximum_duration_seconds.is_some()
                {
                    return Err("oneShot no admite duración de sesión".into());
                }
            }
            PermissionMode::ImplicitRead => unreachable!("validated above"),
        }

        self.validate_sensor_rules()
    }

    fn validate_sensor_rules(&self) -> Result<(), String> {
        let expected = match self.resource.kind {
            PermissionResourceKind::Camera => {
                Some((PermissionEffect::CameraObserve, "cameraFrames", "La cámara"))
            }
            PermissionResourceKind::Microphone => Some((
                PermissionEffect::MicrophoneObserve,
                "microphoneAudio",
                "El micrófono",
            )),
            PermissionResourceKind::Screen => Some((
                PermissionEffect::ScreenObserve,
                "screenPixels",
                "La pantalla",
            )),
            _ => None,
        };

        let Some((effect, scope, label)) = expected else {
            return Ok(());
        };
        if self.mode != PermissionMode::Session {
            return Err(format!("{label} requiere mode=session"));
        }
        if !matches!(self.risk, PermissionRisk::High | PermissionRisk::Critical) {
            return Err(format!("{label} requiere riesgo high o critical"));
        }
        if !self.effects.contains(&effect) || !self.data_scopes.iter().any(|value| value == scope) {
            return Err(format!(
                "{label} debe declarar su efecto y alcance de datos específicos"
            ));
        }
        Ok(())
    }
}

impl PermissionRequestDraft {
    pub(crate) fn prepare(self) -> Result<PreparedPermissionRequest, String> {
        PreparedPermissionRequest::from_draft(self)
    }
}

impl PermissionResource {
    fn validate(&self) -> Result<(), String> {
        validate_opaque_id("resource.stableId", &self.stable_id)?;
        validate_text("resource.label", &self.label, MAX_RESOURCE_LABEL_LENGTH)
    }
}

impl PermissionDecisionInput {
    pub(crate) fn validate(&self) -> Result<(), String> {
        validate_opaque_id("requestId", &self.request_id)?;
        validate_digest(&self.preview_digest)
    }
}

impl CancelPermissionRequestInput {
    fn validate(&self) -> Result<(), String> {
        validate_opaque_id("requestId", &self.request_id)
    }
}

impl RevokePermissionGrantInput {
    fn validate(&self) -> Result<(), String> {
        validate_opaque_id("grantId", &self.grant_id)
    }
}

impl ExecutePermissionGrantInput {
    fn validate(&self) -> Result<(), String> {
        validate_opaque_id("grantId", &self.grant_id)
    }
}

impl PermissionGrant {
    pub(crate) fn validate(&self) -> Result<(), String> {
        validate_schema(self.schema_version)?;
        validate_opaque_id("grantId", &self.grant_id)?;
        validate_opaque_id("requestId", &self.request_id)?;
        validate_digest(&self.preview_digest)?;
        validate_capability_id(&self.capability_id)?;
        validate_identifier("operation", &self.operation, MAX_OPERATION_LENGTH)?;
        if self.mode == PermissionMode::ImplicitRead {
            return Err("implicitRead no crea grants en R2".into());
        }

        let issued = parse_utc_timestamp("issuedAt", &self.issued_at)?;
        let expires = parse_utc_timestamp("expiresAt", &self.expires_at)?;
        validate_positive_ttl(
            "expiresAt",
            issued,
            expires,
            u64::from(MAX_SESSION_DURATION_SECONDS),
        )?;

        match self.mode {
            PermissionMode::OneShot => {
                let expected_uses = match self.state {
                    PermissionGrantState::Approved => 1,
                    PermissionGrantState::Consuming
                    | PermissionGrantState::Completed
                    | PermissionGrantState::Error
                    | PermissionGrantState::Revoked
                    | PermissionGrantState::Expired => 0,
                    PermissionGrantState::Active | PermissionGrantState::Stopped => {
                        return Err("Un grant oneShot no puede usar un estado de sesión".into());
                    }
                };
                if self.remaining_uses != Some(expected_uses) {
                    return Err(format!(
                        "El grant oneShot en estado {:?} requiere remainingUses={expected_uses}",
                        self.state
                    ));
                }
            }
            PermissionMode::Session => {
                if self.remaining_uses.is_some() {
                    return Err("Un grant session requiere remainingUses=null".into());
                }
                if matches!(
                    self.state,
                    PermissionGrantState::Consuming | PermissionGrantState::Completed
                ) {
                    return Err("Un grant session no puede usar un estado oneShot".into());
                }
            }
            PermissionMode::ImplicitRead => unreachable!("validated above"),
        }
        Ok(())
    }
}

impl PermissionRisk {
    fn decision_ttl_seconds(self) -> u64 {
        match self {
            Self::High | Self::Critical => HIGH_RISK_DECISION_TTL_SECONDS,
            Self::None | Self::Low | Self::Medium => STANDARD_DECISION_TTL_SECONDS,
        }
    }
}

fn validate_schema(schema_version: u32) -> Result<(), String> {
    if schema_version == PERMISSION_GATEWAY_SCHEMA_VERSION {
        Ok(())
    } else {
        Err(format!(
            "schemaVersion debe ser {PERMISSION_GATEWAY_SCHEMA_VERSION}"
        ))
    }
}

fn validate_opaque_id(field: &str, value: &str) -> Result<(), String> {
    let valid_length = (16..=MAX_ID_LENGTH).contains(&value.len());
    let valid_characters = value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'));
    if valid_length && valid_characters {
        Ok(())
    } else {
        Err(format!(
            "{field} debe ser opaco, ASCII y tener entre 16 y {MAX_ID_LENGTH} caracteres"
        ))
    }
}

fn validate_capability_id(value: &str) -> Result<(), String> {
    let segments: Vec<_> = value.split('.').collect();
    let valid = segments.len() >= 2
        && value.len() <= MAX_ID_LENGTH
        && segments.iter().all(|segment| {
            let mut characters = segment.chars();
            characters
                .next()
                .is_some_and(|first| first.is_ascii_lowercase())
                && characters
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        });
    if valid {
        Ok(())
    } else {
        Err("capabilityId no tiene el formato canónico aprobado".into())
    }
}

fn validate_identifier(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    let mut characters = value.chars();
    let valid = !value.is_empty()
        && value.len() <= maximum
        && characters
            .next()
            .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| character.is_ascii_alphanumeric());
    if valid {
        Ok(())
    } else {
        Err(format!(
            "{field} no tiene un identificador lowerCamelCase válido"
        ))
    }
}

fn validate_identifier_list(field: &str, values: &[String], required: bool) -> Result<(), String> {
    if required && values.is_empty() {
        return Err(format!("{field} requiere al menos un valor"));
    }
    let mut unique = HashSet::with_capacity(values.len());
    for value in values {
        validate_identifier(field, value, MAX_OPERATION_LENGTH)?;
        if !unique.insert(value.as_str()) {
            return Err(format!("{field} no admite valores duplicados"));
        }
    }
    Ok(())
}

fn validate_effects(effects: &[PermissionEffect]) -> Result<(), String> {
    if effects.is_empty() {
        return Err("effects requiere al menos un valor".into());
    }
    let unique: HashSet<_> = effects.iter().copied().collect();
    if unique.len() != effects.len() {
        return Err("effects no admite valores duplicados".into());
    }
    if effects.contains(&PermissionEffect::None) && effects.len() != 1 {
        return Err("El efecto none no puede combinarse con otros efectos".into());
    }
    Ok(())
}

fn validate_text(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    let valid = !value.trim().is_empty()
        && value == value.trim()
        && value.chars().count() <= maximum
        && !value.chars().any(char::is_control);
    if valid {
        Ok(())
    } else {
        Err(format!(
            "{field} debe contener texto limpio de 1 a {maximum} caracteres"
        ))
    }
}

fn validate_text_list(field: &str, values: &[String], maximum: usize) -> Result<(), String> {
    let mut unique = HashSet::with_capacity(values.len());
    for value in values {
        validate_text(field, value, maximum)?;
        if !unique.insert(value.as_str()) {
            return Err(format!("{field} no admite valores duplicados"));
        }
    }
    Ok(())
}

fn validate_digest(value: &str) -> Result<(), String> {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err("previewDigest debe comenzar con sha256:".into());
    };
    if hex.len() == 64
        && hex
            .chars()
            .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character))
    {
        Ok(())
    } else {
        Err("previewDigest debe contener 64 caracteres hexadecimales minúsculos".into())
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

fn sha256_digest(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    format!("sha256:{}", encode_hex(&digest))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(super) struct UtcInstant {
    seconds: i64,
    nanos: u32,
}

impl UtcInstant {
    pub(super) fn add_seconds(self, seconds: u64) -> Result<Self, String> {
        let seconds = i64::try_from(seconds).map_err(|_| "Duración fuera de rango")?;
        Ok(Self {
            seconds: self
                .seconds
                .checked_add(seconds)
                .ok_or_else(|| "Fecha fuera de rango".to_string())?,
            nanos: self.nanos,
        })
    }
}

pub(super) fn current_utc_instant() -> Result<UtcInstant, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "El reloj del sistema es anterior a UNIX_EPOCH".to_string())?;
    let seconds = i64::try_from(duration.as_secs())
        .map_err(|_| "El reloj del sistema está fuera de rango".to_string())?;
    Ok(UtcInstant {
        seconds,
        nanos: duration.subsec_nanos(),
    })
}

pub(super) fn format_utc_timestamp(instant: UtcInstant) -> Result<String, String> {
    if instant.seconds < 0 {
        return Err("La fecha UTC no puede ser anterior a 1970".into());
    }
    let days = instant.seconds.div_euclid(86_400);
    let seconds_of_day = instant.seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    let mut value = format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}");
    if instant.nanos != 0 {
        let fraction = format!("{:09}", instant.nanos)
            .trim_end_matches('0')
            .to_string();
        value.push('.');
        value.push_str(&fraction);
    }
    value.push('Z');
    Ok(value)
}

fn validate_positive_ttl(
    field: &str,
    start: UtcInstant,
    end: UtcInstant,
    maximum_seconds: u64,
) -> Result<(), String> {
    let start_nanos = i128::from(start.seconds) * 1_000_000_000 + i128::from(start.nanos);
    let end_nanos = i128::from(end.seconds) * 1_000_000_000 + i128::from(end.nanos);
    let ttl = end_nanos - start_nanos;
    if ttl <= 0 || ttl > i128::from(maximum_seconds) * 1_000_000_000 {
        return Err(format!(
            "{field} debe ser posterior al inicio y vencer en un máximo de {maximum_seconds} segundos"
        ));
    }
    Ok(())
}

fn parse_utc_timestamp(field: &str, value: &str) -> Result<UtcInstant, String> {
    let invalid = || format!("{field} debe contener una fecha UTC ISO-8601 válida");
    if !value.is_ascii() || !value.ends_with('Z') {
        return Err(invalid());
    }
    let without_zone = &value[..value.len() - 1];
    let (date, time) = without_zone.split_once('T').ok_or_else(invalid)?;
    if date.len() != 10 || &date[4..5] != "-" || &date[7..8] != "-" {
        return Err(invalid());
    }
    let year = parse_fixed_u32(&date[0..4], 4).ok_or_else(invalid)?;
    let month = parse_fixed_u32(&date[5..7], 2).ok_or_else(invalid)?;
    let day = parse_fixed_u32(&date[8..10], 2).ok_or_else(invalid)?;
    if year < 1970 || !(1..=12).contains(&month) || !(1..=days_in_month(year, month)).contains(&day)
    {
        return Err(invalid());
    }

    let (whole_time, fraction) = time
        .split_once('.')
        .map_or((time, None), |(whole, fraction)| (whole, Some(fraction)));
    if whole_time.len() != 8 || &whole_time[2..3] != ":" || &whole_time[5..6] != ":" {
        return Err(invalid());
    }
    let hour = parse_fixed_u32(&whole_time[0..2], 2).ok_or_else(invalid)?;
    let minute = parse_fixed_u32(&whole_time[3..5], 2).ok_or_else(invalid)?;
    let second = parse_fixed_u32(&whole_time[6..8], 2).ok_or_else(invalid)?;
    if hour > 23 || minute > 59 || second > 59 {
        return Err(invalid());
    }

    let nanos = match fraction {
        None => 0,
        Some(value)
            if !value.is_empty()
                && value.len() <= 9
                && value.chars().all(|character| character.is_ascii_digit()) =>
        {
            let parsed = value.parse::<u32>().map_err(|_| invalid())?;
            parsed * 10_u32.pow(9 - value.len() as u32)
        }
        Some(_) => return Err(invalid()),
    };
    let days = days_from_civil(year, month, day);
    let seconds = days * 86_400 + i64::from(hour * 3_600 + minute * 60 + second);
    Ok(UtcInstant { seconds, nanos })
}

fn parse_fixed_u32(value: &str, length: usize) -> Option<u32> {
    (value.len() == length && value.chars().all(|character| character.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        2 if is_leap_year(year) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

fn days_from_civil(year: u32, month: u32, day: u32) -> i64 {
    let adjusted_year = i64::from(year) - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = i64::from(month) + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + i64::from(day) - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let days = days_since_epoch + 719_468;
    let era = days.div_euclid(146_097);
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Arc, Barrier};
    use std::thread;

    fn draft() -> PermissionRequestDraft {
        PermissionRequestDraft {
            schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
            request_id: "request_0123456789".into(),
            idempotency_key: "context-control-01".into(),
            capability_id: "context.foreground.control".into(),
            capability_version: 1,
            operation: "enableObservation".into(),
            mode: PermissionMode::OneShot,
            purpose: "Activar la observación de la ventana en primer plano.".into(),
            resource: PermissionResource {
                kind: PermissionResourceKind::Window,
                stable_id: "foreground-window".into(),
                label: "Ventana en primer plano".into(),
            },
            data_scopes: vec!["windowMetadata".into()],
            effects: vec![PermissionEffect::WindowMetadataRead],
            risk: PermissionRisk::High,
            created_at: "2026-08-09T14:00:00Z".into(),
            decision_expires_at: "2026-08-09T14:01:00Z".into(),
            requested_duration_seconds: None,
            maximum_duration_seconds: None,
            summary: "Alice solicita observar metadatos de la ventana activa.".into(),
            warnings: vec!["La aplicación activa puede quedar visible en el panel local.".into()],
        }
    }

    fn camera_draft() -> PermissionRequestDraft {
        PermissionRequestDraft {
            request_id: "camera_request_001".into(),
            idempotency_key: "camera-session-001".into(),
            capability_id: "perception.camera.observe".into(),
            operation: "observeAuthorizedCamera".into(),
            mode: PermissionMode::Session,
            purpose: "Analizar gestos durante esta sesión.".into(),
            resource: PermissionResource {
                kind: PermissionResourceKind::Camera,
                stable_id: "camera-device-001".into(),
                label: "ACER HD User Facing".into(),
            },
            data_scopes: vec!["cameraFrames".into()],
            effects: vec![PermissionEffect::CameraObserve],
            requested_duration_seconds: Some(120),
            maximum_duration_seconds: Some(300),
            summary: "Alice solicita observar la cámara durante un máximo de 2 minutos.".into(),
            warnings: vec!["La luz de la cámara puede encenderse.".into()],
            ..draft()
        }
    }

    fn one_shot_grant() -> PermissionGrant {
        let request = draft().prepare().unwrap();
        PermissionGrant {
            schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
            grant_id: "grant_01234567890".into(),
            request_id: request.request_id,
            preview_digest: request.preview_digest,
            capability_id: request.capability_id,
            operation: request.operation,
            mode: PermissionMode::OneShot,
            issued_at: "2026-08-09T14:00:10Z".into(),
            expires_at: "2026-08-09T14:01:10Z".into(),
            remaining_uses: Some(1),
            state: PermissionGrantState::Approved,
        }
    }

    #[test]
    fn prepared_request_serializes_the_camel_case_contract() {
        let request = camera_draft().prepare().unwrap();
        let value = serde_json::to_value(&request).unwrap();

        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["mode"], "session");
        assert_eq!(value["resource"]["kind"], "camera");
        assert_eq!(value["requestedDurationSeconds"], 120);
        assert_eq!(value["state"], "awaitingDecision");
        assert!(value["previewDigest"]
            .as_str()
            .unwrap()
            .starts_with("sha256:"));
        request.validate().unwrap();
    }

    #[test]
    fn enumerations_serialize_only_the_approved_values() {
        assert_eq!(
            serde_json::to_value([
                PermissionMode::ImplicitRead,
                PermissionMode::OneShot,
                PermissionMode::Session,
            ])
            .unwrap(),
            json!(["implicitRead", "oneShot", "session"])
        );
        assert_eq!(
            serde_json::to_value([PermissionDecision::Approve, PermissionDecision::Deny,]).unwrap(),
            json!(["approve", "deny"])
        );
        assert_eq!(
            serde_json::to_value([
                PermissionRequestState::AwaitingDecision,
                PermissionRequestState::Approved,
                PermissionRequestState::Denied,
                PermissionRequestState::Cancelled,
                PermissionRequestState::Expired,
            ])
            .unwrap(),
            json!([
                "awaitingDecision",
                "approved",
                "denied",
                "cancelled",
                "expired"
            ])
        );
    }

    #[test]
    fn deserialization_rejects_unknown_fields() {
        let request = draft().prepare().unwrap();
        let mut value = serde_json::to_value(request).unwrap();
        value["inventedGrant"] = json!(true);

        let error = serde_json::from_value::<PreparedPermissionRequest>(value).unwrap_err();
        assert!(error.to_string().contains("unknown field"));
    }

    #[test]
    fn digest_is_deterministic_and_covers_the_complete_preview() {
        let first = draft().prepare().unwrap();
        let second = draft().prepare().unwrap();
        assert_eq!(first.preview_digest, second.preview_digest);
        assert_eq!(
            first.canonical_preview_json().unwrap(),
            second.canonical_preview_json().unwrap()
        );

        let mut changed_draft = draft();
        changed_draft.purpose = "Detener la observación de la ventana en primer plano.".into();
        let changed = changed_draft.prepare().unwrap();
        assert_ne!(first.preview_digest, changed.preview_digest);
    }

    #[test]
    fn tampering_after_preparation_invalidates_the_digest() {
        let mut request = draft().prepare().unwrap();
        request.operation = "disableObservation".into();

        assert!(request
            .validate()
            .unwrap_err()
            .contains("digest no coincide"));
    }

    #[test]
    fn validation_rejects_invalid_ids_text_and_duplicates() {
        let mut invalid_id = draft();
        invalid_id.request_id = "short".into();
        assert!(invalid_id.prepare().unwrap_err().contains("requestId"));

        let mut invalid_capability = draft();
        invalid_capability.capability_id = "Context.Foreground".into();
        assert!(invalid_capability
            .prepare()
            .unwrap_err()
            .contains("capabilityId"));

        let mut invalid_operation = draft();
        invalid_operation.operation = "enable_observation".into();
        assert!(invalid_operation
            .prepare()
            .unwrap_err()
            .contains("operation"));

        let mut duplicate_scopes = draft();
        duplicate_scopes.data_scopes.push("windowMetadata".into());
        assert!(duplicate_scopes
            .prepare()
            .unwrap_err()
            .contains("duplicados"));
    }

    #[test]
    fn validation_enforces_decision_expiry_and_utc_timestamps() {
        let mut too_long = draft();
        too_long.decision_expires_at = "2026-08-09T14:01:00.001Z".into();
        assert!(too_long.prepare().unwrap_err().contains("60 segundos"));

        let mut invalid_date = draft();
        invalid_date.created_at = "2026-02-29T14:00:00Z".into();
        assert!(invalid_date.prepare().unwrap_err().contains("ISO-8601"));

        let mut not_utc = draft();
        not_utc.created_at = "2026-08-09T11:00:00-03:00".into();
        assert!(not_utc.prepare().unwrap_err().contains("UTC"));
    }

    #[test]
    fn validation_enforces_session_duration_and_sensor_scope() {
        let valid = camera_draft().prepare().unwrap();
        valid.validate().unwrap();

        let mut too_long = camera_draft();
        too_long.requested_duration_seconds = Some(301);
        assert!(too_long.prepare().unwrap_err().contains("1..=300"));

        let mut wrong_mode = camera_draft();
        wrong_mode.mode = PermissionMode::OneShot;
        wrong_mode.requested_duration_seconds = None;
        wrong_mode.maximum_duration_seconds = None;
        assert!(wrong_mode.prepare().unwrap_err().contains("mode=session"));

        let mut wrong_scope = camera_draft();
        wrong_scope.data_scopes = vec!["windowMetadata".into()];
        assert!(wrong_scope
            .prepare()
            .unwrap_err()
            .contains("alcance de datos"));
    }

    #[test]
    fn implicit_read_never_creates_requests_or_grants() {
        let mut request = draft();
        request.mode = PermissionMode::ImplicitRead;
        assert!(request
            .prepare()
            .unwrap_err()
            .contains("no crea solicitudes"));

        let mut grant = one_shot_grant();
        grant.mode = PermissionMode::ImplicitRead;
        assert!(grant.validate().unwrap_err().contains("no crea grants"));
    }

    #[test]
    fn decision_input_rejects_malformed_or_uppercase_digest() {
        let request = draft().prepare().unwrap();
        let mut decision = PermissionDecisionInput {
            request_id: request.request_id,
            preview_digest: request.preview_digest,
            decision: PermissionDecision::Approve,
        };
        decision.validate().unwrap();

        decision.preview_digest = format!("sha256:{}", "A".repeat(64));
        assert!(decision.validate().unwrap_err().contains("minúsculos"));
    }

    #[test]
    fn grant_validation_enforces_mode_state_and_remaining_uses() {
        let grant = one_shot_grant();
        grant.validate().unwrap();
        assert_eq!(serde_json::to_value(&grant).unwrap()["remainingUses"], 1);

        let mut consumed = grant.clone();
        consumed.state = PermissionGrantState::Completed;
        consumed.remaining_uses = Some(0);
        consumed.validate().unwrap();

        let mut reusable = consumed.clone();
        reusable.remaining_uses = Some(1);
        assert!(reusable.validate().unwrap_err().contains("remainingUses=0"));

        let mut session = grant;
        session.mode = PermissionMode::Session;
        session.state = PermissionGrantState::Active;
        session.remaining_uses = None;
        session.validate().unwrap();
    }

    #[test]
    fn supported_preparation_builds_a_pending_session_without_a_grant() {
        let gateway = PermissionGateway::default();
        let request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "prepare-context-001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Observar la aplicación activa durante esta sesión.".into(),
                parameters: ForegroundControlParameters { enabled: true },
            },
        )
        .unwrap();
        let status = gateway.status().unwrap();

        assert_eq!(request.mode, PermissionMode::Session);
        assert_eq!(request.state, PermissionRequestState::AwaitingDecision);
        assert_eq!(request.requested_duration_seconds, Some(300));
        assert_eq!(status.requests, vec![request]);
        assert!(status.grants.is_empty());
    }

    #[test]
    fn supported_stop_preparation_is_one_shot_and_does_not_execute() {
        let gateway = PermissionGateway::default();
        let request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "prepare-context-002".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Detener la observación de la aplicación activa.".into(),
                parameters: ForegroundControlParameters { enabled: false },
            },
        )
        .unwrap();

        assert_eq!(request.mode, PermissionMode::OneShot);
        assert_eq!(request.requested_duration_seconds, None);
        assert_eq!(request.maximum_duration_seconds, None);
        assert!(gateway.status().unwrap().grants.is_empty());
    }

    #[test]
    fn preparation_rejects_unmigrated_capabilities_without_storing_anything() {
        let gateway = PermissionGateway::default();
        let error = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "prepare-camera-0001".into(),
                capability_id: "perception.camera.observe".into(),
                operation: "observeAuthorizedCamera".into(),
                purpose: "Intento que todavía no está autorizado.".into(),
                parameters: ForegroundControlParameters { enabled: true },
            },
        )
        .unwrap_err();

        assert!(error.contains("solo permite preparar"));
        assert!(gateway.status().unwrap().requests.is_empty());
    }

    #[test]
    fn preparation_input_rejects_unknown_top_level_and_parameter_fields() {
        let input = json!({
            "idempotencyKey": "prepare-context-003",
            "capabilityId": FOREGROUND_CONTROL_CAPABILITY,
            "operation": FOREGROUND_CONTROL_OPERATION,
            "purpose": "Preparar sin ejecutar.",
            "parameters": { "enabled": true }
        });
        serde_json::from_value::<PreparePermissionRequestInput>(input.clone()).unwrap();

        let mut unknown_top = input.clone();
        unknown_top["executeNow"] = json!(true);
        assert!(
            serde_json::from_value::<PreparePermissionRequestInput>(unknown_top)
                .unwrap_err()
                .to_string()
                .contains("unknown field")
        );

        let mut unknown_parameter = input;
        unknown_parameter["parameters"]["deviceId"] = json!("camera");
        assert!(
            serde_json::from_value::<PreparePermissionRequestInput>(unknown_parameter)
                .unwrap_err()
                .to_string()
                .contains("unknown field")
        );
    }

    #[test]
    fn repeated_status_and_preparation_do_not_create_a_data_directory() {
        let gateway = PermissionGateway::default();
        let absent =
            std::env::temp_dir().join(format!("alice-r2-no-write-{}", uuid::Uuid::new_v4()));
        assert!(!absent.exists());
        for _ in 0..5 {
            let request = prepare_supported_permission_request(
                &gateway,
                PreparePermissionRequestInput {
                    idempotency_key: "prepare-no-write-01".into(),
                    capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                    operation: FOREGROUND_CONTROL_OPERATION.into(),
                    purpose: "Comprobar preparación efímera sin archivos.".into(),
                    parameters: ForegroundControlParameters { enabled: false },
                },
            )
            .unwrap();
            assert_eq!(request.state, PermissionRequestState::AwaitingDecision);
            gateway.status().unwrap();
        }
        assert!(!absent.exists());
        assert_eq!(gateway.status().unwrap().requests.len(), 1);
        assert!(gateway.status().unwrap().grants.is_empty());
    }

    #[test]
    fn approval_creates_a_grant_but_does_not_activate_the_real_observer() {
        let gateway = PermissionGateway::default();
        let observation = crate::observation::ObservationStore::default();
        let request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "decision-context-001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Revisar una aprobación sin ejecutar observación.".into(),
                parameters: ForegroundControlParameters { enabled: true },
            },
        )
        .unwrap();
        let grant = gateway
            .decide(PermissionDecisionInput {
                request_id: request.request_id,
                preview_digest: request.preview_digest,
                decision: PermissionDecision::Approve,
            })
            .unwrap()
            .unwrap();

        assert_eq!(grant.state, PermissionGrantState::Approved);
        assert!(!observation.capability_probe().unwrap().enabled);
        let status = gateway.status().unwrap();
        assert!(status.policy.r2_decision_commands_exposed);
        assert!(status.policy.r2_execution_commands_exposed);
        assert_eq!(status.grants, vec![grant]);
    }

    #[test]
    fn migrated_observation_rejects_bypass_and_consumes_real_start_and_stop_grants() {
        let gateway = PermissionGateway::default();
        let observation = ObservationStore::default();
        let bypass = execute_context_observation_grant_impl(
            &gateway,
            &observation,
            ExecutePermissionGrantInput {
                grant_id: "grant_without_permission".into(),
            },
        )
        .unwrap_err();
        assert!(bypass.contains("Grant desconocido"));
        assert!(!observation.capability_probe().unwrap().enabled);

        let start_request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "execute-context-start-001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Activar observación mediante un grant real.".into(),
                parameters: ForegroundControlParameters { enabled: true },
            },
        )
        .unwrap();
        let start_grant = gateway
            .decide(PermissionDecisionInput {
                request_id: start_request.request_id,
                preview_digest: start_request.preview_digest,
                decision: PermissionDecision::Approve,
            })
            .unwrap()
            .unwrap();
        let started = execute_context_observation_grant_impl(
            &gateway,
            &observation,
            ExecutePermissionGrantInput {
                grant_id: start_grant.grant_id.clone(),
            },
        )
        .unwrap();
        assert!(started.enabled);
        assert_eq!(started.grant.state, PermissionGrantState::Active);
        assert!(observation.capability_probe().unwrap().enabled);
        assert_eq!(
            observation.active_grant_id().unwrap().as_deref(),
            Some(start_grant.grant_id.as_str())
        );

        let repeated = execute_context_observation_grant_impl(
            &gateway,
            &observation,
            ExecutePermissionGrantInput {
                grant_id: start_grant.grant_id.clone(),
            },
        )
        .unwrap();
        assert_eq!(repeated, started);

        let stop_request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "execute-context-stop-0001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Detener observación mediante un grant real.".into(),
                parameters: ForegroundControlParameters { enabled: false },
            },
        )
        .unwrap();
        let stop_grant = gateway
            .decide(PermissionDecisionInput {
                request_id: stop_request.request_id,
                preview_digest: stop_request.preview_digest,
                decision: PermissionDecision::Approve,
            })
            .unwrap()
            .unwrap();
        let stopped = execute_context_observation_grant_impl(
            &gateway,
            &observation,
            ExecutePermissionGrantInput {
                grant_id: stop_grant.grant_id,
            },
        )
        .unwrap();
        assert!(!stopped.enabled);
        assert_eq!(stopped.grant.state, PermissionGrantState::Completed);
        assert!(!observation.capability_probe().unwrap().enabled);
        assert_eq!(
            gateway.grant(&start_grant.grant_id).unwrap().state,
            PermissionGrantState::Stopped
        );
    }

    #[test]
    fn revoking_an_active_foreground_grant_stops_the_real_observer() {
        let gateway = PermissionGateway::default();
        let observation = ObservationStore::default();
        let request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "execute-revoke-active-01".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Activar y revocar observación real.".into(),
                parameters: ForegroundControlParameters { enabled: true },
            },
        )
        .unwrap();
        let grant = gateway
            .decide(PermissionDecisionInput {
                request_id: request.request_id,
                preview_digest: request.preview_digest,
                decision: PermissionDecision::Approve,
            })
            .unwrap()
            .unwrap();
        execute_context_observation_grant_impl(
            &gateway,
            &observation,
            ExecutePermissionGrantInput {
                grant_id: grant.grant_id.clone(),
            },
        )
        .unwrap();

        let revoked = revoke_permission_grant_impl(
            &gateway,
            &observation,
            RevokePermissionGrantInput {
                grant_id: grant.grant_id,
            },
        )
        .unwrap();
        assert_eq!(revoked.state, PermissionGrantState::Revoked);
        assert!(!observation.capability_probe().unwrap().enabled);
        assert_eq!(observation.active_grant_id(), Ok(None));
    }

    #[test]
    fn concurrent_session_execution_leaves_exactly_one_active_grant() {
        let gateway = PermissionGateway::default();
        let observation = ObservationStore::default();
        let grants: Vec<_> = ["concurrent-session-start-01", "concurrent-session-start-02"]
            .into_iter()
            .map(|idempotency_key| {
                let request = prepare_supported_permission_request(
                    &gateway,
                    PreparePermissionRequestInput {
                        idempotency_key: idempotency_key.into(),
                        capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                        operation: FOREGROUND_CONTROL_OPERATION.into(),
                        purpose: "Competir por una única sesión autorizada.".into(),
                        parameters: ForegroundControlParameters { enabled: true },
                    },
                )
                .unwrap();
                gateway
                    .decide(PermissionDecisionInput {
                        request_id: request.request_id,
                        preview_digest: request.preview_digest,
                        decision: PermissionDecision::Approve,
                    })
                    .unwrap()
                    .unwrap()
            })
            .collect();
        let barrier = Arc::new(Barrier::new(3));
        let handles: Vec<_> = grants
            .iter()
            .map(|grant| {
                let gateway = gateway.clone();
                let observation = observation.clone();
                let barrier = Arc::clone(&barrier);
                let grant_id = grant.grant_id.clone();
                thread::spawn(move || {
                    barrier.wait();
                    execute_context_observation_grant_impl(
                        &gateway,
                        &observation,
                        ExecutePermissionGrantInput { grant_id },
                    )
                })
            })
            .collect();
        barrier.wait();
        let results: Vec<_> = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect();

        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(results.iter().filter(|result| result.is_err()).count(), 1);
        assert!(observation.capability_probe().unwrap().enabled);
        let status = gateway.status().unwrap();
        assert_eq!(
            status
                .grants
                .iter()
                .filter(|grant| grant.state == PermissionGrantState::Active)
                .count(),
            1
        );
    }

    #[test]
    fn cancellation_and_revocation_are_terminal_without_execution() {
        let gateway = PermissionGateway::default();
        let cancelled_request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "cancel-context-0001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Cancelar esta solicitud pendiente.".into(),
                parameters: ForegroundControlParameters { enabled: false },
            },
        )
        .unwrap();
        let cancelled = gateway
            .cancel_request(&cancelled_request.request_id)
            .unwrap();
        assert_eq!(cancelled.state, PermissionRequestState::Cancelled);

        let approved_request = prepare_supported_permission_request(
            &gateway,
            PreparePermissionRequestInput {
                idempotency_key: "revoke-context-0001".into(),
                capability_id: FOREGROUND_CONTROL_CAPABILITY.into(),
                operation: FOREGROUND_CONTROL_OPERATION.into(),
                purpose: "Crear y revocar un grant sin usarlo.".into(),
                parameters: ForegroundControlParameters { enabled: false },
            },
        )
        .unwrap();
        let grant = gateway
            .decide(PermissionDecisionInput {
                request_id: approved_request.request_id,
                preview_digest: approved_request.preview_digest,
                decision: PermissionDecision::Approve,
            })
            .unwrap()
            .unwrap();
        let revoked = gateway.revoke_grant(&grant.grant_id).unwrap();
        assert_eq!(revoked.state, PermissionGrantState::Revoked);
        assert_eq!(revoked.remaining_uses, Some(0));
    }

    #[test]
    fn decision_cancel_revoke_and_execute_inputs_reject_unknown_fields() {
        let decision = json!({
            "requestId": "request_0123456789",
            "previewDigest": format!("sha256:{}", "a".repeat(64)),
            "decision": "approve",
            "execute": true
        });
        assert!(serde_json::from_value::<PermissionDecisionInput>(decision)
            .unwrap_err()
            .to_string()
            .contains("unknown field"));

        let cancel = json!({ "requestId": "request_0123456789", "approve": true });
        assert!(
            serde_json::from_value::<CancelPermissionRequestInput>(cancel)
                .unwrap_err()
                .to_string()
                .contains("unknown field")
        );

        let revoke = json!({ "grantId": "grant_01234567890", "execute": true });
        assert!(serde_json::from_value::<RevokePermissionGrantInput>(revoke)
            .unwrap_err()
            .to_string()
            .contains("unknown field"));

        let execute = json!({ "grantId": "grant_01234567890", "enabled": true });
        assert!(
            serde_json::from_value::<ExecutePermissionGrantInput>(execute)
                .unwrap_err()
                .to_string()
                .contains("unknown field")
        );

        assert!(CancelPermissionRequestInput {
            request_id: "short".into()
        }
        .validate()
        .is_err());
        assert!(RevokePermissionGrantInput {
            grant_id: "grant with spaces".into()
        }
        .validate()
        .is_err());
        assert!(ExecutePermissionGrantInput {
            grant_id: "short".into()
        }
        .validate()
        .is_err());
    }

    #[test]
    fn timestamp_parser_handles_epoch_leap_day_and_fractional_boundaries() {
        assert_eq!(
            parse_utc_timestamp("test", "1970-01-01T00:00:00Z").unwrap(),
            UtcInstant {
                seconds: 0,
                nanos: 0
            }
        );
        assert_eq!(
            parse_utc_timestamp("test", "2028-02-29T23:59:59.123456789Z")
                .unwrap()
                .nanos,
            123_456_789
        );
        assert!(parse_utc_timestamp("test", "2100-02-29T00:00:00Z").is_err());
        assert!(parse_utc_timestamp("test", "2026-08-09T24:00:00Z").is_err());
    }
}
