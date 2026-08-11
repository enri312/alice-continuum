use crate::util::{alice_data_root, alice_data_root_path, timestamp_ms};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use uuid::Uuid;

pub(crate) const AUDIT_SCHEMA_VERSION: u32 = 1;
pub(crate) const AUDIT_MAX_BYTES: u64 = 5 * 1024 * 1024;
pub(crate) const AUDIT_VISIBLE_EVENT_LIMIT: usize = 200;
const AUDIT_DIRECTORY: &str = "audit";
const AUDIT_FILE: &str = "events-v1.jsonl";
const AUDIT_ROTATED_FILE: &str = "events-v1.previous.jsonl";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AuditSource {
    System,
    Permission,
    Capability,
    Memory,
    Cloud,
    Skill,
    Avatar,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AuditStage {
    Request,
    Authorization,
    Execution,
    Stop,
    Revocation,
    Block,
    Error,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AuditDecision {
    Allow,
    Deny,
    Cancel,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AuditOutcome {
    Pending,
    Success,
    Blocked,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AuditEvent {
    pub(crate) schema_version: u32,
    pub(crate) event_id: String,
    pub(crate) operation_id: String,
    pub(crate) timestamp_ms: u64,
    pub(crate) source: AuditSource,
    pub(crate) capability_id: Option<String>,
    pub(crate) operation: String,
    pub(crate) stage: AuditStage,
    pub(crate) decision: Option<AuditDecision>,
    pub(crate) outcome: AuditOutcome,
    pub(crate) duration_ms: Option<u64>,
    pub(crate) subject_digest: Option<String>,
    pub(crate) reason_code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AuditSnapshot {
    schema_version: u32,
    healthy: bool,
    storage_path: String,
    current_bytes: u64,
    rotated_bytes: u64,
    maximum_current_bytes: u64,
    total_valid_events: usize,
    invalid_lines: usize,
    events: Vec<AuditEvent>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct AuditDiagnosticProbe {
    pub(crate) exists: bool,
    pub(crate) current_bytes: u64,
    pub(crate) rotated_bytes: u64,
    pub(crate) valid_events: usize,
    pub(crate) invalid_lines: usize,
}

impl AuditEvent {
    pub(crate) fn process_started() -> Result<Self, String> {
        let event_id = Uuid::new_v4().to_string();
        let event = Self {
            schema_version: AUDIT_SCHEMA_VERSION,
            operation_id: event_id.clone(),
            event_id,
            timestamp_ms: u64::try_from(timestamp_ms()?)
                .map_err(|_| "El reloj del sistema excede el rango de auditoría".to_string())?,
            source: AuditSource::System,
            capability_id: None,
            operation: "process.startup".into(),
            stage: AuditStage::Execution,
            decision: None,
            outcome: AuditOutcome::Success,
            duration_ms: None,
            subject_digest: None,
            reason_code: "PROCESS_STARTED".into(),
        };
        event.validate()?;
        Ok(event)
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn permission(
        operation_id: String,
        capability_id: String,
        operation: String,
        stage: AuditStage,
        decision: Option<AuditDecision>,
        outcome: AuditOutcome,
        duration_ms: Option<u64>,
        subject_digest: Option<String>,
        reason_code: impl Into<String>,
    ) -> Result<Self, String> {
        let event = Self {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id,
            timestamp_ms: u64::try_from(timestamp_ms()?)
                .map_err(|_| "El reloj del sistema excede el rango de auditoría".to_string())?,
            source: AuditSource::Permission,
            capability_id: Some(capability_id),
            operation,
            stage,
            decision,
            outcome,
            duration_ms,
            subject_digest,
            reason_code: reason_code.into(),
        };
        event.validate()?;
        Ok(event)
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn producer(
        operation_id: String,
        source: AuditSource,
        capability_id: String,
        operation: String,
        stage: AuditStage,
        outcome: AuditOutcome,
        duration_ms: Option<u64>,
        subject_digest: Option<String>,
        reason_code: impl Into<String>,
    ) -> Result<Self, String> {
        if !matches!(source, AuditSource::Memory | AuditSource::Cloud) {
            return Err("El productor R3 debe ser memory o cloud".into());
        }
        let event = Self {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id,
            timestamp_ms: u64::try_from(timestamp_ms()?)
                .map_err(|_| "El reloj del sistema excede el rango de auditoría".to_string())?,
            source,
            capability_id: Some(capability_id),
            operation,
            stage,
            decision: None,
            outcome,
            duration_ms,
            subject_digest,
            reason_code: reason_code.into(),
        };
        event.validate()?;
        Ok(event)
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn skill(
        operation_id: String,
        operation: String,
        stage: AuditStage,
        outcome: AuditOutcome,
        duration_ms: Option<u64>,
        subject_digest: Option<String>,
        reason_code: impl Into<String>,
    ) -> Result<Self, String> {
        let event = Self {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id,
            timestamp_ms: u64::try_from(timestamp_ms()?)
                .map_err(|_| "El reloj del sistema excede el rango de auditoría".to_string())?,
            source: AuditSource::Skill,
            capability_id: None,
            operation,
            stage,
            decision: None,
            outcome,
            duration_ms,
            subject_digest,
            reason_code: reason_code.into(),
        };
        event.validate()?;
        Ok(event)
    }

    pub(crate) fn avatar_motor(
        operation_id: String,
        operation: String,
        reason_code: impl Into<String>,
    ) -> Result<Self, String> {
        let event = Self {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id,
            timestamp_ms: u64::try_from(timestamp_ms()?)
                .map_err(|_| "El reloj del sistema excede el rango de auditoría".to_string())?,
            source: AuditSource::Avatar,
            capability_id: Some("avatar.vrm.render".into()),
            operation,
            stage: AuditStage::Execution,
            decision: None,
            outcome: AuditOutcome::Success,
            duration_ms: None,
            subject_digest: None,
            reason_code: reason_code.into(),
        };
        event.validate()?;
        Ok(event)
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.schema_version != AUDIT_SCHEMA_VERSION {
            return Err(format!("schemaVersion debe ser {AUDIT_SCHEMA_VERSION}"));
        }
        validate_uuid_v4("eventId", &self.event_id)?;
        validate_uuid_v4("operationId", &self.operation_id)?;
        if self.timestamp_ms == 0 {
            return Err("timestampMs debe ser positivo".into());
        }
        if let Some(capability_id) = &self.capability_id {
            validate_capability_id(capability_id)?;
        }
        validate_operation(&self.operation)?;
        validate_reason_code(&self.reason_code)?;
        if let Some(digest) = &self.subject_digest {
            validate_digest(digest)?;
        }
        if self
            .duration_ms
            .is_some_and(|duration| duration > 86_400_000)
        {
            return Err("durationMs no puede superar 24 horas".into());
        }

        match self.stage {
            AuditStage::Request if self.outcome != AuditOutcome::Pending => {
                return Err("Una solicitud nueva debe tener outcome=pending".into());
            }
            AuditStage::Authorization if self.decision.is_none() => {
                return Err("Una autorización requiere decision".into());
            }
            AuditStage::Block if self.outcome != AuditOutcome::Blocked => {
                return Err("Un bloqueo debe tener outcome=blocked".into());
            }
            AuditStage::Error if self.outcome != AuditOutcome::Error => {
                return Err("Un error debe tener outcome=error".into());
            }
            _ => {}
        }
        if self.source == AuditSource::Avatar {
            const MOTOR_OPERATIONS: [&str; 7] = [
                "avatar.motor.standing_idle",
                "avatar.motor.starting_walk",
                "avatar.motor.locomoting",
                "avatar.motor.jumping",
                "avatar.motor.sitting_down",
                "avatar.motor.sitting_idle",
                "avatar.motor.standing_up",
            ];
            const MOTOR_REASONS: [&str; 3] = [
                "HUMAN_GAMEPAD_TRANSITION",
                "LOCAL_DIAGNOSTIC_TRANSITION",
                "HUMAN_POSTURE_TRANSITION",
            ];
            if self.capability_id.as_deref() != Some("avatar.vrm.render")
                || !MOTOR_OPERATIONS.contains(&self.operation.as_str())
                || self.stage != AuditStage::Execution
                || self.outcome != AuditOutcome::Success
                || self.decision.is_some()
                || self.duration_ms.is_some()
                || self.subject_digest.is_some()
                || !MOTOR_REASONS.contains(&self.reason_code.as_str())
            {
                return Err("El evento motor del avatar no cumple el contrato R3 cerrado".into());
            }
        }
        Ok(())
    }
}

fn validate_uuid_v4(field: &str, value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} debe ser UUID v4"))?;
    if parsed.get_version_num() != 4 || parsed.to_string() != value.to_ascii_lowercase() {
        return Err(format!("{field} debe ser UUID v4 canónico"));
    }
    Ok(())
}

fn validate_capability_id(value: &str) -> Result<(), String> {
    let segments: Vec<_> = value.split('.').collect();
    let valid = segments.len() >= 2
        && value.len() <= 128
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
        Err("capabilityId no tiene el formato canónico".into())
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
        Err("operation debe ser un identificador ASCII de hasta 96 caracteres".into())
    }
}

fn validate_reason_code(value: &str) -> Result<(), String> {
    let valid = (1..=64).contains(&value.len())
        && value.chars().all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '_'
        });
    if valid {
        Ok(())
    } else {
        Err("reasonCode debe ser un código ASCII mayúsculo".into())
    }
}

fn validate_digest(value: &str) -> Result<(), String> {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err("subjectDigest debe usar el prefijo sha256:".into());
    };
    if hex.len() == 64 && hex.chars().all(|character| character.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err("subjectDigest debe contener 64 caracteres hexadecimales".into())
    }
}

fn audit_paths(data_root: &Path) -> (PathBuf, PathBuf) {
    let directory = data_root.join(AUDIT_DIRECTORY);
    (
        directory.join(AUDIT_FILE),
        directory.join(AUDIT_ROTATED_FILE),
    )
}

pub(crate) fn append_event_at(
    data_root: &Path,
    event: &AuditEvent,
    maximum_bytes: u64,
) -> Result<(), String> {
    event.validate()?;
    let mut line = serde_json::to_vec(event).map_err(|error| error.to_string())?;
    line.push(b'\n');
    if u64::try_from(line.len()).unwrap_or(u64::MAX) > maximum_bytes {
        return Err("El evento excede el límite del archivo de auditoría".into());
    }

    let (current, previous) = audit_paths(data_root);
    let directory = current
        .parent()
        .ok_or("No se encontró la carpeta de auditoría")?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("No se pudo crear la carpeta de auditoría R3: {error}"))?;

    let current_length = fs::metadata(&current)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if current_length + u64::try_from(line.len()).unwrap_or(u64::MAX) > maximum_bytes {
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|error| format!("No se pudo rotar la auditoría anterior: {error}"))?;
        }
        if current.exists() {
            fs::rename(&current, &previous)
                .map_err(|error| format!("No se pudo rotar la auditoría actual: {error}"))?;
        }
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&current)
        .map_err(|error| format!("No se pudo abrir la auditoría R3: {error}"))?;
    file.write_all(&line)
        .map_err(|error| format!("No se pudo registrar el evento R3: {error}"))
}

pub(crate) fn append_audit_event(app: &AppHandle, event: &AuditEvent) -> Result<(), String> {
    append_event_at(&alice_data_root(app)?, event, AUDIT_MAX_BYTES)
}

pub(crate) fn new_operation_id() -> String {
    Uuid::new_v4().to_string()
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn record_producer_audit(
    app: &AppHandle,
    operation_id: String,
    source: AuditSource,
    capability_id: String,
    operation: String,
    stage: AuditStage,
    outcome: AuditOutcome,
    duration_ms: Option<u64>,
    subject_digest: Option<String>,
    reason_code: impl Into<String>,
) -> Result<(), String> {
    append_audit_event(
        app,
        &AuditEvent::producer(
            operation_id,
            source,
            capability_id,
            operation,
            stage,
            outcome,
            duration_ms,
            subject_digest,
            reason_code,
        )?,
    )
}

pub(crate) fn record_process_started(app: &AppHandle) -> Result<(), String> {
    append_audit_event(app, &AuditEvent::process_started()?)
}

fn snapshot_at(data_root: &Path) -> Result<AuditSnapshot, String> {
    let (current, previous) = audit_paths(data_root);
    let current_bytes = fs::metadata(&current)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let rotated_bytes = fs::metadata(&previous)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let content = match fs::read_to_string(&current) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("No se pudo leer la auditoría R3: {error}")),
    };

    let mut valid_events = Vec::new();
    let mut invalid_lines = 0;
    for line in content.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<AuditEvent>(line) {
            Ok(event) if event.validate().is_ok() => valid_events.push(event),
            Ok(_) | Err(_) => invalid_lines += 1,
        }
    }
    let total_valid_events = valid_events.len();
    let visible_from = total_valid_events.saturating_sub(AUDIT_VISIBLE_EVENT_LIMIT);
    let events = valid_events.split_off(visible_from);
    Ok(AuditSnapshot {
        schema_version: AUDIT_SCHEMA_VERSION,
        healthy: invalid_lines == 0,
        storage_path: current.to_string_lossy().into_owned(),
        current_bytes,
        rotated_bytes,
        maximum_current_bytes: AUDIT_MAX_BYTES,
        total_valid_events,
        invalid_lines,
        events,
    })
}

