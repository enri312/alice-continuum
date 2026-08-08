use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub(crate) fn timestamp_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

pub(crate) fn alice_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = match std::env::var_os("ALICE_DATA_DIR") {
        Some(value) if !value.is_empty() => {
            let configured = PathBuf::from(value);
            if !configured.is_absolute() {
                return Err("ALICE_DATA_DIR debe contener una ruta absoluta".into());
            }
            configured
        }
        _ => app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?,
    };
    fs::create_dir_all(&directory)
        .map_err(|error| format!("No se pudo crear la carpeta de datos de Alice: {error}"))?;
    Ok(directory)
}
