use crate::capabilities::validate_timestamp;
use crate::util::alice_data_root_path;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use uuid::Uuid;

pub(crate) const TASK_REGISTRY_SCHEMA_VERSION: u32 = 1;
const TASK_DIRECTORY: &str = "tasks";
const TASK_FILE: &str = "tasks-v1.json";
const MAX_TASKS: usize = 200;
const MAX_TASK_FILE_BYTES: u64 = 1024 * 1024;

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
    pub(crate) schedule: TaskSchedule,
    pub(crate) scope: TaskScope,
    pub(crate) origin: TaskOrigin,
    pub(crate) cancellable: bool,
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

pub(crate) fn task_capability_probe(data_root: &Path) -> TaskCapabilityProbe {
    let snapshot = task_registry_snapshot_at(data_root);
    TaskCapabilityProbe {
        state: snapshot.state,
        task_count: snapshot.task_count,
    }
}

#[tauri::command]
pub(crate) fn task_registry_status(app: AppHandle) -> Result<TaskRegistrySnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    Ok(task_registry_snapshot_at(&data_root))
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
