use serde::Deserialize;

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Payload {
    Configure {
        view: View,
        desktop: bool,
        scene_id: String,
    },
    Face {
        face: Option<Face>,
        error: String,
        busy: bool,
        permission_text: String,
        request: Option<Permission>,
        grant: Option<Permission>,
    },
    AvatarFile {
        file: File,
        clips: usize,
        posture: bool,
    },
    AvatarError {
        error: String,
    },
    AvatarTelemetry {
        telemetry: Option<Telemetry>,
    },
    Viewer {
        patch: ViewerPatch,
    },
    Motor {
        ready: bool,
    },
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum View {
    Face,
    Body,
    Avatar,
}

#[derive(Clone, Deserialize)]
pub struct Permission {
    pub id: String,
    pub state: String,
}
#[derive(Clone, Deserialize)]
pub struct Face {
    pub model: Model,
    pub runtime: Runtime,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub state: String,
    pub size_bytes: u64,
    pub sha256: Option<String>,
    pub detail: String,
}
#[derive(Clone, Deserialize)]
pub struct Runtime {
    pub available: bool,
    pub detail: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct File {
    pub available: bool,
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Telemetry {
    pub name: String,
    pub authors: Vec<String>,
    pub copyright: String,
    pub meta_version: String,
    pub bone_count: usize,
    pub expression_count: usize,
    pub expression_names: Vec<String>,
    pub spring_joint_count: usize,
    pub collider_count: usize,
    pub credit_required: bool,
    pub redistribution_allowed: bool,
    pub modification: String,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerPatch {
    pub state: Option<String>,
    pub error: Option<String>,
    pub body_state: Option<String>,
    pub pose: Option<String>,
    pub mode: Option<String>,
    pub control: Option<ManualControl>,
    pub motion: Option<Motion>,
}

#[derive(Clone, Default, Deserialize)]
pub struct ManualControl {
    pub state: String,
    pub device: String,
    pub input: ManualInput,
}
#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualInput {
    pub move_x: f64,
    pub move_z: f64,
    pub turn: f64,
    pub jump: bool,
    pub left_trigger: f64,
    pub right_trigger: f64,
}
#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Motion {
    pub animation: String,
    pub speed: f64,
    pub locked_foot: Option<String>,
    pub foot_offset: f64,
    pub ground_correction: f64,
    pub ik_applied: bool,
    pub ik_residual: f64,
}

pub struct Viewer {
    pub state: String,
    pub error: String,
    pub body_state: String,
    pub pose: String,
    pub mode: String,
    pub control: ManualControl,
    pub motion: Motion,
}

impl Default for Viewer {
    fn default() -> Self {
        Self {
            state: "loading".into(),
            error: String::new(),
            body_state: "standing-idle".into(),
            pose: "idle".into(),
            mode: "off".into(),
            control: ManualControl::default(),
            motion: Motion::default(),
        }
    }
}

impl Viewer {
    pub fn apply(&mut self, patch: ViewerPatch) {
        if let Some(value) = patch.state {
            self.state = value;
        }
        if let Some(value) = patch.error {
            self.error = value;
        }
        if let Some(value) = patch.body_state {
            self.body_state = value;
        }
        if let Some(value) = patch.pose {
            self.pose = value;
        }
        if let Some(value) = patch.mode {
            self.mode = value;
        }
        if let Some(value) = patch.control {
            self.control = value;
        }
        if let Some(value) = patch.motion {
            self.motion = value;
        }
    }
}
