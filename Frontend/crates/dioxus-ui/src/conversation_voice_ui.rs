use dioxus::prelude::*;
use serde_json::{json, Value};

fn text<'a>(view: &'a Value, field: &str) -> &'a str {
    view[field].as_str().unwrap_or_default()
}
fn truth(view: &Value, field: &str) -> bool {
    view[field].as_bool().unwrap_or(false)
}
fn rows<'a>(view: &'a Value, field: &str) -> &'a [Value] {
    view[field].as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn seconds(value: &Value) -> String {
    value
        .as_f64()
        .map_or_else(|| "—".into(), |ms| format!("{:.1} s", ms / 1000.0))
}

#[component]
fn TurnObservation(turn: Value, can_review: bool, on_action: EventHandler<Value>) -> Element {
    let heading = match text(&turn, "outcome") {
        "textOnly" => "respuesta en texto".to_owned(),
        "error" => "interrumpido".to_owned(),
        _ if turn["untilPlaybackMs"].is_null() => "en proceso".to_owned(),
        _ => format!("{} hasta iniciar la voz", seconds(&turn["untilPlaybackMs"])),
    };
    let transcript = text(&turn, "transcript");
    let model = text(&turn, "transcriptionModel");
    let timings = [
        ("Toma de audio", "captureMs"),
        ("Transcripción", "transcriptionMs"),
        ("Respuesta", "responseMs"),
        ("Preparación de voz", "synthesisMs"),
    ];
    rsx! {
        details { class: "voice-session-observation",
            summary { "Último mensaje atendido · {heading}" }
            p { strong { "Alice entendió:" } " {transcript}" }
            if !transcript.is_empty() {
                button { r#type: "button", class: "secondary", disabled: !can_review,
                    onclick: move |_| on_action.call(json!({"type":"reviewTranscript","value":"attended"})),
                    "Corregir en el borrador" }
            }
            p { strong { "Modelo de transcripción:" } " {model}" }
            dl {
                for (label, field) in timings {
                    div { key: "{field}", dt { "{label}" } dd { {seconds(&turn[field])} } }
                }
            }
            p { "Los tiempos de procesamiento se miden desde que termina la grabación. La toma de audio se muestra por separado e incluye la pausa de cierre. Este detalle se conserva sólo en esta pantalla." }
        }
    }
}

#[component]
fn IgnoredObservation(take: Value, can_review: bool, on_action: EventHandler<Value>) -> Element {
    let reason = text(&take, "reason");
    let explanation = match reason {
        "insufficientSpeech" => "El detector no reconoció voz suficiente. La toma se descartó antes de transcribirla.",
        "noSpeech" => "El transcriptor no devolvió palabras. La toma no generó una respuesta.",
        _ => "La transcripción no se reconoció como una frase dirigida a Alice y no generó una respuesta.",
    };
    let transcript = text(&take, "transcript");
    let model = text(&take, "transcriptionModel");
    rsx! {
        div { class: "voice-session-observation",
            p { strong { "Resultado de entrada no atendido:" } " {explanation}" }
            if reason != "insufficientSpeech" {
                if !transcript.is_empty() { p { strong { "Transcripción descartada:" } " {transcript}" } }
                if reason == "notAddressed" && !transcript.is_empty() {
                    button { r#type: "button", class: "secondary", disabled: !can_review,
                        onclick: move |_| on_action.call(json!({"type":"reviewTranscript","value":"ignored"})),
                        "Corregir en el borrador" }
                }
                p { strong { "Modelo de transcripción:" } " {model}" }
                dl {
                    div { dt { "Toma de audio" } dd { {seconds(&take["captureMs"])} } }
                    div { dt { "Transcripción" } dd { {seconds(&take["transcriptionMs"])} } }
                }
            }
            p { "El resultado transcrito queda en este diagnóstico hasta la siguiente transcripción, una frase atendida o el apagado del micrófono." }
        }
    }
}

