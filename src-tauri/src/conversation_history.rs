use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::capabilities::{current_utc_timestamp, validate_timestamp};
use crate::util::{alice_data_root, alice_data_root_path, encode_hex_lower};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::AppHandle;
use uuid::{Uuid, Version};

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

const SCHEMA_VERSION: u8 = 1;
const HISTORY_DIRECTORY: &str = "conversation";
const HISTORY_FILE: &str = "history-v1.json";
const MAX_HISTORY_BYTES: u64 = 8 * 1024 * 1024;
const MAX_EXCHANGES: usize = 1_000;
const MAX_MESSAGE_CHARACTERS: usize = 100_000;
const MAX_PROVIDER_CHARACTERS: usize = 100;
const MAX_MODEL_CHARACTERS: usize = 200;
const MAX_RESPONSE_ID_CHARACTERS: usize = 300;
static HISTORY_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConversationHistoryState {
    Missing,
    Ready,
    Invalid,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ConversationHistoryExchange {
    exchange_id: String,
    response_id: String,
    user_text: String,
    assistant_text: String,
    created_at: String,
    provider: String,
    model: String,
    source: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConversationHistoryDocument {
    schema_version: u8,
    revision_id: String,
    updated_at: String,
    exchanges: Vec<ConversationHistoryExchange>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConversationHistorySnapshot {
    schema_version: u8,
    state: ConversationHistoryState,
    storage_exists: bool,
    revision_id: Option<String>,
    updated_at: Option<String>,
    exchanges: Vec<ConversationHistoryExchange>,
    exchange_count: usize,
    message_count: usize,
    maximum_exchanges: usize,
    persisted: bool,
    automatic_memory_promotion: bool,
    error: Option<String>,
}

impl ConversationHistoryDocument {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != SCHEMA_VERSION {
            return Err("El historial usa una versión incompatible".into());
        }
        validate_uuid_v4("revisionId", &self.revision_id)?;
        validate_utc_timestamp("updatedAt", &self.updated_at)?;
        if self.exchanges.len() > MAX_EXCHANGES {
            return Err(format!(
                "El historial supera el máximo de {MAX_EXCHANGES} intercambios"
            ));
        }
        let mut ids = HashSet::with_capacity(self.exchanges.len());
        let mut response_ids = HashSet::with_capacity(self.exchanges.len());
        let mut previous_timestamp: Option<&str> = None;
        for exchange in &self.exchanges {
            validate_uuid_v4("exchangeId", &exchange.exchange_id)?;
            if !ids.insert(exchange.exchange_id.as_str()) {
                return Err("El historial repite un exchangeId".into());
            }
            validate_non_empty_text(
                "responseId",
                &exchange.response_id,
                MAX_RESPONSE_ID_CHARACTERS,
            )?;
            if !response_ids.insert(exchange.response_id.as_str()) {
                return Err("El historial repite un responseId".into());
            }
            validate_non_empty_text("userText", &exchange.user_text, MAX_MESSAGE_CHARACTERS)?;
            validate_non_empty_text(
                "assistantText",
                &exchange.assistant_text,
                MAX_MESSAGE_CHARACTERS,
            )?;
            validate_non_empty_text("provider", &exchange.provider, MAX_PROVIDER_CHARACTERS)?;
            validate_non_empty_text("model", &exchange.model, MAX_MODEL_CHARACTERS)?;
            validate_utc_timestamp("createdAt", &exchange.created_at)?;
            if previous_timestamp.is_some_and(|previous| previous > exchange.created_at.as_str()) {
                return Err("El historial no está ordenado cronológicamente".into());
            }
            previous_timestamp = Some(&exchange.created_at);
            if exchange.source != "assistantConversation" {
                return Err("El historial contiene una fuente desconocida".into());
            }
        }
        if self
            .exchanges
            .last()
            .is_some_and(|exchange| exchange.created_at > self.updated_at)
        {
            return Err("updatedAt precede al último intercambio".into());
        }
        Ok(())
    }
}

fn validate_uuid_v4(field: &str, value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| format!("{field} no es UUID"))?;
    if parsed.get_version() != Some(Version::Random) || parsed.to_string() != value {
        return Err(format!("{field} debe ser UUID v4 canónico"));
    }
    Ok(())
}

fn validate_utc_timestamp(field: &str, value: &str) -> Result<(), String> {
    validate_timestamp(field, value)?;
    if !value.ends_with('Z') {
        return Err(format!("{field} debe usar UTC con sufijo Z"));
    }
    Ok(())
}

fn validate_non_empty_text(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{field} no puede estar vacío"));
    }
    if value.chars().count() > maximum {
        return Err(format!("{field} supera {maximum} caracteres"));
    }
    Ok(())
}

