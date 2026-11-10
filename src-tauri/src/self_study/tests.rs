use super::domain::{lesson_digest, validate_state};
use super::model::Lesson;
use super::storage::FILE;
use super::*;
use std::{collections::HashSet, fs, path::PathBuf};

struct Store(PathBuf);
impl Store {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!("alice-self-study-test-{}", uuid::Uuid::new_v4())))
    }
}
impl Drop for Store {
    fn drop(&mut self) {
        if self.0.parent() == Some(std::env::temp_dir().as_path())
            && self
                .0
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with("alice-self-study-test-"))
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
fn reply(lesson: &Lesson, choice: usize) -> serde_json::Value {
    serde_json::json!({"choices":[{"message":{"content":serde_json::json!({"lessonId":lesson.id,"choice":choice}).to_string()}}]})
}

#[test]
fn curriculum_covers_only_authorized_tracks_and_all_three_levels() {
    let lessons = curriculum().unwrap();
    assert_eq!(lessons.len(), 42);
    for track in TRACKS {
        assert_eq!(
            lessons
                .iter()
                .filter(|lesson| lesson.track == track)
                .count(),
            3
        );
        for level in 1..=3 {
            assert!(lessons
                .iter()
                .any(|lesson| lesson.track == track && lesson.level == level));
        }
    }
    assert!(lessons
        .iter()
        .filter(|lesson| lesson.track == "biblical-history")
        .all(|lesson| lesson.source_url.contains("vatican.va")));
}

#[test]
fn each_cycle_visits_every_track_then_advances_and_reviews_without_duplicates() {
    let lessons = curriculum().unwrap();
    let mut state = StudySnapshot::default();
    for level in 1..=3 {
        let selected = plan(&lessons, &state);
        assert_eq!(selected.len(), 14);
        assert_eq!(
            selected
                .iter()
                .map(|lesson| lesson.track.clone())
                .collect::<HashSet<_>>()
                .len(),
            14
        );
        assert!(selected.iter().all(|lesson| lesson.level == level));
        for lesson in selected {
            apply_answer(
                &mut state,
                &lesson,
                true,
                &format!("2026-11-10T12:0{level}:00Z"),
            )
            .unwrap();
        }
    }
    assert_eq!(state.records.len(), 42);
    let review = plan(&lessons, &state);
    assert!(review.iter().all(|lesson| lesson.level == 1));
    let lesson = &review[0];
    apply_answer(&mut state, lesson, false, "2026-11-10T13:00:00Z").unwrap();
    let record = state
        .records
        .iter()
        .find(|record| record.lesson_id == lesson.id)
        .unwrap();
    assert!(!record.active && !record.last_passed);
    assert_eq!(record.passes, 1);
    assert_eq!(record.attempts, 2);
    assert_eq!(plan(&lessons, &state)[0].id, lesson.id);
    validate_state(&state, &lessons).unwrap();
}

#[test]
fn shuffled_quiz_uses_a_hidden_key_and_rejects_fabricated_answers() {
    for lesson in curriculum().unwrap() {
        for offset in 0..3 {
            let body = quiz_body(&lesson, offset).to_string();
            assert!(!body.contains("correctOption"));
            assert!(!body.contains("explanation"));
            for choice in 0..3 {
                assert_eq!(
                    checked_answer(&reply(&lesson, choice), &lesson, offset).unwrap(),
                    (choice + offset) % 3 == lesson.correct_option
                );
            }
            assert!(checked_answer(&reply(&lesson, 3), &lesson, offset).is_err());
        }
    }
    let lesson = &curriculum().unwrap()[0];
    assert!(checked_answer(&serde_json::json!({"choices":[{"message":{"content":"{\"lessonId\":\"other\",\"choice\":0}"}}]}), lesson, 0).is_err());
    assert!(checked_answer(
        &serde_json::json!({"choices":[{"message":{"content":"respuesta sin JSON"}}]}),
        lesson,
        0
    )
    .is_err());
}

#[test]
fn study_store_preserves_other_memories_and_rejects_tampered_or_off_topic_content() {
    let store = Store::new();
    assert!(read_at(&store.0).unwrap().records.is_empty());
    assert!(!store.0.exists());
    let folder = store.0.join("memory");
    fs::create_dir_all(folder.join("notes")).unwrap();
    let sources = [
        folder.join("records.json"),
        folder.join("automatic-v1.json"),
        folder.join("notes/personal.md"),
    ];
    for source in &sources {
        fs::write(source, "private-source-unchanged").unwrap();
    }
    let mut state = StudySnapshot::default();
    let lessons = curriculum().unwrap();
    apply_answer(&mut state, &lessons[0], true, "2026-11-10T12:00:00Z").unwrap();
    write_at(&store.0, &state).unwrap();
    let loaded = read_at(&store.0).unwrap();
    assert_eq!(
        loaded.records[0].lesson_sha256,
        lesson_digest(&lessons[0]).unwrap()
    );
    for source in &sources {
        assert_eq!(
            fs::read_to_string(source).unwrap(),
            "private-source-unchanged"
        );
    }
    let original = fs::read(folder.join(FILE)).unwrap();
    for change in ["content", "track", "sourceUrl", "lessonSha256"] {
        let mut value = serde_json::to_value(&state).unwrap();
        value["records"][0][change] = serde_json::json!("unapproved-data");
        fs::write(folder.join(FILE), serde_json::to_vec(&value).unwrap()).unwrap();
        let before = fs::read(folder.join(FILE)).unwrap();
        assert!(update_at(&store.0, |state| state.enabled = false).is_err());
        assert_eq!(fs::read(folder.join(FILE)).unwrap(), before);
    }
    fs::write(folder.join(FILE), original).unwrap();
    assert!(read_at(&store.0).is_ok());
}

#[test]
fn paused_study_cannot_activate_new_knowledge() {
    let mut state = StudySnapshot {
        enabled: false,
        ..StudySnapshot::default()
    };
    apply_answer(
        &mut state,
        &curriculum().unwrap()[0],
        true,
        "2026-11-10T12:00:00Z",
    )
    .unwrap();
    assert!(state.records.is_empty());
}

#[test]
fn a_disabled_startup_does_not_start_the_model_or_advance_any_lesson() {
    let store = Store::new();
    write_at(
        &store.0,
        &StudySnapshot {
            enabled: false,
            ..StudySnapshot::default()
        },
    )
    .unwrap();
    let before = crate::local_inference::runtime().current_generation();
    let result = tauri::async_runtime::block_on(run_cycle_at(
        &store.0,
        crate::voice_session::VoiceSessionStore::default(),
        |_| {},
    ))
    .unwrap();
    assert!(!result.enabled);
    assert_eq!(result.phase, "disabled");
    assert!(result.records.is_empty());
    assert_eq!(
        crate::local_inference::runtime().current_generation(),
        before
    );
}

#[test]
#[ignore = "starts the installed Gemma; uses only an isolated temporary study store"]
fn live_self_study_checks_all_tracks_with_real_gemma() {
    assert_eq!(std::env::var("ALICE_SELF_STUDY_LIVE").as_deref(), Ok("1"));
    let runtime = crate::local_inference::runtime();
    assert!(
        !runtime.snapshot().unwrap().running,
        "The real probe must not take over an existing Gemma session"
    );
    let store = Store::new();
    let result = tauri::async_runtime::block_on(run_cycle_at(
        &store.0,
        crate::voice_session::VoiceSessionStore::default(),
        |_| {},
    ));
    let stopped = runtime.stop();
    let state = result.unwrap();
    stopped.unwrap();
    assert_eq!(
        state.records.len(),
        14,
        "Every mandatory track must be attempted"
    );
    assert_eq!(
        state
            .records
            .iter()
            .map(|record| &record.track)
            .collect::<HashSet<_>>()
            .len(),
        14
    );
    let passed = state
        .records
        .iter()
        .filter(|record| record.last_passed && record.active)
        .count();
    assert!(
        passed > 0,
        "A source projection alone must not count as real model learning"
    );
    assert_eq!(read_at(&store.0).unwrap().records.len(), 14);
    assert!(!store.0.join("memory/records.json").exists());
    println!("SELF_STUDY_LIVE attempted=14 passed={passed} tracks=14 canonicalWrites=false");
}