#[component]
fn Settings(view: Value, can_review: bool, on_action: EventHandler<Value>) -> Element {
    let disabled = !truth(&view, "desktopApp")
        || truth(&view, "active")
        || truth(&view, "busy")
        || truth(&view, "disabled")
        || !view["pending"].is_null();
    let device = text(&view, "device");
    let sensitivity = text(&view, "sensitivity");
    let devices = rows(&view, "devices");
    let device_message = text(&view, "deviceMessage");
    let noise = &view["noise"];
    let microphone = text(noise, "microphone");
    let echo = if truth(noise, "systemEcho") {
        "El equipo confirmó cancelación del sonido del sistema."
    } else {
        "El equipo no confirmó cancelación de toda la música del sistema."
    };
    rsx! {
        details { class: "audio-input-settings",
            summary { "Audio de entrada · reducción de ruido local" }
            p { "Alice filtra el ruido antes de transcribir y busca presencia de voz para cerrar cada turno. No necesita otro modelo de conversación." }
            div { class: "audio-input-devices",
                label { "Micrófono"
                    select { value: "{device}", disabled,
                        onchange: move |event| on_action.call(json!({"type":"device","value":event.value()})),
                        option { value: "", selected: device.is_empty(), "Predeterminado del sistema" }
                        for item in devices {
                            option { key: "{text(item, \"id\")}", value: "{text(item, \"id\")}", selected: text(item,"id") == device, "{text(item,\"label\")}" }
                        }
                    }
                }
                label { "Sensibilidad"
                    select { value: "{sensitivity}", disabled,
                        onchange: move |event| on_action.call(json!({"type":"sensitivity","value":event.value()})),
                        option { value: "normal", selected: sensitivity == "normal", "Normal" }
                        option { value: "soft", selected: sensitivity == "soft", "Voz baja y pausada" }
                    }
                }
                button { r#type: "button", class: "secondary", disabled,
                    onclick: move |_| on_action.call(json!({"type":"refreshDevices"})), "Actualizar micrófonos" }
            }
            if truth(&view, "spotifyDuckingAvailable") {
                label {
                    input { r#type: "checkbox", checked: truth(&view, "duckSpotify"), disabled,
                        onchange: move |event| on_action.call(json!({"type":"duckSpotify","value":event.checked()})) }
                    " Bajar el volumen de Spotify durante la escucha"
                }
            }
            p { "Voz baja y pausada aumenta la ganancia local y conserva la salida del filtro sin una segunda atenuación. En la escucha automática espera 2 segundos de silencio para cerrar el turno. Normal espera 1 segundo y mantiene la atenuación adicional. Si el ruido abre tomas o la voz satura, usa Normal." }
            if !device_message.is_empty() { p { role: "status", "{device_message}" } }
            if !noise.is_null() {
                p { "Última toma preparada con filtro: {microphone}. "
                    if !text(noise,"sensitivity").is_empty() {
                        "Sensibilidad: "
                        if text(noise, "sensitivity") == "soft" { "Voz baja y pausada. " } else { "Normal. " }
                    }
                    "{echo}"
                }
            }
            if !view["ignored"].is_null() { IgnoredObservation { take: view["ignored"].clone(), can_review, on_action } }
            p { "El filtro reduce ruido, pero no reconoce quién habla ni garantiza separar voces cantadas o de otras personas. La escucha automática atiende frases dirigidas a Alice. «Detén la conversación, Alice» vuelve a la escucha y «Apaga el micrófono, Alice» termina la sesión." }
        }
    }
}

