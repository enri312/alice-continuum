//! Narrow Windows adapters: Spotify's own collection and YouTube inside Chrome.
//! No keyboard injection, debugging ports, arbitrary URLs or system-wide media keys.
use crate::media_actions::{youtube_watch_url, CancellationCheck, MediaOperation, YoutubeVideo};
use std::{
    path::PathBuf,
    process::Command,
    time::{Duration, Instant},
};

pub(crate) fn chrome_path() -> Result<PathBuf, String> {
    for (root, suffix) in [
        ("ProgramFiles", "Google/Chrome/Application/chrome.exe"),
        ("ProgramFiles(x86)", "Google/Chrome/Application/chrome.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
    ] {
        if let Some(root) = std::env::var_os(root) {
            let path = PathBuf::from(root).join(suffix);
            if path.is_file() {
                return Ok(path);
            }
        }
    }
    Err("No encontré Google Chrome instalado en este equipo".into())
}
pub(crate) fn allowed_youtube_url(value: &str, expected: Option<&str>) -> bool {
    let raw = if value.starts_with("www.youtube.com/") {
        format!("https://{value}")
    } else {
        value.into()
    };
    reqwest::Url::parse(&raw).ok().is_some_and(|url| {
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && matches!(url.host_str(), Some("www.youtube.com" | "youtube.com"))
            && url.path() == "/watch"
            && url.query_pairs().any(|(key, value)| {
                key == "v"
                    && value.len() == 11
                    && value
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
                    && expected.is_none_or(|id| id == value)
            })
    })
}

fn allowed_search_url(value: &str, query: &str) -> bool {
    let value = if value.starts_with("www.youtube.com/") {
        format!("https://{value}")
    } else {
        value.into()
    };
    reqwest::Url::parse(&value).ok().is_some_and(|url| {
        url.scheme() == "https"
            && matches!(url.host_str(), Some("www.youtube.com" | "youtube.com"))
            && url.path() == "/results"
            && url.username().is_empty()
            && url.password().is_none()
            && url
                .query_pairs()
                .any(|(key, value)| key == "search_query" && value == query)
    })
}
pub(crate) fn open_chrome(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "Dirección de YouTube inválida")?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("www.youtube.com")
        || !["/", "/watch", "/results"].contains(&parsed.path())
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Sólo está permitido abrir YouTube en Chrome".into());
    }
    Command::new(chrome_path()?)
        .arg("--new-window")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Chrome no pudo abrir YouTube: {e}"))
}

#[cfg(windows)]
mod platform {
    use super::*;
    use windows::{
        core::{w, Interface, PCWSTR, PWSTR},
        Media::Control::{
            GlobalSystemMediaTransportControlsSessionManager as Sessions,
            GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
        },
        Win32::{
            Foundation::{CloseHandle, HWND, LPARAM},
            System::{Com::*, Threading::*, Variant::VARIANT},
            UI::{Accessibility::*, Shell::ShellExecuteW, WindowsAndMessaging::*},
        },
    };

