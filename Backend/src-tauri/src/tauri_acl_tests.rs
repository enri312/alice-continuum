use tauri::ipc::Origin;

#[test]
fn main_window_can_subscribe_and_unsubscribe_to_memory_events() {
    let mut context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let window = context.config().app.windows[0].label.clone();
    assert_eq!(window, "main");
    let authority = context.runtime_authority_mut();

    for command in ["plugin:event|listen", "plugin:event|unlisten"] {
        assert!(
            authority
                .resolve_access(command, &window, &window, &Origin::Local)
                .is_some(),
            "{command} must be allowed for the local memory panels"
        );
    }
}

#[test]
fn event_access_excludes_other_windows_remote_pages_and_frontend_emission() {
    let mut context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let authority = context.runtime_authority_mut();
    let remote = Origin::Remote {
        url: "https://example.com".parse().unwrap(),
    };

    for command in ["plugin:event|listen", "plugin:event|unlisten"] {
        assert!(authority
            .resolve_access(command, "other", "other", &Origin::Local)
            .is_none());
        assert!(authority
            .resolve_access(command, "main", "main", &remote)
            .is_none());
    }
    for command in ["plugin:event|emit", "plugin:event|emit_to"] {
        assert!(authority
            .resolve_access(command, "main", "main", &Origin::Local)
            .is_none());
    }
}
