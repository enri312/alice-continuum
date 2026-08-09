use crate::util::{alice_data_root, timestamp_ms};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::Duration;
use tauri::AppHandle;

const SYSTEM_PROMPT: &str = "Eres Alice, la asistente personal de Carlos Nuñez. Responde en español claro y natural. Ayúdalo a aprender, investigar y avanzar, sin afirmar que realizaste acciones que no ejecutaste. No tienes herramientas en esta etapa. Pide aprobación antes de cualquier acción externa, destructiva, costosa o que amplíe el alcance.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudStatus {
    providers: Vec<CloudProvider>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct CloudCapabilityProbe {
    pub(crate) provider_count: usize,
    pub(crate) configured_provider_count: usize,
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
    CloudStatus {
        providers: vec![
            CloudProvider {
                id: "openrouter".into(),
                label: "OpenRouter".into(),
                configured: has("OPENROUTER_API_KEY"),
                default_model: value("OPENROUTER_MODEL", "openrouter/free"),
                protocol: "Chat Completions · router gratuito".into(),
                retention_mode: "según OpenRouter y el proveedor enrutado".into(),
            },
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
        ],
    }
}

pub(crate) fn cloud_capability_probe() -> CloudCapabilityProbe {
    let status = cloud_status();
    CloudCapabilityProbe {
        provider_count: status.providers.len(),
        configured_provider_count: status
            .providers
            .iter()
            .filter(|provider| provider.configured)
            .count(),
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
        "openrouter" | "openai" | "anthropic" | "google" | "xai" | "compatible"
    ) {
        return Err("El proveedor seleccionado no está registrado en Alice".into());
    }
    if request.provider == "google" && (request.model.contains('/') || request.model.contains(':'))
    {
        return Err("El modelo de Google no puede contener '/' ni ':'".into());
    }
    Ok(())
}

fn extract_cloud_response_text(provider: &str, value: &serde_json::Value) -> String {
    match provider {
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
        "openrouter" | "compatible" => value
            .pointer("/choices/0/message/content")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

#[tauri::command]
pub(crate) async fn send_cloud_message(
    app: AppHandle,
    request: CloudRequest,
) -> Result<CloudResponse, String> {
    validate_cloud_request(&request)?;

    let required_key = |name: &str| {
        std::env::var(name)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| format!("Falta la variable de entorno {name}"))
    };
    let client = reqwest::Client::new();
    let (provider_label, response) = match request.provider.as_str() {
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
            if !base_url.starts_with("https://") || base_url.contains('?') || base_url.contains('#')
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
    let response =
        response.map_err(|error| format!("No se pudo conectar con {provider_label}: {error}"))?;
    let status = response.status();
    let value: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("{provider_label} devolvió una respuesta no válida: {error}"))?;
    if !status.is_success() {
        let message = value
            .pointer("/error/message")
            .and_then(|item| item.as_str())
            .unwrap_or("La solicitud fue rechazada por el proveedor");
        return Err(format!("{provider_label} ({status}): {message}"));
    }

    let text = extract_cloud_response_text(&request.provider, &value);
    if text.trim().is_empty() {
        return Err(format!("{provider_label} no devolvió texto para mostrar"));
    }

    let response_id = value
        .get(if request.provider == "google" {
            "responseId"
        } else {
            "id"
        })
        .and_then(|item| item.as_str())
        .unwrap_or("sin-id")
        .to_string();
    let returned_model = value
        .get(if request.provider == "google" {
            "modelVersion"
        } else {
            "model"
        })
        .and_then(|item| item.as_str())
        .unwrap_or(&request.model)
        .to_string();
    let (input_pointer, output_pointer) = match request.provider.as_str() {
        "google" => (
            "/usageMetadata/promptTokenCount",
            "/usageMetadata/candidatesTokenCount",
        ),
        "openrouter" | "compatible" => ("/usage/prompt_tokens", "/usage/completion_tokens"),
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
        &app,
        &CloudAuditEntry {
            timestamp_ms: timestamp_ms()?,
            provider: provider_label.into(),
            model: returned_model.clone(),
            response_id: response_id.clone(),
            history_count: request.history_count,
            memory_count: request.memory_count,
            input_tokens,
            output_tokens,
            request_sha256: format!("{:x}", Sha256::digest(request.payload.as_bytes())),
            response_sha256: format!("{:x}", Sha256::digest(text.as_bytes())),
        },
    )?;

    Ok(CloudResponse {
        text,
        provider: provider_label.into(),
        model: returned_model,
        response_id,
        input_tokens,
        output_tokens,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_cloud_request(provider: &str) -> CloudRequest {
        CloudRequest {
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
    fn cloud_provider_registry_exposes_supported_adapters() {
        let ids = cloud_status()
            .providers
            .into_iter()
            .map(|provider| provider.id)
            .collect::<Vec<_>>();
        assert_eq!(
            ids,
            vec![
                "openrouter",
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

        assert_eq!(probe.provider_count, 6);
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
        assert!(validate_cloud_request(&valid_cloud_request("openrouter")).is_ok());

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
}
