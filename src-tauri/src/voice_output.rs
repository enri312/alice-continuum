use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use crate::conversation_history::verified_conversation_exchange_at;
use crate::util::{alice_data_root_path, encode_hex_lower};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use uuid::Uuid;

const FISH_TTS_ENDPOINT: &str = "https://api.fish.audio/v1/tts";
const FISH_MODEL: &str = "s2.1-pro-free";
const MAX_TEXT_CHARACTERS: usize = 1_500;
const MAX_AUDIO_BYTES: u64 = 12 * 1024 * 1024;
const PREVIEW_TTL: Duration = Duration::from_secs(10 * 60);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const SYNTHESIS_TIMEOUT: Duration = Duration::from_secs(240);

#[derive(Clone, Default)]
pub(crate) struct VoiceOutputStore {
    pending: Arc<Mutex<Option<VoiceOutputRequest>>>,
}

#[derive(Clone, Debug)]
struct VoiceOutputRequest {
    request_id: String,
    text: String,
    text_sha256: String,
    character_count: usize,
    created_at: Instant,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum VoiceConfiguration {
    Ready,
    MissingApiKey,
    MissingVoiceProfile,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VoicePreviewInput {
    exchange_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VoiceConfirmationInput {
    request_id: String,
    confirmed: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct VoiceCancellationInput {
    request_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VoiceOutputPreview {
    request_id: String,
    exchange_id: String,
    text_sha256: String,
    character_count: usize,
    character_limit: usize,
    provider: &'static str,
    model: &'static str,
    configuration: VoiceConfiguration,
    can_confirm: bool,
    ephemeral: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VoiceOutputResult {
    request_id: String,
    mime_type: &'static str,
    audio_base64: String,
    character_count: usize,
    duration_ms: u64,
    ephemeral: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VoiceCancellationResult {
    request_id: String,
    cancelled: bool,
}

fn voice_configuration() -> VoiceConfiguration {
    if std::env::var("FISH_API_KEY")
        .map(|value| value.trim().is_empty())
        .unwrap_or(true)
    {
        return VoiceConfiguration::MissingApiKey;
    }
    if std::env::var("ALICE_FISH_REFERENCE_ID")
        .ok()
        .filter(|value| valid_voice_profile(value.trim()))
        .is_none()
    {
        return VoiceConfiguration::MissingVoiceProfile;
    }
    VoiceConfiguration::Ready
}

fn valid_voice_profile(value: &str) -> bool {
    (8..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn text_digest(text: &str) -> String {
    format!(
        "sha256:{}",
        encode_hex_lower(Sha256::digest(text.as_bytes()))
    )
}

fn valid_request_id(value: &str) -> Result<(), String> {
    let parsed = Uuid::parse_str(value).map_err(|_| "requestId no es UUID".to_string())?;
    if parsed.get_version() != Some(uuid::Version::Random) || parsed.to_string() != value {
        return Err("requestId debe ser UUID v4 canónico".into());
    }
    Ok(())
}

fn record_voice_audit(
    app: &AppHandle,
    operation_id: String,
    operation: &str,
    stage: AuditStage,
    outcome: AuditOutcome,
    duration_ms: Option<u64>,
    subject_digest: Option<String>,
    reason: &str,
) -> Result<(), String> {
    record_producer_audit(
        app,
        operation_id,
        AuditSource::Cloud,
        "output.voice.synthesize".into(),
        operation.into(),
        stage,
        outcome,
        duration_ms,
        subject_digest,
        reason,
    )
}

fn safe_duration(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis())
        .unwrap_or(86_400_000)
        .min(86_400_000)
}

fn take_pending(store: &VoiceOutputStore, request_id: &str) -> Result<VoiceOutputRequest, String> {
    valid_request_id(request_id)?;
    let mut pending = store
        .pending
        .lock()
        .map_err(|_| "El puente de voz quedó bloqueado".to_string())?;
    let request = pending
        .take()
        .ok_or("No existe una vista previa de voz pendiente")?;
    if request.request_id != request_id {
        *pending = Some(request);
        return Err("La vista previa de voz ya no coincide con esta confirmación".into());
    }
    if request.created_at.elapsed() > PREVIEW_TTL {
        return Err(
            "La vista previa de voz venció; revisá de nuevo el texto antes de enviarlo".into(),
        );
    }
    Ok(request)
}

#[tauri::command]
pub(crate) fn preview_voice_output(
    app: AppHandle,
    state: State<'_, VoiceOutputStore>,
    input: VoicePreviewInput,
) -> Result<VoiceOutputPreview, String> {
    let data_root = alice_data_root_path(&app)?;
    let exchange = verified_conversation_exchange_at(&data_root, &input.exchange_id)?;
    let text = exchange.assistant_text.trim().to_string();
    let character_count = text.chars().count();
    if character_count == 0 {
        return Err("La respuesta seleccionada no contiene texto para convertir a voz".into());
    }
    if character_count > MAX_TEXT_CHARACTERS {
        return Err(format!(
            "La respuesta tiene {character_count} caracteres y el puente de voz admite hasta {MAX_TEXT_CHARACTERS}; pedí una respuesta más breve"
        ));
    }
    let request_id = Uuid::new_v4().to_string();
    let digest = text_digest(&text);
    let configuration = voice_configuration();
    let can_confirm = matches!(configuration, VoiceConfiguration::Ready);
    let operation_id = new_operation_id();
    record_voice_audit(
        &app,
        operation_id.clone(),
        "voice.output.preview",
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(digest.clone()),
        "VOICE_PREVIEW_REQUESTED",
    )?;
    let mut pending = state
        .pending
        .lock()
        .map_err(|_| "El puente de voz quedó bloqueado".to_string())?;
    *pending = Some(VoiceOutputRequest {
        request_id: request_id.clone(),
        text,
        text_sha256: digest.clone(),
        character_count,
        created_at: Instant::now(),
    });
    record_voice_audit(
        &app,
        operation_id,
        "voice.output.preview",
        AuditStage::Execution,
        AuditOutcome::Success,
        None,
        Some(digest.clone()),
        if can_confirm {
            "VOICE_PREVIEW_READY"
        } else {
            "VOICE_PREVIEW_CONFIGURATION_MISSING"
        },
    )?;
    Ok(VoiceOutputPreview {
        request_id,
        exchange_id: input.exchange_id,
        text_sha256: digest,
        character_count,
        character_limit: MAX_TEXT_CHARACTERS,
        provider: "fish-audio",
        model: FISH_MODEL,
        configuration,
        can_confirm,
        ephemeral: true,
    })
}

#[tauri::command]
pub(crate) fn cancel_voice_output(
    app: AppHandle,
    state: State<'_, VoiceOutputStore>,
    input: VoiceCancellationInput,
) -> Result<VoiceCancellationResult, String> {
    let request = take_pending(&state, &input.request_id)?;
    record_voice_audit(
        &app,
        new_operation_id(),
        "voice.output.preview",
        AuditStage::Stop,
        AuditOutcome::Success,
        None,
        Some(request.text_sha256),
        "VOICE_PREVIEW_CANCELLED",
    )?;
    Ok(VoiceCancellationResult {
        request_id: request.request_id,
        cancelled: true,
    })
}

#[tauri::command]
pub(crate) async fn confirm_voice_output(
    app: AppHandle,
    state: State<'_, VoiceOutputStore>,
    input: VoiceConfirmationInput,
) -> Result<VoiceOutputResult, String> {
    if !input.confirmed {
        return Err("La síntesis de voz requiere una confirmación explícita".into());
    }
    if !matches!(voice_configuration(), VoiceConfiguration::Ready) {
        return Err(
            "Fish Audio no está configurado en este proceso; revisá la clave y la voz local".into(),
        );
    }
    let request = take_pending(&state, &input.request_id)?;
    let api_key = std::env::var("FISH_API_KEY")
        .map_err(|_| "No se encontró la clave de Fish Audio en este proceso".to_string())?;
    let reference_id = std::env::var("ALICE_FISH_REFERENCE_ID")
        .map_err(|_| "No se encontró una voz de Fish Audio configurada localmente".to_string())?;
    if !valid_voice_profile(reference_id.trim()) {
        return Err("La voz configurada localmente no tiene un formato aceptado".into());
    }
    let operation_id = new_operation_id();
    record_voice_audit(
        &app,
        operation_id.clone(),
        "voice.output.synthesize",
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(request.text_sha256.clone()),
        "VOICE_SYNTHESIS_AUTHORIZED",
    )?;
    let started = Instant::now();
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(SYNTHESIS_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "No se pudo preparar la conexión de voz".to_string())?;
    let response = client
        .post(FISH_TTS_ENDPOINT)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {api_key}"))
        .header("model", FISH_MODEL)
        .json(&serde_json::json!({
            "text": request.text,
            "reference_id": reference_id.trim(),
            "format": "mp3",
            "temperature": 0.45,
            "normalize": true,
        }))
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let timed_out = error.is_timeout();
            let _ = record_voice_audit(
                &app,
                operation_id,
                "voice.output.synthesize",
                AuditStage::Error,
                AuditOutcome::Error,
                Some(safe_duration(started)),
                Some(request.text_sha256),
                if timed_out {
                    "VOICE_SYNTHESIS_REQUEST_TIMEOUT"
                } else {
                    "VOICE_SYNTHESIS_NETWORK_ERROR"
                },
            );
            return Err(if timed_out {
                "Fish Audio tardó más de 240 segundos en responder; no se repetirá la solicitud automáticamente"
            } else {
                "Fish Audio no respondió. Revisá tu conexión e intentá de nuevo cuando quieras"
            }
            .into());
        }
    };
    if !response.status().is_success() {
        let reason = match response.status().as_u16() {
            401 | 403 => "VOICE_SYNTHESIS_CREDENTIAL_REJECTED",
            402 => "VOICE_SYNTHESIS_CREDITS_REQUIRED",
            429 => "VOICE_SYNTHESIS_RATE_LIMITED",
            _ => "VOICE_SYNTHESIS_PROVIDER_ERROR",
        };
        let message = match response.status().as_u16() {
            401 | 403 => {
                "Fish Audio rechazó la credencial; verificá la variable local sin pegarla en Alice."
            }
            402 => "Fish Audio informó que faltan créditos para generar este audio.",
            429 => "Fish Audio pidió esperar antes de generar otra voz.",
            _ => "Fish Audio no pudo generar el audio en este momento.",
        };
        let _ = record_voice_audit(
            &app,
            operation_id,
            "voice.output.synthesize",
            AuditStage::Error,
            AuditOutcome::Error,
            Some(safe_duration(started)),
            Some(request.text_sha256),
            reason,
        );
        return Err(message.into());
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_AUDIO_BYTES)
    {
        let _ = record_voice_audit(
            &app,
            operation_id,
            "voice.output.synthesize",
            AuditStage::Error,
            AuditOutcome::Error,
            Some(safe_duration(started)),
            Some(request.text_sha256),
            "VOICE_SYNTHESIS_AUDIO_LIMIT_EXCEEDED",
        );
        return Err("Fish Audio devolvió un audio mayor al límite local y fue descartado".into());
    }
    let audio = match response.bytes().await {
        Ok(audio) if !audio.is_empty() && audio.len() <= MAX_AUDIO_BYTES as usize => audio,
        Ok(_) => {
            let _ = record_voice_audit(
                &app,
                operation_id,
                "voice.output.synthesize",
                AuditStage::Error,
                AuditOutcome::Error,
                Some(safe_duration(started)),
                Some(request.text_sha256),
                "VOICE_SYNTHESIS_AUDIO_LIMIT_EXCEEDED",
            );
            return Err(
                "El audio recibido no es válido o superó el límite local y fue descartado".into(),
            );
        }
        Err(error) => {
            let timed_out = error.is_timeout();
            let _ = record_voice_audit(
                &app,
                operation_id,
                "voice.output.synthesize",
                AuditStage::Error,
                AuditOutcome::Error,
                Some(safe_duration(started)),
                Some(request.text_sha256),
                if timed_out {
                    "VOICE_SYNTHESIS_DELIVERY_TIMEOUT"
                } else {
                    "VOICE_SYNTHESIS_RESPONSE_ERROR"
                },
            );
            return Err(if timed_out {
                "Fish Audio tardó más de 240 segundos; el audio incompleto fue descartado"
            } else {
                "Fish Audio interrumpió la entrega del audio; el resultado incompleto fue descartado"
            }
            .into());
        }
    };
    let duration_ms = safe_duration(started);
    record_voice_audit(
        &app,
        operation_id,
        "voice.output.synthesize",
        AuditStage::Execution,
        AuditOutcome::Success,
        Some(duration_ms),
        Some(request.text_sha256),
        "VOICE_SYNTHESIS_COMPLETED",
    )?;
    Ok(VoiceOutputResult {
        request_id: request.request_id,
        mime_type: "audio/mpeg",
        audio_base64: base64::engine::general_purpose::STANDARD.encode(audio),
        character_count: request.character_count,
        duration_ms,
        ephemeral: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voice_profile_is_an_opaque_safe_identifier() {
        assert!(valid_voice_profile("0123456789abcdef0123456789abcdef"));
        assert!(valid_voice_profile("alice_voice-profile_2026"));
        assert!(!valid_voice_profile("voice with spaces"));
        assert!(!valid_voice_profile("short"));
    }

    #[test]
    fn digest_does_not_contain_the_source_text() {
        let digest = text_digest("texto privado de prueba");
        assert!(digest.starts_with("sha256:"));
        assert!(!digest.contains("privado"));
        assert_eq!(digest.len(), 71);
    }

    #[test]
    fn canonical_request_ids_are_required() {
        assert!(valid_request_id("123e4567-e89b-42d3-a456-426614174000").is_ok());
        assert!(valid_request_id("123e4567-e89b-12d3-a456-426614174000").is_err());
    }
}
