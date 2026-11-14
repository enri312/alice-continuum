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
    pub status: String,
    #[serde(rename = "type")]
    pub type_label: String,
    pub text: String,
    pub score: String,
    pub score_label: String,
    pub detail: String,
    pub source: Option<String>,
    pub count: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Inspector {
    pub label: String,
    pub value: String,
    pub detail: String,
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
    pub inspector: Inspector,
}

impl Payload {
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
            "retrieval":{"status":"SIN RECUPERACIÓN","type":"—","text":"SIN RECUERDOS RECUPERADOS","score":"—","scoreLabel":"Sin puntuación disponible","detail":"Sin datos","source":null,"count":0},
            "inspector":{"label":"Actividad de memoria","value":"0.000","detail":"Sin actividad"}})
    }
    #[test]
    fn preserves_empty_data_and_locks() {
        let payload = Payload::parse(&fixture().to_string()).unwrap();
        assert_eq!(payload.retrieval.score, "—");
        assert!(payload.controls[0].locked);
        assert_eq!(payload.metrics[0].value, 0.0);
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
}
