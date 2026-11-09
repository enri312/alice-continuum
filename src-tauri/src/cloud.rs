use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::conversation_history::{record_real_conversation_exchange, ConversationHistorySnapshot};
use crate::util::{alice_data_root, timestamp_ms};
use crate::working_memory::{
    record_real_cloud_exchange, WorkingMemorySnapshot, WorkingMemoryStore,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};

const SYSTEM_PROMPT: &str = include_str!("prompts/conversation.txt");
const VOICE_SYSTEM_PROMPT: &str = include_str!("prompts/conversation-voice.txt");
const VOICE_GREETING_PROMPT: &str = "\n\nSALUDO ACTUAL: Carlos te saluda ahora. Devuelve un saludo cálido y animado, como Alice, y puedes decir «sí, te escucho» con naturalidad. Si el tema es mejorarte a ti, habla de mi sistema, mis respuestas o nuevas funciones para mí. Si menciona a una tercera persona, sigue ese tema. Ejemplo ficticio de estilo, no guion obligatorio: «¡Hola! Sí, te escucho. Qué bueno que sigamos mejorando mis respuestas. ¿Qué ajuste tienes en mente para mí?». No afirmes que todos tus módulos están activos.";
fn is_direct_greeting(message: &str) -> bool {
    message
        .trim_start_matches(|c: char| c.is_whitespace() || matches!(c, '¡' | '¿'))
        .split(|c: char| !c.is_alphabetic())
        .next()
        .is_some_and(|word| word.eq_ignore_ascii_case("hola"))
}

fn gemma_voice_prompt(message: &str) -> String {
    format!(
        "{}{}",
        VOICE_SYSTEM_PROMPT,
        if is_direct_greeting(message) {
            VOICE_GREETING_PROMPT
        } else {
            ""
        }
    )
}

fn direct_reference_response(request: &CloudRequest) -> Option<CloudResponse> {
    if request.provider != "llamacpp" || request.vision.is_some() {
        return None;
    }
    let text = crate::conversation_reference::direct_reply(&request.message)?;
    Some(CloudResponse {
        text,
        provider: "Referencia explícita del mensaje".into(),
        model: "Lectura local de cita".into(),
        response_id: format!("reference:{}", new_operation_id()),
        input_tokens: 0,
        output_tokens: 0,
        working_memory: None,
        working_memory_error: None,
        conversation_history: None,
        conversation_history_error: None,
    })
}

