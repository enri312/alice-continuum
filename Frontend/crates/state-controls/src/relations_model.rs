use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Relation {
    pub id: String,
    pub title: String,
    pub withdrawn: bool,
    pub sources_current: bool,
}

impl Relation {
    pub fn label(&self) -> &'static str {
        if self.withdrawn {
            "Retirada"
        } else if self.sources_current {
            "Vigente · confirmada por vos"
        } else {
            "No vigente · fuente cambiada o no recuperable"
        }
    }

    pub fn action_label(&self) -> &'static str {
        if self.withdrawn {
            "Restaurar relación"
        } else {
            "Retirar relación"
        }
    }

    pub fn disabled(&self, busy: bool) -> bool {
        busy || (self.withdrawn && !self.sources_current)
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub busy: bool,
    pub relations: Vec<Relation>,
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        let mut ids = std::collections::HashSet::new();
        if value
            .relations
            .iter()
            .any(|item| item.id.is_empty() || !ids.insert(&item.id))
        {
            return Err("Identificadores de relaciones inválidos".into());
        }
        Ok(value)
    }

    // Selection requests a review in the host; it never authorizes persistence.
    pub fn can_review(&self, id: &str) -> bool {
        self.relations
            .iter()
            .any(|relation| relation.id == id && !relation.disabled(self.busy))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_states_and_locks_without_turning_selection_into_confirmation() {
        let mut payload = Payload::parse(r#"{"busy":false,"relations":[{"id":"active","title":"A ↔ B","withdrawn":false,"sourcesCurrent":true},{"id":"stale","title":"A ↔ C","withdrawn":false,"sourcesCurrent":false},{"id":"withdrawn","title":"A ↔ D","withdrawn":true,"sourcesCurrent":true},{"id":"blocked","title":"A ↔ E","withdrawn":true,"sourcesCurrent":false}]}"#).unwrap();
        assert_eq!(payload.relations[0].label(), "Vigente · confirmada por vos");
        assert_eq!(
            payload.relations[1].label(),
            "No vigente · fuente cambiada o no recuperable"
        );
        assert_eq!(payload.relations[2].label(), "Retirada");
        assert_eq!(payload.relations[2].action_label(), "Restaurar relación");
        assert!(payload.can_review("active"));
        assert!(payload.can_review("stale"));
        assert!(payload.can_review("withdrawn"));
        assert!(!payload.can_review("blocked"));
        assert!(!payload.can_review("missing"));
        payload.busy = true;
        assert!(!payload.can_review("active"));
    }

    #[test]
    fn accepts_empty_lists_and_rejects_duplicate_ids_or_authority_fields() {
        assert!(Payload::parse(r#"{"busy":false,"relations":[]}"#)
            .unwrap()
            .relations
            .is_empty());
        let item = r#"{"id":"same","title":"Ejemplo","withdrawn":false,"sourcesCurrent":true}"#;
        assert!(
            Payload::parse(&format!(r#"{{"busy":false,"relations":[{item},{item}]}}"#)).is_err()
        );
        assert!(Payload::parse(r#"{"busy":false,"relations":[],"confirmed":true}"#).is_err());
    }
}
