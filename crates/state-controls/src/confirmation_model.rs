use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Create,
    Change,
}

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub kind: Kind,
    pub token: String,
    pub busy: bool,
    pub quotes: Vec<String>,
    pub withdrawn: bool,
}
impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        if value.token.is_empty()
            || match value.kind {
                Kind::Create => {
                    value.withdrawn
                        || value.quotes.len() != 2
                        || value.quotes.iter().any(|quote| {
                            !crate::source_form_model::nonempty_quote(quote)
                                || quote.encode_utf16().count() > 2048
                        })
                }
                Kind::Change => !value.quotes.is_empty(),
            }
        {
            return Err("Revisión pendiente inválida".into());
        }
        Ok(value)
    }
    pub fn accepts(&self, token: &str, cancel: bool) -> bool {
        !self.busy && self.token == token && (!cancel || self.kind == Kind::Change)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_stale_actions_and_locks_both_actions_during_operation() {
        let mut value = Payload::parse(
            r#"{"kind":"change","token":"change-1","busy":false,"quotes":[],"withdrawn":true}"#,
        )
        .unwrap();
        assert!(value.accepts("change-1", false));
        assert!(value.accepts("change-1", true));
        assert!(!value.accepts("previous", false));
        value.busy = true;
        assert!(!value.accepts("change-1", false));
        assert!(!value.accepts("change-1", true));
    }
    #[test]
    fn only_a_reviewed_pair_is_shown_for_creation_and_authority_is_not_payload() {
        let value=Payload::parse(r#"{"kind":"create","token":"review-1","busy":false,"quotes":["Cita A","Cita B"],"withdrawn":false}"#).unwrap();
        assert!(value.accepts("review-1", false));
        assert!(!value.accepts("review-1", true));
        assert!(Payload::parse(
            r#"{"kind":"create","token":"a","busy":false,"quotes":[],"withdrawn":false}"#
        )
        .is_err());
        assert!(Payload::parse(r#"{"kind":"change","token":"a","busy":false,"quotes":[],"withdrawn":false,"confirmed":true}"#).is_err());
    }
}
