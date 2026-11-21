use dioxus::prelude::*;

const DEVICES: [(&str, &str, &str); 5] = [
    ("HUB", "Sensor hub", "No configurado"),
    ("IMU", "IMU array", "0 dispositivos"),
    ("DRV", "Tracker driver", "No instalado"),
    ("POS", "Tracker poses", "0 activas"),
    ("PKT", "Packet stream", "Sin transporte"),
];
const METRICS: [(&str, &str); 15] = [
    ("IK ITER", "—"),
    ("CONSTRAINT ERR", "—"),
    ("PREDICTION", "—"),
    ("FOOT SLIP", "—"),
    ("CENTER OF MASS", "SIN DATOS"),
    ("BOUNCE PHASE", "—"),
    ("LOAD L / R", "— / —"),
    ("GROUND REACTION", "—"),
    ("PELVIS VERTICAL", "—"),
    ("ANG. MOMENTUM", "—"),
    ("KINETIC ENERGY", "—"),
    ("MUSCLE TORQUE", "—"),
    ("RAGDOLL ERROR", "—"),
    ("GYRO PEAK", "—"),
    ("RECOVERY", "—"),
];

fn reference(output: bool) -> Element {
    let (description, gradient, glow, top_color, bottom_color, opacity) = if output {
        (
            "Silueta corporal de referencia sin movimiento",
            "body-output-gradient",
            "body-output-glow",
            "#ccfbf1",
            "#0f766e",
            ".72",
        )
    } else {
        (
            "Esqueleto humanoide de referencia sin datos de sensores",
            "body-input-gradient",
            "body-input-glow",
            "#94a3b8",
            "#164e63",
            ".35",
        )
    };
    let joints = [
        (150, 68, 4),
        (150, 109, 4),
        (150, 159, 5),
        (102, 112, 4),
        (66, 155, 4),
        (198, 112, 4),
        (234, 155, 4),
        (122, 207, 4),
        (114, 261, 4),
        (178, 207, 4),
        (186, 261, 4),
    ];
    rsx! {
        svg { view_box: "0 0 300 300", role: "img", "aria-label": description,
            defs {
                linearGradient { id: gradient, x1: "0", y1: "0", x2: "1", y2: "1",
                    stop { stop_color: top_color, stop_opacity: opacity }
                    stop { offset: "1", stop_color: bottom_color, stop_opacity: ".2" }
                }
                filter { id: glow, x: "-40%", y: "-40%", width: "180%", height: "180%",
                    feGaussianBlur { std_deviation: "2", result: "blur" }
                    feMerge { feMergeNode { _in: "blur" } feMergeNode { _in: "SourceGraphic" } }
                }
            }
            g { class: "body-reference-grid", path { d: "M20 260h260M35 240h230M55 220h190" } path { d: "M150 22v248M48 260l102-55 102 55" } }
            if output {
                g { class: "body-output-mesh", fill: "url(#body-output-gradient)", stroke: "#5eead4", filter: "url(#body-output-glow)",
                    circle { cx: "150", cy: "49", r: "21" }
                    path { d: "M126 76 105 143l24 28 3 88h23l7-85 7 85h23l-4-88 24-28-38-67Z" }
                    path { d: "m126 80-32 22-36 49 16 10 43-44 19-21m38-16 32 22 36 49-16 10-43-44-19-21" }
                }
            } else {
                g { class: "body-input-rig", fill: "none", stroke_linecap: "round", stroke_linejoin: "round", filter: "url(#body-input-glow)",
                    circle { cx: "150", cy: "48", r: "19" }
                    path { d: "M150 68v91m0-74-48 27-36 43m84-70 48 27 36 43m-84 4-28 48-8 54m36-102 28 48 8 54" }
                    path { d: "m125 99 25 10 25-10m-53 108 28 8 28-8" }
                    g { class: "body-input-joints", for (x,y,radius) in joints { circle { key: "{x}:{y}", cx: "{x}", cy: "{y}", r: "{radius}" } } }
                }
            }
            g { class: "body-axis", path { d: "M31 268h35" } path { d: "M31 268v-35" } path { d: "M31 268l-16 13" } }
        }
    }
}

