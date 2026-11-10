//! Curriculum validation, lesson planning and progress rules; no runtime or file I/O.
use super::model::{Curriculum, Lesson, StudyRecord, StudySnapshot};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub(super) const TRACKS: [&str; 14] = [
    "arithmetic",
    "algebra",
    "geometry",
    "trigonometry",
    "calculus",
    "linear-algebra",
    "probability",
    "statistics",
    "logic",
    "biblical-history",
    "emotional-intelligence",
    "empathy",
    "solidarity",
    "humility",
];

pub(super) fn lesson_digest(lesson: &Lesson) -> Result<String, String> {
    let bytes = serde_json::to_vec(lesson).map_err(|_| "No se pudo comprobar la leccion")?;
    Ok(format!(
        "sha256:{}",
        crate::util::encode_hex_lower(Sha256::digest(bytes))
    ))
}
pub(super) fn curriculum() -> Result<Vec<Lesson>, String> {
    let document: Curriculum =
        serde_json::from_str(include_str!("../../resources/self-study-curriculum.json"))
            .map_err(|_| "El curriculo de autoestudio no es valido")?;
    if document.schema_version != 1
        || document.biblical_tradition != "catholic"
        || document.lessons.len() != 42
    {
        return Err("El curriculo no coincide con el alcance autorizado".into());
    }
    let mut ids = HashSet::new();
    let mut levels = HashSet::new();
    for lesson in &document.lessons {
        let track = TRACKS
            .iter()
            .position(|track| *track == lesson.track)
            .ok_or("Materia de autoestudio no autorizada")?;
        let domain = if track < 9 {
            "mathematics"
        } else {
            TRACKS[track]
        };
        let url =
            reqwest::Url::parse(&lesson.source_url).map_err(|_| "Fuente de estudio no valida")?;
        if lesson.id.is_empty()
            || lesson.id.len() > 96
            || !lesson
                .id
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
            || !ids.insert(&lesson.id)
            || !levels.insert((lesson.track.clone(), lesson.level))
            || lesson.domain != domain
            || !(1..=3).contains(&lesson.level)
            || lesson.options.len() != 3
            || lesson.correct_option >= 3
            || lesson.options.iter().any(|option| option.trim().is_empty())
            || lesson.options.iter().collect::<HashSet<_>>().len() != 3
            || lesson.title.trim().is_empty()
            || lesson.title.chars().count() > 240
            || lesson.content.trim().is_empty()
            || lesson.content.chars().count() > 8000
            || lesson.source_title.trim().is_empty()
            || lesson.source_title.chars().count() > 300
            || lesson.question.trim().is_empty()
            || lesson.explanation.trim().is_empty()
            || url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("Una leccion no cumple el contrato de estudio".into());
        }
    }
    if TRACKS
        .iter()
        .any(|track| (1..=3).any(|level| !levels.contains(&(track.to_string(), level))))
    {
        return Err("Falta una materia o un nivel obligatorio".into());
    }
    Ok(document.lessons)
}

pub(super) fn validate_state(state: &StudySnapshot, lessons: &[Lesson]) -> Result<(), String> {
    if state.schema_version != 1
        || state.biblical_tradition != "catholic"
        || state.records.len() > 42
        || ![
            "idle",
            "studying",
            "completed",
            "partial",
            "deferred",
            "error",
            "disabled",
        ]
        .contains(&state.phase.as_str())
        || state
            .last_error
            .as_ref()
            .is_some_and(|text| text.len() > 2000)
    {
        return Err("Estado de autoestudio no admitido".into());
    }
    let mut ids = HashSet::new();
    for record in &state.records {
        let lesson = lessons
            .iter()
            .find(|lesson| lesson.id == record.lesson_id)
            .ok_or("El almacen incluye una leccion ajena al curriculo")?;
        if record.id != format!("study:{}", lesson.id)
            || !ids.insert(&record.id)
            || record.track != lesson.track
            || record.domain != lesson.domain
            || record.title != lesson.title
            || record.content != lesson.content
            || record.source_url != lesson.source_url
            || record.source_title != lesson.source_title
            || record.lesson_sha256 != lesson_digest(lesson)?
            || record.attempts == 0
            || record.passes > record.attempts
            || (record.last_passed && record.passes == 0)
            || record.active != record.last_passed
            || record.studied_at.is_empty()
        {
            return Err("Una leccion guardada no coincide con su fuente y comprobacion".into());
        }
    }
    Ok(())
}

pub(super) fn plan(lessons: &[Lesson], state: &StudySnapshot) -> Vec<Lesson> {
    TRACKS
        .iter()
        .filter_map(|track| {
            let mut candidates: Vec<_> = lessons
                .iter()
                .filter(|lesson| &lesson.track == track)
                .collect();
            candidates.sort_by_key(|lesson| {
                let record = state
                    .records
                    .iter()
                    .find(|record| record.lesson_id == lesson.id);
                match record {
                    None => (0, String::new(), lesson.level),
                    Some(record) if !record.last_passed => (0, String::new(), lesson.level),
                    Some(record) => (1, record.studied_at.clone(), lesson.level),
                }
            });
            candidates.first().map(|lesson| (*lesson).clone())
        })
        .collect()
}
pub(super) fn apply_answer(
    state: &mut StudySnapshot,
    lesson: &Lesson,
    passed: bool,
    now: &str,
) -> Result<(), String> {
    if !state.enabled {
        return Ok(());
    }
    let old = state
        .records
        .iter()
        .find(|record| record.lesson_id == lesson.id);
    let attempts = old.map_or(1, |record| record.attempts.saturating_add(1));
    let passes = old.map_or(u32::from(passed), |record| {
        record.passes.saturating_add(u32::from(passed))
    });
    let record = StudyRecord {
        id: format!("study:{}", lesson.id),
        lesson_id: lesson.id.clone(),
        track: lesson.track.clone(),
        domain: lesson.domain.clone(),
        title: lesson.title.clone(),
        content: lesson.content.clone(),
        source_url: lesson.source_url.clone(),
        source_title: lesson.source_title.clone(),
        lesson_sha256: lesson_digest(lesson)?,
        studied_at: now.into(),
        attempts,
        passes,
        last_passed: passed,
        active: passed,
    };
    state.records.retain(|record| record.lesson_id != lesson.id);
    state.records.push(record);
    state.records.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(())
}
