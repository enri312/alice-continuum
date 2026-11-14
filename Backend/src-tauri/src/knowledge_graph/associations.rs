//! Immutable, bounded revision journal. Source records are never written here.
use super::*;
use crate::audit::{
    append_event_at, new_operation_id, AuditEvent, AuditOutcome, AuditSource, AuditStage,
    AUDIT_MAX_BYTES,
};
use crate::util::timestamp_ms;
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const DIRECTORY: &str = "memory/associations-v1";
const LIMIT: usize = 1000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Revision {
    schema_version: u8,
    revision: usize,
    previous_sha256: Option<String>,
    association_id: String,
    withdrawn: bool,
    evidence: Vec<ValidatedEvidence>,
    timestamp_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssociationView {
    id: String,
    revision: usize,
    withdrawn: bool,
    sources_current: bool,
    evidence: Vec<ValidatedEvidence>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssociationStatus {
    revision: usize,
    associations: Vec<AssociationView>,
}

fn source(root: &Path) -> Result<String, String> {
    let file = File::open(root.join(SOURCE_FILE)).map_err(|_| "Fuente de memoria no disponible")?;
    let mut bytes = Vec::new();
    file.take(MAX_SOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Fuente no legible")?;
    if bytes.len() as u64 > MAX_SOURCE_BYTES {
        return Err("La fuente supera 8 MiB".into());
    }
    String::from_utf8(bytes).map_err(|_| "Fuente no UTF-8".into())
}

fn digest(bytes: &[u8]) -> String {
    format!("sha256:{}", encode_hex_lower(Sha256::digest(bytes)))
}

fn read_journal(root: &Path) -> Result<(Vec<Revision>, Option<String>), String> {
    let directory = root.join(DIRECTORY);
    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok((vec![], None)),
        Err(_) => return Err("No se pudo leer el historial de relaciones".into()),
    };
    let mut paths = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|_| "Entrada de historial ilegible")?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "writer.lock" || name.ends_with(".tmp") {
            continue;
        }
        let kind = entry
            .file_type()
            .map_err(|_| "No se pudo inspeccionar el historial")?;
        if !kind.is_file() || kind.is_symlink() || !name.ends_with(".json") {
            return Err("El historial contiene una entrada inesperada".into());
        }
        paths.push(entry.path());
        if paths.len() > LIMIT {
            return Err("El historial alcanzó su límite de revisiones".into());
        }
    }
    paths.sort();
    let mut journal: Vec<Revision> = Vec::new();
    let mut previous = None;
    let mut total_bytes = 0;
    for (index, path) in paths.iter().enumerate() {
        if path.file_name().unwrap() != format!("{:06}.json", index + 1).as_str() {
            return Err("Faltan revisiones del historial; no se reparó automáticamente".into());
        }
        let mut bytes = Vec::new();
        File::open(path)
            .map_err(|_| "Revisión no disponible")?
            .take(65537)
            .read_to_end(&mut bytes)
            .map_err(|_| "Revisión ilegible")?;
        total_bytes += bytes.len();
        if bytes.len() > 65536 || total_bytes > 8 * 1024 * 1024 {
            return Err("Historial demasiado grande".into());
        }
        let row: Revision = serde_json::from_slice(&bytes).map_err(|_| "Revisión inválida")?;
        if row.schema_version != 1
            || row.revision != index + 1
            || row.previous_sha256 != previous
            || uuid::Uuid::parse_str(&row.association_id).is_err()
            || row.timestamp_ms == 0
            || row.evidence.len() != 2
            || row.evidence[0].record_id == row.evidence[1].record_id
        {
            return Err("La cadena de revisiones no es íntegra".into());
        }
        if let Some(old) = journal
            .iter()
            .rev()
            .find(|r| r.association_id == row.association_id)
        {
            if old.evidence != row.evidence || old.withdrawn == row.withdrawn {
                return Err("Transición de relación inválida".into());
            }
        } else if row.withdrawn {
            return Err("No se puede retirar una relación inexistente".into());
        }
        previous = Some(digest(&bytes));
        journal.push(row);
    }
    Ok((journal, previous))
}

fn latest(journal: &[Revision]) -> BTreeMap<String, Revision> {
    journal
        .iter()
        .map(|r| (r.association_id.clone(), r.clone()))
        .collect()
}

