//! Native lifecycle and shared arbitration for chat, vision and learning.
//! Explicit runtime controls and shared text, vision and ephemeral voice transport.
use serde::Serialize;
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

const ENGINE: &str = "D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe";
const MODEL: &str = "D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf";
const PROJECTOR: &str = "D:/Alice-model-evaluation/models/gemma4-e2b/mmproj-F16.gguf";
const ADDRESS: &str = "127.0.0.1:18089";

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeSnapshot {
    pub(crate) running: bool,
    pub(crate) owned_pid: Option<u32>,
}

#[derive(Default)]
pub(crate) struct LocalInferenceRuntime {
    child: Mutex<Option<Child>>,
    permit: Mutex<Option<InferencePermit<'static>>>,
    cancel: AtomicBool,
}

pub(crate) const GEMMA_MODEL: &str = "gemma-4-E2B-it-Q4_K_M";
pub(crate) fn installed() -> bool {
    [ENGINE, MODEL, PROJECTOR]
        .iter()
        .all(|p| Path::new(p).is_file())
}
pub(crate) fn runtime() -> Arc<LocalInferenceRuntime> {
    static RUNTIME: OnceLock<Arc<LocalInferenceRuntime>> = OnceLock::new();
    RUNTIME
        .get_or_init(|| Arc::new(LocalInferenceRuntime::default()))
        .clone()
}

#[tauri::command]
pub(crate) async fn local_runtime_status() -> Result<RuntimeSnapshot, String> {
    tauri::async_runtime::spawn_blocking(|| runtime().snapshot())
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn start_local_runtime() -> Result<RuntimeSnapshot, String> {
    tauri::async_runtime::spawn_blocking(|| runtime().start())
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn stop_local_runtime() -> Result<RuntimeSnapshot, String> {
    runtime().cancel.store(true, Ordering::Release);
    tauri::async_runtime::spawn_blocking(|| {
        let r = runtime();
        r.stop()?;
        r.snapshot()
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) async fn gemma_chat(body: serde_json::Value) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = runtime();
        let mut guard = r.child.lock().map_err(|_| "Control del motor bloqueado")?;
        let child = guard
            .as_mut()
            .ok_or("Iniciá Gemma desde Configuración antes de enviar")?;
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            return Err("Gemma terminó; reinicialo desde Configuración".into());
        }
        tauri::async_runtime::block_on(async {
            let http = client()?;
            check_ollama(&http).await?;
            let response = http
                .post("http://127.0.0.1:18089/v1/chat/completions")
                .timeout(Duration::from_secs(180))
                .json(&body)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = response.status();
            let value = response
                .json::<serde_json::Value>()
                .await
                .map_err(|e| e.to_string())?;
            if !status.is_success() {
                return Err(format!("Gemma rechazó la solicitud: HTTP {status}"));
            }
            if value
                .pointer("/choices/0/finish_reason")
                .and_then(|v| v.as_str())
                == Some("length")
            {
                return Err(
                    "Gemma alcanzó el límite de respuesta; no se guardó una respuesta incompleta"
                        .into(),
                );
            }
            Ok(value)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Default)]
struct InferenceArbiter {
    busy: AtomicBool,
}
static ARBITER: InferenceArbiter = InferenceArbiter {
    busy: AtomicBool::new(false),
};

pub(crate) struct InferencePermit<'a> {
    arbiter: &'a InferenceArbiter,
}
impl InferenceArbiter {
    fn acquire(&self) -> Result<InferencePermit<'_>, String> {
        self.busy.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "El motor local está ocupado por otra operación o por Gemma. Esperá a que termine o cerrá su sesión".to_string())?;
        Ok(InferencePermit { arbiter: self })
    }
}
impl Drop for InferencePermit<'_> {
    fn drop(&mut self) {
        self.arbiter.busy.store(false, Ordering::Release);
    }
}

