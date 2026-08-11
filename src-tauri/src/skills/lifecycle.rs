use super::{
    atomic_replace, read_bounded, read_optional_bounded, read_skill_draft_at, serialize_json,
    sha256_hex, valid_sha256, validate_skill_id, validate_text, validate_uuid_v4,
    CapabilityRegistrySnapshot, SkillDraftStore, SkillManifest, SkillStatus, MAX_SKILL_FILE_BYTES,
};
use crate::audit::{append_audit_event, new_operation_id, AuditEvent, AuditOutcome, AuditStage};
use crate::capabilities::{current_capability_registry, current_utc_timestamp};
use crate::observation::ObservationStore;
use crate::sensory::SensorLeaseStore;
use crate::util::{alice_data_root_path, timestamp_ms};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, State};
use uuid::Uuid;

pub(crate) const SKILL_LIFECYCLE_SCHEMA_VERSION: u32 = 1;
const SKILL_LIFECYCLE_FORMAT: &str = "alice-skill-lifecycle";
const MAX_LIFECYCLE_SKILLS: usize = 128;
const MAX_SKILL_REVISIONS: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillLifecycleAction {
    SubmitReview,
    Approve,
    Disable,
    Restore,
    Retire,
}

impl SkillLifecycleAction {
    fn operation(self) -> &'static str {
        match self {
            Self::SubmitReview => "skill.lifecycle.submitReview",
            Self::Approve => "skill.lifecycle.approve",
            Self::Disable => "skill.lifecycle.disable",
            Self::Restore => "skill.lifecycle.restore",
            Self::Retire => "skill.lifecycle.retire",
        }
    }

    fn target(self) -> SkillStatus {
        match self {
            Self::SubmitReview => SkillStatus::InReview,
            Self::Approve | Self::Restore => SkillStatus::Approved,
            Self::Disable => SkillStatus::Disabled,
            Self::Retire => SkillStatus::Retired,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SkillLifecycleActor {
    LocalOwner,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillLifecycleConfirmation {
    pub(super) actor: SkillLifecycleActor,
    pub(super) confirmed: bool,
    pub(super) expected_sha256: String,
    pub(super) reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SkillLifecycleTransitionInput {
    pub(super) skill_id: String,
    pub(super) expected_revision_id: String,
    pub(super) action: SkillLifecycleAction,
    pub(super) confirmation: SkillLifecycleConfirmation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillLifecycleIndex {
    schema_version: u32,
    format: String,
    updated_at_ms: u64,
    skills: Vec<SkillLifecycleIndexEntry>,
    revisions: Vec<SkillRevisionIndexEntry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillLifecycleIndexEntry {
    skill_id: String,
    current_revision_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillRevisionIndexEntry {
    skill_id: String,
    version: u32,
    revision_id: String,
    parent_revision_id: Option<String>,
    status: SkillStatus,
    sha256: String,
    file_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillLifecycleSummary {
    skill_id: String,
    title: String,
    version: u32,
    revision_id: String,
    status: SkillStatus,
    updated_at: String,
    sha256: String,
    revision_count: usize,
    execution_enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillLifecycleSnapshot {
    schema_version: u32,
    storage_path: String,
    existed: bool,
    skills: Vec<SkillLifecycleSummary>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillLifecycleRecord {
    manifest: SkillManifest,
    sha256: String,
    storage_path: String,
    revision_count: usize,
    execution_enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillLifecycleTransitionResult {
    operation_id: String,
    action: SkillLifecycleAction,
    manifest: SkillManifest,
    sha256: String,
    storage_path: String,
    revision_count: usize,
    execution_enabled: bool,
}

#[derive(Clone)]
struct LoadedRevision {
    manifest: SkillManifest,
    sha256: String,
}

#[tauri::command]
pub(crate) fn skill_lifecycle_status(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
) -> Result<SkillLifecycleSnapshot, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let _guard = skill_store.lock()?;
    skill_lifecycle_status_at(&alice_data_root_path(&app)?, &registry)
}

#[tauri::command]
pub(crate) fn read_skill_lifecycle(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
    input: super::SkillDraftReadInput,
) -> Result<SkillLifecycleRecord, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let _guard = skill_store.lock()?;
    read_skill_lifecycle_at(&alice_data_root_path(&app)?, &registry, &input.skill_id)
}

pub(super) fn read_skill_lifecycle_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    skill_id: &str,
) -> Result<SkillLifecycleRecord, String> {
    validate_skill_id(skill_id)?;
    let skills_root = data_root.join("skills");
    let (index, existed) = read_lifecycle_index(&skills_root)?;
    if !existed {
        return Err("La habilidad todavía no tiene un ciclo de vida iniciado".into());
    }
    let entry = current_entry(&index, skill_id)?;
    let revision_entry = revision_entry(&index, entry)?;
    let storage_path = skills_root.join(&revision_entry.file_name);
    let loaded = load_revision(&skills_root, registry, revision_entry)?;
    let revision_count = index
        .revisions
        .iter()
        .filter(|revision| revision.skill_id == skill_id)
        .count();
    Ok(SkillLifecycleRecord {
        manifest: loaded.manifest,
        sha256: loaded.sha256,
        storage_path: storage_path.display().to_string(),
        revision_count,
        execution_enabled: false,
    })
}

#[tauri::command]
pub(crate) fn transition_skill_lifecycle(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    skill_store: State<SkillDraftStore>,
    input: SkillLifecycleTransitionInput,
) -> Result<SkillLifecycleTransitionResult, String> {
    let registry = current_capability_registry(&app, &observation_store, &sensor_store)?;
    let data_root = alice_data_root_path(&app)?;
    let _guard = skill_store.lock()?;
    audited_transition_at(&data_root, &registry, input, |event| {
        append_audit_event(&app, event)
    })
}

pub(super) fn audited_transition_at<F>(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: SkillLifecycleTransitionInput,
    mut record: F,
) -> Result<SkillLifecycleTransitionResult, String>
where
    F: FnMut(&AuditEvent) -> Result<(), String>,
{
    validate_transition_input(&input)?;
    let source_sha256 = source_digest_at(data_root, registry, &input)?;
    let operation_id = new_operation_id();
    let operation = input.action.operation().to_string();
    record(&AuditEvent::skill(
        operation_id.clone(),
        operation.clone(),
        AuditStage::Request,
        AuditOutcome::Pending,
        None,
        Some(format!("sha256:{source_sha256}")),
        "SKILL_TRANSITION_ACCEPTED",
    )?)?;
    let started = Instant::now();

    match transition_at(data_root, registry, &input) {
        Ok(completed) => {
            let duration = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
            if let Err(error) = record(&AuditEvent::skill(
                operation_id.clone(),
                operation,
                AuditStage::Execution,
                AuditOutcome::Success,
                Some(duration.min(86_400_000)),
                Some(format!("sha256:{}", completed.sha256)),
                "SKILL_TRANSITION_COMPLETED",
            )?) {
                return Err(format!(
                    "La transición se completó, pero su evento R3 final falló ({operation_id}): {error}"
                ));
            }
            Ok(SkillLifecycleTransitionResult {
                operation_id,
                action: input.action,
                manifest: completed.manifest,
                sha256: completed.sha256,
                storage_path: completed.path.display().to_string(),
                revision_count: completed.revision_count,
                execution_enabled: false,
            })
        }
        Err(error) => {
            let audit_result = record(&AuditEvent::skill(
                operation_id.clone(),
                operation,
                AuditStage::Block,
                AuditOutcome::Blocked,
                Some(
                    u64::try_from(started.elapsed().as_millis())
                        .unwrap_or(u64::MAX)
                        .min(86_400_000),
                ),
                Some(format!("sha256:{source_sha256}")),
                "SKILL_TRANSITION_BLOCKED",
            )?);
            match audit_result {
                Ok(()) => Err(format!("{error} (operación {operation_id})")),
                Err(audit_error) => Err(format!(
                    "{error}; además falló el cierre R3 de {operation_id}: {audit_error}"
                )),
            }
        }
    }
}

fn validate_transition_input(input: &SkillLifecycleTransitionInput) -> Result<(), String> {
    validate_skill_id(&input.skill_id)?;
    validate_uuid_v4("expectedRevisionId", &input.expected_revision_id)?;
    if !input.confirmation.confirmed {
        return Err("La transición requiere confirmación explícita del propietario local".into());
    }
    if !valid_sha256(&input.confirmation.expected_sha256) {
        return Err("confirmation.expectedSha256 no es una huella SHA-256 válida".into());
    }
    validate_text("confirmation.reason", &input.confirmation.reason, 300)
}

fn source_digest_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: &SkillLifecycleTransitionInput,
) -> Result<String, String> {
    if input.action == SkillLifecycleAction::SubmitReview {
        let draft = read_skill_draft_at(data_root, registry, &input.skill_id)?;
        validate_source_binding(&draft.manifest.revision_id, &draft.sha256, input)?;
        Ok(draft.sha256)
    } else {
        let skills_root = data_root.join("skills");
        let (index, existed) = read_lifecycle_index(&skills_root)?;
        if !existed {
            return Err("La habilidad todavía no tiene un ciclo de vida iniciado".into());
        }
        let entry = current_entry(&index, &input.skill_id)?;
        let revision = load_revision(&skills_root, registry, revision_entry(&index, entry)?)?;
        validate_source_binding(&revision.manifest.revision_id, &revision.sha256, input)?;
        Ok(revision.sha256)
    }
}

fn validate_source_binding(
    revision_id: &str,
    sha256: &str,
    input: &SkillLifecycleTransitionInput,
) -> Result<(), String> {
    if revision_id != input.expected_revision_id || sha256 != input.confirmation.expected_sha256 {
        return Err(
            "Conflicto de revisión: la decisión no coincide con el contenido revisado".into(),
        );
    }
    Ok(())
}

struct CompletedTransition {
    manifest: SkillManifest,
    sha256: String,
    path: PathBuf,
    revision_count: usize,
}

fn transition_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    input: &SkillLifecycleTransitionInput,
) -> Result<CompletedTransition, String> {
    registry.validate()?;
    let skills_root = data_root.join("skills");
    let (mut index, index_existed) = read_lifecycle_index(&skills_root)?;
    load_all_revisions(&skills_root, registry, &index)?;

    let (source, current_status) = if input.action == SkillLifecycleAction::SubmitReview {
        let draft = read_skill_draft_at(data_root, registry, &input.skill_id)?;
        validate_source_binding(&draft.manifest.revision_id, &draft.sha256, input)?;
        let current_status = index
            .skills
            .iter()
            .find(|entry| entry.skill_id == input.skill_id)
            .map(|entry| revision_entry(&index, entry))
            .transpose()?
            .map(|entry| entry.status);
        (draft.manifest, current_status)
    } else {
        let entry = current_entry(&index, &input.skill_id)?;
        let revision = load_revision(&skills_root, registry, revision_entry(&index, entry)?)?;
        validate_source_binding(&revision.manifest.revision_id, &revision.sha256, input)?;
        let status = revision.manifest.status;
        (revision.manifest, Some(status))
    };

    validate_transition(input.action, current_status)?;
    let source_revision_id = source.revision_id.clone();
    let current = index
        .skills
        .iter()
        .find(|entry| entry.skill_id == input.skill_id)
        .map(|entry| revision_entry(&index, entry))
        .transpose()?;
    let next_version = match (input.action, current) {
        (SkillLifecycleAction::SubmitReview, Some(previous))
            if matches!(
                previous.status,
                SkillStatus::Approved | SkillStatus::Disabled
            ) =>
        {
            previous
                .version
                .checked_add(1)
                .ok_or("La versión de la habilidad excede el rango admitido")?
        }
        (SkillLifecycleAction::SubmitReview, Some(previous)) => previous.version,
        (_, Some(previous)) => previous.version,
        _ => source.version,
    };
    let parent_revision_id = current
        .map(|entry| entry.revision_id.clone())
        .unwrap_or(source_revision_id);
    let source_archive =
        (input.action == SkillLifecycleAction::SubmitReview).then(|| source.clone());
    let mut target = source;
    target.version = next_version;
    target.revision_id = Uuid::new_v4().to_string();
    target.provenance.parent_revision_id = Some(parent_revision_id);
    target.provenance.updated_at = current_utc_timestamp()?;
    target.status = input.action.target();
    target.validate_against_registry(registry)?;
    if target.execution.enabled
        || target.execution.allow_network
        || target.execution.allow_process_launch
        || target.execution.allow_local_write
    {
        return Err("Una transición R4.4 no puede habilitar ejecución ni efectos".into());
    }

    let target_bytes = serialize_json(&target)?;
    if target_bytes.len() > MAX_SKILL_FILE_BYTES {
        return Err(format!(
            "La revisión excede el límite de {MAX_SKILL_FILE_BYTES} bytes"
        ));
    }
    let target_sha256 = sha256_hex(&target_bytes);
    let mut created_paths = Vec::new();
    let create_revisions = (|| {
        if input.action == SkillLifecycleAction::SubmitReview {
            let source_manifest = source_archive
                .as_ref()
                .ok_or("No se conservó el borrador fuente")?;
            let source_bytes = serialize_json(source_manifest)?;
            let source_digest = sha256_hex(&source_bytes);
            ensure_revision(
                &skills_root,
                &mut index,
                source_manifest,
                &source_bytes,
                &source_digest,
                &mut created_paths,
            )?;
        }
        ensure_revision(
            &skills_root,
            &mut index,
            &target,
            &target_bytes,
            &target_sha256,
            &mut created_paths,
        )
    })();
    if let Err(error) = create_revisions {
        rollback_created(&created_paths)?;
        return Err(error);
    }

    let target_path = revision_path(&skills_root, &target.skill_id, &target.revision_id);
    if let Some(entry) = index
        .skills
        .iter_mut()
        .find(|entry| entry.skill_id == target.skill_id)
    {
        entry.current_revision_id = target.revision_id.clone();
    } else {
        if index.skills.len() >= MAX_LIFECYCLE_SKILLS {
            rollback_created(&created_paths)?;
            return Err("El ciclo de vida excede el máximo de habilidades".into());
        }
        index.skills.push(SkillLifecycleIndexEntry {
            skill_id: target.skill_id.clone(),
            current_revision_id: target.revision_id.clone(),
        });
    }
    index
        .skills
        .sort_by(|left, right| left.skill_id.cmp(&right.skill_id));
    index.updated_at_ms = u64::try_from(timestamp_ms()?)
        .map_err(|_| "La fecha del sistema excede el rango admitido")?;
    if let Err(error) = validate_lifecycle_index(&index) {
        rollback_created(&created_paths)?;
        return Err(error);
    }

    let lifecycle_path = skills_root.join("lifecycle.json");
    let lifecycle_backup_path = skills_root.join("backups/lifecycle.backup.json");
    let previous_index = if index_existed {
        Some(read_bounded(&lifecycle_path, MAX_SKILL_FILE_BYTES)?)
    } else {
        None
    };
    let previous_backup = read_optional_bounded(&lifecycle_backup_path, MAX_SKILL_FILE_BYTES)?;
    let index_bytes = serialize_json(&index)?;
    let write_result = (|| {
        fs::create_dir_all(skills_root.join("backups"))
            .map_err(|error| format!("No se pudo crear el respaldo de lifecycle: {error}"))?;
        if let Some(previous) = &previous_index {
            atomic_replace(&lifecycle_backup_path, previous)?;
        }
        atomic_replace(&lifecycle_path, &index_bytes)
    })();
    if let Err(error) = write_result {
        let cleanup = rollback_created(&created_paths);
        let restore_index = restore_optional(&lifecycle_path, previous_index.as_deref());
        let restore_backup = restore_optional(&lifecycle_backup_path, previous_backup.as_deref());
        return Err(format!(
            "No se pudo confirmar el índice de ciclo de vida: {error}; limpieza={cleanup:?}; índice={restore_index:?}; respaldo={restore_backup:?}"
        ));
    }

    let revision_count = index
        .revisions
        .iter()
        .filter(|entry| entry.skill_id == target.skill_id)
        .count();
    Ok(CompletedTransition {
        manifest: target,
        sha256: target_sha256,
        path: target_path,
        revision_count,
    })
}

fn validate_transition(
    action: SkillLifecycleAction,
    current: Option<SkillStatus>,
) -> Result<(), String> {
    let allowed = match action {
        SkillLifecycleAction::SubmitReview => !matches!(current, Some(SkillStatus::Retired)),
        SkillLifecycleAction::Approve => current == Some(SkillStatus::InReview),
        SkillLifecycleAction::Disable => current == Some(SkillStatus::Approved),
        SkillLifecycleAction::Restore => current == Some(SkillStatus::Disabled),
        SkillLifecycleAction::Retire => {
            matches!(current, Some(SkillStatus::Approved | SkillStatus::Disabled))
        }
    };
    if allowed {
        Ok(())
    } else {
        Err(format!(
            "La transición {:?} no está permitida desde el estado actual",
            action
        ))
    }
}

fn ensure_revision(
    skills_root: &Path,
    index: &mut SkillLifecycleIndex,
    manifest: &SkillManifest,
    bytes: &[u8],
    digest: &str,
    created_paths: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if let Some(existing) = index
        .revisions
        .iter()
        .find(|entry| entry.revision_id == manifest.revision_id)
    {
        if existing.skill_id != manifest.skill_id || existing.sha256 != digest {
            return Err("Una revisión existente colisiona con contenido diferente".into());
        }
        let existing_path = revision_path(skills_root, &existing.skill_id, &existing.revision_id);
        let existing_bytes = read_bounded(&existing_path, MAX_SKILL_FILE_BYTES)?;
        if sha256_hex(&existing_bytes) != digest || existing_bytes != bytes {
            return Err("Una revisión indexada no conserva sus bytes inmutables".into());
        }
        return Ok(());
    }
    if index.revisions.len() >= MAX_SKILL_REVISIONS {
        return Err("El historial excede el máximo de revisiones".into());
    }
    let file_name = revision_file_name(&manifest.revision_id);
    let path = revision_path(skills_root, &manifest.skill_id, &manifest.revision_id);
    write_new_revision(&path, bytes)?;
    created_paths.push(path);
    index.revisions.push(SkillRevisionIndexEntry {
        skill_id: manifest.skill_id.clone(),
        version: manifest.version,
        revision_id: manifest.revision_id.clone(),
        parent_revision_id: manifest.provenance.parent_revision_id.clone(),
        status: manifest.status,
        sha256: digest.to_string(),
        file_name,
    });
    index.revisions.sort_by(|left, right| {
        left.skill_id
            .cmp(&right.skill_id)
            .then_with(|| left.version.cmp(&right.version))
            .then_with(|| left.revision_id.cmp(&right.revision_id))
    });
    Ok(())
}

fn write_new_revision(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("La revisión no tiene carpeta padre")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("No se pudo crear la carpeta de revisiones: {error}"))?;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|error| format!("No se pudo crear la revisión inmutable: {error}"))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("No se pudo persistir la revisión inmutable: {error}"))
}

fn rollback_created(paths: &[PathBuf]) -> Result<(), String> {
    for path in paths.iter().rev() {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|error| format!("No se pudo retirar '{}': {error}", path.display()))?;
        }
    }
    Ok(())
}

fn restore_optional(path: &Path, bytes: Option<&[u8]>) -> Result<(), String> {
    match bytes {
        Some(bytes) => atomic_replace(path, bytes),
        None if path.exists() => fs::remove_file(path)
            .map_err(|error| format!("No se pudo retirar '{}': {error}", path.display())),
        None => Ok(()),
    }
}

fn empty_lifecycle_index() -> SkillLifecycleIndex {
    SkillLifecycleIndex {
        schema_version: SKILL_LIFECYCLE_SCHEMA_VERSION,
        format: SKILL_LIFECYCLE_FORMAT.into(),
        updated_at_ms: 0,
        skills: vec![],
        revisions: vec![],
    }
}

fn read_lifecycle_index(skills_root: &Path) -> Result<(SkillLifecycleIndex, bool), String> {
    let path = skills_root.join("lifecycle.json");
    if !path.exists() {
        return Ok((empty_lifecycle_index(), false));
    }
    let bytes = read_bounded(&path, MAX_SKILL_FILE_BYTES)?;
    let index: SkillLifecycleIndex = serde_json::from_slice(&bytes)
        .map_err(|error| format!("data/skills/lifecycle.json no es válido: {error}"))?;
    validate_lifecycle_index(&index)?;
    Ok((index, true))
}

fn validate_lifecycle_index(index: &SkillLifecycleIndex) -> Result<(), String> {
    if index.schema_version != SKILL_LIFECYCLE_SCHEMA_VERSION
        || index.format != SKILL_LIFECYCLE_FORMAT
        || index.updated_at_ms == 0
        || index.skills.len() > MAX_LIFECYCLE_SKILLS
        || index.revisions.len() > MAX_SKILL_REVISIONS
    {
        return Err("El índice de ciclo de vida no usa el formato R4.4 esperado".into());
    }
    let mut skill_ids = HashSet::new();
    let mut revisions = HashMap::new();
    let mut files = HashSet::new();
    for revision in &index.revisions {
        validate_skill_id(&revision.skill_id)?;
        validate_uuid_v4("revision.revisionId", &revision.revision_id)?;
        if revision.version == 0
            || revision.file_name != revision_file_name(&revision.revision_id)
            || !valid_sha256(&revision.sha256)
            || !files.insert((revision.skill_id.as_str(), revision.file_name.as_str()))
            || revisions
                .insert(revision.revision_id.as_str(), revision)
                .is_some()
        {
            return Err("El historial contiene una revisión inválida o repetida".into());
        }
        if let Some(parent) = &revision.parent_revision_id {
            validate_uuid_v4("revision.parentRevisionId", parent)?;
            if parent == &revision.revision_id {
                return Err("Una revisión no puede ser su propio padre".into());
            }
        }
    }
    for entry in &index.skills {
        validate_skill_id(&entry.skill_id)?;
        if !skill_ids.insert(entry.skill_id.as_str()) {
            return Err("El ciclo de vida contiene habilidades repetidas".into());
        }
        let current = revisions
            .get(entry.current_revision_id.as_str())
            .ok_or("El estado actual apunta a una revisión inexistente")?;
        if current.skill_id != entry.skill_id || current.status == SkillStatus::Draft {
            return Err("El estado actual no coincide con su revisión".into());
        }
    }
    Ok(())
}

fn current_entry<'a>(
    index: &'a SkillLifecycleIndex,
    skill_id: &str,
) -> Result<&'a SkillLifecycleIndexEntry, String> {
    index
        .skills
        .iter()
        .find(|entry| entry.skill_id == skill_id)
        .ok_or_else(|| format!("La habilidad '{skill_id}' no tiene un estado de ciclo de vida"))
}

