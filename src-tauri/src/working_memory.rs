use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::capabilities::current_utc_timestamp;
use crate::util::timestamp_ms;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, State};
use uuid::Uuid;

const WORKING_MEMORY_SCHEMA_VERSION: u8 = 1;
const MAX_EXCHANGES: usize = 6;
const MAX_CHARACTERS: usize = 72_000;
const DEFAULT_TTL_MS: u64 = 2 * 60 * 60 * 1_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum WorkingMemoryState {
    Empty,
    Active,
    Expired,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkingMemoryExchange {
    exchange_id: String,
    user_text: String,
    assistant_text: String,
    created_at: String,
    provider: String,
    model: String,
    source: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkingMemorySnapshot {
    schema_version: u8,
    state: WorkingMemoryState,
    generation: u64,
    exchanges: Vec<WorkingMemoryExchange>,
    exchange_count: usize,
    message_count: usize,
    maximum_messages: usize,
    character_count: usize,
    maximum_characters: usize,
    ttl_seconds: u64,
    expires_in_seconds: Option<u64>,
    last_activity_at: Option<String>,
    persisted: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkingMemoryOperationResult {
    pub(crate) snapshot: WorkingMemorySnapshot,
    audit_healthy: bool,
    pub(crate) warning: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ClearWorkingMemoryInput {
    expected_generation: u64,
    confirmed: bool,
}

#[derive(Debug)]
struct WorkingMemoryData {
    state: WorkingMemoryState,
    generation: u64,
    exchanges: VecDeque<WorkingMemoryExchange>,
    last_activity_ms: Option<u64>,
    last_activity_at: Option<String>,
}

impl Default for WorkingMemoryData {
    fn default() -> Self {
        Self {
            state: WorkingMemoryState::Empty,
            generation: 0,
            exchanges: VecDeque::new(),
            last_activity_ms: None,
            last_activity_at: None,
        }
    }
}

#[derive(Debug)]
pub(crate) struct WorkingMemoryStore {
    inner: Mutex<WorkingMemoryData>,
    ttl_ms: u64,
    maximum_exchanges: usize,
    maximum_characters: usize,
}

impl Default for WorkingMemoryStore {
    fn default() -> Self {
        Self {
            inner: Mutex::new(WorkingMemoryData::default()),
            ttl_ms: DEFAULT_TTL_MS,
            maximum_exchanges: MAX_EXCHANGES,
            maximum_characters: MAX_CHARACTERS,
        }
    }
}

impl WorkingMemoryStore {
    #[cfg(test)]
    fn with_limits(ttl_ms: u64, maximum_exchanges: usize, maximum_characters: usize) -> Self {
        Self {
            inner: Mutex::new(WorkingMemoryData::default()),
            ttl_ms,
            maximum_exchanges,
            maximum_characters,
        }
    }

    fn now_ms() -> Result<u64, String> {
        u64::try_from(timestamp_ms()?)
            .map_err(|_| "El reloj del sistema excede el rango de memoria de trabajo".into())
    }

    fn expire_if_needed(&self, data: &mut WorkingMemoryData, now_ms: u64) {
        let expired = data
            .last_activity_ms
            .is_some_and(|last| now_ms.saturating_sub(last) >= self.ttl_ms);
        if !expired {
            return;
        }
        data.exchanges.clear();
        data.last_activity_ms = None;
        data.generation = data.generation.saturating_add(1);
        data.state = WorkingMemoryState::Expired;
    }

    fn snapshot_locked(&self, data: &WorkingMemoryData, now_ms: u64) -> WorkingMemorySnapshot {
        let character_count = data
            .exchanges
            .iter()
            .map(|exchange| {
                exchange.user_text.chars().count() + exchange.assistant_text.chars().count()
            })
            .sum();
        let expires_in_seconds = data.last_activity_ms.map(|last| {
            self.ttl_ms
                .saturating_sub(now_ms.saturating_sub(last))
                .div_ceil(1_000)
        });
        WorkingMemorySnapshot {
            schema_version: WORKING_MEMORY_SCHEMA_VERSION,
            state: data.state,
            generation: data.generation,
            exchanges: data.exchanges.iter().cloned().collect(),
            exchange_count: data.exchanges.len(),
            message_count: data.exchanges.len() * 2,
            maximum_messages: self.maximum_exchanges * 2,
            character_count,
            maximum_characters: self.maximum_characters,
            ttl_seconds: self.ttl_ms / 1_000,
            expires_in_seconds,
            last_activity_at: data.last_activity_at.clone(),
            persisted: false,
        }
    }

    pub(crate) fn snapshot(&self) -> Result<WorkingMemorySnapshot, String> {
        let now_ms = Self::now_ms()?;
        let mut data = self
            .inner
            .lock()
            .map_err(|_| "La memoria de trabajo quedó bloqueada".to_string())?;
        self.expire_if_needed(&mut data, now_ms);
        Ok(self.snapshot_locked(&data, now_ms))
    }

    pub(crate) fn record_exchange(
        &self,
        user_text: &str,
        assistant_text: &str,
        provider: &str,
        model: &str,
    ) -> Result<WorkingMemorySnapshot, String> {
        let user_text = user_text.trim();
        let assistant_text = assistant_text.trim();
        if user_text.is_empty() || assistant_text.is_empty() {
            return Err("El intercambio real no puede contener mensajes vacíos".into());
        }
        if provider.trim().is_empty() || model.trim().is_empty() {
            return Err("El intercambio real requiere proveedor y modelo".into());
        }
        let exchange_characters = user_text.chars().count() + assistant_text.chars().count();
        if exchange_characters > self.maximum_characters {
            return Err(format!(
                "El intercambio ocupa {exchange_characters} caracteres y supera el presupuesto RAM de {}",
                self.maximum_characters
            ));
        }

        let now_ms = Self::now_ms()?;
        let created_at = current_utc_timestamp()?;
        let mut data = self
            .inner
            .lock()
            .map_err(|_| "La memoria de trabajo quedó bloqueada".to_string())?;
        self.expire_if_needed(&mut data, now_ms);

        let mut current_characters: usize = data
            .exchanges
            .iter()
            .map(|exchange| {
                exchange.user_text.chars().count() + exchange.assistant_text.chars().count()
            })
            .sum();
        while !data.exchanges.is_empty()
            && (data.exchanges.len() >= self.maximum_exchanges
                || current_characters + exchange_characters > self.maximum_characters)
        {
            if let Some(removed) = data.exchanges.pop_front() {
                current_characters = current_characters.saturating_sub(
                    removed.user_text.chars().count() + removed.assistant_text.chars().count(),
                );
            }
        }
        data.exchanges.push_back(WorkingMemoryExchange {
            exchange_id: Uuid::new_v4().to_string(),
            user_text: user_text.to_string(),
            assistant_text: assistant_text.to_string(),
            created_at: created_at.clone(),
            provider: provider.trim().to_string(),
            model: model.trim().to_string(),
            source: "cloudConversation".into(),
        });
        data.generation = data.generation.saturating_add(1);
        data.state = WorkingMemoryState::Active;
        data.last_activity_ms = Some(now_ms);
        data.last_activity_at = Some(created_at);
        Ok(self.snapshot_locked(&data, now_ms))
    }

    fn clear(&self, expected_generation: u64) -> Result<WorkingMemorySnapshot, String> {
        let now_ms = Self::now_ms()?;
        let mut data = self
            .inner
            .lock()
            .map_err(|_| "La memoria de trabajo quedó bloqueada".to_string())?;
        self.expire_if_needed(&mut data, now_ms);
        if data.generation != expected_generation {
            return Err("La memoria de trabajo cambió antes de confirmar el vaciado".into());
        }
        data.exchanges.clear();
        data.generation = data.generation.saturating_add(1);
        data.state = WorkingMemoryState::Empty;
        data.last_activity_ms = None;
        data.last_activity_at = None;
        Ok(self.snapshot_locked(&data, now_ms))
    }
}

fn digest_text(value: &str) -> String {
    format!("sha256:{:x}", Sha256::digest(value.as_bytes()))
}

struct WorkingMemoryAudit<'a> {
    operation: &'a str,
    stage: AuditStage,
    outcome: AuditOutcome,
    duration_ms: Option<u64>,
    subject_digest: String,
    reason_code: &'a str,
}

fn audit_operation(
    app: &AppHandle,
    operation_id: String,
    audit: WorkingMemoryAudit<'_>,
) -> Result<(), String> {
    record_producer_audit(
        app,
        operation_id,
        AuditSource::Memory,
        "memory.working.manage".into(),
        audit.operation.into(),
        audit.stage,
        audit.outcome,
        audit.duration_ms,
        Some(audit.subject_digest),
        audit.reason_code,
    )
}

pub(crate) fn record_real_cloud_exchange(
    app: &AppHandle,
    store: &WorkingMemoryStore,
    user_text: &str,
    assistant_text: &str,
    provider: &str,
    model: &str,
) -> Result<WorkingMemoryOperationResult, String> {
    let operation_id = new_operation_id();
    let subject_digest = digest_text(&format!("{user_text}\u{0}{assistant_text}"));
    audit_operation(
        app,
        operation_id.clone(),
        WorkingMemoryAudit {
            operation: "memory.working.record",
            stage: AuditStage::Request,
            outcome: AuditOutcome::Pending,
            duration_ms: None,
            subject_digest: subject_digest.clone(),
            reason_code: "WORKING_MEMORY_RECORD_REQUESTED",
        },
    )?;
    let started = Instant::now();
    match store.record_exchange(user_text, assistant_text, provider, model) {
        Ok(snapshot) => {
            let audit_result = audit_operation(
                app,
                operation_id,
                WorkingMemoryAudit {
                    operation: "memory.working.record",
                    stage: AuditStage::Execution,
                    outcome: AuditOutcome::Success,
                    duration_ms: Some(
                        u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
                    ),
                    subject_digest,
                    reason_code: "WORKING_MEMORY_RECORDED",
                },
            );
            Ok(WorkingMemoryOperationResult {
                snapshot,
                audit_healthy: audit_result.is_ok(),
                warning: audit_result.err().map(|error| {
                    format!("El intercambio está en RAM, pero la auditoría R3 falló: {error}")
                }),
            })
        }
        Err(error) => {
            if let Err(audit_error) = audit_operation(
                app,
                operation_id,
                WorkingMemoryAudit {
                    operation: "memory.working.record",
                    stage: AuditStage::Error,
                    outcome: AuditOutcome::Error,
                    duration_ms: Some(
                        u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
                    ),
                    subject_digest,
                    reason_code: "WORKING_MEMORY_RECORD_FAILED",
                },
            ) {
                eprintln!("R3 no registró el fallo de memoria de trabajo: {audit_error}");
            }
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) fn working_memory_status(
    store: State<WorkingMemoryStore>,
) -> Result<WorkingMemorySnapshot, String> {
    store.snapshot()
}

#[tauri::command]
pub(crate) fn clear_working_memory(
    app: AppHandle,
    store: State<WorkingMemoryStore>,
    input: ClearWorkingMemoryInput,
) -> Result<WorkingMemoryOperationResult, String> {
    if !input.confirmed {
        return Err("Vaciar la memoria de trabajo requiere confirmación explícita".into());
    }
    let operation_id = new_operation_id();
    let subject_digest = digest_text(&format!("generation:{}", input.expected_generation));
    audit_operation(
        &app,
        operation_id.clone(),
        WorkingMemoryAudit {
            operation: "memory.working.clear",
            stage: AuditStage::Request,
            outcome: AuditOutcome::Pending,
            duration_ms: None,
            subject_digest: subject_digest.clone(),
            reason_code: "WORKING_MEMORY_CLEAR_REQUESTED",
        },
    )?;
    let started = Instant::now();
    match store.clear(input.expected_generation) {
        Ok(snapshot) => {
            let audit_result = audit_operation(
                &app,
                operation_id,
                WorkingMemoryAudit {
                    operation: "memory.working.clear",
                    stage: AuditStage::Execution,
                    outcome: AuditOutcome::Success,
                    duration_ms: Some(
                        u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
                    ),
                    subject_digest,
                    reason_code: "WORKING_MEMORY_CLEARED",
                },
            );
            Ok(WorkingMemoryOperationResult {
                snapshot,
                audit_healthy: audit_result.is_ok(),
                warning: audit_result
                    .err()
                    .map(|error| format!("La RAM se vació, pero la auditoría R3 falló: {error}")),
            })
        }
        Err(error) => {
            if let Err(audit_error) = audit_operation(
                &app,
                operation_id,
                WorkingMemoryAudit {
                    operation: "memory.working.clear",
                    stage: AuditStage::Error,
                    outcome: AuditOutcome::Blocked,
                    duration_ms: Some(
                        u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
                    ),
                    subject_digest,
                    reason_code: "WORKING_MEMORY_CLEAR_BLOCKED",
                },
            ) {
                eprintln!("R3 no registró el bloqueo de vaciado: {audit_error}");
            }
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn real_ram_store_records_and_clears_without_creating_files() {
        let root = std::env::temp_dir().join(format!("alice-r6-working-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let before = fs::read_dir(&root).unwrap().count();
        let store = WorkingMemoryStore::default();

        let active = store
            .record_exchange("Mensaje real", "Respuesta real", "Proveedor", "modelo-real")
            .unwrap();
        assert_eq!(active.state, WorkingMemoryState::Active);
        assert_eq!(active.message_count, 2);
        assert!(!active.persisted);

        let cleared = store.clear(active.generation).unwrap();
        assert_eq!(cleared.state, WorkingMemoryState::Empty);
        assert!(cleared.exchanges.is_empty());
        assert_eq!(fs::read_dir(&root).unwrap().count(), before);
        fs::remove_dir(&root).unwrap();
    }

    #[test]
    fn capacity_evicts_complete_oldest_exchanges_without_truncating_text() {
        let store = WorkingMemoryStore::with_limits(DEFAULT_TTL_MS, 2, 200);
        store
            .record_exchange("uno", "respuesta uno", "p", "m")
            .unwrap();
        store
            .record_exchange("dos", "respuesta dos", "p", "m")
            .unwrap();
        let snapshot = store
            .record_exchange("tres", "respuesta tres", "p", "m")
            .unwrap();

        assert_eq!(snapshot.exchange_count, 2);
        assert_eq!(snapshot.message_count, 4);
        assert_eq!(snapshot.exchanges[0].user_text, "dos");
        assert_eq!(snapshot.exchanges[1].assistant_text, "respuesta tres");
    }

    #[test]
    fn real_elapsed_time_expires_and_removes_the_contents() {
        let store = WorkingMemoryStore::with_limits(15, 3, 200);
        store
            .record_exchange("temporal", "efímero", "p", "m")
            .unwrap();
        thread::sleep(Duration::from_millis(30));
        let snapshot = store.snapshot().unwrap();

        assert_eq!(snapshot.state, WorkingMemoryState::Expired);
        assert_eq!(snapshot.message_count, 0);
        assert!(snapshot.exchanges.is_empty());
    }

    #[test]
    fn stale_clear_is_rejected_and_preserves_the_newer_exchange() {
        let store = WorkingMemoryStore::default();
        let first = store.record_exchange("uno", "a", "p", "m").unwrap();
        store.record_exchange("dos", "b", "p", "m").unwrap();

        assert!(store.clear(first.generation).is_err());
        assert_eq!(store.snapshot().unwrap().exchange_count, 2);
    }

    #[test]
    fn oversized_exchange_is_rejected_without_partial_storage() {
        let store = WorkingMemoryStore::with_limits(DEFAULT_TTL_MS, 3, 8);

        assert!(store.record_exchange("12345", "67890", "p", "m").is_err());
        assert_eq!(store.snapshot().unwrap().message_count, 0);
    }
}
