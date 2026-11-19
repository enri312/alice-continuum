use crate::governance_model::{Payload, Permissions, Registry, View};
use crate::governance_workflows_ui::{procedures, skills};
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue};

#[derive(Clone)]
pub struct PageProps {
    pub initial: Payload,
    pub rx: Rc<RefCell<Option<UnboundedReceiver<Payload>>>>,
    pub on_action: js_sys::Function,
    pub on_ready: js_sys::Function,
}
impl PartialEq for PageProps {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

fn emit(callback: &js_sys::Function, value: Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&value.to_string()));
}

pub type Action = EventHandler<Value>;

pub fn page(props: PageProps) -> Element {
    let Payload::Configure { view, desktop } = props.initial else {
        return rsx! { p { role: "alert", "Gobernanza no disponible." } };
    };
    let mut registry = use_signal(Registry::default);
    let mut permissions = use_signal(Permissions::default);
    let mut procedures_view = use_signal(Default::default);
    let mut skills_view = use_signal(Default::default);
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let callback = callback.clone();
        async move {
            let mut connected = false;
            if let Some(mut receiver) = receiver {
                while let Some(message) = receiver.next().await {
                    match message {
                        Payload::Configure { .. } if !connected => {
                            connected = true;
                            emit(&callback, json!({"type":"connect"}));
                        }
                        Payload::Configure { .. } => {}
                        Payload::Registry(value) => registry.set(value),
                        Payload::Permissions(value) => permissions.set(value),
                        Payload::Procedures(value) => procedures_view.set(value),
                        Payload::Skills(value) => skills_view.set(value),
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let mut tab = use_signal(|| false);
    let selected = use_signal(String::new);
    let callback = props.on_action.clone();
    let action = use_callback(move |value| emit(&callback, value));
    match view {
        View::Registry => {
            let registry = registry.read();
            let permission = permissions.read();
            let show_permissions = tab();
            rsx! {
                section { class: "bridge-page", "aria-labelledby": "bridge-title",
                    div { class: "bridge-heading", h2 { id: "bridge-title", "Capacidades y permisos" } }
                    div { class: "governance-sections", role: "group", "aria-label": "Herramientas de capacidades y permisos",
                        for (show, panel, label, icon) in [
                            (false, "registry-panel", "Inventario de capacidades", &registry.registry_icon),
                            (true, "permissions-panel", "Permisos", &registry.permissions_icon),
                        ] {
                            button { key: "{panel}", r#type: "button", "aria-controls": panel, "aria-pressed": show_permissions == show,
                                onclick: move |_| {
                                    if tab() != show {
                                        tab.set(show);
                                        action.call(json!({"type":"section","id":if show { "permissions" } else { "registry" }}));
                                    }
                                },
                                if !icon.is_empty() { img { src: "{icon}", width: 34, height: 34, alt: "" } }
                                "{label}"
                            }
                        }
                    }
                    div { id: "permissions-panel", hidden: !show_permissions,
                        { permission_panel(&permission, show_permissions, action) }
                    }
                    div { id: "registry-panel", hidden: show_permissions, { registry_panel(&registry, selected, action) } }
                }
            }
        }
        View::Procedures => procedures(&procedures_view.read(), desktop, action),
        View::Skills => skills(&skills_view.read(), desktop, action),
    }
}

fn notice(code: &str, title: &str, detail: &str) -> Element {
    rsx! { div { class: "capability-registry-notice", span { "{code}" }
    div { strong { "{title}" } small { "{detail}" } } } }
}

fn registry_panel(view: &Registry, mut selected_id: Signal<String>, action: Action) -> Element {
    let id = selected_id.read();
    let active = view
        .groups
        .iter()
        .flat_map(|group| &group.capabilities)
        .find(|item| item.id == *id)
        .or_else(|| {
            view.groups
                .first()
                .and_then(|group| group.capabilities.first())
        });
    rsx! {
        div { class: "bridge-metrics", "aria-label": "Resumen del registro",
            for (label, count, detail) in &view.metrics { div { key: "{label}", span { "{label}" } strong { "{count}" } small { "{detail}" } } }
        }
        div { class: "bridge-layout",
            div { class: "bridge-workspace",
                div { class: "bridge-map-heading", span { "R1 · INVENTARIO POR DOMINIO" } small { "{view.source}" } }
                div { class: "bridge-route capability-registry-route",
                    if view.loading {
                        {notice("...", "CONSULTANDO EL REGISTRO LOCAL", "Las sondas son pasivas y no abren dispositivos ni escriben memoria.")}
                    } else if !view.error.is_empty() {
                        {notice("ERR", "REGISTRO NATIVO NO DISPONIBLE", &format!("No se pudo leer el inventario. {}", view.error))}
                    } else if view.groups.is_empty() {
                        {notice("WEB", "ENTORNO DE DESARROLLO", "Abre la aplicación de escritorio para consultar el registro nativo.")}
                    } else {
                        for group in &view.groups {
                            section { key: "{group.id}", class: "capability-domain", "aria-labelledby": "domain-{group.id}",
                                header { strong { id: "domain-{group.id}", "{group.label}" } span { "{group.capabilities.len()} capacidades" } }
                                div { class: "bridge-grid",
                                    for capability in &group.capabilities {
                                        {
                                            let id = capability.id.clone();
                                            let selected = active.is_some_and(|item| item.id == id);
                                            rsx! {
                                                button { key: "{id}", r#type: "button", "data-state": "{capability.state}",
                                                    class: if selected { "selected" }, "aria-pressed": selected,
                                                    onclick: move |_| selected_id.set(id.clone()),
                                                    span { class: "bridge-glyph", "aria-hidden": "true", "{capability.glyph}" }
                                                    span { strong { "{capability.label}" } small { "{capability.maturity} · {capability.state_label}" } }
                                                    i { "aria-hidden": "true" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            aside { class: "bridge-inspector", "aria-live": "polite",
                p { class: "eyebrow", "INSPECTOR DE CAPACIDAD" }
                if let Some(item) = active {
                    div { class: "bridge-inspector-code", "{item.glyph}" span { "{item.state_label}" } }
                    h3 { "{item.label}" } p { "{item.description}" }
                    dl { for (label, value) in &item.fields { div { key: "{label}", dt { "{label}" } dd { "{value}" } } } }
                    {button("Ver operaciones de esta capacidad", "audit", &item.id, "console-button", false, action)}
                    small { "{item.health}" br {} "{item.permission}" }
                } else {
                    {notice("000", "SIN CAPACIDAD SELECCIONABLE", "El inspector requiere una lectura del registro nativo.")}
                }
            }
        }
        {button("Ver el historial en Auditoría →", "audit", "", "console-button governance-audit-link", false, action)}
    }
}

pub fn button(
    label: &str,
    command: &str,
    id: &str,
    class: &str,
    disabled: bool,
    action: Action,
) -> Element {
    let value = json!({"type":command,"id":id});
    rsx! { button { r#type: "button", class: "{class}", disabled, onclick: move |_| action.call(value.clone()), "{label}" } }
}

fn permission_panel(view: &Permissions, visible: bool, action: Action) -> Element {
    let busy = !view.busy.is_empty();
    let disable = !view.commands || busy;
    let request_count = if view.has_snapshot {
        view.requests.len().to_string()
    } else {
        "—".into()
    };
    let grant_count = if view.has_snapshot {
        view.grants.len().to_string()
    } else {
        "—".into()
    };
    rsx! {
        section { class: "permission-gateway", "aria-labelledby": "permission-gateway-title",
            header {
                div { p { class: "eyebrow", "R2 · AUTORIZACIONES LOCALES" } h3 { id: "permission-gateway-title", "Control de permisos" }
                    p { "Revisá el recurso y el plazo antes de autorizar una operación. Podés revocar un permiso desde esta pantalla." } }
                span { class: if view.commands {"is-native"}, i {} if view.commands { "CONTROL LOCAL" } else { "SOLO LECTURA" } }
            }
            div { class: "permission-policy", "aria-label": "Política de permisos",
                for (label, value) in &view.policy { div { key: "{label}", span { "{label}" } strong { "{value}" } } }
            }
            div { class: "permission-actions",
                div { strong { "Observación de la ventana activa" } small { "Perfil R2 para metadatos de ventana · máximo 300 s" } }
                {button(if view.busy=="prepare-start" {"PREPARANDO…"} else {"PREPARAR OBSERVACIÓN"}, "prepare-start", "", "", disable, action)}
                {button(if view.busy=="prepare-stop" {"PREPARANDO…"} else {"PREPARAR DETENCIÓN"}, "prepare-stop", "", "", disable, action)}
            }
            div { class: "permission-status",
                span { if view.failed { "ERR" } else { "R2" } }
                div { strong { role: "status", "{view.status}" } if view.has_snapshot { small { "{view.detail}" } } }
            }
            div { class: "permission-ledger",
                section { "aria-labelledby": "permission-requests-title",
                    header { strong { id: "permission-requests-title", "SOLICITUDES" } span { "{request_count}" } }
                    if view.requests.is_empty() {
                        p { if view.has_snapshot { "SIN SOLICITUDES REALES" } else { "Sin lectura local" } }
                    }
                    for item in &view.requests {
                        article { key: "{item.id}", div { strong { "{item.capability}" } small { "{item.detail}" } }
                            if item.review { {button("REVISAR", "review", &item.id, "", disable, action)} } else { span { "{item.label}" } }
                        }
                    }
                }
                section { "aria-labelledby": "permission-grants-title",
                    header { strong { id: "permission-grants-title", "PERMISOS TEMPORALES" } span { "{grant_count}" } }
                    if view.grants.is_empty() {
                        p { if view.has_snapshot { "SIN PERMISOS TEMPORALES" } else { "Sin lectura local" } }
                    }
                    for item in &view.grants {
                        article { key: "{item.id}", div { strong { "{item.capability}" } small { "{item.detail}" } }
                            div { class: "permission-grant-actions",
                                if !item.execute.is_empty() { {button(&item.execute, "execute", &item.id, "", !view.execution || busy, action)} }
                                if !item.revoke || item.label == "GESTIONAR EN APRENDIZAJE" { span { "{item.label}" } }
                                if item.revoke { {button("REVOCAR", "revoke", &item.id, "", busy, action)} }
                            }
                        }
                    }
                }
            }
            if let Some(request) = view.pending.as_ref().filter(|_| visible) {
                {
                    let cancel = json!({"type":"cancel","id":request.id});
                    rsx! {
                        dialog { id: "alice-permission-dialog", key: "{request.id}", class: "permission-dialog",
                            "aria-labelledby": "permission-dialog-title", "aria-describedby": "permission-dialog-description",
                            onmounted: move |_| {
                                if let Some(dialog) = web_sys::window().and_then(|w| w.document())
                                    .and_then(|doc| doc.get_element_by_id("alice-permission-dialog"))
                                    .and_then(|element| element.dyn_into::<web_sys::HtmlDialogElement>().ok()) {
                                    let _ = dialog.show_modal();
                                }
                            },
                            onkeydown: move |event| {
                                if event.key() == Key::Escape {
                                    event.prevent_default();
                                    if !busy { action.call(cancel.clone()); }
                                }
                            },
                            div {
                                header { span { "[R2] CONFIRMACIÓN EXPLÍCITA" } strong { "NO EJECUTADO" } }
                                h3 { id: "permission-dialog-title", "¿Autorizar esta solicitud?" }
                                p { id: "permission-dialog-description", "{request.summary}" }
                                dl { for (label, value) in &request.fields {
                                    div { key: "{label}", dt { "{label}" }
                                        dd { title: if label == "Huella de verificación" { Some(request.digest.as_str()) } else { None }, "{value}" } }
                                } }
                                if !request.warnings.is_empty() {
                                    div { class: "permission-warnings", strong { "ADVERTENCIAS" }
                                        for warning in &request.warnings { p { "{warning}" } }
                                    }
                                }
                                p { class: "permission-dialog-note", "Aprobar concede un permiso temporal. La ejecución requiere una acción posterior y un permiso vigente." }
                                footer {
                                    {button("CANCELAR", "cancel", &request.id, "", busy, action)}
                                    {
                                        let deny = json!({"type":"deny","id":request.id});
                                        rsx! { button { r#type: "button", class: "is-deny", autofocus: true, disabled: busy,
                                            onclick: move |_| action.call(deny.clone()), "RECHAZAR" } }
                                    }
                                    {button("APROBAR PERMISO", "approve", &request.id, "is-approve", disable, action)}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
