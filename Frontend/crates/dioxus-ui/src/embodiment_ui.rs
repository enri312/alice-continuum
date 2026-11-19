use crate::embodiment_body_ui::body_page;
use crate::embodiment_model::{Face, File, Payload, Permission, Telemetry, View, Viewer};
use crate::face_mesh::FACE_MESH;
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::JsValue;

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

#[derive(Default)]
struct FaceView {
    face: Option<Face>,
    error: String,
    busy: bool,
    permission_text: String,
    request: Option<Permission>,
    grant: Option<Permission>,
}

#[derive(Default)]
struct AvatarView {
    file: Option<File>,
    error: String,
    telemetry: Option<Telemetry>,
    clips: usize,
    posture: bool,
    motor: Option<bool>,
}

fn emit(callback: &js_sys::Function, action: Value) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&action.to_string()));
}

pub fn page(props: PageProps) -> Element {
    let Payload::Configure {
        view,
        desktop,
        scene_id,
    } = &props.initial
    else {
        return rsx! { p { role: "alert", "Vista de presencia física no disponible." } };
    };
    let mut face_view = use_signal(FaceView::default);
    let mut avatar = use_signal(AvatarView::default);
    let mut viewer = use_signal(Viewer::default);
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let callback = callback.clone();
        async move {
            let mut connected = false;
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    match payload {
                        Payload::Configure { .. } if !connected => {
                            connected = true;
                            emit(&callback, json!({"type":"connect"}));
                        }
                        Payload::Configure { .. } => {}
                        Payload::Face {
                            face,
                            error,
                            busy,
                            permission_text,
                            request,
                            grant,
                        } => face_view.set(FaceView {
                            face,
                            error,
                            busy,
                            permission_text,
                            request,
                            grant,
                        }),
                        Payload::AvatarFile {
                            file,
                            clips,
                            posture,
                        } => {
                            let mut state = avatar.write();
                            state.file = Some(file);
                            state.clips = clips;
                            state.posture = posture;
                        }
                        Payload::AvatarError { error } => avatar.write().error = error,
                        Payload::AvatarTelemetry { telemetry } => {
                            avatar.write().telemetry = telemetry
                        }
                        Payload::Viewer { patch } => viewer.write().apply(patch),
                        Payload::Motor { ready } => avatar.write().motor = Some(ready),
                    }
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let callback = props.on_action.clone();
    let run = use_callback(move |value| emit(&callback, value));
    match view {
        View::Body => body_page(),
        View::Face => face_page(&face_view.read(), *desktop, run),
        View::Avatar => avatar_page(&avatar.read(), viewer, *desktop, scene_id, run),
    }
}

fn face_button(
    label: &str,
    command: &'static str,
    id: &str,
    busy: bool,
    run: EventHandler<Value>,
) -> Element {
    let input = json!({"type":command,"id":id});
    rsx! { button { r#type: "button", disabled: busy, onclick: move |_| run.call(input.clone()), "{label}" } }
}

fn face_page(view: &FaceView, desktop: bool, run: EventHandler<Value>) -> Element {
    let status = view.face.as_ref();
    let model = status.map(|item| &item.model);
    let verified = model.is_some_and(|item| item.state == "verified");
    let runtime = status.is_some_and(|item| item.runtime.available);
    let prepared = verified && runtime;
    let loading = desktop && status.is_none() && view.error.is_empty();
    let pending = view
        .request
        .as_ref()
        .filter(|request| request.state == "awaitingDecision");
    let active = view
        .grant
        .as_ref()
        .filter(|grant| matches!(grant.state.as_str(), "approved" | "active"));
    let permission = if pending.is_some() {
        "DECISIÓN PENDIENTE".into()
    } else if active.is_some() {
        "GRANT SIN EJECUTAR".into()
    } else {
        view.grant
            .as_ref()
            .or(view.request.as_ref())
            .map_or("NO SOLICITADA".into(), |item| item.state.to_uppercase())
    };
    let label = if loading {
        "CONSULTANDO"
    } else if !desktop {
        "SIN BACKEND"
    } else if prepared {
        "PREPARACIÓN LISTA"
    } else {
        "BLOQUEADO"
    };
    let model_detail = if loading {
        "Comprobando modelo local".into()
    } else if let Some(item) = model.filter(|_| verified) {
        format!(
            "SHA verificado · {:.2} MiB",
            item.size_bytes as f64 / 1_048_576.0
        )
    } else {
        model.map_or("Sin backend nativo".into(), |item| item.detail.clone())
    };
    let devices = [
        ("CAM", "Fuente de cámara", "No solicitada · R2 cerrado"),
        ("MDL", "Detector facial", model_detail.as_str()),
        (
            "PTS",
            "Landmarks",
            if verified {
                "478 por rostro · no leídos"
            } else {
                "Sin modelo verificado"
            },
        ),
        (
            "BLS",
            "Blendshapes",
            if verified {
                "52 canales · no leídos"
            } else {
                "Sin modelo verificado"
            },
        ),
        ("OUT", "Retarget facial", "Sin destino · R9 pendiente"),
    ];
    let metrics = [
        ("Capacidad", "Planificada"),
        ("Permiso R2", permission.as_str()),
        ("Modelo", if verified { "Verificado" } else { "No listo" }),
        ("Runtime", if runtime { "Disponible" } else { "No listo" }),
        ("Sensor abierto", "FALSE"),
        ("Landmarks leídos", "—"),
        ("Blendshapes leídos", "—"),
        ("Latencia", "—"),
        ("Retarget", "FALSE"),
    ];
    let permission_text = if !desktop {
        "Requiere backend nativo"
    } else if view.permission_text.is_empty() {
        "Consultando el estado R2…"
    } else {
        &view.permission_text
    };
    let detail = if view.error.is_empty() {
        status.map_or("Consulta pasiva pendiente.", |item| {
            item.runtime.detail.as_str()
        })
    } else {
        &view.error
    };
    let sha = model
        .and_then(|item| item.sha256.as_deref())
        .and_then(|item| item.get(..12));
    rsx! {
        section { class: "bridge-page", "aria-label": "Control facial de Alice",
            div { class: "face-diagnostic",
                header { class: "face-diagnostic-header",
                    div { span { "[05/FACE]" } strong { "FACE + BODY OUTPUT BRIDGE // FACIAL CHANNEL" } }
                    p { i {} "{label}" }
                }
                div { class: "face-diagnostic-layout",
                    section { class: "face-device-tree", "aria-labelledby": "face-devices-title",
                        div { class: "face-panel-title", span { id: "face-devices-title", "PREPARACIÓN LOCAL" } small { if prepared { "2 / 2" } else { "0 / 2" } } }
                        div { class: "face-tree-root", span { "ALICE_FACE_INPUT" } small { if prepared { "DIAGNÓSTICO PASIVO LISTO" } else { "PIPELINE CERRADO" } } }
                        div { class: "face-tree-list", for (code,label,detail) in devices {
                            div { key: "{code}", i { "{code}" } span { strong { "{label}" } small { "{detail}" } } em {} }
                        } }
                        div { class: "face-permission", strong { "FRONTERA R2" } span { "Derivación facial" } em { "{permission}" }
                            span { "Persistencia de video" } em { "DESACTIVADA" } }
                        div { class: "face-permission-gate", "aria-live": "polite",
                            span { "PERMISO FACIAL · CRITICAL · 60 S" } strong { "{permission_text}" }
                            if let Some(request) = pending {
                                div { {face_button("APROBAR","approve",&request.id,view.busy,run)}
                                    {face_button("DENEGAR","deny",&request.id,view.busy,run)}
                                    {face_button("CANCELAR","cancel",&request.id,view.busy,run)} }
                            } else if let Some(grant) = active { {face_button("DETENER / REVOCAR","revoke",&grant.id,view.busy,run)} }
                            else { {face_button("PREPARAR PERMISO","prepare","",!prepared || view.busy || !desktop,run)} }
                            small { "ACTIVACIÓN BLOQUEADA · APROBAR NO ABRE LA CÁMARA" }
                        }
                    }
                    section { class: "face-viewport", "aria-labelledby": "face-viewport-title",
                        div { class: "face-viewport-toolbar", span { id: "face-viewport-title", "REFERENCE MESH // NEUTRAL" } small { "NO ES TRACKING" } }
                        div { class: "face-canvas",
                            div { style: "display:contents", dangerous_inner_html: FACE_MESH }
                            i { class: "face-scan-line", "aria-hidden": "true" }
                            div { class: "face-no-input", span { "000" } strong { "SIN TRACKING FACIAL" }
                                small { if view.error.is_empty() { "Malla de referencia · la cámara no fue abierta" } else { "Diagnóstico nativo no disponible" } } }
                            for corner in ["top-left","top-right","bottom-left","bottom-right"] { span { key: "{corner}", class: "face-corner {corner}" } }
                        }
                    }
                    aside { class: "face-telemetry",
                        div { class: "face-panel-title", span { "ESTADO VERIFICABLE" } small { "LOCAL" } }
                        dl { for (label,value) in metrics { div { key: "{label}", dt { "{label}" } dd { "{value}" } } } }
                        div { class: "face-retarget-status", span { "RUNTIME LOCAL" }
                            strong { if !view.error.is_empty() { "ERROR DE CONSULTA" } else if runtime { "DEPENDENCIAS LISTAS" } else { "SIN CONFIRMACIÓN" } }
                            small { "{detail}" } }
                    }
                }
                section { class: "face-channel-console", "aria-labelledby": "face-channels-title",
                    div { class: "face-panel-title", span { id: "face-channels-title", "FACIAL CHANNELS" } small { "8 RESERVADOS · 0 ACTIVOS" } }
                    div { class: "face-channel-grid",
                        for (index,channel) in ["eyeBlinkLeft","eyeBlinkRight","jawOpen","mouthSmileLeft","mouthSmileRight","browInnerUp","gazeX","gazeY"].into_iter().enumerate() {
                            div { key: "{channel}", span { "{index+1:02}" } strong { "{channel}" } i { em {} } small { "—" } }
                        }
                    }
                }
                div { class: "console-prompt", strong { "ALICE_FACE@LOCAL_PROCESS:~$" }
                    span { if let Some(sha) = sha.filter(|_| verified) { "modelo {sha}… verificado · sensor cerrado" } else { "sin lectura facial · sin almacenamiento de video" } } }
            }
        }
    }
}

fn avatar_page(
    state: &AvatarView,
    viewer: Signal<Viewer>,
    desktop: bool,
    scene_id: &str,
    run: EventHandler<Value>,
) -> Element {
    let model = state.file.as_ref();
    let telemetry = state.telemetry.as_ref();
    let ready = telemetry.is_some();
    let motor = match state.motor {
        Some(true) => "Telemetría manual R3 · cognición desconectada",
        Some(false) => "Auditoría motora no disponible",
        None => "Prueba manual · esperando transición",
    };
    rsx! {
        section { class: "avatar-page", "aria-labelledby": "avatar-title",
            div { class: "avatar-heading",
                div { p { class: "eyebrow", "AVATAR LOCAL · VRM 1.0" } h2 { id: "avatar-title", "Cuerpo visible de Alice" }
                    p { "Esta pantalla inspecciona tu archivo local. Incluye control reversible con gamepad y un ensayo técnico local de diez segundos; todavía no recibe voz, cámara, emociones, Mocap ni órdenes cognitivas." } }
                div { class: if ready { "avatar-file-state ready" } else { "avatar-file-state" }, i {}
                    if ready { "MODELO CARGADO" } else if model.is_some_and(|item| item.available) { "ARCHIVO ENCONTRADO" } else { "SIN MODELO" } }
            }
            if !desktop {
                div { class: "avatar-unavailable", span { "DESKTOP ONLY" } strong { "El visor requiere la aplicación de escritorio" }
                    p { "El navegador no obtiene permiso para leer archivos privados del equipo." } }
            } else if !state.error.is_empty() {
                div { class: "avatar-unavailable error", span { "ERROR" } strong { "No se pudo comprobar el avatar" } p { "{state.error}" } }
            } else if let Some(model) = model {
                if model.available {
                    div { class: "avatar-layout",
                        div { class: "avatar-stage", AvatarViewer { viewer, posture: state.posture, scene_id: scene_id.to_string(), run } }
                        {avatar_inspector(model, telemetry, state.clips)}
                    }
                } else {
                    div { class: "avatar-unavailable", span { "VRM 000" } strong { "No se encontró Alice.vrm" }
                        p { "Colocá el archivo en " code { "{model.path}" } " y reiniciá la aplicación." } }
                }
            }
            div { class: "avatar-boundaries",
                article { span { "01" } strong { "Render local" } small { if ready { "Activo y comprobado" } else { "Esperando carga" } } }
                article { span { "02" } strong { "Expresión dirigida" } small { "Desconectada" } }
                article { span { "03" } strong { "Voz y labios" } small { "Desconectados" } }
                article { span { "04" } strong { "Cuerpo y Ragdoll" } small { "{motor}" } }
            }
            p { class: "avatar-footnote", "La entrada PS5 y el ensayo técnico controlan directamente el visor sólo después de activarlos. Cada cambio de estado guarda únicamente metadatos mínimos R3 con procedencia humana o diagnóstica. Terreno irregular, locomoción física, Active Ragdoll y el puente cognitivo continúan desconectados." }
        }
    }
}

fn avatar_inspector(file: &File, data: Option<&Telemetry>, clips: usize) -> Element {
    let name = data.map_or(file.file_name.as_str(), |value| value.name.as_str());
    let version = data.map_or("—", |value| value.meta_version.as_str());
    let size = if file.size_bytes == 0 {
        "—".into()
    } else {
        format!("{:.1} MB", file.size_bytes as f64 / 1_048_576.0)
    };
    let authors = data
        .map(|value| value.authors.join(", "))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Leyendo…".into());
    let copyright = data.map_or("Leyendo…", |value| value.copyright.as_str());
    let metrics = [
        ("Huesos humanoides", data.map(|value| value.bone_count)),
        (
            "Expresiones declaradas",
            data.map(|value| value.expression_count),
        ),
        ("Spring joints", data.map(|value| value.spring_joint_count)),
        ("Colliders", data.map(|value| value.collider_count)),
    ];
    let (credit, redistribution, modification) = data.map_or(("—", "—", "—"), |value| {
        (
            if value.credit_required {
                "requerido"
            } else {
                "no requerido"
            },
            if value.redistribution_allowed {
                "permitida"
            } else {
                "prohibida"
            },
            match value.modification.as_str() {
                "prohibited" => "Prohibida",
                "allowModification" => "Permitida",
                "allowModificationRedistribution" => "Permitida con redistribución",
                "no indicada" => "No indicada",
                other => other,
            },
        )
    });
    rsx! {
        aside { class: "avatar-inspector", p { class: "eyebrow", "INSPECTOR VRM" } h3 { "{name}" }
            span { class: "avatar-version", "VRM {version} · {size}" }
            dl {
                div { dt { "Autoría" } dd { "{authors}" } }
                div { dt { "Copyright" } dd { "{copyright}" } }
                for (label,value) in metrics { div { key: "{label}", dt { "{label}" } dd { if let Some(value) = value { "{value}" } else { "—" } } } }
                div { dt { "Clips corporales" } dd { "{clips} / 12" } }
            }
            div { class: "avatar-license", strong { "LICENCIA DEL ARCHIVO" } span { "Crédito: {credit}" }
                span { "Redistribución: {redistribution}" } span { "Modificación: {modification}" } }
            div { class: "avatar-expression-catalog", strong { "CATÁLOGO FACIAL DEL VRM · SOLO LECTURA" }
                if let Some(data) = data {
                    if data.expression_names.is_empty() { small { "El archivo cargado no declara expresiones VRM utilizables." } }
                    else { div { for name in &data.expression_names { code { key: "{name}", "{name}" } } } }
                } else { small { "Cargando el catálogo declarado por el archivo privado…" } }
            }
            code { class: "avatar-path", title: "{file.path}", "{file.path}" }
        }
    }
}

#[component]
fn AvatarViewer(
    viewer: Signal<Viewer>,
    posture: bool,
    scene_id: String,
    run: EventHandler<Value>,
) -> Element {
    let view = viewer.read();
    let ready = view.state == "ready";
    let (gamepad, diagnostic, rest) = (
        view.mode == "gamepad",
        view.mode == "diagnostic",
        view.pose == "idle",
    );
    let gamepad_class = if gamepad { "active" } else { "" };
    let diagnostic_class = if diagnostic { "active" } else { "" };
    let transition = matches!(
        view.body_state.as_str(),
        "starting-walk" | "jumping" | "sitting-down" | "standing-up"
    );
    let label = match view.state.as_str() {
        "ready" => "VRM LISTO",
        "error" => "ERROR DE VISOR",
        _ => "CARGANDO VRM LOCAL",
    };
    let body = match view.body_state.as_str() {
        "standing-idle" => "REPOSO DE PIE",
        "starting-walk" => "ARRANQUE",
        "locomoting" => "LOCOMOCIÓN",
        "jumping" => "SALTO",
        "sitting-down" => "SENTÁNDOSE",
        "sitting-idle" => "SENTADA",
        "standing-up" => "LEVANTÁNDOSE",
        other => other,
    };
    let help = if gamepad {
        "PS5 · STICK IZQ MOVER · STICK DER GIRAR · X SALTAR · DETENER RESTABLECE"
    } else if diagnostic {
        "ENSAYO · ARRANQUE · MARCHA · CARRERA · RETROCESO · LATERAL · GIRO · REPOSO"
    } else if rest {
        "POSTURA · REPOSO ANIMADO   ARRASTRAR · GIRAR   RUEDA · ZOOM   CLIC DERECHO · MOVER"
    } else {
        "POSTURA · REFERENCIA DEL RIG   ARRASTRAR · GIRAR   RUEDA · ZOOM   CLIC DERECHO · MOVER"
    };
    let control = &view.control;
    let input = &control.input;
    let motion = &view.motion;
    let animation = motion.animation.to_uppercase();
    let jump = if input.jump { "SALTO" } else { "—" };
    let foot = match motion.locked_foot.as_deref() {
        Some("left") => "IZQ",
        Some("right") => "DER",
        _ => "LIBRE",
    };
    let ik = if motion.ik_applied { "ACTIVO" } else { "LIBRE" };
    rsx! {
        div { class: "avatar-viewer-shell",
            div { class: "avatar-control-dock",
                div { class: "avatar-viewer-state state-{view.state}", "aria-live": "polite", i {} "{label}" }
                if ready {
                    div { class: "avatar-viewer-actions", role: "group", "aria-label": "Controles corporales de Alice",
                        button { class: "avatar-gamepad {gamepad_class}", r#type: "button", "aria-pressed": "{gamepad}", onclick: move |_| run.call(json!({"type":"gamepad"})),
                            if gamepad { "Detener control PS5" } else { "Probar control PS5" } }
                        button { class: "avatar-gait-test {diagnostic_class}", r#type: "button", "aria-pressed": "{diagnostic}", onclick: move |_| run.call(json!({"type":"diagnostic"})),
                            if diagnostic { "Detener ensayo" } else { "Ensayar marcha" } }
                        button { class: "avatar-posture", r#type: "button", disabled: !rest || transition || !posture, onclick: move |_| run.call(json!({"type":"posture"})),
                            if view.body_state == "sitting-idle" { "Levantar a Alice" } else { "Sentar a Alice" } }
                        button { class: "avatar-pose", r#type: "button", disabled: view.mode != "off" || view.body_state != "standing-idle",
                            onclick: move |_| run.call(json!({"type":"pose"})), if rest { "Ver pose de referencia" } else { "Volver a postura de reposo" } }
                    }
                    div { class: "avatar-camera-actions", role: "group", "aria-label": "Controles de cámara",
                        button { class: "avatar-reset", r#type: "button", onclick: move |_| run.call(json!({"type":"reset"})), "Restablecer cámara" } }
                }
            }
            div { class: "avatar-viewer-viewport",
                div { id: scene_id, class: "avatar-viewer", onmounted: move |_| run.call(json!({"type":"attach"})) }
                if view.mode != "off" {
                    div { class: "avatar-gamepad-status {control.state}", "aria-live": "polite",
                        strong { if diagnostic { "ENSAYO PROCEDURAL · CONTROL TÉCNICO" }
                            else if control.state == "connected" { "DUALSENSE · CONTROL HUMANO" } else { "ESPERANDO ENTRADA GAMEPAD" } }
                        span { if control.state == "connected" { "{control.device}" } else { "Presioná un botón o mové un stick para que WebView active el mando." } }
                        code { "LX {input.move_x:.2} · LY {input.move_z:.2} · RX {input.turn:.2} · X {jump} · L2 {input.left_trigger:.2} · R2 {input.right_trigger:.2}" }
                        code { class: "avatar-body-motion", "ESTADO {body} · ANIM {animation} · {motion.speed:.2} M/S · PIE {foot} · LOCK {motion.foot_offset * 100.0:.1} CM · SUELO {motion.ground_correction * 100.0:.1} CM" }
                        code { class: "avatar-body-motion", "IK APOYO · {ik} · ERROR {motion.ik_residual * 100.0:.1} CM" }
                    }
                }
                if view.state == "error" { div { class: "avatar-viewer-error", strong { "No se pudo mostrar Alice" } span { "{view.error}" } } }
                p { class: "avatar-viewer-help", "FSM · {body}   {help}" }
            }
        }
    }
}