fn validate_resident_model(value: &serde_json::Value, requested: &str) -> Result<(), String> {
    if requested.trim().is_empty() {
        return Err("Modelo local vacío".into());
    }
    let models = value
        .get("models")
        .and_then(|v| v.as_array())
        .ok_or("Estado de Ollama inválido")?;
    if models
        .iter()
        .any(|m| m.get("name").and_then(|v| v.as_str()) != Some(requested))
    {
        return Err("Ollama ya tiene otro modelo cargado. No se cargará un segundo modelo ni se cerrará el ajeno automáticamente".into());
    }
    Ok(())
}

/// Hold through response-body consumption. Dropping on error/cancellation frees
/// the in-process slot; /api/ps additionally checks persistent Ollama residency.
pub(crate) async fn acquire_ollama(model: &str) -> Result<InferencePermit<'static>, String> {
    if port_occupied() {
        return Err("Gemma está iniciado, pero esta solicitud seleccionó Ollama. Elegí Gemma en Configuración y creá una nueva revisión del contexto".into());
    }
    let permit = ARBITER.acquire()?;
    if port_occupied() {
        return Err("Gemma comenzó a iniciarse mientras se preparaba Ollama. Reintentá después de elegir un solo motor".into());
    }
    let response = client()?
        .get("http://127.0.0.1:11434/api/ps")
        .send()
        .await
        .map_err(|_| "No se pudo verificar qué modelo tiene cargado Ollama")?;
    if !response.status().is_success() {
        return Err("Ollama no pudo informar los modelos residentes".into());
    }
    validate_resident_model(
        &response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())?,
        model,
    )?;
    Ok(permit)
}

fn ollama_is_idle(value: &serde_json::Value) -> Result<(), String> {
    let models = value
        .get("models")
        .and_then(|v| v.as_array())
        .ok_or("Ollama no devolvió un estado válido; no se iniciará otro modelo")?;
    if models.is_empty() {
        Ok(())
    } else {
        Err("Ollama tiene un modelo cargado. Cerrá esa sesión antes de iniciar Gemma; no se descargará un modelo ajeno automáticamente".into())
    }
}

fn port_occupied() -> bool {
    let addr: SocketAddr = ADDRESS.parse().expect("fixed loopback address");
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

pub(crate) fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())
}

async fn check_ollama(client: &reqwest::Client) -> Result<(), String> {
    let response = client
        .get("http://127.0.0.1:11434/api/ps")
        .send()
        .await
        .map_err(|_| "No se pudo verificar Ollama; inicio cancelado para evitar dos modelos")?;
    if !response.status().is_success() {
        return Err("No se pudo verificar el estado de Ollama".into());
    }
    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    ollama_is_idle(&body)
}

fn stop_owned(child: &mut Option<Child>) -> Result<(), String> {
    if let Some(process) = child.as_mut() {
        match process.try_wait().map_err(|e| e.to_string())? {
            Some(_) => {}
            None => {
                process.kill().map_err(|e| e.to_string())?;
                process.wait().map_err(|e| e.to_string())?;
            }
        }
        *child = None;
    }
    Ok(())
}

impl LocalInferenceRuntime {
    pub(crate) fn snapshot(&self) -> Result<RuntimeSnapshot, String> {
        let mut child = self
            .child
            .lock()
            .map_err(|_| "Control de motor bloqueado")?;
        if let Some(process) = child.as_mut() {
            if process.try_wait().map_err(|e| e.to_string())?.is_some() {
                *child = None;
                self.permit
                    .lock()
                    .map_err(|_| "Control de uso bloqueado")?
                    .take();
            }
        }
        Ok(RuntimeSnapshot {
            running: child.is_some(),
            owned_pid: child.as_ref().map(Child::id),
        })
    }

