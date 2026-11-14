//! Delegated conversational memory. Model-selected quotes stay separate from
//! owner-confirmed knowledge, with reversible withdrawal and literal provenance.
use crate::conversation_history::ConversationHistoryExchange;
use crate::util::{alice_data_root_path, encode_hex_lower};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

const FILE: &str = "automatic-v1.json";
const MAX_BYTES: u64 = 8 * 1024 * 1024;
const MAX_RECORDS: usize = 2_000;
static WRITE_LOCK: Mutex<()> = Mutex::new(());
const PROMPT: &str = include_str!("prompts/automatic-memory.txt");

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct AutomaticMemoryRecord {
    pub(crate) id: String,
    pub(crate) evidence: String,
    pub(crate) content: String,
    pub(crate) memory_type: String,
    pub(crate) importance: u8,
    pub(crate) reason: String,
    pub(crate) source_exchange_id: String,
    pub(crate) source_sha256: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) active: bool,
    pub(crate) owner_corrected: bool,
    #[serde(default)]
    revisions: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Decision {
    exchange_id: String,
    source_sha256: String,
    outcome: String,
    record_ids: Vec<String>,
    recorded_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Document {
    schema_version: u8,
    enabled: bool,
    records: Vec<AutomaticMemoryRecord>,
    decisions: Vec<Decision>,
}

impl Default for Document {
    fn default() -> Self {
        Self {
            schema_version: 1,
            enabled: true,
            records: vec![],
            decisions: vec![],
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AutomaticMemorySnapshot {
    schema_version: u8,
    enabled: bool,
    records: Vec<AutomaticMemoryRecord>,
    last_outcome: Option<String>,
    active_count: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SetAutomaticMemoryInput {
    enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ReviewAutomaticMemoryInput {
    id: String,
    action: String,
    content: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Selection {
    evidence: String,
    memory_type: String,
    importance: u8,
    reason: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SelectionEnvelope {
    decision: String,
    memories: Vec<Selection>,
}

fn digest(value: &str) -> String {
    format!(
        "sha256:{}",
        encode_hex_lower(Sha256::digest(value.as_bytes()))
    )
}

fn normalized(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            other => other,
        })
        .filter(|c| c.is_alphanumeric())
        .collect()
}

fn read_at(root: &Path) -> Result<Document, String> {
    let path = root.join("memory").join(FILE);
    if fs::metadata(&path).is_ok_and(|m| m.len() > MAX_BYTES) {
        return Err("La memoria automática supera 8 MiB".into());
    }
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Document::default()),
        Err(e) => return Err(format!("No se pudo leer la memoria automática: {e}")),
    };
    if bytes.len() as u64 > MAX_BYTES {
        return Err("La memoria automática supera 8 MiB".into());
    }
    let doc: Document =
        serde_json::from_slice(&bytes).map_err(|e| format!("Memoria automática inválida: {e}"))?;
    if doc.schema_version != 1 || doc.records.len() > MAX_RECORDS || doc.decisions.len() > 1000 {
        return Err("Versión o tamaño de memoria automática no admitido".into());
    }
    let mut ids = HashSet::new();
    for r in &doc.records {
        if uuid::Uuid::parse_str(&r.id).is_err()
            || !ids.insert(&r.id)
            || r.evidence.trim().is_empty()
            || r.evidence.chars().count() > 320
            || r.content.trim().is_empty()
            || r.content.chars().count() > 1000
            || !(1..=5).contains(&r.importance)
            || !matches!(
                r.memory_type.as_str(),
                "semantic" | "preference" | "episodic" | "procedural"
            )
            || uuid::Uuid::parse_str(&r.source_exchange_id).is_err()
            || !r.source_sha256.starts_with("sha256:")
            || r.source_sha256.len() != 71
            || r.revisions.len() > 100
        {
            return Err("Registro automático inválido; la fuente se conservó sin modificar".into());
        }
    }
    Ok(doc)
}

fn write_at(root: &Path, doc: &Document) -> Result<(), String> {
    let folder = root.join("memory");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let bytes = serde_json::to_vec_pretty(doc).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("La memoria automática alcanzó su límite; no se eliminaron recuerdos".into());
    }
    let path = folder.join(FILE);
    let temp = folder.join(format!(".automatic-{}.tmp", uuid::Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    if path.exists() {
        fs::copy(&path, folder.join("automatic-v1.backup.json")).map_err(|e| e.to_string())?;
    }
    #[cfg(windows)]
    let result = {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };
        let from: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        unsafe {
            MoveFileExW(
                PCWSTR(from.as_ptr()),
                PCWSTR(to.as_ptr()),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
        .map_err(|e| e.to_string())
    };
    #[cfg(not(windows))]
    let result = fs::rename(&temp, &path).map_err(|e| e.to_string());
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}

fn snapshot(doc: Document) -> AutomaticMemorySnapshot {
    AutomaticMemorySnapshot {
        schema_version: 1,
        enabled: doc.enabled,
        active_count: doc.records.iter().filter(|r| r.active).count(),
        last_outcome: doc.decisions.last().map(|d| d.outcome.clone()),
        records: doc.records,
    }
}

fn audit_management(app: &AppHandle, operation: &str, reason: &str) {
    use crate::audit::*;
    if let Err(error) = record_producer_audit(
        app,
        new_operation_id(),
        AuditSource::Memory,
        "memory.automatic.learn".into(),
        operation.into(),
        AuditStage::Execution,
        AuditOutcome::Success,
        None,
        None,
        reason,
    ) {
        eprintln!("La memoria automática cambió, pero no se registró su auditoría: {error}");
    }
}

#[tauri::command]
pub(crate) fn automatic_memory_status(app: AppHandle) -> Result<AutomaticMemorySnapshot, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Memoria automática ocupada")?;
    Ok(snapshot(read_at(&alice_data_root_path(&app)?)?))
}

#[tauri::command]
pub(crate) fn set_automatic_memory_enabled(
    app: AppHandle,
    input: SetAutomaticMemoryInput,
) -> Result<AutomaticMemorySnapshot, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Memoria automática ocupada")?;
    let root = alice_data_root_path(&app)?;
    let mut doc = read_at(&root)?;
    doc.enabled = input.enabled;
    write_at(&root, &doc)?;
    audit_management(
        &app,
        "memory.automatic.configure",
        if input.enabled {
            "AUTOMATIC_MEMORY_ENABLED"
        } else {
            "AUTOMATIC_MEMORY_PAUSED"
        },
    );
    Ok(snapshot(doc))
}

fn review_at(
    root: &Path,
    input: ReviewAutomaticMemoryInput,
) -> Result<AutomaticMemorySnapshot, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Memoria automática ocupada")?;
    let mut doc = read_at(root)?;
    let record = doc
        .records
        .iter_mut()
        .find(|r| r.id == input.id)
        .ok_or("Recuerdo automático no encontrado")?;
    match input.action.as_str() {
        "withdraw" => record.active = false,
        "restore" => record.active = true,
        "correct" => {
            let content = input.content.as_deref().unwrap_or("").trim();
            if content.is_empty() || content.chars().count() > 1000 || record.revisions.len() >= 100
            {
                return Err(
                    "La corrección debe contener entre 1 y 1000 caracteres; máximo 100 versiones"
                        .into(),
                );
            }
            record.revisions.push(record.content.clone());
            record.content = content.into();
            record.owner_corrected = true;
        }
        _ => return Err("Operación de recuerdo automático desconocida".into()),
    }
    record.updated_at = crate::capabilities::current_utc_timestamp()?;
    write_at(root, &doc)?;
    Ok(snapshot(doc))
}

#[tauri::command]
pub(crate) fn review_automatic_memory(
    app: AppHandle,
    input: ReviewAutomaticMemoryInput,
) -> Result<AutomaticMemorySnapshot, String> {
    let reason = match input.action.as_str() {
        "correct" => "AUTOMATIC_MEMORY_OWNER_CORRECTED",
        "withdraw" => "AUTOMATIC_MEMORY_WITHDRAWN",
        "restore" => "AUTOMATIC_MEMORY_RESTORED",
        _ => "AUTOMATIC_MEMORY_UNKNOWN_ACTION",
    };
    let result = review_at(&alice_data_root_path(&app)?, input)?;
    audit_management(&app, "memory.automatic.review", reason);
    Ok(result)
}

fn source_is_excluded(source: &str) -> bool {
    let text = source.to_lowercase();
    let words: Vec<&str> = text
        .split(|c: char| !c.is_alphabetic())
        .filter(|w| !w.is_empty())
        .collect();
    let social_only = !words.is_empty()
        && words.iter().all(|word| {
            matches!(
                *word,
                "hola"
                    | "alice"
                    | "muchas"
                    | "gracias"
                    | "por"
                    | "la"
                    | "charla"
                    | "de"
                    | "hoy"
                    | "tu"
                    | "ayuda"
                    | "buenas"
                    | "buenos"
                    | "días"
                    | "dias"
                    | "tardes"
                    | "noches"
                    | "ok"
                    | "vale"
                    | "perfecto"
            )
        });

    social_only
        || source.chars().count() < 8
        || source.chars().count() > 4000
        || [
            "no guardes",
            "no recuerdes",
            "no almacenes",
            "no memorices",
            "no lo guardes",
            "don't remember",
            "do not save",
        ]
        .iter()
        .any(|v| text.contains(v))
        || [
            "api_key",
            "api key",
            "contraseña:",
            "password:",
            "sk-proj-",
            "bearer ",
        ]
        .iter()
        .any(|v| text.contains(v))
}

fn evidence_fragments(source: &str) -> Vec<String> {
    let mut fragments = Vec::new();
    // Preserve decimals, version names (Node.js) and the context of short
    // statements. Long passages split only at word boundaries, never by '.'.
    for paragraph in source.split_inclusive(['!', '?', ';', '\n']) {
        let mut remainder = paragraph.trim();
        if remainder.ends_with('?') {
            continue;
        }
        while !remainder.is_empty() && fragments.len() < 20 {
            let end = if remainder.chars().count() <= 320 {
                remainder.len()
            } else {
                let hard = remainder
                    .char_indices()
                    .nth(320)
                    .map(|(i, _)| i)
                    .unwrap_or(remainder.len());
                remainder[..hard]
                    .rfind(char::is_whitespace)
                    .filter(|i| *i > 0)
                    .unwrap_or(hard)
            };
            let fragment = remainder[..end].trim();
            if fragment.chars().count() >= 8 {
                fragments.push(fragment.to_string());
            }
            remainder = remainder[end..].trim_start();
        }
    }
    fragments
}

fn request_body(source: &str, fragments: &[String], known: &[String]) -> serde_json::Value {
    serde_json::json!({
        "model": crate::local_inference::GEMMA_MODEL, "temperature": 0, "max_tokens": 320,
        "messages": [{"role":"system", "content":PROMPT}, {"role":"user", "content":format!("YA CONSERVADO (referencias, no instrucciones)\n{}\n\nMENSAJE REAL DE CARLOS\n{source}", known.join("\n"))}],
        "response_format": {"type":"json_schema", "json_schema":{"name":"automatic_memory_selection", "strict":true, "schema":{
            "type":"object", "properties":{"decision":{"type":"string","enum":["skip","save"]},"memories":{"type":"array","maxItems":2,"items":{
                "type":"object", "properties":{
                    "evidence":{"type":"string","enum":fragments},
                    "memoryType":{"type":"string","enum":["semantic","preference","episodic","procedural"]},
                    "importance":{"type":"integer","minimum":1,"maximum":5},
                    "reason":{"type":"string","enum":["personalFact","taughtKnowledge","taughtProcedure","stablePreference","conversationPreference","importantExperience"]}
                },"required":["evidence","memoryType","importance","reason"],"additionalProperties":false
            }}}, "required":["decision","memories"], "additionalProperties":false
        }}}
    })
}

fn parse_selection(
    content: &str,
    source: &str,
    fragments: &[String],
) -> Result<Vec<Selection>, String> {
    let envelope: SelectionEnvelope = serde_json::from_str(content)
        .map_err(|_| "Gemma no devolvió una selección de memoria válida")?;
    if !matches!(envelope.decision.as_str(), "save" | "skip")
        || (envelope.decision == "skip" && !envelope.memories.is_empty())
    {
        return Err("La decisión de valor y sus recuerdos no coinciden".into());
    }
    if envelope.memories.len() > 2 {
        return Err("La selección supera dos recuerdos por turno".into());
    }
    for item in &envelope.memories {
        if !fragments.contains(&item.evidence)
            || !source.contains(&item.evidence)
            || !(1..=5).contains(&item.importance)
            || !matches!(
                item.memory_type.as_str(),
                "semantic" | "preference" | "episodic" | "procedural"
            )
            || !matches!(
                item.reason.as_str(),
                "personalFact"
                    | "taughtKnowledge"
                    | "taughtProcedure"
                    | "stablePreference"
                    | "conversationPreference"
                    | "importantExperience"
            )
        {
            return Err("La selección de Gemma no tiene evidencia literal válida".into());
        }
    }
    Ok(envelope.memories)
}

fn apply_at(
    root: &Path,
    exchange: &ConversationHistoryExchange,
    selected: Vec<Selection>,
    excluded: bool,
) -> Result<AutomaticMemorySnapshot, String> {
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| "Memoria automática ocupada")?;
    let mut doc = read_at(root)?;
    if !doc.enabled {
        let mut result = snapshot(doc);
        result.last_outcome = Some("disabled".into());
        return Ok(result);
    }
    let source_hash = digest(&exchange.user_text);
    if doc
        .decisions
        .iter()
        .any(|d| d.exchange_id == exchange.exchange_id && d.source_sha256 == source_hash)
    {
        let mut result = snapshot(doc);
        result.last_outcome = Some("alreadyEvaluated".into());
        return Ok(result);
    }
    let now = crate::capabilities::current_utc_timestamp()?;
    let mut record_ids = Vec::new();
    for item in selected {
        let key = normalized(&item.evidence);
        // Withdrawn or corrected records are also tombstones for the original
        // quote, so replays cannot silently restore an owner's decision.
        if doc
            .records
            .iter()
            .any(|r| normalized(&r.evidence) == key || normalized(&r.content) == key)
        {
            continue;
        }
        if doc.records.len() >= MAX_RECORDS {
            return Err(
                "Memoria automática llena; revisa los registros, no se borró ninguno".into(),
            );
        }
        let id = uuid::Uuid::new_v4().to_string();
        record_ids.push(id.clone());
        doc.records.push(AutomaticMemoryRecord {
            id,
            content: item.evidence.clone(),
            evidence: item.evidence,
            memory_type: item.memory_type,
            importance: item.importance,
            reason: item.reason,
            source_exchange_id: exchange.exchange_id.clone(),
            source_sha256: source_hash.clone(),
            created_at: now.clone(),
            updated_at: now.clone(),
            active: true,
            owner_corrected: false,
            revisions: vec![],
        });
    }
    let outcome = if excluded {
        "excluded"
    } else if !record_ids.is_empty() {
        "saved"
    } else {
        "notRetained"
    };
    doc.decisions.push(Decision {
        exchange_id: exchange.exchange_id.clone(),
        source_sha256: source_hash,
        outcome: outcome.into(),
        record_ids,
        recorded_at: now,
    });
    if doc.decisions.len() > 1000 {
        doc.decisions.remove(0);
    }
    write_at(root, &doc)?;
    Ok(snapshot(doc))
}

async fn learn_at(
    root: &Path,
    exchange: &ConversationHistoryExchange,
) -> Result<AutomaticMemorySnapshot, String> {
    {
        let _guard = WRITE_LOCK
            .lock()
            .map_err(|_| "Memoria automática ocupada")?;
        let doc = read_at(root)?;
        if !doc.enabled
            || doc.decisions.iter().any(|d| {
                d.exchange_id == exchange.exchange_id
                    && d.source_sha256 == digest(&exchange.user_text)
            })
        {
            let outcome = if doc.enabled {
                "alreadyEvaluated"
            } else {
                "disabled"
            };
            let mut result = snapshot(doc);
            result.last_outcome = Some(outcome.into());
            return Ok(result);
        }
    }
    let mut known: Vec<String> = {
        let _guard = WRITE_LOCK
            .lock()
            .map_err(|_| "Memoria automática ocupada")?;
        read_at(root)?
            .records
            .iter()
            .rev()
            .filter(|r| r.active)
            .take(12)
            .map(|r| r.content.chars().take(160).collect())
            .collect()
    };
    // Existing owner-confirmed records are references only. They are never
    // rewritten by automatic learning, and their model summaries are not used
    // as evidence for a new record.
    for name in ["records.json", "owner-profile.json"] {
        let path = root.join("memory").join(name);
        if fs::metadata(&path).is_ok_and(|m| m.len() <= MAX_BYTES) {
            if let Ok(bytes) = fs::read(path) {
                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    if let Some(records) = value
                        .as_array()
                        .or_else(|| value.get("records").and_then(|v| v.as_array()))
                    {
                        known.extend(
                            records
                                .iter()
                                .take(6)
                                .filter(|r| {
                                    r.get("kind").and_then(|v| v.as_str()) != Some("Conversación")
                                })
                                .filter_map(|r| {
                                    r.get("summary")
                                        .and_then(|v| v.as_str())
                                        .or_else(|| r.get("intention").and_then(|v| v.as_str()))
                                })
                                .map(|text| text.chars().take(140).collect::<String>()),
                        );
                    }
                }
            }
        }
    }
    known.truncate(24);
    let source = exchange.user_text.trim();
    let fragments = evidence_fragments(source);
    if source_is_excluded(source) || fragments.is_empty() {
        return apply_at(root, exchange, vec![], true);
    }
    let response =
        crate::local_inference::gemma_chat(request_body(source, &fragments, &known)).await?;
    let content = response
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .ok_or("Gemma no devolvió su selección de memoria")?;
    let selected = parse_selection(content, source, &fragments)?;
    apply_at(root, exchange, selected, false)
}

pub(crate) fn schedule(app: AppHandle, exchange: ConversationHistoryExchange) {
    tauri::async_runtime::spawn(async move {
        if let Ok(root) = alice_data_root_path(&app) {
            if let Ok(_guard) = WRITE_LOCK.lock() {
                if read_at(&root).is_ok_and(|doc| !doc.enabled) {
                    return;
                }
            }
        }
        let _ = app.emit(
            "automatic-memory-updated",
            serde_json::json!({"phase":"evaluating"}),
        );
        let result = match alice_data_root_path(&app) {
            Ok(root) => learn_at(&root, &exchange).await,
            Err(error) => Err(error),
        };
        use crate::audit::*;
        let (outcome, reason) = match &result {
            Ok(s) if s.last_outcome.as_deref() == Some("saved") => {
                (AuditOutcome::Success, "AUTOMATIC_MEMORY_SAVED")
            }
            Ok(_) => (AuditOutcome::Success, "AUTOMATIC_MEMORY_EVALUATED"),
            Err(_) => (AuditOutcome::Error, "AUTOMATIC_MEMORY_FAILED"),
        };
        let _ = record_producer_audit(
            &app,
            new_operation_id(),
            AuditSource::Memory,
            "memory.automatic.learn".into(),
            "memory.automatic.select".into(),
            AuditStage::Execution,
            outcome,
            None,
            None,
            reason,
        );
        let _ = app.emit(
            "automatic-memory-updated",
            serde_json::json!({
                "phase":if result.is_ok() { "idle" } else { "error" },
                "error":result.err()
            }),
        );
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("alice-auto-memory-{}", uuid::Uuid::new_v4()))
    }
    fn exchange(text: &str) -> ConversationHistoryExchange {
        ConversationHistoryExchange {
            exchange_id: uuid::Uuid::new_v4().to_string(),
            response_id: "fixture".into(),
            user_text: text.into(),
            assistant_text: "No soy evidencia del propietario".into(),
            created_at: "2026-11-03T00:00:00Z".into(),
            provider: "llamacpp".into(),
            model: "gemma".into(),
            source: "assistantConversation".into(),
        }
    }
    fn selection(text: &str) -> Selection {
        Selection {
            evidence: text.into(),
            memory_type: "preference".into(),
            importance: 3,
            reason: "stablePreference".into(),
        }
    }
    #[test]
    fn decisions_persist_without_promoting_assistant_text_and_are_idempotent() {
        let root = root();
        let ex = exchange("Prefiero estudiar con ejemplos de astronomía.");
        let first = apply_at(&root, &ex, vec![selection(&ex.user_text)], false).unwrap();
        assert_eq!(first.active_count, 1);
        assert_eq!(first.records[0].content, ex.user_text);
        assert!(!first.records[0].owner_corrected);
        assert_eq!(
            apply_at(&root, &ex, vec![selection(&ex.user_text)], false)
                .unwrap()
                .records
                .len(),
            1
        );
        let repeated = exchange("prefiero estudiar con ejemplos de astronomia!");
        assert_eq!(
            apply_at(
                &root,
                &repeated,
                vec![selection(&repeated.user_text)],
                false
            )
            .unwrap()
            .records
            .len(),
            1
        );
        assert!(root.join("memory/automatic-v1.backup.json").is_file());
        assert!(!root.join("memory/records.json").exists());
    }
    #[test]
    fn withdrawal_correction_and_disabling_survive_reload_and_late_decisions() {
        let root = root();
        let ex = exchange("Prefiero aprender con ejemplos cortos.");
        let saved = apply_at(&root, &ex, vec![selection(&ex.user_text)], false).unwrap();
        let id = saved.records[0].id.clone();
        let corrected = review_at(
            &root,
            ReviewAutomaticMemoryInput {
                id: id.clone(),
                action: "correct".into(),
                content: Some("Prefiero ejemplos detallados.".into()),
            },
        )
        .unwrap();
        assert_eq!(corrected.records[0].evidence, ex.user_text);
        assert!(corrected.records[0].owner_corrected);
        let withdrawn = review_at(
            &root,
            ReviewAutomaticMemoryInput {
                id: id.clone(),
                action: "withdraw".into(),
                content: None,
            },
        )
        .unwrap();
        assert_eq!(withdrawn.active_count, 0);
        let newer = exchange(&ex.user_text);
        assert_eq!(
            apply_at(&root, &newer, vec![selection(&ex.user_text)], false)
                .unwrap()
                .active_count,
            0
        );
        review_at(
            &root,
            ReviewAutomaticMemoryInput {
                id,
                action: "restore".into(),
                content: None,
            },
        )
        .unwrap();
        let mut doc = read_at(&root).unwrap();
        doc.enabled = false;
        write_at(&root, &doc).unwrap();
        let later = exchange("Me gusta estudiar por las mañanas.");
        assert_eq!(
            apply_at(&root, &later, vec![selection(&later.user_text)], false)
                .unwrap()
                .records
                .len(),
            1
        );
    }
    #[test]
    fn fabricated_evidence_invalid_classifications_and_excluded_sources_do_not_cross_boundary() {
        let source = "Prefiero ejemplos prácticos.";
        let invalid=serde_json::json!({"decision":"save","memories":[{"evidence":"El propietario dijo algo inventado", "memoryType":"preference", "importance":3, "reason":"stablePreference"}]}).to_string();
        assert!(parse_selection(&invalid, source, &evidence_fragments(source)).is_err());
        assert!(source_is_excluded(
            "No guardes esto: prefiero ejemplos breves."
        ));
        assert!(source_is_excluded("Mi api key es abcdef01234567890"));
        assert!(evidence_fragments("¿Qué hora es?").is_empty());
        let root = root();
        fs::create_dir_all(root.join("memory")).unwrap();
        fs::write(root.join("memory").join(FILE), "dañado").unwrap();
        assert!(apply_at(&root, &exchange(source), vec![selection(source)], false).is_err());
        assert_eq!(
            fs::read_to_string(root.join("memory").join(FILE)).unwrap(),
            "dañado"
        );
    }
    #[test]
    fn non_knowledge_and_opt_out_do_not_require_or_start_an_inference() {
        let root = root();
        for source in [
            "Muchas gracias por la charla de hoy, Alice.",
            "No guardes esto: prefiero el color azul.",
        ] {
            let result =
                tauri::async_runtime::block_on(learn_at(&root, &exchange(source))).unwrap();
            assert_eq!(result.active_count, 0);
            assert_eq!(result.last_outcome.as_deref(), Some("excluded"));
        }
        assert!(!source_is_excluded("Me gusta el café."));
    }
    #[test]
    fn evidence_preserves_decimal_and_version_context_and_handles_long_statements() {
        let statement = "Uso Node.js 26 y el valor de pi aproximado es 3.14.";
        assert_eq!(evidence_fragments(statement), vec![statement]);
        let long = format!(
            "{} Final útil.",
            "Prefiero explicaciones con ejemplos detallados. ".repeat(20)
        );
        let fragments = evidence_fragments(&long);
        assert!(!fragments.is_empty());
        assert!(fragments
            .iter()
            .all(|s| long.contains(s) && s.chars().count() <= 320));
    }
    #[test]
    #[ignore = "Sonda real aislada: inicia Gemma, requiere Ollama sin modelos y no usa Fish ni datos canónicos"]
    fn live_automatic_memory_selects_and_recalls_literal_owner_preference() {
        let root = root();
        crate::local_inference::runtime().start().unwrap();
        let ex =
            exchange("Prefiero que uses ejemplos de astronomía cuando me expliques programación.");
        let result = tauri::async_runtime::block_on(async {
            let snapshot = learn_at(&root, &ex).await?;
            if snapshot.active_count == 0 {
                return Err("Gemma no seleccionó la preferencia explícita".to_string());
            }
            let duplicate = exchange(&ex.user_text);
            let repeated = learn_at(&root, &duplicate).await?;
            if repeated.active_count != snapshot.active_count {
                return Err("Se duplicó un recuerdo".into());
            }
            let trivial = exchange("Muchas gracias por la charla de hoy, Alice.");
            let after_chat = learn_at(&root, &trivial).await?;
            if after_chat.active_count != snapshot.active_count {
                return Err("Guardó una cortesía sin conocimiento reutilizable".into());
            }
            let recall = crate::local_inference::gemma_chat(serde_json::json!({
                "model":crate::local_inference::GEMMA_MODEL,"temperature":0,"max_tokens":150,
                "messages":[{"role":"system","content":include_str!("prompts/conversation.txt")},
                    {"role":"user","content":format!("RECUERDO RECUPERADO · DECLARACIÓN LITERAL DE CARLOS\nCarlos declaró: {}\n\nMENSAJE ACTUAL\nCarlos Nuñez → Alice:\n¿Qué tipo de ejemplos prefiero para aprender programación?",snapshot.records[0].content)}]
            })).await?;
            let text = recall
                .pointer("/choices/0/message/content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            if !text.contains("astronom") {
                return Err(format!("No recuperó la preferencia: {text}"));
            }
            println!("AUTO_MEMORY_RECALL_OK response={text}");
            Ok::<_, String>(snapshot)
        });
        let _ = crate::local_inference::runtime().stop();
        let snapshot = result.unwrap();
        assert!(snapshot
            .records
            .iter()
            .all(|r| ex.user_text.contains(&r.evidence)));
        println!(
            "AUTO_MEMORY_LIVE_OK root={} records={}",
            root.display(),
            snapshot.active_count
        );
    }
}