fn history_path(data_root: &Path) -> PathBuf {
    data_root.join(HISTORY_DIRECTORY).join(HISTORY_FILE)
}

fn read_document(
    data_root: &Path,
) -> Result<Option<(Vec<u8>, ConversationHistoryDocument)>, String> {
    let path = history_path(data_root);
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("No se pudo inspeccionar el historial: {error}"))?;
    if metadata.len() > MAX_HISTORY_BYTES {
        return Err(format!(
            "El historial supera el máximo de {MAX_HISTORY_BYTES} bytes"
        ));
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("No se pudo leer el historial: {error}"))?;
    let document = serde_json::from_slice::<ConversationHistoryDocument>(&bytes)
        .map_err(|error| format!("El historial local no es JSON válido: {error}"))?;
    document.validate()?;
    Ok(Some((bytes, document)))
}

fn snapshot_from_document(document: ConversationHistoryDocument) -> ConversationHistorySnapshot {
    ConversationHistorySnapshot {
        schema_version: SCHEMA_VERSION,
        state: ConversationHistoryState::Ready,
        storage_exists: true,
        revision_id: Some(document.revision_id),
        updated_at: Some(document.updated_at),
        exchange_count: document.exchanges.len(),
        message_count: document.exchanges.len() * 2,
        maximum_exchanges: MAX_EXCHANGES,
        exchanges: document.exchanges,
        persisted: true,
        automatic_memory_promotion: false,
        error: None,
    }
}

fn missing_snapshot() -> ConversationHistorySnapshot {
    ConversationHistorySnapshot {
        schema_version: SCHEMA_VERSION,
        state: ConversationHistoryState::Missing,
        storage_exists: false,
        revision_id: None,
        updated_at: None,
        exchanges: Vec::new(),
        exchange_count: 0,
        message_count: 0,
        maximum_exchanges: MAX_EXCHANGES,
        persisted: true,
        automatic_memory_promotion: false,
        error: None,
    }
}

fn invalid_snapshot(error: String) -> ConversationHistorySnapshot {
    ConversationHistorySnapshot {
        state: ConversationHistoryState::Invalid,
        storage_exists: true,
        error: Some(error),
        ..missing_snapshot()
    }
}

pub(crate) fn conversation_history_snapshot_at(data_root: &Path) -> ConversationHistorySnapshot {
    match read_document(data_root) {
        Ok(Some((_, document))) => snapshot_from_document(document),
        Ok(None) => missing_snapshot(),
        Err(error) => invalid_snapshot(error),
    }
}

fn serialize_document(document: &ConversationHistoryDocument) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(document)
        .map_err(|error| format!("No se pudo serializar el historial: {error}"))?;
    bytes.push(b'\n');
    if bytes.len() > MAX_HISTORY_BYTES as usize {
        return Err(format!(
            "El historial excede el máximo de {MAX_HISTORY_BYTES} bytes"
        ));
    }
    Ok(bytes)
}

#[cfg(windows)]
fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("El historial no posee una carpeta válida")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta del historial: {error}"))?;
    let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal del historial: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("No se pudo preparar el historial: {error}"));
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
        return Err(format!("Falló el reemplazo atómico del historial: {error}"));
    }
    verify_bytes(path, bytes)
}

#[cfg(not(windows))]
fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("El historial no posee una carpeta válida")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta del historial: {error}"))?;
    let temporary = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal del historial: {error}"))?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("No se pudo preparar el historial: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Falló el reemplazo atómico del historial: {error}"))?;
    verify_bytes(path, bytes)
}

fn verify_bytes(path: &Path, expected: &[u8]) -> Result<(), String> {
    let stored =
        fs::read(path).map_err(|error| format!("No se pudo verificar el historial: {error}"))?;
    if stored != expected {
        return Err("El historial no coincide después de persistirlo".into());
    }
    Ok(())
}

fn restore(path: &Path, previous: Option<&[u8]>) -> Result<(), String> {
    if let Some(bytes) = previous {
        atomic_replace(path, bytes)
    } else if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("No se pudo retirar el historial durante rollback: {error}"))
    } else {
        Ok(())
    }
}

