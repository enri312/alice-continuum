use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum View {
    Audit,
    Diagnostic,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Payload {
    Configure {
        desktop_app: bool,
        capability: Option<String>,
        view: View,
    },
    AuditSuccess {
        id: u32,
        snapshot: AuditSnapshot,
    },
    DiagnosticSuccess {
        id: u32,
        snapshot: DiagnosticSnapshot,
    },
    ReadFailure {
        view: View,
        id: u32,
        error: String,
    },
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuditSnapshot {
    pub healthy: bool,
    pub storage_path: String,
    pub current_bytes: u64,
    pub rotated_bytes: u64,
    pub maximum_current_bytes: u64,
    pub total_valid_events: u64,
    pub invalid_lines: u64,
    pub events: Vec<AuditEvent>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuditEvent {
    pub event_id: String,
    pub operation_id: String,
    pub local_time: String,
    pub source: AuditSource,
    pub capability_id: Option<String>,
    pub operation: String,
    pub stage: AuditStage,
    pub outcome: AuditOutcome,
    pub reason_code: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuditSource {
    System,
    Permission,
    Capability,
    Memory,
    Cloud,
    Skill,
    Avatar,
    Procedure,
}
impl AuditSource {
    pub fn label(self) -> &'static str {
        match self {
            Self::System => "Sistema",
            Self::Permission => "Permiso",
            Self::Capability => "Capacidad",
            Self::Memory => "Memoria",
            Self::Cloud => "Nube",
            Self::Skill => "Habilidad",
            Self::Avatar => "Avatar",
            Self::Procedure => "Procedimiento",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuditStage {
    Request,
    Authorization,
    Execution,
    Stop,
    Revocation,
    Block,
    Error,
}
impl AuditStage {
    pub fn label(self) -> &'static str {
        match self {
            Self::Request => "Solicitud",
            Self::Authorization => "Autorización",
            Self::Execution => "Ejecución",
            Self::Stop => "Detención",
            Self::Revocation => "Revocación",
            Self::Block => "Bloqueo",
            Self::Error => "Error",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuditOutcome {
    Pending,
    Success,
    Blocked,
    Error,
}
impl AuditOutcome {
    pub fn display(self) -> (&'static str, &'static str) {
        match self {
            Self::Pending => ("pending", "Pendiente"),
            Self::Success => ("success", "Éxito"),
            Self::Blocked => ("blocked", "Bloqueado"),
            Self::Error => ("error", "Error"),
        }
    }
}

pub fn size_label(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KiB", bytes as f64 / 1024.0)
    } else {
        format!("{:.2} MiB", bytes as f64 / (1024.0 * 1024.0))
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticCategory {
    Path,
    DataVersion,
    Provider,
    Adapter,
    Permission,
}
impl DiagnosticCategory {
    pub const ALL: [Self; 5] = [
        Self::Path,
        Self::DataVersion,
        Self::Provider,
        Self::Adapter,
        Self::Permission,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::Path => "RUTAS",
            Self::DataVersion => "VERSIONES DE DATOS",
            Self::Provider => "PROVEEDORES",
            Self::Adapter => "ADAPTADORES",
            Self::Permission => "PERMISOS",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticStatus {
    Healthy,
    ConfigurationPending,
    Unavailable,
    Error,
}
impl DiagnosticStatus {
    pub fn display(self) -> (&'static str, &'static str) {
        match self {
            Self::Healthy => ("healthy", "SALUDABLE"),
            Self::ConfigurationPending => ("configurationPending", "CONFIGURACIÓN PENDIENTE"),
            Self::Unavailable => ("unavailable", "NO DISPONIBLE"),
            Self::Error => ("error", "ERROR"),
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticOverallStatus {
    Healthy,
    Attention,
    Error,
}
impl DiagnosticOverallStatus {
    pub fn display(self) -> (&'static str, &'static str) {
        match self {
            Self::Healthy => ("healthy", "SALUDABLE"),
            Self::Attention => ("attention", "ATENCIÓN"),
            Self::Error => ("error", "ERROR"),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticCheck {
    pub id: String,
    pub category: DiagnosticCategory,
    pub label: String,
    pub status: DiagnosticStatus,
    pub summary: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticSummary {
    pub total: u64,
    pub healthy: u64,
    pub configuration_pending: u64,
    pub unavailable: u64,
    pub errors: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticSnapshot {
    pub generated_at: String,
    pub overall_status: DiagnosticOverallStatus,
    pub summary: DiagnosticSummary,
    pub checks: Vec<DiagnosticCheck>,
}

pub struct Reading<T> {
    pub snapshot: Option<T>,
    pub error: Option<String>,
    pending: Option<u32>,
}
impl<T> Default for Reading<T> {
    fn default() -> Self {
        Self {
            snapshot: None,
            error: None,
            pending: None,
        }
    }
}

impl<T> Reading<T> {
    pub fn loading(&self) -> bool {
        self.pending.is_some()
    }

    fn complete(&mut self, id: u32, result: Result<T, String>) {
        if self.pending != Some(id) {
            return;
        }
        self.pending = None;
        match result {
            Ok(snapshot) => self.snapshot = Some(snapshot),
            Err(error) => self.error = Some(error),
        }
    }
}

pub struct State {
    pub view: View,
    pub desktop_app: bool,
    pub capability: Option<String>,
    pub audit: Reading<AuditSnapshot>,
    pub diagnostic: Reading<DiagnosticSnapshot>,
    configured: bool,
    next_id: u32,
}

impl State {
    pub fn new(desktop_app: bool, capability: Option<String>, view: View) -> Self {
        Self {
            view: if capability.is_some() {
                View::Audit
            } else {
                view
            },
            desktop_app,
            capability,
            audit: Reading::default(),
            diagnostic: Reading::default(),
            configured: false,
            next_id: 0,
        }
    }

    pub fn update(&mut self, payload: Payload) -> Vec<(View, u32)> {
        match payload {
            Payload::Configure {
                desktop_app,
                capability,
                ..
            } => {
                if self.capability != capability && capability.is_some() {
                    self.view = View::Audit;
                }
                self.capability = capability;
                if self.configured && self.desktop_app == desktop_app {
                    return Vec::new();
                }
                self.configured = true;
                self.desktop_app = desktop_app;
                self.audit = Reading::default();
                self.diagnostic = Reading::default();
                if self.view == View::Diagnostic {
                    [View::Audit, View::Diagnostic]
                        .into_iter()
                        .filter_map(|view| self.request(view))
                        .collect()
                } else {
                    self.request(View::Audit).into_iter().collect()
                }
            }
            Payload::AuditSuccess { id, snapshot } => {
                self.audit.complete(id, Ok(snapshot));
                Vec::new()
            }
            Payload::DiagnosticSuccess { id, snapshot } => {
                self.diagnostic.complete(id, Ok(snapshot));
                Vec::new()
            }
            Payload::ReadFailure { view, id, error } => {
                match view {
                    View::Audit => self.audit.complete(id, Err(error)),
                    View::Diagnostic => self.diagnostic.complete(id, Err(error)),
                }
                Vec::new()
            }
        }
    }

    pub fn select(&mut self, view: View) -> Option<(View, u32)> {
        if self.view == view {
            return None;
        }
        self.view = view;
        (view == View::Diagnostic)
            .then(|| self.request(view))
            .flatten()
    }

    pub fn request(&mut self, view: View) -> Option<(View, u32)> {
        let (pending, error) = match view {
            View::Audit => (&mut self.audit.pending, &mut self.audit.error),
            View::Diagnostic => (&mut self.diagnostic.pending, &mut self.diagnostic.error),
        };
        if !self.desktop_app || pending.is_some() {
            return None;
        }
        self.next_id = self.next_id.wrapping_add(1).max(1);
        *pending = Some(self.next_id);
        *error = None;
        Some((view, self.next_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn configure(desktop_app: bool, capability: Option<&str>, view: View) -> Payload {
        Payload::Configure {
            desktop_app,
            capability: capability.map(str::to_owned),
            view,
        }
    }

    #[test]
    fn an_old_failure_cannot_override_the_next_reading() {
        let mut state = State::new(true, None, View::Audit);
        let pending = state.update(configure(true, None, View::Audit))[0];
        assert_eq!(pending.0, View::Audit);
        assert!(
            state.request(View::Audit).is_none(),
            "prevent overlapping reads"
        );
        state.update(configure(false, None, View::Audit));
        assert!(
            state.request(View::Audit).is_none(),
            "browser cannot request native data"
        );
        let current = state.update(configure(true, None, View::Audit))[0];
        assert_ne!(pending.1, current.1);
        state.update(Payload::ReadFailure {
            view: View::Audit,
            id: pending.1,
            error: "anterior".into(),
        });
        assert!(state.audit.loading());
        assert!(state.audit.error.is_none());
        state.update(Payload::ReadFailure {
            view: View::Audit,
            id: current.1,
            error: "actual".into(),
        });
        assert!(!state.audit.loading());
        assert_eq!(state.audit.error.as_deref(), Some("actual"));
        assert!(state.request(View::Audit).is_some());
        assert!(state.audit.error.is_none());
    }

    #[test]
    fn opens_filtered_audit_before_reading_diagnostic() {
        let capability = Some("context.foreground.control");
        let mut state = State::new(true, capability.map(str::to_owned), View::Diagnostic);
        assert_eq!(state.view, View::Audit);
        let requests = state.update(configure(true, capability, View::Diagnostic));
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].0, View::Audit);
        assert_eq!(state.select(View::Diagnostic).unwrap().0, View::Diagnostic);
        assert_eq!(state.view, View::Diagnostic);
        assert!(state.select(View::Diagnostic).is_none());
        assert!(state.update(configure(true, None, View::Audit)).is_empty());
        assert!(state.capability.is_none());
        assert_eq!(state.view, View::Diagnostic);
    }
}