#[component]
fn SignalMeasurement(signal: Value) -> Element {
    let sample_rate = 48000.0;
    let number = |key: &str| signal[key].as_f64().unwrap_or_default();
    let input_samples = number("inputSamples");
    let output_samples = number("outputSamples");
    if input_samples <= 0.0 && output_samples <= 0.0 {
        return rsx! { p { "Medición de señal: no disponible para esta toma." } };
    }
    let input = if input_samples > 0.0 {
        format!(
            "Ganancia {}× · RMS {:.5} · pico {:.5}",
            number("inputGain"),
            number("inputRms"),
            number("inputPeak")
        )
    } else {
        "Sin muestras de entrada".to_owned()
    };
    let clipping = if input_samples > 0.0 {
        format!(
            "{:.2}% · {} de {input_samples} muestras",
            number("inputClippedFraction") * 100.0,
            number("inputClippedSamples")
        )
    } else {
        "Desconocido: no hay muestras de entrada".to_owned()
    };
    let duration = format!(
        "{input_samples} muestras · {:.3} s",
        input_samples / sample_rate
    );
    let output = if output_samples > 0.0 {
        format!(
            "RMS {:.5} · pico {:.5} · {output_samples} muestras · {:.3} s",
            number("outputRms"),
            number("outputPeak"),
            output_samples / sample_rate
        )
    } else {
        "Sin muestras de salida".to_owned()
    };
    rsx! {
        section { class: "voice-input-signal", aria_label: "Medición de la señal de audio",
            p { strong { "Acumulado hasta el último lote recibido · cobertura parcial de la toma" } }
            dl {
                div { dt { "Entrada antes de RNNoise · ganancia incluida" } dd { "{input}" } }
                div { dt { "Recorte de entrada" } dd { "{clipping}" } }
                div { dt { "Entrada medida" } dd { "{duration}" } }
                div { dt { "Salida filtrada real" } dd { "{output}" } }
            }
            p { "48 kHz. Estos valores son acumulados hasta el último lote recibido. No evalúan si se entiende la voz ni representan necesariamente toda la grabación." }
        }
    }
}

#[component]
fn ManualMeasurements(view: Value) -> Element {
    let observation = match text(&view, "captureState") {
        "review" => "REVISAR",
        "recorded" => "LISTA",
        "idle" => "SIN HABLA",
        _ => "EN CURSO",
    };
    let model = view["model"].as_str().unwrap_or("—");
    let recorded = view["recorded"]
        .as_f64()
        .map_or_else(|| "—".into(), |s| format!("{s:.1} s"));
    rsx! {
        details { class: "voice-turn-measurements", summary { "Datos del turno" }
            div { class: "voice-turn-observation", aria_label: "Observación del último turno",
                span { strong { "{recorded}" } "toma efímera" }
                span { strong { {seconds(&view["transcriptMs"])} } "transcripción" }
                span { strong { "{model}" } "modelo de transcripción" }
                span { strong { "{observation}" } "resultado" }
            }
            SignalMeasurement { signal: view["signal"].clone() }
        }
    }
}

