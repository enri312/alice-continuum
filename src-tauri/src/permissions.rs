use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub(crate) const PERMISSION_GATEWAY_SCHEMA_VERSION: u32 = 1;
pub(crate) const HIGH_RISK_DECISION_TTL_SECONDS: u64 = 60;
pub(crate) const STANDARD_DECISION_TTL_SECONDS: u64 = 300;
pub(crate) const MAX_SESSION_DURATION_SECONDS: u32 = 300;

const MAX_ID_LENGTH: usize = 128;
const MAX_OPERATION_LENGTH: usize = 96;
const MAX_PURPOSE_LENGTH: usize = 280;
const MAX_SUMMARY_LENGTH: usize = 320;
const MAX_WARNING_LENGTH: usize = 240;
const MAX_RESOURCE_LABEL_LENGTH: usize = 160;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PreparedPermissionRequest {
    pub(crate) schema_version: u32,
    pub(crate) request_id: String,
    pub(crate) idempotency_key: String,
    pub(crate) capability_id: String,
    pub(crate) capability_version: u32,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) purpose: String,
    pub(crate) resource: PermissionResource,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) effects: Vec<PermissionEffect>,
    pub(crate) risk: PermissionRisk,
    pub(crate) created_at: String,
    pub(crate) decision_expires_at: String,
    pub(crate) requested_duration_seconds: Option<u32>,
    pub(crate) maximum_duration_seconds: Option<u32>,
    pub(crate) preview_digest: String,
    pub(crate) state: PermissionRequestState,
    pub(crate) summary: String,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionRequestDraft {
    pub(crate) schema_version: u32,
    pub(crate) request_id: String,
    pub(crate) idempotency_key: String,
    pub(crate) capability_id: String,
    pub(crate) capability_version: u32,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) purpose: String,
    pub(crate) resource: PermissionResource,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) effects: Vec<PermissionEffect>,
    pub(crate) risk: PermissionRisk,
    pub(crate) created_at: String,
    pub(crate) decision_expires_at: String,
    pub(crate) requested_duration_seconds: Option<u32>,
    pub(crate) maximum_duration_seconds: Option<u32>,
    pub(crate) summary: String,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionResource {
    pub(crate) kind: PermissionResourceKind,
    pub(crate) stable_id: String,
    pub(crate) label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionDecisionInput {
    pub(crate) request_id: String,
    pub(crate) preview_digest: String,
    pub(crate) decision: PermissionDecision,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PermissionGrant {
    pub(crate) schema_version: u32,
    pub(crate) grant_id: String,
    pub(crate) request_id: String,
    pub(crate) preview_digest: String,
    pub(crate) capability_id: String,
    pub(crate) operation: String,
    pub(crate) mode: PermissionMode,
    pub(crate) issued_at: String,
    pub(crate) expires_at: String,
    pub(crate) remaining_uses: Option<u32>,
    pub(crate) state: PermissionGrantState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionMode {
    ImplicitRead,
    OneShot,
    Session,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionRisk {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionEffect {
    None,
    LocalRead,
    LocalWrite,
    NetworkSend,
    ProcessLaunch,
    WindowMetadataRead,
    CameraObserve,
    MicrophoneObserve,
    ScreenObserve,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionResourceKind {
    Camera,
    Microphone,
    Screen,
    File,
    Directory,
    NetworkEndpoint,
    Process,
    Window,
    Memory,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionRequestState {
    AwaitingDecision,
    Approved,
    Denied,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionDecision {
    Approve,
    Deny,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PermissionGrantState {
    Approved,
    Consuming,
    Completed,
    Error,
    Active,
    Stopped,
    Revoked,
    Expired,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalPermissionPreview<'a> {
    schema_version: u32,
    request_id: &'a str,
    idempotency_key: &'a str,
    capability_id: &'a str,
    capability_version: u32,
    operation: &'a str,
    mode: PermissionMode,
    purpose: &'a str,
    resource: &'a PermissionResource,
    data_scopes: &'a [String],
    effects: &'a [PermissionEffect],
    risk: PermissionRisk,
    created_at: &'a str,
    decision_expires_at: &'a str,
    requested_duration_seconds: Option<u32>,
    maximum_duration_seconds: Option<u32>,
    summary: &'a str,
    warnings: &'a [String],
}

impl PreparedPermissionRequest {
    pub(crate) fn from_draft(draft: PermissionRequestDraft) -> Result<Self, String> {
        let mut request = Self {
            schema_version: draft.schema_version,
            request_id: draft.request_id,
            idempotency_key: draft.idempotency_key,
            capability_id: draft.capability_id,
            capability_version: draft.capability_version,
            operation: draft.operation,
            mode: draft.mode,
            purpose: draft.purpose,
            resource: draft.resource,
            data_scopes: draft.data_scopes,
            effects: draft.effects,
            risk: draft.risk,
            created_at: draft.created_at,
            decision_expires_at: draft.decision_expires_at,
            requested_duration_seconds: draft.requested_duration_seconds,
            maximum_duration_seconds: draft.maximum_duration_seconds,
            preview_digest: String::new(),
            state: PermissionRequestState::AwaitingDecision,
            summary: draft.summary,
            warnings: draft.warnings,
        };

        request.validate_without_digest()?;
        request.preview_digest = request.compute_preview_digest()?;
        request.validate()?;
        Ok(request)
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        self.validate_without_digest()?;
        validate_digest(&self.preview_digest)?;
        let expected = self.compute_preview_digest()?;
        if self.preview_digest != expected {
            return Err("El digest no coincide con la previsualización preparada".into());
        }
        Ok(())
    }

    pub(crate) fn canonical_preview_json(&self) -> Result<String, String> {
        serde_json::to_string(&self.canonical_preview()).map_err(|error| error.to_string())
    }

    fn compute_preview_digest(&self) -> Result<String, String> {
        let bytes =
            serde_json::to_vec(&self.canonical_preview()).map_err(|error| error.to_string())?;
        let digest = Sha256::digest(bytes);
        Ok(format!("sha256:{}", encode_hex(&digest)))
    }

    fn canonical_preview(&self) -> CanonicalPermissionPreview<'_> {
        CanonicalPermissionPreview {
            schema_version: self.schema_version,
            request_id: &self.request_id,
            idempotency_key: &self.idempotency_key,
            capability_id: &self.capability_id,
            capability_version: self.capability_version,
            operation: &self.operation,
            mode: self.mode,
            purpose: &self.purpose,
            resource: &self.resource,
            data_scopes: &self.data_scopes,
            effects: &self.effects,
            risk: self.risk,
            created_at: &self.created_at,
            decision_expires_at: &self.decision_expires_at,
            requested_duration_seconds: self.requested_duration_seconds,
            maximum_duration_seconds: self.maximum_duration_seconds,
            summary: &self.summary,
            warnings: &self.warnings,
        }
    }

    fn validate_without_digest(&self) -> Result<(), String> {
        validate_schema(self.schema_version)?;
        validate_opaque_id("requestId", &self.request_id)?;
        validate_opaque_id("idempotencyKey", &self.idempotency_key)?;
        validate_capability_id(&self.capability_id)?;
        if self.capability_version == 0 {
            return Err("capabilityVersion debe ser positiva".into());
        }
        validate_identifier("operation", &self.operation, MAX_OPERATION_LENGTH)?;
        validate_text("purpose", &self.purpose, MAX_PURPOSE_LENGTH)?;
        self.resource.validate()?;
        validate_identifier_list("dataScopes", &self.data_scopes, true)?;
        validate_effects(&self.effects)?;
        validate_text("summary", &self.summary, MAX_SUMMARY_LENGTH)?;
        validate_text_list("warnings", &self.warnings, MAX_WARNING_LENGTH)?;

        if self.state != PermissionRequestState::AwaitingDecision {
            return Err("Una solicitud preparada debe estar awaitingDecision".into());
        }
        if self.mode == PermissionMode::ImplicitRead {
            return Err("implicitRead no crea solicitudes ni grants en R2".into());
        }

        let created = parse_utc_timestamp("createdAt", &self.created_at)?;
        let expires = parse_utc_timestamp("decisionExpiresAt", &self.decision_expires_at)?;
        validate_positive_ttl(
            "decisionExpiresAt",
            created,
            expires,
            self.risk.decision_ttl_seconds(),
        )?;

        match self.mode {
            PermissionMode::Session => {
                let requested = self
                    .requested_duration_seconds
                    .ok_or_else(|| "Una sesión requiere requestedDurationSeconds".to_string())?;
                let maximum = self
                    .maximum_duration_seconds
                    .ok_or_else(|| "Una sesión requiere maximumDurationSeconds".to_string())?;
                if requested == 0
                    || maximum == 0
                    || requested > maximum
                    || maximum > MAX_SESSION_DURATION_SECONDS
                {
                    return Err(format!(
                        "La sesión debe solicitar 1..={MAX_SESSION_DURATION_SECONDS} segundos sin superar su máximo"
                    ));
                }
            }
            PermissionMode::OneShot => {
                if self.requested_duration_seconds.is_some()
                    || self.maximum_duration_seconds.is_some()
                {
                    return Err("oneShot no admite duración de sesión".into());
                }
            }
            PermissionMode::ImplicitRead => unreachable!("validated above"),
        }

        self.validate_sensor_rules()
    }

    fn validate_sensor_rules(&self) -> Result<(), String> {
        let expected = match self.resource.kind {
            PermissionResourceKind::Camera => {
                Some((PermissionEffect::CameraObserve, "cameraFrames", "La cámara"))
            }
            PermissionResourceKind::Microphone => Some((
                PermissionEffect::MicrophoneObserve,
                "microphoneAudio",
                "El micrófono",
            )),
            PermissionResourceKind::Screen => Some((
                PermissionEffect::ScreenObserve,
                "screenPixels",
                "La pantalla",
            )),
            _ => None,
        };

        let Some((effect, scope, label)) = expected else {
            return Ok(());
        };
        if self.mode != PermissionMode::Session {
            return Err(format!("{label} requiere mode=session"));
        }
        if !matches!(self.risk, PermissionRisk::High | PermissionRisk::Critical) {
            return Err(format!("{label} requiere riesgo high o critical"));
        }
        if !self.effects.contains(&effect) || !self.data_scopes.iter().any(|value| value == scope) {
            return Err(format!(
                "{label} debe declarar su efecto y alcance de datos específicos"
            ));
        }
        Ok(())
    }
}

impl PermissionRequestDraft {
    pub(crate) fn prepare(self) -> Result<PreparedPermissionRequest, String> {
        PreparedPermissionRequest::from_draft(self)
    }
}

impl PermissionResource {
    fn validate(&self) -> Result<(), String> {
        validate_opaque_id("resource.stableId", &self.stable_id)?;
        validate_text("resource.label", &self.label, MAX_RESOURCE_LABEL_LENGTH)
    }
}

impl PermissionDecisionInput {
    pub(crate) fn validate(&self) -> Result<(), String> {
        validate_opaque_id("requestId", &self.request_id)?;
        validate_digest(&self.preview_digest)
    }
}

impl PermissionGrant {
    pub(crate) fn validate(&self) -> Result<(), String> {
        validate_schema(self.schema_version)?;
        validate_opaque_id("grantId", &self.grant_id)?;
        validate_opaque_id("requestId", &self.request_id)?;
        validate_digest(&self.preview_digest)?;
        validate_capability_id(&self.capability_id)?;
        validate_identifier("operation", &self.operation, MAX_OPERATION_LENGTH)?;
        if self.mode == PermissionMode::ImplicitRead {
            return Err("implicitRead no crea grants en R2".into());
        }

        let issued = parse_utc_timestamp("issuedAt", &self.issued_at)?;
        let expires = parse_utc_timestamp("expiresAt", &self.expires_at)?;
        validate_positive_ttl(
            "expiresAt",
            issued,
            expires,
            u64::from(MAX_SESSION_DURATION_SECONDS),
        )?;

        match self.mode {
            PermissionMode::OneShot => {
                let expected_uses = match self.state {
                    PermissionGrantState::Approved => 1,
                    PermissionGrantState::Consuming
                    | PermissionGrantState::Completed
                    | PermissionGrantState::Error
                    | PermissionGrantState::Revoked
                    | PermissionGrantState::Expired => 0,
                    PermissionGrantState::Active | PermissionGrantState::Stopped => {
                        return Err("Un grant oneShot no puede usar un estado de sesión".into());
                    }
                };
                if self.remaining_uses != Some(expected_uses) {
                    return Err(format!(
                        "El grant oneShot en estado {:?} requiere remainingUses={expected_uses}",
                        self.state
                    ));
                }
            }
            PermissionMode::Session => {
                if self.remaining_uses.is_some() {
                    return Err("Un grant session requiere remainingUses=null".into());
                }
                if matches!(
                    self.state,
                    PermissionGrantState::Consuming | PermissionGrantState::Completed
                ) {
                    return Err("Un grant session no puede usar un estado oneShot".into());
                }
            }
            PermissionMode::ImplicitRead => unreachable!("validated above"),
        }
        Ok(())
    }
}

impl PermissionRisk {
    fn decision_ttl_seconds(self) -> u64 {
        match self {
            Self::High | Self::Critical => HIGH_RISK_DECISION_TTL_SECONDS,
            Self::None | Self::Low | Self::Medium => STANDARD_DECISION_TTL_SECONDS,
        }
    }
}

fn validate_schema(schema_version: u32) -> Result<(), String> {
    if schema_version == PERMISSION_GATEWAY_SCHEMA_VERSION {
        Ok(())
    } else {
        Err(format!(
            "schemaVersion debe ser {PERMISSION_GATEWAY_SCHEMA_VERSION}"
        ))
    }
}

fn validate_opaque_id(field: &str, value: &str) -> Result<(), String> {
    let valid_length = (16..=MAX_ID_LENGTH).contains(&value.len());
    let valid_characters = value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'));
    if valid_length && valid_characters {
        Ok(())
    } else {
        Err(format!(
            "{field} debe ser opaco, ASCII y tener entre 16 y {MAX_ID_LENGTH} caracteres"
        ))
    }
}

fn validate_capability_id(value: &str) -> Result<(), String> {
    let segments: Vec<_> = value.split('.').collect();
    let valid = segments.len() >= 2
        && value.len() <= MAX_ID_LENGTH
        && segments.iter().all(|segment| {
            let mut characters = segment.chars();
            characters
                .next()
                .is_some_and(|first| first.is_ascii_lowercase())
                && characters
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        });
    if valid {
        Ok(())
    } else {
        Err("capabilityId no tiene el formato canónico aprobado".into())
    }
}

fn validate_identifier(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    let mut characters = value.chars();
    let valid = !value.is_empty()
        && value.len() <= maximum
        && characters
            .next()
            .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| character.is_ascii_alphanumeric());
    if valid {
        Ok(())
    } else {
        Err(format!(
            "{field} no tiene un identificador lowerCamelCase válido"
        ))
    }
}

fn validate_identifier_list(field: &str, values: &[String], required: bool) -> Result<(), String> {
    if required && values.is_empty() {
        return Err(format!("{field} requiere al menos un valor"));
    }
    let mut unique = HashSet::with_capacity(values.len());
    for value in values {
        validate_identifier(field, value, MAX_OPERATION_LENGTH)?;
        if !unique.insert(value.as_str()) {
            return Err(format!("{field} no admite valores duplicados"));
        }
    }
    Ok(())
}

fn validate_effects(effects: &[PermissionEffect]) -> Result<(), String> {
    if effects.is_empty() {
        return Err("effects requiere al menos un valor".into());
    }
    let unique: HashSet<_> = effects.iter().copied().collect();
    if unique.len() != effects.len() {
        return Err("effects no admite valores duplicados".into());
    }
    if effects.contains(&PermissionEffect::None) && effects.len() != 1 {
        return Err("El efecto none no puede combinarse con otros efectos".into());
    }
    Ok(())
}

fn validate_text(field: &str, value: &str, maximum: usize) -> Result<(), String> {
    let valid = !value.trim().is_empty()
        && value == value.trim()
        && value.chars().count() <= maximum
        && !value.chars().any(char::is_control);
    if valid {
        Ok(())
    } else {
        Err(format!(
            "{field} debe contener texto limpio de 1 a {maximum} caracteres"
        ))
    }
}

fn validate_text_list(field: &str, values: &[String], maximum: usize) -> Result<(), String> {
    let mut unique = HashSet::with_capacity(values.len());
    for value in values {
        validate_text(field, value, maximum)?;
        if !unique.insert(value.as_str()) {
            return Err(format!("{field} no admite valores duplicados"));
        }
    }
    Ok(())
}

fn validate_digest(value: &str) -> Result<(), String> {
    let Some(hex) = value.strip_prefix("sha256:") else {
        return Err("previewDigest debe comenzar con sha256:".into());
    };
    if hex.len() == 64
        && hex
            .chars()
            .all(|character| character.is_ascii_digit() || ('a'..='f').contains(&character))
    {
        Ok(())
    } else {
        Err("previewDigest debe contener 64 caracteres hexadecimales minúsculos".into())
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct UtcInstant {
    seconds: i64,
    nanos: u32,
}

fn validate_positive_ttl(
    field: &str,
    start: UtcInstant,
    end: UtcInstant,
    maximum_seconds: u64,
) -> Result<(), String> {
    let start_nanos = i128::from(start.seconds) * 1_000_000_000 + i128::from(start.nanos);
    let end_nanos = i128::from(end.seconds) * 1_000_000_000 + i128::from(end.nanos);
    let ttl = end_nanos - start_nanos;
    if ttl <= 0 || ttl > i128::from(maximum_seconds) * 1_000_000_000 {
        return Err(format!(
            "{field} debe ser posterior al inicio y vencer en un máximo de {maximum_seconds} segundos"
        ));
    }
    Ok(())
}

fn parse_utc_timestamp(field: &str, value: &str) -> Result<UtcInstant, String> {
    let invalid = || format!("{field} debe contener una fecha UTC ISO-8601 válida");
    if !value.is_ascii() || !value.ends_with('Z') {
        return Err(invalid());
    }
    let without_zone = &value[..value.len() - 1];
    let (date, time) = without_zone.split_once('T').ok_or_else(invalid)?;
    if date.len() != 10 || &date[4..5] != "-" || &date[7..8] != "-" {
        return Err(invalid());
    }
    let year = parse_fixed_u32(&date[0..4], 4).ok_or_else(invalid)?;
    let month = parse_fixed_u32(&date[5..7], 2).ok_or_else(invalid)?;
    let day = parse_fixed_u32(&date[8..10], 2).ok_or_else(invalid)?;
    if year < 1970 || !(1..=12).contains(&month) || !(1..=days_in_month(year, month)).contains(&day)
    {
        return Err(invalid());
    }

    let (whole_time, fraction) = time
        .split_once('.')
        .map_or((time, None), |(whole, fraction)| (whole, Some(fraction)));
    if whole_time.len() != 8 || &whole_time[2..3] != ":" || &whole_time[5..6] != ":" {
        return Err(invalid());
    }
    let hour = parse_fixed_u32(&whole_time[0..2], 2).ok_or_else(invalid)?;
    let minute = parse_fixed_u32(&whole_time[3..5], 2).ok_or_else(invalid)?;
    let second = parse_fixed_u32(&whole_time[6..8], 2).ok_or_else(invalid)?;
    if hour > 23 || minute > 59 || second > 59 {
        return Err(invalid());
    }

    let nanos = match fraction {
        None => 0,
        Some(value)
            if !value.is_empty()
                && value.len() <= 9
                && value.chars().all(|character| character.is_ascii_digit()) =>
        {
            let parsed = value.parse::<u32>().map_err(|_| invalid())?;
            parsed * 10_u32.pow(9 - value.len() as u32)
        }
        Some(_) => return Err(invalid()),
    };
    let days = days_from_civil(year, month, day);
    let seconds = days * 86_400 + i64::from(hour * 3_600 + minute * 60 + second);
    Ok(UtcInstant { seconds, nanos })
}

fn parse_fixed_u32(value: &str, length: usize) -> Option<u32> {
    (value.len() == length && value.chars().all(|character| character.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        2 if is_leap_year(year) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

fn days_from_civil(year: u32, month: u32, day: u32) -> i64 {
    let adjusted_year = i64::from(year) - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = i64::from(month) + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + i64::from(day) - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn draft() -> PermissionRequestDraft {
        PermissionRequestDraft {
            schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
            request_id: "request_0123456789".into(),
            idempotency_key: "context-control-01".into(),
            capability_id: "context.foreground.control".into(),
            capability_version: 1,
            operation: "enableObservation".into(),
            mode: PermissionMode::OneShot,
            purpose: "Activar la observación de la ventana en primer plano.".into(),
            resource: PermissionResource {
                kind: PermissionResourceKind::Window,
                stable_id: "foreground-window".into(),
                label: "Ventana en primer plano".into(),
            },
            data_scopes: vec!["windowMetadata".into()],
            effects: vec![PermissionEffect::WindowMetadataRead],
            risk: PermissionRisk::High,
            created_at: "2026-08-09T14:00:00Z".into(),
            decision_expires_at: "2026-08-09T14:01:00Z".into(),
            requested_duration_seconds: None,
            maximum_duration_seconds: None,
            summary: "Alice solicita observar metadatos de la ventana activa.".into(),
            warnings: vec!["La aplicación activa puede quedar visible en el panel local.".into()],
        }
    }

    fn camera_draft() -> PermissionRequestDraft {
        PermissionRequestDraft {
            request_id: "camera_request_001".into(),
            idempotency_key: "camera-session-001".into(),
            capability_id: "perception.camera.observe".into(),
            operation: "observeAuthorizedCamera".into(),
            mode: PermissionMode::Session,
            purpose: "Analizar gestos durante esta sesión.".into(),
            resource: PermissionResource {
                kind: PermissionResourceKind::Camera,
                stable_id: "camera-device-001".into(),
                label: "ACER HD User Facing".into(),
            },
            data_scopes: vec!["cameraFrames".into()],
            effects: vec![PermissionEffect::CameraObserve],
            requested_duration_seconds: Some(120),
            maximum_duration_seconds: Some(300),
            summary: "Alice solicita observar la cámara durante un máximo de 2 minutos.".into(),
            warnings: vec!["La luz de la cámara puede encenderse.".into()],
            ..draft()
        }
    }

    fn one_shot_grant() -> PermissionGrant {
        let request = draft().prepare().unwrap();
        PermissionGrant {
            schema_version: PERMISSION_GATEWAY_SCHEMA_VERSION,
            grant_id: "grant_01234567890".into(),
            request_id: request.request_id,
            preview_digest: request.preview_digest,
            capability_id: request.capability_id,
            operation: request.operation,
            mode: PermissionMode::OneShot,
            issued_at: "2026-08-09T14:00:10Z".into(),
            expires_at: "2026-08-09T14:01:10Z".into(),
            remaining_uses: Some(1),
            state: PermissionGrantState::Approved,
        }
    }

    #[test]
    fn prepared_request_serializes_the_camel_case_contract() {
        let request = camera_draft().prepare().unwrap();
        let value = serde_json::to_value(&request).unwrap();

        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["mode"], "session");
        assert_eq!(value["resource"]["kind"], "camera");
        assert_eq!(value["requestedDurationSeconds"], 120);
        assert_eq!(value["state"], "awaitingDecision");
        assert!(value["previewDigest"]
            .as_str()
            .unwrap()
            .starts_with("sha256:"));
        request.validate().unwrap();
    }

    #[test]
    fn enumerations_serialize_only_the_approved_values() {
        assert_eq!(
            serde_json::to_value([
                PermissionMode::ImplicitRead,
                PermissionMode::OneShot,
                PermissionMode::Session,
            ])
            .unwrap(),
            json!(["implicitRead", "oneShot", "session"])
        );
        assert_eq!(
            serde_json::to_value([PermissionDecision::Approve, PermissionDecision::Deny,]).unwrap(),
            json!(["approve", "deny"])
        );
        assert_eq!(
            serde_json::to_value([
                PermissionRequestState::AwaitingDecision,
                PermissionRequestState::Approved,
                PermissionRequestState::Denied,
                PermissionRequestState::Cancelled,
                PermissionRequestState::Expired,
            ])
            .unwrap(),
            json!([
                "awaitingDecision",
                "approved",
                "denied",
                "cancelled",
                "expired"
            ])
        );
    }

    #[test]
    fn deserialization_rejects_unknown_fields() {
        let request = draft().prepare().unwrap();
        let mut value = serde_json::to_value(request).unwrap();
        value["inventedGrant"] = json!(true);

        let error = serde_json::from_value::<PreparedPermissionRequest>(value).unwrap_err();
        assert!(error.to_string().contains("unknown field"));
    }

    #[test]
    fn digest_is_deterministic_and_covers_the_complete_preview() {
        let first = draft().prepare().unwrap();
        let second = draft().prepare().unwrap();
        assert_eq!(first.preview_digest, second.preview_digest);
        assert_eq!(
            first.canonical_preview_json().unwrap(),
            second.canonical_preview_json().unwrap()
        );

        let mut changed_draft = draft();
        changed_draft.purpose = "Detener la observación de la ventana en primer plano.".into();
        let changed = changed_draft.prepare().unwrap();
        assert_ne!(first.preview_digest, changed.preview_digest);
    }

    #[test]
    fn tampering_after_preparation_invalidates_the_digest() {
        let mut request = draft().prepare().unwrap();
        request.operation = "disableObservation".into();

        assert!(request
            .validate()
            .unwrap_err()
            .contains("digest no coincide"));
    }

    #[test]
    fn validation_rejects_invalid_ids_text_and_duplicates() {
        let mut invalid_id = draft();
        invalid_id.request_id = "short".into();
        assert!(invalid_id.prepare().unwrap_err().contains("requestId"));

        let mut invalid_capability = draft();
        invalid_capability.capability_id = "Context.Foreground".into();
        assert!(invalid_capability
            .prepare()
            .unwrap_err()
            .contains("capabilityId"));

        let mut invalid_operation = draft();
        invalid_operation.operation = "enable_observation".into();
        assert!(invalid_operation
            .prepare()
            .unwrap_err()
            .contains("operation"));

        let mut duplicate_scopes = draft();
        duplicate_scopes.data_scopes.push("windowMetadata".into());
        assert!(duplicate_scopes
            .prepare()
            .unwrap_err()
            .contains("duplicados"));
    }

    #[test]
    fn validation_enforces_decision_expiry_and_utc_timestamps() {
        let mut too_long = draft();
        too_long.decision_expires_at = "2026-08-09T14:01:00.001Z".into();
        assert!(too_long.prepare().unwrap_err().contains("60 segundos"));

        let mut invalid_date = draft();
        invalid_date.created_at = "2026-02-29T14:00:00Z".into();
        assert!(invalid_date.prepare().unwrap_err().contains("ISO-8601"));

        let mut not_utc = draft();
        not_utc.created_at = "2026-08-09T11:00:00-03:00".into();
        assert!(not_utc.prepare().unwrap_err().contains("UTC"));
    }

    #[test]
    fn validation_enforces_session_duration_and_sensor_scope() {
        let valid = camera_draft().prepare().unwrap();
        valid.validate().unwrap();

        let mut too_long = camera_draft();
        too_long.requested_duration_seconds = Some(301);
        assert!(too_long.prepare().unwrap_err().contains("1..=300"));

        let mut wrong_mode = camera_draft();
        wrong_mode.mode = PermissionMode::OneShot;
        wrong_mode.requested_duration_seconds = None;
        wrong_mode.maximum_duration_seconds = None;
        assert!(wrong_mode.prepare().unwrap_err().contains("mode=session"));

        let mut wrong_scope = camera_draft();
        wrong_scope.data_scopes = vec!["windowMetadata".into()];
        assert!(wrong_scope
            .prepare()
            .unwrap_err()
            .contains("alcance de datos"));
    }

    #[test]
    fn implicit_read_never_creates_requests_or_grants() {
        let mut request = draft();
        request.mode = PermissionMode::ImplicitRead;
        assert!(request
            .prepare()
            .unwrap_err()
            .contains("no crea solicitudes"));

        let mut grant = one_shot_grant();
        grant.mode = PermissionMode::ImplicitRead;
        assert!(grant.validate().unwrap_err().contains("no crea grants"));
    }

    #[test]
    fn decision_input_rejects_malformed_or_uppercase_digest() {
        let request = draft().prepare().unwrap();
        let mut decision = PermissionDecisionInput {
            request_id: request.request_id,
            preview_digest: request.preview_digest,
            decision: PermissionDecision::Approve,
        };
        decision.validate().unwrap();

        decision.preview_digest = format!("sha256:{}", "A".repeat(64));
        assert!(decision.validate().unwrap_err().contains("minúsculos"));
    }

    #[test]
    fn grant_validation_enforces_mode_state_and_remaining_uses() {
        let grant = one_shot_grant();
        grant.validate().unwrap();
        assert_eq!(serde_json::to_value(&grant).unwrap()["remainingUses"], 1);

        let mut consumed = grant.clone();
        consumed.state = PermissionGrantState::Completed;
        consumed.remaining_uses = Some(0);
        consumed.validate().unwrap();

        let mut reusable = consumed.clone();
        reusable.remaining_uses = Some(1);
        assert!(reusable.validate().unwrap_err().contains("remainingUses=0"));

        let mut session = grant;
        session.mode = PermissionMode::Session;
        session.state = PermissionGrantState::Active;
        session.remaining_uses = None;
        session.validate().unwrap();
    }

    #[test]
    fn timestamp_parser_handles_epoch_leap_day_and_fractional_boundaries() {
        assert_eq!(
            parse_utc_timestamp("test", "1970-01-01T00:00:00Z").unwrap(),
            UtcInstant {
                seconds: 0,
                nanos: 0
            }
        );
        assert_eq!(
            parse_utc_timestamp("test", "2028-02-29T23:59:59.123456789Z")
                .unwrap()
                .nanos,
            123_456_789
        );
        assert!(parse_utc_timestamp("test", "2100-02-29T00:00:00Z").is_err());
        assert!(parse_utc_timestamp("test", "2026-08-09T24:00:00Z").is_err());
    }
}
