//! Bounded presentation preferences for conversational generation only.
//! They never change tool selection, permissions, extraction, learning or ASR.
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub(crate) struct ConversationBehavior {
    pub(crate) creativity: f64,
    pub(crate) empathy: f64,
}

impl Default for ConversationBehavior {
    fn default() -> Self {
        Self {
            creativity: 0.2,
            empathy: 0.5,
        }
    }
}

impl ConversationBehavior {
    pub(crate) fn validate_for_provider(self, provider: &str) -> Result<(), String> {
        if ![self.creativity, self.empathy]
            .into_iter()
            .all(|value| value.is_finite() && (0.0..=1.0).contains(&value))
        {
            return Err("Los ajustes de conversación deben estar entre 0 y 1".into());
        }
        if self != Self::default() && !matches!(provider, "llamacpp" | "ollama") {
            return Err(
                "Los ajustes de creatividad y estilo empático sólo están disponibles con Gemma u Ollama locales"
                    .into(),
            );
        }
        Ok(())
    }

    fn empathy_instruction(self) -> Option<&'static str> {
        if self.empathy < 1.0 / 3.0 {
            Some("AJUSTE DE ESTILO: prioriza brevedad y pasos concretos. Conserva siempre respeto, empatía, solidaridad y humildad; no minimices el dolor ni presiones para actuar. Este ajuste no cambia tu identidad, tus límites ni las autorizaciones.")
        } else if self.empathy > 2.0 / 3.0 {
            Some("AJUSTE DE ESTILO: dedica algo más de espacio a reconocer lo que la persona expresa y acompaña con calma, sin entusiasmo forzado ni paternalismo. No inventes emociones, vivencias o necesidades del usuario. Conserva tu identidad, criterio propio, límites y autorizaciones.")
        } else {
            // The middle setting preserves the existing personality verbatim.
            None
        }
    }

    pub(crate) fn apply_to_local_chat_body(
        self,
        provider: &str,
        body: &mut serde_json::Value,
    ) -> Result<(), String> {
        self.validate_for_provider(provider)?;
        if self == Self::default() {
            return Ok(());
        }
        let temperature_path = match provider {
            "llamacpp" => "/temperature",
            "ollama" => "/options/temperature",
            _ => return Err("El proveedor no admite estos ajustes de conversación".into()),
        };
        let temperature = body
            .pointer_mut(temperature_path)
            .ok_or("El cuerpo de conversación no expone su temperatura")?;
        *temperature = serde_json::json!(self.creativity);
        if let Some(instruction) = self.empathy_instruction() {
            if body
                .pointer("/messages/0/role")
                .and_then(|value| value.as_str())
                != Some("system")
            {
                return Err("El cuerpo de conversación no contiene el mensaje de sistema".into());
            }
            let system = body
                .pointer_mut("/messages/0/content")
                .ok_or("El cuerpo de conversación no contiene el estilo de sistema")?;
            let previous = system
                .as_str()
                .ok_or("El estilo de conversación no es texto")?;
            *system = serde_json::json!(format!("{previous}\n\n{instruction}"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_settings_keep_legacy_defaults_and_reject_unknown_or_wrong_types() {
        let defaults: ConversationBehavior = serde_json::from_str("{}").unwrap();
        assert_eq!(defaults, ConversationBehavior::default());
        let partial: ConversationBehavior = serde_json::from_str(r#"{"creativity":0.8}"#).unwrap();
        assert_eq!(partial.empathy, 0.5);
        for invalid in [
            r#"{"creativity":"0.8"}"#,
            r#"{"empathy":null}"#,
            r#"{"autonomy":1}"#,
        ] {
            assert!(serde_json::from_str::<ConversationBehavior>(invalid).is_err());
        }
    }

    #[test]
    fn validation_rejects_out_of_range_and_non_finite_values_before_generation() {
        for value in [-0.01, 1.01, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            for settings in [
                ConversationBehavior {
                    creativity: value,
                    ..Default::default()
                },
                ConversationBehavior {
                    empathy: value,
                    ..Default::default()
                },
            ] {
                assert!(settings.validate_for_provider("llamacpp").is_err());
                assert!(settings.validate_for_provider("ollama").is_err());
            }
        }
        for value in [0.0, 1.0] {
            assert!(ConversationBehavior {
                creativity: value,
                empathy: value
            }
            .validate_for_provider("llamacpp")
            .is_ok());
        }
    }

    #[test]
    fn external_adapters_accept_legacy_defaults_but_never_silently_ignore_changes() {
        for provider in [
            "openai",
            "google",
            "anthropic",
            "xai",
            "compatible",
            "openrouter",
        ] {
            assert!(ConversationBehavior::default()
                .validate_for_provider(provider)
                .is_ok());
            assert!(ConversationBehavior {
                creativity: 0.8,
                ..Default::default()
            }
            .validate_for_provider(provider)
            .is_err());
            assert!(ConversationBehavior {
                empathy: 0.8,
                ..Default::default()
            }
            .validate_for_provider(provider)
            .is_err());
        }
    }
}
