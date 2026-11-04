//! Path-based record persistence. The command facade owns locking and R3 auditing.
use super::model::MemorySession;
use super::storage::append_memory_audit;
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
    let temporary = path.with_extension("tmp");
    if path.exists() {
        fs::copy(path, &backup)
            .map_err(|error| format!("No se pudo respaldar la memoria: {error}"))?;
    }
    fs::write(&temporary, content)
        .map_err(|error| format!("No se pudo preparar la memoria: {error}"))?;
    fs::copy(&temporary, path)
        .map_err(|error| format!("No se pudo guardar la memoria: {error}"))?;
    fs::remove_file(&temporary)
        .map_err(|error| format!("No se pudo limpiar el archivo temporal: {error}"))?;
    append_memory_audit(path, "save", session_count, content)
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
    if path.exists() {
        fs::copy(
            path,
            prepared.backup_directory.join("records.pre-restore.json"),
        )
        .map_err(|error| format!("No se pudo proteger la memoria actual: {error}"))?;
    }
    fs::write(path, &prepared.content)
        .map_err(|error| format!("No se pudo restaurar la memoria: {error}"))?;
    append_memory_audit(path, "restore", prepared.sessions.len(), &prepared.content)
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
}