#[component]
fn ManualPanel(view: Value, on_action: EventHandler<Value>) -> Element {
    let open = truth(&view, "manualOpen");
    let active = truth(&view, "active");
    let busy = truth(&view, "busy");
    let sending = truth(&view, "disabled");
    let pending = !view["pending"].is_null();
    let state = text(&view, "captureState");
    let recording = state == "recording";
    let recorded = state == "recorded";
    let elapsed = view["elapsed"].as_u64().unwrap_or(0);
    let toggle_status = if active {
        "ESCUCHA AUTOMÁTICA ACTIVA".into()
    } else if recording {
        format!("REC {elapsed}s")
    } else {
        "MIC APAGADO".into()
    };
    let status = if recording {
        format!("GRABANDO · {elapsed}/60 s")
    } else if state == "transcribing" {
        "TRANSCRIPCIÓN LOCAL".into()
    } else {
        "MICRÓFONO APAGADO".into()
    };
    let message = text(&view, "inputMessage");
    let start_label = match state {
        "requesting" => "Preparando micrófono…",
        "recorded" => "Grabar otra toma",
        _ => "Empezar a grabar",
    };
    let input_url = text(&view, "inputUrl").to_owned();
    let source = input_url.clone();
    rsx! {
        div { class: "manual-voice-options",
            div { class: if open { "voice-turn open" } else { "voice-turn" },
                button { r#type: "button", class: "voice-turn-toggle", aria_expanded: open,
                    disabled: !truth(&view,"desktopApp") || active || sending,
                    onclick: move |_| on_action.call(json!({"type":"toggleManual"})),
                    if open { "Cerrar dictado" } else { "Dictar con botón" }
                    span { "{toggle_status}" }
                }
                if open || active {
                    p {
                        if active { "Apaga el micrófono de la escucha automática para dictar con botón." }
                        else { "Puedes hacer pausas. El micrófono se abre al pulsar Empezar a grabar. Después revisas el texto antes de enviarlo." }
                    }
                }
                if open && !active {
                    div { class: "voice-turn-panel", aria_live: "polite",
                        header {
                            div { strong { "CONVERSACIÓN POR VOZ · GEMMA 4" } span { "{status}" } }
                            i { class: if recording { "active" } else { "" } }
                        }
                        p { "{message}" }
                        if !view["recorded"].is_null() || !view["transcriptMs"].is_null() {
                            ManualMeasurements { view: view.clone() }
                        }
                        if let Some(transcript) = view["transcript"].as_str() {
                            section { class: "voice-input-transcript", aria_label: "Última transcripción de voz",
                                strong { "Última transcripción" }
                                p { if transcript.is_empty() { "(sin texto)" } else { "{transcript}" } }
                                small { "Cada dictado se añade al borrador. Editarlo conserva el resultado original de la toma." }
                            }
                        }
                        if recorded && source.starts_with("blob:") {
                            section { class: "voice-input-preview", aria_label: "Revisión local de la toma filtrada",
                                strong { "Escuchar toma filtrada" }
                                audio { id: "alice-voice-input-player", controls: true, preload: "none", src: "{source}",
                                    aria_label: "Escuchar toma filtrada",
                                    onerror: move |_| on_action.call(json!({"type":"inputPlaybackError","value":input_url})),
                                    "Este entorno no puede reproducir la toma."
                                }
                                p { "Escucha el audio de entrada antes de transcribir. Se descarta al transcribir, grabar otra toma o cerrar el dictado." }
                            }
                        }
                        div { class: "voice-turn-actions",
                            if !recording {
                                button { r#type: "button", class: "secondary", disabled: busy || sending || pending,
                                    onclick: move |_| on_action.call(json!({"type":"record"})), "{start_label}" }
                            }
                            if recording {
                                button { r#type: "button", class: "primary", onclick: move |_| on_action.call(json!({"type":"finishRecord","value":true})), "Terminé de hablar y transcribir" }
                                button { r#type: "button", class: "secondary", onclick: move |_| on_action.call(json!({"type":"finishRecord","value":false})), "Parar y revisar audio" }
                            }
                            if recorded {
                                button { r#type: "button", class: "primary", disabled: sending || pending,
                                    onclick: move |_| on_action.call(json!({"type":"transcribe"})), "Transcribir localmente" }
                            }
                            if busy || recorded {
                                button { r#type: "button", class: "secondary danger", onclick: move |_| on_action.call(json!({"type":"discardTake"})), "Descartar toma" }
                            }
                        }
                        small { "Transcripción local: revisa el texto antes de enviarlo al chat. Fish Audio recibe sólo el texto de la respuesta que autorices escuchar." }
                    }
                }
            }
        }
    }
}

#[component]
pub fn VoiceControls(view: Value, on_action: EventHandler<Value>) -> Element {
    let active = truth(&view, "active");
    let disabled = !truth(&view, "desktopApp")
        || (!active
            && (truth(&view, "busy") || truth(&view, "disabled") || !view["pending"].is_null()));
    let loop_state = text(&view, "loopState");
    let can_review = truth(&view, "canReviewTranscript");
    let label = text(&view, "loopLabel");
    let notice = text(&view, "notice");
    let error = text(&view, "loopError");
    let note = match loop_state {
        _ if !active => "La transcripción y las respuestas de Gemma se procesan localmente. El texto de respuesta se envía al servicio externo Fish Audio para generar la voz. Di «Alice» y tu frase seguida. La escucha termina al pulsar Apagar micrófono, salir de esta pantalla o cumplir 2 horas.",
        "standby" => "Micrófono activo. Di «Alice» y tu frase seguida. Puedes apagarlo con el botón.",
        "arming" => "Preparando la entrada y el filtro local antes de escuchar.",
        _ => "Micrófono apagado mientras Alice transcribe, procesa o habla. Después vuelve a escuchar. Puedes apagarlo con el botón en cualquier momento.",
    };
    rsx! {
        div { class: "voice-turn automatic-voice-entry",
            section { class: if active { "hands-free-voice active" } else { "hands-free-voice" }, aria_label: "Conversación automática por voz",
                div { class: "hands-free-controls",
                    button { r#type: "button", class: if active { "secondary danger" } else { "primary" }, disabled,
                        onclick: move |_| on_action.call(json!({"type":"listen"})),
                        if active { "Apagar micrófono" } else { "Iniciar escucha de Alice" }
                    }
                    if loop_state == "standby" {
                        button { r#type: "button", class: "secondary",
                            onclick: move |_| on_action.call(json!({"type":"finishTurn"})), "Terminé de hablar" }
                    }
                    strong { role: "status", aria_live: "polite", "{label}" }
                }
                p { "{note}" }
                if !notice.is_empty() { p { role: "status", "{notice}" } }
                if !error.is_empty() { p { role: "alert", "{error}" } }
                if active && !view["ignored"].is_null() { p { "Toma no atendida · detalle en Audio de entrada" } }
                if !view["lastTurn"].is_null() { TurnObservation { turn: view["lastTurn"].clone(), can_review, on_action } }
            }
            Settings { view: view.clone(), can_review, on_action }
            ManualPanel { view, on_action }
        }
    }
}

#[component]
pub fn VoiceOutput(view: Value, on_action: EventHandler<Value>) -> Element {
    let preview = &view["preview"];
    let output = &view["output"];
    let pending = text(&view, "pending");
    let model = text(preview, "model");
    let spoken_text = text(preview, "spokenText");
    let count = preview["characterCount"].as_u64().unwrap_or_default();
    let limit = preview["characterLimit"].as_u64().unwrap_or_default();
    let url = text(output, "url");
    let audio_count = output["characterCount"].as_u64().unwrap_or_default();
    let time = seconds(&output["durationMs"]);
    let error = text(&view, "outputError");
    let playback = match text(&view, "playback") {
        "playing" => "ALICE ESTÁ HABLANDO",
        "paused" => "VOZ DE ALICE EN PAUSA",
        _ => "AUDIO TEMPORAL LISTO",
    };
    rsx! {
        if !preview.is_null() {
            section { id: "alice-voice-output-panel", class: "voice-output-review", tabindex: "-1", aria_live: "polite",
                onmounted: move |_| on_action.call(json!({"type":"focusOutput"})),
                header {
                    div { strong { "VOZ DE ALICE · REVISIÓN EXPLÍCITA" } span { "Fish Audio · {model} · audio temporal" } }
                    button { r#type: "button", class: "secondary", disabled: !pending.is_empty(),
                        onclick: move |_| on_action.call(json!({"type":"cancel"})),
                        if pending == "cancel" { "Descartando…" } else { "Cancelar" }
                    }
                }
                div { class: "voice-output-meta",
                    span { "{count}/{limit} caracteres" } span { "SHA-256 registrado sin texto" } span { "Sin memoria · sin archivo" }
                }
                details { open: true, summary { "Texto exacto que se enviará" } p { "{spoken_text}" } }
                if truth(preview,"canConfirm") {
                    footer {
                        small { "Al confirmar, se enviará únicamente este texto al proveedor. El aviso de verificación permanece en el chat y no se pronuncia." }
                        button { r#type: "button", class: "primary", disabled: !pending.is_empty(),
                            onclick: move |_| on_action.call(json!({"type":"confirm"})),
                            if pending == "confirm" { "Generando audio…" } else { "Autorizar y generar audio temporal" }
                        }
                    }
                } else {
                    p { class: "voice-output-warning",
                        if text(preview,"configuration") == "missingApiKey" {
                            "Falta FISH_API_KEY en el proceso de Alice. Cerrá y abrí Alice después de configurarla."
                        } else {
                            "Revisa data/voice-profile.json o ALICE_FISH_REFERENCE_ID. La selección se guarda fuera de Git."
                        }
                    }
                }
            }
        }
        if url.starts_with("blob:") {
            section { id: "alice-voice-output-panel", class: "voice-output-player", tabindex: "-1", aria_live: "polite",
                onmounted: move |_| on_action.call(json!({"type":"focusOutput"})),
                header {
                    div { strong { "{playback}" } span { "{audio_count} caracteres · generado en {time} · sin archivo ni recuerdo" } }
                    button { r#type: "button", class: "secondary", onclick: move |_| on_action.call(json!({"type":"discardOutput"})), "Detener y descartar" }
                }
                audio { id: "alice-voice-output-player", controls: true, autoplay: true, src: "{url}",
                    onplay: move |_| on_action.call(json!({"type":"playback","value":"playing"})),
                    onpause: move |_| on_action.call(json!({"type":"playback","value":"paused"})),
                    onended: move |_| on_action.call(json!({"type":"discardOutput"})),
                    onerror: move |_| on_action.call(json!({"type":"outputPlaybackError"})),
                    "Tu navegador no puede reproducir este audio temporal."
                }
                small { "Al terminar la reproducción, el audio se elimina automáticamente de la interfaz." }
            }
        }
        if !error.is_empty() { p { class: "cloud-error", role: "alert", "{error}" } }
    }
}

#[component]
pub fn InputDiagnostics(view: Value, on_action: EventHandler<Value>) -> Element {
    let mut paused = use_signal(|| false);
    let mut frozen = use_signal(|| None::<Value>);
    let mut cycle = use_signal(|| 1u64);
    let mut inspecting = use_signal(|| true);
    let mut last_fingerprint = use_signal(String::new);
    let fingerprint = text(&view, "fingerprint").to_owned();
    let observed_fingerprint = fingerprint.clone();
    use_effect(use_reactive((&observed_fingerprint,), move |(observed,)| {
        if !paused() && last_fingerprint.peek().as_str() != observed {
            last_fingerprint.set(observed.clone());
            cycle += 1;
        }
    }));
    let capture_view = view.clone();
    let freeze_view = view.clone();
    let current = if paused() {
        frozen().unwrap_or_else(|| view.clone())
    } else {
        view.clone()
    };
    let snapshot = &current["snapshot"];
    let mode = if paused() { "paused" } else { "live" };
    let mode_accessible = format!("Estado {mode}");
    let cycle_label = format!("{:07}", cycle());
    let waiting = text(snapshot, "source") == "none" || snapshot.is_null();
    let elapsed = format!(
        "{:.3} MS",
        current["processingMs"].as_f64().unwrap_or_default()
    );
    let input = text(snapshot, "input");
    let tokens = rows(snapshot, "tokens");
    let fields = rows(snapshot, "fields");
    rsx! {
        section { class: "identification-page", aria_labelledby: "input-diagnostic-title",
            header { class: "identification-header",
                div { class: "identification-title-block",
                    span { class: "identification-mark", "00" }
                    div { p { class: "eyebrow", "ANÁLISIS LOCAL DEL MENSAJE" } h3 { id: "input-diagnostic-title", "Diagnóstico de entrada" } }
                }
                div { class: "identification-status", aria_label: "{mode_accessible}",
                    i { class: "{mode}" }
                    strong { if paused() { "PAUSED" } else { "LIVE" } }
                    small { if waiting { "WAITING_INPUT" } else { "LOCAL_INPUT" } }
                }
            }
            dl { class: "identification-telemetry",
                div { dt { "CICLO" } dd { "{cycle_label}" } }
                div { dt { "ACTUALIZACIÓN" } dd { "POR EVENTOS" } }
                div { dt { "AFFECT SIM" } dd { "UNMODELED / OFF" } }
                div { dt { "ANÁLISIS LOCAL" } dd { "{elapsed}" } }
                div { dt { "RENDER" } dd { if paused() { "FROZEN" } else { "AUTO_REND" } } }
            }
            p { class: "diagnostic-explanation", "Esta vista analiza el texto con reglas locales. Congelar el diagnóstico permite seguir conversando. El tiempo mostrado corresponde a las reglas locales." }
            div { class: "identification-controls", aria_label: "Controles del diagnóstico de entrada",
                button { r#type: "button", aria_pressed: !paused(), onclick: move |_| {
                    last_fingerprint.set(fingerprint.clone());
                    paused.set(false);
                    cycle += 1;
                }, "Actualizar en vivo" }
                button { r#type: "button", onclick: move |_| {
                    frozen.set(Some(capture_view.clone()));
                    paused.set(true);
                    cycle += 1;
                }, "Capturar diagnóstico" }
                button { r#type: "button", aria_pressed: paused(), onclick: move |_| {
                    frozen.set(Some(freeze_view.clone()));
                    paused.set(true);
                }, "Congelar diagnóstico" }
                button { r#type: "button", aria_pressed: inspecting(), onclick: move |_| inspecting.set(!inspecting()), "Detalles de las reglas" }
                button { r#type: "button", disabled: !truth(&view,"observationAvailable"),
                    onclick: move |_| on_action.call(json!({"type":"toggleObservation"})), "Gestionar observación" }
            }
            div { class: "identification-body",
                section { class: "identification-input", aria_labelledby: "perception-input-title",
                    header { h4 { id: "perception-input-title", "Palabras del mensaje" } small { "REAL_INPUT · REVIEW_REQUIRED" } }
                    div { class: "identification-processed", aria_live: "polite",
                        div { class: "identification-received",
                            span { "ACTIVE INPUT" }
                            strong { if input.is_empty() { "SIN ENTRADA ACTIVA" } else { "{input}" } }
                            small { if waiting { "WAITING_INPUT" } else { "LIVE_CONTEXT" } }
                        }
                        div { class: if tokens.is_empty() { "identification-tokens empty" } else { "identification-tokens" },
                            if tokens.is_empty() {
                                p { strong { "SIN TEXTO" } span { "Esperando una entrada real de conversación o percepción autorizada." } }
                            } else {
                                for (index, token) in tokens.iter().enumerate() {
                                    span { key: "{index}", {token.as_str().unwrap_or_default()} }
                                }
                            }
                        }
                        small { class: "identification-token-count", "{tokens.len()} PALABRAS · MÁXIMO 32" }
                    }
                    if tokens.len() >= 32 { p { class: "identification-limit", "La visualización se limita a las primeras 32 palabras." } }
                }
                section { class: "perception-vector", aria_labelledby: "perception-vector-title",
                    header { h4 { id: "perception-vector-title", "Origen y clasificación" } small { "PROVENANCE REQUIRED" } }
                    dl {
                        for field in fields {
                            {
                                let label = text(field,"label");
                                let value = text(field,"value");
                                let detail = text(field,"detail");
                                let evidence = text(field,"evidence");
                                let badge = match evidence {
                                    "observed" => "OBSERVADO", "heuristic" => "HEURÍSTICO", _ => "NO DISPONIBLE"
                                };
                                rsx! {
                                    div { key: "{label}",
                                        dt { "{label}" }
                                        dd {
                                            strong { "{value}" }
                                            span { class: "evidence-{evidence}", "{badge}" }
                                            if inspecting() { small { "{detail}" } }
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
}
