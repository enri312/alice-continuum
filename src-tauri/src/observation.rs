use crate::audit::{AuditOutcome, AuditStage};
use crate::permissions::{record_permission_audit, PermissionGateway, PermissionGrantState};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, State};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ForegroundContext {
    window_title: String,
    process_name: String,
}

#[derive(Default)]
struct ObservationData {
    enabled: bool,
    active_grant_id: Option<String>,
    latest: Option<ForegroundContext>,
}

#[derive(Clone, Default)]
pub(crate) struct ObservationStore(Arc<Mutex<ObservationData>>);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ObservationCapabilityProbe {
    pub(crate) enabled: bool,
    pub(crate) has_latest_context: bool,
}

impl ObservationStore {
    pub(crate) fn capability_probe(&self) -> Result<ObservationCapabilityProbe, String> {
        let data = self
            .0
            .lock()
            .map_err(|_| "No se pudo consultar el estado de observación".to_string())?;
        Ok(ObservationCapabilityProbe {
            enabled: data.enabled,
            has_latest_context: data.enabled && data.latest.is_some(),
        })
    }

    pub(crate) fn apply_authorized_state(
        &self,
        enabled: bool,
        grant_id: Option<&str>,
    ) -> Result<bool, String> {
        if enabled && grant_id.is_none() {
            return Err("La observación requiere un grant de sesión activo".into());
        }
        let mut data = self
            .0
            .lock()
            .map_err(|_| "No se pudo modificar el estado de observación".to_string())?;
        data.enabled = enabled;
        data.active_grant_id = enabled.then(|| grant_id.expect("checked above").to_string());
        if !enabled {
            data.latest = None;
        }
        Ok(data.enabled)
    }

    pub(crate) fn active_grant_id(&self) -> Result<Option<String>, String> {
        self.0
            .lock()
            .map(|data| data.active_grant_id.clone())
            .map_err(|_| "No se pudo consultar el grant de observación".to_string())
    }

    pub(crate) fn disable_for_grant(&self, grant_id: &str) -> Result<bool, String> {
        let mut data = self
            .0
            .lock()
            .map_err(|_| "No se pudo revocar la observación".to_string())?;
        if data.active_grant_id.as_deref() == Some(grant_id) {
            data.enabled = false;
            data.active_grant_id = None;
            data.latest = None;
        }
        Ok(data.enabled)
    }

    fn reconcile_grant_with_audit(
        &self,
        gateway: &PermissionGateway,
        app: &AppHandle,
    ) -> Result<bool, String> {
        let Some(grant_id) = self.active_grant_id()? else {
            return Ok(false);
        };
        if gateway.session_is_active(&grant_id)? {
            return Ok(true);
        }
        self.disable_for_grant(&grant_id)?;
        let grant = gateway.grant(&grant_id)?;
        let reason = if grant.state == PermissionGrantState::Expired {
            "GRANT_EXPIRED"
        } else {
            "SESSION_ENDED"
        };
        let context = gateway.audit_context_for_grant(&grant_id)?;
        if let Err(error) = record_permission_audit(
            app,
            &context,
            AuditStage::Stop,
            None,
            AuditOutcome::Success,
            None,
            reason,
        ) {
            eprintln!("Observación cerrada sin evidencia R3: {error}");
        }
        Ok(false)
    }

    fn latest_if_enabled(&self) -> Option<ForegroundContext> {
        let data = self.0.lock().expect("observation state lock");
        if data.enabled {
            data.latest.clone()
        } else {
            None
        }
    }

    fn should_observe(&self) -> bool {
        self.0.lock().map(|data| data.enabled).unwrap_or(false)
    }

    fn update_latest(&self, context: ForegroundContext) {
        if let Ok(mut data) = self.0.lock() {
            data.latest = Some(context);
        }
    }
}

