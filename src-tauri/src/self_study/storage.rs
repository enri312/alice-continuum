//! Persistence and serialization under the shared study write lock.
use super::domain::{curriculum, validate_state};
use super::model::StudySnapshot;
use std::{fs, path::Path, sync::Mutex};

pub(super) const FILE: &str = "self-study-v1.json";
pub(super) static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub(super) fn read_at(root: &Path) -> Result<StudySnapshot, String> {
    let file = root.join("memory").join(FILE);
    let metadata = match fs::symlink_metadata(&file) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(StudySnapshot::default())
        }
        Err(_) => return Err("No se pudo consultar el avance de autoestudio".into()),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 1024 * 1024 {
        return Err("El almacen de autoestudio no es valido".into());
    }
    let bytes = fs::read(&file).map_err(|_| "No se pudo leer el avance de autoestudio")?;
    if bytes.len() > 1024 * 1024 {
        return Err("El avance de autoestudio excede su limite".into());
    }
    let state: StudySnapshot = serde_json::from_slice(&bytes)
        .map_err(|_| "El avance de autoestudio no tiene un formato valido")?;
    validate_state(&state, &curriculum()?)?;
    Ok(state)
}

pub(super) fn write_at(root: &Path, state: &StudySnapshot) -> Result<(), String> {
    validate_state(state, &curriculum()?)?;
    let folder = root.join("memory");
    fs::create_dir_all(&folder).map_err(|_| "No se pudo crear el almacen de autoestudio")?;
    let content = serde_json::to_string_pretty(state)
        .map_err(|_| "No se pudo preparar el avance de estudio")?;
    crate::memory::write_study_projection(&folder.join(FILE), &content)
}
pub(super) fn update_at(
    root: &Path,
    update: impl FnOnce(&mut StudySnapshot),
) -> Result<StudySnapshot, String> {
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "El avance de estudio esta ocupado")?;
    let mut state = read_at(root)?;
    update(&mut state);
    write_at(root, &state)?;
    Ok(state)
}
