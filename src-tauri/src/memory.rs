use crate::util::{alice_data_root, timestamp_ms};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoryContextEvent {
    #[serde(rename = "type")]
    event_type: String,
    recorded_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySession {
    id: String,
    kind: String,
    intention: String,
    started_at: String,
    finished_at: Option<String>,
    summary: Option<String>,
    next_step: Option<String>,
    memory_type: Option<String>,
    source: Option<String>,
    importance: Option<u8>,
    storage_strength: Option<f64>,
    memory_status: Option<String>,
    #[serde(default)]
    successful_recalls: u32,
    #[serde(default)]
    failed_recalls: u32,
    last_recalled_at: Option<String>,
    #[serde(default)]
    successful_reviews: u32,
    #[serde(default)]
    correction_count: u32,
    last_reviewed_at: Option<String>,
    #[serde(default)]
    context_events: Vec<MemoryContextEvent>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemorySnapshot {
    sessions: Vec<MemorySession>,
    storage_path: String,
    existed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MemoryResourceState {
    Missing,
    Valid,
    Invalid,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MemoryCapabilityProbe {
    pub(crate) directory_exists: bool,
    pub(crate) manifest: MemoryResourceState,
    pub(crate) records: MemoryResourceState,
    pub(crate) backup: MemoryResourceState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryAuditEntry {
    timestamp_ms: u128,
    action: String,
    session_count: usize,
    sha256: String,
}

fn validate_memory_sessions(sessions: &[MemorySession]) -> Result<(), String> {
    let mut ids = HashSet::with_capacity(sessions.len());
    for (index, session) in sessions.iter().enumerate() {
        let record = index + 1;
        if session.id.trim().is_empty() || !ids.insert(session.id.trim()) {
            return Err(format!(
                "El recuerdo {record} tiene un identificador vacío o duplicado"
            ));
        }
        if session.intention.trim().is_empty() || session.started_at.trim().is_empty() {
            return Err(format!(
                "El recuerdo {record} no tiene tema o fecha de inicio"
            ));
        }
        if !matches!(
            session.kind.as_str(),
            "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza"
        ) {
            return Err(format!("El recuerdo {record} tiene un tipo desconocido"));
        }
        if let Some(memory_type) = session.memory_type.as_deref() {
            if !matches!(
                memory_type,
                "semantic" | "procedural" | "preference" | "episodic"
            ) {
                return Err(format!(
                    "El recuerdo {record} tiene una clase de memoria desconocida"
                ));
            }
        }
        if let Some(status) = session.memory_status.as_deref() {
            if !matches!(status, "confirmed" | "conflict" | "archived") {
                return Err(format!("El recuerdo {record} tiene un estado desconocido"));
            }
        }
        if session
            .importance
            .is_some_and(|value| !(1..=5).contains(&value))
        {
            return Err(format!(
                "El recuerdo {record} tiene una importancia fuera de 1 a 5"
            ));
        }
        if session
            .storage_strength
            .is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
        {
            return Err(format!(
                "El recuerdo {record} tiene una consolidación fuera de 0 a 1"
            ));
        }
    }
    Ok(())
}

fn inspect_memory_records(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<Vec<MemorySession>>(&content) {
            Ok(sessions) if validate_memory_sessions(&sessions).is_ok() => {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

fn inspect_memory_manifest(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(value)
                if value.get("format").and_then(|item| item.as_str()) == Some("alice-memory")
                    && value.get("version").and_then(|item| item.as_u64()) == Some(1)
                    && value.get("recordsFile").and_then(|item| item.as_str())
                        == Some("records.json") =>
            {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

pub(crate) fn memory_capability_probe(data_root: &Path) -> MemoryCapabilityProbe {
    let directory = data_root.join("memory");
    MemoryCapabilityProbe {
        directory_exists: directory.is_dir(),
        manifest: inspect_memory_manifest(&directory.join("manifest.json")),
        records: inspect_memory_records(&directory.join("records.json")),
        backup: inspect_memory_records(&directory.join("backups").join("records.backup.json")),
    }
}

fn append_memory_audit(
    path: &Path,
    action: &str,
    session_count: usize,
    content: &str,
) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?;
    let entry = MemoryAuditEntry {
        timestamp_ms: timestamp_ms()?,
        action: action.to_string(),
        session_count,
        sha256: format!("{:x}", Sha256::digest(content.as_bytes())),
    };
    let line = serde_json::to_string(&entry).map_err(|error| error.to_string())?;
    let audit_directory = directory.join("audit");
    fs::create_dir_all(&audit_directory)
        .map_err(|error| format!("No se pudo crear la carpeta de auditoría: {error}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(audit_directory.join("memory-events.jsonl"))
        .map_err(|error| format!("No se pudo abrir la auditoría de memoria: {error}"))?;
    writeln!(file, "{line}").map_err(|error| format!("No se pudo registrar la auditoría: {error}"))
}

fn memory_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = alice_data_root(app)?.join("memory");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    for child in ["backups", "exports", "audit", "attachments", "indexes"] {
        fs::create_dir_all(directory.join(child))
            .map_err(|error| format!("No se pudo crear memory/{child}: {error}"))?;
    }
    let manifest = directory.join("manifest.json");
    if !manifest.exists() {
        let content = serde_json::to_string_pretty(&serde_json::json!({
            "format": "alice-memory",
            "version": 1,
            "recordsFile": "records.json",
            "auditFile": "audit/memory-events.jsonl",
            "private": true,
            "description": "Memoria local, revisable y exportable de Alice"
        }))
        .map_err(|error| error.to_string())?;
        fs::write(&manifest, content)
            .map_err(|error| format!("No se pudo crear el manifiesto de memoria: {error}"))?;
    }
    let legacy_backup = directory.join("sessions.backup.json");
    let current_backup = directory.join("backups").join("records.backup.json");
    if legacy_backup.exists() && !current_backup.exists() {
        fs::copy(&legacy_backup, &current_backup)
            .map_err(|error| format!("No se pudo conservar el respaldo anterior: {error}"))?;
    }
    Ok(directory)
}

fn memory_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = memory_directory(app)?;
    let current = directory.join("records.json");
    let legacy = directory.join("sessions.json");
    if !current.exists() && legacy.exists() {
        let content = fs::read_to_string(&legacy)
            .map_err(|error| format!("No se pudo leer sessions.json: {error}"))?;
        let sessions = serde_json::from_str::<Vec<MemorySession>>(&content)
            .map_err(|error| format!("sessions.json no es una memoria válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        fs::write(&current, &content)
            .map_err(|error| format!("No se pudo migrar la memoria a records.json: {error}"))?;
        append_memory_audit(
            &current,
            "migrate-sessions-to-records",
            sessions.len(),
            &content,
        )?;
    }
    Ok(current)
}

#[tauri::command]
pub(crate) fn load_memory(app: AppHandle) -> Result<MemorySnapshot, String> {
    let path = memory_file(&app)?;
    let existed = path.exists();
    let sessions = if existed {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let sessions: Vec<MemorySession> = serde_json::from_str(&content)
            .map_err(|error| format!("La memoria local no es válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        sessions
    } else {
        Vec::new()
    };
    Ok(MemorySnapshot {
        sessions,
        storage_path: path.display().to_string(),
        existed,
    })
}

#[tauri::command]
pub(crate) fn save_memory(app: AppHandle, sessions: Vec<MemorySession>) -> Result<String, String> {
    validate_memory_sessions(&sessions)?;
    let path = memory_file(&app)?;
    let backup = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("backups")
        .join("records.backup.json");
    if path.exists() {
        fs::copy(&path, &backup)
            .map_err(|error| format!("No se pudo respaldar la memoria: {error}"))?;
    }
    let temporary = path.with_extension("tmp");
    let content = serde_json::to_string_pretty(&sessions).map_err(|error| error.to_string())?;
    fs::write(&temporary, &content)
        .map_err(|error| format!("No se pudo preparar la memoria: {error}"))?;
    fs::copy(&temporary, &path)
        .map_err(|error| format!("No se pudo guardar la memoria: {error}"))?;
    fs::remove_file(&temporary)
        .map_err(|error| format!("No se pudo limpiar el archivo temporal: {error}"))?;
    append_memory_audit(&path, "save", sessions.len(), &content)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub(crate) fn export_memory(app: AppHandle) -> Result<String, String> {
    let path = memory_file(&app)?;
    if !path.exists() {
        return Err("Todavía no existe una memoria local para exportar".into());
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let sessions: Vec<MemorySession> = serde_json::from_str(&content)
        .map_err(|error| format!("La memoria local no es válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let export_directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("exports");
    fs::create_dir_all(&export_directory).map_err(|error| error.to_string())?;
    let export_path = export_directory.join(format!("alice-memory-{}.json", timestamp_ms()?));
    fs::write(&export_path, &content)
        .map_err(|error| format!("No se pudo exportar la memoria: {error}"))?;
    append_memory_audit(&path, "export", sessions.len(), &content)?;
    Ok(export_path.display().to_string())
}

#[tauri::command]
pub(crate) fn restore_memory_backup(app: AppHandle) -> Result<MemorySnapshot, String> {
    let path = memory_file(&app)?;
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?;
    let backup_directory = directory.join("backups");
    let backup = backup_directory.join("records.backup.json");
    if !backup.exists() {
        return Err("No existe un respaldo de memoria para restaurar".into());
    }
    let content = fs::read_to_string(&backup).map_err(|error| error.to_string())?;
    let sessions: Vec<MemorySession> = serde_json::from_str(&content)
        .map_err(|error| format!("El respaldo no es válido: {error}"))?;
    validate_memory_sessions(&sessions)?;
    if path.exists() {
        fs::copy(&path, backup_directory.join("records.pre-restore.json"))
            .map_err(|error| format!("No se pudo proteger la memoria actual: {error}"))?;
    }
    fs::write(&path, &content)
        .map_err(|error| format!("No se pudo restaurar la memoria: {error}"))?;
    append_memory_audit(&path, "restore", sessions.len(), &content)?;
    Ok(MemorySnapshot {
        sessions,
        storage_path: path.display().to_string(),
        existed: true,
    })
}

#[tauri::command]
pub(crate) fn open_memory_directory(app: AppHandle) -> Result<String, String> {
    let directory = memory_directory(&app)?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer.exe")
        .arg(&directory)
        .spawn()
        .map_err(|error| format!("No se pudo abrir la carpeta de memoria: {error}"))?;
    #[cfg(not(target_os = "windows"))]
    return Err("Abrir la carpeta está implementado solo para Windows en esta fase".into());
    Ok(directory.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_probe_root(label: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "alice-memory-probe-{label}-{}-{unique}",
            std::process::id()
        ))
    }

    fn legacy_memory() -> MemorySession {
        serde_json::from_value(serde_json::json!({
            "id": "legacy-1",
            "kind": "Conversación",
            "intention": "Recuerdo anterior",
            "startedAt": "2026-08-06T00:00:00Z"
        }))
        .expect("deserialize legacy memory")
    }

    #[test]
    fn memory_session_round_trip_preserves_camel_case_contract() {
        let session = MemorySession {
            id: "s1".into(),
            kind: "Proyecto".into(),
            intention: "Probar memoria".into(),
            started_at: "2026-08-06T00:00:00Z".into(),
            finished_at: None,
            summary: None,
            next_step: Some("Continuar".into()),
            memory_type: None,
            source: None,
            importance: None,
            storage_strength: None,
            memory_status: None,
            successful_recalls: 0,
            failed_recalls: 0,
            last_recalled_at: None,
            successful_reviews: 0,
            correction_count: 0,
            last_reviewed_at: None,
            context_events: vec![],
        };
        let json = serde_json::to_string(&session).expect("serialize session");
        assert!(json.contains("startedAt"));
        assert!(json.contains("nextStep"));
        assert!(json.contains("storageStrength"));
        let decoded: MemorySession = serde_json::from_str(&json).expect("deserialize session");
        assert_eq!(decoded.intention, "Probar memoria");
    }

    #[test]
    fn legacy_memory_without_learning_fields_remains_compatible() {
        let decoded = legacy_memory();
        assert_eq!(decoded.storage_strength, None);
        assert_eq!(decoded.successful_recalls, 0);
        assert_eq!(decoded.failed_recalls, 0);
        assert_eq!(decoded.successful_reviews, 0);
        assert_eq!(decoded.correction_count, 0);
        assert_eq!(decoded.last_reviewed_at, None);
    }

    #[test]
    fn memory_validation_accepts_legacy_and_rejects_corrupt_records() {
        let legacy = legacy_memory();
        assert!(validate_memory_sessions(std::slice::from_ref(&legacy)).is_ok());

        let mut invalid_importance = legacy.clone();
        invalid_importance.importance = Some(8);
        assert!(validate_memory_sessions(&[invalid_importance]).is_err());

        let mut invalid_strength = legacy.clone();
        invalid_strength.storage_strength = Some(1.5);
        assert!(validate_memory_sessions(&[invalid_strength]).is_err());

        let duplicate = vec![legacy.clone(), legacy];
        assert!(validate_memory_sessions(&duplicate).is_err());
    }

    #[test]
    fn capability_probe_does_not_create_a_missing_data_root() {
        let root = temporary_probe_root("missing");
        assert!(!root.exists());

        assert_eq!(
            memory_capability_probe(&root),
            MemoryCapabilityProbe {
                directory_exists: false,
                manifest: MemoryResourceState::Missing,
                records: MemoryResourceState::Missing,
                backup: MemoryResourceState::Missing,
            }
        );
        assert!(!root.exists());
    }

    #[test]
    fn capability_probe_validates_existing_files_without_modifying_them() {
        let root = temporary_probe_root("valid");
        let memory = root.join("memory");
        let backups = memory.join("backups");
        fs::create_dir_all(&backups).expect("create controlled fixture");
        let manifest = serde_json::json!({
            "format": "alice-memory",
            "version": 1,
            "recordsFile": "records.json"
        })
        .to_string();
        let records = serde_json::to_string(&vec![legacy_memory()]).expect("serialize fixture");
        fs::write(memory.join("manifest.json"), &manifest).expect("write manifest fixture");
        fs::write(memory.join("records.json"), &records).expect("write records fixture");
        fs::write(backups.join("records.backup.json"), &records).expect("write backup fixture");

        assert_eq!(
            memory_capability_probe(&root),
            MemoryCapabilityProbe {
                directory_exists: true,
                manifest: MemoryResourceState::Valid,
                records: MemoryResourceState::Valid,
                backup: MemoryResourceState::Valid,
            }
        );
        assert_eq!(
            fs::read_to_string(memory.join("manifest.json")).expect("read manifest fixture"),
            manifest
        );
        assert_eq!(
            fs::read_to_string(memory.join("records.json")).expect("read records fixture"),
            records
        );
        assert_eq!(
            fs::read_to_string(backups.join("records.backup.json")).expect("read backup fixture"),
            records
        );

        fs::remove_dir_all(root).expect("remove controlled fixture");
    }

    #[test]
    fn capability_probe_reports_invalid_records_without_rewriting_them() {
        let root = temporary_probe_root("invalid");
        let memory = root.join("memory");
        fs::create_dir_all(&memory).expect("create controlled fixture");
        fs::write(memory.join("records.json"), "not-json").expect("write corrupt fixture");

        let probe = memory_capability_probe(&root);
        assert_eq!(probe.records, MemoryResourceState::Invalid);
        assert_eq!(
            fs::read_to_string(memory.join("records.json")).expect("read corrupt fixture"),
            "not-json"
        );

        fs::remove_dir_all(root).expect("remove controlled fixture");
    }
}
