//! Startup study orchestration and Tauri commands for a closed, sourced curriculum.
mod coordinator;
mod domain;
mod model;
mod prompts;
mod storage;

use coordinator::Coordinator;
use domain::{apply_answer, curriculum, plan, TRACKS};
pub(crate) use model::{SetStudyEnabled, StudySnapshot};
use prompts::{checked_answer, quiz_body};
use std::path::Path;
use std::time::{Duration, Instant};
#[cfg(test)]
use storage::update_at;
use storage::{read_at, write_at, WRITE_LOCK};
use tauri::{AppHandle, Emitter, Manager};

static COORDINATOR: Coordinator = Coordinator::new();

fn update_current_at(
    root: &Path,
    ticket: u64,
    coordinator: &Coordinator,
    update: impl FnOnce(&mut StudySnapshot),
) -> Result<StudySnapshot, String> {
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "El avance de estudio esta ocupado")?;
    let mut state = read_at(root)?;
    if coordinator.current(ticket) {
        update(&mut state);
        write_at(root, &state)?;
    }
    Ok(state)
}

async fn yield_turn() {
    let _ = tauri::async_runtime::spawn_blocking(|| std::thread::sleep(Duration::from_millis(500)))
        .await;
}
fn finish_at(
    root: &Path,
    phase: &str,
    error: Option<&str>,
    completed: bool,
    ticket: u64,
) -> Result<StudySnapshot, String> {
    let now = crate::capabilities::current_utc_timestamp()?;
    update_current_at(root, ticket, &COORDINATOR, |state| {
        state.phase = if state.enabled {
            phase.into()
        } else {
            "disabled".into()
        };
        state.last_error = error.map(str::to_string);
        if completed && state.enabled {
            state.last_completed_at = Some(now);
        }
    })
}

enum AttemptOutcome {
    Evaluated { state: StudySnapshot, passed: bool },
    TechnicalFailure { state: StudySnapshot },
    Cancelled,
}

/// Only a complete, validated answer can change the result of a lesson.
/// Technical failures preserve prior knowledge instead of grading it as wrong.
fn persist_checked_attempt_at(
    root: &Path,
    lesson: &model::Lesson,
    offset: usize,
    response: Result<serde_json::Value, ()>,
    now: &str,
    may_save: impl Fn() -> bool,
) -> Result<AttemptOutcome, String> {
    if !may_save() {
        return Ok(AttemptOutcome::Cancelled);
    }
    let assessment = match response {
        Ok(value) => checked_answer(&value, lesson, offset).map_err(|_| {
            "La respuesta del ejercicio no pudo evaluarse; se conservó el resultado anterior sin calificar el ejercicio"
        }),
        Err(()) => Err(
            "No se pudo completar la consulta de estudio al motor local; se conservó el resultado anterior sin calificar el ejercicio",
        ),
    };
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "El avance de estudio esta ocupado")?;
    let mut state = read_at(root)?;
    // Owner controls are checked again under the same lock used for persistence.
    if !state.enabled || !may_save() {
        return Ok(AttemptOutcome::Cancelled);
    }
    match assessment {
        Ok(passed) => {
            apply_answer(&mut state, lesson, passed, now)?;
            write_at(root, &state)?;
            Ok(AttemptOutcome::Evaluated { state, passed })
        }
        Err(message) => {
            state.phase = "error".into();
            state.last_error = Some(message.into());
            write_at(root, &state)?;
            Ok(AttemptOutcome::TechnicalFailure { state })
        }
    }
}

async fn run_cycle_at(
    root: &Path,
    voice: crate::voice_session::VoiceSessionStore,
    emit: impl Fn(&StudySnapshot),
    ticket: u64,
) -> Result<StudySnapshot, String> {
    let lessons = curriculum()?;
    let now = crate::capabilities::current_utc_timestamp()?;
    let state = update_current_at(root, ticket, &COORDINATOR, |state| {
        state.phase = if state.enabled {
            "studying".into()
        } else {
            "disabled".into()
        };
        if state.enabled {
            state.last_started_at = Some(now);
        }
        state.last_error = None;
    })?;
    emit(&state);
    if !state.enabled || !COORDINATOR.current(ticket) {
        return Ok(state);
    }
    let selected = plan(&lessons, &state);
    let runtime = crate::local_inference::runtime();
    let startup_generation = runtime.current_generation();
    let deadline = Instant::now() + Duration::from_secs(300);
    let generation = loop {
        if !COORDINATOR.current(ticket) || !runtime.generation_is_current(startup_generation) {
            let state = finish_at(root, "deferred", None, false, ticket)?;
            emit(&state);
            return Ok(state);
        }
        if Instant::now() >= deadline {
            let state = finish_at(
                root,
                "deferred",
                Some("No hubo un turno libre para iniciar el estudio"),
                false,
                ticket,
            )?;
            emit(&state);
            return Ok(state);
        }
        if voice.is_active() {
            yield_turn().await;
            continue;
        }
        let caller = runtime.clone();
        let started = tauri::async_runtime::spawn_blocking(move || {
            if !COORDINATOR.current(ticket) {
                return Ok(None);
            }
            caller.start_for_study(startup_generation)
        })
        .await
        .map_err(|_| "No se pudo programar el motor de estudio")?;
        match started {
            Ok(Some(_)) => break runtime.current_generation(),
            Ok(None) => yield_turn().await,
            Err(_) => {
                let state = finish_at(root, "error", Some("No se pudo iniciar Gemma local para estudiar; revisa su instalacion y el estado del motor"), false, ticket)?;
                emit(&state);
                return Ok(state);
            }
        }
    };
    let mut passed_count = 0;
    let mut attempted_count = 0;
    for lesson in &selected {
        let offset = usize::from(uuid::Uuid::new_v4().as_bytes()[0]) % 3;
        let response = loop {
            if Instant::now() >= deadline
                || !COORDINATOR.current(ticket)
                || !runtime.generation_is_current(generation)
            {
                let state = finish_at(root, "deferred", None, false, ticket)?;
                emit(&state);
                return Ok(state);
            }
            if voice.is_active() {
                yield_turn().await;
                continue;
            }
            let current_voice = voice.clone();
            match crate::local_inference::gemma_background_chat(
                quiz_body(lesson, offset),
                generation,
                move || !COORDINATOR.current(ticket) || current_voice.is_active(),
            )
            .await
            {
                Ok(Some(value)) => break Ok(value),
                Ok(None) => yield_turn().await,
                Err(_) if !runtime.generation_is_current(generation) => {
                    let state = finish_at(root, "deferred", None, false, ticket)?;
                    emit(&state);
                    return Ok(state);
                }
                Err(_) => break Err(()),
            }
        };
        // Recheck owner controls after I/O and again inside the persistence step.
        if !runtime.generation_is_current(generation) {
            break;
        }
        let now = crate::capabilities::current_utc_timestamp()?;
        let (state, passed) =
            match persist_checked_attempt_at(root, lesson, offset, response, &now, || {
                COORDINATOR.current(ticket) && runtime.generation_is_current(generation)
            })? {
                AttemptOutcome::Evaluated { state, passed } => (state, passed),
                AttemptOutcome::TechnicalFailure { state } => {
                    emit(&state);
                    return Ok(state);
                }
                AttemptOutcome::Cancelled => break,
            };
        attempted_count += 1;
        if passed {
            passed_count += 1;
        }
        emit(&state);
    }
    let complete = attempted_count == TRACKS.len()
        && COORDINATOR.current(ticket)
        && runtime.generation_is_current(generation);
    let phase = if !complete {
        "deferred"
    } else if passed_count == TRACKS.len() {
        "completed"
    } else {
        "partial"
    };
    let state = finish_at(root, phase, None, complete, ticket)?;
    emit(&state);
    Ok(state)
}

