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
    resource(
        "ALICE_WHISPER_BIN",
        inference_home()?.join(if cfg!(windows) {
            "runtimes/whisper-v1.9.2/bin/Release/whisper-cli.exe"
        } else {
            "runtimes/whisper/bin/whisper-cli"
        }),
    )
}

pub(crate) fn whisper_model() -> Result<PathBuf, String> {
    resource(
        "ALICE_WHISPER_MODEL",
        inference_home()?.join("models/whisper/ggml-base.bin"),
    )
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
}
