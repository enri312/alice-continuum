//! Shared filesystem primitives, integrity checks and atomic replacement.
use super::model::{MemoryAuditEntry, MemorySession};
use super::validation::validate_memory_sessions;
use crate::util::timestamp_ms;
use sha2::Digest;
use sha2::Sha256;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::MoveFileExW;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::MOVEFILE_REPLACE_EXISTING;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::MOVEFILE_WRITE_THROUGH;

pub(super) fn append_memory_audit(
    path: &Path,
    action: &str,
    session_count: usize,
    content: &str,
) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or("No se encontró el directorio de memoria")?;
    let entry = MemoryAuditEntry {
        timestamp_ms: timestamp_ms()?,
        action: action.to_string(),
        session_count,
        sha256: crate::util::encode_hex_lower(Sha256::digest(content.as_bytes())),
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

pub(super) fn memory_subject_digest(content: &str) -> String {
    format!(
        "sha256:{}",
        crate::util::encode_hex_lower(Sha256::digest(content.as_bytes()))
    )
}

pub(super) fn read_validated_source_at(
    data_root: &Path,
) -> Result<Option<(String, Vec<MemorySession>)>, String> {
    let path = data_root.join("memory").join("records.json");
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("No se pudo leer records.json: {error}")),
    };
    let sessions = serde_json::from_str::<Vec<MemorySession>>(&content)
        .map_err(|error| format!("records.json no es una memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    Ok(Some((content, sessions)))
}

pub(super) fn create_or_verify_exact_file(
    path: &Path,
    content: &str,
    expected_sha256: &str,
    temporary_name: &str,
    description: &str,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{description} no posee directorio"))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo preparar {description}: {error}"))?;
    if path.exists() {
        let stored = fs::read_to_string(path)
            .map_err(|error| format!("No se pudo verificar {description}: {error}"))?;
        if stored != content || memory_subject_digest(&stored) != expected_sha256 {
            return Err(format!("{description} existente no coincide con la fuente"));
        }
        return Ok(());
    }
    atomic_replace_text_file(path, content, temporary_name, description)?;
    let stored = fs::read_to_string(path)
        .map_err(|error| format!("No se pudo releer {description}: {error}"))?;
    if stored != content || memory_subject_digest(&stored) != expected_sha256 {
        return Err(format!("{description} no coincide byte a byte"));
    }
    Ok(())
}

#[cfg(windows)]
pub(super) fn nul_terminated_path(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}

pub(super) fn atomic_replace_text_file(
    destination: &Path,
    content: &str,
    temporary_extension: &str,
    label: &str,
) -> Result<(), String> {
    let temporary = destination.with_extension(temporary_extension);
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("No se pudo crear el temporal atómico {label}: {error}"))?;
    if let Err(error) = file
        .write_all(content.as_bytes())
        .and_then(|()| file.sync_all())
    {
        let _ = fs::remove_file(&temporary);
        return Err(format!("No se pudo preparar el reemplazo {label}: {error}"));
    }
    drop(file);
    #[cfg(windows)]
    let replace = {
        let temporary_wide = nul_terminated_path(&temporary);
        let destination_wide = nul_terminated_path(destination);
        unsafe {
            MoveFileExW(
                PCWSTR(temporary_wide.as_ptr()),
                PCWSTR(destination_wide.as_ptr()),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
    };
    #[cfg(not(windows))]
    let replace = fs::rename(&temporary, destination);
    if let Err(error) = replace {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Falló el reemplazo atómico {label}: {error}"));
    }
    let stored = fs::read_to_string(destination)
        .map_err(|error| format!("No se pudo verificar {label} tras reemplazarlo: {error}"))?;
    if stored != content {
        return Err(format!("{label} no coincide con el contenido reemplazado"));
    }
    Ok(())
}

pub(super) fn atomic_replace_memory_source(
    source_path: &Path,
    content: &str,
    expected_sha256: &str,
) -> Result<(), String> {
    let sessions = serde_json::from_str::<Vec<MemorySession>>(content)
        .map_err(|error| format!("El contenido R6.3-D preparado no es memoria válida: {error}"))?;
    validate_memory_sessions(&sessions)?;
    if memory_subject_digest(content) != expected_sha256 {
        return Err("El contenido R6.3-D preparado no coincide con su SHA-256".into());
    }
    atomic_replace_text_file(source_path, content, "r6-3-d.tmp", "records.json")?;
    let stored = fs::read_to_string(source_path)
        .map_err(|error| format!("No se pudo verificar records.json: {error}"))?;
    if memory_subject_digest(&stored) != expected_sha256 {
        return Err("records.json no coincide con el SHA-256 R6.3-D esperado".into());
    }
    Ok(())
}