fn check_saved(content: &str, evidence: &[ValidatedEvidence]) -> Result<(), String> {
    let records: serde_json::Value =
        serde_json::from_str(content).map_err(|_| "Fuente inválida")?;
    for item in evidence {
        if item.field != "intention" {
            return Err("Campo no autorizado como evidencia episódica".into());
        }
        let text = records
            .as_array()
            .ok_or("Fuente inválida")?
            .iter()
            .find(|r| r["id"] == item.record_id)
            .and_then(|r| r["intention"].as_str())
            .ok_or("Fuente ausente")?;
        let quote = text
            .get(item.start_byte..item.end_byte)
            .ok_or("Localizador de evidencia inválido")?;
        if digest(quote.as_bytes()) != item.quote_sha256 {
            return Err("La cita cambió".into());
        }
        let range = crate::memory::validate_graph_episode_evidence(
            content,
            &item.record_id,
            item.record_version,
            &item.record_sha256,
            quote,
        )?;
        if range != (item.start_byte, item.end_byte) {
            return Err("La posición de la cita cambió".into());
        }
    }
    Ok(())
}

fn status_at(root: &Path) -> Result<AssociationStatus, String> {
    let (journal, _) = read_journal(root)?;
    let content = source(root).ok();
    Ok(AssociationStatus {
        revision: journal.len(),
        associations: latest(&journal)
            .into_values()
            .map(|row| AssociationView {
                id: row.association_id,
                revision: row.revision,
                withdrawn: row.withdrawn,
                sources_current: content
                    .as_ref()
                    .is_some_and(|c| check_saved(c, &row.evidence).is_ok()),
                evidence: row.evidence,
            })
            .collect(),
    })
}

pub(super) fn active_edges(root: &Path, content: &str) -> Result<Vec<KnowledgeGraphEdge>, String> {
    let (journal, _) = read_journal(root)?;
    Ok(latest(&journal)
        .into_values()
        .filter(|r| !r.withdrawn && check_saved(content, &r.evidence).is_ok())
        .map(|r| KnowledgeGraphEdge {
            id: r.association_id,
            relation: "relatedExperience",
            evidence: r.evidence,
            owner_confirmed: true,
        })
        .collect())
}

struct WriterLock {
    path: PathBuf,
    file: Option<File>,
}
impl Drop for WriterLock {
    fn drop(&mut self) {
        drop(self.file.take());
        let _ = fs::remove_file(&self.path);
    }
}

fn change_at(
    root: &Path,
    evidence: Option<Vec<EpisodeEvidence>>,
    change: Option<(String, bool)>,
    expected: usize,
    confirmed: bool,
) -> Result<AssociationStatus, String> {
    if !confirmed {
        return Err("Se requiere confirmación explícita".into());
    }
    let directory = root.join(DIRECTORY);
    fs::create_dir_all(&directory).map_err(|_| "No se pudo crear el historial de relaciones")?;
    let lock_path = directory.join("writer.lock");
    let lock = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&lock_path)
        .map_err(|_| "Otra escritura está en curso o quedó un bloqueo tras una interrupción")?;
    let guard = WriterLock {
        path: lock_path,
        file: Some(lock),
    };
    let (journal, previous_sha256) = read_journal(root)?;
    if journal.len() != expected {
        return Err("El historial cambió; actualice y revise nuevamente".into());
    }
    if journal.len() >= LIMIT {
        return Err("Se alcanzó el límite de revisiones".into());
    }
    let (id, withdrawn, validated) = match (evidence, change) {
        (Some(evidence), None) => {
            let proposal = validate_association(&source(root)?, evidence)?;
            let existing = latest(&journal);
            if existing
                .values()
                .any(|r| !r.withdrawn && r.evidence == proposal.evidence)
            {
                return Err("Esta relación ya está guardada".into());
            }
            (uuid::Uuid::new_v4().to_string(), false, proposal.evidence)
        }
        (None, Some((id, withdrawn))) => {
            let old = latest(&journal).remove(&id).ok_or("Relación inexistente")?;
            if old.withdrawn == withdrawn {
                return Err("La relación ya tiene ese estado".into());
            }
            if !withdrawn {
                check_saved(&source(root)?, &old.evidence)?;
            }
            (id, withdrawn, old.evidence)
        }
        _ => return Err("Operación de relación inválida".into()),
    };
    let row = Revision {
        schema_version: 1,
        revision: journal.len() + 1,
        previous_sha256,
        association_id: id,
        withdrawn,
        evidence: validated,
        timestamp_ms: timestamp_ms()? as u64,
    };
    let bytes = serde_json::to_vec(&row).map_err(|_| "No se pudo codificar la revisión")?;
    let mut total_bytes = bytes.len() as u64;
    for revision in 1..=journal.len() {
        total_bytes += fs::metadata(directory.join(format!("{revision:06}.json")))
            .map_err(|_| "El historial cambió durante la escritura")?
            .len();
    }
    if bytes.len() > 65536 || total_bytes > 8 * 1024 * 1024 {
        return Err("La revisión supera los límites del historial".into());
    }
    let operation = new_operation_id();
    let event = |stage, outcome, reason| {
        AuditEvent::producer(
            operation.clone(),
            AuditSource::Memory,
            "memory.graph.manage".into(),
            "change_graph_association".into(),
            stage,
            outcome,
            None,
            Some(digest(&bytes)),
            reason,
        )
    };
    append_event_at(
        root,
        &event(
            AuditStage::Request,
            AuditOutcome::Pending,
            "GRAPH_DECISION_REQUESTED",
        )?,
        AUDIT_MAX_BYTES,
    )?;
    let temporary = directory.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let target = directory.join(format!("{:06}.json", row.revision));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "No se pudo preparar la revisión")?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "No se pudo escribir la revisión")?;
        drop(file);
        if target.exists() {
            return Err("La revisión ya existe".into());
        }
        fs::rename(&temporary, &target).map_err(|_| "No se pudo publicar la revisión".to_string())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        let _ = append_event_at(
            root,
            &event(
                AuditStage::Error,
                AuditOutcome::Error,
                "GRAPH_DECISION_FAILED",
            )?,
            AUDIT_MAX_BYTES,
        );
        return Err(error);
    }
    append_event_at(
        root,
        &event(
            AuditStage::Execution,
            AuditOutcome::Success,
            "GRAPH_DECISION_SAVED",
        )?,
        AUDIT_MAX_BYTES,
    )
    .map_err(|_| {
        "La relación se guardó, pero falló la auditoría final; actualice antes de repetir"
    })?;
    drop(guard);
    status_at(root)
}

