//! Native lifecycle and shared arbitration for chat, vision and learning.
//! Explicit runtime controls and shared text, vision and ephemeral voice transport.
use serde::Serialize;
use std::future::Future;
use std::net::{SocketAddr, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

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
    generation: AtomicU64,
    inference: Mutex<()>,
}

pub(crate) const GEMMA_MODEL: &str = "gemma-4-E2B-it-Q4_K_M";
pub(crate) fn installed() -> bool {
    [
        crate::runtime_paths::llama_server(),
        crate::runtime_paths::gemma_model(),
        crate::runtime_paths::gemma_projector(),
    ]
    .iter()
    .all(|p| p.as_ref().is_ok_and(|p| p.is_file()))
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
    runtime().cancel_requests();
    tauri::async_runtime::spawn_blocking(|| {
        let r = runtime();
        r.stop()?;
        r.snapshot()
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) async fn gemma_chat(body: serde_json::Value) -> Result<serde_json::Value, String> {
    let r = runtime();
    let generation = r.generation.load(Ordering::Acquire);
    tauri::async_runtime::spawn_blocking(move || {
        r.run_chat(generation, move || async move {
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
    fn cancel_requests(&self) {
        self.cancel.store(true, Ordering::Release);
        self.generation.fetch_add(1, Ordering::AcqRel);
    }

    fn check_generation(&self, generation: u64) -> Result<(), String> {
        if self.cancel.load(Ordering::Acquire)
            || self.generation.load(Ordering::Acquire) != generation
        {
            Err("La solicitud a Gemma fue cancelada al detener o reiniciar el motor".into())
        } else {
            Ok(())
        }
    }

    // Serialize requests separately from process ownership. Never hold `child`
    // during network I/O; stop/status must remain available while HTTP is pending.
    fn run_chat<F>(
        &self,
        generation: u64,
        request: impl FnOnce() -> F,
    ) -> Result<serde_json::Value, String>
    where
        F: Future<Output = Result<serde_json::Value, String>> + Send + 'static,
    {
        let _inference = self.inference.lock().map_err(|_| "Inferencia bloqueada")?;
        self.check_generation(generation)?;
        {
            let mut guard = self
                .child
                .lock()
                .map_err(|_| "Control del motor bloqueado")?;
            self.check_generation(generation)?;
            let child = guard
                .as_mut()
                .ok_or("Iniciá Gemma desde Configuración antes de enviar")?;
            if child.try_wait().map_err(|e| e.to_string())?.is_some() {
                return Err("Gemma terminó; reinicialo desde Configuración".into());
            }
        }
        let (sender, receiver) = mpsc::sync_channel(1);
        let future = request();
        let task = tauri::async_runtime::spawn(async move {
            let _ = sender.send(future.await);
        });
        let result = loop {
            if let Err(error) = self.check_generation(generation) {
                break Err(error);
            }
            match receiver.recv_timeout(Duration::from_millis(25)) {
                Ok(result) => break self.check_generation(generation).and(result),
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => {
                    break Err("La petición a Gemma terminó sin respuesta".into());
                }
            }
        };
        // Also wait for the aborted future to drop its connection before allowing
        // another request. A queued request carries its original generation.
        task.abort();
        let _ = tauri::async_runtime::block_on(task);
        result
    }

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
        let mut guard = self
            .child
            .lock()
            .map_err(|_| "Control de motor bloqueado")?;
        self.cancel.store(false, Ordering::Release);
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
        let engine = crate::runtime_paths::llama_server()?;
        let model = crate::runtime_paths::gemma_model()?;
        let projector = crate::runtime_paths::gemma_projector()?;
        let gpu_layers = crate::runtime_paths::gpu_layers()?;
        for file in [&engine, &model, &projector] {
            if !file.is_file() {
                return Err(format!(
                    "Falta un archivo del motor evaluado: {}",
                    file.display()
                ));
            }
        }
        let mut command = Command::new(engine);
        command
            .arg("-m")
            .arg(model)
            .arg("--mmproj")
            .arg(projector)
            .args([
                "--host",
                "127.0.0.1",
                "--port",
                "18089",
                "-c",
                "4096",
                "-np",
                "1",
                "-ngl",
                &gpu_layers,
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
        self.generation.fetch_add(1, Ordering::AcqRel);
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
        self.cancel_requests();
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

    // An owned copy of this test binary avoids models, shell subprocess trees,
    // fixed ports and canonical data in lifecycle/concurrency regressions.
    fn fixture_runtime() -> Arc<LocalInferenceRuntime> {
        let runtime = Arc::new(LocalInferenceRuntime::default());
        install_fixture_child(&runtime);
        runtime
    }

    fn install_fixture_child(runtime: &LocalInferenceRuntime) {
        let mut child = runtime.child.lock().unwrap();
        assert!(child.is_none());
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "local_inference::tests::lifecycle_child_fixture",
                "--ignored",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x0800_0000);
        }
        *child = Some(command.spawn().unwrap());
        runtime.generation.fetch_add(1, Ordering::AcqRel);
        runtime.cancel.store(false, Ordering::Release);
    }

    #[test]
    #[ignore = "owned child fixture; launched only by lifecycle regression tests"]
    fn lifecycle_child_fixture() {
        std::thread::sleep(Duration::from_secs(30));
    }

    #[test]
    fn pending_http_does_not_block_status_or_owned_shutdown() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}/", listener.local_addr().unwrap());
        let (entered_tx, entered_rx) = mpsc::sync_channel(1);
        let (release_tx, release_rx) = mpsc::sync_channel(1);
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut buffer = [0; 2048];
            assert!(socket.read(&mut buffer).unwrap() > 0);
            entered_tx.send(()).unwrap();
            let _ = release_rx.recv_timeout(Duration::from_secs(3));
            let _ = socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}");
        });
        let runtime = fixture_runtime();
        let generation = runtime.generation.load(Ordering::Acquire);
        let request_runtime = runtime.clone();
        let (answer_tx, answer_rx) = mpsc::sync_channel(1);
        let request = std::thread::spawn(move || {
            let answer = request_runtime.run_chat(generation, || async move {
                client()?
                    .get(endpoint)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?
                    .json()
                    .await
                    .map_err(|e| e.to_string())
            });
            answer_tx.send(answer).unwrap();
        });
        entered_rx.recv_timeout(Duration::from_secs(3)).unwrap();
        let controller = runtime.clone();
        let (stopped_tx, stopped_rx) = mpsc::sync_channel(1);
        let control = std::thread::spawn(move || {
            let before = controller.snapshot().unwrap();
            controller.stop().unwrap();
            stopped_tx
                .send((before, controller.snapshot().unwrap()))
                .unwrap();
        });
        let started = Instant::now();
        let (before, after) = stopped_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("status/stop must finish while HTTP is still pending");
        assert!(before.running);
        assert!(!after.running);
        let error = answer_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap()
            .unwrap_err();
        assert!(error.contains("cancelada"), "{error}");
        assert!(started.elapsed() < Duration::from_secs(2));
        release_tx.send(()).unwrap();
        control.join().unwrap();
        request.join().unwrap();
        server.join().unwrap();
    }

    #[test]
    fn queued_request_cannot_run_in_a_restarted_generation() {
        let runtime = fixture_runtime();
        let generation = runtime.generation.load(Ordering::Acquire);
        let occupied = runtime.inference.lock().unwrap();
        let caller = runtime.clone();
        let executed = Arc::new(AtomicBool::new(false));
        let flag = executed.clone();
        let queued = std::thread::spawn(move || {
            caller.run_chat(generation, || {
                flag.store(true, Ordering::Release);
                async { Ok(serde_json::json!({})) }
            })
        });
        runtime.stop().unwrap();
        install_fixture_child(&runtime);
        drop(occupied);
        assert!(queued.join().unwrap().unwrap_err().contains("cancelada"));
        assert!(!executed.load(Ordering::Acquire));
        assert!(runtime.snapshot().unwrap().running);
        // The new generation can still serve a request after the stale one is rejected.
        assert_eq!(
            runtime
                .run_chat(runtime.generation.load(Ordering::Acquire), || async {
                    Ok(serde_json::json!({"ok":true}))
                })
                .unwrap(),
            serde_json::json!({"ok":true})
        );
        runtime.stop().unwrap();
    }
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