fn revision_entry<'a>(
    index: &'a SkillLifecycleIndex,
    current: &SkillLifecycleIndexEntry,
) -> Result<&'a SkillRevisionIndexEntry, String> {
    index
        .revisions
        .iter()
        .find(|entry| entry.revision_id == current.current_revision_id)
        .ok_or_else(|| "El estado actual apunta a una revisión inexistente".into())
}

fn revision_file_name(revision_id: &str) -> String {
    format!("{revision_id}.json")
}

fn revision_path(skills_root: &Path, skill_id: &str, revision_id: &str) -> PathBuf {
    skills_root
        .join("revisions")
        .join(skill_id)
        .join(revision_file_name(revision_id))
}

fn load_revision(
    skills_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    entry: &SkillRevisionIndexEntry,
) -> Result<LoadedRevision, String> {
    let path = revision_path(skills_root, &entry.skill_id, &entry.revision_id);
    let bytes = read_bounded(&path, MAX_SKILL_FILE_BYTES)?;
    let digest = sha256_hex(&bytes);
    if digest != entry.sha256 {
        return Err(format!(
            "La integridad SHA-256 de la revisión '{}' no coincide",
            entry.revision_id
        ));
    }
    let manifest: SkillManifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("La revisión '{}' no es válida: {error}", entry.revision_id))?;
    manifest.validate_against_registry(registry)?;
    if manifest.skill_id != entry.skill_id
        || manifest.version != entry.version
        || manifest.revision_id != entry.revision_id
        || manifest.provenance.parent_revision_id != entry.parent_revision_id
        || manifest.status != entry.status
    {
        return Err("La revisión no coincide con el índice de ciclo de vida".into());
    }
    Ok(LoadedRevision {
        manifest,
        sha256: digest,
    })
}

