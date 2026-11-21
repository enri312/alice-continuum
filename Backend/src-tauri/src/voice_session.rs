use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use uuid::Uuid;

pub(crate) const VOICE_SESSION_LIMIT: Duration = Duration::from_secs(2 * 60 * 60);

struct VoiceSession {
    id: String,
    started: Instant,
    #[cfg(windows)]
    _spotify_volume: Option<crate::voice_spotify_volume::SpotifyVolumeGuard>,
}

#[derive(Clone, Default)]
pub(crate) struct VoiceSessionStore(Arc<Mutex<Option<VoiceSession>>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VoiceSessionInput {
    pub(crate) session_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VoiceSessionStarted {
    session_id: String,
}

impl VoiceSessionStore {
    pub(crate) fn is_active(&self) -> bool {
        self.0.lock().is_ok_and(|active| {
            active
                .as_ref()
                .is_some_and(|session| session.started.elapsed() < VOICE_SESSION_LIMIT)
        })
    }

    fn begin(&self, _duck_spotify: bool) -> Result<String, String> {
        crate::local_inference::runtime().preempt_background();
        let mut active = self.0.lock().map_err(|_| "Sesión de voz bloqueada")?;
        // Restore the earlier session's volume before replacing it.
        *active = None;
        let id = Uuid::new_v4().to_string();
        *active = Some(VoiceSession {
            id: id.clone(),
            started: Instant::now(),
            #[cfg(windows)]
            _spotify_volume: _duck_spotify
                .then(crate::voice_spotify_volume::SpotifyVolumeGuard::begin)
                .transpose()?,
        });
        Ok(id)
    }

    #[cfg(all(test, target_os = "linux"))]
    pub(crate) fn begin_for_capture_test(&self) -> Result<String, String> {
        self.begin(false)
    }

    pub(crate) fn require(&self, id: &str) -> Result<(), String> {
        let active = self.0.lock().map_err(|_| "Sesión de voz bloqueada")?;
        if active.as_ref().is_some_and(|session| {
            session.id == id && session.started.elapsed() < VOICE_SESSION_LIMIT
        }) {
            Ok(())
        } else {
            Err("La sesión de voz terminó o venció. Inicia una conversación nueva.".into())
        }
    }

    // An accepted request can outlive revocation while its model call finishes.
    // Recheck before exposing its result to history, memory or the next stage.
    pub(crate) fn complete<T>(&self, id: &str, result: Result<T, String>) -> Result<T, String> {
        result.and_then(|value| {
            self.require(id)?;
            Ok(value)
        })
    }

    fn stop(&self, id: &str) -> Result<(), String> {
        let mut active = self.0.lock().map_err(|_| "Sesión de voz bloqueada")?;
        if active.as_ref().is_some_and(|session| session.id == id) {
            *active = None;
        }
        Ok(())
    }

    pub(crate) fn end(&self) {
        if let Ok(mut active) = self.0.lock() {
            *active = None;
        }
    }
}

fn audit_session(app: &AppHandle, reason: &str) -> Result<(), String> {
    use crate::audit::*;
    record_producer_audit(
        app,
        new_operation_id(),
        AuditSource::Cloud,
        "output.voice.synthesize".into(),
        "voice.session".into(),
        AuditStage::Execution,
        AuditOutcome::Success,
        None,
        None,
        reason,
    )
}

#[tauri::command]
pub(crate) fn start_voice_session(
    app: AppHandle,
    state: State<'_, VoiceSessionStore>,
    duck_spotify: Option<bool>,
) -> Result<VoiceSessionStarted, String> {
    if !crate::voice_output::voice_is_configured(&app) {
        return Err(
            "Configura la clave y la voz de Fish antes de iniciar la conversación por voz.".into(),
        );
    }
    let session_id = state.begin(duck_spotify.unwrap_or_default())?;
    if let Err(error) = audit_session(&app, "VOICE_SESSION_STARTED") {
        state.stop(&session_id)?;
        return Err(error);
    }
    Ok(VoiceSessionStarted { session_id })
}

#[tauri::command]
pub(crate) fn stop_voice_session(
    app: AppHandle,
    state: State<'_, VoiceSessionStore>,
    input: VoiceSessionInput,
) -> Result<(), String> {
    state.stop(&input.session_id)?;
    audit_session(&app, "VOICE_SESSION_STOPPED")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn session_is_explicit_revocable_and_replaced_without_revoking_a_new_one() {
        let store = VoiceSessionStore::default();
        assert!(!store.is_active());
        assert!(store.require("arbitrary").is_err());
        let first = store.begin(false).unwrap();
        assert!(store.is_active());
        assert!(store.require(&first).is_ok());
        let second = store.begin(false).unwrap();
        assert!(store.require(&first).is_err());
        store.stop(&first).unwrap();
        assert!(store.require(&second).is_ok());
        store.stop(&second).unwrap();
        assert!(!store.is_active());
        assert!(store.require(&second).is_err());
    }

    #[test]
    fn completed_results_do_not_escape_a_revoked_or_replaced_session() {
        let store = VoiceSessionStore::default();
        let first = store.begin(false).unwrap();
        assert_eq!(store.complete(&first, Ok("respuesta")), Ok("respuesta"));
        store.stop(&first).unwrap();
        assert!(store.complete(&first, Ok("respuesta tardía")).is_err());
        let second = store.begin(false).unwrap();
        let third = store.begin(false).unwrap();
        assert!(store.complete(&second, Ok("respuesta anterior")).is_err());
        assert_eq!(
            store.complete(&third, Err::<(), _>("fallo original".into())),
            Err("fallo original".into())
        );
    }
}
