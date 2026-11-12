//! Local resources are private and configurable; Windows executables are never
//! reused on Linux. Defaults preserve this notebook's evaluated installation.
use std::path::{Path, PathBuf};

pub(crate) fn local_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a project parent")
        .join("local")
}

fn configured(
    value: Option<std::ffi::OsString>,
    name: &str,
    fallback: PathBuf,
) -> Result<PathBuf, String> {
    let path = value
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .unwrap_or(fallback);
    if !path.is_absolute() {
        return Err(format!("{name} debe contener una ruta absoluta"));
    }
    Ok(path)
}

fn resource(name: &str, fallback: PathBuf) -> Result<PathBuf, String> {
    configured(std::env::var_os(name), name, fallback)
}

fn inference_home() -> Result<PathBuf, String> {
    resource(
        "ALICE_INFERENCE_HOME",
        if cfg!(windows) {
            PathBuf::from("D:/Alice-model-evaluation")
        } else {
            local_dir().join("inference")
        },
    )
}

pub(crate) fn llama_server() -> Result<PathBuf, String> {
    resource(
        "ALICE_LLAMA_SERVER",
        inference_home()?.join(if cfg!(windows) {
            "runtimes/llama-b10809/bin/llama-server.exe"
        } else {
            "runtimes/llama/bin/llama-server"
        }),
    )
}

pub(crate) fn gemma_model() -> Result<PathBuf, String> {
    resource(
        "ALICE_GEMMA_MODEL",
        inference_home()?.join("models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf"),
    )
}

pub(crate) fn gemma_projector() -> Result<PathBuf, String> {
    resource(
        "ALICE_GEMMA_PROJECTOR",
        inference_home()?.join("models/gemma4-e2b/mmproj-F16.gguf"),
    )
}

pub(crate) fn whisper_bin() -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("ALICE_WHISPER_BIN").filter(|value| !value.is_empty()) {
        return configured(Some(value), "ALICE_WHISPER_BIN", PathBuf::new());
    }
    configured(
        None,
        "ALICE_WHISPER_BIN",
        inference_home()?.join(if cfg!(windows) {
            "runtimes/whisper-v1.9.2/bin/Release/whisper-cli.exe"
        } else {
            "runtimes/whisper/bin/whisper-cli"
        }),
    )
}

pub(crate) fn whisper_model() -> Result<PathBuf, String> {
    resolve_whisper_model(std::env::var_os("ALICE_WHISPER_MODEL"), inference_home)
}

fn resolve_whisper_model(
    value: Option<std::ffi::OsString>,
    home: impl FnOnce() -> Result<PathBuf, String>,
) -> Result<PathBuf, String> {
    if let Some(value) = value.filter(|value| !value.is_empty()) {
        // An explicit model must not depend on the default installation root.
        return configured(Some(value), "ALICE_WHISPER_MODEL", PathBuf::new());
    }
    let directory = home()?.join("models/whisper");
    let small = directory.join("ggml-small.bin");
    let fallback = match std::fs::metadata(&small) {
        Ok(metadata) if metadata.is_file() => small,
        Ok(_) => return Err("El modelo Whisper small no es un archivo válido".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            directory.join("ggml-base.bin")
        }
        Err(_) => return Err("No se pudo consultar el modelo Whisper small instalado".into()),
    };
    configured(None, "ALICE_WHISPER_MODEL", fallback)
}

pub(crate) fn python() -> Result<PathBuf, String> {
    resource(
        "ALICE_PYTHON_BIN",
        local_dir().join(if cfg!(windows) {
            "venv/Scripts/python.exe"
        } else {
            "venv-linux/bin/python"
        }),
    )
}

pub(crate) fn gpu_layers() -> Result<String, String> {
    let value = std::env::var("ALICE_GPU_LAYERS")
        .unwrap_or_else(|_| if cfg!(windows) { "24" } else { "0" }.into());
    value
        .parse::<u32>()
        .map_err(|_| "ALICE_GPU_LAYERS debe ser un entero positivo o cero")?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_relative_configuration_without_mutating_global_environment() {
        assert!(configured(Some("../private".into()), "TEST_PATH", local_dir()).is_err());
        let path = local_dir().join("directory with spaces/á-model.gguf");
        assert_eq!(
            configured(
                Some(path.clone().into_os_string()),
                "TEST_PATH",
                local_dir()
            )
            .unwrap(),
            path
        );
        assert_eq!(
            configured(None, "TEST_PATH", local_dir()).unwrap(),
            local_dir()
        );
    }

    #[test]
    fn whisper_prefers_small_without_removing_the_base_fallback() {
        let root =
            std::env::temp_dir().join(format!("alice-whisper-paths-{}", uuid::Uuid::new_v4()));
        let directory = root.join("models/whisper");
        std::fs::create_dir_all(&directory).unwrap();
        let base = directory.join("ggml-base.bin");
        let small = directory.join("ggml-small.bin");
        let resolve = || resolve_whisper_model(None, || Ok(root.clone())).unwrap();
        assert_eq!(resolve(), base);
        std::fs::write(&base, b"base-fixture").unwrap();
        assert_eq!(resolve(), base);
        std::fs::write(&small, b"small-fixture").unwrap();
        assert_eq!(resolve(), small);
        assert_eq!(std::fs::read(&base).unwrap(), b"base-fixture");
        let explicit = resolve_whisper_model(Some(base.clone().into_os_string()), || {
            panic!("the explicit override must not resolve defaults")
        })
        .unwrap();
        assert_eq!(explicit, base);
        std::fs::remove_file(small).unwrap();
        assert_eq!(resolve(), base);
        std::fs::remove_file(base).unwrap();
        std::fs::remove_dir(&directory).unwrap();
        std::fs::remove_dir(root.join("models")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn an_explicit_whisper_model_is_not_replaced_by_a_default() {
        let missing = local_dir().join("test-not-installed/explicit-model.bin");
        assert_eq!(
            resolve_whisper_model(Some(missing.clone().into_os_string()), || panic!(
                "explicit override resolves no defaults"
            ))
            .unwrap(),
            missing
        );
        assert!(
            resolve_whisper_model(Some("relative-model.bin".into()), || panic!(
                "invalid override must not use defaults"
            ))
            .is_err()
        );
    }

    #[test]
    fn an_invalid_installed_small_model_does_not_silently_select_base() {
        let root =
            std::env::temp_dir().join(format!("alice-whisper-invalid-{}", uuid::Uuid::new_v4()));
        let small = root.join("models/whisper/ggml-small.bin");
        std::fs::create_dir_all(&small).unwrap();
        assert!(resolve_whisper_model(None, || Ok(root.clone())).is_err());
        std::fs::remove_dir(&small).unwrap();
        std::fs::remove_dir(root.join("models/whisper")).unwrap();
        std::fs::remove_dir(root.join("models")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