fn append_conversation_exchange_unlocked(
    data_root: &Path,
    response_id: &str,
    user_text: &str,
    assistant_text: &str,
    provider: &str,
    model: &str,
    created_at: String,
) -> Result<ConversationHistorySnapshot, String> {
    validate_non_empty_text("responseId", response_id, MAX_RESPONSE_ID_CHARACTERS)?;
    validate_non_empty_text("userText", user_text, MAX_MESSAGE_CHARACTERS)?;
    validate_non_empty_text("assistantText", assistant_text, MAX_MESSAGE_CHARACTERS)?;
    validate_non_empty_text("provider", provider, MAX_PROVIDER_CHARACTERS)?;
    validate_non_empty_text("model", model, MAX_MODEL_CHARACTERS)?;
    validate_utc_timestamp("createdAt", &created_at)?;
    let previous = read_document(data_root)?;
    let mut document = previous
        .as_ref()
        .map(|(_, document)| document.clone())
        .unwrap_or(ConversationHistoryDocument {
            schema_version: SCHEMA_VERSION,
            revision_id: Uuid::new_v4().to_string(),
            updated_at: created_at.clone(),
            exchanges: Vec::new(),
        });
    if let Some(existing) = document
        .exchanges
        .iter()
        .find(|exchange| exchange.response_id == response_id)
    {
        let same_exchange = existing.user_text == user_text.trim()
            && existing.assistant_text == assistant_text.trim()
            && existing.provider == provider.trim()
            && existing.model == model.trim();
        return if same_exchange {
            Ok(snapshot_from_document(document))
        } else {
            Err("responseId ya existe con contenido diferente".into())
        };
    }
    if document.exchanges.len() >= MAX_EXCHANGES {
        return Err(format!(
            "El historial alcanzó {MAX_EXCHANGES} intercambios; debe archivarse antes de continuar"
        ));
    }
    if document
        .exchanges
        .last()
        .is_some_and(|exchange| exchange.created_at > created_at)
    {
        return Err("El reloj retrocedió respecto del último intercambio".into());
    }
    document.revision_id = Uuid::new_v4().to_string();
    document.updated_at = created_at.clone();
    document.exchanges.push(ConversationHistoryExchange {
        exchange_id: Uuid::new_v4().to_string(),
        response_id: response_id.trim().to_string(),
        user_text: user_text.trim().to_string(),
        assistant_text: assistant_text.trim().to_string(),
        created_at,
        provider: provider.trim().to_string(),
        model: model.trim().to_string(),
        source: "assistantConversation".into(),
    });
    document.validate()?;
    let bytes = serialize_document(&document)?;
    atomic_replace(&history_path(data_root), &bytes)?;
    Ok(snapshot_from_document(document))
}

#[cfg(test)]
fn append_conversation_exchange_at(
    data_root: &Path,
    response_id: &str,
    user_text: &str,
    assistant_text: &str,
    provider: &str,
    model: &str,
    created_at: String,
) -> Result<ConversationHistorySnapshot, String> {
    let _guard = HISTORY_WRITE_LOCK
        .lock()
        .map_err(|_| "El bloqueo del historial quedó envenenado".to_string())?;
    append_conversation_exchange_unlocked(
        data_root,
        response_id,
        user_text,
        assistant_text,
        provider,
        model,
        created_at,
    )
}

