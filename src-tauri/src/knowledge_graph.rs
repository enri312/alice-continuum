use crate::memory::{graph_references_from_source, MemoryGraphReference};
use crate::util::{alice_data_root_path, encode_hex_lower};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::AppHandle;

mod associations;
pub(crate) use associations::{
    confirm_knowledge_graph_association, knowledge_graph_associations,
    set_knowledge_graph_association_withdrawn,
};

const MAX_SOURCE_BYTES: u64 = 8 * 1024 * 1024;
const SOURCE_FILE: &str = "memory/records.json";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EpisodeEvidence {
    record_id: String,
    record_version: u32,
    record_sha256: String,
    quote: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ValidatedEvidence {
    record_id: String,
    record_version: u32,
    record_sha256: String,
    field: String,
    start_byte: usize,
    end_byte: usize,
    quote_sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssociationPreview {
    schema_version: u8,
    relation: &'static str,
    evidence: Vec<ValidatedEvidence>,
    requires_owner_review: bool,
    relation_verified: bool,
    persisted: bool,
}

fn validate_association(
    content: &str,
    evidence: Vec<EpisodeEvidence>,
) -> Result<AssociationPreview, String> {
    if evidence.len() != 2 || evidence[0].record_id == evidence[1].record_id {
        return Err("Una propuesta requiere dos episodios distintos".into());
    }
    let mut validated = Vec::new();
    for item in evidence {
        let (start_byte, end_byte) = crate::memory::validate_graph_episode_evidence(
            content,
            &item.record_id,
            item.record_version,
            &item.record_sha256,
            &item.quote,
        )?;
        validated.push(ValidatedEvidence {
            record_id: item.record_id,
            record_version: item.record_version,
            record_sha256: item.record_sha256,
            field: "intention".into(),
            start_byte,
            end_byte,
            quote_sha256: format!(
                "sha256:{}",
                encode_hex_lower(Sha256::digest(item.quote.as_bytes()))
            ),
        });
    }
    validated.sort_by(|a, b| a.record_id.cmp(&b.record_id));
    Ok(AssociationPreview {
        schema_version: 1,
        relation: "relatedExperience",
        evidence: validated,
        requires_owner_review: true,
        relation_verified: false,
        persisted: false,
    })
}

#[tauri::command]
pub(crate) fn preview_knowledge_graph_association(
    app: AppHandle,
    evidence: Vec<EpisodeEvidence>,
) -> Result<AssociationPreview, String> {
    let file = File::open(alice_data_root_path(&app)?.join(SOURCE_FILE))
        .map_err(|_| "No se pudo abrir la fuente del grafo")?;
    let mut bytes = Vec::new();
    file.take(MAX_SOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "No se pudo leer la fuente del grafo")?;
    if bytes.len() as u64 > MAX_SOURCE_BYTES {
        return Err("La fuente supera 8 MiB".into());
    }
    validate_association(
        std::str::from_utf8(&bytes).map_err(|_| "Fuente no UTF-8")?,
        evidence,
    )
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum KnowledgeGraphState {
    Missing,
    Empty,
    Ready,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KnowledgeGraphEdge {
    id: String,
    relation: &'static str,
    evidence: Vec<ValidatedEvidence>,
    owner_confirmed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KnowledgeGraphSnapshot {
    schema_version: u8,
    state: KnowledgeGraphState,
    source_file: &'static str,
    source_sha256: Option<String>,
    nodes: Vec<MemoryGraphReference>,
    edges: Vec<KnowledgeGraphEdge>,
    records_modified: bool,
    index_persisted: bool,
    inference_performed: bool,
}

fn snapshot_at(data_root: &Path) -> Result<KnowledgeGraphSnapshot, String> {
    let file = match File::open(data_root.join(SOURCE_FILE)) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(KnowledgeGraphSnapshot {
                schema_version: 1,
                state: KnowledgeGraphState::Missing,
                source_file: SOURCE_FILE,
                source_sha256: None,
                nodes: Vec::new(),
                edges: Vec::new(),
                records_modified: false,
                index_persisted: false,
                inference_performed: false,
            });
        }
        Err(_) => return Err("No se pudo abrir la fuente local del grafo".into()),
    };
    let metadata = file
        .metadata()
        .map_err(|_| "No se pudo inspeccionar la fuente del grafo")?;
    if !metadata.is_file() || metadata.len() > MAX_SOURCE_BYTES {
        return Err("La fuente del grafo debe ser un archivo de hasta 8 MiB".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_SOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "No se pudo leer la fuente del grafo")?;
    if bytes.len() as u64 > MAX_SOURCE_BYTES {
        return Err("La fuente del grafo supera 8 MiB".into());
    }
    let content =
        std::str::from_utf8(&bytes).map_err(|_| "La fuente del grafo no es UTF-8 válido")?;
    let nodes = graph_references_from_source(content)?;
    Ok(KnowledgeGraphSnapshot {
        schema_version: 1,
        state: if nodes.is_empty() {
            KnowledgeGraphState::Empty
        } else {
            KnowledgeGraphState::Ready
        },
        source_file: SOURCE_FILE,
        source_sha256: Some(format!(
            "sha256:{}",
            encode_hex_lower(Sha256::digest(&bytes))
        )),
        nodes,
        edges: associations::active_edges(data_root, content)?,
        records_modified: false,
        index_persisted: false,
        inference_performed: false,
    })
}

#[tauri::command]
pub(crate) fn knowledge_graph_snapshot(app: AppHandle) -> Result<KnowledgeGraphSnapshot, String> {
    snapshot_at(&alice_data_root_path(&app)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::PathBuf;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("alice-r8-{}", uuid::Uuid::new_v4())))
        }
        fn write(&self, value: &Value) -> Vec<u8> {
            fs::create_dir_all(self.0.join("memory")).unwrap();
            let bytes = serde_json::to_vec(value).unwrap();
            fs::write(self.0.join(SOURCE_FILE), &bytes).unwrap();
            bytes
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            if self.0.exists() {
                fs::remove_dir_all(&self.0).unwrap();
            }
        }
    }
    fn record(id: &str) -> Value {
        json!({"id":id,"kind":"Conversación","intention":"entrada privada",
            "startedAt":"2026-09-04T12:00:00Z","summary":"respuesta privada",
            "memoryType":"episodic","memoryStatus":"confirmed","source":"fuente privada"})
    }
    fn value(root: &Path) -> Value {
        serde_json::to_value(snapshot_at(root).unwrap()).unwrap()
    }

    fn evidence(content: &str, id: &str, quote: &str) -> EpisodeEvidence {
        let nodes = serde_json::to_value(graph_references_from_source(content).unwrap()).unwrap();
        let node = nodes
            .as_array()
            .unwrap()
            .iter()
            .find(|n| n["lifecycle"]["recordId"] == id)
            .unwrap();
        EpisodeEvidence {
            record_id: id.into(),
            record_version: 1,
            record_sha256: node["lifecycle"]["recordSha256"].as_str().unwrap().into(),
            quote: quote.into(),
        }
    }

    #[test]
    fn association_citations_are_not_automatically_verified_relationships() {
        let content = json!([record("a"), record("b")]).to_string();
        let sources = vec![
            evidence(&content, "a", "entrada"),
            evidence(&content, "b", "privada"),
        ];
        let result = validate_association(&content, sources.clone()).unwrap();
        assert!(result.requires_owner_review);
        assert!(!result.relation_verified && !result.persisted);
        assert_eq!(result.evidence[0].field, "intention");
        let mut invalid = sources.clone();
        invalid[1].quote = "respuesta privada".into();
        assert!(validate_association(&content, invalid).is_err());
        let mut invalid = sources.clone();
        invalid[1] = invalid[0].clone();
        assert!(validate_association(&content, invalid).is_err());
        let changed = json!([record("a"), record("c")]).to_string();
        assert!(validate_association(&changed, sources).is_err());
    }

    #[test]
    fn association_is_invalid_after_revision_or_suppression() {
        let mut records = json!([record("a"), record("b")]);
        let content = records.to_string();
        let sources = vec![
            evidence(&content, "a", "entrada"),
            evidence(&content, "b", "entrada"),
        ];
        records[0]["intention"] = json!("entrada corregida");
        assert!(validate_association(&records.to_string(), sources.clone()).is_err());
        records[0] = record("a");
        records[0]["suppressionStatus"] = json!("suppressed");
        records[0]["suppressionReason"] = json!("ownerChoice");
        records[0]["suppressionUpdatedAt"] = json!("2026-09-04T12:00:00Z");
        let suppressed = records.to_string();
        assert!(validate_association(&suppressed, sources).is_err());
        let fresh = vec![
            evidence(&suppressed, "a", "entrada"),
            evidence(&suppressed, "b", "entrada"),
        ];
        assert!(validate_association(&suppressed, fresh).is_err());
    }

    #[test]
    fn missing_and_empty_are_distinct_and_do_not_create_indexes() {
        let root = Fixture::new();
        assert_eq!(
            snapshot_at(&root.0).unwrap().state,
            KnowledgeGraphState::Missing
        );
        assert!(!root.0.exists());
        let bytes = root.write(&json!([]));
        let snapshot = snapshot_at(&root.0).unwrap();
        assert_eq!(snapshot.state, KnowledgeGraphState::Empty);
        assert!(snapshot.source_sha256.is_some());
        assert!(snapshot.nodes.is_empty() && snapshot.edges.is_empty());
        assert_eq!(fs::read(root.0.join(SOURCE_FILE)).unwrap(), bytes);
        assert_eq!(fs::read_dir(root.0.join("memory")).unwrap().count(), 1);
    }

    #[test]
    fn references_preserve_identity_and_do_not_copy_private_text_or_invent_edges() {
        let root = Fixture::new();
        let bytes = root.write(&json!([record("z"), record("a")]));
        let first = snapshot_at(&root.0).unwrap();
        assert_eq!(first, snapshot_at(&root.0).unwrap());
        let json = serde_json::to_value(first).unwrap();
        assert_eq!(json["nodes"][0]["nodeId"], "record:a");
        assert_eq!(json["nodes"][0]["lifecycle"]["recordId"], "a");
        assert_eq!(json["nodes"][0]["lifecycle"]["baseVersion"], 1);
        assert_eq!(json["nodes"][0]["evidenceUse"], "episodeOnly");
        assert_eq!(json["edges"], json!([]));
        for text in ["entrada privada", "respuesta privada", "fuente privada"] {
            assert!(!json.to_string().contains(text));
        }
        assert_eq!(fs::read(root.0.join(SOURCE_FILE)).unwrap(), bytes);
    }

    #[test]
    fn existing_lifecycle_blocks_sources_and_does_not_certify_model_responses() {
        let root = Fixture::new();
        let mut records = vec![
            record("conversation"),
            record("conflict"),
            record("dormant"),
            record("suppressed"),
            record("archived"),
            record("taught"),
            record("procedure"),
            record("legacy"),
        ];
        records[1]["memoryStatus"] = json!("conflict");
        records[2]["accessibilityStatus"] = json!("dormant");
        records[2]["accessibilityUpdatedAt"] = json!("2026-09-04T12:00:00Z");
        records[3]["suppressionStatus"] = json!("suppressed");
        records[3]["suppressionReason"] = json!("ownerChoice");
        records[3]["suppressionUpdatedAt"] = json!("2026-09-04T12:00:00Z");
        records[4]["memoryStatus"] = json!("archived");
        records[5]["kind"] = json!("Enseñanza");
        records[5]["memoryType"] = json!("semantic");
        records[6]["kind"] = json!("Enseñanza");
        records[6]["memoryType"] = json!("procedural");
        records[7]["kind"] = json!("Enseñanza");
        records[7]["memoryType"] = json!("semantic");
        records[7]["memoryStatus"] = Value::Null;
        records[7]["source"] = Value::Null;
        root.write(&json!(records));
        let result = value(&root.0);
        let nodes = result["nodes"].as_array().unwrap();
        for id in ["conflict", "dormant", "suppressed", "archived"] {
            assert_eq!(
                nodes
                    .iter()
                    .find(|n| n["lifecycle"]["recordId"] == id)
                    .unwrap()["evidenceUse"],
                "blocked"
            );
        }
        for (id, expected) in [
            ("conversation", "episodeOnly"),
            ("taught", "ownerConfirmedContent"),
            ("procedure", "procedureReferenceOnly"),
            ("legacy", "reviewRequired"),
        ] {
            assert_eq!(
                nodes
                    .iter()
                    .find(|n| n["lifecycle"]["recordId"] == id)
                    .unwrap()["evidenceUse"],
                expected
            );
        }
    }

    #[test]
    fn source_corrections_and_deletions_rebuild_references_without_stale_nodes() {
        let root = Fixture::new();
        let mut source = json!([record("a"), record("b")]);
        root.write(&source);
        let first = value(&root.0);
        source[0]["summary"] = json!("contenido corregido");
        source[0]["memoryVersion"] = json!(2);
        source[0]["reconsolidatedAt"] = json!("2026-09-04T13:00:00Z");
        source[0]["reconsolidationReason"] = json!("ownerCorrection");
        source[0]["previousVersionSha256"] = first["nodes"][0]["lifecycle"]["recordSha256"].clone();
        root.write(&source);
        let second = value(&root.0);
        assert_ne!(first["sourceSha256"], second["sourceSha256"]);
        assert_ne!(
            first["nodes"][0]["lifecycle"]["recordSha256"],
            second["nodes"][0]["lifecycle"]["recordSha256"]
        );
        assert_eq!(first["nodes"][0]["nodeId"], second["nodes"][0]["nodeId"]);
        assert_eq!(second["nodes"][0]["recordVersion"], 2);
        assert_eq!(second["nodes"][0]["lifecycle"]["reconsolidationCount"], 1);
        source.as_array_mut().unwrap().remove(0);
        root.write(&source);
        let third = value(&root.0);
        assert_eq!(third["nodes"].as_array().unwrap().len(), 1);
        assert_eq!(third["nodes"][0]["nodeId"], "record:b");
    }

    #[test]
    fn malformed_duplicate_and_oversized_sources_fail_without_repair() {
        let root = Fixture::new();
        for source in [json!([record("a"), record("a")]), json!({"bad":"source"})] {
            let bytes = root.write(&source);
            assert!(snapshot_at(&root.0).is_err());
            assert_eq!(fs::read(root.0.join(SOURCE_FILE)).unwrap(), bytes);
        }
        let too_many: Vec<_> = (0..10_001)
            .map(|i| record(&format!("record-{i}")))
            .collect();
        let bytes = root.write(&json!(too_many));
        assert!(snapshot_at(&root.0).unwrap_err().contains("10.000"));
        assert_eq!(fs::read(root.0.join(SOURCE_FILE)).unwrap(), bytes);
        fs::write(root.0.join(SOURCE_FILE), [0xff]).unwrap();
        assert!(snapshot_at(&root.0).is_err());
        let file = File::create(root.0.join(SOURCE_FILE)).unwrap();
        file.set_len(MAX_SOURCE_BYTES + 1).unwrap();
        assert!(snapshot_at(&root.0).is_err());
        assert_eq!(file.metadata().unwrap().len(), MAX_SOURCE_BYTES + 1);
    }

    fn hashes(root: &Path) -> BTreeMap<PathBuf, String> {
        fn visit(root: &Path, dir: &Path, output: &mut BTreeMap<PathBuf, String>) {
            for entry in fs::read_dir(dir).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                let kind = entry.file_type().unwrap();
                assert!(!kind.is_symlink(), "la sonda no sigue enlaces");
                if kind.is_dir() {
                    visit(root, &path, output);
                } else {
                    output.insert(
                        path.strip_prefix(root).unwrap().into(),
                        encode_hex_lower(Sha256::digest(fs::read(&path).unwrap())),
                    );
                }
            }
        }
        let mut result = BTreeMap::new();
        visit(root, root, &mut result);
        result
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR; sólo lectura y salida sin contenido privado"]
    fn live_canonical_graph_is_read_only_and_reproducible() {
        let root =
            PathBuf::from(std::env::var_os("ALICE_LIVE_DATA_DIR").expect("authorized data root"));
        assert!(root.is_absolute() && root.join(SOURCE_FILE).is_file());
        let before = hashes(&root);
        let first = snapshot_at(&root).unwrap();
        assert_eq!(first, snapshot_at(&root).unwrap());
        assert_eq!(before, hashes(&root));
        let json = serde_json::to_value(&first).unwrap();
        let mut uses = BTreeMap::<String, usize>::new();
        for node in json["nodes"].as_array().unwrap() {
            *uses
                .entry(node["evidenceUse"].as_str().unwrap().into())
                .or_default() += 1;
        }
        let content = fs::read_to_string(root.join(SOURCE_FILE)).unwrap();
        let records: Value = serde_json::from_str(&content).unwrap();
        let candidates: Vec<_> = json["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|node| node["evidenceUse"] == "episodeOnly")
            .filter_map(|node| {
                let id = node["lifecycle"]["recordId"].as_str()?;
                let record = records.as_array()?.iter().find(|r| r["id"] == id)?;
                let quote: String = record["intention"].as_str()?.chars().take(80).collect();
                if quote.trim().is_empty() {
                    return None;
                }
                Some(EpisodeEvidence {
                    record_id: id.into(),
                    record_version: node["recordVersion"].as_u64()? as u32,
                    record_sha256: node["lifecycle"]["recordSha256"].as_str()?.into(),
                    quote,
                })
            })
            .take(2)
            .collect();
        assert_eq!(
            first.nodes.len(),
            records
                .as_array()
                .expect("records.json debe ser una lista")
                .len(),
            "cada recuerdo canónico válido debe conservar su referencia"
        );
        let checked_citations = candidates.len();
        if checked_citations == 2 {
            let preview = validate_association(&content, candidates).unwrap();
            assert!(
                !preview.persisted && !preview.relation_verified && preview.requires_owner_review
            );
        } else {
            assert!(
                checked_citations < 2,
                "la sonda nunca debe seleccionar más de dos episodios"
            );
        }
        assert_eq!(before, hashes(&root));
        println!(
            "R8.2 actual_citations_checked={checked_citations} relation_verified=false writes=0"
        );
        println!(
            "R8.1 files_preserved={} nodes={} edges={} evidence_use={:?} writes=0 inference=0",
            before.len(),
            first.nodes.len(),
            first.edges.len(),
            uses
        );
    }
}
