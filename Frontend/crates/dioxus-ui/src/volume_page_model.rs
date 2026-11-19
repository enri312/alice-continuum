use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Payload {
    Configure {
        setup: Setup,
    },
    Projection {
        projection: Box<Projection>,
    },
    Signals {
        signals: Signals,
        now_ms: u64,
        reduced: bool,
    },
    Picked {
        id: Option<String>,
    },
    Inspector {
        id: Option<String>,
        detail: Option<Inspector>,
    },
    Zoom {
        percent: u16,
    },
    CanvasError,
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setup {
    pub canvas_id: String,
    pub legends: Legends,
    pub demos: Vec<NodeLabel>,
    pub icons: Icons,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Icons {
    pub orbit: String,
    pub pan: String,
    pub zoom_in: String,
    pub zoom_out: String,
    pub reset: String,
}

#[derive(Clone, Deserialize)]
pub struct Legends {
    pub layers: Vec<Swatch>,
    pub affects: Vec<Swatch>,
    pub states: Vec<Swatch>,
}

#[derive(Clone, Deserialize)]
pub struct Swatch {
    pub id: String,
    pub label: String,
    pub color: String,
    pub dash: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Projection {
    pub frame: Frame,
    pub nodes: Vec<NodeLabel>,
    pub totals: Totals,
    pub graph_status: GraphStatus,
    pub invalidated_count: u32,
    pub by_origin: Origins,
    pub study: Option<Study>,
    pub learning_activity: Option<LearningActivity>,
    pub selected: Option<Inspector>,
    pub learning_ready: bool,
    pub checkpoint: Option<Vec<Checkpoint>>,
    pub dominant: Option<Dominant>,
    pub timestamp: Timestamp,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timestamp {
    pub now_ms: u64,
    pub clock_label: String,
    pub iso_time: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub view: Activity,
    pub status: String,
    pub audit: String,
    pub event_count: u32,
    pub method: String,
    pub summary: String,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Activity {
    Loading,
    Idle,
    Ready,
    Unavailable,
}

impl Activity {
    pub fn display(self) -> (&'static str, &'static str) {
        match self {
            Self::Loading => ("loading", "cargando señal R3"),
            Self::Idle => ("idle", "sin señal R3 reciente"),
            Self::Ready => ("ready", "señal R3 reciente"),
            Self::Unavailable => ("unavailable", "señal R3 no disponible"),
        }
    }
}

#[derive(Clone, PartialEq, Deserialize)]
pub struct NodeLabel {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub records: u32,
    pub retrieved: u32,
    pub processes: u32,
    pub associations: u32,
    pub edges: u32,
    pub shared_origin: bool,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GraphStatus {
    Loading,
    Normal,
    Empty,
    SourceChanged,
    Error,
    Unavailable,
}

impl GraphStatus {
    pub fn display(self, count: u32, shared_origin: bool) -> (&'static str, String, &'static str) {
        let (class, label, footer) = match self {
            Self::Loading => (
                "loading",
                "VERIFICANDO FUENTES",
                "LEYENDO RELACIONES LOCALES…",
            ),
            Self::Normal => (
                "normal",
                "FUENTES VIGENTES",
                "VIOLETA · RELACIÓN CONFIRMADA",
            ),
            Self::Empty => (
                "empty",
                "SIN RELACIONES CONFIRMADAS",
                if shared_origin {
                    "VERDE · ORIGEN COMPARTIDO"
                } else {
                    "SIN RELACIONES CARGADAS"
                },
            ),
            Self::SourceChanged => {
                return (
                    "sourceChanged",
                    format!(
                        "FUENTE CAMBIADA · {count} {}",
                        if count == 1 {
                            "RELACIÓN REQUIERE REVISIÓN"
                        } else {
                            "RELACIONES REQUIEREN REVISIÓN"
                        }
                    ),
                    "RELACIÓN OCULTA HASTA REVISAR SU FUENTE",
                )
            }
            Self::Error => (
                "error",
                "ERROR DE LECTURA · RECUERDOS SIN ALTERAR",
                "RELACIONES NO DISPONIBLES · NODOS SIN ALTERAR",
            ),
            Self::Unavailable => (
                "unavailable",
                "DISPONIBLES EN LA APLICACIÓN LOCAL",
                if shared_origin {
                    "VERDE · ORIGEN COMPARTIDO"
                } else {
                    "SIN RELACIONES CARGADAS"
                },
            ),
        };
        (class, label.into(), footer)
    }
}

#[derive(Clone, Deserialize)]
pub struct Origins {
    pub study: u32,
    pub automatic: u32,
    pub profile: u32,
    pub record: u32,
}

#[derive(Clone, Deserialize)]
pub struct Study {
    pub available: u32,
    pub attempts: u32,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningActivity {
    pub native: bool,
    pub status: String,
    pub sources: Vec<LearningSource>,
    pub records_status: String,
    pub records_error: String,
    pub cycle_error: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningSource {
    pub id: String,
    pub label: String,
    pub status: String,
    pub detail: String,
    pub updated: Option<String>,
    pub polling_only: bool,
    pub warning: Option<String>,
}

#[derive(Clone, Deserialize)]
pub struct Dominant {
    pub color: String,
    pub label: String,
}

#[derive(Clone, Deserialize)]
pub struct Inspector {
    pub id: String,
    pub label: String,
    pub detail: String,
    pub memory: Option<Memory>,
    pub associations: Vec<Association>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Memory {
    pub id: String,
    pub content: Option<String>,
    pub origin: String,
    pub recorded_at: String,
    pub study_date: bool,
    pub retrieved: bool,
    pub study_state: Option<String>,
    pub study_passes: u32,
    pub fill_mode: String,
    pub fill_label: String,
    pub fill_color: String,
    pub marker: String,
    pub markers: String,
    pub importance: String,
    pub affect_label: String,
    pub affects: Vec<Affect>,
    pub state_summary: String,
    pub provenance: Vec<(String, String)>,
}

#[derive(Clone, Deserialize)]
pub struct Affect {
    pub id: String,
    pub label: String,
    pub evidence: String,
}

#[derive(Clone, Deserialize)]
pub struct Association {
    pub id: String,
    pub evidence: Vec<Evidence>,
}

#[derive(Clone, Deserialize)]
pub struct Evidence {
    pub id: String,
    pub label: String,
    pub quote: String,
    pub reference: String,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signals {
    pub state: SignalState,
    pub recent_event_count: u32,
    pub overall_signal: f64,
    pub window_seconds: f64,
    pub generated_at: Option<u64>,
    pub routes: Vec<Route>,
    pub description: String,
}

#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignalState {
    Live,
    Idle,
    Stale,
    #[default]
    Unavailable,
    Error,
}

impl SignalState {
    pub fn display(self) -> (&'static str, &'static str) {
        match self {
            Self::Live => ("live", "Evidencia reciente"),
            Self::Idle => ("idle", "Sin señal de proceso"),
            Self::Stale => ("stale", "Muestra desactualizada"),
            Self::Unavailable => ("unavailable", "Fuente no disponible"),
            Self::Error => ("error", "Fuente sin verificar"),
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub id: String,
    pub label: String,
    pub event_count: u32,
    pub signal: f64,
    pub animatable: bool,
}

#[derive(Clone, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub label: String,
    pub token: String,
}

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Changed,
    Removed,
}

impl ChangeKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Added => "Nuevo nodo",
            Self::Changed => "Registro actualizado",
            Self::Removed => "Fuera de esta vista",
        }
    }
}

#[derive(Clone)]
pub struct Change {
    pub id: String,
    pub kind: ChangeKind,
    pub label: String,
    pub observed_at: Timestamp,
}

#[derive(Default)]
pub struct LearningHistory {
    last: BTreeMap<String, Checkpoint>,
    seen: HashSet<String>,
    pub baseline: Option<usize>,
    pub added: usize,
    pub changed: usize,
    pub removed: usize,
    pub recent: Vec<Change>,
}

impl LearningHistory {
    pub fn observe(&mut self, input: Vec<Checkpoint>, timestamp: &Timestamp) -> Vec<Change> {
        let next: BTreeMap<_, _> = input
            .into_iter()
            .map(|node| (node.id.clone(), node))
            .collect();
        if self.baseline.is_none() {
            self.baseline = Some(next.len());
            self.seen.extend(next.keys().cloned());
            self.last = next;
            return Vec::new();
        }
        let mut added = Vec::new();
        let mut changed = Vec::new();
        let mut removed = Vec::new();
        let change = |node: &Checkpoint, kind| Change {
            id: node.id.clone(),
            kind,
            label: node.label.clone(),
            observed_at: timestamp.clone(),
        };
        for (id, node) in &next {
            match self.last.get(id) {
                None if self.seen.insert(id.clone()) => added.push(change(node, ChangeKind::Added)),
                Some(previous) if previous.token == node.token => {}
                _ => changed.push(change(node, ChangeKind::Changed)),
            }
        }
        for (id, node) in &self.last {
            if !next.contains_key(id) {
                removed.push(change(node, ChangeKind::Removed));
            }
        }
        self.last = next;
        self.added += added.len();
        self.changed += changed.len();
        self.removed += removed.len();
        added.extend(changed);
        let arrivals = added.clone();
        added.extend(removed);
        added.extend(self.recent.drain(..));
        added.truncate(24);
        self.recent = added;
        arrivals
    }

    pub fn pulse(&self, now_ms: u64) -> Option<&Change> {
        self.recent.first().filter(|event| {
            event.kind != ChangeKind::Removed
                && now_ms.saturating_sub(event.observed_at.now_ms) < 6_000
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn checkpoint(id: &str, token: &str) -> Checkpoint {
        Checkpoint {
            id: id.into(),
            label: id.into(),
            token: token.into(),
        }
    }

    #[test]
    fn returning_memory_is_an_update_and_initial_reads_are_not_replayed() {
        let mut history = LearningHistory::default();
        let timestamp = Timestamp {
            now_ms: 1_000,
            clock_label: "00:00:01".into(),
            iso_time: "2026-11-19T00:00:01Z".into(),
        };
        assert!(history
            .observe(vec![checkpoint("a", "1"), checkpoint("b", "1")], &timestamp)
            .is_empty());
        assert_eq!(history.baseline, Some(2));
        assert!(history
            .observe(vec![checkpoint("a", "1")], &timestamp)
            .is_empty());
        let changes = history.observe(
            vec![
                checkpoint("a", "2"),
                checkpoint("b", "1"),
                checkpoint("c", "1"),
            ],
            &timestamp,
        );
        assert_eq!(changes.len(), 3);
        assert_eq!((history.added, history.changed, history.removed), (1, 2, 1));
        assert_eq!(
            history.pulse(6_999).map(|event| event.id.as_str()),
            Some("c")
        );
        assert!(history.pulse(7_000).is_none());
        assert!(history
            .observe(
                vec![
                    checkpoint("a", "2"),
                    checkpoint("b", "1"),
                    checkpoint("c", "1")
                ],
                &timestamp
            )
            .is_empty());
        assert_eq!(history.recent.len(), 4);
    }
}
