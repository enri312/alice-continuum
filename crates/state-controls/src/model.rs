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
    pub retrieval: Retrieval,
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
        let payload: Self = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        if payload.metrics.is_empty()
            || payload.metrics.iter().any(|item| !valid_value(item.value))
            || payload.controls.iter().any(|item| !valid_value(item.value))
        {
            return Err("Señales o controles fuera del contrato".into());
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
            "retrieval":{"phase":"idle","contextMode":null,"responseId":null,"count":0,"ids":[],"top":null}})
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
        raw["controls"][0]["locked"] = false.into();
        let payload = Payload::parse(&raw.to_string()).unwrap();
        assert!(payload.can_change("control-creativity", 0.75));
        assert!(!payload.can_change("control-creativity", 1.01));
        assert!(!payload.can_change("control-creativity", f64::NAN));
        assert!(!payload.can_change("control-autonomy", 0.5));
        raw["controls"][0]["locked"] = true.into();
        assert!(!Payload::parse(&raw.to_string())
            .unwrap()
            .can_change("control-creativity", 0.5));
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