    struct Apartment;
    impl Apartment {
        fn enter() -> Result<Self, String> {
            unsafe {
                CoInitializeEx(None, COINIT_MULTITHREADED)
                    .ok()
                    .map_err(|e| e.to_string())?;
            }
            Ok(Self)
        }
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    fn automation() -> Result<IUIAutomation, String> {
        unsafe {
            let ui: IUIAutomation2 = CoCreateInstance(&CUIAutomation8, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| e.to_string())?;
            ui.SetConnectionTimeout(2000).map_err(|e| e.to_string())?;
            ui.SetTransactionTimeout(2000).map_err(|e| e.to_string())?;
            ui.cast().map_err(|e| e.to_string())
        }
    }
    fn property(
        ui: &IUIAutomation,
        id: UIA_PROPERTY_ID,
        value: VARIANT,
    ) -> windows::core::Result<IUIAutomationCondition> {
        unsafe { ui.CreatePropertyCondition(id, &value) }
    }
    fn elements(
        ui: &IUIAutomation,
        root: &IUIAutomationElement,
        kind: UIA_CONTROLTYPE_ID,
    ) -> Vec<IUIAutomationElement> {
        unsafe {
            let Ok(condition) = property(ui, UIA_ControlTypePropertyId, VARIANT::from(kind.0))
            else {
                return vec![];
            };
            let Ok(array) = root.FindAll(TreeScope_Descendants, &condition) else {
                return vec![];
            };
            (0..array.Length().unwrap_or(0).min(4000))
                .filter_map(|i| array.GetElement(i).ok())
                .collect()
        }
    }
    fn name(element: &IUIAutomationElement) -> String {
        unsafe {
            element
                .CurrentName()
                .map(|s| s.to_string())
                .unwrap_or_default()
        }
    }
    fn value(element: &IUIAutomationElement) -> String {
        unsafe {
            if let Ok(pattern) =
                element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
            {
                if let Ok(value) = pattern.CurrentValue() {
                    if !value.is_empty() {
                        return value.to_string();
                    }
                }
            }
            element
                .GetCurrentPatternAs::<IUIAutomationLegacyIAccessiblePattern>(
                    UIA_LegacyIAccessiblePatternId,
                )
                .and_then(|p| p.CurrentValue())
                .map(|s| s.to_string())
                .unwrap_or_default()
        }
    }
    fn invoke(element: &IUIAutomationElement) -> Result<(), String> {
        unsafe {
            if !element
                .CurrentIsEnabled()
                .map_err(|e| e.to_string())?
                .as_bool()
            {
                return Err("El reproductor todavía no habilitó el botón".into());
            }
            element
                .GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
                .and_then(|p| p.Invoke())
                .map_err(|e| format!("No pude activar el reproductor: {e}"))
        }
    }
    unsafe extern "system" fn collect_window(hwnd: HWND, parameter: LPARAM) -> windows::core::BOOL {
        unsafe {
            (*(parameter.0 as *mut Vec<HWND>)).push(hwnd);
        }
        true.into()
    }
    fn app_windows(executable: &str) -> Vec<HWND> {
        unsafe {
            let mut handles = Vec::<HWND>::new();
            let _ = EnumWindows(
                Some(collect_window),
                LPARAM(&mut handles as *mut _ as isize),
            );
            handles
                .into_iter()
                .filter(|hwnd| {
                    if !IsWindowVisible(*hwnd).as_bool() {
                        return false;
                    }
                    let mut pid = 0;
                    GetWindowThreadProcessId(*hwnd, Some(&mut pid));
                    let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
                    else {
                        return false;
                    };
                    let mut buffer = [0u16; 4096];
                    let mut size = buffer.len() as u32;
                    let result = QueryFullProcessImageNameW(
                        process,
                        PROCESS_NAME_WIN32,
                        PWSTR(buffer.as_mut_ptr()),
                        &mut size,
                    );
                    let _ = CloseHandle(process);
                    result.is_ok()
                        && String::from_utf16_lossy(&buffer[..size as usize])
                            .to_lowercase()
                            .ends_with(&format!("\\{executable}"))
                })
                .collect()
        }
    }
    fn restore(hwnd: HWND) {
        unsafe {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindowAsync(hwnd, SW_RESTORE);
            }
        }
    }
    fn likes_title(name: &str) -> bool {
        let name = name.to_lowercase();
        [
            "tus me gusta",
            "canciones que te gustan",
            "canciones que me gustan",
            "liked songs",
            "temas que te gustan",
        ]
        .iter()
        .any(|t| name.contains(t))
    }
    fn play_name(name: &str) -> bool {
        let name = name.to_lowercase();
        name == "play"
            || name == "reproducir"
            || name.starts_with("play ")
            || name.starts_with("reproducir ")
    }
    fn pause_name(name: &str) -> bool {
        let name = name.to_lowercase();
        name == "pause" || name.starts_with("pause ") || name.starts_with("paus")
    }
    fn spotify_scope(
        ui: &IUIAutomation,
        root: &IUIAutomationElement,
    ) -> Option<IUIAutomationElement> {
        unsafe {
            if let Ok(condition) = property(ui, UIA_AriaRolePropertyId, VARIANT::from("main")) {
                if let Ok(main) = root.FindFirst(TreeScope_Descendants, &condition) {
                    if likes_title(&name(&main))
                        || elements(ui, &main, UIA_TextControlTypeId)
                            .iter()
                            .any(|e| likes_title(&name(e)))
                    {
                        return Some(main);
                    }
                }
            }
            elements(ui, root, UIA_DocumentControlTypeId)
                .into_iter()
                .find(|document| {
                    let location = value(document);
                    location.starts_with("https://xpui.app.spotify.com/")
                        && location.contains("/collection/tracks")
                })
        }
    }
    fn spotify_collection(check: &CancellationCheck) -> Result<String, String> {
        check()?;
        // A cold start may run Spotify's own updater before exposing controls.
        // An already open player still has the shorter normal response budget.
        let startup_budget = if app_windows("spotify.exe").is_empty() {
            60
        } else {
            18
        };
        // Windows resolves the installed Spotify application; no free-form URI is accepted.
        let result = unsafe {
            ShellExecuteW(
                None,
                w!("open"),
                w!("spotify:collection:tracks"),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if result.0 as isize <= 32 {
            return Err("Windows no pudo abrir Tus me gusta en Spotify".into());
        }
        let ui = automation()?;
        let deadline = Instant::now() + Duration::from_secs(startup_budget);
        let mut invoked = false;
        while Instant::now() < deadline {
            check()?;
            for hwnd in app_windows("spotify.exe") {
                restore(hwnd);
                let Ok(root) = (unsafe { ui.ElementFromHandle(hwnd) }) else {
                    continue;
                };
                let Some(main) = spotify_scope(&ui, &root) else {
                    continue;
                };
                let buttons = elements(&ui, &main, UIA_ButtonControlTypeId);
                if buttons.iter().any(|b| pause_name(&name(b))) {
                    return Ok("Spotify está reproduciendo Tus me gusta.".into());
                }
                if !invoked {
                    let button = buttons
                        .iter()
                        .find(|b| play_name(&name(b)) && likes_title(&name(b)))
                        .or_else(|| {
                            buttons.iter().find(|b| {
                                matches!(name(b).to_lowercase().as_str(), "play" | "reproducir")
                            })
                        });
                    if let Some(button) = button {
                        check()?;
                        invoke(button)?;
                        invoked = true;
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err("Envié la solicitud para abrir Tus me gusta, pero Spotify no confirmó la reproducción. Puede seguir iniciándose o actualizándose; comprueba también tu sesión y que la colección tenga canciones.".into())
    }
    fn spotify_windows_transport(pause: bool, check: &CancellationCheck) -> Result<String, String> {
        let manager = Sessions::RequestAsync()
            .and_then(|op| op.join())
            .map_err(|e| format!("Windows no pudo consultar Spotify: {e}"))?;
        let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
        for index in 0..sessions.Size().map_err(|e| e.to_string())? {
            let session = sessions.GetAt(index).map_err(|e| e.to_string())?;
            if !session
                .SourceAppUserModelId()
                .map_err(|e| e.to_string())?
                .to_string()
                .to_lowercase()
                .contains("spotify")
            {
                continue;
            }
            check()?;
            let accepted = if pause {
                session.TryPauseAsync()
            } else {
                session.TryPlayAsync()
            }
            .and_then(|op| op.join())
            .map_err(|e| e.to_string())?;
            if !accepted {
                return Err("Spotify rechazó la orden de reproducción".into());
            }
            for _ in 0..10 {
                check()?;
                let state = session
                    .GetPlaybackInfo()
                    .and_then(|info| info.PlaybackStatus())
                    .map_err(|e| e.to_string())?;
                if (pause && matches!(state, Status::Paused | Status::Stopped))
                    || (!pause && state == Status::Playing)
                {
                    return Ok(if pause {
                        "Spotify quedó en pausa."
                    } else {
                        "Spotify está reproduciendo de nuevo."
                    }
                    .into());
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            return Err(
                "Windows envió la orden, pero Spotify todavía no confirmó el nuevo estado".into(),
            );
        }
        Err("Spotify no tiene una sesión de reproducción disponible. Pide «reproduce mis me gusta en Spotify».".into())
    }
    fn spotify_player_transport(pause: bool, check: &CancellationCheck) -> Result<String, String> {
        check()?;
        let ui = automation()?;
        let deadline = Instant::now() + Duration::from_secs(6);
        let mut invoked = false;
        while Instant::now() < deadline {
            check()?;
            let mut players = Vec::new();
            for hwnd in app_windows("spotify.exe") {
                restore(hwnd);
                let Ok(root) = (unsafe { ui.ElementFromHandle(hwnd) }) else {
                    continue;
                };
                for label in [
                    "Controles del reproductor",
                    "Player controls",
                    "Playback controls",
                ] {
                    let Ok(condition) = property(&ui, UIA_NamePropertyId, VARIANT::from(label))
                    else {
                        continue;
                    };
                    if let Ok(player) = unsafe { root.FindFirst(TreeScope_Descendants, &condition) }
                    {
                        if unsafe { player.CurrentControlType() } == Ok(UIA_GroupControlTypeId) {
                            players.push(player);
                        }
                    }
                }
            }
            if players.len() > 1 {
                return Err("Hay varios reproductores de Spotify visibles; deja abierto sólo el que quieres controlar.".into());
            }
            if let Some(player) = players.pop() {
                let buttons = elements(&ui, &player, UIA_ButtonControlTypeId);
                // Exact transport names inside its own labelled group. Never a
                // song row, the queue, another app, or a system-wide media key.
                let play = buttons
                    .iter()
                    .find(|b| matches!(name(b).to_lowercase().as_str(), "play" | "reproducir"));
                let playing = buttons
                    .iter()
                    .find(|b| matches!(name(b).to_lowercase().as_str(), "pause" | "pausar"));
                if play.is_some() != playing.is_some() {
                    if (pause && play.is_some()) || (!pause && playing.is_some()) {
                        return Ok(if pause {
                            "Spotify quedó en pausa."
                        } else {
                            "Spotify está reproduciendo de nuevo."
                        }
                        .into());
                    }
                    if !invoked {
                        if let Some(button) = if pause { playing } else { play } {
                            check()?;
                            invoke(button)?;
                            invoked = true;
                        }
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err("No pude confirmar el control del reproductor de Spotify. Deja su ventana abierta e inténtalo de nuevo.".into())
    }
    fn spotify_transport(pause: bool, check: &CancellationCheck) -> Result<String, String> {
        match spotify_windows_transport(pause, check) {
            Ok(text) => Ok(text),
            Err(_) => {
                check()?;
                spotify_player_transport(pause, check)
            }
        }
    }
    pub(crate) fn spotify(
        operation: MediaOperation,
        check: CancellationCheck,
    ) -> Result<String, String> {
        let _apartment = Apartment::enter()?;
        match operation {
            MediaOperation::Play => spotify_collection(&check),
            MediaOperation::Pause => spotify_transport(true, &check),
            MediaOperation::Resume => spotify_transport(false, &check),
            MediaOperation::Open => Err("Para abrir Spotify usa «abre Spotify».".into()),
        }
    }

    enum YoutubePage<'a> {
        Search(&'a str),
        Watch(Option<&'a str>),
    }
    fn youtube_scope(
        ui: &IUIAutomation,
        page: YoutubePage<'_>,
        excluded: &[isize],
    ) -> Result<Option<IUIAutomationElement>, String> {
        let mut matches = Vec::new();
        for hwnd in app_windows("chrome.exe") {
            if excluded.contains(&(hwnd.0 as isize)) {
                continue;
            }
            let mut title = [0u16; 1024];
            let length = unsafe { GetWindowTextW(hwnd, &mut title) };
            if !String::from_utf16_lossy(&title[..length.max(0) as usize]).contains("YouTube") {
                continue;
            }
            restore(hwnd);
            let Ok(root) = (unsafe { ui.ElementFromHandle(hwnd) }) else {
                continue;
            };
            for document in elements(ui, &root, UIA_DocumentControlTypeId) {
                let location = value(&document);
                let allowed = match page {
                    YoutubePage::Watch(expected) => allowed_youtube_url(&location, expected),
                    YoutubePage::Search(query) => allowed_search_url(&location, query),
                };
                if allowed {
                    matches.push(document);
                }
            }
        }
        if matches.len() > 1 {
            return Err("Hay varias páginas de YouTube que coinciden. Deja visible la que quieres controlar.".into());
        }
        Ok(matches.pop())
    }
    fn search_youtube(
        ui: &IUIAutomation,
        query: &str,
        excluded: &[isize],
        check: &CancellationCheck,
    ) -> Result<YoutubeVideo, String> {
        let url = crate::media_actions::youtube_search_url(query)?;
        check()?;
        open_chrome(url.as_str())?;
        let deadline = Instant::now() + Duration::from_secs(18);
        while Instant::now() < deadline {
            check()?;
            if let Some(document) = youtube_scope(ui, YoutubePage::Search(query), excluded)? {
                let links = elements(ui, &document, UIA_HyperlinkControlTypeId);
                let metadata: Vec<_> = links.iter().map(|link| (value(link), name(link))).collect();
                if let Ok(video) = crate::media_actions::select_youtube_link(metadata, query) {
                    if let Some(link) = links
                        .iter()
                        .find(|link| allowed_youtube_url(&value(link), Some(&video.id)))
                    {
                        check()?;
                        // A canonical watch URL is used if this provider cannot invoke links.
                        if invoke(link).is_err() {
                            check()?;
                            open_chrome(&youtube_watch_url(&video.id)?)?;
                        }
                        return Ok(video);
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err("Abrí la búsqueda en YouTube, pero no pude seleccionar un vídeo. Revisa si Chrome o YouTube muestran un aviso o necesitan iniciar sesión.".into())
    }
    pub(crate) fn youtube(
        operation: MediaOperation,
        query: Option<String>,
        previous: Option<String>,
        check: CancellationCheck,
    ) -> Result<(String, Option<String>), String> {
        let _apartment = Apartment::enter()?;
        check()?;
        if operation == MediaOperation::Open {
            open_chrome("https://www.youtube.com/")?;
            return Ok((
                "Abrí YouTube en Google Chrome. Dime qué canción quieres escuchar.".into(),
                None,
            ));
        }
        let ui = automation()?;
        let excluded: Vec<isize> = if query.is_some() {
            app_windows("chrome.exe")
                .into_iter()
                .map(|w| w.0 as isize)
                .collect()
        } else {
            vec![]
        };
        let video = if let Some(query) = query.as_deref() {
            Some(search_youtube(&ui, query, &excluded, &check)?)
        } else {
            None
        };
        let expected = video
            .as_ref()
            .map(|v| v.id.as_str())
            .or(previous.as_deref());
        let deadline = Instant::now() + Duration::from_secs(if video.is_some() { 18 } else { 6 });
        let mut invoked = false;
        while Instant::now() < deadline {
            check()?;
            if let Some(document) = youtube_scope(&ui, YoutubePage::Watch(expected), &excluded)? {
                let buttons = elements(&ui, &document, UIA_ButtonControlTypeId);
                let play = buttons.iter().find(|b| {
                    let name = name(b);
                    play_name(&name) && name.contains("(k)")
                });
                let pause = buttons.iter().find(|b| {
                    let name = name(b);
                    pause_name(&name) && name.contains("(k)")
                });
                let paused = operation == MediaOperation::Pause;
                if (paused && play.is_some()) || (!paused && pause.is_some()) {
                    let text = if paused {
                        "YouTube quedó en pausa.".into()
                    } else if let Some(video) = &video {
                        format!("Se inició la reproducción en YouTube: {}.", video.title)
                    } else {
                        "YouTube está reproduciendo de nuevo.".into()
                    };
                    return Ok((text, video.map(|v| v.id)));
                }
                if !invoked {
                    if let Some(button) = if paused { pause } else { play } {
                        check()?;
                        invoke(button)?;
                        invoked = true;
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err("YouTube está abierto, pero no pude confirmar la reproducción. Su página puede requerir una interacción o iniciar sesión.".into())
    }
}

#[cfg(windows)]
pub(crate) use platform::{spotify, youtube};
#[cfg(not(windows))]
pub(crate) fn spotify(_: MediaOperation, _: CancellationCheck) -> Result<String, String> {
    Err("La reproducción local requiere Windows".into())
}
#[cfg(not(windows))]
pub(crate) fn youtube(
    _: MediaOperation,
    _: Option<String>,
    _: Option<String>,
    _: CancellationCheck,
) -> Result<(String, Option<String>), String> {
    Err("La reproducción local requiere Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[cfg(windows)]
    fn revoked_sessions_do_not_open_or_control_apps() {
        let check: CancellationCheck = std::sync::Arc::new(|| Err("Sesión revocada".into()));
        assert!(spotify(MediaOperation::Play, check.clone())
            .unwrap_err()
            .contains("revocada"));
        assert!(youtube(MediaOperation::Open, None, None, check)
            .unwrap_err()
            .contains("revocada"));
    }
    #[test]
    fn browser_scope_requires_the_selected_youtube_video() {
        assert!(allowed_youtube_url(
            "https://www.youtube.com/watch?v=abc123_-XYZ",
            Some("abc123_-XYZ")
        ));
        assert!(!allowed_youtube_url(
            "https://www.youtube.com/watch?v=01234567890",
            Some("abc123_-XYZ")
        ));
        for url in [
            "https://www.youtube.com.evil.test/watch?v=abc123_-XYZ",
            "http://www.youtube.com/watch?v=abc123_-XYZ",
            "https://www.youtube.com/results?search_query=test",
            "https://other.test/watch?v=abc123_-XYZ",
        ] {
            assert!(!allowed_youtube_url(url, None), "{url}");
        }
    }
}
