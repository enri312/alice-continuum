use crate::audit::{append_audit_event, new_operation_id, AuditEvent};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum AvatarMotorSource {
    HumanGamepad,
    LocalDiagnostic,
    HumanPosture,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AvatarBodyState {
    StandingIdle,
    StartingWalk,
    Locomoting,
    Jumping,
    SittingDown,
    SittingIdle,
    StandingUp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AvatarMotorAnimation {
    Idle,
    Forward,
    Backward,
    Left,
    Right,
    Jump,
    Run,
    TurnLeft,
    TurnRight,
    StartWalking,
    SittingIdle,
    StandingUp,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AvatarMotorTransitionInput {
    source: AvatarMotorSource,
    state: AvatarBodyState,
    animation: AvatarMotorAnimation,
}

impl AvatarBodyState {
    fn operation(self) -> &'static str {
        match self {
            Self::StandingIdle => "avatar.motor.standing_idle",
            Self::StartingWalk => "avatar.motor.starting_walk",
            Self::Locomoting => "avatar.motor.locomoting",
            Self::Jumping => "avatar.motor.jumping",
            Self::SittingDown => "avatar.motor.sitting_down",
            Self::SittingIdle => "avatar.motor.sitting_idle",
            Self::StandingUp => "avatar.motor.standing_up",
        }
    }

    fn accepts(self, animation: AvatarMotorAnimation) -> bool {
        match self {
            Self::StandingIdle => animation == AvatarMotorAnimation::Idle,
            Self::StartingWalk => animation == AvatarMotorAnimation::StartWalking,
            Self::Locomoting => matches!(
                animation,
                AvatarMotorAnimation::Forward
                    | AvatarMotorAnimation::Backward
                    | AvatarMotorAnimation::Left
                    | AvatarMotorAnimation::Right
                    | AvatarMotorAnimation::Run
                    | AvatarMotorAnimation::TurnLeft
                    | AvatarMotorAnimation::TurnRight
            ),
            Self::Jumping => animation == AvatarMotorAnimation::Jump,
            Self::SittingDown | Self::StandingUp => animation == AvatarMotorAnimation::StandingUp,
            Self::SittingIdle => animation == AvatarMotorAnimation::SittingIdle,
        }
    }
}

impl AvatarMotorSource {
    fn reason_code(self) -> &'static str {
        match self {
            Self::HumanGamepad => "HUMAN_GAMEPAD_TRANSITION",
            Self::LocalDiagnostic => "LOCAL_DIAGNOSTIC_TRANSITION",
            Self::HumanPosture => "HUMAN_POSTURE_TRANSITION",
        }
    }
}

const AVATAR_ANIMATION_FILES: [(&str, &str); 12] = [
    ("idle", "Idle.fbx"),
    ("forward", "Walking.fbx"),
    ("backward", "Walking Backwards.fbx"),
    ("left", "Left Strafe Walking.fbx"),
    ("right", "Right Strafe Walking.fbx"),
    ("jump", "Jump.fbx"),
    ("run", "Run Forward.fbx"),
    ("turn-left", "Left Turn.fbx"),
    ("turn-right", "Right Turn.fbx"),
    ("start-walking", "Start Walking.fbx"),
    ("sitting-idle", "Sitting Idle.fbx"),
    ("standing-up", "Standing Up.fbx"),
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

pub(crate) fn configure_asset_scope(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    // Keep access limited to the configured avatar and known animation files.
    // A fresh clone without private assets must still start normally.
    let scope = app.asset_protocol_scope();
    let avatar = local_avatar_path()?;
    if avatar.is_file() {
        scope.allow_file(avatar).map_err(|e| e.to_string())?;
    }
    let directory = local_animation_directory()?;
    for (_, name) in AVATAR_ANIMATION_FILES {
        let path = directory.join(name);
        if path.is_file() {
            scope.allow_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn local_avatar_path() -> Result<PathBuf, String> {
    let path = std::env::var_os("ALICE_AVATAR_PATH")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            crate::runtime_paths::local_dir()
                .join("assets")
                .join("Alice.vrm")
        });
    validate_avatar_path(path)
}

fn local_animation_directory() -> Result<PathBuf, String> {
    let path = std::env::var_os("ALICE_ANIMATION_DIR")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            crate::runtime_paths::local_dir()
                .join("assets")
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

fn build_avatar_motor_event(input: AvatarMotorTransitionInput) -> Result<AuditEvent, String> {
    if !input.state.accepts(input.animation) {
        return Err("La animación no corresponde al estado corporal declarado".into());
    }
    if input.source == AvatarMotorSource::LocalDiagnostic
        && matches!(
            input.state,
            AvatarBodyState::SittingDown
                | AvatarBodyState::SittingIdle
                | AvatarBodyState::StandingUp
        )
    {
        return Err("El ensayo local no declara transiciones sentadas".into());
    }
    AuditEvent::avatar_motor(
        new_operation_id(),
        input.state.operation().into(),
        input.source.reason_code(),
    )
}

#[tauri::command]
pub(crate) fn record_avatar_motor_transition(
    app: AppHandle,
    input: AvatarMotorTransitionInput,
) -> Result<(), String> {
    append_audit_event(&app, &build_avatar_motor_event(input)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::{
        append_event_at, validated_visible_events_at, AuditSource, AUDIT_MAX_BYTES,
    };

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
        assert_eq!(AVATAR_ANIMATION_FILES.len(), 12);
        assert!(AVATAR_ANIMATION_FILES.contains(&("idle", "Idle.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("jump", "Jump.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("run", "Run Forward.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("turn-left", "Left Turn.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("turn-right", "Right Turn.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("start-walking", "Start Walking.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("sitting-idle", "Sitting Idle.fbx")));
        assert!(AVATAR_ANIMATION_FILES.contains(&("standing-up", "Standing Up.fbx")));
        assert!(local_animation_directory().is_ok());
    }

    #[test]
    fn motor_transition_contract_accepts_only_matching_state_and_animation() {
        let valid = AvatarMotorTransitionInput {
            source: AvatarMotorSource::HumanGamepad,
            state: AvatarBodyState::StartingWalk,
            animation: AvatarMotorAnimation::StartWalking,
        };
        let event = build_avatar_motor_event(valid).expect("valid motor transition");
        assert_eq!(event.source, AuditSource::Avatar);
        assert_eq!(event.operation, "avatar.motor.starting_walk");
        assert_eq!(event.capability_id.as_deref(), Some("avatar.vrm.render"));
        assert_eq!(event.reason_code, "HUMAN_GAMEPAD_TRANSITION");

        assert!(build_avatar_motor_event(AvatarMotorTransitionInput {
            animation: AvatarMotorAnimation::SittingIdle,
            ..valid
        })
        .is_err());
    }

    #[test]
    fn diagnostic_cannot_invent_a_seated_transition() {
        assert!(build_avatar_motor_event(AvatarMotorTransitionInput {
            source: AvatarMotorSource::LocalDiagnostic,
            state: AvatarBodyState::SittingIdle,
            animation: AvatarMotorAnimation::SittingIdle,
        })
        .is_err());
    }

    #[test]
    fn motor_transition_writes_real_minimal_r3_event_without_private_payload() {
        let root =
            std::env::temp_dir().join(format!("alice-avatar-motor-audit-{}", uuid::Uuid::new_v4()));
        let event = build_avatar_motor_event(AvatarMotorTransitionInput {
            source: AvatarMotorSource::HumanPosture,
            state: AvatarBodyState::SittingDown,
            animation: AvatarMotorAnimation::StandingUp,
        })
        .expect("controlled motor event");
        append_event_at(&root, &event, AUDIT_MAX_BYTES).expect("write controlled R3 event");

        let (healthy, events) =
            validated_visible_events_at(&root).expect("read controlled R3 event");
        assert!(healthy);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].source, AuditSource::Avatar);
        let bytes = fs::read(root.join("audit").join("events-v1.jsonl")).expect("read audit bytes");
        let text = String::from_utf8(bytes).expect("utf8 audit");
        assert!(!text.contains("Alice.vrm"));
        assert!(!text.contains("Sitting Idle.fbx"));

        fs::remove_dir_all(root).expect("remove controlled motor audit");
    }
}