    /// Call only on a blocking worker. Serialized startup prevents two owned
    /// children; stop and status wait at most the bounded readiness handshake.
    pub(crate) fn start(&self) -> Result<RuntimeSnapshot, String> {
        self.cancel.store(false, Ordering::Release);
        let mut guard = self
            .child
            .lock()
            .map_err(|_| "Control de motor bloqueado")?;
        if let Some(child) = guard.as_mut() {
            if child.try_wait().map_err(|e| e.to_string())?.is_none() {
                return Ok(RuntimeSnapshot {
                    running: true,
                    owned_pid: Some(child.id()),
                });
            }
            *guard = None;
            self.permit
                .lock()
                .map_err(|_| "Control de uso bloqueado")?
                .take();
        }
        let permit = ARBITER.acquire()?;
        let http = client()?;
        tauri::async_runtime::block_on(check_ollama(&http))?;
        if port_occupied() {
            return Err(
                "El puerto local pertenece a otro proceso; no se adoptará ni cerrará".into(),
            );
        }
        for file in [ENGINE, MODEL, PROJECTOR] {
            if !Path::new(file).is_file() {
                return Err(format!("Falta un archivo del motor evaluado: {file}"));
            }
        }
        let mut command = Command::new(ENGINE);
        command
            .args([
                "-m",
                MODEL,
                "--mmproj",
                PROJECTOR,
                "--host",
                "127.0.0.1",
                "--port",
                "18089",
                "-c",
                "4096",
                "-np",
                "1",
                "-ngl",
                "24",
                "--mmproj-offload",
                "--reasoning",
                "off",
                "--jinja",
                "-t",
                "8",
                "--cors-origins",
                "http://127.0.0.1:18089",
                "--no-cors-credentials",
                "--no-agent",
                "--image-min-tokens",
                "1120",
                "--image-max-tokens",
                "1120",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x0800_0000);
        }
        *guard = Some(
            command
                .spawn()
                .map_err(|e| format!("No se pudo iniciar Gemma: {e}"))?,
        );
        let result = tauri::async_runtime::block_on(async {
            let deadline = Instant::now() + Duration::from_secs(60);
            while Instant::now() < deadline {
                if self.cancel.load(Ordering::Acquire) {
                    return Err("Inicio cancelado por el usuario".into());
                }
                if guard
                    .as_mut()
                    .expect("owned child")
                    .try_wait()
                    .map_err(|e| e.to_string())?
                    .is_some()
                {
                    return Err("El motor terminó antes de estar listo".into());
                }
                if let Ok(response) = http.get("http://127.0.0.1:18089/health").send().await {
                    if response.status().is_success() {
                        check_ollama(&http).await?;
                        return Ok(RuntimeSnapshot {
                            running: true,
                            owned_pid: guard.as_ref().map(Child::id),
                        });
                    }
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err("Gemma no estuvo listo dentro del plazo de inicio".into())
        });
        if result.is_err() {
            stop_owned(&mut guard)?;
        } else {
            *self.permit.lock().map_err(|_| "Control de uso bloqueado")? = Some(permit);
        }
        result
    }

    pub(crate) fn stop(&self) -> Result<(), String> {
        let mut guard = self
            .child
            .lock()
            .map_err(|_| "Control de motor bloqueado")?;
        stop_owned(&mut guard)?;
        self.permit
            .lock()
            .map_err(|_| "Control de uso bloqueado")?
            .take();
        Ok(())
    }
}

impl Drop for LocalInferenceRuntime {
    fn drop(&mut self) {
        let inner = self
            .child
            .get_mut()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let _ = stop_owned(inner);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn arbitration_releases_on_drop_and_rejects_overlap() {
        let arbiter = InferenceArbiter::default();
        let held = arbiter.acquire().unwrap();
        assert!(arbiter.acquire().is_err());
        drop(held);
        assert!(arbiter.acquire().is_ok());
    }
    #[test]
    fn simultaneous_callers_have_only_one_winner() {
        let arbiter = InferenceArbiter::default();
        let barrier = std::sync::Barrier::new(8);
        let winners = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|scope| {
            for _ in 0..8 {
                scope.spawn(|| {
                    let permit = arbiter.acquire();
                    if permit.is_ok() {
                        winners.fetch_add(1, Ordering::SeqCst);
                    }
                    // The winning permit remains alive until all attempts finish.
                    barrier.wait();
                    drop(permit);
                });
            }
        });
        assert_eq!(winners.load(Ordering::SeqCst), 1);
        assert!(arbiter.acquire().is_ok());
    }
    #[test]
    fn failing_operation_releases_its_permit() {
        let arbiter = InferenceArbiter::default();
        let result: Result<(), String> = (|| {
            let _permit = arbiter.acquire()?;
            Err("operation failed".into())
        })();
        assert!(result.is_err());
        assert!(arbiter.acquire().is_ok());
    }
    #[test]
    fn only_requested_resident_model_is_allowed() {
        assert!(validate_resident_model(&serde_json::json!({"models":[]}), "qwen3.5:4b").is_ok());
        assert!(validate_resident_model(
            &serde_json::json!({"models":[{"name":"qwen3.5:4b"}]}),
            "qwen3.5:4b"
        )
        .is_ok());
        for value in [
            serde_json::json!({}),
            serde_json::json!({"models":[{}]}),
            serde_json::json!({"models":[{"name":"other"}]}),
        ] {
            assert!(validate_resident_model(&value, "qwen3.5:4b").is_err());
        }
    }
    #[test]
    fn refuses_unknown_or_busy_ollama() {
        assert!(ollama_is_idle(&serde_json::json!({"models":[]})).is_ok());
        for value in [
            serde_json::json!({}),
            serde_json::json!({"models":null}),
            serde_json::json!({"models":[{"name":"other"}]} ),
        ] {
            assert!(ollama_is_idle(&value).is_err());
        }
    }
    #[test]
    fn idle_stop_is_idempotent_and_has_no_process() {
        let runtime = LocalInferenceRuntime::default();
        runtime.stop().unwrap();
        runtime.stop().unwrap();
        assert_eq!(
            runtime.snapshot().unwrap(),
            RuntimeSnapshot {
                running: false,
                owned_pid: None
            }
        );
    }
    #[test]
    #[ignore = "real installed Gemma/llama.cpp, Ollama idle; no canonical memory writes"]
    fn live_owned_start_inference_stop() {
        let runtime = super::runtime();
        struct Cleanup(Arc<LocalInferenceRuntime>);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = self.0.stop();
            }
        }
        let _cleanup = Cleanup(runtime.clone());
        let first = runtime.start().expect("real startup");
        assert!(first.running);
        assert!(tauri::async_runtime::block_on(acquire_ollama("qwen3.5:4b")).is_err());
        assert_eq!(
            runtime.start().unwrap(),
            first,
            "second start reuses only owned process"
        );
        let unrelated = LocalInferenceRuntime::default();
        assert!(
            unrelated.start().is_err(),
            "never adopt another manager's port"
        );
        unrelated.stop().unwrap();
        assert!(
            runtime.snapshot().unwrap().running,
            "unrelated stop must not kill owner"
        );
        let answer = tauri::async_runtime::block_on(gemma_chat(serde_json::json!({
            "model":GEMMA_MODEL,"stream":false,"temperature":0,"max_tokens":32,
            "messages":[{"role":"user","content":"Responde solamente LISTO."}]
        })))
        .unwrap();
        assert!(answer
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap()
            .contains("LISTO"));
        runtime.stop().expect("owned shutdown");
        assert!(tauri::async_runtime::block_on(gemma_chat(serde_json::json!({}))).is_err());
        assert!(!runtime.snapshot().unwrap().running);
        assert!(!port_occupied());
        let ollama_permit = tauri::async_runtime::block_on(acquire_ollama("qwen3.5:4b")).unwrap();
        assert!(
            runtime.start().is_err(),
            "Ollama request slot blocks Gemma startup"
        );
        drop(ollama_permit);
    }
}
