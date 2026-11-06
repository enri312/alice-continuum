//! Path-based record persistence. The command facade owns locking and R3 auditing.
use super::model::MemorySession;
use super::storage::{append_memory_audit, atomic_replace_text_file};
use super::validation::{validate_generic_memory_update, validate_memory_sessions};
use crate::util::timestamp_ms;
use std::{
    fs,
    path::{Path, PathBuf},
};

// The facade validates incoming records before opening/initializing any data path.
pub(super) fn prepare_validated_save_at(
    path: &Path,
    sessions: &[MemorySession],
) -> Result<String, String> {
    if path.exists() {
        let existing_content = fs::read_to_string(path)
            .map_err(|error| format!("No se pudo verificar la memoria anterior: {error}"))?;
        let existing: Vec<MemorySession> = serde_json::from_str(&existing_content)
            .map_err(|error| format!("La memoria anterior no es válida: {error}"))?;
        validate_memory_sessions(&existing)?;
        validate_generic_memory_update(&existing, sessions)?;
    }
    // Preserve the old directory precondition before serialization and audit.
    path.parent()
        .ok_or("No se encontró el directorio de memoria")?;
    serde_json::to_string_pretty(sessions).map_err(|error| error.to_string())
}

pub(super) fn save_prepared_at(
    path: &Path,
    content: &str,
    session_count: usize,
) -> Result<(), String> {
    let backup = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("backups")
        .join("records.backup.json");
    replace_audited_records(path, content, session_count, "save", &backup)
}

// The facade holds the memory write lock throughout backup, replacement and audit.
// This recovers reported I/O failures, not a multi-file transaction across power loss.
fn replace_audited_records(
    path: &Path,
    content: &str,
    session_count: usize,
    action: &str,
    backup: &Path,
) -> Result<(), String> {
    let previous = match fs::read_to_string(path) {
        Ok(previous) => Some(previous),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("No se pudo proteger la memoria anterior: {error}")),
    };
    if let Some(previous) = &previous {
        atomic_replace_text_file(backup, previous, "backup.tmp", "respaldo de memoria")?;
    }
    let result = atomic_replace_text_file(path, content, "write.tmp", "records.json")
        .and_then(|()| append_memory_audit(path, action, session_count, content));
    if let Err(error) = result {
        let unchanged = match fs::read_to_string(path) {
            Ok(current) => previous.as_ref() == Some(&current),
            Err(read_error) => {
                read_error.kind() == std::io::ErrorKind::NotFound && previous.is_none()
            }
        };
        if !unchanged {
            let rollback = match &previous {
                Some(previous) => {
                    atomic_replace_text_file(path, previous, "rollback.tmp", "memoria anterior")
                }
                None => fs::remove_file(path).map_err(|error| error.to_string()),
            };
            if let Err(rollback_error) = rollback {
                let recovery = if previous.is_some() {
                    format!(
                        "Revisá el respaldo en {} antes de reintentar",
                        backup.display()
                    )
                } else {
                    "Antes no existía records.json; revisá el archivo creado antes de reintentar"
                        .into()
                };
                return Err(format!(
                    "{error}. Además falló la recuperación de records.json: {rollback_error}. {recovery}"
                ));
            }
        }
        return Err(error);
    }
    Ok(())
}

pub(super) struct PreparedExport {
    pub(super) content: String,
    directory: PathBuf,
    session_count: usize,
}

