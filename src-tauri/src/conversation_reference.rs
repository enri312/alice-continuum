//! Resolve a narrow grammatical question from the current text itself.
//! No inference of unknown speakers, memories, actions or factual truth.

fn folded(word: &str) -> String {
    word.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' | 'ü' => 'u',
            c => c,
        })
        .collect()
}

fn report_verb(word: &str) -> bool {
    matches!(
        folded(word).as_str(),
        "dijo" | "comento" | "pregunto" | "respondio" | "pidio"
    )
}

pub(crate) fn direct_reply(message: &str) -> Option<String> {
    if message.chars().count() > 2_000 {
        return None;
    }
    let (start, opening) = message
        .char_indices()
        .find(|(_, c)| matches!(c, '«' | '“' | '"' | '\''))?;
    let closing = match opening {
        '«' => '»',
        '“' => '”',
        c => c,
    };
    let rest = &message[start + opening.len_utf8()..];
    let end = rest.find(closing)?;
    let quote = &rest[..end];
    let after = &rest[end + closing.len_utf8()..];
    if quote.is_empty()
        || quote.contains(['«', '»', '“', '”', '"', '\''])
        || after.contains(['«', '»', '“', '”', '"', '\''])
    {
        return None;
    }
    let question = folded(after);
    if !after.trim_end().ends_with('?')
        || after.matches('?').count() != 1
        || question
            .split(|c: char| !c.is_alphabetic())
            .any(|w| matches!(w, "no" | "nunca"))
    {
        return None;
    }
    if !question.contains('?')
        || !(question.contains("de quien")
            || question.contains("a quien")
            || question.contains("a ti o a mi"))
    {
        return None;
    }
    let intro = message[..start].trim().trim_end_matches(':').trim();
    let words: Vec<_> = intro.split_whitespace().collect();
    if words.iter().any(|w| {
        matches!(
            folded(w.trim_matches(|c: char| !c.is_alphabetic())).as_str(),
            "no" | "nunca"
                | "jamas"
                | "si"
                | "supongamos"
                | "imagina"
                | "imaginemos"
                | "ejemplo"
                | "ficticio"
                | "ficcion"
                | "cuento"
                | "traduce"
        )
    }) || intro.contains([':', '?', '¿'])
    {
        return None;
    }
    let owner = words.len() >= 2
        && folded(words[words.len() - 2]) == "me"
        && report_verb(words[words.len() - 1]);
    let name = if owner {
        None
    } else {
        let index = words
            .windows(3)
            .rposition(|w| folded(w[0]) == "le" && report_verb(w[1]) && folded(w[2]) == "a")?;
        let names = &words[index + 3..];
        if names.is_empty()
            || names.len() > 3
            || names.iter().any(|name| {
                !name.chars().next().is_some_and(char::is_uppercase)
                    || !name.chars().all(char::is_alphabetic)
            })
        {
            return None;
        }
        Some(names.join(" "))
    };
    let parts: Vec<_> = quote
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphabetic()))
        .collect();
    let possessives: Vec<_> = parts
        .iter()
        .enumerate()
        .filter(|(_, w)| matches!(folded(w).as_str(), "tu" | "tus"))
        .collect();
    if possessives.len() != 1 {
        return None;
    }
    let (index, possessive) = possessives[0];
    // Restrict this shortcut to a possessive quality/skill, not a person such
    // as 'tu hermano' or a question about the subject of an arbitrary story.
    let first = folded(parts.get(index + 1)?);
    let asks_possession = question.contains("de quien")
        && (question.contains(&first) || question.contains("habl") || question.contains("refer"));
    let asks_listener = question.contains("a quien")
        && (question.contains("habl") || question.contains("refer") || question.contains("dirig"));
    if !asks_possession && !asks_listener && !question.contains("se referia a ti o a mi") {
        return None;
    }
    let masculine = match first.as_str() {
        "sistema" | "sistemas" | "funcionamiento" | "trabajo" | "proyecto" | "proyectos"
        | "desarrollo" => true,
        "explicacion" | "explicaciones" | "voz" | "forma" | "manera" | "presentacion"
        | "presentaciones" | "respuesta" | "respuestas" | "programacion" | "conversacion"
        | "redaccion" | "mejora" => false,
        _ => return None,
    };
    let phrase: Vec<_> = parts[index + 1..]
        .iter()
        .take_while(|w| {
            !matches!(
                folded(w).as_str(),
                "es" | "son"
                    | "esta"
                    | "estan"
                    | "suena"
                    | "suenan"
                    | "se"
                    | "fue"
                    | "era"
                    | "necesita"
                    | "necesitan"
                    | "parece"
                    | "tiene"
                    | "tienen"
                    | "ha"
                    | "han"
            )
        })
        .copied()
        .collect();
    if phrase.is_empty()
        || phrase.len() > 7
        || phrase
            .iter()
            .any(|w| matches!(folded(w).as_str(), "y" | "o" | "mi" | "mis"))
    {
        return None;
    }
    let subject = phrase.join(" ").to_lowercase();
    if let Some(name) = name {
        let plural = folded(possessive) == "tus";
        let article = match (masculine, plural) {
            (true, false) => "el",
            (true, true) => "los",
            (false, true) => "las",
            (false, false) => "la",
        };
        Some(format!(
            "En esa cita, «{possessive} {subject}» se refiere a {article} {subject} de {name}."
        ))
    } else {
        Some(format!(
            "En esa cita, «{possessive} {subject}» se refiere a {possessive} {subject}, Carlos."
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn attributes_quoted_possessives_to_the_explicit_listener() {
        for input in [
            "Mi hermano me dijo: «Quiero mejorar tu forma de explicar». ¿De quién estaba hablando?",
            "Mi vecina me comentó: “Tu voz se oye más tranquila”. ¿Se refería a ti o a mí?",
            "Ayer mi profesor me dijo 'Tu explicación fue clara'. ¿De quién era la explicación?",
        ] {
            let answer = direct_reply(input).unwrap();
            assert!(answer.ends_with(", Carlos."), "{answer}");
            assert!(!answer.contains("mi hermano"));
        }
        assert!(direct_reply("Mi padre Luis le dijo a Ana: «Tu explicación necesita ejemplos». ¿De quién es la explicación?").unwrap().ends_with("la explicación de Ana."));
        assert!(direct_reply(
            "Raúl le comentó a Sofía María: “Tu voz es clara”. ¿De quién hablaba?"
        )
        .unwrap()
        .ends_with("la voz de Sofía María."));
    }
    #[test]
    fn leaves_unsupported_or_ambiguous_language_to_the_conversation() {
        for input in [
            "Hola, Alice, quiero seguir avanzando con tu mejora",
            "Ana y Marta hablaron. Ella quiere aprender. ¿Quién?",
            "Luis le dijo a Ana y Marta: «Tu voz es clara». ¿De quién?",
            "Mi hermano me dijo «Tu hermana está bien». ¿De quién hablaba?",
            "Mi hermano me dijo «Mi voz es clara». ¿De quién hablaba?",
            "Mi hermano me dijo «Tu voz es clara». ¿Qué opinas de su comentario?",
            "Mi hermano me dijo «Tu voz es clara». ¿Quién era el emisor?",
            "Mi hermano me dijo «Tu voz es clara». ¿De quién es ese coche?",
            "Mi hermano me dijo «Tu voz es clara». No quiero saber de quién hablaba; ¿qué opinas?",
            "Mi hermano me dijo «Tu voz es clara». ¿De quién hablaba? ¿Y qué opinas?",
            "Mi hermano me dijo «Tu voz es clara» y Ana dijo «Tu voz es grave». ¿De quién?",
            "Mi hermano me dijo «Ana dijo 'tu voz'». ¿De quién?",
            "Ana no me dijo «Tu voz es clara». ¿De quién?",
            "Imagina que Ana me dijo «Tu voz es clara». ¿De quién?",
            "Ana me dijo «Tu voz es clara. ¿De quién?",
            "Personaje: Ana me dijo «Tu voz es clara». ¿De quién?",
            "Alice, abre Spotify y reproduce Don't Stop Me Now",
        ] {
            assert_eq!(direct_reply(input), None, "{input}");
        }
    }
}
