//! Read-only inspection and projections of memory sources.
use super::layers::classify_layered_memory;
use super::lifecycle::lifecycle_reference;
use super::model::{
    MarkdownNoteCatalogEntry, MemoryCapabilityProbe, MemoryGraphEvidenceUse, MemoryGraphLayer,
    MemoryGraphReference, MemoryResourceState, MemoryRetrievalPolicy, MemorySession,
    MemoryValidityState,
};
use super::validation::validate_memory_sessions;
use sha2::Digest;
use sha2::Sha256;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

// R8 consumes the existing R6 validation and classification rather than inferring
// facts from model responses or maintaining a second lifecycle policy.
pub(crate) fn graph_references_from_source(
    content: &str,
) -> Result<Vec<MemoryGraphReference>, String> {
    let sessions: Vec<MemorySession> = serde_json::from_str(content)
        .map_err(|_| "La fuente del grafo no contiene registros de memoria válidos".to_string())?;
    if sessions.len() > 10_000 {
        return Err("La fuente del grafo supera el límite de 10.000 registros".into());
    }
    validate_memory_sessions(&sessions)?;
    let classified = classify_layered_memory(content, &sessions, String::new());
    let episodic: HashSet<_> = classified
        .layers
        .episodic
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let taught: HashSet<_> = classified
        .layers
        .taught_facts
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let procedural: HashSet<_> = classified
        .layers
        .procedural
        .iter()
        .map(|r| r.record_id.as_str())
        .collect();
    let mut references = Vec::with_capacity(sessions.len());
    for session in &sessions {
        let lifecycle = lifecycle_reference(session)?;
        let layer = if episodic.contains(session.id.as_str()) {
            MemoryGraphLayer::Episodic
        } else if taught.contains(session.id.as_str()) {
            MemoryGraphLayer::TaughtFact
        } else if procedural.contains(session.id.as_str()) {
            MemoryGraphLayer::Procedural
        } else {
            MemoryGraphLayer::Unclassified
        };
        let has_declared_source = session
            .source
            .as_deref()
            .is_some_and(|s| !s.trim().is_empty());
        let evidence_use = if !matches!(
            lifecycle.retrieval_policy,
            MemoryRetrievalPolicy::Eligible | MemoryRetrievalPolicy::LegacyEligible
        ) {
            MemoryGraphEvidenceUse::Blocked
        } else {
            match layer {
                MemoryGraphLayer::Episodic => MemoryGraphEvidenceUse::EpisodeOnly,
                MemoryGraphLayer::TaughtFact
                    if has_declared_source
                        && lifecycle.validity == MemoryValidityState::Current =>
                {
                    MemoryGraphEvidenceUse::OwnerConfirmedContent
                }
                MemoryGraphLayer::Procedural => MemoryGraphEvidenceUse::ProcedureReferenceOnly,
                _ => MemoryGraphEvidenceUse::ReviewRequired,
            }
        };
        references.push(MemoryGraphReference {
            node_id: format!("record:{}", session.id),
            record_version: session.memory_version.unwrap_or(1),
            lifecycle,
            layer,
            has_declared_source,
            evidence_use,
        });
    }
    references.sort_by(|left, right| left.node_id.cmp(&right.node_id));
    Ok(references)
}

pub(super) fn inspect_memory_records(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<Vec<MemorySession>>(&content) {
            Ok(sessions) if validate_memory_sessions(&sessions).is_ok() => {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

pub(super) fn inspect_memory_manifest(path: &Path) -> MemoryResourceState {
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(value)
                if value.get("format").and_then(|item| item.as_str()) == Some("alice-memory")
                    && value.get("version").and_then(|item| item.as_u64()) == Some(1)
                    && value.get("recordsFile").and_then(|item| item.as_str())
                        == Some("records.json") =>
            {
                MemoryResourceState::Valid
            }
            Ok(_) | Err(_) => MemoryResourceState::Invalid,
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => MemoryResourceState::Missing,
        Err(_) => MemoryResourceState::Error,
    }
}

pub(crate) fn memory_capability_probe(data_root: &Path) -> MemoryCapabilityProbe {
    let directory = data_root.join("memory");
    MemoryCapabilityProbe {
        directory_exists: directory.is_dir(),
        manifest: inspect_memory_manifest(&directory.join("manifest.json")),
        records: inspect_memory_records(&directory.join("records.json")),
        backup: inspect_memory_records(&directory.join("backups").join("records.backup.json")),
    }
}

pub(super) fn collect_markdown_notes(
    directory: &Path,
    root: &Path,
    notes: &mut Vec<MarkdownNoteCatalogEntry>,
) -> Result<(), String> {
    if notes.len() >= 500 {
        return Err("La bóveda supera el límite de 500 notas para este catálogo inicial".into());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("No se pudo enumerar la bóveda: {error}"))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            if entry.file_name() != ".obsidian" {
                collect_markdown_notes(&path, root, notes)?;
            }
            continue;
        }
        if !file_type.is_file()
            || path.extension().and_then(|extension| extension.to_str()) != Some("md")
        {
            continue;
        }
        let bytes = fs::read(&path)
            .map_err(|error| format!("No se pudo leer la nota para calcular su huella: {error}"))?;
        let relative_path = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        notes.push(MarkdownNoteCatalogEntry {
            relative_path,
            byte_length: bytes.len() as u64,
            sha256: format!(
                "sha256:{}",
                crate::util::encode_hex_lower(Sha256::digest(bytes))
            ),
        });
    }
    Ok(())
}

pub(super) fn load_memory_at(path: &Path) -> Result<super::model::MemorySnapshot, String> {
    let existed = path.exists();
    let sessions = if existed {
        let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
        let sessions: Vec<MemorySession> = serde_json::from_str(&content)
            .map_err(|error| format!("La memoria local no es válida: {error}"))?;
        validate_memory_sessions(&sessions)?;
        sessions
    } else {
        Vec::new()
    };
    Ok(super::model::MemorySnapshot {
        sessions,
        storage_path: path.display().to_string(),
        existed,
    })
}

pub(super) fn markdown_note_catalog_at(
    directory: &Path,
) -> Result<super::model::MarkdownNoteCatalogSnapshot, String> {
    let vault = directory.join("notes");
    if !vault.is_dir() {
        return Ok(super::model::MarkdownNoteCatalogSnapshot {
            vault_path: vault.display().to_string(),
            vault_exists: false,
            note_count: 0,
            notes: Vec::new(),
        });
    }
    let mut notes = Vec::new();
    collect_markdown_notes(&vault, &vault, &mut notes)?;
    notes.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(super::model::MarkdownNoteCatalogSnapshot {
        vault_path: vault.display().to_string(),
        vault_exists: true,
        note_count: notes.len(),
        notes,
    })
}
