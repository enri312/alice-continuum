use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Screen {
    Dashboard,
    Identificacion,
    Nucleo,
    Flujo,
    Estado,
    Planificador,
    Memoria,
    Actividad,
    Rostro,
    Cuerpo,
    Avatar,
    Puentes,
    Auditoria,
    Procedimientos,
    Habilidades,
    Configuracion,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Workspace {
    Cognitive,
    Body,
    Governance,
}

pub const COGNITIVE: &[Screen] = &[
    Screen::Identificacion,
    Screen::Nucleo,
    Screen::Flujo,
    Screen::Estado,
    Screen::Planificador,
    Screen::Memoria,
    Screen::Actividad,
];
pub const BODY: &[Screen] = &[Screen::Rostro, Screen::Cuerpo, Screen::Avatar];
pub const GOVERNANCE: &[Screen] = &[
    Screen::Puentes,
    Screen::Auditoria,
    Screen::Procedimientos,
    Screen::Habilidades,
    Screen::Configuracion,
];

impl Screen {
    pub fn workspace(self) -> Workspace {
        if BODY.contains(&self) {
            Workspace::Body
        } else if GOVERNANCE.contains(&self) {
            Workspace::Governance
        } else {
            Workspace::Cognitive
        }
    }
}

impl Workspace {
    pub fn screens(self) -> &'static [Screen] {
        match self {
            Self::Cognitive => COGNITIVE,
            Self::Body => BODY,
            Self::Governance => GOVERNANCE,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
pub struct Request {
    pub id: u32,
    pub screen: Screen,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub initial_screen: Screen,
    pub request: Option<Request>,
    pub memories: usize,
    pub events: usize,
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}