pub(crate) fn validated_visible_events_at(
    data_root: &Path,
) -> Result<(bool, Vec<AuditEvent>), String> {
    let snapshot = snapshot_at(data_root)?;
    Ok((snapshot.healthy, snapshot.events))
}

pub(crate) fn audit_diagnostic_probe(data_root: &Path) -> Result<AuditDiagnosticProbe, String> {
    let (current, _) = audit_paths(data_root);
    let snapshot = snapshot_at(data_root)?;
    Ok(AuditDiagnosticProbe {
        exists: current.is_file(),
        current_bytes: snapshot.current_bytes,
        rotated_bytes: snapshot.rotated_bytes,
        valid_events: snapshot.total_valid_events,
        invalid_lines: snapshot.invalid_lines,
    })
}

#[tauri::command]
pub(crate) fn audit_snapshot(app: AppHandle) -> Result<AuditSnapshot, String> {
    snapshot_at(&alice_data_root_path(&app)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_event() -> AuditEvent {
        AuditEvent {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id: Uuid::new_v4().to_string(),
            timestamp_ms: 1_786_280_000_000,
            source: AuditSource::Permission,
            capability_id: Some("perception.camera.observe".into()),
            operation: "observeAuthorizedCamera".into(),
            stage: AuditStage::Request,
            decision: None,
            outcome: AuditOutcome::Pending,
            duration_ms: None,
            subject_digest: Some(format!("sha256:{}", "a".repeat(64))),
            reason_code: "AWAITING_USER_DECISION".into(),
        }
    }

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!("alice-r3-audit-{}", Uuid::new_v4()))
    }

    #[test]
    fn schema_serializes_without_private_content_fields() {
        let value = serde_json::to_value(test_event()).expect("serialize audit event");
        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["stage"], "request");
        assert!(value.get("message").is_none());
        assert!(value.get("payload").is_none());
        assert!(value.get("parameters").is_none());
    }

    #[test]
    fn schema_rejects_unknown_or_private_fields() {
        let mut value = serde_json::to_value(test_event()).expect("serialize audit event");
        value["message"] = serde_json::json!("contenido privado");
        let error = serde_json::from_value::<AuditEvent>(value).expect_err("unknown field");
        assert!(error.to_string().contains("unknown field"));
    }

    #[test]
    fn validation_rejects_invalid_correlations_and_stage_outcomes() {
        let mut event = test_event();
        event.operation_id = "not-a-uuid".into();
        assert!(event.validate().is_err());

        let mut event = test_event();
        event.outcome = AuditOutcome::Success;
        assert_eq!(
            event.validate(),
            Err("Una solicitud nueva debe tener outcome=pending".into())
        );

        let mut event = test_event();
        event.stage = AuditStage::Authorization;
        event.outcome = AuditOutcome::Success;
        assert_eq!(
            event.validate(),
            Err("Una autorización requiere decision".into())
        );
    }

    #[test]
    fn append_and_snapshot_use_real_jsonl_files() {
        let root = temp_root();
        let event = test_event();
        append_event_at(&root, &event, AUDIT_MAX_BYTES).expect("append event");
        let snapshot = snapshot_at(&root).expect("read snapshot");
        assert!(snapshot.healthy);
        assert_eq!(snapshot.total_valid_events, 1);
        assert_eq!(snapshot.events, vec![event]);
        assert!(snapshot.current_bytes > 0);
        fs::remove_dir_all(&root).expect("remove isolated test root");
    }

    #[test]
    fn correlated_permission_flow_persists_without_private_content() {
        let root = temp_root();
        let operation_id = Uuid::new_v4().to_string();
        let digest = Some(format!("sha256:{}", "b".repeat(64)));
        let events = [
            AuditEvent::permission(
                operation_id.clone(),
                "perception.camera.observe".into(),
                "observeAuthorizedCamera".into(),
                AuditStage::Request,
                None,
                AuditOutcome::Pending,
                None,
                digest.clone(),
                "AWAITING_USER_DECISION",
            )
            .unwrap(),
            AuditEvent::permission(
                operation_id.clone(),
                "perception.camera.observe".into(),
                "observeAuthorizedCamera".into(),
                AuditStage::Authorization,
                Some(AuditDecision::Allow),
                AuditOutcome::Success,
                None,
                digest.clone(),
                "USER_APPROVED",
            )
            .unwrap(),
            AuditEvent::permission(
                operation_id.clone(),
                "perception.camera.observe".into(),
                "observeAuthorizedCamera".into(),
                AuditStage::Execution,
                None,
                AuditOutcome::Success,
                Some(12),
                digest,
                "ADAPTER_STARTED",
            )
            .unwrap(),
        ];
        for event in &events {
            append_event_at(&root, event, AUDIT_MAX_BYTES).unwrap();
        }

        let snapshot = snapshot_at(&root).unwrap();
        assert_eq!(snapshot.events.len(), 3);
        assert!(snapshot
            .events
            .iter()
            .all(|event| event.operation_id == operation_id));
        let json = fs::read_to_string(audit_paths(&root).0).unwrap();
        assert!(!json.contains("message"));
        assert!(!json.contains("purpose"));
        assert!(!json.contains("parameters"));
        assert!(!json.contains("deviceStableId"));
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn correlated_memory_and_cloud_flows_persist_real_minimal_jsonl() {
        let root = temp_root();
        let memory_operation_id = Uuid::new_v4().to_string();
        let cloud_operation_id = Uuid::new_v4().to_string();
        let events = [
            AuditEvent::producer(
                memory_operation_id.clone(),
                AuditSource::Memory,
                "memory.records.write".into(),
                "memory.save".into(),
                AuditStage::Request,
                AuditOutcome::Pending,
                None,
                Some(format!("sha256:{}", "c".repeat(64))),
                "MEMORY_OPERATION_ACCEPTED",
            )
            .unwrap(),
            AuditEvent::producer(
                memory_operation_id.clone(),
                AuditSource::Memory,
                "memory.records.write".into(),
                "memory.save".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(4),
                Some(format!("sha256:{}", "c".repeat(64))),
                "MEMORY_SAVED",
            )
            .unwrap(),
            AuditEvent::producer(
                cloud_operation_id.clone(),
                AuditSource::Cloud,
                "cloud.conversation.send".into(),
                "cloud.send".into(),
                AuditStage::Request,
                AuditOutcome::Pending,
                None,
                Some(format!("sha256:{}", "d".repeat(64))),
                "OUTBOUND_REQUEST_ACCEPTED",
            )
            .unwrap(),
            AuditEvent::producer(
                cloud_operation_id.clone(),
                AuditSource::Cloud,
                "cloud.conversation.send".into(),
                "cloud.send".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(25),
                Some(format!("sha256:{}", "e".repeat(64))),
                "CLOUD_RESPONSE_RECEIVED",
            )
            .unwrap(),
        ];
        for event in &events {
            append_event_at(&root, event, AUDIT_MAX_BYTES).unwrap();
        }

        let snapshot = snapshot_at(&root).unwrap();
        assert_eq!(snapshot.events, events);
        assert_eq!(snapshot.events[0].operation_id, memory_operation_id);
        assert_eq!(snapshot.events[2].operation_id, cloud_operation_id);
        let json = fs::read_to_string(audit_paths(&root).0).unwrap();
        for private_field in [
            "message",
            "payload",
            "provider",
            "model",
            "responseId",
            "sessions",
            "apiKey",
        ] {
            assert!(!json.contains(private_field));
        }
        assert_eq!(json.lines().count(), 4);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn producer_constructor_rejects_sources_outside_memory_and_cloud() {
        let result = AuditEvent::producer(
            Uuid::new_v4().to_string(),
            AuditSource::System,
            "memory.records.write".into(),
            "memory.save".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            None,
            None,
            "MEMORY_SAVED",
        );
        assert_eq!(
            result,
            Err("El productor R3 debe ser memory o cloud".into())
        );
    }

    #[test]
    fn rotation_bounds_current_and_previous_files() {
        let root = temp_root();
        let event = test_event();
        let line_length = serde_json::to_vec(&event).expect("serialize").len() as u64 + 1;
        let maximum = line_length * 2;
        for _ in 0..3 {
            let mut next = event.clone();
            next.event_id = Uuid::new_v4().to_string();
            append_event_at(&root, &next, maximum).expect("append bounded event");
        }
        let (current, previous) = audit_paths(&root);
        assert!(current.is_file());
        assert!(previous.is_file());
        assert!(fs::metadata(current).expect("current metadata").len() <= maximum);
        assert!(fs::metadata(previous).expect("previous metadata").len() <= maximum);
        fs::remove_dir_all(&root).expect("remove isolated test root");
    }

    #[test]
    fn snapshot_is_read_only_when_audit_does_not_exist() {
        let root = temp_root();
        let snapshot = snapshot_at(&root).expect("empty snapshot");
        assert!(snapshot.events.is_empty());
        assert!(!root.exists());
    }
}
