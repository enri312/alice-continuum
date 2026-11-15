use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub id: String,
    pub title: String,
    pub entry: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub busy: bool,
    pub sources: Vec<Source>,
    pub selected: [String; 2],
    pub quotes: [String; 2],
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let payload: Self = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        let mut ids = std::collections::HashSet::new();
        if payload
            .sources
            .iter()
            .any(|source| source.id.is_empty() || !ids.insert(&source.id))
            || payload
                .quotes
                .iter()
                .any(|quote| quote.encode_utf16().count() > 2048)
        {
            return Err("Fuentes o citas inválidas".into());
        }
        Ok(payload)
    }

    pub fn source(&self, id: &str) -> Option<&Source> {
        self.sources.iter().find(|source| source.id == id)
    }

    pub fn can_preview(&self) -> bool {
        !self.busy
            && self.sources.len() >= 2
            && self.selected[0] != self.selected[1]
            && self.selected.iter().all(|id| self.source(id).is_some())
            && self
                .quotes
                .iter()
                .all(|quote| !quote.trim().is_empty() && quote.encode_utf16().count() <= 2048)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> serde_json::Value {
        serde_json::json!({"busy":false,"sources":[{"id":"a","title":"A","entry":"Cita A"},{"id":"b","title":"B","entry":"Cita B"}],"selected":["a","b"],"quotes":["Cita A","Cita B"]})
    }
    #[test]
    fn preview_requires_current_distinct_sources_and_nonempty_quotes() {
        let valid = fixture();
        assert!(Payload::parse(&valid.to_string()).unwrap().can_preview());
        for (key, value) in [
            ("busy", serde_json::json!(true)),
            ("selected", serde_json::json!(["a", "a"])),
            ("selected", serde_json::json!(["a", "removed"])),
            ("quotes", serde_json::json!([" ", "Cita B"])),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(!Payload::parse(&invalid.to_string()).unwrap().can_preview());
        }
        assert!(Payload::parse(
            r#"{"busy":false,"sources":[],"selected":["",""],"quotes":["",""]}"#
        )
        .is_ok());
    }
    #[test]
    fn quote_limit_matches_browser_utf16_and_rejects_authority_fields() {
        let mut value = fixture();
        value["quotes"][0] = serde_json::json!("😀".repeat(1024));
        assert!(Payload::parse(&value.to_string()).is_ok());
        value["quotes"][0] = serde_json::json!("😀".repeat(1025));
        assert!(Payload::parse(&value.to_string()).is_err());
        let mut value = fixture();
        value["confirmed"] = serde_json::json!(true);
        assert!(Payload::parse(&value.to_string()).is_err());
    }
}