#[tauri::command]
pub(crate) fn self_study_status(app: AppHandle) -> Result<StudySnapshot, String> {
    read_at(&crate::util::alice_data_root_path(&app)?)
}
#[tauri::command]
pub(crate) fn set_self_study_enabled(
    app: AppHandle,
    input: SetStudyEnabled,
) -> Result<StudySnapshot, String> {
    let root = crate::util::alice_data_root_path(&app)?;
    let (state, launch) = set_enabled_at(&root, input.enabled, &COORDINATOR)?;
    if !input.enabled {
        crate::local_inference::runtime().preempt_background();
    }
    let _ = app.emit("self-study-updated", &state);
    if let Some(ticket) = launch {
        launch_worker(app, ticket);
    }
    Ok(state)
}
fn set_enabled_at(
    root: &Path,
    enabled: bool,
    coordinator: &Coordinator,
) -> Result<(StudySnapshot, Option<u64>), String> {
    let mut schedule = coordinator
        .schedule
        .lock()
        .map_err(|_| "El coordinador de estudio esta ocupado")?;
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "El avance de estudio esta ocupado")?;
    let mut state = read_at(root)?;
    if state.enabled == enabled {
        return Ok((state, None));
    }
    state.enabled = enabled;
    state.phase = if enabled { "idle" } else { "disabled" }.into();
    state.last_error = None;
    write_at(root, &state)?;
    coordinator.control(enabled);
    let launch = if enabled {
        schedule.request(coordinator.ticket(), true)
    } else {
        schedule.cancel();
        None
    };
    Ok((state, launch))
}
pub(crate) fn spawn_self_study(app: AppHandle) {
    let launch = crate::util::alice_data_root_path(&app)
        .ok()
        .and_then(|root| claim_startup_at(&root, &COORDINATOR).ok().flatten());
    if let Some(ticket) = launch {
        launch_worker(app, ticket);
    }
}
fn claim_startup_at(root: &Path, coordinator: &Coordinator) -> Result<Option<u64>, String> {
    let mut schedule = coordinator
        .schedule
        .lock()
        .map_err(|_| "El coordinador de estudio esta ocupado")?;
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "El avance de estudio esta ocupado")?;
    if !read_at(root)?.enabled {
        coordinator.control(false);
        schedule.cancel();
        return Ok(None);
    }
    Ok(schedule.request(coordinator.ticket(), false))
}
fn launch_worker(app: AppHandle, ticket: u64) {
    struct RunningGuard {
        app: AppHandle,
        ticket: u64,
    }
    impl Drop for RunningGuard {
        fn drop(&mut self) {
            let launch = COORDINATOR.schedule.lock().ok().and_then(|mut schedule| {
                schedule.finish(self.ticket, COORDINATOR.current(COORDINATOR.ticket()))
            });
            if let Some(ticket) = launch {
                launch_worker(self.app.clone(), ticket);
            }
        }
    }
    tauri::async_runtime::spawn(async move {
        let _guard = RunningGuard {
            app: app.clone(),
            ticket,
        };
        let root = match crate::util::alice_data_root_path(&app) {
            Ok(root) => root,
            Err(_) => return,
        };
        let voice = app
            .state::<crate::voice_session::VoiceSessionStore>()
            .inner()
            .clone();
        if run_cycle_at(
            &root,
            voice,
            |state| {
                let _ = app.emit("self-study-updated", state);
            },
            ticket,
        )
        .await
        .is_err()
        {
            if let Ok(state) = finish_at(&root, "error", Some("El avance o el curriculo no pudo verificarse; se conservaron los datos existentes"), false, ticket) {
                let _ = app.emit("self-study-updated", &state);
            }
        }
    });
}

#[cfg(test)]
mod tests;