pub(crate) fn record_real_conversation_exchange(
    app: &AppHandle,
    response_id: &str,
    user_text: &str,
    assistant_text: &str,
    provider: &str,
    model: &str,
) -> Result<ConversationHistorySnapshot, String> {
    let _guard = HISTORY_WRITE_LOCK
        .lock()
        .map_err(|_| "El bloqueo del historial quedó envenenado".to_string())?;
    let data_root = alice_data_root(app)?;
    let path = history_path(&data_root);
    let previous = fs::read(&path).ok();
    let created_at = current_utc_timestamp()?;
    let operation_id = new_operation_id();
    let subject_digest = format!(
        "sha256:{}",
        encode_hex_lower(Sha256::digest(
            format!("{user_text}\u{0}{assistant_text}").as_bytes()
        ))
    );
    record_producer_audit(
        app,
        operation_id.clone(),
        AuditSource::Memory,
        "memory.conversation.history".into(),
        "memory.conversation.append".into(),
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(subject_digest.clone()),
        "CONVERSATION_HISTORY_APPEND_REQUESTED",
    )?;
    let started = Instant::now();
    let result = append_conversation_exchange_unlocked(
        &data_root,
        response_id,
        user_text,
        assistant_text,
        provider,
        model,
        created_at,
    );
    match result {
        Ok(snapshot) => {
            let duration_ms = u64::try_from(started.elapsed().as_millis())
                .unwrap_or(86_400_000)
                .min(86_400_000);
            if let Err(error) = record_producer_audit(
                app,
                operation_id,
                AuditSource::Memory,
                "memory.conversation.history".into(),
                "memory.conversation.append".into(),
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(duration_ms),
                Some(subject_digest),
                "CONVERSATION_HISTORY_APPENDED",
            ) {
                restore(&path, previous.as_deref())?;
                return Err(format!(
                    "La auditoría falló y el historial fue restaurado: {error}"
                ));
            }
            Ok(snapshot)
        }
        Err(error) => {
            let _ = record_producer_audit(
                app,
                operation_id,
                AuditSource::Memory,
                "memory.conversation.history".into(),
                "memory.conversation.append".into(),
                AuditStage::Error,
                AuditOutcome::Error,
                Some(
                    u64::try_from(started.elapsed().as_millis())
                        .unwrap_or(86_400_000)
                        .min(86_400_000),
                ),
                Some(subject_digest),
                "CONVERSATION_HISTORY_APPEND_FAILED",
            );
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) fn conversation_history_status(
    app: AppHandle,
) -> Result<ConversationHistorySnapshot, String> {
    let data_root = alice_data_root_path(&app)?;
    Ok(conversation_history_snapshot_at(&data_root))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("alice-conversation-{label}-{}", Uuid::new_v4()))
    }

    #[test]
    fn missing_history_is_read_only() {
        let root = temporary_root("missing");
        let snapshot = conversation_history_snapshot_at(&root);

        assert_eq!(snapshot.state, ConversationHistoryState::Missing);
        assert!(!snapshot.storage_exists);
        assert!(snapshot.exchanges.is_empty());
        assert!(!root.exists());
    }

    #[test]
    fn real_exchanges_survive_a_physical_reload_without_becoming_memories() {
        let root = temporary_root("reload");
        let first = append_conversation_exchange_at(
            &root,
            "response-real-1",
            "Primera pregunta real",
            "Primera respuesta real",
            "ollama",
            "modelo-local",
            "2026-09-04T14:00:00Z".into(),
        )
        .expect("persist first exchange");
        assert_eq!(first.message_count, 2);
        assert!(first.persisted);
        assert!(!first.automatic_memory_promotion);

        append_conversation_exchange_at(
            &root,
            "response-real-2",
            "Segunda pregunta real",
            "Segunda respuesta real",
            "ollama",
            "modelo-local",
            "2026-09-04T14:01:00Z".into(),
        )
        .expect("persist second exchange");
        let before_retry = fs::read(history_path(&root)).expect("read before retry");
        let retry = append_conversation_exchange_at(
            &root,
            "response-real-2",
            "Segunda pregunta real",
            "Segunda respuesta real",
            "ollama",
            "modelo-local",
            "2026-09-04T14:02:00Z".into(),
        )
        .expect("same response is idempotent");
        assert_eq!(retry.exchange_count, 2);
        assert_eq!(fs::read(history_path(&root)).unwrap(), before_retry);
        let conflict = append_conversation_exchange_at(
            &root,
            "response-real-2",
            "Contenido diferente",
            "Segunda respuesta real",
            "ollama",
            "modelo-local",
            "2026-09-04T14:02:00Z".into(),
        )
        .expect_err("response id collision must be blocked");
        assert!(conflict.contains("contenido diferente"));
        assert_eq!(fs::read(history_path(&root)).unwrap(), before_retry);
        let reloaded = conversation_history_snapshot_at(&root);
        assert_eq!(reloaded.state, ConversationHistoryState::Ready);
        assert_eq!(reloaded.exchange_count, 2);
        assert_eq!(reloaded.message_count, 4);
        assert_eq!(reloaded.exchanges[0].user_text, "Primera pregunta real");
        assert_eq!(
            reloaded.exchanges[1].assistant_text,
            "Segunda respuesta real"
        );
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn corrupt_history_is_blocked_and_preserved_byte_for_byte() {
        let root = temporary_root("invalid");
        let path = history_path(&root);
        fs::create_dir_all(path.parent().unwrap()).expect("create fixture directory");
        let corrupt = b"{not valid json\n";
        fs::write(&path, corrupt).expect("write corrupt fixture");

        let snapshot = conversation_history_snapshot_at(&root);
        assert_eq!(snapshot.state, ConversationHistoryState::Invalid);
        let error = append_conversation_exchange_at(
            &root,
            "response-corrupt",
            "pregunta",
            "respuesta",
            "ollama",
            "modelo-local",
            "2026-09-04T14:00:00Z".into(),
        )
        .expect_err("invalid history must block append");
        assert!(error.contains("JSON válido"));
        assert_eq!(fs::read(&path).unwrap(), corrupt);
        fs::remove_dir_all(root).expect("remove fixture");
    }
}
