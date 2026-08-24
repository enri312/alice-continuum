use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const FACE_READINESS_SCHEMA_VERSION: u32 = 1;
const FACE_CAPABILITY_ID: &str = "perception.face.landmarks";
const FACE_MODEL_FILE: &str = "face_landmarker_float16_v1.task";
const EXPECTED_MODEL_SHA256: &str =
    "64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FaceReadinessStatus {
    schema_version: u32,
    capability_id: &'static str,
    model: FaceModelReadiness,
    runtime: FaceRuntimeReadiness,
    sensor_opened: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FaceModelReadiness {
    file_name: &'static str,
    state: FaceModelState,
    size_bytes: u64,
    sha256: Option<String>,
    detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum FaceModelState {
    Verified,
    Missing,
    Mismatch,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FaceRuntimeReadiness {
    available: bool,
    detail: String,
}

fn local_face_model_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
        .join("Assets")
        .join("Models")
        .join("private")
        .join(FACE_MODEL_FILE)
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let bytes_read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if bytes_read == 0 {
            break;
        }
        digest.update(&buffer[..bytes_read]);
    }
    Ok(crate::util::encode_hex_upper(digest.finalize()))
}

fn face_model_readiness_at(path: &Path, expected_hash: &str) -> FaceModelReadiness {
    let metadata = match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => metadata,
        Ok(_) => {
            return FaceModelReadiness {
                file_name: FACE_MODEL_FILE,
                state: FaceModelState::Missing,
                size_bytes: 0,
                sha256: None,
                detail: "La ruta del modelo no es un archivo regular.".into(),
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return FaceModelReadiness {
                file_name: FACE_MODEL_FILE,
                state: FaceModelState::Missing,
                size_bytes: 0,
                sha256: None,
                detail: "Modelo local no encontrado; no se iniciará análisis facial.".into(),
            }
        }
        Err(error) => {
            return FaceModelReadiness {
                file_name: FACE_MODEL_FILE,
                state: FaceModelState::Error,
                size_bytes: 0,
                sha256: None,
                detail: format!("No se pudo inspeccionar el modelo: {error}"),
            }
        }
    };

    match sha256_file(path) {
        Ok(actual_hash) if actual_hash == expected_hash => FaceModelReadiness {
            file_name: FACE_MODEL_FILE,
            state: FaceModelState::Verified,
            size_bytes: metadata.len(),
            sha256: Some(actual_hash),
            detail: "Modelo local verificado por SHA-256; todavía no se cargó ni analizó video."
                .into(),
        },
        Ok(actual_hash) => FaceModelReadiness {
            file_name: FACE_MODEL_FILE,
            state: FaceModelState::Mismatch,
            size_bytes: metadata.len(),
            sha256: Some(actual_hash),
            detail: "La huella no coincide; el diagnóstico facial permanece bloqueado.".into(),
        },
        Err(error) => FaceModelReadiness {
            file_name: FACE_MODEL_FILE,
            state: FaceModelState::Error,
            size_bytes: metadata.len(),
            sha256: None,
            detail: format!("No se pudo calcular SHA-256: {error}"),
        },
    }
}

fn face_runtime_readiness() -> FaceRuntimeReadiness {
    let mut command = Command::new("python");
    command
        .args([
            "-c",
            "import cv2, mediapipe, numpy, sys; print(f'Python {sys.version.split()[0]} · OpenCV {cv2.__version__} · MediaPipe {mediapipe.__version__} · NumPy {numpy.__version__}')",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("PYTHONDONTWRITEBYTECODE", "1");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    match command.output() {
        Ok(output) if output.status.success() => FaceRuntimeReadiness {
            available: true,
            detail: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        },
        Ok(_) => FaceRuntimeReadiness {
            available: false,
            detail: "Python, OpenCV, MediaPipe o NumPy no están disponibles para la sonda local."
                .into(),
        },
        Err(error) => FaceRuntimeReadiness {
            available: false,
            detail: format!("No se pudo iniciar la comprobación local: {error}"),
        },
    }
}

#[tauri::command]
pub(crate) fn face_readiness_status() -> FaceReadinessStatus {
    FaceReadinessStatus {
        schema_version: FACE_READINESS_SCHEMA_VERSION,
        capability_id: FACE_CAPABILITY_ID,
        model: face_model_readiness_at(&local_face_model_path(), EXPECTED_MODEL_SHA256),
        runtime: face_runtime_readiness(),
        sensor_opened: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("alice-face-readiness-{label}-{nonce}.task"))
    }

    #[test]
    fn missing_model_is_reported_without_creating_any_file() {
        let path = temporary_path("missing");
        let readiness = face_model_readiness_at(&path, EXPECTED_MODEL_SHA256);
        assert_eq!(readiness.state, FaceModelState::Missing);
        assert_eq!(readiness.size_bytes, 0);
        assert!(readiness.sha256.is_none());
        assert!(!path.exists());
    }

    #[test]
    fn model_hash_is_verified_or_rejected_without_loading_a_camera() {
        let path = temporary_path("hash");
        fs::write(&path, b"face-model-fixture").unwrap();
        let expected_hash = sha256_file(&path).unwrap();

        let verified = face_model_readiness_at(&path, &expected_hash);
        assert_eq!(verified.state, FaceModelState::Verified);
        assert_eq!(verified.size_bytes, 18);
        assert_eq!(verified.sha256.as_deref(), Some(expected_hash.as_str()));

        let rejected = face_model_readiness_at(&path, EXPECTED_MODEL_SHA256);
        assert_eq!(rejected.state, FaceModelState::Mismatch);
        assert_eq!(rejected.size_bytes, 18);
        fs::remove_file(path).unwrap();
    }

    #[test]
    #[ignore = "requiere el modelo facial privado y el runtime Python local"]
    fn live_private_readiness_checks_runtime_without_opening_a_sensor() {
        let status = face_readiness_status();
        assert_eq!(status.schema_version, FACE_READINESS_SCHEMA_VERSION);
        assert_eq!(status.capability_id, FACE_CAPABILITY_ID);
        assert!(!status.sensor_opened);
        assert_eq!(status.model.state, FaceModelState::Verified);
        assert_eq!(status.model.sha256.as_deref(), Some(EXPECTED_MODEL_SHA256));
        assert!(status.runtime.available, "{}", status.runtime.detail);
    }
}
