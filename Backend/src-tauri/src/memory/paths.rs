//! Application data directory initialization and legacy migration adapter.
use super::audited_memory_operation;
use super::model::MemorySession;
use super::storage::{append_memory_audit, memory_subject_digest};
use super::validation::validate_memory_sessions;
use crate::util::alice_data_root;
use std::{fs, path::PathBuf};
use tauri::AppHandle;

pub(super) fn memory_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = alice_data_root(app)?.join("memory");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    for child in [
        "backups",
        "exports",
        "audit",
        "attachments",
        "indexes",
        "revisions",
    ] {
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

pub(super) fn memory_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = memory_directory(app)?;
    let current = directory.join("records.json");
    let legacy = directory.join("sessions.json");
    if !current.exists() && legacy.exists() {
        let content = fs::read_to_string(&legacy)
            .map_err(|error| format!("No se pudo leer sessions.json: {error}"))?;
        let sessions = serde_json::from_str::<Vec<MemorySession>>(&content)
            .map_err(|error| format!("sessions.json no es una memoria válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        let digest = memory_subject_digest(&content);
        audited_memory_operation(
            app,
            "memory.records.write",
            "memory.migrate",
            &digest,
            "MEMORY_MIGRATED",
            || {
                fs::write(&current, &content).map_err(|error| {
                    format!("No se pudo migrar la memoria a records.json: {error}")
                })?;
                append_memory_audit(
                    &current,
                    "migrate-sessions-to-records",
                    sessions.len(),
                    &content,
                )
            },
        )?;
    }
    Ok(current)
}
