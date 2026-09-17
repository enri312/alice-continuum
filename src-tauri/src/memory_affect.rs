use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Model interpretation reviewed with the memory, not a clinical assessment
/// or Alice's current internal state. The enclosing record carries provenance.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MemoryAffect {
    pub(crate) emotion: String,
    pub(crate) intensity: f64,
    pub(crate) evidence: String,
}

fn normalized_words(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_string)
        .collect()
}

fn explicit_emotion_position(emotion: &str, evidence: &str) -> Option<usize> {
    let words = normalized_words(evidence);
    let markers: &[&str] = match emotion {
        "joy" => &[
            "feliz",
            "felicidad",
            "alegre",
            "alegría",
            "alegra",
            "alegro",
            "alegró",
            "alegran",
            "alegraron",
            "alegraba",
            "contento",
            "contenta",
            "encantado",
            "encantada",
            "encanta",
            "encantan",
            "happy",
            "glad",
        ],
        "sadness" => &[
            "triste",
            "tristeza",
            "pena",
            "desanimado",
            "desanimada",
            "sad",
        ],
        "anger" => &[
            "enojado", "enojada", "enojo", "furioso", "furiosa", "rabia", "ira", "molesto",
            "molesta", "angry",
        ],
        "fear" => &[
            "miedo",
            "temor",
            "asustado",
            "asustada",
            "aterrorizado",
            "aterrorizada",
            "afraid",
            "scared",
        ],
        "disgust" => &[
            "asco",
            "repulsión",
            "repulsion",
            "repugnancia",
            "disgustado",
            "disgustada",
            "disgusted",
        ],
        "anxiety" => &[
            "ansiedad",
            "ansioso",
            "ansiosa",
            "nervioso",
            "nerviosa",
            "preocupado",
            "preocupada",
            "preocupación",
            "anxious",
            "worried",
        ],
        "envy" => &["envidia", "envidioso", "envidiosa", "envy", "jealous"],
        "ennui" => &[
            "aburrido",
            "aburrida",
            "aburrimiento",
            "apatía",
            "apatia",
            "bored",
            "boredom",
        ],
        "embarrassment" => &[
            "vergüenza",
            "verguenza",
            "avergonzado",
            "avergonzada",
            "embarrassed",
            "ashamed",
        ],
        "nostalgia" => &[
            "nostalgia",
            "nostálgico",
            "nostalgico",
            "nostálgica",
            "nostalgica",
            "nostalgic",
        ],
        _ => return None,
    };
    words.iter().enumerate().find_map(|(index, word)| {
        (markers.contains(&word.as_str())
            && !words[index.saturating_sub(3)..index]
                .iter()
                .any(|previous| {
                    matches!(
                        previous.as_str(),
                        "no" | "nunca" | "jamás" | "jamas" | "sin" | "not" | "never"
                    )
                }))
        .then_some(index)
    })
}

pub(crate) fn derive_explicit_affects(evidence: &str) -> Vec<MemoryAffect> {
    let words = normalized_words(evidence);
    let intensity = if words.iter().any(|word| {
        matches!(
            word.as_str(),
            "muy"
                | "mucho"
                | "mucha"
                | "muchísimo"
                | "muchisimo"
                | "profundamente"
                | "very"
                | "really"
        )
    }) {
        0.85
    } else if words.iter().any(|word| {
        matches!(
            word.as_str(),
            "poco" | "ligeramente" | "levemente" | "slightly"
        )
    }) {
        0.4
    } else {
        0.65
    };
    let mut found = [
        "joy",
        "sadness",
        "anger",
        "fear",
        "disgust",
        "anxiety",
        "envy",
        "ennui",
        "embarrassment",
        "nostalgia",
    ]
    .into_iter()
    .filter_map(|emotion| {
        explicit_emotion_position(emotion, evidence).map(|position| (position, emotion))
    })
    .collect::<Vec<_>>();
    found.sort_by_key(|(position, _)| *position);
    found
        .into_iter()
        .take(3)
        .map(|(_, emotion)| MemoryAffect {
            emotion: emotion.into(),
            intensity,
            evidence: evidence.to_string(),
        })
        .collect()
}

pub(crate) fn validate_affects(items: &[MemoryAffect], source: Option<&str>) -> Result<(), String> {
    if items.len() > 3 {
        return Err("Máximo tres asociaciones emocionales por recuerdo".into());
    }
    let mut seen = HashSet::new();
    for item in items {
        if !matches!(
            item.emotion.as_str(),
            "joy"
                | "sadness"
                | "anger"
                | "fear"
                | "disgust"
                | "anxiety"
                | "envy"
                | "ennui"
                | "embarrassment"
                | "nostalgia"
        ) || !seen.insert(&item.emotion)
            || !item.intensity.is_finite()
            || item.intensity <= 0.0
            || item.intensity > 1.0
            || item.evidence.trim().is_empty()
            || item.evidence.chars().count() > 240
            || source.is_some_and(|text| !text.contains(&item.evidence))
            || explicit_emotion_position(&item.emotion, &item.evidence).is_none()
        {
            return Err("Asociación emocional inválida o sin evidencia literal".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_literal_and_explicit_emotion() {
        let item = MemoryAffect {
            emotion: "joy".into(),
            intensity: 0.7,
            evidence: "Me siento feliz".into(),
        };
        assert!(validate_affects(
            std::slice::from_ref(&item),
            Some("Me siento feliz con este logro")
        )
        .is_ok());
        assert!(validate_affects(
            &[MemoryAffect {
                emotion: "joy".into(),
                intensity: 1.0,
                evidence: "Me alegra mucho ver que Alice está cobrando vida con cada avance".into(),
            }],
            Some("Me alegra mucho ver que Alice está cobrando vida con cada avance")
        )
        .is_ok());
        assert_eq!(
            derive_explicit_affects(
                "Me alegra mucho ver que Alice está cobrando vida con cada avance"
            ),
            vec![MemoryAffect {
                emotion: "joy".into(),
                intensity: 0.85,
                evidence: "Me alegra mucho ver que Alice está cobrando vida con cada avance".into(),
            }]
        );
        assert!(
            validate_affects(std::slice::from_ref(&item), Some("No declaré esa emoción")).is_err()
        );
        assert!(validate_affects(&[item.clone(), item], None).is_err());
        assert!(validate_affects(
            &[MemoryAffect {
                emotion: "joy".into(),
                intensity: 0.8,
                evidence: "Compré un SSD".into(),
            }],
            Some("Compré un SSD")
        )
        .is_err());
        assert!(validate_affects(
            &[MemoryAffect {
                emotion: "sadness".into(),
                intensity: 0.4,
                evidence: "No estoy triste".into(),
            }],
            Some("No estoy triste")
        )
        .is_err());
    }
}