pub fn body_page() -> Element {
    let summary = [
        ("PRESET", "NINGUNO"),
        ("TRACKERS", "0 / 0"),
        ("SOLVER", "OFF"),
        ("INPUT RATE", "0 HZ"),
        ("OUTPUT", "BLOCKED"),
    ];
    let device_metrics = [
        ("Parsed nodes", "0 / 0"),
        ("Transport latency", "—"),
        ("Packet loss", "—"),
        ("Signal RSSI", "—"),
        ("MCU temperature", "—"),
    ];
    rsx! {
        section { class: "bridge-page", "aria-label": "Solucionador corporal de Nyxia",
            div { class: "body-diagnostic",
                header { class: "body-diagnostic-header",
                    div { span { "[05/BODY]" } strong { "FACE + BODY OUTPUT BRIDGE // BODY CHANNEL" } }
                    p { i {} "PIPELINE DESCONECTADO" }
                }
                dl { class: "body-summary", for (label, value) in summary { div { key: "{label}", dt { "{label}" } dd { "{value}" } } } }
                div { class: "body-toolbar", "aria-label": "Etapas reservadas del solver corporal",
                    for stage in ["RAW","ONE EURO","FABRIK + 2-BONE","SOLVER","SPRING","RETARGET"] {
                        button { key: "{stage}", r#type: "button", disabled: true, "{stage}" }
                    }
                    span { "SCENARIO · NONE" } span { "INTENT · UNMODELED" }
                }
                div { class: "body-solver-layout",
                    section { class: "body-device-panel", "aria-labelledby": "body-devices-title",
                        div { class: "body-panel-title", span { id: "body-devices-title", "[00] TRACKER DEVICE ARRAY" } small { "REAL DEVICE / REQUIRED" } }
                        div { class: "body-device-root", span { "ALICE_SENSOR_HUB" } small { "SIN TRANSPORTE" } }
                        div { class: "body-device-tree", for (code,label,detail) in DEVICES {
                            div { key: "{code}", i { "{code}" } span { strong { "{label}" } small { "{detail}" } } em {} }
                        } }
                        dl { class: "body-device-metrics", for (label,value) in device_metrics { div { key: "{label}", dt { "{label}" } dd { "{value}" } } } }
                    }
                    section { class: "body-viewport input", "aria-labelledby": "body-input-title",
                        div { class: "body-panel-title", span { id: "body-input-title", "[01] GENERIC MOCAP INPUT" } small { "SOURCE · NONE" } }
                        div { class: "body-canvas", p { "GENERIC PARAMETRIC HUMAN" br {} "NO CAMERA / NO BIOMETRICS" } {reference(false)} strong { "SKELETON INPUT · WAITING" } }
                    }
                    section { class: "body-solver-panel", "aria-labelledby": "body-solver-title",
                        div { class: "body-panel-title", span { id: "body-solver-title", "[02] SENSOR FUSION / IK SOLVER" } small { "0 HZ FIXED STEP" } }
                        div { class: "body-solver-stages",
                            for stage in ["RAW","FILTER","IK","SPRING","RETARGET"] { span { key: "{stage}", "{stage}" } } }
                        dl { for (label,value) in METRICS { div { key: "{label}", dt { "{label}" } dd { "{value}" } } } }
                    }
                    section { class: "body-viewport output", "aria-labelledby": "body-output-title",
                        div { class: "body-panel-title", span { id: "body-output-title", "[03] ALICE BODY OUTPUT" } small { "RETARGET · INACTIVE" } }
                        div { class: "body-canvas", p { "PRIVATE VRM HUMANOID" br {} "RIG DATA NOT CONNECTED" } {reference(true)} strong { "FOOT LOCK · —   COM · —" } }
                    }
                }
                section { class: "body-event-stream", "aria-labelledby": "body-events-title",
                    div { class: "body-panel-title", span { id: "body-events-title", "[04] MOTION EVENT STREAM" } small { "0 LOCAL RECORDS" } }
                    div { span { "SEQ" } span { "LEVEL" } span { "MODE" } span { "FRAME" } span { "PAYLOAD" } }
                    p { strong { "000" } "SIN EVENTOS CORPORALES · ninguna cámara, IMU o pose está siendo procesada" }
                }
                div { class: "console-prompt", strong { "ALICE_BODY@LOCAL_PROCESS:~$" } span { "sin sensores · sin solver · sin retarget · salida bloqueada" } }
            }
        }
    }
}
