//! Only fixed, synthetic demonstration data. No files, network or Alice IPC.

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Scenario {
    Ready,
    Idle,
    Loading,
    Unavailable,
    Degraded,
}

impl Scenario {
    pub const ALL: [Self; 5] = [
        Self::Ready,
        Self::Idle,
        Self::Loading,
        Self::Unavailable,
        Self::Degraded,
    ];

    pub fn key(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::Idle => "idle",
            Self::Loading => "loading",
            Self::Unavailable => "unavailable",
            Self::Degraded => "degraded",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Ready => "Con actividad",
            Self::Idle => "Sin actividad",
            Self::Loading => "Cargando",
            Self::Unavailable => "No disponible",
            Self::Degraded => "Auditoría degradada",
        }
    }

    pub fn signal_label(self) -> &'static str {
        match self {
            Self::Ready | Self::Degraded => "señal R3 reciente · simulada",
            Self::Idle => "sin señal R3 reciente",
            Self::Loading => "cargando señal R3 · simulado",
            Self::Unavailable => "señal R3 no disponible",
        }
    }

    pub fn has_signal(self) -> bool {
        matches!(self, Self::Ready | Self::Degraded)
    }

    pub fn busy(self) -> bool {
        self == Self::Loading
    }
}

#[derive(Clone, Copy, PartialEq)]
pub struct Item {
    pub id: &'static str,
    pub label: &'static str,
    pub value: f64,
    pub detail: &'static str,
    pub implemented: bool,
    pub locked: bool,
}

impl Item {
    pub fn status(self) -> &'static str {
        if self.implemented {
            "IMPLEMENTADO"
        } else {
            "FUTURO"
        }
    }
}

pub struct Fixture {
    pub scenario: Scenario,
    pub metrics: Vec<Item>,
    pub controls: Vec<Item>,
    pub records: usize,
    pub retrieved: usize,
    pub memory_kind: Option<&'static str>,
    pub memory_top: &'static str,
    pub events: usize,
    pub overall_signal: f64,
    pub audit_healthy: Option<bool>,
}

impl Fixture {
    pub fn item(&self, id: &str) -> Item {
        self.metrics
            .iter()
            .chain(self.controls.iter())
            .find(|item| item.id == id)
            .copied()
            .unwrap_or(self.metrics[0])
    }

    pub fn provenance(&self) -> String {
        match self.scenario {
            Scenario::Loading => "LEYENDO AUDITORÍA LOCAL… · ESTADO SIMULADO".into(),
            Scenario::Unavailable => "SNAPSHOT NATIVO NO DISPONIBLE · ERROR SIMULADO".into(),
            _ => format!(
                "{} EVENTOS / 2 MIN · SEÑAL {:.3} · {}",
                self.events,
                self.overall_signal,
                if self.audit_healthy == Some(true) {
                    "AUDITORÍA ÍNTEGRA"
                } else {
                    "AUDITORÍA CON LÍNEAS INVÁLIDAS"
                },
            ),
        }
    }
}

