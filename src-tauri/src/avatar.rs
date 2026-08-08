use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AvatarStatus {
    available: bool,
    path: String,
    file_name: String,
    size_bytes: u64,
}

fn validate_avatar_path(path: PathBuf) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("ALICE_AVATAR_PATH debe contener una ruta absoluta".into());
    }
    if !path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("vrm"))
    {
        return Err("El avatar local debe ser un archivo .vrm".into());
    }
    Ok(path)
}

fn local_avatar_path() -> Result<PathBuf, String> {
    let path = std::env::var_os("ALICE_AVATAR_PATH")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")))
                .join("Assets")
                .join("Alice.vrm")
        });
    validate_avatar_path(path)
}

#[tauri::command]
pub(crate) fn avatar_status() -> Result<AvatarStatus, String> {
    let path = local_avatar_path()?;
    let metadata = fs::metadata(&path).ok().filter(|value| value.is_file());
    Ok(AvatarStatus {
        available: metadata.is_some(),
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Alice.vrm")
            .to_string(),
        size_bytes: metadata.map(|value| value.len()).unwrap_or(0),
        path: path.display().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avatar_path_requires_an_absolute_vrm_file() {
        assert_eq!(
            validate_avatar_path(PathBuf::from("Alice.vrm")),
            Err("ALICE_AVATAR_PATH debe contener una ruta absoluta".into())
        );
        let invalid = std::env::temp_dir().join("Alice.png");
        assert_eq!(
            validate_avatar_path(invalid),
            Err("El avatar local debe ser un archivo .vrm".into())
        );
    }

    #[test]
    fn avatar_path_accepts_vrm_extension_case_insensitively() {
        let path = std::env::temp_dir().join("Alice.VRM");
        assert_eq!(validate_avatar_path(path.clone()), Ok(path));
    }
}
