use crate::util::alice_data_root_path;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path};
use tauri::AppHandle;

const OWNER_PROFILE_SCHEMA_VERSION: u8 = 1;
const OWNER_PROFILE_FILE: &str = "owner-profile.json";
const MAX_PROFILE_RECORDS: usize = 64;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct OwnerProfileSource {
    file: String,
    sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct OwnerProfileRecord {
    id: String,
    kind: String,
    intention: String,
    summary: String,
    source: String,
    memory_status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct OwnerProfileDocument {
    schema_version: u8,
    owner_name: String,
    confirmed_by: String,
    confirmed_at: String,
    source_files: Vec<OwnerProfileSource>,
    records: Vec<OwnerProfileRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OwnerProfileSnapshot {
    state: &'static str,
    storage_path: String,
    owner_name: Option<String>,
    confirmed_by: Option<String>,
    confirmed_at: Option<String>,
    source_files: Vec<OwnerProfileSource>,
    records: Vec<OwnerProfileRecord>,
}

fn is_sha256(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_owner_profile(document: &OwnerProfileDocument) -> Result<(), String> {
    if document.schema_version != OWNER_PROFILE_SCHEMA_VERSION {
        return Err(format!(
            "Versión de perfil no admitida: {}",
            document.schema_version
        ));
    }
    if document.owner_name.trim().is_empty()
        || document.confirmed_by.trim().is_empty()
        || document.confirmed_at.trim().is_empty()
    {
        return Err("El perfil no identifica al propietario o su confirmación".into());
    }
    if document.source_files.is_empty() {
        return Err("El perfil no declara fuentes verificables".into());
    }
    let mut source_names = HashSet::with_capacity(document.source_files.len());
    for source in &document.source_files {
        if source.file.trim().is_empty()
            || !source_names.insert(source.file.trim())
            || !is_sha256(&source.sha256)
        {
            return Err(
                "El perfil contiene una fuente vacía, duplicada o sin SHA-256 válido".into(),
            );
        }
    }
    if document.records.is_empty() || document.records.len() > MAX_PROFILE_RECORDS {
        return Err(format!(
            "El perfil debe contener entre 1 y {MAX_PROFILE_RECORDS} recuerdos"
        ));
    }
    let mut record_ids = HashSet::with_capacity(document.records.len());
    for record in &document.records {
        if record.id.trim().is_empty() || !record_ids.insert(record.id.trim()) {
            return Err("El perfil contiene identificadores vacíos o duplicados".into());
        }
        if record.kind != "Perfil"
            || record.memory_status != "confirmed"
            || record.intention.trim().is_empty()
            || record.summary.trim().is_empty()
            || record.source.trim().is_empty()
        {
            return Err("El perfil contiene un recuerdo incompleto o no confirmado".into());
        }
    }
    Ok(())
}

fn verify_owner_profile_sources(
    data_root: &Path,
    sources: &[OwnerProfileSource],
) -> Result<(), String> {
    for source in sources {
        let relative = Path::new(&source.file);
        if relative.is_absolute()
            || relative
                .components()
                .any(|component| !matches!(component, Component::Normal(_)))
        {
            return Err(format!(
                "Ruta de fuente privada no permitida: {}",
                source.file
            ));
        }
        let path = data_root.join("memory").join(relative);
        let bytes = fs::read(&path)
            .map_err(|error| format!("No se pudo verificar la fuente {}: {error}", source.file))?;
        let actual = format!(
            "sha256:{}",
            crate::util::encode_hex_lower(Sha256::digest(&bytes))
        );
        if actual != source.sha256.to_lowercase() {
            return Err(format!("La fuente privada cambió: {}", source.file));
        }
    }
    Ok(())
}

fn load_owner_profile_at(data_root: &Path) -> Result<OwnerProfileSnapshot, String> {
    let path = data_root.join("memory").join(OWNER_PROFILE_FILE);
    if !path.is_file() {
        return Ok(OwnerProfileSnapshot {
            state: "missing",
            storage_path: path.display().to_string(),
            owner_name: None,
            confirmed_by: None,
            confirmed_at: None,
            source_files: Vec::new(),
            records: Vec::new(),
        });
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("No se pudo leer el perfil privado: {error}"))?;
    let document: OwnerProfileDocument = serde_json::from_str(&content)
        .map_err(|error| format!("El perfil privado no es válido: {error}"))?;
    validate_owner_profile(&document)?;
    verify_owner_profile_sources(data_root, &document.source_files)?;
    Ok(OwnerProfileSnapshot {
        state: "available",
        storage_path: path.display().to_string(),
        owner_name: Some(document.owner_name),
        confirmed_by: Some(document.confirmed_by),
        confirmed_at: Some(document.confirmed_at),
        source_files: document.source_files,
        records: document.records,
    })
}

#[tauri::command]
pub(crate) fn owner_profile_status(app: AppHandle) -> Result<OwnerProfileSnapshot, String> {
    load_owner_profile_at(&alice_data_root_path(&app)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_root(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("alice-owner-profile-{label}-{nonce}"))
    }

    #[test]
    fn missing_profile_is_reported_without_creating_files() {
        let root = temporary_root("missing");
        let snapshot = load_owner_profile_at(&root).expect("missing profile snapshot");
        assert_eq!(snapshot.state, "missing");
        assert!(snapshot.records.is_empty());
        assert!(!root.exists());
    }

    #[test]
    fn rejects_unconfirmed_or_untraceable_records() {
        let document = OwnerProfileDocument {
            schema_version: 1,
            owner_name: "Carlos".into(),
            confirmed_by: "Carlos".into(),
            confirmed_at: "2026-08-17T21:00:00-03:00".into(),
            source_files: vec![OwnerProfileSource {
                file: "source.md".into(),
                sha256: format!("sha256:{}", "a".repeat(64)),
            }],
            records: vec![OwnerProfileRecord {
                id: "profile.identity".into(),
                kind: "Perfil".into(),
                intention: "Identidad".into(),
                summary: "Carlos".into(),
                source: "source.md".into(),
                memory_status: "draft".into(),
            }],
        };
        assert!(validate_owner_profile(&document).is_err());
    }

    #[test]
    fn source_verification_reads_real_bytes_and_rejects_tampering() {
        let root = temporary_root("source-hash");
        let source_directory = root.join("memory").join("notes");
        fs::create_dir_all(&source_directory).expect("source directory");
        let source_path = source_directory.join("profile.md");
        fs::write(&source_path, b"perfil confirmado").expect("source file");
        let expected = format!(
            "sha256:{}",
            crate::util::encode_hex_lower(Sha256::digest(b"perfil confirmado"))
        );
        let source = OwnerProfileSource {
            file: "notes/profile.md".into(),
            sha256: expected,
        };
        verify_owner_profile_sources(&root, std::slice::from_ref(&source))
            .expect("matching source");
        fs::write(&source_path, b"perfil alterado").expect("tamper source");
        assert!(verify_owner_profile_sources(&root, &[source]).is_err());
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_private_profile_validates_the_real_sources() {
        let root = std::env::var("ALICE_LIVE_DATA_DIR")
            .expect("ALICE_LIVE_DATA_DIR requerido para la prueba real");
        let snapshot = load_owner_profile_at(Path::new(&root)).expect("live owner profile");
        assert_eq!(snapshot.state, "available");
        assert!(!snapshot.records.is_empty());
        assert_eq!(snapshot.source_files.len(), 3);
    }
}