const OLLAMA_LOCAL_CHAT_ENDPOINT: &str = "http://127.0.0.1:11434/api/chat";
const OPENROUTER_PAUSED: bool = true;
const LOCAL_UNVERIFIED_NOTICE: &str = "Conocimiento interno no verificado:";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudStatus {
    providers: Vec<CloudProvider>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct CloudCapabilityProbe {
    pub(crate) provider_count: usize,
    pub(crate) configured_provider_count: usize,
    pub(crate) ollama_configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudProvider {
    id: String,
    label: String,
    configured: bool,
    default_model: String,
    protocol: String,
    retention_mode: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudRequest {
    #[serde(default)]
    vision: Option<crate::conversation_vision::VisionInput>,
    #[serde(default)]
    voice_session_id: Option<String>,
    message: String,
    payload: String,
    provider: String,
    model: String,
    history_count: usize,
    memory_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudResponse {
    text: String,
    provider: String,
    model: String,
    response_id: String,
    input_tokens: u64,
    output_tokens: u64,
    working_memory: Option<WorkingMemorySnapshot>,
    working_memory_error: Option<String>,
    conversation_history: Option<ConversationHistorySnapshot>,
    conversation_history_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudAuditEntry {
    timestamp_ms: u128,
    provider: String,
    model: String,
    response_id: String,
    history_count: usize,
    memory_count: usize,
    input_tokens: u64,
    output_tokens: u64,
    request_sha256: String,
    response_sha256: String,
}

fn append_cloud_audit(app: &AppHandle, entry: &CloudAuditEntry) -> Result<(), String> {
    let directory = alice_data_root(app)?.join("cloud");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let line = serde_json::to_string(entry).map_err(|error| error.to_string())?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(directory.join("cloud-audit.jsonl"))
        .map_err(|error| format!("No se pudo abrir la auditoría de nube: {error}"))?;
    writeln!(file, "{line}")
        .map_err(|error| format!("No se pudo registrar la auditoría de nube: {error}"))
}

#[tauri::command]
pub(crate) fn cloud_status() -> CloudStatus {
    let has = |name: &str| {
        std::env::var(name)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
    };
    let value = |name: &str, fallback: &str| {
        std::env::var(name)
            .ok()
            .filter(|item| !item.trim().is_empty())
            .unwrap_or_else(|| fallback.to_string())
    };
    let mut providers = vec![CloudProvider {
        id: "ollama".into(),
        label: "Ollama local".into(),
        configured: has("ALICE_OLLAMA_ENABLED"),
        default_model: value("ALICE_OLLAMA_MODEL", "qwen3.5:4b"),
        protocol: "Chat local · loopback".into(),
        retention_mode: "inferencia local; sin salida a Internet".into(),
    }];
    providers.push(CloudProvider {
        id: "llamacpp".into(),
        label: "Gemma local · llama.cpp".into(),
        configured: crate::local_inference::installed(),
        default_model: crate::local_inference::GEMMA_MODEL.into(),
        protocol: "Local · requiere inicio explícito en Configuración".into(),
        retention_mode: "Sin nube; historial local solo al enviar y recibir una respuesta".into(),
    });
    if !OPENROUTER_PAUSED {
        providers.push(CloudProvider {
            id: "openrouter".into(),
            label: "OpenRouter".into(),
            configured: has("OPENROUTER_API_KEY"),
            default_model: value("OPENROUTER_MODEL", "openrouter/free"),
            protocol: "Chat Completions · router gratuito".into(),
            retention_mode: "según OpenRouter y el proveedor enrutado".into(),
        });
    }
    providers.extend([
        CloudProvider {
            id: "openai".into(),
            label: "OpenAI".into(),
            configured: has("OPENAI_API_KEY"),
            default_model: value("OPENAI_MODEL", "gpt-5.6-terra"),
            protocol: "Responses API".into(),
            retention_mode: "store: false".into(),
        },
        CloudProvider {
            id: "anthropic".into(),
            label: "Anthropic".into(),
            configured: has("ANTHROPIC_API_KEY"),
            default_model: value("ANTHROPIC_MODEL", ""),
            protocol: "Messages API".into(),
            retention_mode: "retención según Anthropic".into(),
        },
        CloudProvider {
            id: "google".into(),
            label: "Google".into(),
            configured: has("GEMINI_API_KEY"),
            default_model: value("GEMINI_MODEL", "gemini-3.5-flash"),
            protocol: "GenerateContent".into(),
            retention_mode: "retención según Google".into(),
        },
        CloudProvider {
            id: "xai".into(),
            label: "xAI".into(),
            configured: has("XAI_API_KEY"),
            default_model: value("XAI_MODEL", "grok-4.5"),
            protocol: "Responses API".into(),
            retention_mode: "store: false".into(),
        },
        CloudProvider {
            id: "compatible".into(),
            label: "Compatible".into(),
            configured: has("ALICE_COMPATIBLE_API_KEY") && has("ALICE_COMPATIBLE_BASE_URL"),
            default_model: value("ALICE_COMPATIBLE_MODEL", ""),
            protocol: "Chat Completions".into(),
            retention_mode: "definida por el servicio".into(),
        },
    ]);
    CloudStatus { providers }
}

pub(crate) fn cloud_capability_probe() -> CloudCapabilityProbe {
    let status = cloud_status();
    CloudCapabilityProbe {
        provider_count: status.providers.len(),
        ollama_configured: status
            .providers
            .iter()
            .any(|provider| provider.id == "ollama" && provider.configured),
        configured_provider_count: status
            .providers
            .iter()
            .filter(|provider| provider.configured)
            .count(),
    }
}

pub(crate) fn cloud_configuration_probe() -> Vec<(String, String, Result<bool, String>)> {
    let compatible_url = std::env::var("ALICE_COMPATIBLE_BASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty());
    cloud_status()
        .providers
        .into_iter()
        .map(|provider| {
            let configured = if provider.id == "compatible" && provider.configured {
                let value = compatible_url.as_deref().unwrap_or_default().trim();
                validate_compatible_probe_url(value).map(|_| true)
            } else {
                Ok(provider.configured)
            };
            (provider.id, provider.label, configured)
        })
        .collect()
}

fn validate_compatible_probe_url(value: &str) -> Result<(), String> {
    if !value.starts_with("https://") || value.contains('?') || value.contains('#') {
        Err("La URL compatible debe usar HTTPS y no contener parámetros".into())
    } else {
        Ok(())
    }
}

fn validate_cloud_request(request: &CloudRequest) -> Result<(), String> {
    if request.message.trim().is_empty() || request.payload.trim().is_empty() {
        return Err("El mensaje está vacío".into());
    }
    if request.payload.chars().count() > 24_000 {
        return Err("El contexto autorizado supera el límite local de 24.000 caracteres".into());
    }
    if request.model.trim().is_empty()
        || request.model.len() > 160
        || !request
            .model
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-._/:".contains(character))
    {
        return Err("El identificador del modelo no es válido".into());
    }
    if !matches!(
        request.provider.as_str(),
        "ollama"
            | "llamacpp"
            | "openrouter"
            | "openai"
            | "anthropic"
            | "google"
            | "xai"
            | "compatible"
    ) {
        return Err("El proveedor seleccionado no está registrado en Alice".into());
    }
    if request.provider == "openrouter" && OPENROUTER_PAUSED {
        return Err("OpenRouter está pausado; Alice usa Ollama local por ahora".into());
    }
    if request.provider == "google" && (request.model.contains('/') || request.model.contains(':'))
    {
        return Err("El modelo de Google no puede contener '/' ni ':'".into());
    }
    if request.provider == "llamacpp" && request.model != crate::local_inference::GEMMA_MODEL {
        return Err("Gemma local solo admite el modelo evaluado en esta instalación".into());
    }
    if request.provider == "ollama" {
        let model = request.model.to_ascii_lowercase();
        if model.ends_with(":cloud") || model.ends_with("-cloud") {
            return Err(
                "Alice sólo admite modelos Ollama locales; los modelos cloud están bloqueados"
                    .into(),
            );
        }
    }
    Ok(())
}

fn extract_cloud_response_text(provider: &str, value: &serde_json::Value) -> String {
    match provider {
        "ollama" => value
            .pointer("/message/content")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .to_string(),
        "openai" | "xai" => value
            .get("output")
            .and_then(|item| item.as_array())
            .into_iter()
            .flatten()
            .filter_map(|item| item.get("content").and_then(|content| content.as_array()))
            .flatten()
            .filter(|item| item.get("type").and_then(|kind| kind.as_str()) == Some("output_text"))
            .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        "anthropic" => value
            .get("content")
            .and_then(|item| item.as_array())
            .into_iter()
            .flatten()
            .filter(|item| item.get("type").and_then(|kind| kind.as_str()) == Some("text"))
            .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        "google" => value
            .pointer("/candidates/0/content/parts")
            .and_then(|item| item.as_array())
            .into_iter()
            .flatten()
            .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        "openrouter" | "compatible" | "llamacpp" => value
            .pointer("/choices/0/message/content")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

fn returned_model_name(provider: &str, requested_model: &str, value: &serde_json::Value) -> String {
    if provider == "llamacpp" {
        return requested_model.to_string();
    }
    value
        .get(if provider == "google" {
            "modelVersion"
        } else {
            "model"
        })
        .and_then(|item| item.as_str())
        .unwrap_or(requested_model)
        .to_string()
}

fn apply_response_provenance(provider: &str, text: String) -> String {
    if provider != "llamacpp" || text.trim_start().starts_with(LOCAL_UNVERIFIED_NOTICE) {
        return text;
    }
    format!("{LOCAL_UNVERIFIED_NOTICE}\n\n{}", text.trim_start())
}

fn ollama_chat_body(request: &CloudRequest) -> serde_json::Value {
    serde_json::json!({
        "model": &request.model,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": &request.payload }
        ],
        "stream": false,
        "think": false,
        "keep_alive": "3m",
        "options": {
            "num_ctx": 4096,
            "num_predict": 900,
            "temperature": 0.2
        }
    })
}

#[tauri::command]
pub(crate) async fn send_cloud_message(
    app: AppHandle,
    working_memory: State<'_, WorkingMemoryStore>,
    request: CloudRequest,
    voice_session: State<'_, crate::voice_session::VoiceSessionStore>,
    vision_session: State<'_, crate::conversation_vision::VisionSessionStore>,
) -> Result<CloudResponse, String> {
    if let Some(vision) = &request.vision {
        crate::conversation_vision::validate_input(&vision_session, vision, &request.provider)?;
        if request.message.chars().count() > 1600 {
            return Err("Con la vista activa usa mensajes de hasta 1600 caracteres, para dejar espacio a las imágenes.".into());
        }
    }
    if let Some(id) = &request.voice_session_id {
        voice_session.require(id)?;
        if request.provider != "llamacpp" {
            return Err("La sesión de voz sólo admite Gemma local".into());
        }
    }
    validate_cloud_request(&request)?;

    let media_action = request.provider == "llamacpp"
        && (crate::media_actions::parse_request(&request.message).is_some()
            || crate::media_actions::clarification(&request.message).is_some());
    let desktop_action = request.provider == "llamacpp"
        && crate::desktop_actions::direct_target(&request.message).is_some();
    let audit_source = if desktop_action || media_action {
        AuditSource::Capability
    } else {
        AuditSource::Cloud
    };
    let audit_capability = if media_action {
        "desktop.approved.media"
    } else if desktop_action {
        "desktop.approved.open"
    } else {
        "cloud.conversation.send"
    };
    let audit_operation = if media_action {
        "desktop.media"
    } else if desktop_action {
        "desktop.open"
    } else {
        "cloud.send"
    };
    let operation_id = new_operation_id();
    let request_digest = format!(
        "sha256:{}",
        crate::util::encode_hex_lower(Sha256::digest(request.payload.as_bytes()))
    );
    record_producer_audit(
        &app,
        operation_id.clone(),
        audit_source,
        audit_capability.into(),
        audit_operation.into(),
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(request_digest.clone()),
        "OUTBOUND_REQUEST_ACCEPTED",
    )?;

    let started = Instant::now();
    let result = send_cloud_message_inner(&app, &request).await;
    let result = if let Some(id) = &request.voice_session_id {
        voice_session.complete(id, result)
    } else {
        result
    };
    let duration_ms = u64::try_from(started.elapsed().as_millis())
        .unwrap_or(86_400_000)
        .min(86_400_000);
    match result {
        Ok(mut response) => {
            let response_digest = format!(
                "sha256:{}",
                crate::util::encode_hex_lower(Sha256::digest(response.text.as_bytes()))
            );
            if let Err(error) = record_producer_audit(
                &app,
                operation_id,
                audit_source,
                audit_capability.into(),
                audit_operation.into(),
                if response.response_id.starts_with("desktop:media:failed:") {
                    AuditStage::Error
                } else {
                    AuditStage::Execution
                },
                if response.response_id.starts_with("desktop:media:failed:") {
                    AuditOutcome::Error
                } else {
                    AuditOutcome::Success
                },
                Some(duration_ms),
                Some(response_digest),
                "CLOUD_RESPONSE_RECEIVED",
            ) {
                eprintln!("La respuesta de nube llegó, pero R3 no registró el resultado: {error}");
            }
            match record_real_cloud_exchange(
                &app,
                &working_memory,
                &request.message,
                &response.text,
                &response.provider,
                &response.model,
            ) {
                Ok(result) => {
                    response.working_memory = Some(result.snapshot);
                    response.working_memory_error = result.warning;
                }
                Err(error) => response.working_memory_error = Some(error),
            }
            match record_real_conversation_exchange(
                &app,
                &response.response_id,
                &request.message,
                &response.text,
                &response.provider,
                &response.model,
            ) {
                Ok(snapshot) => {
                    if request.provider == "llamacpp"
                        && !response.response_id.starts_with("desktop:")
                    {
                        if let Some(exchange) =
                            snapshot.exchange_for_response(&response.response_id)
                        {
                            crate::automatic_memory::schedule(app.clone(), exchange);
                        }
                    }
                    response.conversation_history = Some(snapshot);
                }
                Err(error) => response.conversation_history_error = Some(error),
            }
            Ok(response)
        }
        Err(error) => {
            if let Err(audit_error) = record_producer_audit(
                &app,
                operation_id,
                audit_source,
                audit_capability.into(),
                audit_operation.into(),
                AuditStage::Error,
                AuditOutcome::Error,
                Some(duration_ms),
                Some(request_digest),
                "CLOUD_REQUEST_FAILED",
            ) {
                eprintln!("R3 no registró el fallo de nube: {audit_error}");
            }
            Err(error)
        }
    }
}

async fn send_cloud_message_inner(
    app: &AppHandle,
    request: &CloudRequest,
) -> Result<CloudResponse, String> {
    if request.provider == "llamacpp" {
        if let Some(response) = direct_reference_response(request) {
            return Ok(response);
        }
        let media = crate::media_actions::parse_request(&request.message);
        let clarification = if media.is_none() {
            crate::media_actions::clarification(&request.message)
        } else {
            None
        };
        if media.is_some() || clarification.is_some() {
            use tauri::Manager;
            let voice = app
                .state::<crate::voice_session::VoiceSessionStore>()
                .inner()
                .clone();
            let vision = app
                .state::<crate::conversation_vision::VisionSessionStore>()
                .inner()
                .clone();
            let voice_id = request.voice_session_id.clone();
            let vision_id = request.vision.as_ref().map(|v| v.session_id.clone());
            let check: crate::media_actions::CancellationCheck = std::sync::Arc::new(move || {
                if let Some(id) = &voice_id {
                    voice.require(id)?;
                }
                if let Some(id) = &vision_id {
                    vision.require(id)?;
                }
                Ok(())
            });
            let mut usage = (0, 0);
            let result = async {
                let media = media.ok_or_else(|| clarification.unwrap_or_default().to_string())?;
                check()?;
                if crate::media_actions::asks_tool_choice(&request.message) {
                    let selected = crate::local_inference::gemma_chat(
                        crate::media_actions::tool_body(&request.message),
                    )
                    .await?;
                    check()?;
                    crate::media_actions::validate_tool_call(&selected, &media)?;
                    usage = (
                        selected
                            .pointer("/usage/prompt_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0),
                        selected
                            .pointer("/usage/completion_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0),
                    );
                }
                crate::media_actions::execute(app, media, check.clone()).await
            }
            .await;
            check()?;
            let failed = result.is_err();
            let text = result
                .unwrap_or_else(|error| format!("No pude completar la reproducción: {error}"));
            return Ok(CloudResponse {
                text,
                provider: "Control multimedia local".into(),
                model: "Spotify · YouTube en Chrome".into(),
                response_id: format!(
                    "desktop:media:{}{}",
                    if failed { "failed:" } else { "" },
                    new_operation_id()
                ),
                input_tokens: usage.0,
                output_tokens: usage.1,
                working_memory: None,
                working_memory_error: None,
                conversation_history: None,
                conversation_history_error: None,
            });
        }
        let mut tool_usage = (0, 0);
        let direct = crate::desktop_actions::direct_target(&request.message);
        let target = if direct.is_some() {
            direct
        } else if let Some(authorized) = crate::desktop_actions::tool_candidate(&request.message) {
            let value = crate::local_inference::gemma_chat(crate::desktop_actions::tool_body(
                &request.message,
            ))
            .await?;
            tool_usage = (
                value
                    .pointer("/usage/prompt_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
                value
                    .pointer("/usage/completion_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
            );
            use tauri::Manager;
            if let Some(id) = &request.voice_session_id {
                app.state::<crate::voice_session::VoiceSessionStore>()
                    .require(id)?;
            }
            if let Some(vision) = &request.vision {
                app.state::<crate::conversation_vision::VisionSessionStore>()
                    .require(&vision.session_id)?;
            }
            Some(crate::desktop_actions::validate_tool_call(
                &value, authorized,
            )?)
        } else {
            None
        };
        if let Some(target) = target {
            let action_app = app.clone();
            let text = tauri::async_runtime::spawn_blocking(move || {
                crate::desktop_actions::execute(&action_app, target)
            })
            .await
            .map_err(|_| "Se interrumpió la apertura de la aplicación")??;
            if target == crate::desktop_actions::DesktopTarget::Spotify {
                use tauri::Manager;
                app.state::<crate::media_actions::MediaPlaybackStore>()
                    .opened_spotify();
            }
            return Ok(CloudResponse {
                text,
                provider: "Acción local autorizada".into(),
                model: if direct.is_some() {
                    if cfg!(target_os = "linux") {
                        "Spotify · Ubuntu"
                    } else {
                        "Spotify · unidades D y E"
                    }
                    .into()
                } else {
                    format!("{} · tool calling", crate::local_inference::GEMMA_MODEL)
                },
                response_id: format!("desktop:{}", new_operation_id()),
                input_tokens: tool_usage.0,
                output_tokens: tool_usage.1,
                working_memory: None,
                working_memory_error: None,
                conversation_history: None,
                conversation_history_error: None,
            });
        }
    }
    let required_key = |name: &str| {
        std::env::var(name)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| format!("Falta la variable de entorno {name}"))
    };
    // Keep the permit alive until the complete response has been consumed.
    let _local_permit = if request.provider == "ollama" {
        Some(crate::local_inference::acquire_ollama(&request.model).await?)
    } else {
        None
    };
    let client = if request.provider == "ollama" {
        crate::local_inference::client()?
    } else {
        reqwest::Client::new()
    };
    let (provider_label, value) = if request.provider == "llamacpp" {
        let body = if let Some(vision) = &request.vision {
            use tauri::Manager;
            let store = app.state::<crate::conversation_vision::VisionSessionStore>();
            crate::conversation_vision::validate_input(&store, vision, &request.provider)?;
            let desktop = if vision.desktop_enabled() {
                Some(crate::conversation_vision::desktop_frame(&store, &vision.session_id).await?)
            } else {
                None
            };
            crate::conversation_vision::chat_body(
                &request.message,
                &request.payload,
                vision,
                desktop,
                request.voice_session_id.is_some(),
            )
        } else {
            serde_json::json!({
                "model": crate::local_inference::GEMMA_MODEL, "stream": false, "temperature": 0.2, "max_tokens": if request.voice_session_id.is_some() { 240 } else { 900 },
                "messages": [{"role":"system","content":if request.voice_session_id.is_some() { gemma_voice_prompt(&request.message) } else { SYSTEM_PROMPT.to_string() }},{"role":"user","content":request.payload}]
            })
        };
        let value = crate::local_inference::gemma_chat(body).await?;
        if let Some(vision) = &request.vision {
            use tauri::Manager;
            app.state::<crate::conversation_vision::VisionSessionStore>()
                .require(&vision.session_id)?;
        }
        ("Gemma local · llama.cpp", value)
    } else {
        let (provider_label, response) = match request.provider.as_str() {
            "ollama" => {
                if !std::env::var("ALICE_OLLAMA_ENABLED")
                    .map(|value| !value.trim().is_empty())
                    .unwrap_or(false)
                {
                    return Err(
                        "Ollama local no está listo. Iniciá Alice con Iniciar Alice Continuum.cmd"
                            .into(),
                    );
                }
                let response = client
                    .post(OLLAMA_LOCAL_CHAT_ENDPOINT)
                    .timeout(Duration::from_secs(180))
                    .json(&ollama_chat_body(request))
                    .send()
                    .await;
                ("Ollama local", response)
            }
            "openai" => {
                let key = required_key("OPENAI_API_KEY")?;
                let body = serde_json::json!({
                    "model": &request.model, "instructions": SYSTEM_PROMPT, "input": &request.payload,
                    "store": false, "max_output_tokens": 1200, "reasoning": { "effort": "low" },
                    "text": { "verbosity": "medium" }, "safety_identifier": "alice-local-single-user-v1"
                });
                let response = client
                    .post("https://api.openai.com/v1/responses")
                    .bearer_auth(key.trim())
                    .timeout(Duration::from_secs(90))
                    .json(&body)
                    .send()
                    .await;
                ("OpenAI", response)
            }
            "xai" => {
                let key = required_key("XAI_API_KEY")?;
                let body = serde_json::json!({
                    "model": &request.model,
                    "input": [{ "role": "system", "content": SYSTEM_PROMPT }, { "role": "user", "content": &request.payload }],
                    "store": false, "max_output_tokens": 1200
                });
                let response = client
                    .post("https://api.x.ai/v1/responses")
                    .bearer_auth(key.trim())
                    .timeout(Duration::from_secs(180))
                    .json(&body)
                    .send()
                    .await;
                ("xAI", response)
            }
            "anthropic" => {
                let key = required_key("ANTHROPIC_API_KEY")?;
                let body = serde_json::json!({
                    "model": &request.model, "max_tokens": 1200, "system": SYSTEM_PROMPT,
                    "messages": [{ "role": "user", "content": &request.payload }]
                });
                let response = client
                    .post("https://api.anthropic.com/v1/messages")
                    .header("x-api-key", key.trim())
                    .header("anthropic-version", "2023-06-01")
                    .timeout(Duration::from_secs(120))
                    .json(&body)
                    .send()
                    .await;
                ("Anthropic", response)
            }
            "google" => {
                let key = required_key("GEMINI_API_KEY")?;
                let endpoint = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                    request.model
                );
                let body = serde_json::json!({
                    "systemInstruction": { "parts": [{ "text": SYSTEM_PROMPT }] },
                    "contents": [{ "role": "user", "parts": [{ "text": &request.payload }] }],
                    "generationConfig": { "maxOutputTokens": 1200 }
                });
                let response = client
                    .post(endpoint)
                    .header("x-goog-api-key", key.trim())
                    .timeout(Duration::from_secs(120))
                    .json(&body)
                    .send()
                    .await;
                ("Google", response)
            }
            "openrouter" => {
                let key = required_key("OPENROUTER_API_KEY")?;
                let body = serde_json::json!({
                    "model": &request.model,
                    "max_tokens": 1200,
                    "messages": [
                        { "role": "system", "content": SYSTEM_PROMPT },
                        { "role": "user", "content": &request.payload }
                    ]
                });
                let response = client
                    .post("https://openrouter.ai/api/v1/chat/completions")
                    .bearer_auth(key.trim())
                    .header("X-OpenRouter-Title", "Alice")
                    .timeout(Duration::from_secs(180))
                    .json(&body)
                    .send()
                    .await;
                ("OpenRouter", response)
            }
            "compatible" => {
                let key = required_key("ALICE_COMPATIBLE_API_KEY")?;
                let base_url = required_key("ALICE_COMPATIBLE_BASE_URL")?;
                let base_url = base_url.trim().trim_end_matches('/');
                if !base_url.starts_with("https://")
                    || base_url.contains('?')
                    || base_url.contains('#')
                {
                    return Err(
                        "ALICE_COMPATIBLE_BASE_URL debe ser una URL HTTPS sin parámetros".into(),
                    );
                }
                let body = serde_json::json!({
                    "model": &request.model, "max_tokens": 1200,
                    "messages": [{ "role": "system", "content": SYSTEM_PROMPT }, { "role": "user", "content": &request.payload }]
                });
                let endpoint = format!("{base_url}/chat/completions");
                let response = client
                    .post(endpoint)
                    .bearer_auth(key.trim())
                    .timeout(Duration::from_secs(120))
                    .json(&body)
                    .send()
                    .await;
                ("Compatible", response)
            }
            _ => return Err("El proveedor seleccionado no está registrado en Alice".into()),
        };
        let response = response
            .map_err(|error| format!("No se pudo conectar con {provider_label}: {error}"))?;
        let status = response.status();
        let value: serde_json::Value = response.json().await.map_err(|error| {
            format!("{provider_label} devolvió una respuesta no válida: {error}")
        })?;
        if !status.is_success() {
            let message = value
                .pointer("/error/message")
                .and_then(|item| item.as_str())
                .unwrap_or("La solicitud fue rechazada por el proveedor");
            return Err(format!("{provider_label} ({status}): {message}"));
        }

        (provider_label, value)
    };
    let text = apply_response_provenance(
        &request.provider,
        extract_cloud_response_text(&request.provider, &value),
    );
    if text.trim().is_empty() {
        return Err(format!("{provider_label} no devolvió texto para mostrar"));
    }

    let response_id = if request.provider == "ollama" {
        value
            .get("created_at")
            .and_then(|item| item.as_str())
            .map(|created_at| format!("local:{created_at}"))
            .unwrap_or_else(|| format!("local:{}", new_operation_id()))
    } else {
        value
            .get(if request.provider == "google" {
                "responseId"
            } else {
                "id"
            })
            .and_then(|item| item.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| format!("generated:{}", new_operation_id()))
    };
    let returned_model = returned_model_name(&request.provider, &request.model, &value);
    let (input_pointer, output_pointer) = match request.provider.as_str() {
        "google" => (
            "/usageMetadata/promptTokenCount",
            "/usageMetadata/candidatesTokenCount",
        ),
        "ollama" => ("/prompt_eval_count", "/eval_count"),
        "openrouter" | "compatible" | "llamacpp" => {
            ("/usage/prompt_tokens", "/usage/completion_tokens")
        }
        _ => ("/usage/input_tokens", "/usage/output_tokens"),
    };
    let input_tokens = value
        .pointer(input_pointer)
        .and_then(|item| item.as_u64())
        .unwrap_or(0);
    let output_tokens = value
        .pointer(output_pointer)
        .and_then(|item| item.as_u64())
        .unwrap_or(0);

    append_cloud_audit(
        app,
        &CloudAuditEntry {
            timestamp_ms: timestamp_ms()?,
            provider: provider_label.into(),
            model: returned_model.clone(),
            response_id: response_id.clone(),
            history_count: request.history_count,
            memory_count: request.memory_count,
            input_tokens,
            output_tokens,
            request_sha256: crate::util::encode_hex_lower(Sha256::digest(
                request.payload.as_bytes(),
            )),
            response_sha256: crate::util::encode_hex_lower(Sha256::digest(text.as_bytes())),
        },
    )?;

    Ok(CloudResponse {
        text,
        provider: provider_label.into(),
        model: returned_model,
        response_id,
        input_tokens,
        output_tokens,
        working_memory: None,
        working_memory_error: None,
        conversation_history: None,
        conversation_history_error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn gemma_only_accepts_the_installed_model_and_standard_response() {
        let mut request = valid_cloud_request("llamacpp");
        assert!(validate_cloud_request(&request).is_err());
        request.model = crate::local_inference::GEMMA_MODEL.into();
        assert!(validate_cloud_request(&request).is_ok());
        assert_eq!(
            extract_cloud_response_text(
                "llamacpp",
                &serde_json::json!({"choices":[{"message":{"content":"texto visible"}}]})
            ),
            "texto visible"
        );
        assert_eq!(
            returned_model_name(
                "llamacpp",
                crate::local_inference::GEMMA_MODEL,
                &serde_json::json!({"model":"D:/ruta/privada/modelo.gguf"})
            ),
            crate::local_inference::GEMMA_MODEL
        );
    }

    #[test]
    fn system_prompt_requires_provenance_for_unverified_external_facts() {
        for required in [
            "Conocimiento interno no verificado:",
            "no son fuentes ni hechos verificados",
            "instituciones o ubicaciones como comprobados",
        ] {
            assert!(SYSTEM_PROMPT.contains(required));
        }
    }

    #[test]
    fn system_prompt_describes_delegated_learning_without_claiming_writes() {
        for required in [
            "evalúa automáticamente los nuevos mensajes",
            "No afirmes que algo ya fue guardado o aprendido sin un resultado real",
            "revisarlo o corregirlo en Memoria",
            "no le exijas confirmar cada recuerdo",
        ] {
            assert!(SYSTEM_PROMPT.contains(required));
        }
    }

    #[test]
    fn conversational_style_respects_context_and_perception_limits() {
        for required in [
            "no a palabras emocionales aisladas",
            "Retoma uno o dos detalles concretos",
            "no cambies una charla personal hacia proyectos",
            "no preguntes por obligación",
            "cita, ficción, negación",
            "sin optimismo forzado",
            "sin convertirlo en una tarea",
            "No asegures saber cómo se siente",
            "no afirmes haber oído su entonación",
            "la aplicación controla la interpretación de voz por separado",
        ] {
            assert!(SYSTEM_PROMPT.contains(required));
        }
    }

    #[test]
    fn greeting_style_requires_a_direct_salutation_in_the_current_message() {
        for text in ["Hola, Alice", "¡HOLA!", "  Hola. Quiero seguir mejorándote"] {
            assert!(is_direct_greeting(text));
        }
        for text in [
            "Mi hermana dijo hola",
            "\"Hola Alice\" fue lo que dije",
            "Holanda",
            "Quiero mejorar mi programa",
        ] {
            assert!(!is_direct_greeting(text));
        }
    }

    #[test]
    fn gemma_provenance_notice_is_enforced_once_by_the_backend() {
        assert_eq!(
            apply_response_provenance("llamacpp", "Respuesta del modelo".into()),
            "Conocimiento interno no verificado:\n\nRespuesta del modelo"
        );
        assert_eq!(
            apply_response_provenance(
                "llamacpp",
                "Conocimiento interno no verificado:\n\nRespuesta".into()
            ),
            "Conocimiento interno no verificado:\n\nRespuesta"
        );
        assert_eq!(
            apply_response_provenance("ollama", "Respuesta".into()),
            "Respuesta"
        );
    }

    fn valid_cloud_request(provider: &str) -> CloudRequest {
        CloudRequest {
            vision: None,
            voice_session_id: None,
            message: "Hola".into(),
            payload: "MENSAJE ACTUAL\nHola".into(),
            provider: provider.into(),
            model: if provider == "google" {
                "gemini-test".into()
            } else {
                "provider/model-test".into()
            },
            history_count: 0,
            memory_count: 0,
        }
    }

    #[test]
    fn explicit_reference_response_is_local_and_other_requests_keep_their_provider() {
        let mut request = valid_cloud_request("llamacpp");
        request.message =
            "Mi hermano me dijo: «Quiero mejorar tu forma de explicar». ¿De quién estaba hablando?"
                .into();
        let response = direct_reference_response(&request).unwrap();
        assert!(response.text.contains("tu forma de explicar, Carlos"));
        assert_eq!(response.provider, "Referencia explícita del mensaje");
        assert_eq!(response.input_tokens, 0);
        assert_eq!(response.output_tokens, 0);
        assert!(response.response_id.starts_with("reference:"));
        assert!(response.conversation_history.is_none());
        request.provider = "ollama".into();
        assert!(direct_reference_response(&request).is_none());
        request.provider = "llamacpp".into();
        request.message = "Hola Alice, quiero mejorar tu conversación".into();
        assert!(direct_reference_response(&request).is_none());
    }

    #[test]
    fn cloud_provider_registry_exposes_supported_adapters() {
        let ids = cloud_status()
            .providers
            .into_iter()
            .map(|provider| provider.id)
            .collect::<Vec<_>>();
        assert_eq!(
            ids,
            vec![
                "ollama",
                "llamacpp",
                "openai",
                "anthropic",
                "google",
                "xai",
                "compatible"
            ]
        );
    }

    #[test]
    fn capability_probe_only_summarizes_provider_configuration() {
        let probe = cloud_capability_probe();

        assert_eq!(probe.provider_count, 7);
        assert!(probe.configured_provider_count <= probe.provider_count);
    }

    #[test]
    fn cloud_request_accepts_frontend_camel_case_contract() {
        let request: CloudRequest = serde_json::from_value(serde_json::json!({
            "message": "Hola",
            "payload": "MENSAJE ACTUAL\nHola",
            "provider": "anthropic",
            "model": "claude-model-id",
            "historyCount": 2,
            "memoryCount": 1
        }))
        .expect("deserialize cloud request");
        assert_eq!(request.provider, "anthropic");
        assert_eq!(request.history_count, 2);
        assert_eq!(request.memory_count, 1);
    }

    #[test]
    fn cloud_request_validation_rejects_unsafe_or_unknown_values() {
        assert_eq!(
            validate_cloud_request(&valid_cloud_request("openrouter")),
            Err("OpenRouter está pausado; Alice usa Ollama local por ahora".into())
        );

        let mut empty = valid_cloud_request("openai");
        empty.message = "   ".into();
        assert_eq!(
            validate_cloud_request(&empty),
            Err("El mensaje está vacío".into())
        );

        let mut invalid_model = valid_cloud_request("anthropic");
        invalid_model.model = "modelo con espacios".into();
        assert_eq!(
            validate_cloud_request(&invalid_model),
            Err("El identificador del modelo no es válido".into())
        );

        let unknown = valid_cloud_request("desconocido");
        assert_eq!(
            validate_cloud_request(&unknown),
            Err("El proveedor seleccionado no está registrado en Alice".into())
        );

        let mut google_path = valid_cloud_request("google");
        google_path.model = "models/gemini-test".into();
        assert_eq!(
            validate_cloud_request(&google_path),
            Err("El modelo de Google no puede contener '/' ni ':'".into())
        );
    }

    #[test]
    fn passive_compatible_probe_distinguishes_invalid_configuration() {
        assert!(validate_compatible_probe_url("https://local.example/v1").is_ok());
        assert!(validate_compatible_probe_url("http://local.example/v1").is_err());
        assert!(validate_compatible_probe_url("https://local.example/v1?key=private").is_err());
    }

    #[test]
    fn responses_api_text_parser_joins_only_output_text_blocks() {
        let response = serde_json::json!({
            "output": [{
                "content": [
                    { "type": "output_text", "text": "Primera parte" },
                    { "type": "tool_call", "name": "ignorar" },
                    { "type": "output_text", "text": "Segunda parte" }
                ]
            }]
        });
        assert_eq!(
            extract_cloud_response_text("openai", &response),
            "Primera parte\nSegunda parte"
        );
        assert_eq!(
            extract_cloud_response_text("xai", &response),
            "Primera parte\nSegunda parte"
        );
    }

    #[test]
    fn anthropic_text_parser_ignores_non_text_blocks() {
        let response = serde_json::json!({
            "content": [
                { "type": "thinking", "thinking": "privado" },
                { "type": "text", "text": "Respuesta visible" }
            ]
        });
        assert_eq!(
            extract_cloud_response_text("anthropic", &response),
            "Respuesta visible"
        );
    }

    #[test]
    fn google_text_parser_joins_candidate_parts() {
        let response = serde_json::json!({
            "candidates": [{
                "content": { "parts": [{ "text": "Hola" }, { "text": "Carlos Nuñez" }] }
            }]
        });
        assert_eq!(
            extract_cloud_response_text("google", &response),
            "Hola\nCarlos Nuñez"
        );
    }

    #[test]
    fn chat_completions_parser_reads_openrouter_and_compatible() {
        let response = serde_json::json!({
            "choices": [{ "message": { "content": "Respuesta del modelo" } }]
        });
        assert_eq!(
            extract_cloud_response_text("openrouter", &response),
            "Respuesta del modelo"
        );
        assert_eq!(
            extract_cloud_response_text("compatible", &response),
            "Respuesta del modelo"
        );
    }

    #[test]
    fn ollama_adapter_is_fixed_to_loopback_and_disables_streaming_and_thinking() {
        let request = valid_cloud_request("ollama");
        let body = ollama_chat_body(&request);

        assert_eq!(
            OLLAMA_LOCAL_CHAT_ENDPOINT,
            "http://127.0.0.1:11434/api/chat"
        );
        assert_eq!(body.pointer("/stream"), Some(&serde_json::json!(false)));
        assert_eq!(body.pointer("/think"), Some(&serde_json::json!(false)));
        assert_eq!(
            body.pointer("/options/num_ctx"),
            Some(&serde_json::json!(4096))
        );
        assert_eq!(
            body.pointer("/options/num_predict"),
            Some(&serde_json::json!(900))
        );
        assert_eq!(
            body.pointer("/options/temperature"),
            Some(&serde_json::json!(0.2))
        );
    }

    #[test]
    fn ollama_adapter_rejects_cloud_model_identifiers() {
        for model in ["glm-5:cloud", "gpt-oss:120b-cloud"] {
            let mut request = valid_cloud_request("ollama");
            request.model = model.into();
            assert_eq!(
                validate_cloud_request(&request),
                Err(
                    "Alice sólo admite modelos Ollama locales; los modelos cloud están bloqueados"
                        .into()
                )
            );
        }

        let mut local = valid_cloud_request("ollama");
        local.model = "qwen3.5:4b".into();
        assert!(validate_cloud_request(&local).is_ok());
    }

    #[test]
    fn ollama_parser_reads_only_visible_message_content() {
        let response = serde_json::json!({
            "message": {
                "role": "assistant",
                "content": "Respuesta local real",
                "thinking": "no exponer"
            },
            "prompt_eval_count": 21,
            "eval_count": 8
        });

        assert_eq!(
            extract_cloud_response_text("ollama", &response),
            "Respuesta local real"
        );
    }
}