fn load_all_revisions(
    skills_root: &Path,
    registry: &CapabilityRegistrySnapshot,
    index: &SkillLifecycleIndex,
) -> Result<Vec<LoadedRevision>, String> {
    index
        .revisions
        .iter()
        .map(|entry| load_revision(skills_root, registry, entry))
        .collect()
}

fn skill_lifecycle_status_at(
    data_root: &Path,
    registry: &CapabilityRegistrySnapshot,
) -> Result<SkillLifecycleSnapshot, String> {
    let skills_root = data_root.join("skills");
    let (index, existed) = read_lifecycle_index(&skills_root)?;
    if !existed {
        return Ok(SkillLifecycleSnapshot {
            schema_version: SKILL_LIFECYCLE_SCHEMA_VERSION,
            storage_path: skills_root.display().to_string(),
            existed: false,
            skills: vec![],
        });
    }
    let loaded = load_all_revisions(&skills_root, registry, &index)?;
    let by_revision = loaded
        .iter()
        .map(|item| (item.manifest.revision_id.as_str(), item))
        .collect::<HashMap<_, _>>();
    let mut skills = index
        .skills
        .iter()
        .map(|entry| {
            let current = by_revision
                .get(entry.current_revision_id.as_str())
                .ok_or("El estado actual no pudo resolverse")?;
            Ok(SkillLifecycleSummary {
                skill_id: current.manifest.skill_id.clone(),
                title: current.manifest.title.clone(),
                version: current.manifest.version,
                revision_id: current.manifest.revision_id.clone(),
                status: current.manifest.status,
                updated_at: current.manifest.provenance.updated_at.clone(),
                sha256: current.sha256.clone(),
                revision_count: index
                    .revisions
                    .iter()
                    .filter(|revision| revision.skill_id == entry.skill_id)
                    .count(),
                execution_enabled: false,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    skills.sort_by(|left, right| left.skill_id.cmp(&right.skill_id));
    Ok(SkillLifecycleSnapshot {
        schema_version: SKILL_LIFECYCLE_SCHEMA_VERSION,
        storage_path: skills_root.display().to_string(),
        existed: true,
        skills,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::{append_event_at, AUDIT_MAX_BYTES};
    use crate::capabilities::{capability_registry_from_probes, CapabilityProbeSnapshot};
    use crate::skills::tests::{manifest, registry};
    use sha2::{Digest, Sha256};

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            Self {
                root: std::env::temp_dir().join(format!("alice-r4-lifecycle-{}", Uuid::new_v4())),
            }
        }

        fn save_draft(&self) -> super::super::SkillDraftRecord {
            super::super::save_skill_draft_at(
                &self.root,
                &registry(),
                super::super::SkillDraftSaveInput {
                    manifest: manifest(),
                    expected_revision_id: None,
                },
            )
            .expect("save real draft fixture")
        }

        fn transition(
            &self,
            action: SkillLifecycleAction,
            revision_id: String,
            digest: String,
        ) -> Result<SkillLifecycleTransitionResult, String> {
            let root = self.root.clone();
            audited_transition_at(
                &self.root,
                &registry(),
                SkillLifecycleTransitionInput {
                    skill_id: "local.revisar-memoria".into(),
                    expected_revision_id: revision_id,
                    action,
                    confirmation: SkillLifecycleConfirmation {
                        actor: SkillLifecycleActor::LocalOwner,
                        confirmed: true,
                        expected_sha256: digest,
                        reason: "Decisión local visible; este texto privado no va a auditoría"
                            .into(),
                    },
                },
                move |event| append_event_at(&root, event, AUDIT_MAX_BYTES),
            )
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            if self.root.exists() {
                fs::remove_dir_all(&self.root).expect("remove isolated lifecycle fixture");
            }
        }
    }

    #[test]
    fn real_lifecycle_files_preserve_approved_revision_and_correlated_audit() {
        let fixture = Fixture::new();
        let draft = fixture.save_draft();
        let review = fixture
            .transition(
                SkillLifecycleAction::SubmitReview,
                draft.manifest.revision_id,
                draft.sha256,
            )
            .unwrap();
        assert_eq!(review.manifest.status, SkillStatus::InReview);
        assert_eq!(review.revision_count, 2);
        assert!(!review.execution_enabled);

        let approved = fixture
            .transition(
                SkillLifecycleAction::Approve,
                review.manifest.revision_id,
                review.sha256,
            )
            .unwrap();
        let approved_bytes = fs::read(&approved.storage_path).unwrap();
        assert_eq!(approved.manifest.status, SkillStatus::Approved);
        assert!(!approved.manifest.execution.enabled);

        let disabled = fixture
            .transition(
                SkillLifecycleAction::Disable,
                approved.manifest.revision_id,
                approved.sha256,
            )
            .unwrap();
        let restored = fixture
            .transition(
                SkillLifecycleAction::Restore,
                disabled.manifest.revision_id,
                disabled.sha256,
            )
            .unwrap();
        let retired = fixture
            .transition(
                SkillLifecycleAction::Retire,
                restored.manifest.revision_id,
                restored.sha256,
            )
            .unwrap();

        assert_eq!(retired.manifest.status, SkillStatus::Retired);
        assert_eq!(retired.revision_count, 6);
        assert_eq!(fs::read(&approved.storage_path).unwrap(), approved_bytes);
        let snapshot = skill_lifecycle_status_at(&fixture.root, &registry()).unwrap();
        assert_eq!(snapshot.skills.len(), 1);
        assert_eq!(snapshot.skills[0].status, SkillStatus::Retired);
        assert_eq!(snapshot.skills[0].revision_count, 6);
        assert!(!snapshot.skills[0].execution_enabled);

        let audit = fs::read_to_string(fixture.root.join("audit/events-v1.jsonl")).unwrap();
        let events = audit
            .lines()
            .map(|line| serde_json::from_str::<AuditEvent>(line).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(events.len(), 10);
        assert!(events
            .iter()
            .all(|event| event.source == crate::audit::AuditSource::Skill));
        for pair in events.chunks_exact(2) {
            assert_eq!(pair[0].operation_id, pair[1].operation_id);
            assert_eq!(pair[0].stage, AuditStage::Request);
            assert_eq!(pair[1].stage, AuditStage::Execution);
        }
        assert!(!audit.contains("este texto privado"));
    }

    #[test]
    fn r5_provenance_survives_review_and_new_approved_revision() {
        let fixture = Fixture::new();
        let mut source = manifest();
        source.provenance.procedure = Some(super::super::SkillProcedureProvenance {
            decision_id: Uuid::new_v4().to_string(),
            candidate_id: Uuid::new_v4().to_string(),
            fingerprint: format!("sha256:{}", "a".repeat(64)),
            candidate_sha256: format!("sha256:{}", "b".repeat(64)),
        });
        let draft = super::super::save_skill_draft_at(
            &fixture.root,
            &registry(),
            super::super::SkillDraftSaveInput {
                manifest: source,
                expected_revision_id: None,
            },
        )
        .unwrap();
        let expected = draft.manifest.provenance.procedure.clone();
        let source_revision_id = draft.manifest.revision_id.clone();
        let review = fixture
            .transition(
                SkillLifecycleAction::SubmitReview,
                source_revision_id.clone(),
                draft.sha256,
            )
            .unwrap();
        let approved = fixture
            .transition(
                SkillLifecycleAction::Approve,
                review.manifest.revision_id,
                review.sha256,
            )
            .unwrap();
        let disabled = fixture
            .transition(
                SkillLifecycleAction::Disable,
                approved.manifest.revision_id.clone(),
                approved.sha256.clone(),
            )
            .unwrap();
        let restored = fixture
            .transition(
                SkillLifecycleAction::Restore,
                disabled.manifest.revision_id,
                disabled.sha256,
            )
            .unwrap();

        assert_eq!(approved.manifest.version, 1);
        assert_ne!(approved.manifest.revision_id, source_revision_id);
        assert_eq!(approved.manifest.provenance.procedure, expected);
        assert_eq!(restored.manifest.status, SkillStatus::Approved);
        assert_eq!(restored.manifest.provenance.procedure, expected);
        assert!(!approved.manifest.execution.enabled);
        assert!(!restored.manifest.execution.enabled);
    }

    #[test]
    fn wrong_transition_is_blocked_and_leaves_current_revision_unchanged() {
        let fixture = Fixture::new();
        let draft = fixture.save_draft();
        let review = fixture
            .transition(
                SkillLifecycleAction::SubmitReview,
                draft.manifest.revision_id,
                draft.sha256,
            )
            .unwrap();
        let before = fs::read(&review.storage_path).unwrap();
        let error = fixture
            .transition(
                SkillLifecycleAction::Disable,
                review.manifest.revision_id.clone(),
                review.sha256,
            )
            .unwrap_err();
        assert!(error.contains("no está permitida"));
        assert_eq!(fs::read(&review.storage_path).unwrap(), before);
        let snapshot = skill_lifecycle_status_at(&fixture.root, &registry()).unwrap();
        assert_eq!(snapshot.skills[0].revision_id, review.manifest.revision_id);
        let audit = fs::read_to_string(fixture.root.join("audit/events-v1.jsonl")).unwrap();
        let last: AuditEvent = serde_json::from_str(audit.lines().last().unwrap()).unwrap();
        assert_eq!(last.stage, AuditStage::Block);
        assert_eq!(last.outcome, AuditOutcome::Blocked);
    }

    #[test]
    fn request_audit_failure_prevents_any_lifecycle_write() {
        let fixture = Fixture::new();
        let draft = fixture.save_draft();
        let error = audited_transition_at(
            &fixture.root,
            &registry(),
            SkillLifecycleTransitionInput {
                skill_id: draft.manifest.skill_id.clone(),
                expected_revision_id: draft.manifest.revision_id,
                action: SkillLifecycleAction::SubmitReview,
                confirmation: SkillLifecycleConfirmation {
                    actor: SkillLifecycleActor::LocalOwner,
                    confirmed: true,
                    expected_sha256: draft.sha256,
                    reason: "Confirmación local".into(),
                },
            },
            |_| Err("auditoría no disponible".into()),
        )
        .unwrap_err();
        assert!(error.contains("auditoría no disponible"));
        assert!(!fixture.root.join("skills/lifecycle.json").exists());
        assert!(!fixture.root.join("skills/revisions").exists());
    }

    #[test]
    fn tampered_immutable_revision_is_detected_without_repair() {
        let fixture = Fixture::new();
        let draft = fixture.save_draft();
        let review = fixture
            .transition(
                SkillLifecycleAction::SubmitReview,
                draft.manifest.revision_id,
                draft.sha256,
            )
            .unwrap();
        fs::write(&review.storage_path, b"{}\n").unwrap();
        let error = skill_lifecycle_status_at(&fixture.root, &registry()).unwrap_err();
        assert!(error.contains("integridad SHA-256"));
        assert_eq!(fs::read(&review.storage_path).unwrap(), b"{}\n");
    }

    fn collect_files(root: &Path, current: &Path, files: &mut Vec<PathBuf>) {
        for entry in fs::read_dir(current).expect("read canonical data directory") {
            let path = entry.expect("read canonical data entry").path();
            if path.is_dir() {
                collect_files(root, &path, files);
            } else {
                assert!(path.starts_with(root));
                files.push(path);
            }
        }
    }

    fn directory_digest(root: &Path) -> (usize, String) {
        let mut files = Vec::new();
        collect_files(root, root, &mut files);
        files.sort();
        let mut hasher = Sha256::new();
        for path in &files {
            hasher.update(
                path.strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .as_bytes(),
            );
            hasher.update([0]);
            hasher.update(fs::read(path).expect("read canonical data file"));
            hasher.update([0xff]);
        }
        (files.len(), format!("{:x}", hasher.finalize()))
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_lifecycle_status_is_read_only() {
        let root = PathBuf::from(
            std::env::var_os("ALICE_LIVE_DATA_DIR")
                .expect("ALICE_LIVE_DATA_DIR is required for the live R4.4 probe"),
        );
        assert!(root.is_absolute() && root.is_dir());
        let before = directory_digest(&root);
        let probes = CapabilityProbeSnapshot::collect(
            &root,
            &ObservationStore::default(),
            &SensorLeaseStore::default(),
        );
        let live_registry =
            capability_registry_from_probes("2026-08-10T12:00:00-03:00".into(), &probes).unwrap();
        let snapshot = skill_lifecycle_status_at(&root, &live_registry).unwrap();
        assert!(!snapshot.existed);
        assert!(snapshot.skills.is_empty());
        assert_eq!(directory_digest(&root), before);
    }
}