pub fn fixture(scenario: Scenario) -> Fixture {
    let active = scenario.has_signal();
    let inhibition = if active { 0.620 } else { 0.0 };
    let memory = if active { 0.460 } else { 0.0 };
    let metric = |id, label, detail, implemented, value| Item {
        id,
        label,
        detail,
        implemented,
        value,
        locked: false,
    };
    let control = |id, label, detail, implemented, value| Item {
        id,
        label,
        detail,
        implemented,
        value,
        locked: true,
    };
    Fixture {
        scenario,
        metrics: vec![
            metric("state-curiosity", "Curiosidad", "Señal reservada para un futuro modelo motivacional; Alice todavía no calcula curiosidad.", false, 0.0),
            metric("state-social", "Comodidad social", "Señal social futura. No se infiere un estado emocional a partir de la conversación.", false, 0.0),
            metric("state-frustration", "Frustración", "Alice no atribuye frustración ni otras emociones a sí misma en esta fase.", false, 0.0),
            metric("state-inhibition", "Inhibición", if active { "Permisos: señal técnica derivada de 3 eventos R3 sintéticos; no representa una emoción." } else { "No hay señal reciente de permisos en este escenario sintético." }, true, inhibition),
            metric("state-trust", "Confianza", "No existe todavía un modelo de confianza persistente.", false, 0.0),
            metric("state-fatigue", "Fatiga", "Un servicio de software no siente cansancio; una futura señal podría representar carga técnica, no una emoción.", false, 0.0),
            metric("state-surprise", "Sorpresa", "No se calcula sorpresa. Un futuro valor representaría novedad estadística y no una vivencia.", false, 0.0),
            metric("state-memory", "Actividad de memoria", if active { "Memoria: señal técnica derivada de 2 eventos R3 sintéticos; no representa una emoción." } else { "No hay señal reciente de memoria en este escenario sintético." }, true, memory),
        ],
        controls: vec![
            control("control-autonomy", "Autonomía", "Bloqueada: el modelo no recibe herramientas ni capacidad de actuar por sí mismo.", true, 0.0),
            control("control-creativity", "Creatividad", "Control planificado; todavía no está conectado a los parámetros de los proveedores.", false, 0.0),
            control("control-empathy", "Estilo empático", "Control planificado para el estilo de respuesta; no representará una emoción real.", false, 0.0),
            control("control-inhibition", "Inhibición", "Señal técnica de actividad reciente del Gateway; permanece bloqueada y no representa voluntad. Aquí se muestra un valor sintético.", true, inhibition),
            control("control-stability", "Estabilidad de estilo", "Control planificado para mantener coherencia de tono y conducta.", false, 0.0),
            control("control-memory", "Influencia de memoria", "Permanece en cero hasta que el usuario seleccione recuerdos durante la revisión de un envío.", true, 0.0),
            control("control-anticipation", "Anticipación", "Control planificado para preparar transiciones de respuesta; no predice el futuro ni acciones del usuario.", false, 0.0),
            control("control-speed", "Velocidad de estilo", "Control planificado para el ritmo expresivo de futuras salidas; no modifica todavía el procesamiento.", false, 0.0),
        ],
        records: if scenario == Scenario::Idle { 0 } else { 12 },
        retrieved: if active { 2 } else { 0 },
        memory_kind: if active { Some("EPISODIC") } else { None },
        memory_top: if active { "USER: TEST de Personalidad Múltiple y Libre Albedrío → Alice" } else { "NINGUNA MEMORIA RECUPERADA PARA UNA RESPUESTA" },
        events: if active { 7 } else { 0 },
        overall_signal: if active { 0.730 } else { 0.0 },
        audit_healthy: match scenario {
            Scenario::Loading | Scenario::Unavailable => None,
            Scenario::Degraded => Some(false),
            _ => Some(true),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_scenario_preserves_all_items_and_blocked_controls() {
        for scenario in Scenario::ALL {
            let f = fixture(scenario);
            assert_eq!(f.metrics.len(), 8);
            assert_eq!(f.controls.len(), 8);
            assert!(f.controls.iter().all(|item| item.locked));
            let ids: std::collections::HashSet<_> = f
                .metrics
                .iter()
                .chain(f.controls.iter())
                .map(|item| item.id)
                .collect();
            assert_eq!(ids.len(), 16);
            assert!(f
                .metrics
                .iter()
                .chain(f.controls.iter())
                .all(|item| item.value.is_finite() && (0.0..=1.0).contains(&item.value)));
        }
    }

    #[test]
    fn future_items_never_acquire_fake_emotional_values() {
        for scenario in Scenario::ALL {
            let f = fixture(scenario);
            assert!(f
                .metrics
                .iter()
                .chain(f.controls.iter())
                .filter(|item| !item.implemented)
                .all(|item| item.value == 0.0));
        }
    }

    #[test]
    fn unavailable_and_loading_do_not_become_healthy_or_active() {
        for scenario in [Scenario::Loading, Scenario::Unavailable] {
            let f = fixture(scenario);
            assert_eq!(f.audit_healthy, None);
            assert_eq!(f.overall_signal, 0.0);
            assert!(!scenario.has_signal());
            assert!(f.metrics.iter().all(|item| item.value == 0.0));
        }
        assert!(Scenario::Loading.busy());
        assert!(!Scenario::Unavailable.busy());
        assert_eq!(fixture(Scenario::Degraded).audit_healthy, Some(false));
    }

    #[test]
    fn selection_keeps_the_original_inspector_contract() {
        let f = fixture(Scenario::Ready);
        assert_eq!(f.item("state-memory").label, "Actividad de memoria");
        assert_eq!(f.item("control-inhibition").value, 0.620);
        assert_eq!(f.item("unknown").id, "state-curiosity");
        assert_eq!(fixture(Scenario::Idle).retrieved, 0);
        assert_eq!(f.retrieved, 2);
    }
}