#[cfg(target_os = "windows")]
fn foreground_context() -> Option<ForegroundContext> {
    use std::path::Path;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let length = GetWindowTextLengthW(hwnd);
        if length == 0 {
            return None;
        }
        let mut title_buffer = vec![0_u16; length as usize + 1];
        let copied = GetWindowTextW(hwnd, &mut title_buffer);
        let window_title = String::from_utf16_lossy(&title_buffer[..copied as usize]);
        let mut process_id = 0_u32;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;
        let mut path_buffer = vec![0_u16; 32_768];
        let mut path_size = path_buffer.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(path_buffer.as_mut_ptr()),
            &mut path_size,
        );
        let _ = CloseHandle(handle);
        result.ok()?;
        let full_path = String::from_utf16_lossy(&path_buffer[..path_size as usize]);
        let process_name = Path::new(&full_path)
            .file_name()?
            .to_string_lossy()
            .to_string();
        Some(ForegroundContext {
            window_title,
            process_name,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn foreground_context() -> Option<ForegroundContext> {
    None
}

#[tauri::command]
pub(crate) fn get_foreground_context(
    store: State<ObservationStore>,
    gateway: State<PermissionGateway>,
    app: AppHandle,
) -> Result<Option<ForegroundContext>, String> {
    store.reconcile_grant_with_audit(&gateway, &app)?;
    Ok(store.latest_if_enabled())
}

pub(crate) fn spawn_observer_thread(
    store: ObservationStore,
    gateway: PermissionGateway,
    app: AppHandle,
) {
    thread::spawn(move || loop {
        if store.reconcile_grant_with_audit(&gateway, &app).is_err() {
            if let Ok(Some(grant_id)) = store.active_grant_id() {
                let _ = store.disable_for_grant(&grant_id);
            }
        }
        if store.should_observe() {
            if let Some(context) = foreground_context() {
                if !context
                    .process_name
                    .eq_ignore_ascii_case("alice-cognitive-core.exe")
                    && !context.process_name.eq_ignore_ascii_case("proyecto-p.exe")
                {
                    store.update_latest(context);
                }
            }
        }
        thread::sleep(Duration::from_secs(2));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> ForegroundContext {
        ForegroundContext {
            window_title: "Editor".into(),
            process_name: "editor.exe".into(),
        }
    }

    #[test]
    fn observation_starts_disabled_and_hides_context() {
        let store = ObservationStore::default();
        store.update_latest(context());
        assert!(!store.should_observe());
        assert_eq!(store.latest_if_enabled(), None);
    }

    #[test]
    fn disabling_observation_clears_the_latest_context() {
        let store = ObservationStore::default();
        assert_eq!(
            store.apply_authorized_state(true, Some("grant_0123456789")),
            Ok(true)
        );
        store.update_latest(context());
        assert_eq!(store.latest_if_enabled(), Some(context()));
        assert_eq!(store.apply_authorized_state(false, None), Ok(false));
        assert_eq!(store.latest_if_enabled(), None);
        assert_eq!(store.0.lock().expect("observation state lock").latest, None);
        assert_eq!(store.active_grant_id(), Ok(None));
    }

    #[test]
    fn capability_probe_reads_state_without_capturing_or_mutating_context() {
        let store = ObservationStore::default();
        assert_eq!(
            store.capability_probe(),
            Ok(ObservationCapabilityProbe {
                enabled: false,
                has_latest_context: false,
            })
        );

        assert_eq!(
            store.apply_authorized_state(true, Some("grant_0123456789")),
            Ok(true)
        );
        assert_eq!(
            store.capability_probe(),
            Ok(ObservationCapabilityProbe {
                enabled: true,
                has_latest_context: false,
            })
        );
        assert_eq!(store.latest_if_enabled(), None);

        store.update_latest(context());
        assert_eq!(
            store.capability_probe(),
            Ok(ObservationCapabilityProbe {
                enabled: true,
                has_latest_context: true,
            })
        );
        assert_eq!(store.latest_if_enabled(), Some(context()));
    }

    #[test]
    fn observation_cannot_start_without_a_session_grant() {
        let store = ObservationStore::default();
        assert!(store.apply_authorized_state(true, None).is_err());
        assert!(!store.capability_probe().unwrap().enabled);
        assert_eq!(store.active_grant_id(), Ok(None));
    }

    #[test]
    fn revoking_the_bound_grant_clears_observation_and_context() {
        let store = ObservationStore::default();
        store
            .apply_authorized_state(true, Some("grant_0123456789"))
            .unwrap();
        store.update_latest(context());

        assert_eq!(store.disable_for_grant("grant_other_00001"), Ok(true));
        assert_eq!(store.latest_if_enabled(), Some(context()));
        assert_eq!(store.disable_for_grant("grant_0123456789"), Ok(false));
        assert_eq!(store.latest_if_enabled(), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    #[ignore = "requiere un escritorio interactivo de Windows"]
    fn live_foreground_probe_reads_real_metadata_without_persisting_it() {
        let observed = foreground_context()
            .expect("Windows debe tener una ventana externa activa para esta prueba manual");
        assert!(!observed.window_title.trim().is_empty());
        assert!(!observed.process_name.trim().is_empty());
    }
}
