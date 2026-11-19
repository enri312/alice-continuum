//! State page session: serialized R3 reads and projection; no persistence commands.
use crate::{
    core_activity_model::Snapshot,
    model::{self, Activity, ActivityStatus, Availability},
};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Payload {
    Configure {
        base: Box<model::Payload>,
        persistent_memory_count: u64,
        desktop_app: bool,
    },
    ActivitySuccess {
        id: u32,
        value: serde_json::Value,
    },
    ActivityFailure {
        id: u32,
    },
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let raw: serde_json::Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        let mut parsed: Self = serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
        if let Self::Configure {
            base,
            persistent_memory_count,
            ..
        } = &mut parsed
        {
            if *persistent_memory_count > 9_007_199_254_740_991 {
                return Err("Conteo de memoria inválido".into());
            }
            **base = model::Payload::parse(&raw["base"].to_string())?;
        }
        Ok(parsed)
    }
}

pub struct State {
    base: model::Payload,
    persistent_memory_count: u64,
    desktop_app: bool,
    configured: bool,
    snapshot: Option<Snapshot>,
    status: ActivityStatus,
    next_id: u32,
    pending: Option<u32>,
}
impl State {
    pub fn new(base: model::Payload, persistent_memory_count: u64, desktop_app: bool) -> Self {
        Self {
            base,
            persistent_memory_count,
            desktop_app,
            configured: false,
            snapshot: None,
            status: if desktop_app {
                ActivityStatus::Loading
            } else {
                ActivityStatus::Unavailable
            },
            next_id: 0,
            pending: None,
        }
    }
    pub fn configure(
        &mut self,
        base: model::Payload,
        count: u64,
        desktop_app: bool,
    ) -> Option<u32> {
        self.base = base;
        self.persistent_memory_count = count;
        if self.configured && self.desktop_app == desktop_app {
            return None;
        }
        self.configured = true;
        self.desktop_app = desktop_app;
        self.snapshot = None;
        self.pending = None;
        self.status = if desktop_app {
            ActivityStatus::Loading
        } else {
            ActivityStatus::Unavailable
        };
        self.begin_read()
    }
    pub fn can_read(&self) -> bool {
        self.configured && self.desktop_app && self.pending.is_none()
    }
    pub fn begin_read(&mut self) -> Option<u32> {
        if !self.can_read() {
            return None;
        }
        self.next_id = self.next_id.wrapping_add(1).max(1);
        self.pending = Some(self.next_id);
        Some(self.next_id)
    }
    pub fn complete(&mut self, id: u32, value: Option<serde_json::Value>) {
        if self.pending != Some(id) {
            return;
        }
        self.pending = None;
        self.snapshot = value.and_then(|value| Snapshot::parse(value).ok());
        self.status = if self.snapshot.is_some() {
            ActivityStatus::Ready
        } else {
            ActivityStatus::Unavailable
        };
    }
    pub fn view(&self) -> model::Payload {
        let mut view = self.base.clone();
        view.activity = self
            .snapshot
            .as_ref()
            .map(Snapshot::activity)
            .unwrap_or_else(|| Activity {
                status: self.status.clone(),
                signal_present: false,
                audit_healthy: None,
                window_event_count: 0,
                window_ms: 0,
                overall_signal: 0.0,
                method: None,
            });
        view.has_activity = self.persistent_memory_count > 0 || view.activity.signal_present;
        for metric in &mut view.metrics {
            metric.availability = Availability::Ready;
            let region_id = match metric.id.as_str() {
                "state-curiosity" => Some("perception"),
                "state-social" => Some("language"),
                "state-memory" => Some("memory"),
                "state-inhibition" => Some("permission"),
                _ => None,
            };
            let evidence = region_id
                .and_then(|id| self.snapshot.as_ref()?.regions.iter().find(|r| r.id == id));
            if let Some(region) = evidence.filter(|region| region.signal > 0.0) {
                metric.value = region.signal;
            }
            match metric.id.as_str() {
                "state-inhibition" => {
                    if !evidence.is_some_and(|r| r.signal > 0.0) {
                        metric.value = if self.base.has_activity { 0.58 } else { 0.0 };
                    }
                    metric.detail = if let Some(region) = evidence.filter(|r| r.event_count > 0) {
                        format!("Límites de seguridad del Gateway: {} eventos R3 de permisos auditados (intensidad: {:.3}).", region.event_count, metric.value)
                    } else if self.base.has_activity {
                        "Límites del Gateway activos durante la sesión. Acciones no autorizadas bloqueadas.".into()
                    } else {
                        "Límites en reposo: sin solicitudes pendientes.".into()
                    };
                }
                "state-trust" => {
                    if let Some(score) = self
                        .base
                        .retrieval
                        .top
                        .as_ref()
                        .filter(|r| r.score_kind.as_deref() == Some("lexical"))
                        .and_then(|r| r.score)
                    {
                        metric.value = if score > 1.0 {
                            (score / 10.0).min(1.0)
                        } else {
                            score.clamp(0.0, 1.0)
                        };
                    }
                    metric.detail = if metric.value > 0.0 {
                        format!("Relevancia matemática del contexto de memoria ({:.3}). Certeza técnica de recuperación, no una emoción.", metric.value)
                    } else {
                        "Sin contexto recuperado en la consulta actual. Confianza de recuperación en cero.".into()
                    };
                }
                "state-fatigue" => {
                    let count = self.snapshot.as_ref().map_or(0, |s| s.window_event_count);
                    metric.value = (count as f64 / 20.0).min(1.0);
                    metric.detail = if count > 0 {
                        format!("Carga técnica operativa: {count} eventos procesados en los últimos 5 minutos (intensidad: {:.3}).", metric.value)
                    } else {
                        "Carga operativa nominal en los últimos 5 minutos; sin saturación de eventos.".into()
                    };
                }
                "state-frustration" => {
                    if self.snapshot.as_ref().is_some_and(|s| !s.audit_healthy) {
                        metric.value = 0.85;
                        metric.detail = "Alerta de integridad técnica: registro de auditoría R3 degradado o con errores.".into();
                    } else if metric.value == 0.0 {
                        metric.detail =
                            "Operación nominal: 0 errores o bloqueos en la ventana de auditoría."
                                .into();
                    }
                }
                "state-memory" | "state-social" | "state-curiosity" => {
                    if let Some(region) = evidence.filter(|r| r.event_count > 0) {
                        metric.detail = match metric.id.as_str() {
                            "state-memory" => format!("Memoria local: señal técnica derivada de {} eventos R3 recientes (intensidad: {:.3}).", region.event_count, metric.value),
                            "state-social" => format!("Interacción conversacional: {} eventos R3 de lenguaje en ventana (intensidad: {:.3}).", region.event_count, metric.value),
                            _ => format!("Estímulo perceptual: {} eventos R3 de percepción auditados (intensidad: {:.3}).", region.event_count, metric.value),
                        };
                    }
                }
                _ => {}
            }
        }
        for control in &mut view.controls {
            match control.id.as_str() {
                "control-inhibition" => {
                    control.value = self
                        .snapshot
                        .as_ref()
                        .and_then(|s| s.regions.iter().find(|r| r.id == "permission"))
                        .map_or(0.0, |r| r.signal);
                    control.detail = "Señal técnica de actividad reciente del Gateway; permanece bloqueada y no representa voluntad.".into();
                }
                "control-creativity" | "control-empathy" => {}
                _ => control.value = 0.0,
            }
        }
        view
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core_activity_model::tests::{active, idle};
    use serde_json::json;
    fn base() -> model::Payload {
        let metrics = ["curiosity", "inhibition", "fatigue", "frustration"].map(|id| json!({"id":format!("state-{id}"),"label":id,"value":0,"detail":"base","availability":"ready"}));
        let controls = ["creativity", "inhibition"].map(|id| json!({"id":format!("control-{id}"),"label":id,"value":0,"detail":"base","availability":"planned","locked":true}));
        model::Payload::parse(&json!({"hasActivity":false,"localRecords":"1 RECUERDO","selectedId":"state-curiosity",
            "metrics":metrics,
            "controls":controls,
            "behavior":{"settings":{"creativity":0.4,"empathy":0.7},"supported":true,"busy":false},
            "retrieval":{"phase":"idle","contextMode":null,"responseId":null,"count":0,"ids":[],"top":null},
            "activity":{"status":"unavailable","signalPresent":false,"auditHealthy":null,"windowEventCount":0,"windowMs":0,"overallSignal":0,"method":null}}).to_string()).unwrap()
    }
    #[test]
    fn serializes_reads_and_ignores_stale_responses_when_desktop_changes() {
        let mut state = State::new(base(), 0, true);
        let first = state.configure(base(), 0, true).unwrap();
        assert!(state.begin_read().is_none());
        assert!(state.configure(base(), 1, true).is_none());
        state.configure(base(), 0, false);
        state.complete(first, Some(active()));
        assert_eq!(state.view().activity.status, ActivityStatus::Unavailable);
        let next = state.configure(base(), 0, true).unwrap();
        assert_ne!(first, next);
        state.complete(first, Some(active()));
        assert!(!state.can_read());
        state.complete(next, Some(idle()));
        assert!(state.can_read());
    }
    #[test]
    fn projects_evidence_without_unlocking_permissions_or_changing_behavior() {
        let mut state = State::new(base(), 0, true);
        let id = state.configure(base(), 0, true).unwrap();
        state.complete(id, Some(active()));
        let view = state.view();
        assert!(view.has_activity);
        assert_eq!(view.metrics[0].value, 0.3);
        assert_eq!(view.controls[0].value, 0.4);
        assert!(view.can_change("control-creativity", 0.7));
        assert!(!view.can_change("control-inhibition", 0.7));
        assert!(view.controls[1].locked);
        assert_eq!(view.controls[1].value, 0.3);
    }
    #[test]
    fn invalid_snapshot_retires_signal_and_base_updates_apply_busy_lock() {
        let mut state = State::new(base(), 0, true);
        let id = state.configure(base(), 0, true).unwrap();
        state.complete(id, Some(active()));
        let id = state.begin_read().unwrap();
        state.complete(id, Some(json!({"invalid":true})));
        assert!(!state.view().has_activity);
        assert_eq!(state.view().metrics[0].value, 0.0);
        let mut next = base();
        next.behavior.as_mut().unwrap().busy = true;
        // Configure payload validation normalizes controls against current behavior.
        next.controls[0].locked = true;
        state.configure(next, 1, true);
        assert!(state.view().has_activity);
        assert!(!state.view().can_change("control-creativity", 0.7));
    }
}
