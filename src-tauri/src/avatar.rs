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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AvatarAnimationStatus {
    clips: Vec<AvatarAnimationClipStatus>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AvatarAnimationClipStatus {
    id: &'static str,
    path: String,
    available: bool,
    size_bytes: u64,
}

const AVATAR_ANIMATION_FILES: [(&str, &str); 9] = [
    ("idle", "Idle.fbx"),
    ("forward", "Walking.fbx"),
    ("backward", "Walking Backwards.fbx"),
    ("left", "Left Strafe Walking.fbx"),
    ("right", "Right Strafe Walking.fbx"),
    ("jump", "Jump.fbx"),
    ("run", "Run Forward.fbx"),
    ("turn-left", "Left Turn.fbx"),
    ("turn-right", "Right Turn.fbx"),
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct AvatarCapabilityProbe {
    pub(crate) available: bool,
    pub(crate) size_bytes: u64,
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

fn local_animation_directory() -> Result<PathBuf, String> {
    let path = std::env::var_os("ALICE_ANIMATION_DIR")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")))
                .join("Assets")
                .join("Animations")
                .join("private")
                .join("mixamo")
        });
    if !path.is_absolute() {
        return Err("ALICE_ANIMATION_DIR debe contener una ruta absoluta".into());
    }
    Ok(path)
}

fn avatar_capability_probe_at(path: PathBuf) -> Result<AvatarCapabilityProbe, String> {
    let path = validate_avatar_path(path)?;
    let metadata = fs::metadata(path).ok().filter(|value| value.is_file());
    Ok(AvatarCapabilityProbe {
        available: metadata.is_some(),
        size_bytes: metadata.map(|value| value.len()).unwrap_or(0),
    })
}

pub(crate) fn avatar_capability_probe() -> Result<AvatarCapabilityProbe, String> {
    avatar_capability_probe_at(local_avatar_path()?)
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

#[tauri::command]
pub(crate) fn avatar_animation_status() -> Result<AvatarAnimationStatus, String> {
    let directory = local_animation_directory()?;
    let clips = AVATAR_ANIMATION_FILES
        .iter()
        .map(|(id, file_name)| {
            let path = directory.join(file_name);
            let metadata = fs::metadata(&path).ok().filter(|value| value.is_file());
            AvatarAnimationClipStatus {
                id,
                path: path.display().to_string(),
                available: metadata.is_some(),
                size_bytes: metadata.map(|value| value.len()).unwrap_or(0),
            }
        })
        .collect();
    Ok(AvatarAnimationStatus { clips })
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

    #[test]
    fn capability_probe_reads_metadata_without_loading_the_avatar() {
        let missing = std::env::temp_dir().join("alice-missing-avatar.VRM");
        assert_eq!(
            avatar_capability_probe_at(missing),
            Ok(AvatarCapabilityProbe {
                available: false,
                size_bytes: 0,
            })
        );

        assert!(avatar_capability_probe_at(std::env::temp_dir().join("alice.png")).is_err());
    }

    #[test]
    fn capability_probe_reports_a_controlled_vrm_fixture_without_changing_it() {
        let path = std::env::temp_dir().join(format!(
            "alice-avatar-probe-{}-{}.vrm",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        fs::write(&path, b"controlled-vrm-fixture").expect("write controlled avatar fixture");

        assert_eq!(
            avatar_capability_probe_at(path.clone()),
            Ok(AvatarCapabilityProbe {
                available: true,
                size_bytes: 22,
            })
        );
        assert_eq!(
            fs::read(&path).expect("read controlled avatar fixture"),
            b"controlled-vrm-fixture"
        );

        fs::remove_file(path).expect("remove controlled avatar fixture");
    }

    #[test]
    fn animation_catalog_declares_the_required_private_clips() {
        assert_eq!(AVATAR_ANIMATION_FILES.len(), 9);
        assert!(AVATAR_ANIMATION_FILES.contains(&("idle", "Idle.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("jump", "Jump.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("run", "Run Forward.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("turn-left", "Left Turn.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("turn-right", "Right Turn.fbx")));
        assert!(local_animation_directory().is_ok());
    }
}
