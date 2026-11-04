//! Explicit file selection: bytes only, no renderer-controlled filesystem paths.
use crate::audit::{
    append_event_at, new_operation_id, AuditEvent, AuditOutcome, AuditSource, AuditStage,
    AUDIT_MAX_BYTES,
};
use crate::util::{alice_data_root_path, encode_hex_lower};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const SCRIPT: &str = include_str!("../../scripts/adapters/document_reader.py");
const MAX_BYTES: usize = 16 * 1024 * 1024;
static READER: Mutex<()> = Mutex::new(());

fn python_path() -> Result<PathBuf, String> {
    crate::runtime_paths::python()
}

pub(crate) fn available() -> bool {
    python_path().is_ok_and(|p| p.is_file())
}

fn extract(python: &Path, bytes: Vec<u8>, format: &str) -> Result<Value, String> {
    let mut command = Command::new(python);
    command
        .args(["-I", "-B", "-c", SCRIPT, "--stdin", "--format", format])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut child = command
        .spawn()
        .map_err(|_| "Falta el entorno documental local/venv o ALICE_PYTHON_BIN")?;
    let mut input = child
        .stdin
        .take()
        .ok_or("No se pudo abrir la entrada documental")?;
    let output = child
        .stdout
        .take()
        .ok_or("No se pudo abrir la salida documental")?;
    let writer = std::thread::spawn(move || input.write_all(&bytes));
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        output
            .take(32 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if start.elapsed() < Duration::from_secs(30) => {
                std::thread::sleep(Duration::from_millis(25))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break Err("El lector falló o superó 30 segundos");
            }
        }
    };
    let written = writer.join().map_err(|_| "Falló la entrada documental")?;
    let output = reader
        .join()
        .map_err(|_| "Falló la salida documental")?
        .map_err(|_| "No se pudo leer el resultado documental")?;
    if !status?.success() || written.is_err() || output.len() > 32 * 1024 * 1024 {
        return Err("No se pudo extraer: revise formato, límites y PyMuPDF".into());
    }
    let result: Value =
        serde_json::from_slice(&output).map_err(|_| "Resultado documental inválido")?;
    if !matches!(result["status"].as_str(), Some("ok" | "noText")) {
        return Err("El lector no devolvió texto válido".into());
    }
    Ok(result)
}

fn preview_at(
    root: &Path,
    python: &Path,
    bytes: Vec<u8>,
    format: &str,
    confirmed: bool,
) -> Result<Value, String> {
    if !confirmed {
        return Err("Confirme la lectura local del archivo seleccionado".into());
    }
    if bytes.len() > MAX_BYTES || !matches!(format, "pdf" | "md" | "txt") {
        return Err("Seleccione PDF, MD o TXT de hasta 16 MiB".into());
    }
    let _guard = READER
        .try_lock()
        .map_err(|_| "Ya hay un documento en lectura")?;
    let id = new_operation_id();
    let digest = format!("sha256:{}", encode_hex_lower(Sha256::digest(&bytes)));
    let event = |stage, outcome, reason| {
        AuditEvent::producer(
            id.clone(),
            AuditSource::Memory,
            "memory.document.preview".into(),
            "preview_document".into(),
            stage,
            outcome,
            None,
            Some(digest.clone()),
            reason,
        )
    };
    append_event_at(
        root,
        &event(
            AuditStage::Request,
            AuditOutcome::Pending,
            "DOCUMENT_PREVIEW_REQUESTED",
        )?,
        AUDIT_MAX_BYTES,
    )?;
    let result = extract(python, bytes, format);
    let (stage, outcome, reason) = if result.is_ok() {
        (
            AuditStage::Execution,
            AuditOutcome::Success,
            "DOCUMENT_PREVIEW_COMPLETED",
        )
    } else {
        (
            AuditStage::Error,
            AuditOutcome::Error,
            "DOCUMENT_PREVIEW_FAILED",
        )
    };
    append_event_at(root, &event(stage, outcome, reason)?, AUDIT_MAX_BYTES)?;
    result
}

#[tauri::command]
pub(crate) async fn preview_document(
    app: AppHandle,
    bytes: Vec<u8>,
    format: String,
    confirmed: bool,
) -> Result<Value, String> {
    let root = alice_data_root_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        preview_at(&root, &python_path()?, bytes, &format, confirmed)
    })
    .await
    .map_err(|_| "Se interrumpió el lector documental")?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_without_confirmation_or_supported_format() {
        let root = std::env::temp_dir().join(format!("alice-document-{}", uuid::Uuid::new_v4()));
        assert!(preview_at(&root, Path::new("missing"), vec![], "md", false).is_err());
        assert!(preview_at(&root, Path::new("missing"), vec![], "exe", true).is_err());
        assert!(!root.exists());
    }
    #[test]
    #[ignore = "Uses installed local document runtime and actual project manual"]
    fn live_document_manual_with_real_runtime() {
        let root = std::env::temp_dir().join(format!("alice-document-{}", uuid::Uuid::new_v4()));
        let bytes =
            std::fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("../docs/MANUAL_DE_USO.md"))
                .unwrap();
        let result = preview_at(&root, &python_path().unwrap(), bytes, "md", true).unwrap();
        assert_eq!(result["memoryWritten"], false);
        assert!(!result["chunks"].as_array().unwrap().is_empty());
        assert!(!root.join("memory").exists());
        assert!(root.join("audit/events-v1.jsonl").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
