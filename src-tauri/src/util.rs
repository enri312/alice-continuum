use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub(crate) fn encode_hex_lower(bytes: impl AsRef<[u8]>) -> String {
    encode_hex(bytes.as_ref(), b"0123456789abcdef")
}

pub(crate) fn encode_hex_upper(bytes: impl AsRef<[u8]>) -> String {
    encode_hex(bytes.as_ref(), b"0123456789ABCDEF")
}

fn encode_hex(bytes: &[u8], alphabet: &[u8; 16]) -> String {
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(alphabet[(byte >> 4) as usize] as char);
        encoded.push(alphabet[(byte & 0x0f) as usize] as char);
    }
    encoded
}

pub(crate) fn timestamp_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

pub(crate) fn alice_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = alice_data_root_path(app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("No se pudo crear la carpeta de datos de Alice: {error}"))?;
    Ok(directory)
}

pub(crate) fn alice_data_root_path(app: &AppHandle) -> Result<PathBuf, String> {
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
    Ok(directory)
}

#[cfg(test)]
mod tests {
    use super::{encode_hex_lower, encode_hex_upper};

    #[test]
    fn hexadecimal_encoding_preserves_every_nibble_and_case() {
        let bytes = [0x00, 0x0f, 0x10, 0xab, 0xcd, 0xef, 0xff];

        assert_eq!(encode_hex_lower(bytes), "000f10abcdefff");
        assert_eq!(encode_hex_upper(bytes), "000F10ABCDEFFF");
    }
}