#[tauri::command]
pub(crate) fn knowledge_graph_associations(app: AppHandle) -> Result<AssociationStatus, String> {
    status_at(&alice_data_root_path(&app)?)
}
#[tauri::command]
pub(crate) fn confirm_knowledge_graph_association(
    app: AppHandle,
    evidence: Vec<EpisodeEvidence>,
    expected_revision: usize,
    confirmed: bool,
) -> Result<AssociationStatus, String> {
    change_at(
        &alice_data_root_path(&app)?,
        Some(evidence),
        None,
        expected_revision,
        confirmed,
    )
}
#[tauri::command]
pub(crate) fn set_knowledge_graph_association_withdrawn(
    app: AppHandle,
    id: String,
    withdrawn: bool,
    expected_revision: usize,
    confirmed: bool,
) -> Result<AssociationStatus, String> {
    change_at(
        &alice_data_root_path(&app)?,
        None,
        Some((id, withdrawn)),
        expected_revision,
        confirmed,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("alice-associations-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("memory")).unwrap();
            let records = json!([
                {"id":"a","kind":"Conversación","intention":"Me interesa aprender Rust","startedAt":"2026-09-05T12:00:00Z","summary":"respuesta del modelo","memoryType":"episodic","memoryStatus":"confirmed","source":"owner"},
                {"id":"b","kind":"Conversación","intention":"Estoy estudiando Rust","startedAt":"2026-09-05T12:00:00Z","memoryType":"episodic","memoryStatus":"confirmed","source":"owner"}
            ]);
            fs::write(root.join(SOURCE_FILE), records.to_string()).unwrap();
            Self(root)
        }
        fn evidence(&self) -> Vec<EpisodeEvidence> {
            let content = source(&self.0).unwrap();
            let nodes =
                serde_json::to_value(graph_references_from_source(&content).unwrap()).unwrap();
            nodes
                .as_array()
                .unwrap()
                .iter()
                .map(|n| EpisodeEvidence {
                    record_id: n["lifecycle"]["recordId"].as_str().unwrap().into(),
                    record_version: 1,
                    record_sha256: n["lifecycle"]["recordSha256"].as_str().unwrap().into(),
                    quote: "Rust".into(),
                })
                .collect()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn confirm_withdraw_restore_survive_reload_without_modifying_sources() {
        let f = Fixture::new();
        let before = fs::read(f.0.join(SOURCE_FILE)).unwrap();
        assert!(!f.0.join(DIRECTORY).exists());
        assert_eq!(status_at(&f.0).unwrap().revision, 0);
        assert!(!f.0.join(DIRECTORY).exists());
        let result = change_at(&f.0, Some(f.evidence()), None, 0, true).unwrap();
        let id = result.associations[0].id.clone();
        assert_eq!(active_edges(&f.0, &source(&f.0).unwrap()).unwrap().len(), 1);
        let saved = fs::read(f.0.join(DIRECTORY).join("000001.json")).unwrap();
        assert!(!String::from_utf8_lossy(&saved).contains("aprender Rust"));
        change_at(&f.0, None, Some((id.clone(), true)), 1, true).unwrap();
        assert!(active_edges(&f.0, &source(&f.0).unwrap())
            .unwrap()
            .is_empty());
        change_at(&f.0, None, Some((id, false)), 2, true).unwrap();
        assert_eq!(status_at(&f.0).unwrap().revision, 3);
        assert_eq!(active_edges(&f.0, &source(&f.0).unwrap()).unwrap().len(), 1);
        assert_eq!(
            fs::read(f.0.join(DIRECTORY).join("000001.json")).unwrap(),
            saved
        );
        assert_eq!(fs::read(f.0.join(SOURCE_FILE)).unwrap(), before);
    }
    #[test]
    fn stale_revision_duplicate_and_missing_confirmation_are_rejected() {
        let f = Fixture::new();
        assert!(change_at(&f.0, Some(f.evidence()), None, 0, false).is_err());
        assert!(!f.0.join(DIRECTORY).exists());
        change_at(&f.0, Some(f.evidence()), None, 0, true).unwrap();
        assert!(change_at(&f.0, Some(f.evidence()), None, 0, true).is_err());
        let mut reversed = f.evidence();
        reversed.reverse();
        assert!(change_at(&f.0, Some(reversed), None, 1, true).is_err());
        assert!(!f.0.join(DIRECTORY).join("writer.lock").exists());
        assert_eq!(status_at(&f.0).unwrap().revision, 1);
    }
    #[test]
    fn changed_suppressed_archived_and_deleted_sources_remove_live_edges() {
        let f = Fixture::new();
        change_at(&f.0, Some(f.evidence()), None, 0, true).unwrap();
        let original: Value = serde_json::from_str(&source(&f.0).unwrap()).unwrap();
        let mut changed = original.clone();
        changed[0]["intention"] = json!("Cambio real de la entrada");
        let mut suppressed = original.clone();
        suppressed[0]["suppressionStatus"] = json!("suppressed");
        suppressed[0]["suppressionReason"] = json!("ownerChoice");
        suppressed[0]["suppressionUpdatedAt"] = json!("2026-09-05T12:00:00Z");
        let mut archived = original.clone();
        archived[0]["memoryStatus"] = json!("archived");
        let mut deleted = original.clone();
        deleted.as_array_mut().unwrap().remove(0);
        for variant in [changed, suppressed, archived, deleted] {
            fs::write(f.0.join(SOURCE_FILE), variant.to_string()).unwrap();
            assert!(active_edges(&f.0, &source(&f.0).unwrap())
                .unwrap()
                .is_empty());
            assert!(!status_at(&f.0).unwrap().associations[0].sources_current);
            assert_eq!(status_at(&f.0).unwrap().revision, 1);
        }
        let id = status_at(&f.0).unwrap().associations[0].id.clone();
        change_at(&f.0, None, Some((id.clone(), true)), 1, true).unwrap();
        assert!(change_at(&f.0, None, Some((id, false)), 2, true).is_err());
    }
    #[test]
    fn corruption_is_reported_without_repair_or_new_revision() {
        let f = Fixture::new();
        change_at(&f.0, Some(f.evidence()), None, 0, true).unwrap();
        let path = f.0.join(DIRECTORY).join("000001.json");
        fs::write(&path, b"broken").unwrap();
        assert!(status_at(&f.0).is_err());
        assert!(change_at(&f.0, Some(f.evidence()), None, 1, true).is_err());
        assert_eq!(fs::read(path).unwrap(), b"broken");
        assert!(!f.0.join(DIRECTORY).join("000002.json").exists());
    }
    #[test]
    fn cross_process_lock_blocks_mutation_without_removing_foreign_lock() {
        let f = Fixture::new();
        fs::create_dir_all(f.0.join(DIRECTORY)).unwrap();
        let lock = f.0.join(DIRECTORY).join("writer.lock");
        fs::write(&lock, b"owned by test").unwrap();
        assert!(change_at(&f.0, Some(f.evidence()), None, 0, true).is_err());
        assert_eq!(fs::read(lock).unwrap(), b"owned by test");
        assert_eq!(status_at(&f.0).unwrap().revision, 0);
    }
}
