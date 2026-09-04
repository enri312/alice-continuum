use crate::audit::{append_event_at, new_operation_id, AuditEvent, AuditOutcome, AUDIT_MAX_BYTES};
use crate::capabilities::{current_utc_timestamp, validate_timestamp};
use crate::util::{alice_data_root_path, encode_hex_lower};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Weak};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tauri::State;
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

pub(crate) const TASK_REGISTRY_SCHEMA_VERSION: u32 = 1;
const TASK_DIRECTORY: &str = "tasks";
const TASK_FILE: &str = "tasks-v1.json";
const TASK_REVISION_INDEX_FILE: &str = "revision-index-v1.json";
const TASK_ATTEMPT_LEDGER_FILE: &str = "attempt-ledger-v1.json";
const MAX_TASKS: usize = 200;
const MAX_TASK_FILE_BYTES: u64 = 1024 * 1024;
const MAX_TASK_REVISIONS: usize = 1000;
const MAX_TASK_ATTEMPTS: usize = 1000;
static TASK_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskRegistryState {
    Missing,
    Ready,
    Invalid,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskKind {
    LocalReminder,
    ReadOnlyCheck,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskStatus {
    Scheduled,
    Paused,
    Completed,
    Cancelled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskScheduleKind {
    Once,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskScopeKind {
    LocalNotification,
    CapabilityRead,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskOrigin {
    OwnerConfirmed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskSchedule {
    pub(crate) kind: TaskScheduleKind,
    pub(crate) next_run_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskScope {
    pub(crate) kind: TaskScopeKind,
    pub(crate) capability_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskRecord {
    pub(crate) task_id: String,
    pub(crate) title: String,
    pub(crate) kind: TaskKind,
    pub(crate) status: TaskStatus,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) schedule: TaskSchedule,
    pub(crate) scope: TaskScope,
    pub(crate) origin: TaskOrigin,
    pub(crate) cancellable: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TaskMutationAction {
    ScheduleLocalReminder,
    CancelTask,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreviewTaskMutationInput {
    action: TaskMutationAction,
    title: Option<String>,
    next_run_at: Option<String>,
    task_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskMutationPlan {
    schema_version: u32,
    plan_id: String,
    plan_sha256: String,
    action: TaskMutationAction,
    planned_at: String,
    task_id: String,
    title: String,
    next_run_at: Option<String>,
    scope: TaskScope,
    source_exists: bool,
    source_sha256_before: Option<String>,
    projected_revision_id: String,
    projected_source_sha256: String,
    record_count_before: usize,
    record_count_after: usize,
    backup_required: bool,
    revision_required: bool,
    audit_required: bool,
    writes_required: bool,
    automatic_execution: bool,
    writes_performed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConfirmTaskMutationInput {
    plan: TaskMutationPlan,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskMutationReceipt {
    schema_version: u32,
    operation_id: String,
    action: TaskMutationAction,
    task_id: String,
    revision_id: String,
    source_sha256: String,
    record_count: usize,
    backup_created: bool,
    revision_written: bool,
    audit_written: bool,
    idempotent: bool,
    automatic_execution: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TaskRevisionEntry {
    revision_id: String,
    created_at: String,
    action: TaskMutationAction,
    task_subject_sha256: String,
    source_sha256: String,
    task_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TaskRevisionIndex {
    schema_version: u32,
    active_revision_id: String,
    revisions: Vec<TaskRevisionEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TaskRegistryDocument {
    pub(crate) schema_version: u32,
    pub(crate) revision_id: String,
    pub(crate) tasks: Vec<TaskRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskRegistrySnapshot {
    schema_version: u32,
    state: TaskRegistryState,
    storage_exists: bool,
    task_count: usize,
    scheduled_count: usize,
    paused_count: usize,
    completed_count: usize,
    cancelled_count: usize,
    tasks: Vec<TaskRecord>,
    error: Option<String>,
    automatic_execution: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum TaskTemporalState {
    Waiting,
    Due,
    Excluded,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum TaskTemporalReason {
    Paused,
    Completed,
    Cancelled,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskTemporalEntry {
    task_id: String,
    title: String,
    kind: TaskKind,
    registry_status: TaskStatus,
    scheduled_for: Option<String>,
    temporal_state: TaskTemporalState,
    reason: Option<TaskTemporalReason>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskEngineSnapshot {
    schema_version: u32,
    registry_state: TaskRegistryState,
    evaluated_at: String,
    background_enabled: bool,
    last_background_evaluation_at: Option<String>,
    waiting_count: usize,
    due_count: usize,
    excluded_count: usize,
    next_wake_at: Option<String>,
    items: Vec<TaskTemporalEntry>,
    error: Option<String>,
    automatic_execution: bool,
    notifications_enabled: bool,
    writes_performed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetTaskEngineEnabledInput {
    enabled: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum TaskAttemptState {
    Reserved,
    Dispatching,
    Accepted,
    Failed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum TaskDispatchReason {
    AcceptedByOs,
    NotificationError,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TaskAttemptRecord {
    attempt_id: String,
    idempotency_key: String,
    task_id: String,
    task_revision_id: String,
    scheduled_for: String,
    reserved_at: String,
    state: TaskAttemptState,
    dispatch_operation_id: Option<String>,
    dispatch_started_at: Option<String>,
    dispatch_finished_at: Option<String>,
    dispatch_reason: Option<TaskDispatchReason>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TaskAttemptLedgerDocument {
    schema_version: u32,
    attempts: Vec<TaskAttemptRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskAttemptLedgerSnapshot {
    schema_version: u32,
    state: TaskRegistryState,
    storage_exists: bool,
    reservation_count: usize,
    reservations: Vec<TaskAttemptRecord>,
    error: Option<String>,
    notifications_enabled: bool,
    output_performed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReserveTaskAttemptInput {
    task_id: String,
    scheduled_for: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskAttemptReservationReceipt {
    schema_version: u32,
    operation_id: String,
    attempt_id: String,
    idempotency_key: String,
    task_id: String,
    task_revision_id: String,
    scheduled_for: String,
    reserved_at: String,
    idempotent: bool,
    ledger_written: bool,
    audit_written: bool,
    notification_sent: bool,
    output_performed: bool,
    task_state_changed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DispatchTaskNotificationInput {
    attempt_id: String,
    idempotency_key: String,
    confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskNotificationReceipt {
    schema_version: u32,
    operation_id: String,
    attempt_id: String,
    task_id: String,
    state: TaskAttemptState,
    dispatch_reason: TaskDispatchReason,
    dispatch_started_at: String,
    dispatch_finished_at: String,
    notification_accepted: bool,
    audit_written: bool,
    idempotent: bool,
    network_used: bool,
    process_spawned: bool,
    task_state_changed: bool,
}

#[derive(Default)]
struct TaskEngineRuntime {
    enabled: bool,
    last_background_evaluation_at: Option<String>,
    last_error: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct TaskEngineStore {
    inner: Arc<Mutex<TaskEngineRuntime>>,
}

impl TaskEngineStore {
    fn weak(&self) -> Weak<Mutex<TaskEngineRuntime>> {
        Arc::downgrade(&self.inner)
    }

    fn status(&self) -> Result<(bool, Option<String>, Option<String>), String> {
        let runtime = self
            .inner
            .lock()
            .map_err(|_| "El estado temporal R7 quedó envenenado".to_string())?;
        Ok((
            runtime.enabled,
            runtime.last_background_evaluation_at.clone(),
            runtime.last_error.clone(),
        ))
    }

    fn set_enabled(&self, enabled: bool) -> Result<(), String> {
        let mut runtime = self
            .inner
            .lock()
            .map_err(|_| "El estado temporal R7 quedó envenenado".to_string())?;
        runtime.enabled = enabled;
        runtime.last_error = None;
        if !enabled {
            runtime.last_background_evaluation_at = None;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct TaskCapabilityProbe {
    pub(crate) state: TaskRegistryState,
    pub(crate) task_count: usize,
}

impl TaskRegistryDocument {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != TASK_REGISTRY_SCHEMA_VERSION {
            return Err("Versión desconocida del registro de tareas".into());
        }
        validate_uuid("revisionId", &self.revision_id)?;
        if self.tasks.len() > MAX_TASKS {
            return Err(format!(
                "El registro supera el máximo de {MAX_TASKS} tareas"
            ));
        }

        let mut ids = HashSet::with_capacity(self.tasks.len());
        for task in &self.tasks {
            task.validate()?;
            if !ids.insert(task.task_id.as_str()) {
                return Err(format!("La tarea {} está duplicada", task.task_id));
            }
        }
        Ok(())
    }
}

impl TaskRecord {
    fn validate(&self) -> Result<(), String> {
        validate_uuid("taskId", &self.task_id)?;
        let title = self.title.trim();
        if title.is_empty() || title.chars().count() > 120 {
            return Err("title debe contener entre 1 y 120 caracteres".into());
        }
        validate_task_timestamp("createdAt", &self.created_at)?;
        validate_task_timestamp("updatedAt", &self.updated_at)?;
        if self.updated_at < self.created_at {
            return Err("updatedAt no puede ser anterior a createdAt".into());
        }

        let pending = matches!(self.status, TaskStatus::Scheduled | TaskStatus::Paused);
        if pending != self.schedule.next_run_at.is_some() {
            return Err("nextRunAt debe existir sólo para tareas programadas o pausadas".into());
        }
        if let Some(next_run_at) = &self.schedule.next_run_at {
            validate_task_timestamp("schedule.nextRunAt", next_run_at)?;
            if next_run_at < &self.created_at {
                return Err("schedule.nextRunAt no puede ser anterior a createdAt".into());
            }
        }
        if self.cancellable != pending {
            return Err("cancellable debe coincidir con un estado programado o pausado".into());
        }

        match (
            self.kind,
            self.scope.kind,
            self.scope.capability_id.as_deref(),
        ) {
            (TaskKind::LocalReminder, TaskScopeKind::LocalNotification, None) => Ok(()),
            (TaskKind::ReadOnlyCheck, TaskScopeKind::CapabilityRead, Some(capability_id)) => {
                validate_capability_id(capability_id)
            }
            (TaskKind::LocalReminder, _, _) => {
                Err("Un recordatorio local sólo puede usar localNotification".into())
            }
            (TaskKind::ReadOnlyCheck, _, _) => Err(
                "Una comprobación de solo lectura requiere capabilityRead y capabilityId".into(),
            ),
        }
    }
}

impl TaskAttemptLedgerDocument {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != TASK_REGISTRY_SCHEMA_VERSION {
            return Err("Versión desconocida del ledger de reservas R7".into());
        }
        if self.attempts.len() > MAX_TASK_ATTEMPTS {
            return Err(format!(
                "El ledger supera el máximo de {MAX_TASK_ATTEMPTS} reservas"
            ));
        }
        let mut ids = HashSet::with_capacity(self.attempts.len());
        let mut keys = HashSet::with_capacity(self.attempts.len());
        for attempt in &self.attempts {
            validate_uuid("attemptId", &attempt.attempt_id)?;
            validate_sha256("idempotencyKey", &attempt.idempotency_key)?;
            validate_uuid("taskId", &attempt.task_id)?;
            validate_uuid("taskRevisionId", &attempt.task_revision_id)?;
            validate_task_timestamp("scheduledFor", &attempt.scheduled_for)?;
            validate_task_timestamp("reservedAt", &attempt.reserved_at)?;
            if attempt.scheduled_for > attempt.reserved_at {
                return Err("Una reserva no puede preceder al vencimiento de la tarea".into());
            }
            if attempt.idempotency_key
                != task_attempt_idempotency_key(&attempt.task_id, &attempt.scheduled_for)
            {
                return Err("El ledger contiene una clave de idempotencia incoherente".into());
            }
            if let Some(operation_id) = &attempt.dispatch_operation_id {
                validate_uuid("dispatchOperationId", operation_id)?;
            }
            if let Some(started_at) = &attempt.dispatch_started_at {
                validate_task_timestamp("dispatchStartedAt", started_at)?;
                if started_at < &attempt.reserved_at {
                    return Err("El despacho no puede preceder a su reserva".into());
                }
            }
            if let Some(finished_at) = &attempt.dispatch_finished_at {
                validate_task_timestamp("dispatchFinishedAt", finished_at)?;
                if attempt
                    .dispatch_started_at
                    .as_ref()
                    .is_none_or(|started_at| finished_at < started_at)
                {
                    return Err("El resultado no puede preceder al despacho".into());
                }
            }
            let dispatch_shape_valid = match attempt.state {
                TaskAttemptState::Reserved => {
                    attempt.dispatch_operation_id.is_none()
                        && attempt.dispatch_started_at.is_none()
                        && attempt.dispatch_finished_at.is_none()
                        && attempt.dispatch_reason.is_none()
                }
                TaskAttemptState::Dispatching => {
                    attempt.dispatch_operation_id.is_some()
                        && attempt.dispatch_started_at.is_some()
                        && attempt.dispatch_finished_at.is_none()
                        && attempt.dispatch_reason.is_none()
                }
                TaskAttemptState::Accepted => {
                    attempt.dispatch_operation_id.is_some()
                        && attempt.dispatch_started_at.is_some()
                        && attempt.dispatch_finished_at.is_some()
                        && attempt.dispatch_reason == Some(TaskDispatchReason::AcceptedByOs)
                }
                TaskAttemptState::Failed => {
                    attempt.dispatch_operation_id.is_some()
                        && attempt.dispatch_started_at.is_some()
                        && attempt.dispatch_finished_at.is_some()
                        && attempt.dispatch_reason == Some(TaskDispatchReason::NotificationError)
                }
            };
            if !dispatch_shape_valid {
                return Err("El ledger contiene un estado de despacho incoherente".into());
            }
            if !ids.insert(attempt.attempt_id.as_str())
                || !keys.insert(attempt.idempotency_key.as_str())
            {
                return Err("El ledger contiene reservas duplicadas".into());
            }
        }
        Ok(())
    }
}

fn validate_uuid(field: &str, value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} debe ser un UUID válido"))?;
    if parsed.hyphenated().to_string() == value {
        Ok(())
    } else {
        Err(format!("{field} debe usar el UUID canónico en minúsculas"))
    }
}

fn validate_task_timestamp(field: &str, value: &str) -> Result<(), String> {
    validate_timestamp(field, value)?;
    if value.len() == 20 && value.ends_with('Z') {
        Ok(())
    } else {
        Err(format!(
            "{field} debe usar UTC canónico YYYY-MM-DDTHH:MM:SSZ"
        ))
    }
}

fn validate_capability_id(value: &str) -> Result<(), String> {
    let valid = (3..=100).contains(&value.len())
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'.' || byte == b'-'
        })
        && value.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        && value.contains('.');
    if valid {
        Ok(())
    } else {
        Err("capabilityId no cumple el identificador cerrado R1".into())
    }
}

fn task_registry_path(data_root: &Path) -> PathBuf {
    data_root.join(TASK_DIRECTORY).join(TASK_FILE)
}

fn task_revision_index_path(data_root: &Path) -> PathBuf {
    data_root
        .join(TASK_DIRECTORY)
        .join(TASK_REVISION_INDEX_FILE)
}

fn task_attempt_ledger_path(data_root: &Path) -> PathBuf {
    data_root
        .join(TASK_DIRECTORY)
        .join(TASK_ATTEMPT_LEDGER_FILE)
}

fn sha256_digest(bytes: impl AsRef<[u8]>) -> String {
    format!(
        "sha256:{}",
        encode_hex_lower(Sha256::digest(bytes.as_ref()))
    )
}

fn task_attempt_idempotency_key(task_id: &str, scheduled_for: &str) -> String {
    sha256_digest(format!("task-attempt-v1\n{task_id}\n{scheduled_for}").as_bytes())
}

fn serialize_json<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn read_registry_source(
    data_root: &Path,
) -> Result<(Option<Vec<u8>>, Option<TaskRegistryDocument>), String> {
    let path = task_registry_path(data_root);
    if !path.exists() {
        return Ok((None, None));
    }
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("No se pudo inspeccionar el registro: {error}"))?;
    if metadata.len() > MAX_TASK_FILE_BYTES {
        return Err(format!(
            "El registro supera el máximo de {MAX_TASK_FILE_BYTES} bytes"
        ));
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("No se pudo leer el registro de tareas: {error}"))?;
    let document = serde_json::from_slice::<TaskRegistryDocument>(&bytes)
        .map_err(|error| format!("El registro no es JSON R7 válido: {error}"))?;
    document.validate()?;
    Ok((Some(bytes), Some(document)))
}

fn read_attempt_ledger(
    data_root: &Path,
) -> Result<Option<(Vec<u8>, TaskAttemptLedgerDocument)>, String> {
    let path = task_attempt_ledger_path(data_root);
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("No se pudo inspeccionar el ledger R7: {error}"))?;
    if metadata.len() > MAX_TASK_FILE_BYTES {
        return Err(format!(
            "El ledger R7 supera el máximo de {MAX_TASK_FILE_BYTES} bytes"
        ));
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("No se pudo leer el ledger R7: {error}"))?;
    let ledger = serde_json::from_slice::<TaskAttemptLedgerDocument>(&bytes)
        .map_err(|error| format!("El ledger de reservas R7 es inválido: {error}"))?;
    ledger.validate()?;
    Ok(Some((bytes, ledger)))
}

pub(crate) fn task_attempt_ledger_snapshot_at(data_root: &Path) -> TaskAttemptLedgerSnapshot {
    match read_attempt_ledger(data_root) {
        Ok(Some((_, ledger))) => {
            let output_performed = ledger
                .attempts
                .iter()
                .any(|attempt| attempt.state == TaskAttemptState::Accepted);
            TaskAttemptLedgerSnapshot {
                schema_version: TASK_REGISTRY_SCHEMA_VERSION,
                state: TaskRegistryState::Ready,
                storage_exists: true,
                reservation_count: ledger.attempts.len(),
                reservations: ledger.attempts,
                error: None,
                notifications_enabled: false,
                output_performed,
            }
        }
        Ok(None) => TaskAttemptLedgerSnapshot {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            state: TaskRegistryState::Missing,
            storage_exists: false,
            reservation_count: 0,
            reservations: Vec::new(),
            error: None,
            notifications_enabled: false,
            output_performed: false,
        },
        Err(error) => TaskAttemptLedgerSnapshot {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            state: TaskRegistryState::Invalid,
            storage_exists: true,
            reservation_count: 0,
            reservations: Vec::new(),
            error: Some(error),
            notifications_enabled: false,
            output_performed: false,
        },
    }
}

fn plan_sha256(plan: &TaskMutationPlan) -> Result<String, String> {
    let mut unsigned = plan.clone();
    unsigned.plan_sha256.clear();
    serde_json::to_vec(&unsigned)
        .map(sha256_digest)
        .map_err(|error| error.to_string())
}

fn validate_plan(plan: &TaskMutationPlan) -> Result<(), String> {
    if plan.schema_version != TASK_REGISTRY_SCHEMA_VERSION {
        return Err("La vista previa usa una versión R7 desconocida".into());
    }
    validate_uuid("planId", &plan.plan_id)?;
    validate_uuid("taskId", &plan.task_id)?;
    validate_uuid("projectedRevisionId", &plan.projected_revision_id)?;
    validate_task_timestamp("plannedAt", &plan.planned_at)?;
    if plan.automatic_execution || plan.writes_performed {
        return Err("La vista previa no puede ejecutar ni declarar escrituras".into());
    }
    if plan.plan_sha256 != plan_sha256(plan)? {
        return Err("La vista previa R7 fue alterada después de ser revisada".into());
    }
    Ok(())
}

fn projected_document(
    current: Option<&TaskRegistryDocument>,
    action: TaskMutationAction,
    task_id: &str,
    title: &str,
    next_run_at: Option<&str>,
    planned_at: &str,
    revision_id: &str,
) -> Result<TaskRegistryDocument, String> {
    let mut document = current.cloned().unwrap_or(TaskRegistryDocument {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        revision_id: revision_id.to_string(),
        tasks: Vec::new(),
    });

    match action {
        TaskMutationAction::ScheduleLocalReminder => {
            if document.tasks.iter().any(|task| task.task_id == task_id) {
                return Err("El taskId propuesto ya existe en el registro".into());
            }
            let next_run_at = next_run_at
                .ok_or("El recordatorio requiere nextRunAt")?
                .to_string();
            document.tasks.push(TaskRecord {
                task_id: task_id.to_string(),
                title: title.to_string(),
                kind: TaskKind::LocalReminder,
                status: TaskStatus::Scheduled,
                created_at: planned_at.to_string(),
                updated_at: planned_at.to_string(),
                schedule: TaskSchedule {
                    kind: TaskScheduleKind::Once,
                    next_run_at: Some(next_run_at),
                },
                scope: TaskScope {
                    kind: TaskScopeKind::LocalNotification,
                    capability_id: None,
                },
                origin: TaskOrigin::OwnerConfirmed,
                cancellable: true,
            });
        }
        TaskMutationAction::CancelTask => {
            let task = document
                .tasks
                .iter_mut()
                .find(|task| task.task_id == task_id)
                .ok_or("La tarea solicitada ya no existe")?;
            if task.title != title {
                return Err("La identidad visible de la tarea cambió desde la vista previa".into());
            }
            match task.status {
                TaskStatus::Scheduled | TaskStatus::Paused => {
                    task.status = TaskStatus::Cancelled;
                    task.updated_at = planned_at.to_string();
                    task.schedule.next_run_at = None;
                    task.cancellable = false;
                }
                TaskStatus::Cancelled => return Ok(document),
                TaskStatus::Completed => {
                    return Err("Una tarea completada no puede cancelarse".into())
                }
            }
        }
    }
    document.revision_id = revision_id.to_string();
    document.validate()?;
    Ok(document)
}

pub(crate) fn preview_task_mutation_at(
    data_root: &Path,
    input: PreviewTaskMutationInput,
    planned_at: String,
) -> Result<TaskMutationPlan, String> {
    validate_task_timestamp("plannedAt", &planned_at)?;
    let (source, current) = read_registry_source(data_root)?;
    let (task_id, title, next_run_at, projected_revision_id) = match input.action {
        TaskMutationAction::ScheduleLocalReminder => {
            let title = input
                .title
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or("El recordatorio requiere un título visible")?;
            if title.chars().count() > 120 {
                return Err("title debe contener entre 1 y 120 caracteres".into());
            }
            let next_run_at = input
                .next_run_at
                .as_deref()
                .ok_or("El recordatorio requiere nextRunAt")?;
            validate_task_timestamp("nextRunAt", next_run_at)?;
            if next_run_at <= planned_at.as_str() {
                return Err("nextRunAt debe ser posterior al momento de la vista previa".into());
            }
            if input.task_id.is_some() {
                return Err(
                    "Un recordatorio nuevo no acepta un taskId elegido externamente".into(),
                );
            }
            (
                Uuid::new_v4().to_string(),
                title.to_string(),
                Some(next_run_at.to_string()),
                Uuid::new_v4().to_string(),
            )
        }
        TaskMutationAction::CancelTask => {
            if input.title.is_some() || input.next_run_at.is_some() {
                return Err("La cancelación sólo acepta taskId".into());
            }
            let task_id = input.task_id.ok_or("La cancelación requiere taskId")?;
            validate_uuid("taskId", &task_id)?;
            let document = current
                .as_ref()
                .ok_or("No existe un registro de tareas que cancelar")?;
            let task = document
                .tasks
                .iter()
                .find(|task| task.task_id == task_id)
                .ok_or("La tarea solicitada no existe")?;
            if task.status == TaskStatus::Completed {
                return Err("Una tarea completada no puede cancelarse".into());
            }
            (
                task_id,
                task.title.clone(),
                task.schedule.next_run_at.clone(),
                if task.status == TaskStatus::Cancelled {
                    document.revision_id.clone()
                } else {
                    Uuid::new_v4().to_string()
                },
            )
        }
    };

    let projected = projected_document(
        current.as_ref(),
        input.action,
        &task_id,
        &title,
        next_run_at.as_deref(),
        &planned_at,
        &projected_revision_id,
    )?;
    let projected_bytes = serialize_json(&projected)?;
    if projected_bytes.len() > MAX_TASK_FILE_BYTES as usize {
        return Err("La proyección R7 excede 1 MiB".into());
    }
    let source_sha256_before = source.as_ref().map(sha256_digest);
    let projected_source_sha256 = sha256_digest(&projected_bytes);
    let writes_required = source_sha256_before.as_deref() != Some(&projected_source_sha256);
    let mut plan = TaskMutationPlan {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        plan_id: Uuid::new_v4().to_string(),
        plan_sha256: String::new(),
        action: input.action,
        planned_at,
        task_id,
        title,
        next_run_at,
        scope: TaskScope {
            kind: TaskScopeKind::LocalNotification,
            capability_id: None,
        },
        source_exists: source.is_some(),
        source_sha256_before,
        projected_revision_id,
        projected_source_sha256,
        record_count_before: current.as_ref().map_or(0, |document| document.tasks.len()),
        record_count_after: projected.tasks.len(),
        backup_required: source.is_some() && writes_required,
        revision_required: writes_required,
        audit_required: writes_required,
        writes_required,
        automatic_execution: false,
        writes_performed: false,
    };
    plan.plan_sha256 = plan_sha256(&plan)?;
    Ok(plan)
}

fn validate_sha256(field: &str, value: &str) -> Result<(), String> {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err(format!("{field} debe usar el prefijo sha256:"));
    };
    if hex.len() == 64 && hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(format!("{field} debe contener 64 caracteres hexadecimales"))
    }
}

impl TaskRevisionIndex {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != TASK_REGISTRY_SCHEMA_VERSION {
            return Err("Versión desconocida del índice de revisiones R7".into());
        }
        validate_uuid("activeRevisionId", &self.active_revision_id)?;
        if self.revisions.is_empty() || self.revisions.len() > MAX_TASK_REVISIONS {
            return Err("El índice R7 tiene una cantidad inválida de revisiones".into());
        }
        let mut ids = HashSet::with_capacity(self.revisions.len());
        for revision in &self.revisions {
            validate_uuid("revisionId", &revision.revision_id)?;
            validate_task_timestamp("createdAt", &revision.created_at)?;
            validate_sha256("taskSubjectSha256", &revision.task_subject_sha256)?;
            validate_sha256("sourceSha256", &revision.source_sha256)?;
            if revision.task_count > MAX_TASKS || !ids.insert(revision.revision_id.as_str()) {
                return Err("El índice R7 contiene una revisión inválida o duplicada".into());
            }
        }
        if self
            .revisions
            .last()
            .is_none_or(|revision| revision.revision_id != self.active_revision_id)
        {
            return Err("La revisión activa R7 no coincide con la última revisión indexada".into());
        }
        Ok(())
    }
}

fn read_revision_index(data_root: &Path) -> Result<Option<(Vec<u8>, TaskRevisionIndex)>, String> {
    let path = task_revision_index_path(data_root);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("No se pudo leer el índice de revisiones R7: {error}"))?;
    if bytes.len() > MAX_TASK_FILE_BYTES as usize {
        return Err("El índice de revisiones R7 excede 1 MiB".into());
    }
    let index = serde_json::from_slice::<TaskRevisionIndex>(&bytes)
        .map_err(|error| format!("El índice de revisiones R7 es inválido: {error}"))?;
    index.validate()?;
    Ok(Some((bytes, index)))
}

fn create_or_verify(path: &Path, bytes: &[u8], label: &str) -> Result<bool, String> {
    if path.exists() {
        let stored =
            fs::read(path).map_err(|error| format!("No se pudo verificar {label}: {error}"))?;
        if stored == bytes {
            return Ok(false);
        }
        return Err(format!("{label} ya existe con contenido diferente"));
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("{label} no tiene carpeta"))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta de {label}: {error}"))?;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|error| format!("No se pudo crear {label}: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
        let _ = fs::remove_file(path);
        return Err(format!("No se pudo persistir {label}: {error}"));
    }
    if fs::read(path).map_err(|error| format!("No se pudo releer {label}: {error}"))? != bytes {
        let _ = fs::remove_file(path);
        return Err(format!("{label} no coincide después de escribirlo"));
    }
    Ok(true)
}

#[cfg(windows)]
fn atomic_replace(path: &Path, bytes: &[u8], label: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{label} no tiene carpeta"))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta de {label}: {error}"))?;
    let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal de {label}: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("No se pudo preparar {label}: {error}"));
    }
    drop(file);
    let temporary_wide = temporary
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let destination_wide = path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            PCWSTR(temporary_wide.as_ptr()),
            PCWSTR(destination_wide.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Falló el reemplazo atómico de {label}: {error}"));
    }
    if fs::read(path).map_err(|error| format!("No se pudo verificar {label}: {error}"))? != bytes {
        return Err(format!("{label} no coincide después del reemplazo"));
    }
    Ok(())
}

#[cfg(not(windows))]
fn atomic_replace(path: &Path, bytes: &[u8], label: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{label} no tiene carpeta"))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta de {label}: {error}"))?;
    let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal de {label}: {error}"))?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("No se pudo preparar {label}: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Falló el reemplazo atómico de {label}: {error}"))
}

fn restore_file(path: &Path, previous: Option<&[u8]>, label: &str) -> Result<(), String> {
    if let Some(bytes) = previous {
        atomic_replace(path, bytes, label)
    } else if path.exists() {
        fs::remove_file(path).map_err(|error| format!("No se pudo retirar {label}: {error}"))
    } else {
        Ok(())
    }
}

pub(crate) fn confirm_task_mutation_at(
    data_root: &Path,
    input: ConfirmTaskMutationInput,
) -> Result<TaskMutationReceipt, String> {
    if !input.confirmed {
        return Err("La mutación R7 requiere confirmación explícita".into());
    }
    let plan = input.plan;
    validate_plan(&plan)?;
    let _guard = TASK_WRITE_LOCK
        .lock()
        .map_err(|_| "El bloqueo de escritura R7 quedó envenenado".to_string())?;
    let (source_before, current) = read_registry_source(data_root)?;
    let current_sha256 = source_before.as_ref().map(sha256_digest);

    if current_sha256.as_deref() == Some(plan.projected_source_sha256.as_str()) {
        let document = current.ok_or("El registro idempotente R7 no pudo releerse")?;
        return Ok(TaskMutationReceipt {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            operation_id: new_operation_id(),
            action: plan.action,
            task_id: plan.task_id,
            revision_id: document.revision_id,
            source_sha256: plan.projected_source_sha256,
            record_count: document.tasks.len(),
            backup_created: false,
            revision_written: false,
            audit_written: false,
            idempotent: true,
            automatic_execution: false,
        });
    }
    if source_before.is_some() != plan.source_exists || current_sha256 != plan.source_sha256_before
    {
        return Err("El registro R7 cambió desde la vista previa; prepará una nueva".into());
    }

    let projected = projected_document(
        current.as_ref(),
        plan.action,
        &plan.task_id,
        &plan.title,
        plan.next_run_at.as_deref(),
        &plan.planned_at,
        &plan.projected_revision_id,
    )?;
    let projected_bytes = serialize_json(&projected)?;
    if sha256_digest(&projected_bytes) != plan.projected_source_sha256
        || projected.tasks.len() != plan.record_count_after
    {
        return Err("La proyección R7 no coincide con la vista previa confirmada".into());
    }
    if !plan.writes_required {
        return Err("La vista previa no requiere una escritura nueva".into());
    }

    let index_before = read_revision_index(data_root)?;
    if let (Some(document), Some((_, index))) = (current.as_ref(), index_before.as_ref()) {
        if index.active_revision_id != document.revision_id {
            return Err("El índice R7 no coincide con la revisión activa".into());
        }
    } else if current.is_some() {
        return Err("El registro R7 existente no tiene un índice de revisiones verificable".into());
    }

    let subject_sha256 = sha256_digest(plan.task_id.as_bytes());
    let revision_entry = TaskRevisionEntry {
        revision_id: plan.projected_revision_id.clone(),
        created_at: plan.planned_at.clone(),
        action: plan.action,
        task_subject_sha256: subject_sha256.clone(),
        source_sha256: plan.projected_source_sha256.clone(),
        task_count: projected.tasks.len(),
    };
    let mut revisions = index_before
        .as_ref()
        .map(|(_, index)| index.revisions.clone())
        .unwrap_or_default();
    revisions.push(revision_entry);
    let projected_index = TaskRevisionIndex {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        active_revision_id: plan.projected_revision_id.clone(),
        revisions,
    };
    projected_index.validate()?;
    let index_bytes = serialize_json(&projected_index)?;
    if index_bytes.len() > MAX_TASK_FILE_BYTES as usize {
        return Err("El índice proyectado R7 excede 1 MiB".into());
    }

    let task_directory = data_root.join(TASK_DIRECTORY);
    let backups = task_directory.join("backups");
    let revisions_directory = task_directory.join("revisions");
    fs::create_dir_all(&task_directory)
        .map_err(|error| format!("No se pudo crear la carpeta R7: {error}"))?;

    let mut backup_created = false;
    let mut backup_path = None;
    if let (Some(bytes), Some(digest)) = (&source_before, &current_sha256) {
        let path = backups.join(format!("tasks-v1-{}.json", &digest[7..]));
        backup_created = create_or_verify(&path, bytes, "respaldo R7")?;
        backup_path = Some(path);
    }
    let revision_path =
        revisions_directory.join(format!("revision-{}.json", plan.projected_revision_id));
    let revision_created = create_or_verify(&revision_path, &projected_bytes, "revisión R7")?;

    let source_path = task_registry_path(data_root);
    let index_path = task_revision_index_path(data_root);
    if let Err(error) = atomic_replace(&source_path, &projected_bytes, "registro activo R7") {
        if revision_created {
            let _ = fs::remove_file(&revision_path);
        }
        return Err(error);
    }
    if let Err(error) = atomic_replace(&index_path, &index_bytes, "índice de revisiones R7") {
        let rollback = restore_file(
            &source_path,
            source_before.as_deref(),
            "registro activo R7 durante rollback",
        );
        if revision_created {
            let _ = fs::remove_file(&revision_path);
        }
        return match rollback {
            Ok(()) => Err(format!("{error}; el registro activo fue restaurado")),
            Err(rollback_error) => Err(format!(
                "{error}; además falló el rollback: {rollback_error}"
            )),
        };
    }

    let operation_id = new_operation_id();
    let (operation, reason_code) = match plan.action {
        TaskMutationAction::ScheduleLocalReminder => {
            ("tasks.reminder.schedule", "TASK_REMINDER_CONFIRMED")
        }
        TaskMutationAction::CancelTask => ("tasks.registry.cancel", "TASK_CANCELLED"),
    };
    let audit = AuditEvent::task_mutation(
        operation_id.clone(),
        operation.into(),
        subject_sha256,
        reason_code,
    )
    .and_then(|event| append_event_at(data_root, &event, AUDIT_MAX_BYTES));
    if let Err(error) = audit {
        let restore_index = restore_file(
            &index_path,
            index_before.as_ref().map(|(bytes, _)| bytes.as_slice()),
            "índice R7 durante rollback",
        );
        let restore_source = restore_file(
            &source_path,
            source_before.as_deref(),
            "registro activo R7 durante rollback",
        );
        if revision_created {
            let _ = fs::remove_file(&revision_path);
        }
        if backup_created {
            if let Some(path) = backup_path {
                let _ = fs::remove_file(path);
            }
        }
        return match (restore_index, restore_source) {
            (Ok(()), Ok(())) => Err(format!(
                "Falló la auditoría R7 y la mutación fue restaurada: {error}"
            )),
            (index_result, source_result) => Err(format!(
                "Falló la auditoría R7 ({error}); rollback índice={index_result:?}, registro={source_result:?}"
            )),
        };
    }

    Ok(TaskMutationReceipt {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        operation_id,
        action: plan.action,
        task_id: plan.task_id,
        revision_id: plan.projected_revision_id,
        source_sha256: plan.projected_source_sha256,
        record_count: projected.tasks.len(),
        backup_created,
        revision_written: true,
        audit_written: true,
        idempotent: false,
        automatic_execution: false,
    })
}

pub(crate) fn reserve_task_attempt_at(
    data_root: &Path,
    input: ReserveTaskAttemptInput,
    reserved_at: String,
) -> Result<TaskAttemptReservationReceipt, String> {
    if !input.confirmed {
        return Err("La reserva R7.3-B requiere confirmación explícita".into());
    }
    validate_uuid("taskId", &input.task_id)?;
    validate_task_timestamp("scheduledFor", &input.scheduled_for)?;
    validate_task_timestamp("reservedAt", &reserved_at)?;
    let _guard = TASK_WRITE_LOCK
        .lock()
        .map_err(|_| "El bloqueo de escritura R7 quedó envenenado".to_string())?;
    let (_, registry) = read_registry_source(data_root)?;
    let registry = registry.ok_or("No existe una tarea local que reservar")?;
    let task = registry
        .tasks
        .iter()
        .find(|task| task.task_id == input.task_id)
        .ok_or("La tarea solicitada ya no existe")?;
    if task.kind != TaskKind::LocalReminder || task.status != TaskStatus::Scheduled {
        return Err("Sólo un recordatorio local programado puede reservar despacho".into());
    }
    let scheduled_for = task
        .schedule
        .next_run_at
        .as_deref()
        .ok_or("La tarea programada perdió nextRunAt")?;
    if scheduled_for != input.scheduled_for {
        return Err("La hora de la tarea cambió; releé el estado antes de reservar".into());
    }
    if scheduled_for > reserved_at.as_str() {
        return Err("La tarea todavía no está vencida y no puede reservarse".into());
    }

    let idempotency_key = task_attempt_idempotency_key(&input.task_id, scheduled_for);
    let previous = read_attempt_ledger(data_root)?;
    if let Some((_, ledger)) = previous.as_ref() {
        if let Some(existing) = ledger
            .attempts
            .iter()
            .find(|attempt| attempt.idempotency_key == idempotency_key)
        {
            return Ok(TaskAttemptReservationReceipt {
                schema_version: TASK_REGISTRY_SCHEMA_VERSION,
                operation_id: new_operation_id(),
                attempt_id: existing.attempt_id.clone(),
                idempotency_key,
                task_id: existing.task_id.clone(),
                task_revision_id: existing.task_revision_id.clone(),
                scheduled_for: existing.scheduled_for.clone(),
                reserved_at: existing.reserved_at.clone(),
                idempotent: true,
                ledger_written: false,
                audit_written: false,
                notification_sent: false,
                output_performed: false,
                task_state_changed: false,
            });
        }
    }

    let mut ledger = previous
        .as_ref()
        .map(|(_, ledger)| ledger.clone())
        .unwrap_or(TaskAttemptLedgerDocument {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            attempts: Vec::new(),
        });
    if ledger.attempts.len() >= MAX_TASK_ATTEMPTS {
        return Err(format!(
            "El ledger alcanzó el máximo de {MAX_TASK_ATTEMPTS} reservas"
        ));
    }
    let attempt = TaskAttemptRecord {
        attempt_id: Uuid::new_v4().to_string(),
        idempotency_key: idempotency_key.clone(),
        task_id: input.task_id,
        task_revision_id: registry.revision_id,
        scheduled_for: scheduled_for.to_string(),
        reserved_at,
        state: TaskAttemptState::Reserved,
        dispatch_operation_id: None,
        dispatch_started_at: None,
        dispatch_finished_at: None,
        dispatch_reason: None,
    };
    ledger.attempts.push(attempt.clone());
    ledger.validate()?;
    let bytes = serialize_json(&ledger)?;
    if bytes.len() > MAX_TASK_FILE_BYTES as usize {
        return Err("El ledger R7 excede 1 MiB".into());
    }
    let ledger_path = task_attempt_ledger_path(data_root);
    let previous_bytes = previous.as_ref().map(|(bytes, _)| bytes.as_slice());
    atomic_replace(&ledger_path, &bytes, "ledger R7")?;

    let audit = AuditEvent::task_reservation(
        new_operation_id(),
        sha256_digest(attempt.task_id.as_bytes()),
    )
    .and_then(|event| append_event_at(data_root, &event, AUDIT_MAX_BYTES));
    if let Err(error) = audit {
        let rollback = restore_file(&ledger_path, previous_bytes, "ledger R7 durante rollback");
        return match rollback {
            Ok(()) => Err(format!(
                "Falló la auditoría R7.3-B y la reserva fue restaurada: {error}"
            )),
            Err(rollback_error) => Err(format!(
                "Falló la auditoría R7.3-B ({error}); rollback={rollback_error}"
            )),
        };
    }
    Ok(TaskAttemptReservationReceipt {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        operation_id: new_operation_id(),
        attempt_id: attempt.attempt_id,
        idempotency_key: attempt.idempotency_key,
        task_id: attempt.task_id,
        task_revision_id: attempt.task_revision_id,
        scheduled_for: attempt.scheduled_for,
        reserved_at: attempt.reserved_at,
        idempotent: false,
        ledger_written: true,
        audit_written: true,
        notification_sent: false,
        output_performed: false,
        task_state_changed: false,
    })
}

fn dispatch_task_notification_at<N, C>(
    data_root: &Path,
    input: DispatchTaskNotificationInput,
    started_at: String,
    notifier: N,
    finished_clock: C,
) -> Result<TaskNotificationReceipt, String>
where
    N: FnOnce(&str) -> Result<(), String>,
    C: FnOnce() -> Result<String, String>,
{
    if !input.confirmed {
        return Err("El despacho R7.4 requiere confirmación explícita".into());
    }
    validate_uuid("attemptId", &input.attempt_id)?;
    validate_sha256("idempotencyKey", &input.idempotency_key)?;
    validate_task_timestamp("dispatchStartedAt", &started_at)?;
    let _guard = TASK_WRITE_LOCK
        .lock()
        .map_err(|_| "El bloqueo de escritura R7 quedó envenenado".to_string())?;
    let (_, registry) = read_registry_source(data_root)?;
    let registry = registry.ok_or("No existe el registro de la tarea reservada")?;
    let previous =
        read_attempt_ledger(data_root)?.ok_or("No existe un ledger de reservas que despachar")?;
    let mut ledger = previous.1.clone();
    let attempt_index = ledger
        .attempts
        .iter()
        .position(|attempt| attempt.attempt_id == input.attempt_id)
        .ok_or("La reserva solicitada no existe")?;
    if ledger.attempts[attempt_index].idempotency_key != input.idempotency_key {
        return Err("La clave de idempotencia no corresponde a la reserva".into());
    }
    let existing = &ledger.attempts[attempt_index];
    if matches!(
        existing.state,
        TaskAttemptState::Accepted | TaskAttemptState::Failed
    ) {
        let reason = existing
            .dispatch_reason
            .ok_or("El resultado terminal perdió su motivo")?;
        return Ok(TaskNotificationReceipt {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            operation_id: existing
                .dispatch_operation_id
                .clone()
                .ok_or("El resultado terminal perdió operationId")?,
            attempt_id: existing.attempt_id.clone(),
            task_id: existing.task_id.clone(),
            state: existing.state,
            dispatch_reason: reason,
            dispatch_started_at: existing
                .dispatch_started_at
                .clone()
                .ok_or("El resultado terminal perdió su inicio")?,
            dispatch_finished_at: existing
                .dispatch_finished_at
                .clone()
                .ok_or("El resultado terminal perdió su cierre")?,
            notification_accepted: existing.state == TaskAttemptState::Accepted,
            audit_written: false,
            idempotent: true,
            network_used: false,
            process_spawned: false,
            task_state_changed: false,
        });
    }
    if existing.state == TaskAttemptState::Dispatching {
        return Err(
            "La reserva quedó en despacho incierto; se bloquea el reintento para evitar duplicados"
                .into(),
        );
    }
    let task = registry
        .tasks
        .iter()
        .find(|task| task.task_id == existing.task_id)
        .ok_or("La tarea reservada ya no existe")?;
    if task.kind != TaskKind::LocalReminder || task.status != TaskStatus::Scheduled {
        return Err("La tarea fue pausada, cancelada o cerrada; no puede despacharse".into());
    }
    if task.schedule.next_run_at.as_deref() != Some(existing.scheduled_for.as_str()) {
        return Err("La programación cambió después de reservar; el despacho fue bloqueado".into());
    }
    if existing.scheduled_for > started_at {
        return Err("La reserva todavía no está vencida".into());
    }

    let operation_id = new_operation_id();
    let subject_digest = sha256_digest(existing.task_id.as_bytes());
    {
        let attempt = &mut ledger.attempts[attempt_index];
        attempt.state = TaskAttemptState::Dispatching;
        attempt.dispatch_operation_id = Some(operation_id.clone());
        attempt.dispatch_started_at = Some(started_at.clone());
    }
    ledger.validate()?;
    let ledger_path = task_attempt_ledger_path(data_root);
    let dispatching_bytes = serialize_json(&ledger)?;
    atomic_replace(&ledger_path, &dispatching_bytes, "ledger R7.4 en despacho")?;
    let start_audit = AuditEvent::task_notification(
        operation_id.clone(),
        AuditOutcome::Pending,
        subject_digest.clone(),
        "TASK_NOTIFICATION_STARTED",
    )
    .and_then(|event| append_event_at(data_root, &event, AUDIT_MAX_BYTES));
    if let Err(error) = start_audit {
        restore_file(
            &ledger_path,
            Some(previous.0.as_slice()),
            "ledger R7.4 durante rollback",
        )?;
        return Err(format!(
            "No se pudo auditar el inicio; la reserva fue restaurada: {error}"
        ));
    }

    let notification = notifier(&task.title);
    let finished_at = finished_clock()?;
    validate_task_timestamp("dispatchFinishedAt", &finished_at)?;
    let (state, reason, outcome, reason_code) = if notification.is_ok() {
        (
            TaskAttemptState::Accepted,
            TaskDispatchReason::AcceptedByOs,
            AuditOutcome::Success,
            "TASK_NOTIFICATION_ACCEPTED",
        )
    } else {
        (
            TaskAttemptState::Failed,
            TaskDispatchReason::NotificationError,
            AuditOutcome::Error,
            "TASK_NOTIFICATION_FAILED",
        )
    };
    {
        let attempt = &mut ledger.attempts[attempt_index];
        attempt.state = state;
        attempt.dispatch_finished_at = Some(finished_at.clone());
        attempt.dispatch_reason = Some(reason);
    }
    ledger.validate()?;
    let terminal_bytes = serialize_json(&ledger)?;
    atomic_replace(
        &ledger_path,
        &terminal_bytes,
        "resultado de notificación R7.4",
    )?;
    let audit_written =
        AuditEvent::task_notification(operation_id.clone(), outcome, subject_digest, reason_code)
            .and_then(|event| append_event_at(data_root, &event, AUDIT_MAX_BYTES))
            .is_ok();

    Ok(TaskNotificationReceipt {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        operation_id,
        attempt_id: input.attempt_id,
        task_id: task.task_id.clone(),
        state,
        dispatch_reason: reason,
        dispatch_started_at: started_at,
        dispatch_finished_at: finished_at,
        notification_accepted: state == TaskAttemptState::Accepted,
        audit_written,
        idempotent: false,
        network_used: false,
        process_spawned: false,
        task_state_changed: false,
    })
}

fn missing_snapshot() -> TaskRegistrySnapshot {
    TaskRegistrySnapshot {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        state: TaskRegistryState::Missing,
        storage_exists: false,
        task_count: 0,
        scheduled_count: 0,
        paused_count: 0,
        completed_count: 0,
        cancelled_count: 0,
        tasks: Vec::new(),
        error: None,
        automatic_execution: false,
    }
}

fn invalid_snapshot(error: String) -> TaskRegistrySnapshot {
    TaskRegistrySnapshot {
        state: TaskRegistryState::Invalid,
        storage_exists: true,
        error: Some(error),
        ..missing_snapshot()
    }
}

fn ready_snapshot(document: TaskRegistryDocument) -> TaskRegistrySnapshot {
    let scheduled_count = document
        .tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Scheduled)
        .count();
    let paused_count = document
        .tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Paused)
        .count();
    let completed_count = document
        .tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Completed)
        .count();
    let cancelled_count = document
        .tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Cancelled)
        .count();
    TaskRegistrySnapshot {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        state: TaskRegistryState::Ready,
        storage_exists: true,
        task_count: document.tasks.len(),
        scheduled_count,
        paused_count,
        completed_count,
        cancelled_count,
        tasks: document.tasks,
        error: None,
        automatic_execution: false,
    }
}

pub(crate) fn task_registry_snapshot_at(data_root: &Path) -> TaskRegistrySnapshot {
    let path = task_registry_path(data_root);
    if !path.exists() {
        return missing_snapshot();
    }
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) => {
            return invalid_snapshot(format!("No se pudo inspeccionar el registro: {error}"))
        }
    };
    if metadata.len() > MAX_TASK_FILE_BYTES {
        return invalid_snapshot(format!(
            "El registro supera el máximo de {MAX_TASK_FILE_BYTES} bytes"
        ));
    }
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) => return invalid_snapshot(format!("No se pudo leer el registro: {error}")),
    };
    let document = match serde_json::from_str::<TaskRegistryDocument>(&content) {
        Ok(document) => document,
        Err(error) => {
            return invalid_snapshot(format!("El registro no es JSON R7 válido: {error}"))
        }
    };
    match document.validate() {
        Ok(()) => ready_snapshot(document),
        Err(error) => invalid_snapshot(error),
    }
}

fn task_engine_snapshot_at(
    data_root: &Path,
    evaluated_at: String,
    background_enabled: bool,
    last_background_evaluation_at: Option<String>,
    runtime_error: Option<String>,
) -> Result<TaskEngineSnapshot, String> {
    validate_task_timestamp("evaluatedAt", &evaluated_at)?;
    let registry = task_registry_snapshot_at(data_root);
    let mut items = Vec::with_capacity(registry.tasks.len());
    let mut waiting_count = 0;
    let mut due_count = 0;
    let mut excluded_count = 0;
    let mut next_wake_at: Option<String> = None;

    if registry.state == TaskRegistryState::Ready {
        for task in registry.tasks {
            let (temporal_state, reason) = match task.status {
                TaskStatus::Scheduled => {
                    let scheduled_for = task
                        .schedule
                        .next_run_at
                        .as_deref()
                        .ok_or("Una tarea programada perdió nextRunAt")?;
                    if scheduled_for <= evaluated_at.as_str() {
                        due_count += 1;
                        (TaskTemporalState::Due, None)
                    } else {
                        waiting_count += 1;
                        if next_wake_at
                            .as_deref()
                            .is_none_or(|current| scheduled_for < current)
                        {
                            next_wake_at = Some(scheduled_for.to_string());
                        }
                        (TaskTemporalState::Waiting, None)
                    }
                }
                TaskStatus::Paused => {
                    excluded_count += 1;
                    (
                        TaskTemporalState::Excluded,
                        Some(TaskTemporalReason::Paused),
                    )
                }
                TaskStatus::Completed => {
                    excluded_count += 1;
                    (
                        TaskTemporalState::Excluded,
                        Some(TaskTemporalReason::Completed),
                    )
                }
                TaskStatus::Cancelled => {
                    excluded_count += 1;
                    (
                        TaskTemporalState::Excluded,
                        Some(TaskTemporalReason::Cancelled),
                    )
                }
            };
            items.push(TaskTemporalEntry {
                task_id: task.task_id,
                title: task.title,
                kind: task.kind,
                registry_status: task.status,
                scheduled_for: task.schedule.next_run_at,
                temporal_state,
                reason,
            });
        }
    }

    Ok(TaskEngineSnapshot {
        schema_version: TASK_REGISTRY_SCHEMA_VERSION,
        registry_state: registry.state,
        evaluated_at,
        background_enabled,
        last_background_evaluation_at,
        waiting_count,
        due_count,
        excluded_count,
        next_wake_at,
        items,
        error: registry.error.or(runtime_error),
        automatic_execution: false,
        notifications_enabled: false,
        writes_performed: false,
    })
}

pub(crate) fn spawn_task_engine_thread(store: TaskEngineStore, app: AppHandle) {
    let weak = store.weak();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let Some(inner) = weak.upgrade() else {
            break;
        };
        let enabled = match inner.lock() {
            Ok(runtime) => runtime.enabled,
            Err(_) => break,
        };
        if !enabled {
            continue;
        }

        let evaluation = alice_data_root_path(&app).and_then(|data_root| {
            let evaluated_at = current_utc_timestamp()?;
            task_engine_snapshot_at(&data_root, evaluated_at, true, None, None)
        });
        let mut runtime = match inner.lock() {
            Ok(runtime) => runtime,
            Err(_) => break,
        };
        if !runtime.enabled {
            continue;
        }
        match evaluation {
            Ok(snapshot) => {
                runtime.last_background_evaluation_at = Some(snapshot.evaluated_at);
                runtime.last_error = snapshot.error;
            }
            Err(error) => runtime.last_error = Some(error),
        }
    });
}

pub(crate) fn task_capability_probe(data_root: &Path) -> TaskCapabilityProbe {
    let snapshot = task_registry_snapshot_at(data_root);
    TaskCapabilityProbe {
        state: snapshot.state,
        task_count: snapshot.task_count,
    }
}

#[tauri::command]
pub(crate) fn task_engine_status(
    store: State<TaskEngineStore>,
    app: AppHandle,
) -> Result<TaskEngineSnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    let (enabled, last_evaluation, runtime_error) = store.status()?;
    task_engine_snapshot_at(
        &data_root,
        current_utc_timestamp()?,
        enabled,
        last_evaluation,
        runtime_error,
    )
}

#[tauri::command]
pub(crate) fn set_task_engine_enabled(
    store: State<TaskEngineStore>,
    app: AppHandle,
    input: SetTaskEngineEnabledInput,
) -> Result<TaskEngineSnapshot, String> {
    store.set_enabled(input.enabled)?;
    task_engine_status(store, app)
}

#[tauri::command]
pub(crate) fn task_registry_status(app: AppHandle) -> Result<TaskRegistrySnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    Ok(task_registry_snapshot_at(&data_root))
}

#[tauri::command]
pub(crate) fn task_attempt_ledger_status(
    app: AppHandle,
) -> Result<TaskAttemptLedgerSnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    Ok(task_attempt_ledger_snapshot_at(&data_root))
}

#[tauri::command]
pub(crate) fn reserve_task_attempt(
    app: AppHandle,
    input: ReserveTaskAttemptInput,
) -> Result<TaskAttemptReservationReceipt, String> {
    let data_root = alice_data_root_path(&app)?;
    reserve_task_attempt_at(&data_root, input, current_utc_timestamp()?)
}

#[tauri::command]
pub(crate) fn dispatch_task_notification(
    app: AppHandle,
    input: DispatchTaskNotificationInput,
) -> Result<TaskNotificationReceipt, String> {
    let data_root = alice_data_root_path(&app)?;
    let notifier_app = app.clone();
    dispatch_task_notification_at(
        &data_root,
        input,
        current_utc_timestamp()?,
        move |body| {
            notifier_app
                .notification()
                .builder()
                .title("Alice · Recordatorio")
                .body(body)
                .show()
                .map_err(|error| format!("El sistema operativo rechazó la notificación: {error}"))
        },
        current_utc_timestamp,
    )
}

#[tauri::command]
pub(crate) fn preview_task_mutation(
    app: AppHandle,
    input: PreviewTaskMutationInput,
) -> Result<TaskMutationPlan, String> {
    let data_root = alice_data_root_path(&app)?;
    preview_task_mutation_at(&data_root, input, current_utc_timestamp()?)
}

#[tauri::command]
pub(crate) fn confirm_task_mutation(
    app: AppHandle,
    input: ConfirmTaskMutationInput,
) -> Result<TaskMutationReceipt, String> {
    let data_root = alice_data_root_path(&app)?;
    confirm_task_mutation_at(&data_root, input)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::util::encode_hex_lower;
    use serde_json::json;
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "alice-r7-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ))
    }

    fn scheduled_reminder() -> TaskRecord {
        TaskRecord {
            task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
            title: "Recordar revisar el Roadmap".into(),
            kind: TaskKind::LocalReminder,
            status: TaskStatus::Scheduled,
            created_at: "2026-09-01T21:30:00Z".into(),
            updated_at: "2026-09-01T21:30:00Z".into(),
            schedule: TaskSchedule {
                kind: TaskScheduleKind::Once,
                next_run_at: Some("2026-09-02T18:00:00Z".into()),
            },
            scope: TaskScope {
                kind: TaskScopeKind::LocalNotification,
                capability_id: None,
            },
            origin: TaskOrigin::OwnerConfirmed,
            cancellable: true,
        }
    }

    fn document(tasks: Vec<TaskRecord>) -> TaskRegistryDocument {
        TaskRegistryDocument {
            schema_version: TASK_REGISTRY_SCHEMA_VERSION,
            revision_id: "0c39b61b-83b9-4f02-a06f-7c6ea9640b71".into(),
            tasks,
        }
    }

    fn file_hashes(root: &Path) -> BTreeMap<PathBuf, String> {
        fn visit(root: &Path, current: &Path, hashes: &mut BTreeMap<PathBuf, String>) {
            let mut entries = fs::read_dir(current)
                .expect("read canonical directory")
                .collect::<Result<Vec<_>, _>>()
                .expect("collect canonical entries");
            entries.sort_by_key(std::fs::DirEntry::path);
            for entry in entries {
                let path = entry.path();
                if path.is_dir() {
                    visit(root, &path, hashes);
                } else if path.is_file() {
                    let bytes = fs::read(&path).expect("read canonical file");
                    hashes.insert(
                        path.strip_prefix(root)
                            .expect("relative path")
                            .to_path_buf(),
                        encode_hex_lower(Sha256::digest(bytes)),
                    );
                }
            }
        }

        let mut hashes = BTreeMap::new();
        if root.exists() {
            visit(root, root, &mut hashes);
        }
        hashes
    }

    #[test]
    fn missing_registry_is_read_only_and_does_not_create_the_data_root() {
        let root = temporary_root("missing");
        assert!(!root.exists());

        let snapshot = task_registry_snapshot_at(&root);

        assert_eq!(snapshot.state, TaskRegistryState::Missing);
        assert_eq!(snapshot.task_count, 0);
        assert!(!snapshot.storage_exists);
        assert!(!snapshot.automatic_execution);
        assert!(!root.exists());
    }

    #[test]
    fn real_json_registry_is_read_without_modifying_its_bytes() {
        let root = temporary_root("valid");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        let path = directory.join(TASK_FILE);
        let content = serde_json::to_vec_pretty(&document(vec![scheduled_reminder()]))
            .expect("serialize fixture");
        fs::write(&path, &content).expect("write fixture");

        let snapshot = task_registry_snapshot_at(&root);

        assert_eq!(snapshot.state, TaskRegistryState::Ready);
        assert_eq!(snapshot.task_count, 1);
        assert_eq!(snapshot.scheduled_count, 1);
        assert_eq!(
            snapshot.tasks[0].scope.kind,
            TaskScopeKind::LocalNotification
        );
        assert!(!snapshot.automatic_execution);
        assert_eq!(fs::read(&path).expect("read fixture"), content);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn closed_schema_rejects_unknown_fields_and_corrupt_files_without_repair() {
        let mut value = serde_json::to_value(document(vec![scheduled_reminder()])).unwrap();
        value["tasks"][0]["command"] = json!("powershell.exe");
        assert!(serde_json::from_value::<TaskRegistryDocument>(value).is_err());

        let root = temporary_root("corrupt");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        let path = directory.join(TASK_FILE);
        let content = b"{not-json";
        fs::write(&path, content).expect("write corrupt fixture");

        let snapshot = task_registry_snapshot_at(&root);

        assert_eq!(snapshot.state, TaskRegistryState::Invalid);
        assert!(snapshot.error.is_some());
        assert_eq!(fs::read(&path).expect("read corrupt fixture"), content);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn task_identity_and_lifecycle_invariants_are_strict() {
        let task = scheduled_reminder();
        let mut duplicate = task.clone();
        duplicate.title = "Otro recordatorio".into();
        assert!(document(vec![task.clone(), duplicate])
            .validate()
            .unwrap_err()
            .contains("duplicada"));

        let mut completed = task.clone();
        completed.status = TaskStatus::Completed;
        completed.cancellable = false;
        completed.schedule.next_run_at = None;
        assert!(document(vec![completed]).validate().is_ok());

        let mut incoherent = task;
        incoherent.status = TaskStatus::Cancelled;
        assert!(document(vec![incoherent]).validate().is_err());

        let mut noncanonical = scheduled_reminder();
        noncanonical.task_id = noncanonical.task_id.to_uppercase();
        assert!(document(vec![noncanonical]).validate().is_err());

        let mut past = scheduled_reminder();
        past.schedule.next_run_at = Some("2026-08-31T21:30:00Z".into());
        assert!(document(vec![past]).validate().is_err());

        let mut offset = scheduled_reminder();
        offset.created_at = "2026-09-01T18:30:00-03:00".into();
        assert!(document(vec![offset]).validate().is_err());
    }

    #[test]
    fn oversized_registry_is_blocked_without_reading_or_rewriting_it() {
        let root = temporary_root("oversized");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        let path = directory.join(TASK_FILE);
        let content = vec![b' '; MAX_TASK_FILE_BYTES as usize + 1];
        fs::write(&path, &content).expect("write oversized fixture");

        let snapshot = task_registry_snapshot_at(&root);

        assert_eq!(snapshot.state, TaskRegistryState::Invalid);
        assert!(snapshot
            .error
            .as_deref()
            .is_some_and(|error| error.contains("máximo")));
        assert_eq!(
            fs::metadata(&path).expect("fixture metadata").len(),
            content.len() as u64
        );
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn reminder_and_read_only_check_have_distinct_closed_scopes() {
        let reminder = scheduled_reminder();
        assert!(reminder.validate().is_ok());

        let mut check = reminder.clone();
        check.task_id = "cbf277b9-2ca2-4ad1-aa64-4bdb83ff2950".into();
        check.kind = TaskKind::ReadOnlyCheck;
        check.scope = TaskScope {
            kind: TaskScopeKind::CapabilityRead,
            capability_id: Some("context.foreground.read".into()),
        };
        assert!(check.validate().is_ok());

        check.scope.capability_id = Some("PowerShell free form".into());
        assert!(check.validate().is_err());
    }

    fn schedule_input(title: &str) -> PreviewTaskMutationInput {
        PreviewTaskMutationInput {
            action: TaskMutationAction::ScheduleLocalReminder,
            title: Some(title.into()),
            next_run_at: Some("2026-09-03T18:00:00Z".into()),
            task_id: None,
        }
    }

    #[test]
    fn preview_is_read_only_and_confirmation_persists_audited_revision() {
        let root = temporary_root("mutation");
        let title = "Recordar revisar el Roadmap real";
        let plan =
            preview_task_mutation_at(&root, schedule_input(title), "2026-09-02T12:00:00Z".into())
                .expect("preview reminder");

        assert!(!root.exists());
        assert!(!plan.source_exists);
        assert!(plan.writes_required);
        assert!(!plan.automatic_execution);
        assert!(!plan.writes_performed);
        validate_plan(&plan).expect("bound plan");

        let receipt = confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: plan.clone(),
                confirmed: true,
            },
        )
        .expect("confirm reminder");
        assert!(!receipt.idempotent);
        assert!(receipt.revision_written);
        assert!(receipt.audit_written);
        assert!(!receipt.automatic_execution);

        let snapshot = task_registry_snapshot_at(&root);
        assert_eq!(snapshot.state, TaskRegistryState::Ready);
        assert_eq!(snapshot.scheduled_count, 1);
        assert_eq!(snapshot.tasks[0].title, title);
        let index = read_revision_index(&root)
            .expect("read index")
            .expect("index exists")
            .1;
        assert_eq!(index.revisions.len(), 1);
        assert_eq!(index.active_revision_id, receipt.revision_id);
        let audit =
            fs::read_to_string(root.join("audit").join("events-v1.jsonl")).expect("read audit");
        assert!(audit.contains("TASK_REMINDER_CONFIRMED"));
        assert!(!audit.contains(title));

        let retry = confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan,
                confirmed: true,
            },
        )
        .expect("idempotent retry");
        assert!(retry.idempotent);
        assert!(!retry.audit_written);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn explicit_cancellation_is_audited_backed_up_and_idempotent() {
        let root = temporary_root("cancel");
        let create = preview_task_mutation_at(
            &root,
            schedule_input("Recordatorio cancelable"),
            "2026-09-02T12:00:00Z".into(),
        )
        .unwrap();
        confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: create.clone(),
                confirmed: true,
            },
        )
        .unwrap();

        let cancel = preview_task_mutation_at(
            &root,
            PreviewTaskMutationInput {
                action: TaskMutationAction::CancelTask,
                title: None,
                next_run_at: None,
                task_id: Some(create.task_id.clone()),
            },
            "2026-09-02T12:05:00Z".into(),
        )
        .expect("preview cancellation");
        assert!(cancel.backup_required);
        let receipt = confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: cancel.clone(),
                confirmed: true,
            },
        )
        .expect("confirm cancellation");
        assert!(receipt.backup_created);
        let snapshot = task_registry_snapshot_at(&root);
        assert_eq!(snapshot.cancelled_count, 1);
        assert_eq!(snapshot.scheduled_count, 0);
        assert!(!snapshot.tasks[0].cancellable);
        assert!(snapshot.tasks[0].schedule.next_run_at.is_none());

        let retry = confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: cancel,
                confirmed: true,
            },
        )
        .expect("idempotent cancellation retry");
        assert!(retry.idempotent);
        let index = read_revision_index(&root).unwrap().unwrap().1;
        assert_eq!(index.revisions.len(), 2);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn confirmation_rejects_unconfirmed_tampered_and_stale_plans() {
        let root = temporary_root("guarded");
        let plan = preview_task_mutation_at(
            &root,
            schedule_input("Plan protegido"),
            "2026-09-02T12:00:00Z".into(),
        )
        .unwrap();
        let error = confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: plan.clone(),
                confirmed: false,
            },
        )
        .unwrap_err();
        assert!(error.contains("confirmación explícita"));
        assert!(!root.exists());

        let mut tampered = plan.clone();
        tampered.title = "Otro contenido".into();
        assert!(confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: tampered,
                confirmed: true,
            },
        )
        .unwrap_err()
        .contains("alterada"));

        let competing = preview_task_mutation_at(
            &root,
            schedule_input("Otra tarea"),
            "2026-09-02T12:01:00Z".into(),
        )
        .unwrap();
        confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan: competing,
                confirmed: true,
            },
        )
        .unwrap();
        assert!(confirm_task_mutation_at(
            &root,
            ConfirmTaskMutationInput {
                plan,
                confirmed: true,
            },
        )
        .unwrap_err()
        .contains("cambió desde la vista previa"));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn temporal_engine_classifies_due_waiting_and_excluded_without_writing() {
        let root = temporary_root("temporal-engine");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");

        let due = scheduled_reminder();
        let mut waiting = scheduled_reminder();
        waiting.task_id = "26e040be-b3d9-46e8-b04a-e20569dfab57".into();
        waiting.title = "Esperar hasta más tarde".into();
        waiting.schedule.next_run_at = Some("2026-09-02T20:00:00Z".into());
        let mut paused = scheduled_reminder();
        paused.task_id = "86194a6a-ab45-46a9-8af3-05dd837b6783".into();
        paused.title = "Pausa explícita".into();
        paused.status = TaskStatus::Paused;
        let mut completed = scheduled_reminder();
        completed.task_id = "e4d61366-3439-456e-bf21-f4e0f2dbf332".into();
        completed.title = "Resultado ya registrado".into();
        completed.status = TaskStatus::Completed;
        completed.schedule.next_run_at = None;
        completed.cancellable = false;
        let mut cancelled = completed.clone();
        cancelled.task_id = "c7191be0-623f-4810-90c1-8e4ef274dfc5".into();
        cancelled.title = "Intención retirada".into();
        cancelled.status = TaskStatus::Cancelled;

        let path = directory.join(TASK_FILE);
        let bytes = serialize_json(&document(vec![due, waiting, paused, completed, cancelled]))
            .expect("serialize fixture");
        fs::write(&path, &bytes).expect("write fixture");

        let snapshot =
            task_engine_snapshot_at(&root, "2026-09-02T19:00:00Z".into(), false, None, None)
                .expect("evaluate temporal state");

        assert_eq!(snapshot.registry_state, TaskRegistryState::Ready);
        assert_eq!(snapshot.due_count, 1);
        assert_eq!(snapshot.waiting_count, 1);
        assert_eq!(snapshot.excluded_count, 3);
        assert_eq!(
            snapshot.next_wake_at.as_deref(),
            Some("2026-09-02T20:00:00Z")
        );
        assert_eq!(snapshot.items[0].temporal_state, TaskTemporalState::Due);
        assert_eq!(snapshot.items[1].temporal_state, TaskTemporalState::Waiting);
        assert_eq!(snapshot.items[2].reason, Some(TaskTemporalReason::Paused));
        assert_eq!(
            snapshot.items[3].reason,
            Some(TaskTemporalReason::Completed)
        );
        assert_eq!(
            snapshot.items[4].reason,
            Some(TaskTemporalReason::Cancelled)
        );
        assert!(!snapshot.background_enabled);
        assert!(!snapshot.automatic_execution);
        assert!(!snapshot.notifications_enabled);
        assert!(!snapshot.writes_performed);
        assert_eq!(fs::read(&path).expect("reread fixture"), bytes);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn temporal_engine_missing_state_does_not_create_storage() {
        let root = temporary_root("temporal-missing");
        let snapshot =
            task_engine_snapshot_at(&root, "2026-09-02T19:00:00Z".into(), false, None, None)
                .expect("evaluate missing registry");

        assert_eq!(snapshot.registry_state, TaskRegistryState::Missing);
        assert!(snapshot.items.is_empty());
        assert_eq!(snapshot.due_count, 0);
        assert!(!root.exists());
    }

    #[test]
    fn due_reservation_is_durable_idempotent_and_does_not_change_the_task() {
        let root = temporary_root("attempt-ledger");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        let source_path = directory.join(TASK_FILE);
        let source =
            serialize_json(&document(vec![scheduled_reminder()])).expect("serialize registry");
        fs::write(&source_path, &source).expect("write fixture registry");
        let input = ReserveTaskAttemptInput {
            task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
            scheduled_for: "2026-09-02T18:00:00Z".into(),
            confirmed: true,
        };

        let first = reserve_task_attempt_at(&root, input.clone(), "2026-09-02T19:00:00Z".into())
            .expect("reserve due occurrence");
        assert!(first.ledger_written);
        assert!(first.audit_written);
        assert!(!first.notification_sent);
        assert!(!first.output_performed);
        assert!(!first.task_state_changed);
        assert_eq!(fs::read(&source_path).expect("reread registry"), source);
        let snapshot = task_attempt_ledger_snapshot_at(&root);
        assert_eq!(snapshot.state, TaskRegistryState::Ready);
        assert_eq!(snapshot.reservation_count, 1);
        assert!(!snapshot.notifications_enabled);
        assert!(!snapshot.output_performed);

        let retry = reserve_task_attempt_at(&root, input, "2026-09-02T19:01:00Z".into())
            .expect("retry same occurrence");
        assert!(retry.idempotent);
        assert!(!retry.ledger_written);
        assert!(!retry.audit_written);
        assert_eq!(retry.attempt_id, first.attempt_id);
        assert_eq!(
            fs::read(&source_path).expect("registry remains immutable"),
            source
        );
        let audit =
            fs::read_to_string(root.join("audit").join("events-v1.jsonl")).expect("read audit");
        assert_eq!(audit.matches("TASK_DISPATCH_RESERVED").count(), 1);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn reservation_rejects_future_or_unconfirmed_occurrences_without_writing() {
        let root = temporary_root("attempt-guards");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        fs::write(
            directory.join(TASK_FILE),
            serialize_json(&document(vec![scheduled_reminder()])).unwrap(),
        )
        .expect("write fixture registry");
        let input = ReserveTaskAttemptInput {
            task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
            scheduled_for: "2026-09-02T18:00:00Z".into(),
            confirmed: false,
        };
        assert!(
            reserve_task_attempt_at(&root, input, "2026-09-02T19:00:00Z".into())
                .unwrap_err()
                .contains("confirmación explícita")
        );
        let future = ReserveTaskAttemptInput {
            task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
            scheduled_for: "2026-09-02T18:00:00Z".into(),
            confirmed: true,
        };
        assert!(
            reserve_task_attempt_at(&root, future, "2026-09-02T17:59:59Z".into())
                .unwrap_err()
                .contains("todavía no está vencida")
        );
        assert!(!task_attempt_ledger_path(&root).exists());
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn notification_dispatch_is_terminal_audited_and_idempotent() {
        let root = temporary_root("notification-success");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        fs::write(
            directory.join(TASK_FILE),
            serialize_json(&document(vec![scheduled_reminder()])).unwrap(),
        )
        .expect("write registry");
        let reservation = reserve_task_attempt_at(
            &root,
            ReserveTaskAttemptInput {
                task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
                scheduled_for: "2026-09-02T18:00:00Z".into(),
                confirmed: true,
            },
            "2026-09-02T19:00:00Z".into(),
        )
        .expect("reserve occurrence");
        let dispatch = DispatchTaskNotificationInput {
            attempt_id: reservation.attempt_id.clone(),
            idempotency_key: reservation.idempotency_key.clone(),
            confirmed: true,
        };
        let body_seen = std::cell::RefCell::new(String::new());
        let receipt = dispatch_task_notification_at(
            &root,
            dispatch.clone(),
            "2026-09-02T19:01:00Z".into(),
            |body| {
                body_seen.replace(body.to_string());
                Ok(())
            },
            || Ok("2026-09-02T19:01:01Z".into()),
        )
        .expect("deliver notification");
        assert_eq!(body_seen.borrow().as_str(), "Recordar revisar el Roadmap");
        assert_eq!(receipt.state, TaskAttemptState::Accepted);
        assert!(receipt.notification_accepted);
        assert!(receipt.audit_written);
        assert!(!receipt.network_used);
        assert!(!receipt.process_spawned);
        let snapshot = task_attempt_ledger_snapshot_at(&root);
        assert!(snapshot.output_performed);
        assert!(!snapshot.notifications_enabled);

        let retry = dispatch_task_notification_at(
            &root,
            dispatch,
            "2026-09-02T19:02:00Z".into(),
            |_| panic!("an accepted occurrence must not notify twice"),
            || panic!("an accepted occurrence must not open a new result"),
        )
        .expect("idempotent terminal receipt");
        assert!(retry.idempotent);
        assert_eq!(retry.operation_id, receipt.operation_id);
        let audit =
            fs::read_to_string(root.join("audit").join("events-v1.jsonl")).expect("read audit");
        assert_eq!(audit.matches("TASK_NOTIFICATION_STARTED").count(), 1);
        assert_eq!(audit.matches("TASK_NOTIFICATION_ACCEPTED").count(), 1);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn notification_failure_is_terminal() {
        let root = temporary_root("notification-failure");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        fs::write(
            directory.join(TASK_FILE),
            serialize_json(&document(vec![scheduled_reminder()])).unwrap(),
        )
        .expect("write registry");
        let reservation = reserve_task_attempt_at(
            &root,
            ReserveTaskAttemptInput {
                task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
                scheduled_for: "2026-09-02T18:00:00Z".into(),
                confirmed: true,
            },
            "2026-09-02T19:00:00Z".into(),
        )
        .unwrap();
        let input = DispatchTaskNotificationInput {
            attempt_id: reservation.attempt_id,
            idempotency_key: reservation.idempotency_key,
            confirmed: true,
        };
        let failed = dispatch_task_notification_at(
            &root,
            input,
            "2026-09-02T19:01:00Z".into(),
            |_| Err("controlled operating-system rejection".into()),
            || Ok("2026-09-02T19:01:01Z".into()),
        )
        .expect("record terminal failure");
        assert_eq!(failed.state, TaskAttemptState::Failed);
        assert!(!failed.notification_accepted);
        assert_eq!(
            failed.dispatch_reason,
            TaskDispatchReason::NotificationError
        );
        assert!(!fs::read_to_string(task_attempt_ledger_path(&root))
            .expect("read ledger")
            .contains("controlled operating-system rejection"));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn cancelled_task_never_reaches_notification_adapter() {
        let root = temporary_root("notification-cancelled");
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).expect("create fixture directory");
        let registry_path = directory.join(TASK_FILE);
        fs::write(
            &registry_path,
            serialize_json(&document(vec![scheduled_reminder()])).unwrap(),
        )
        .expect("write registry");
        let reservation = reserve_task_attempt_at(
            &root,
            ReserveTaskAttemptInput {
                task_id: "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd".into(),
                scheduled_for: "2026-09-02T18:00:00Z".into(),
                confirmed: true,
            },
            "2026-09-02T19:00:00Z".into(),
        )
        .expect("reserve occurrence");
        let mut cancelled = scheduled_reminder();
        cancelled.status = TaskStatus::Cancelled;
        cancelled.cancellable = false;
        cancelled.schedule.next_run_at = None;
        fs::write(
            registry_path,
            serialize_json(&document(vec![cancelled])).unwrap(),
        )
        .expect("replace registry with cancelled task");

        let error = dispatch_task_notification_at(
            &root,
            DispatchTaskNotificationInput {
                attempt_id: reservation.attempt_id,
                idempotency_key: reservation.idempotency_key,
                confirmed: true,
            },
            "2026-09-02T19:01:00Z".into(),
            |_| panic!("a cancelled task must not reach the notification adapter"),
            || panic!("a blocked dispatch must not request a finish timestamp"),
        )
        .expect_err("cancelled task must be blocked");
        assert!(error.contains("pausada, cancelada o cerrada"));
        let snapshot = task_attempt_ledger_snapshot_at(&root);
        assert_eq!(snapshot.reservations[0].state, TaskAttemptState::Reserved);
        assert!(!snapshot.output_performed);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn temporal_background_control_starts_off_and_can_be_fully_disabled() {
        let store = TaskEngineStore::default();
        assert_eq!(store.status().unwrap(), (false, None, None));

        store.set_enabled(true).expect("enable evaluation");
        assert!(store.status().unwrap().0);
        {
            let mut runtime = store.inner.lock().unwrap();
            runtime.last_background_evaluation_at = Some("2026-09-02T19:00:00Z".into());
        }
        store.set_enabled(false).expect("disable evaluation");
        assert_eq!(store.status().unwrap(), (false, None, None));
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_r7_registry_probe_is_read_only() {
        let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
            .map(PathBuf::from)
            .expect("ALICE_LIVE_DATA_DIR requerido");
        let before = file_hashes(&root);

        let snapshot = task_registry_snapshot_at(&root);
        let after = file_hashes(&root);

        assert_eq!(after, before);
        assert_eq!(snapshot.state, TaskRegistryState::Missing);
        assert_eq!(snapshot.task_count, 0);
        assert!(!snapshot.storage_exists);
        assert!(!snapshot.automatic_execution);
        println!(
            "R7_1_CANONICAL state={:?} tasks={} filesIntact={}",
            snapshot.state,
            snapshot.task_count,
            after.len()
        );
    }
}
