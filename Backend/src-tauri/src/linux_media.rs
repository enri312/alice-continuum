//! WebKitGTK denies unhandled media requests. Bridge only Alice's local view;
//! a voice session is already an explicit opt-in. Other captures require a
//! native decision, and display/unrelated permissions keep their default denial.
use crate::voice_session::VoiceSessionStore;
use gtk::prelude::*;
use webkit2gtk::glib::{translate::ToGlibPtr, Cast};
use webkit2gtk::{PermissionRequestExt, SettingsExt, UserMediaPermissionRequestExt, WebViewExt};

#[derive(Debug, PartialEq, Eq)]
enum Decision {
    Allow,
    Ask,
    Deny,
}

fn local_origin(uri: &str, development: bool) -> bool {
    let Ok(url) = tauri::Url::parse(uri) else {
        return false;
    };
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    (url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none())
        || (development
            && url.scheme() == "http"
            && matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
            && url.port() == Some(5173))
}

fn decide(trusted: bool, audio: bool, video: bool, display: bool, session: bool) -> Decision {
    if !trusted || display || (!audio && !video) {
        Decision::Deny
    } else if audio && !video && session {
        Decision::Allow
    } else {
        Decision::Ask
    }
}

pub(crate) fn configure(
    window: &tauri::WebviewWindow,
    session: VoiceSessionStore,
) -> tauri::Result<()> {
    window.with_webview(move |platform| install(&platform.inner(), session))
}

fn install(view: &webkit2gtk::WebView, session: VoiceSessionStore) {
    if let Some(settings) = WebViewExt::settings(view) {
        settings.set_enable_media_stream(true);
        settings.set_enable_webrtc(true);
    }
    view.connect_permission_request(move |view, request| {
        let Some(media) = request.downcast_ref::<webkit2gtk::UserMediaPermissionRequest>() else {
            return false;
        };
        // Safe downcast above guarantees the pointer is a live media request.
        // The Rust wrapper lacks this method; the C API is available since 2.34.
        let display = unsafe {
            webkit2gtk::ffi::webkit_user_media_permission_is_for_display_device(
                media.to_glib_none().0,
            ) != 0
        };
        let audio = media.is_for_audio_device();
        let video = media.is_for_video_device();
        let trusted = view
            .uri()
            .is_some_and(|uri| local_origin(&uri, cfg!(debug_assertions)));
        let allowed = match decide(trusted, audio, video, display, session.is_active()) {
            Decision::Allow => true,
            Decision::Deny => false,
            Decision::Ask => {
                let device = match (audio, video) {
                    (true, true) => "el micrófono y la cámara",
                    (_, true) => "la cámara",
                    _ => "el micrófono",
                };
                let parent = view
                    .toplevel()
                    .and_then(|widget| widget.downcast::<gtk::Window>().ok());
                let dialog = gtk::MessageDialog::new(
                    parent.as_ref(),
                    gtk::DialogFlags::MODAL,
                    gtk::MessageType::Question,
                    gtk::ButtonsType::None,
                    &format!("¿Permitir que Alice use {device} para esta captura?"),
                );
                dialog.set_title("Alice · Permiso de captura");
                dialog.add_button("Cancelar", gtk::ResponseType::Cancel);
                dialog.add_button("Permitir", gtk::ResponseType::Accept);
                dialog.set_default_response(gtk::ResponseType::Cancel);
                let accepted = dialog.run() == gtk::ResponseType::Accept;
                dialog.close();
                // The dialog runs a nested event loop; recheck the origin.
                accepted
                    && view
                        .uri()
                        .is_some_and(|uri| local_origin(&uri, cfg!(debug_assertions)))
            }
        };
        if allowed {
            request.allow();
        } else {
            request.deny();
        }
        true
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_local_alice_origin_can_request_media() {
        assert!(local_origin("tauri://localhost/index.html", false));
        for uri in ["http://127.0.0.1:5173/", "http://localhost:5173/"] {
            assert!(local_origin(uri, true));
            assert!(!local_origin(uri, false));
        }
        for uri in [
            "https://example.com",
            "http://localhost:5174/",
            "http://localhost.evil:5173/",
            "http://user@localhost:5173/",
            "tauri://example.com/",
            "file:///tmp/page.html",
            "about:blank",
        ] {
            assert!(!local_origin(uri, true), "{uri}");
        }
    }

    #[test]
    fn voice_session_never_grants_camera_display_or_remote_capture() {
        assert_eq!(decide(true, true, false, false, true), Decision::Allow);
        assert_eq!(decide(true, true, false, false, false), Decision::Ask);
        assert_eq!(decide(true, false, true, false, true), Decision::Ask);
        assert_eq!(decide(true, true, true, false, true), Decision::Ask);
        assert_eq!(decide(true, true, true, true, true), Decision::Deny);
        assert_eq!(decide(false, true, false, false, true), Decision::Deny);
        assert_eq!(decide(true, false, false, false, true), Decision::Deny);
    }

    #[test]
    #[ignore = "WebKitGTK and display required; uses synthetic mock devices, never physical hardware"]
    fn live_webkit_mock_capture_and_denial() {
        use std::{cell::RefCell, rc::Rc};
        use webkit2gtk::glib;

        gtk::init().unwrap();
        for (hook, uri, expected) in [
            (false, "http://127.0.0.1:5173/", "ERROR:NotAllowedError"),
            (true, "http://127.0.0.1:5173/", "CAPTURE_OK"),
            (true, "http://127.0.0.1:5174/", "ERROR:NotAllowedError"),
        ] {
            let view = webkit2gtk::WebView::new();
            let settings = WebViewExt::settings(&view).unwrap();
            settings.set_enable_media_stream(true);
            settings.set_enable_mock_capture_devices(true);
            let session = VoiceSessionStore::default();
            session.begin().unwrap();
            if hook {
                install(&view, session);
            }
            let window = gtk::Window::new(gtk::WindowType::Toplevel);
            window.add(&view);
            window.show_all();
            let main_loop = glib::MainLoop::new(None, false);
            let result = Rc::new(RefCell::new(None));
            let received = result.clone();
            let finished = main_loop.clone();
            view.connect_title_notify(move |view| {
                if let Some(title) = view.title() {
                    if title.starts_with("CAPTURE_") || title.starts_with("ERROR:") {
                        *received.borrow_mut() = Some(title.to_string());
                        finished.quit();
                    }
                }
            });
            let deadline = main_loop.clone();
            let timeout = glib::timeout_add_seconds_local(20, move || {
                deadline.quit();
                glib::ControlFlow::Continue
            });
            view.load_html(r#"<!doctype html><title>Preparing</title><script>
              (async () => {
                let stream;
                try {
                  stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
                  const recorder = new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'});
                  let bytes = 0;
                  recorder.ondataavailable = e => bytes += e.data.size;
                  recorder.onstop = () => {
                    stream.getTracks().forEach(t => t.stop());
                    document.title = bytes > 0 && stream.getTracks().every(t => t.readyState === 'ended')
                      ? 'CAPTURE_OK' : 'CAPTURE_FAILED';
                  };
                  recorder.start(250);
                  setTimeout(() => recorder.stop(),1000);
                } catch(error) {
                  stream?.getTracks().forEach(t => t.stop());
                  document.title = 'ERROR:' + error.name;
                }
              })();
            </script>"#, Some(uri));
            main_loop.run();
            timeout.remove();
            window.close();
            assert_eq!(
                result.borrow().as_deref(),
                Some(expected),
                "hook={hook}, uri={uri}"
            );
            println!("WebKit mock capture: hook={hook}, {expected}");
        }
    }
}
