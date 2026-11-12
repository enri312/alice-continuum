//! Private, project-local voice selection; credentials remain in the process environment.
use serde::Deserialize;
use std::fs;
use std::io::Read;
use std::path::Path;

const FILE: &str = "voice-profile.json";
const MAX_BYTES: u64 = 4 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VoiceProfile {
    schema_version: u8,
    reference_id: String,
}

pub(crate) fn valid_reference_id(value: &str) -> bool {
    (8..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

/// Only absence permits the inherited environment value. A broken local profile
/// must never silently select another voice.
pub(crate) fn resolve_at(root: &Path, inherited_reference: Option<&str>) -> Result<String, String> {
    let path = root.join(FILE);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return inherited_reference.map(str::trim).filter(|value| valid_reference_id(value))
                .map(str::to_string)
                .ok_or_else(|| "No hay una voz válida configurada. Revisa voice-profile.json en la carpeta de datos o ALICE_FISH_REFERENCE_ID.".into());
        }
        Err(_) => return Err("No se pudo consultar el perfil privado de voz; revisa voice-profile.json en la carpeta de datos.".into()),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > MAX_BYTES {
        return Err("El perfil privado de voz no es un archivo válido de hasta 4 KiB.".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path).and_then(|file| file.take(MAX_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|_| "No se pudo leer el perfil privado de voz; revisa voice-profile.json en la carpeta de datos.")?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("El perfil privado de voz supera el límite de 4 KiB.".into());
    }
    if bytes
        .iter()
        .copied()
        .find(|byte| !byte.is_ascii_whitespace())
        != Some(b'{')
    {
        return Err("El perfil privado de voz debe ser un objeto JSON válido.".into());
    }
    let profile: VoiceProfile = serde_json::from_slice(&bytes)
        .map_err(|_| "El perfil privado de voz no tiene un formato válido; revisa voice-profile.json en la carpeta de datos.")?;
    if profile.schema_version != 1 || !valid_reference_id(&profile.reference_id) {
        return Err(
            "El perfil privado de voz contiene una versión o un identificador no válido.".into(),
        );
    }
    Ok(profile.reference_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Store(std::path::PathBuf);
    impl Store {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("alice-voice-profile-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&root).unwrap();
            Self(root)
        }
        fn write(&self, content: &[u8]) {
            fs::write(self.0.join(FILE), content).unwrap();
        }
    }
    impl Drop for Store {
        fn drop(&mut self) {
            if self.0.parent() == Some(std::env::temp_dir().as_path())
                && self.0.file_name().is_some_and(|name| {
                    name.to_string_lossy()
                        .starts_with("alice-voice-profile-test-")
                })
            {
                let path = self.0.join(FILE);
                let _ = fs::remove_file(&path);
                let _ = fs::remove_dir(&path);
                let _ = fs::remove_dir(&self.0);
            }
        }
    }

    #[test]
    fn a_local_profile_wins_and_only_its_absence_allows_the_inherited_reference() {
        let store = Store::new();
        assert_eq!(
            resolve_at(&store.0, Some("  inherited_fixture_voice  ")).unwrap(),
            "inherited_fixture_voice"
        );
        assert!(resolve_at(&store.0, None).is_err());
        assert!(resolve_at(&store.0, Some("invalid profile")).is_err());
        store.write(br#"{"schemaVersion":1,"referenceId":"local_fixture_voice"}"#);
        assert_eq!(
            resolve_at(&store.0, Some("inherited_fixture_voice")).unwrap(),
            "local_fixture_voice"
        );
        assert_eq!(resolve_at(&store.0, None).unwrap(), "local_fixture_voice");
    }

    #[test]
    fn invalid_local_profiles_do_not_fall_back_or_expose_their_content() {
        let store = Store::new();
        for content in [
            br#"{"schemaVersion":1,"referenceId":"secret-invalid-content/voice"}"#.as_slice(),
            br#"{"schemaVersion":2,"referenceId":"local_fixture_voice"}"#.as_slice(),
            br#"{"schemaVersion":1,"referenceId":"local_fixture_voice","unknown":true}"#.as_slice(),
            br#"{"schemaVersion":1,"referenceId":"short"}"#.as_slice(),
            br#"{"schemaVersion":1,"referenceId":" local_fixture_voice "}"#.as_slice(),
            br#"{"schemaVersion":1,"referenceId":null}"#.as_slice(),
            br#"{"schemaVersion":1,"referenceId":"local_fixture_voice","referenceId":"other_fixture_voice"}"#.as_slice(),
            br#"[1,"local_fixture_voice"]"#.as_slice(),
            b"not-json".as_slice(),
        ] {
            store.write(content);
            let before = fs::read(store.0.join(FILE)).unwrap();
            let error = resolve_at(&store.0, Some("inherited_fixture_voice")).unwrap_err();
            assert!(!error.contains("secret-invalid-content"));
            assert!(!error.contains("inherited_fixture_voice"));
            assert_eq!(fs::read(store.0.join(FILE)).unwrap(), before);
        }
    }

    #[test]
    fn a_large_or_non_file_profile_blocks_instead_of_using_the_environment() {
        let store = Store::new();
        store.write(&[b' '; MAX_BYTES as usize + 1]);
        assert!(resolve_at(&store.0, Some("inherited_fixture_voice")).is_err());
        fs::remove_file(store.0.join(FILE)).unwrap();
        fs::create_dir(store.0.join(FILE)).unwrap();
        assert!(resolve_at(&store.0, Some("inherited_fixture_voice")).is_err());
    }

    #[test]
    fn identifiers_keep_the_existing_ascii_contract() {
        for id in ["fixture_1", "fixture-voice_2026", &"a".repeat(128)] {
            assert!(valid_reference_id(id));
        }
        for id in [
            "short",
            "voice with spaces",
            "voice/fixture",
            "voice\nfixture",
            "voz_áéíóú",
            &"a".repeat(129),
        ] {
            assert!(!valid_reference_id(id));
        }
    }
}
