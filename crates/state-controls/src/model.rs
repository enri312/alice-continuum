use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Availability {
    Ready,
    Planned,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Metric {
    pub id: String,
    pub label: String,
    pub value: f64,
    pub detail: String,
    pub availability: Availability,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Control {
    pub id: String,
    pub label: String,
    pub value: f64,
    pub detail: String,
    pub availability: Availability,
    pub locked: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BehaviorSettings {
    pub creativity: f64,
    pub empathy: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Behavior {
    pub settings: BehaviorSettings,
    pub supported: bool,
    pub busy: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ActivityStatus {
    Loading,
    Ready,
    Unavailable,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Activity {
    pub status: ActivityStatus,
    pub signal_present: bool,
    pub audit_healthy: Option<bool>,
    pub window_event_count: u64,
    pub window_ms: u64,
    pub overall_signal: f64,
    pub method: Option<String>,
}

impl Activity {
    pub fn view_state(&self) -> &'static str {
        match self.status {
            ActivityStatus::Loading => "loading",
            ActivityStatus::Unavailable => "unavailable",
            ActivityStatus::Ready if self.signal_present => "ready",
            ActivityStatus::Ready => "idle",
        }
    }
    pub fn audit_state(&self) -> &'static str {
        match self.audit_healthy {
            Some(true) => "healthy",
            Some(false) => "degraded",
            None => "unknown",
        }
    }
    pub fn label(&self) -> &'static str {
        match self.view_state() {
            "loading" => "cargando señal R3",
            "unavailable" => "señal R3 no disponible",
            "ready" => "señal R3 reciente",
            _ => "sin señal R3 reciente",
        }
    }
    pub fn summary(&self) -> String {
        match self.status {
            ActivityStatus::Loading => "LEYENDO AUDITORÍA LOCAL…".into(),
            ActivityStatus::Unavailable => "SNAPSHOT NATIVO NO DISPONIBLE".into(),
            ActivityStatus::Ready => format!(
                "{} EVENTOS / {} MIN · SEÑAL {:.3} · {}",
                self.window_event_count,
                ((self.window_ms as f64) / 60_000.0).round() as u64,
                self.overall_signal,
                if self.audit_healthy == Some(true) {
                    "AUDITORÍA ÍNTEGRA"
                } else {
                    "AUDITORÍA CON LÍNEAS INVÁLIDAS"
                }
            ),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Retrieval {
    pub phase: String,
    pub context_mode: Option<String>,
    pub response_id: Option<String>,
    pub count: usize,
    pub ids: Vec<String>,
    pub top: Option<RetrievedRecord>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RetrievedRecord {
    pub id: String,
    pub layer: String,
    pub type_label: String,
    pub text: String,
    pub source: Option<String>,
    pub origin: String,
    pub score: Option<f64>,
    pub score_kind: Option<String>,
}

pub struct RetrievalDisplay {
    pub status: String,
    pub type_label: String,
    pub text: String,
    pub score: String,
    pub score_label: String,
    pub detail: String,
    pub source: Option<String>,
    pub count: usize,
}

impl Retrieval {
    pub fn display(&self) -> RetrievalDisplay {
        let limited = self.context_mode.as_deref() == Some("limited");
        let record = if limited || self.phase == "failed" {
            None
        } else {
            self.top.as_ref()
        };
        let status = if limited {
            "CONTEXTO LIMITADO"
        } else {
            match self.phase.as_str() {
                "prepared" if self.count == 0 => "SIN COINCIDENCIAS",
                "prepared" => "COINCIDENCIAS PREPARADAS",
                "sending" => "CONTEXTO EN ENVÍO",
                "responded" if self.context_mode.as_deref() == Some("full") => {
                    "CONTEXTO PROPORCIONADO"
                }
                "responded" => "CONTEXTO NO CONFIRMADO",
                "bypassed" => "RUTA SIN MEMORIA",
                "failed" => "ENVÍO FALLIDO",
                _ => "SIN RECUPERACIÓN",
            }
        };
        let score = record
            .and_then(|item| item.score)
            .map(|score| {
                if record.and_then(|item| item.score_kind.as_deref()) == Some("rank") {
                    format!("#{score:.0}")
                } else {
                    format!("{score:.3}")
                }
            })
            .unwrap_or_else(|| "—".into());
        let score_label = match record.and_then(|item| item.score_kind.as_deref()) {
            Some("rank") => "Rango de recuperación",
            Some("lexical") => "Puntuación léxica, no probabilidad",
            _ => "Sin puntuación disponible",
        };
        let detail = if limited {
            "La ruta de visión limita el contexto enviado. No se presenta una coincidencia como recuerdo utilizado íntegramente."
        } else {
            match self.phase.as_str() {
            "prepared" if self.count > 0 => "Coincidencias locales para revisar: todavía no se han enviado al modelo.",
            "prepared" => "No se encontraron recuerdos elegibles para este mensaje.",
            "sending" => "Contexto autorizado para el envío en curso; todavía no hay respuesta.",
            "responded" if self.context_mode.as_deref() == Some("full") && record.is_some() => "Recuerdo incluido en el contexto del envío; esto no prueba que haya determinado la respuesta.",
            "responded" => "No hay un recuerdo completo y vigente acreditado para esta respuesta.",
            "bypassed" => "La acción o respuesta local no necesitó el contexto de recuerdos.",
            "failed" => "El envío no terminó; no se atribuye el uso de un recuerdo a una respuesta.",
            _ => "Escribe una consulta en Conversación con Recuerdos activos para ver aquí los recuerdos recuperados.",
        }
        };
        RetrievalDisplay {
            status: status.into(),
            type_label: record.map_or("—", |item| item.type_label.as_str()).into(),
            text: if limited {
                "CONTEXTO RECORTADO · SIN RECUERDO COMPLETO CONFIRMADO".into()
            } else {
                record
                    .map_or("SIN RECUERDOS RECUPERADOS", |item| item.text.as_str())
                    .into()
            },
            score,
            score_label: score_label.into(),
            detail: detail.into(),
            source: record.and_then(|item| item.source.clone()),
            count: self.count,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub has_activity: bool,
    pub local_records: String,
    pub selected_id: String,
    pub metrics: Vec<Metric>,
    pub controls: Vec<Control>,
    pub behavior: Option<Behavior>,
    pub retrieval: Retrieval,
    pub activity: Activity,
}

impl Payload {
    pub fn can_change(&self, id: &str, value: f64) -> bool {
        matches!(id, "control-creativity" | "control-empathy")
            && valid_value(value)
            && self.controls.iter().any(|item| {
                item.id == id && !item.locked && item.availability == Availability::Ready
            })
    }
    pub fn inspector_for(&self, selected_id: &str) -> (&str, f64, &str) {
        if let Some(metric) = self.metrics.iter().find(|item| item.id == selected_id) {
            return (&metric.label, metric.value, &metric.detail);
        }
        if let Some(control) = self.controls.iter().find(|item| item.id == selected_id) {
            return (&control.label, control.value, &control.detail);
        }
        let metric = &self.metrics[0];
        (&metric.label, metric.value, &metric.detail)
    }
    pub fn parse(raw: &str) -> Result<Self, String> {
        let mut payload: Self = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        if payload.metrics.is_empty()
            || payload.metrics.iter().any(|item| !valid_value(item.value))
            || payload.controls.iter().any(|item| !valid_value(item.value))
            || !valid_value(payload.activity.overall_signal)
            || payload.behavior.as_ref().is_some_and(|behavior| {
                !valid_value(behavior.settings.creativity)
                    || !valid_value(behavior.settings.empathy)
            })
        {
            return Err("Señales o controles fuera del contrato".into());
        }
        for control in &mut payload.controls {
            let Some(behavior) = &payload.behavior else {
                control.locked = true;
                continue;
            };
            let value = match control.id.as_str() {
                "control-creativity" => behavior.settings.creativity,
                "control-empathy" => behavior.settings.empathy,
                _ => {
                    control.locked = true;
                    continue;
                }
            };
            control.availability = Availability::Ready;
            control.locked = !behavior.supported || behavior.busy;
            control.value = if behavior.supported { value } else { 0.0 };
            control.detail = if !behavior.supported {
                "Disponible para Gemma y Ollama locales. Este ajuste no se aplica al proveedor actual.".into()
            } else if control.id == "control-creativity" {
                format!("Temperatura de generación conversacional: {value:.2}. Se aplica al próximo envío; no cambia el reconocimiento de voz ni las órdenes de aplicaciones.")
            } else {
                let tone = if value < 1.0 / 3.0 {
                    "directo y práctico"
                } else if value > 2.0 / 3.0 {
                    "más atento al contexto emocional"
                } else {
                    "estilo habitual"
                };
                format!("Tono para el próximo envío: {tone}. Tres tramos de estilo que mantienen respeto, personalidad y límites; no representa una emoción de Alice.")
            };
            if behavior.busy {
                control.detail.push_str(
                    " Hay una respuesta en curso; espera a que termine para modificarlo.",
                );
            }
        }
        Ok(payload)
    }
}
fn valid_value(value: f64) -> bool {
    value.is_finite() && (0.0..=1.0).contains(&value)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> serde_json::Value {
        serde_json::json!({"hasActivity":false,"localRecords":"0 RECUERDOS","selectedId":"state-memory",
            "metrics":[{"id":"state-memory","label":"Actividad de memoria","value":0,"detail":"Sin actividad","availability":"ready"}],
            "controls":[{"id":"control-autonomy","label":"Autonomía","value":0,"detail":"Bloqueada","availability":"ready","locked":true}],
            "behavior":null,
            "retrieval":{"phase":"idle","contextMode":null,"responseId":null,"count":0,"ids":[],"top":null},
            "activity":{"status":"unavailable","signalPresent":false,"auditHealthy":null,"windowEventCount":0,"windowMs":0,"overallSignal":0,"method":null}})
    }
    #[test]
    fn preserves_empty_data_and_locks() {
        let payload = Payload::parse(&fixture().to_string()).unwrap();
        assert_eq!(payload.retrieval.display().score, "—");
        assert!(payload.controls[0].locked);
        assert!(!payload.can_change("control-autonomy", 0.5));
        assert_eq!(payload.metrics[0].value, 0.0);
        assert_eq!(
            payload.inspector_for("state-memory"),
            ("Actividad de memoria", 0.0, "Sin actividad")
        );
        assert_eq!(
            payload.inspector_for("control-autonomy"),
            ("Autonomía", 0.0, "Bloqueada")
        );
        assert_eq!(
            payload.inspector_for("desconocido"),
            payload.inspector_for("state-memory")
        );
    }
    #[test]
    fn activity_distinguishes_loading_idle_signal_and_audit_degradation() {
        let mut raw = fixture();
        let activity = &mut raw["activity"];
        activity["status"] = "loading".into();
        let a = Payload::parse(&raw.to_string()).unwrap().activity;
        assert_eq!(
            (a.view_state(), a.summary().as_str()),
            ("loading", "LEYENDO AUDITORÍA LOCAL…")
        );
        raw["activity"]["status"] = "ready".into();
        raw["activity"]["auditHealthy"] = false.into();
        let a = Payload::parse(&raw.to_string()).unwrap().activity;
        assert_eq!((a.view_state(), a.audit_state()), ("idle", "degraded"));
        raw["activity"]["signalPresent"] = true.into();
        raw["activity"]["windowEventCount"] = 3.into();
        raw["activity"]["windowMs"] = 300_000.into();
        raw["activity"]["overallSignal"] = 0.5.into();
        let a = Payload::parse(&raw.to_string()).unwrap().activity;
        assert_eq!(a.view_state(), "ready");
        assert_eq!(
            a.summary(),
            "3 EVENTOS / 5 MIN · SEÑAL 0.500 · AUDITORÍA CON LÍNEAS INVÁLIDAS"
        );
    }
    #[test]
    fn rejects_missing_locks_unknown_fields_and_out_of_range_values() {
        let mut missing = fixture();
        missing["controls"][0]
            .as_object_mut()
            .unwrap()
            .remove("locked");
        assert!(Payload::parse(&missing.to_string()).is_err());
        let mut unknown = fixture();
        unknown["apiKey"] = "unexpected".into();
        assert!(Payload::parse(&unknown.to_string()).is_err());
        let mut invalid = fixture();
        invalid["controls"][0]["value"] = 1.01.into();
        assert!(Payload::parse(&invalid.to_string()).is_err());
    }

    #[test]
    fn only_unlocked_implemented_session_controls_accept_valid_values() {
        let mut raw = fixture();
        raw["controls"][0]["id"] = "control-creativity".into();
        raw["behavior"] = serde_json::json!({"settings":{"creativity":0.75,"empathy":0.5},"supported":true,"busy":false});
        let payload = Payload::parse(&raw.to_string()).unwrap();
        assert!(payload.can_change("control-creativity", 0.75));
        assert_eq!(payload.controls[0].value, 0.75);
        assert!(payload.controls[0].detail.contains("0.75"));
        assert!(!payload.can_change("control-creativity", 1.01));
        assert!(!payload.can_change("control-creativity", f64::NAN));
        assert!(!payload.can_change("control-autonomy", 0.5));
        raw["behavior"]["busy"] = true.into();
        assert!(!Payload::parse(&raw.to_string())
            .unwrap()
            .can_change("control-creativity", 0.5));
        raw["behavior"]["busy"] = false.into();
        raw["behavior"]["supported"] = false.into();
        let unsupported = Payload::parse(&raw.to_string()).unwrap();
        assert!(!unsupported.can_change("control-creativity", 0.5));
        assert_eq!(unsupported.controls[0].value, 0.0);
        raw["behavior"]["settings"]["creativity"] = 1.5.into();
        assert!(Payload::parse(&raw.to_string()).is_err());
    }

    #[test]
    fn empathy_projects_shared_tone_and_other_controls_stay_locked() {
        let mut raw = fixture();
        raw["controls"][0]["id"] = "control-empathy".into();
        raw["behavior"] = serde_json::json!({"settings":{"creativity":0.2,"empathy":0.9},"supported":true,"busy":false});
        let payload = Payload::parse(&raw.to_string()).unwrap();
        assert!(payload.can_change("control-empathy", 0.9));
        assert!(payload.controls[0]
            .detail
            .contains("más atento al contexto emocional"));
        raw["controls"][0]["id"] = "control-autonomy".into();
        raw["controls"][0]["locked"] = false.into();
        let payload = Payload::parse(&raw.to_string()).unwrap();
        assert!(payload.controls[0].locked);
        assert!(!payload.can_change("control-autonomy", 0.5));
    }

    #[test]
    fn retrieval_displays_real_scores_and_hides_limited_context() {
        let mut raw = fixture();
        raw["retrieval"] = serde_json::json!({"phase":"responded","contextMode":"full","responseId":"r1","count":1,"ids":["m1"],
            "top":{"id":"m1","layer":"semantic","typeLabel":"SEMÁNTICA","text":"Fracciones","source":"Fuente local","origin":"study","score":8.75,"scoreKind":"lexical"}});
        let full = Payload::parse(&raw.to_string())
            .unwrap()
            .retrieval
            .display();
        assert_eq!(full.type_label, "SEMÁNTICA");
        assert_eq!(full.score, "8.750");
        assert_eq!(full.source.as_deref(), Some("Fuente local"));
        raw["retrieval"]["contextMode"] = "limited".into();
        let limited = Payload::parse(&raw.to_string())
            .unwrap()
            .retrieval
            .display();
        assert_eq!(limited.status, "CONTEXTO LIMITADO");
        assert_eq!(limited.score, "—");
        assert_eq!(limited.source, None);
        raw["retrieval"]["contextMode"] = serde_json::Value::Null;
        raw["retrieval"]["phase"] = "failed".into();
        let failed = Payload::parse(&raw.to_string())
            .unwrap()
            .retrieval
            .display();
        assert_eq!(failed.status, "ENVÍO FALLIDO");
        assert_eq!(failed.score, "—");
        assert_eq!(failed.source, None);
    }
}
