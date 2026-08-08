use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::State;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ForegroundContext {
    window_title: String,
    process_name: String,
}

#[derive(Default)]
struct ObservationData {
    enabled: bool,
    latest: Option<ForegroundContext>,
}

#[derive(Clone, Default)]
pub(crate) struct ObservationStore(Arc<Mutex<ObservationData>>);

impl ObservationStore {
    fn set_enabled(&self, enabled: bool) -> bool {
        let mut data = self.0.lock().expect("observation state lock");
        data.enabled = enabled;
        if !enabled {
            data.latest = None;
        }
        data.enabled
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
pub(crate) fn set_context_observation_enabled(
    store: State<ObservationStore>,
    enabled: bool,
) -> bool {
    store.set_enabled(enabled)
}

#[tauri::command]
pub(crate) fn get_foreground_context(store: State<ObservationStore>) -> Option<ForegroundContext> {
    store.latest_if_enabled()
}

pub(crate) fn spawn_observer_thread(store: ObservationStore) {
    thread::spawn(move || loop {
        if store.should_observe() {
            if let Some(context) = foreground_context() {
                if !context.process_name.eq_ignore_ascii_case("proyecto-p.exe") {
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
        assert!(store.set_enabled(true));
        store.update_latest(context());
        assert_eq!(store.latest_if_enabled(), Some(context()));
        assert!(!store.set_enabled(false));
        assert_eq!(store.latest_if_enabled(), None);
        assert_eq!(store.0.lock().expect("observation state lock").latest, None);
    }
}
