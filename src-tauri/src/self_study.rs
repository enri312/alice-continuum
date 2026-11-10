//! Startup study orchestration and Tauri commands for a closed, sourced curriculum.
mod domain;
mod model;
mod prompts;
mod storage;

use domain::{apply_answer, curriculum, plan, TRACKS};
pub(crate) use model::{SetStudyEnabled, StudySnapshot};
use prompts::{checked_answer, quiz_body};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use storage::{read_at, update_at, write_at, WRITE_LOCK};
use tauri::{AppHandle, Emitter, Manager};

static RUNNING: AtomicBool = AtomicBool::new(false);
static ENABLED: AtomicBool = AtomicBool::new(true);

async fn yield_turn() {
    let _ = tauri::async_runtime::spawn_blocking(|| std::thread::sleep(Duration::from_millis(500)))
        .await;
}
fn finish_at(
    root: &Path,
    phase: &str,
    error: Option<&str>,
    completed: bool,
) -> Result<StudySnapshot, String> {
    let now = crate::capabilities::current_utc_timestamp()?;
    update_at(root, |state| {
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
async fn run_cycle_at(
    root: &Path,
    voice: crate::voice_session::VoiceSessionStore,
    emit: impl Fn(&StudySnapshot),
) -> Result<StudySnapshot, String> {
    let lessons = curriculum()?;
    let now = crate::capabilities::current_utc_timestamp()?;
    let state = update_at(root, |state| {
        ENABLED.store(state.enabled, Ordering::Release);
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
    if !state.enabled {
        return Ok(state);
    }
    let selected = plan(&lessons, &state);
    let runtime = crate::local_inference::runtime();
    let startup_generation = runtime.current_generation();
    let deadline = Instant::now() + Duration::from_secs(300);
    let generation = loop {
        if !ENABLED.load(Ordering::Acquire) || !runtime.generation_is_current(startup_generation) {
            let state = finish_at(root, "deferred", None, false)?;
            emit(&state);
            return Ok(state);
        }
        if Instant::now() >= deadline {
            let state = finish_at(
                root,
                "deferred",
                Some("No hubo un turno libre para iniciar el estudio"),
                false,
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
            caller.start_for_study(startup_generation)
        })
        .await
        .map_err(|_| "No se pudo programar el motor de estudio")?;
        match started {
            Ok(Some(_)) => break runtime.current_generation(),
            Ok(None) => yield_turn().await,
            Err(_) => {
                let state = finish_at(root, "error", Some("No se pudo iniciar Gemma local para estudiar; revisa su instalacion y el estado del motor"), false)?;
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
                || !ENABLED.load(Ordering::Acquire)
                || !runtime.generation_is_current(generation)
            {
                let state = finish_at(root, "deferred", None, false)?;
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
                move || !ENABLED.load(Ordering::Acquire) || current_voice.is_active(),
            )
            .await
            {
                Ok(Some(value)) => break Some(value),
                Ok(None) => yield_turn().await,
                Err(_) if !runtime.generation_is_current(generation) => {
                    let state = finish_at(root, "deferred", None, false)?;
                    emit(&state);
                    return Ok(state);
                }
                Err(_) => break None,
            }
        };
        let passed = response
            .as_ref()
            .and_then(|response| checked_answer(response, lesson, offset).ok())
            .unwrap_or(false);
        // Recheck owner controls after I/O and again under the persistence lock.
        if !runtime.generation_is_current(generation) {
            break;
        }
        let now = crate::capabilities::current_utc_timestamp()?;
        let saved = {
            let _lock = WRITE_LOCK
                .lock()
                .map_err(|_| "El avance de estudio esta ocupado")?;
            let mut state = read_at(root)?;
            if state.enabled
                && ENABLED.load(Ordering::Acquire)
                && runtime.generation_is_current(generation)
            {
                apply_answer(&mut state, lesson, passed, &now)?;
                write_at(root, &state)?;
                Some(state)
            } else {
                None
            }
        };
        let Some(state) = saved else {
            break;
        };
        attempted_count += 1;
        if passed {
            passed_count += 1;
        }
        emit(&state);
    }
    let complete = attempted_count == TRACKS.len()
        && ENABLED.load(Ordering::Acquire)
        && runtime.generation_is_current(generation);
    let phase = if !complete {
        "deferred"
    } else if passed_count == TRACKS.len() {
        "completed"
    } else {
        "partial"
    };
    let state = finish_at(root, phase, None, complete)?;
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
    let state = update_at(&root, |state| {
        state.enabled = input.enabled;
        state.phase = if input.enabled {
            "idle".into()
        } else {
            "disabled".into()
        };
        state.last_error = None;
    })?;
    ENABLED.store(input.enabled, Ordering::Release);
    if !input.enabled {
        crate::local_inference::runtime().preempt_background();
    }
    let _ = app.emit("self-study-updated", &state);
    if input.enabled {
        spawn_self_study(app);
    }
    Ok(state)
}
pub(crate) fn spawn_self_study(app: AppHandle) {
    if RUNNING
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }
    struct RunningGuard;
    impl Drop for RunningGuard {
        fn drop(&mut self) {
            RUNNING.store(false, Ordering::Release);
        }
    }
    tauri::async_runtime::spawn(async move {
        let _guard = RunningGuard;
        let root = match crate::util::alice_data_root_path(&app) {
            Ok(root) => root,
            Err(_) => return,
        };
        let voice = app
            .state::<crate::voice_session::VoiceSessionStore>()
            .inner()
            .clone();
        if run_cycle_at(&root, voice, |state| {
            let _ = app.emit("self-study-updated", state);
        })
        .await
        .is_err()
        {
            if let Ok(state) = finish_at(&root, "error", Some("El avance o el curriculo no pudo verificarse; se conservaron los datos existentes"), false) {
                let _ = app.emit("self-study-updated", &state);
            }
        }
    });
}

#[cfg(test)]
mod tests;
