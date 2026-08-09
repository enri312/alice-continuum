use super::{
    current_utc_instant, format_utc_timestamp, parse_utc_timestamp, sha256_digest,
    PermissionDecision, PermissionDecisionInput, PermissionGrant, PermissionGrantState,
    PermissionMode, PermissionRequestDraft, PermissionRequestState, PreparedPermissionRequest,
    UtcInstant, MAX_SESSION_DURATION_SECONDS, PERMISSION_GATEWAY_SCHEMA_VERSION,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use uuid::Uuid;

const EMPTY_EXECUTION_PLAN: &[u8] = b"{}";

#[derive(Default)]
pub(crate) struct PermissionGateway {
    store: Mutex<PermissionGatewayStore>,
}

#[derive(Default)]
struct PermissionGatewayStore {
    requests: HashMap<String, StoredPermissionRequest>,
    grants: HashMap<String, PermissionGrant>,
    idempotency: HashMap<String, IdempotencyRecord>,
}

struct StoredPermissionRequest {
    preview: PreparedPermissionRequest,
    execution_plan: Vec<u8>,
    intent_digest: String,
    grant_id: Option<String>,
}

struct IdempotencyRecord {
    request_id: String,
    intent_digest: String,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct AuthorizedExecution {
    pub(crate) grant: PermissionGrant,
    pub(crate) parameters: Value,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct ExpirationSummary {
    pub(crate) requests: usize,
    pub(crate) grants: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionGatewayStatus {
    pub(crate) schema_version: u32,
    pub(crate) generated_at: String,
    pub(crate) policy: PermissionGatewayPolicy,
    pub(crate) limits: PermissionGatewayLimits,
    pub(crate) requests: Vec<PreparedPermissionRequest>,
    pub(crate) grants: Vec<PermissionGrant>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionGatewayPolicy {
    pub(crate) deny_by_default: bool,
    pub(crate) persistent_grants: bool,
    pub(crate) r2_decision_commands_exposed: bool,
    pub(crate) r2_execution_commands_exposed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionGatewayLimits {
    pub(crate) high_risk_decision_ttl_seconds: u64,
    pub(crate) standard_decision_ttl_seconds: u64,
    pub(crate) maximum_session_duration_seconds: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalPermissionIntent<'a> {
    schema_version: u32,
    idempotency_key: &'a str,
    capability_id: &'a str,
    capability_version: u32,
    operation: &'a str,
    mode: PermissionMode,
    purpose: &'a str,
    resource: &'a super::PermissionResource,
    data_scopes: &'a [String],
    effects: &'a [super::PermissionEffect],
    risk: super::PermissionRisk,
    requested_duration_seconds: Option<u32>,
    maximum_duration_seconds: Option<u32>,
    execution_plan_digest: &'a str,
    summary: &'a str,
    warnings: &'a [String],
}

impl PermissionGateway {
    pub(crate) fn prepare_request(
        &self,
        draft: PermissionRequestDraft,
        execution_plan: Value,
    ) -> Result<PreparedPermissionRequest, String> {
        self.prepare_request_at(draft, execution_plan, current_utc_instant()?)
    }

    pub(crate) fn decide(
        &self,
        input: PermissionDecisionInput,
    ) -> Result<Option<PermissionGrant>, String> {
        self.decide_at(input, current_utc_instant()?)
    }

    pub(crate) fn cancel_request(
        &self,
        request_id: &str,
    ) -> Result<PreparedPermissionRequest, String> {
        self.cancel_request_at(request_id, current_utc_instant()?)
    }

    pub(crate) fn revoke_grant(&self, grant_id: &str) -> Result<PermissionGrant, String> {
        self.revoke_grant_at(grant_id, current_utc_instant()?)
    }

    pub(crate) fn authorize_one_shot(&self, grant_id: &str) -> Result<AuthorizedExecution, String> {
        self.authorize_one_shot_at(grant_id, current_utc_instant()?)
    }

    pub(crate) fn complete_one_shot(
        &self,
        grant_id: &str,
        succeeded: bool,
    ) -> Result<PermissionGrant, String> {
        let mut store = self.lock_store()?;
        let grant = store
            .grants
            .get_mut(grant_id)
            .ok_or_else(|| "Grant desconocido".to_string())?;
        if grant.mode != PermissionMode::OneShot {
            return Err("El grant no es oneShot".into());
        }
        let target = if succeeded {
            PermissionGrantState::Completed
        } else {
            PermissionGrantState::Error
        };
        match grant.state {
            PermissionGrantState::Consuming => grant.state = target,
            state if state == target => return Ok(grant.clone()),
            _ => return Err("Solo un grant consuming puede completarse".into()),
        }
        grant.validate()?;
        Ok(grant.clone())
    }

    pub(crate) fn start_session(&self, grant_id: &str) -> Result<AuthorizedExecution, String> {
        self.start_session_at(grant_id, current_utc_instant()?)
    }

    pub(crate) fn stop_session(&self, grant_id: &str) -> Result<PermissionGrant, String> {
        let mut store = self.lock_store()?;
        let grant = store
            .grants
            .get_mut(grant_id)
            .ok_or_else(|| "Grant desconocido".to_string())?;
        if grant.mode != PermissionMode::Session {
            return Err("El grant no es session".into());
        }
        match grant.state {
            PermissionGrantState::Approved | PermissionGrantState::Active => {
                grant.state = PermissionGrantState::Stopped;
            }
            PermissionGrantState::Stopped => return Ok(grant.clone()),
            _ => return Err("La sesión no puede detenerse desde su estado actual".into()),
        }
        grant.validate()?;
        Ok(grant.clone())
    }

    pub(crate) fn expire(&self) -> Result<ExpirationSummary, String> {
        self.expire_at(current_utc_instant()?)
    }

    pub(crate) fn status(&self) -> Result<PermissionGatewayStatus, String> {
        self.status_at(current_utc_instant()?)
    }

    pub(crate) fn request(&self, request_id: &str) -> Result<PreparedPermissionRequest, String> {
        self.lock_store()?
            .requests
            .get(request_id)
            .map(|stored| stored.preview.clone())
            .ok_or_else(|| "Solicitud desconocida".to_string())
    }

    pub(crate) fn grant(&self, grant_id: &str) -> Result<PermissionGrant, String> {
        self.lock_store()?
            .grants
            .get(grant_id)
            .cloned()
            .ok_or_else(|| "Grant desconocido".to_string())
    }

    fn prepare_request_at(
        &self,
        mut draft: PermissionRequestDraft,
        execution_plan: Value,
        now: UtcInstant,
    ) -> Result<PreparedPermissionRequest, String> {
        let execution_plan = freeze_execution_plan(execution_plan)?;
        let execution_plan_digest = sha256_digest(&execution_plan);

        draft.schema_version = PERMISSION_GATEWAY_SCHEMA_VERSION;
        draft.request_id = new_opaque_id("request");
        draft.created_at = format_utc_timestamp(now)?;
        draft.decision_expires_at =
            format_utc_timestamp(now.add_seconds(draft.risk.decision_ttl_seconds())?)?;
        let intent_digest = intent_digest(&draft, &execution_plan_digest)?;
        let candidate = PreparedPermissionRequest::from_draft_with_execution_digest(
            draft,
            execution_plan_digest,
        )?;

        let mut store = self.lock_store()?;
        if let Some(record) = store.idempotency.get(&candidate.idempotency_key) {
            if record.intent_digest != intent_digest {
                return Err(
                    "La idempotencyKey ya existe con un plan de ejecución diferente".into(),
                );
            }
            return store
                .requests
                .get(&record.request_id)
                .map(|stored| stored.preview.clone())
                .ok_or_else(|| "El índice idempotente está inconsistente".to_string());
        }

        let request_id = candidate.request_id.clone();
        let idempotency_key = candidate.idempotency_key.clone();
        store.idempotency.insert(
            idempotency_key,
            IdempotencyRecord {
                request_id: request_id.clone(),
                intent_digest: intent_digest.clone(),
            },
        );
        store.requests.insert(
            request_id,
            StoredPermissionRequest {
                preview: candidate.clone(),
                execution_plan,
                intent_digest,
                grant_id: None,
            },
        );
        Ok(candidate)
    }

    fn decide_at(
        &self,
        input: PermissionDecisionInput,
        now: UtcInstant,
    ) -> Result<Option<PermissionGrant>, String> {
        input.validate()?;
        let mut store = self.lock_store()?;
        let snapshot = store
            .requests
            .get(&input.request_id)
            .ok_or_else(|| "Solicitud desconocida".to_string())?;
        verify_stored_request(snapshot)?;
        if snapshot.preview.preview_digest != input.preview_digest {
            return Err("La decisión no coincide con el digest preparado".into());
        }

        if snapshot.preview.state == PermissionRequestState::Approved
            && input.decision == PermissionDecision::Approve
        {
            let grant_id = snapshot
                .grant_id
                .as_ref()
                .ok_or_else(|| "La solicitud aprobada no tiene grant".to_string())?;
            return store
                .grants
                .get(grant_id)
                .cloned()
                .map(Some)
                .ok_or_else(|| "El grant aprobado no existe".to_string());
        }
        if snapshot.preview.state == PermissionRequestState::Denied
            && input.decision == PermissionDecision::Deny
        {
            return Ok(None);
        }
        if snapshot.preview.state != PermissionRequestState::AwaitingDecision {
            return Err("La solicitud ya está en un estado terminal".into());
        }
        if request_has_expired(&snapshot.preview, now)? {
            store
                .requests
                .get_mut(&input.request_id)
                .expect("request checked above")
                .preview
                .state = PermissionRequestState::Expired;
            return Err("La solicitud venció antes de recibir la decisión".into());
        }

        if input.decision == PermissionDecision::Deny {
            store
                .requests
                .get_mut(&input.request_id)
                .expect("request checked above")
                .preview
                .state = PermissionRequestState::Denied;
            return Ok(None);
        }

        let grant = create_grant(&snapshot.preview, now)?;
        let grant_id = grant.grant_id.clone();
        let request = store
            .requests
            .get_mut(&input.request_id)
            .expect("request checked above");
        request.preview.state = PermissionRequestState::Approved;
        request.grant_id = Some(grant_id.clone());
        store.grants.insert(grant_id, grant.clone());
        Ok(Some(grant))
    }

    fn cancel_request_at(
        &self,
        request_id: &str,
        now: UtcInstant,
    ) -> Result<PreparedPermissionRequest, String> {
        let mut store = self.lock_store()?;
        let stored = store
            .requests
            .get_mut(request_id)
            .ok_or_else(|| "Solicitud desconocida".to_string())?;
        verify_stored_request(stored)?;
        if stored.preview.state == PermissionRequestState::Cancelled {
            return Ok(stored.preview.clone());
        }
        if stored.preview.state != PermissionRequestState::AwaitingDecision {
            return Err("Solo una solicitud pendiente puede cancelarse".into());
        }
        if request_has_expired(&stored.preview, now)? {
            stored.preview.state = PermissionRequestState::Expired;
            return Err("La solicitud ya venció".into());
        }
        stored.preview.state = PermissionRequestState::Cancelled;
        Ok(stored.preview.clone())
    }

    fn revoke_grant_at(&self, grant_id: &str, now: UtcInstant) -> Result<PermissionGrant, String> {
        let mut store = self.lock_store()?;
        let grant = store
            .grants
            .get_mut(grant_id)
            .ok_or_else(|| "Grant desconocido".to_string())?;
        expire_grant_if_needed(grant, now)?;
        match grant.state {
            PermissionGrantState::Approved | PermissionGrantState::Active => {
                grant.state = PermissionGrantState::Revoked;
                if grant.mode == PermissionMode::OneShot {
                    grant.remaining_uses = Some(0);
                }
            }
            PermissionGrantState::Revoked => return Ok(grant.clone()),
            _ => return Err("El grant ya no puede revocarse desde su estado actual".into()),
        }
        grant.validate()?;
        Ok(grant.clone())
    }

    fn authorize_one_shot_at(
        &self,
        grant_id: &str,
        now: UtcInstant,
    ) -> Result<AuthorizedExecution, String> {
        let mut store = self.lock_store()?;
        let mut grant = store
            .grants
            .get(grant_id)
            .cloned()
            .ok_or_else(|| "Grant desconocido".to_string())?;
        expire_grant_if_needed(&mut grant, now)?;
        if grant.mode != PermissionMode::OneShot
            || grant.state != PermissionGrantState::Approved
            || grant.remaining_uses != Some(1)
        {
            return Err("El grant oneShot no está disponible para consumo".into());
        }
        let parameters = authorized_parameters(&store, &grant)?;
        grant.state = PermissionGrantState::Consuming;
        grant.remaining_uses = Some(0);
        grant.validate()?;
        store.grants.insert(grant_id.to_string(), grant.clone());
        Ok(AuthorizedExecution { grant, parameters })
    }

    fn start_session_at(
        &self,
        grant_id: &str,
        now: UtcInstant,
    ) -> Result<AuthorizedExecution, String> {
        let mut store = self.lock_store()?;
        let mut grant = store
            .grants
            .get(grant_id)
            .cloned()
            .ok_or_else(|| "Grant desconocido".to_string())?;
        expire_grant_if_needed(&mut grant, now)?;
        if grant.mode != PermissionMode::Session || grant.state != PermissionGrantState::Approved {
            return Err("El grant session no está disponible para iniciar".into());
        }
        let parameters = authorized_parameters(&store, &grant)?;
        grant.state = PermissionGrantState::Active;
        grant.validate()?;
        store.grants.insert(grant_id.to_string(), grant.clone());
        Ok(AuthorizedExecution { grant, parameters })
    }

    fn expire_at(&self, now: UtcInstant) -> Result<ExpirationSummary, String> {
        let mut store = self.lock_store()?;
        let mut summary = ExpirationSummary::default();
        for stored in store.requests.values_mut() {
            if stored.preview.state == PermissionRequestState::AwaitingDecision
                && request_has_expired(&stored.preview, now)?
            {
                stored.preview.state = PermissionRequestState::Expired;
                summary.requests += 1;
            }
        }
        for grant in store.grants.values_mut() {
            let previous = grant.state;
            expire_grant_if_needed(grant, now)?;
            if grant.state != previous {
                summary.grants += 1;
            }
        }
        Ok(summary)
    }

    fn status_at(&self, now: UtcInstant) -> Result<PermissionGatewayStatus, String> {
        self.expire_at(now)?;
        let store = self.lock_store()?;
        for stored in store.requests.values() {
            verify_stored_request(stored)?;
        }
        for grant in store.grants.values() {
            grant.validate()?;
        }
        let mut requests: Vec<_> = store
            .requests
            .values()
            .map(|stored| stored.preview.clone())
            .collect();
        requests.sort_by(|left, right| left.request_id.cmp(&right.request_id));
        let mut grants: Vec<_> = store.grants.values().cloned().collect();
        grants.sort_by(|left, right| left.grant_id.cmp(&right.grant_id));
        Ok(PermissionGatewayStatus {
            schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
            generated_at: format_utc_timestamp(now)?,
            policy: PermissionGatewayPolicy {
                deny_by_default: true,
                persistent_grants: false,
                r2_decision_commands_exposed: false,
                r2_execution_commands_exposed: false,
            },
            limits: PermissionGatewayLimits {
                high_risk_decision_ttl_seconds: super::HIGH_RISK_DECISION_TTL_SECONDS,
                standard_decision_ttl_seconds: super::STANDARD_DECISION_TTL_SECONDS,
                maximum_session_duration_seconds: MAX_SESSION_DURATION_SECONDS,
            },
            requests,
            grants,
        })
    }

    fn lock_store(&self) -> Result<MutexGuard<'_, PermissionGatewayStore>, String> {
        self.store
            .lock()
            .map_err(|_| "El almacén de permisos quedó bloqueado por un fallo interno".into())
    }
}

fn freeze_execution_plan(plan: Value) -> Result<Vec<u8>, String> {
    if !plan.is_object() {
        return Err("El plan ejecutable debe ser un objeto JSON".into());
    }
    serde_json::to_vec(&plan).map_err(|error| format!("No se pudo congelar el plan: {error}"))
}

fn intent_digest(
    draft: &PermissionRequestDraft,
    execution_plan_digest: &str,
) -> Result<String, String> {
    let intent = CanonicalPermissionIntent {
        schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
        idempotency_key: &draft.idempotency_key,
        capability_id: &draft.capability_id,
        capability_version: draft.capability_version,
        operation: &draft.operation,
        mode: draft.mode,
        purpose: &draft.purpose,
        resource: &draft.resource,
        data_scopes: &draft.data_scopes,
        effects: &draft.effects,
        risk: draft.risk,
        requested_duration_seconds: draft.requested_duration_seconds,
        maximum_duration_seconds: draft.maximum_duration_seconds,
        execution_plan_digest,
        summary: &draft.summary,
        warnings: &draft.warnings,
    };
    let bytes = serde_json::to_vec(&intent).map_err(|error| error.to_string())?;
    Ok(sha256_digest(&bytes))
}

fn verify_stored_request(stored: &StoredPermissionRequest) -> Result<(), String> {
    stored.preview.validate()?;
    if sha256_digest(&stored.execution_plan) != stored.preview.execution_plan_digest {
        return Err("El plan ejecutable retenido no coincide con su digest".into());
    }
    let expected_intent = intent_digest_from_preview(&stored.preview)?;
    if expected_intent != stored.intent_digest {
        return Err("La intención retenida cambió después de prepararse".into());
    }
    Ok(())
}

fn intent_digest_from_preview(request: &PreparedPermissionRequest) -> Result<String, String> {
    let draft = PermissionRequestDraft {
        schema_version: request.schema_version,
        request_id: request.request_id.clone(),
        idempotency_key: request.idempotency_key.clone(),
        capability_id: request.capability_id.clone(),
        capability_version: request.capability_version,
        operation: request.operation.clone(),
        mode: request.mode,
        purpose: request.purpose.clone(),
        resource: request.resource.clone(),
        data_scopes: request.data_scopes.clone(),
        effects: request.effects.clone(),
        risk: request.risk,
        created_at: request.created_at.clone(),
        decision_expires_at: request.decision_expires_at.clone(),
        requested_duration_seconds: request.requested_duration_seconds,
        maximum_duration_seconds: request.maximum_duration_seconds,
        summary: request.summary.clone(),
        warnings: request.warnings.clone(),
    };
    intent_digest(&draft, &request.execution_plan_digest)
}

fn create_grant(
    request: &PreparedPermissionRequest,
    now: UtcInstant,
) -> Result<PermissionGrant, String> {
    let lifetime = match request.mode {
        PermissionMode::OneShot => MAX_SESSION_DURATION_SECONDS,
        PermissionMode::Session => request
            .requested_duration_seconds
            .ok_or_else(|| "La sesión aprobada no tiene duración".to_string())?,
        PermissionMode::ImplicitRead => return Err("implicitRead no crea grants".into()),
    };
    let grant = PermissionGrant {
        schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
        grant_id: new_opaque_id("grant"),
        request_id: request.request_id.clone(),
        preview_digest: request.preview_digest.clone(),
        capability_id: request.capability_id.clone(),
        operation: request.operation.clone(),
        mode: request.mode,
        issued_at: format_utc_timestamp(now)?,
        expires_at: format_utc_timestamp(now.add_seconds(u64::from(lifetime))?)?,
        remaining_uses: (request.mode == PermissionMode::OneShot).then_some(1),
        state: PermissionGrantState::Approved,
    };
    grant.validate()?;
    Ok(grant)
}

fn authorized_parameters(
    store: &PermissionGatewayStore,
    grant: &PermissionGrant,
) -> Result<Value, String> {
    let stored = store
        .requests
        .get(&grant.request_id)
        .ok_or_else(|| "El plan autorizado ya no existe".to_string())?;
    verify_stored_request(stored)?;
    if stored.preview.preview_digest != grant.preview_digest
        || stored.grant_id.as_deref() != Some(grant.grant_id.as_str())
    {
        return Err("El grant no coincide con el plan retenido".into());
    }
    serde_json::from_slice(&stored.execution_plan)
        .map_err(|error| format!("El plan retenido no puede leerse: {error}"))
}

fn request_has_expired(
    request: &PreparedPermissionRequest,
    now: UtcInstant,
) -> Result<bool, String> {
    Ok(now >= parse_utc_timestamp("decisionExpiresAt", &request.decision_expires_at)?)
}

fn expire_grant_if_needed(grant: &mut PermissionGrant, now: UtcInstant) -> Result<(), String> {
    if matches!(
        grant.state,
        PermissionGrantState::Approved | PermissionGrantState::Active
    ) && now >= parse_utc_timestamp("expiresAt", &grant.expires_at)?
    {
        grant.state = PermissionGrantState::Expired;
        if grant.mode == PermissionMode::OneShot {
            grant.remaining_uses = Some(0);
        }
        grant.validate()?;
    }
    Ok(())
}

fn new_opaque_id(prefix: &str) -> String {
    format!("{prefix}_{}", Uuid::new_v4().simple())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::permissions::{
        PermissionEffect, PermissionResource, PermissionResourceKind, PermissionRisk,
    };
    use serde_json::json;
    use std::collections::HashSet;
    use std::sync::Arc;
    use std::thread;

    fn at(value: &str) -> UtcInstant {
        parse_utc_timestamp("test", value).unwrap()
    }

    fn draft(key: &str) -> PermissionRequestDraft {
        PermissionRequestDraft {
            schema_version: 999,
            request_id: "caller_must_not_choose_this_id".into(),
            idempotency_key: key.into(),
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
            created_at: "2000-01-01T00:00:00Z".into(),
            decision_expires_at: "2000-01-01T00:00:01Z".into(),
            requested_duration_seconds: None,
            maximum_duration_seconds: None,
            summary: "Alice solicita observar metadatos de la ventana activa.".into(),
            warnings: vec!["La aplicación activa puede quedar visible en el panel local.".into()],
        }
    }

    fn session_draft(key: &str) -> PermissionRequestDraft {
        PermissionRequestDraft {
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
            summary: "Alice solicita observar la cámara durante dos minutos.".into(),
            warnings: vec!["La luz de la cámara puede encenderse.".into()],
            ..draft(key)
        }
    }

    fn decision(
        request: &PreparedPermissionRequest,
        value: PermissionDecision,
    ) -> PermissionDecisionInput {
        PermissionDecisionInput {
            request_id: request.request_id.clone(),
            preview_digest: request.preview_digest.clone(),
            decision: value,
        }
    }

    fn prepare_one_shot(gateway: &PermissionGateway, key: &str) -> PreparedPermissionRequest {
        gateway
            .prepare_request_at(
                draft(key),
                json!({"enabled": true, "scope": "foregroundWindow"}),
                at("2026-08-09T14:00:00Z"),
            )
            .unwrap()
    }

    fn approve(
        gateway: &PermissionGateway,
        request: &PreparedPermissionRequest,
    ) -> PermissionGrant {
        gateway
            .decide_at(
                decision(request, PermissionDecision::Approve),
                at("2026-08-09T14:00:10Z"),
            )
            .unwrap()
            .unwrap()
    }

    #[test]
    fn preparation_assigns_native_ids_time_schema_and_frozen_plan_digest() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-prepare-01");

        assert!(request.request_id.starts_with("request_"));
        assert_ne!(request.request_id, "caller_must_not_choose_this_id");
        assert_eq!(request.schema_version, PERMISSION_GATEWAY_SCHEMA_VERSION);
        assert_eq!(request.created_at, "2026-08-09T14:00:00Z");
        assert_eq!(request.decision_expires_at, "2026-08-09T14:01:00Z");
        assert_eq!(
            request.execution_plan_digest,
            sha256_digest(br#"{"enabled":true,"scope":"foregroundWindow"}"#)
        );
        request.validate().unwrap();
    }

    #[test]
    fn idempotency_returns_the_existing_request_and_rejects_a_different_plan() {
        let gateway = PermissionGateway::default();
        let first = prepare_one_shot(&gateway, "gateway-idempotency-01");
        let repeated = prepare_one_shot(&gateway, "gateway-idempotency-01");
        assert_eq!(first, repeated);

        let error = gateway
            .prepare_request_at(
                draft("gateway-idempotency-01"),
                json!({"enabled": false}),
                at("2026-08-09T14:00:20Z"),
            )
            .unwrap_err();
        assert!(error.contains("plan de ejecución diferente"));
        assert_eq!(gateway.lock_store().unwrap().requests.len(), 1);
    }

    #[test]
    fn approval_and_denial_are_idempotent_without_executing_the_plan() {
        let gateway = PermissionGateway::default();
        let approved_request = prepare_one_shot(&gateway, "gateway-approve-001");
        let first_grant = approve(&gateway, &approved_request);
        let repeated_grant = gateway
            .decide_at(
                decision(&approved_request, PermissionDecision::Approve),
                at("2026-08-09T14:00:11Z"),
            )
            .unwrap()
            .unwrap();
        assert_eq!(first_grant, repeated_grant);
        assert_eq!(first_grant.state, PermissionGrantState::Approved);

        let denied_request = prepare_one_shot(&gateway, "gateway-deny-0001");
        assert!(gateway
            .decide_at(
                decision(&denied_request, PermissionDecision::Deny),
                at("2026-08-09T14:00:12Z"),
            )
            .unwrap()
            .is_none());
        assert_eq!(
            gateway.request(&denied_request.request_id).unwrap().state,
            PermissionRequestState::Denied
        );
        assert_eq!(gateway.lock_store().unwrap().grants.len(), 1);
    }

    #[test]
    fn cancellation_is_terminal_idempotent_and_creates_no_grant() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-cancel-001");
        let cancelled = gateway
            .cancel_request_at(&request.request_id, at("2026-08-09T14:00:20Z"))
            .unwrap();
        assert_eq!(cancelled.state, PermissionRequestState::Cancelled);
        assert_eq!(
            gateway
                .cancel_request_at(&request.request_id, at("2026-08-09T14:00:21Z"))
                .unwrap(),
            cancelled
        );
        assert!(gateway
            .decide_at(
                decision(&request, PermissionDecision::Approve),
                at("2026-08-09T14:00:22Z"),
            )
            .unwrap_err()
            .contains("terminal"));
        assert!(gateway.lock_store().unwrap().grants.is_empty());
    }

    #[test]
    fn expiration_closes_pending_requests_and_active_grants() {
        let gateway = PermissionGateway::default();
        let pending = prepare_one_shot(&gateway, "gateway-expire-001");
        let session = gateway
            .prepare_request_at(
                session_draft("gateway-session-exp"),
                json!({"deviceId": "camera-device-001"}),
                at("2026-08-09T14:00:00Z"),
            )
            .unwrap();
        let grant = approve(&gateway, &session);
        gateway
            .start_session_at(&grant.grant_id, at("2026-08-09T14:00:20Z"))
            .unwrap();

        let summary = gateway.expire_at(at("2026-08-09T14:02:10Z")).unwrap();
        assert_eq!(
            summary,
            ExpirationSummary {
                requests: 1,
                grants: 1
            }
        );
        assert_eq!(
            gateway.request(&pending.request_id).unwrap().state,
            PermissionRequestState::Expired
        );
        assert_eq!(
            gateway.grant(&grant.grant_id).unwrap().state,
            PermissionGrantState::Expired
        );
    }

    #[test]
    fn revocation_is_effective_and_idempotent_before_consumption() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-revoke-001");
        let grant = approve(&gateway, &request);
        let revoked = gateway
            .revoke_grant_at(&grant.grant_id, at("2026-08-09T14:00:20Z"))
            .unwrap();
        assert_eq!(revoked.state, PermissionGrantState::Revoked);
        assert_eq!(revoked.remaining_uses, Some(0));
        assert_eq!(
            gateway
                .revoke_grant_at(&grant.grant_id, at("2026-08-09T14:00:21Z"))
                .unwrap(),
            revoked
        );
        assert!(gateway
            .authorize_one_shot_at(&grant.grant_id, at("2026-08-09T14:00:22Z"))
            .unwrap_err()
            .contains("no está disponible"));
    }

    #[test]
    fn one_shot_consumes_once_and_returns_only_the_frozen_plan() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-consume-001");
        let grant = approve(&gateway, &request);
        let execution = gateway
            .authorize_one_shot_at(&grant.grant_id, at("2026-08-09T14:00:20Z"))
            .unwrap();
        assert_eq!(
            execution.parameters,
            json!({"enabled": true, "scope": "foregroundWindow"})
        );
        assert_eq!(execution.grant.state, PermissionGrantState::Consuming);
        assert!(gateway
            .authorize_one_shot_at(&grant.grant_id, at("2026-08-09T14:00:21Z"))
            .unwrap_err()
            .contains("no está disponible"));

        let completed = gateway.complete_one_shot(&grant.grant_id, true).unwrap();
        assert_eq!(completed.state, PermissionGrantState::Completed);
        assert_eq!(completed.remaining_uses, Some(0));
    }

    #[test]
    fn session_starts_once_and_stop_is_idempotent() {
        let gateway = PermissionGateway::default();
        let request = gateway
            .prepare_request_at(
                session_draft("gateway-session-001"),
                json!({"deviceId": "camera-device-001"}),
                at("2026-08-09T14:00:00Z"),
            )
            .unwrap();
        let grant = approve(&gateway, &request);
        let active = gateway
            .start_session_at(&grant.grant_id, at("2026-08-09T14:00:20Z"))
            .unwrap();
        assert_eq!(active.grant.state, PermissionGrantState::Active);
        assert!(gateway
            .start_session_at(&grant.grant_id, at("2026-08-09T14:00:21Z"))
            .unwrap_err()
            .contains("no está disponible"));

        let stopped = gateway.stop_session(&grant.grant_id).unwrap();
        assert_eq!(stopped.state, PermissionGrantState::Stopped);
        assert_eq!(gateway.stop_session(&grant.grant_id).unwrap(), stopped);
    }

    #[test]
    fn altered_private_plan_is_detected_before_execution() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-integrity-01");
        let grant = approve(&gateway, &request);
        gateway
            .lock_store()
            .unwrap()
            .requests
            .get_mut(&request.request_id)
            .unwrap()
            .execution_plan = EMPTY_EXECUTION_PLAN.to_vec();

        assert!(gateway
            .authorize_one_shot_at(&grant.grant_id, at("2026-08-09T14:00:20Z"))
            .unwrap_err()
            .contains("plan ejecutable retenido"));
    }

    #[test]
    fn concurrent_retries_create_one_request_and_one_random_id() {
        let gateway = Arc::new(PermissionGateway::default());
        let mut threads = Vec::new();
        for _ in 0..12 {
            let gateway = Arc::clone(&gateway);
            threads.push(thread::spawn(move || {
                gateway
                    .prepare_request_at(
                        draft("gateway-concurrent1"),
                        json!({"enabled": true}),
                        at("2026-08-09T14:00:00Z"),
                    )
                    .unwrap()
                    .request_id
            }));
        }
        let ids: HashSet<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(ids.len(), 1);
        assert_eq!(gateway.lock_store().unwrap().requests.len(), 1);
    }

    #[test]
    fn status_is_native_read_only_and_reports_the_fixed_policy() {
        let gateway = PermissionGateway::default();
        let status = gateway.status_at(at("2026-08-09T14:00:00Z")).unwrap();

        assert_eq!(status.schema_version, PERMISSION_GATEWAY_SCHEMA_VERSION);
        assert_eq!(status.generated_at, "2026-08-09T14:00:00Z");
        assert!(status.policy.deny_by_default);
        assert!(!status.policy.persistent_grants);
        assert!(!status.policy.r2_decision_commands_exposed);
        assert!(!status.policy.r2_execution_commands_exposed);
        assert_eq!(status.limits.high_risk_decision_ttl_seconds, 60);
        assert_eq!(status.limits.standard_decision_ttl_seconds, 300);
        assert_eq!(status.limits.maximum_session_duration_seconds, 300);
        assert!(status.requests.is_empty());
        assert!(status.grants.is_empty());
    }

    #[test]
    fn status_exposes_preview_digests_but_never_private_parameters() {
        let gateway = PermissionGateway::default();
        prepare_one_shot(&gateway, "gateway-status-0001");
        let status = gateway.status_at(at("2026-08-09T14:00:10Z")).unwrap();
        let serialized = serde_json::to_string(&status).unwrap();

        assert_eq!(status.requests.len(), 1);
        assert!(status.grants.is_empty());
        assert!(serialized.contains("executionPlanDigest"));
        assert!(!serialized.contains("foregroundWindow"));
        assert!(!serialized.contains("\"enabled\""));
    }

    #[test]
    fn status_expires_pending_requests_before_returning_them() {
        let gateway = PermissionGateway::default();
        let request = prepare_one_shot(&gateway, "gateway-status-exp1");
        let status = gateway.status_at(at("2026-08-09T14:01:00Z")).unwrap();

        assert_eq!(status.requests.len(), 1);
        assert_eq!(status.requests[0].request_id, request.request_id);
        assert_eq!(status.requests[0].state, PermissionRequestState::Expired);
    }

    #[test]
    fn native_id_generation_does_not_repeat_in_a_real_batch() {
        let ids: HashSet<_> = (0..1_000).map(|_| new_opaque_id("request")).collect();
        assert_eq!(ids.len(), 1_000);
        assert!(ids
            .iter()
            .all(|value| value.len() == 40 && value.starts_with("request_")));
    }

    #[test]
    fn utc_formatter_round_trips_real_boundaries() {
        for value in [
            "1970-01-01T00:00:00Z",
            "2028-02-29T23:59:59.123456789Z",
            "2100-03-01T00:00:00Z",
        ] {
            let instant = at(value);
            assert_eq!(format_utc_timestamp(instant).unwrap(), value);
        }
    }
}