pub(super) fn prepare_export_at(path: &Path) -> Result<PreparedExport, String> {
    if !path.exists() {
        return Err("Todavía no existe una memoria local para exportar".into());
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let sessions: Vec<MemorySession> = serde_json::from_str(&content)
        .map_err(|error| format!("La memoria local no es válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?
        .join("exports");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(PreparedExport {
        content,
        directory,
        session_count: sessions.len(),
    })
}

pub(super) fn export_prepared_at(
    path: &Path,
    prepared: &PreparedExport,
) -> Result<PathBuf, String> {
    let export_path = prepared
        .directory
        .join(format!("alice-memory-{}.json", timestamp_ms()?));
    fs::write(&export_path, &prepared.content)
        .map_err(|error| format!("No se pudo exportar la memoria: {error}"))?;
    append_memory_audit(path, "export", prepared.session_count, &prepared.content)?;
    Ok(export_path)
}

pub(super) struct PreparedRestore {
    pub(super) content: String,
    pub(super) sessions: Vec<MemorySession>,
    backup_directory: PathBuf,
}

pub(super) fn prepare_restore_at(path: &Path) -> Result<PreparedRestore, String> {
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
    Ok(PreparedRestore {
        content,
        sessions,
        backup_directory,
    })
}

pub(super) fn restore_prepared_at(path: &Path, prepared: &PreparedRestore) -> Result<(), String> {
    replace_audited_records(
        path,
        &prepared.content,
        prepared.sessions.len(),
        "restore",
        &prepared.backup_directory.join("records.pre-restore.json"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(title: &str, confirmed: bool) -> Vec<MemorySession> {
        serde_json::from_value(serde_json::json!([{
            "id":"record-fixture", "kind":"Enseñanza", "intention":title,
            "startedAt":"2026-11-04T12:00:00Z", "memoryType":"semantic",
            "memoryStatus":if confirmed {Some("confirmed")} else {None}
        }]))
        .unwrap()
    }

    struct TestStore {
        root: PathBuf,
    }

    impl TestStore {
        fn path(&self) -> PathBuf {
            self.root.join("memory/records.json")
        }
    }

    impl Drop for TestStore {
        fn drop(&mut self) {
            let temporary_root = std::env::temp_dir();
            if self.root.parent() == Some(temporary_root.as_path())
                && self
                    .root
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("alice-records-test-"))
            {
                let _ = fs::remove_dir_all(&self.root);
            }
        }
    }

    fn fixture() -> TestStore {
        let store = TestStore {
            root: std::env::temp_dir().join(format!("alice-records-test-{}", uuid::Uuid::new_v4())),
        };
        let path = store.path();
        fs::create_dir_all(path.parent().unwrap().join("backups")).unwrap();
        store
    }

    #[test]
    fn read_missing_source_does_not_create_a_store() {
        let path = std::env::temp_dir()
            .join(format!("alice-read-missing-{}", uuid::Uuid::new_v4()))
            .join("records.json");
        let snapshot = super::super::queries::load_memory_at(&path).unwrap();
        assert!(!snapshot.existed);
        assert!(snapshot.sessions.is_empty());
        assert!(!path.parent().unwrap().exists());
    }

    #[test]
    fn read_missing_note_catalog_does_not_initialize_memory() {
        let directory =
            std::env::temp_dir().join(format!("alice-notes-missing-{}", uuid::Uuid::new_v4()));
        let snapshot = super::super::queries::markdown_note_catalog_at(&directory).unwrap();
        assert!(!snapshot.vault_exists);
        assert_eq!(snapshot.note_count, 0);
        assert!(!directory.exists());
    }

    #[test]
    fn rejected_confirmed_edit_leaves_source_and_backups_untouched() {
        let store = fixture();
        let path = store.path();
        let original = serde_json::to_string_pretty(&source("Dato confirmado", true)).unwrap();
        fs::write(&path, &original).unwrap();
        let next = source("Cambio sin reconsolidar", true);
        validate_memory_sessions(&next).unwrap();
        assert!(prepare_validated_save_at(&path, &next).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
        assert!(!path.with_extension("tmp").exists());
        assert!(!path
            .parent()
            .unwrap()
            .join("backups/records.backup.json")
            .exists());
    }

    #[test]
    fn save_and_restore_preserve_exact_previous_bytes() {
        let store = fixture();
        let path = store.path();
        let original = format!(
            "\n{}\n",
            serde_json::to_string_pretty(&source("Original", false)).unwrap()
        );
        fs::write(&path, &original).unwrap();
        let next = source("Actualizado", false);
        validate_memory_sessions(&next).unwrap();
        let prepared = prepare_validated_save_at(&path, &next).unwrap();
        save_prepared_at(&path, &prepared, next.len()).unwrap();
        assert_eq!(
            fs::read_to_string(path.parent().unwrap().join("backups/records.backup.json")).unwrap(),
            original
        );
        assert!(!path.with_extension("tmp").exists());
        let restore = prepare_restore_at(&path).unwrap();
        restore_prepared_at(&path, &restore).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
        assert_eq!(
            fs::read_to_string(
                path.parent()
                    .unwrap()
                    .join("backups/records.pre-restore.json")
            )
            .unwrap(),
            prepared
        );
    }

    #[test]
    fn export_copies_exact_source_without_mutating_it() {
        let store = fixture();
        let path = store.path();
        let content = format!(
            "\n{}\n",
            serde_json::to_string_pretty(&source("Exportar", false)).unwrap()
        );
        fs::write(&path, &content).unwrap();
        let prepared = prepare_export_at(&path).unwrap();
        let exported = export_prepared_at(&path, &prepared).unwrap();
        assert_eq!(fs::read_to_string(exported).unwrap(), content);
        assert_eq!(fs::read_to_string(path).unwrap(), content);
    }

    #[test]
    fn audit_failure_recovers_save_and_restore_with_and_without_previous_source() {
        for restore in [false, true] {
            for existed in [false, true] {
                let store = fixture();
                let path = store.path();
                let directory = path.parent().unwrap();
                let previous = format!(
                    "\n{}\n",
                    serde_json::to_string(&source("Anterior", false)).unwrap()
                );
                let next = source("Nuevo", false);
                let content = serde_json::to_string_pretty(&next).unwrap();
                if existed {
                    fs::write(&path, &previous).unwrap();
                }
                fs::write(directory.join("backups/records.backup.json"), &content).unwrap();
                let audit = directory.join("audit/memory-events.jsonl");
                fs::create_dir_all(&audit).unwrap();
                let execute = || {
                    if restore {
                        restore_prepared_at(&path, &prepare_restore_at(&path)?)
                    } else {
                        let content = prepare_validated_save_at(&path, &next)?;
                        save_prepared_at(&path, &content, next.len())
                    }
                };
                let error = execute().unwrap_err();
                assert!(error.contains("auditoría"), "{error}");
                assert_eq!(path.exists(), existed);
                if existed {
                    assert_eq!(fs::read_to_string(&path).unwrap(), previous);
                    let backup = if restore {
                        "records.pre-restore.json"
                    } else {
                        "records.backup.json"
                    };
                    assert_eq!(
                        fs::read_to_string(directory.join("backups").join(backup)).unwrap(),
                        previous
                    );
                }
                assert!(!path.with_extension("write.tmp").exists());
                assert!(!path.with_extension("rollback.tmp").exists());
                // Removing only the injected empty directory makes the same operation retryable.
                fs::remove_dir(&audit).unwrap();
                execute().unwrap();
                assert_eq!(fs::read_to_string(&path).unwrap(), content);
                let entries = fs::read_to_string(audit).unwrap();
                assert_eq!(entries.lines().count(), 1);
                let entry: serde_json::Value = serde_json::from_str(entries.trim()).unwrap();
                assert_eq!(entry["action"], if restore { "restore" } else { "save" });
            }
        }
    }

    #[test]
    fn failed_atomic_preparation_keeps_source_and_does_not_audit() {
        let store = fixture();
        let path = store.path();
        let previous = serde_json::to_string(&source("Anterior", false)).unwrap();
        fs::write(&path, &previous).unwrap();
        let stale = path.with_extension("write.tmp");
        fs::write(&stale, "temporal ajeno a esta operación").unwrap();
        let next = source("Nuevo", false);
        let content = prepare_validated_save_at(&path, &next).unwrap();
        assert!(save_prepared_at(&path, &content, next.len()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), previous);
        assert_eq!(
            fs::read_to_string(stale).unwrap(),
            "temporal ajeno a esta operación"
        );
        assert!(!path
            .parent()
            .unwrap()
            .join("audit/memory-events.jsonl")
            .exists());
    }

    #[test]
    fn failed_recovery_reports_both_errors_and_retains_exact_backup() {
        let store = fixture();
        let path = store.path();
        let previous = format!(
            "\n{}\n",
            serde_json::to_string(&source("Anterior", false)).unwrap()
        );
        fs::write(&path, &previous).unwrap();
        fs::create_dir_all(path.parent().unwrap().join("audit/memory-events.jsonl")).unwrap();
        // An independently blocked recovery destination must not be hidden by the audit error.
        fs::create_dir(path.with_extension("rollback.tmp")).unwrap();
        let next = source("Nuevo", false);
        let content = prepare_validated_save_at(&path, &next).unwrap();
        let error = save_prepared_at(&path, &content, next.len()).unwrap_err();
        assert!(error.contains("auditoría"), "{error}");
        assert!(error.contains("falló la recuperación"), "{error}");
        assert!(error.contains("records.backup.json"), "{error}");
        assert_eq!(
            fs::read_to_string(path.parent().unwrap().join("backups/records.backup.json")).unwrap(),
            previous
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), content);
    }
}
