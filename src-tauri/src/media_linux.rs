//! Desktop music is scoped inside the embedded helper; the native session owns
//! its lifetime, cancellation and a bounded response channel.
use crate::media_actions::{CancellationCheck, MediaOperation};
use serde::Deserialize;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Deserialize)]
struct Receipt {
    ok: bool,
    text: String,
    target: Option<String>,
}

fn operation(value: MediaOperation) -> &'static str {
    match value {
        MediaOperation::Open => "open",
        MediaOperation::Play => "play",
        MediaOperation::Resume => "resume",
        MediaOperation::Pause => "pause",
    }
}

fn execute(
    service: &str,
    op: MediaOperation,
    query: Option<String>,
    previous: Option<String>,
    check: CancellationCheck,
) -> Result<Receipt, String> {
    check()?;
    let input = serde_json::to_vec(&serde_json::json!({"service":service,"operation":operation(op),"query":query,"previous":previous})).map_err(|e| e.to_string())?;
    let mut child = Command::new("/usr/bin/python3")
        .args([
            "-I",
            "-c",
            include_str!("../../scripts/adapters/linux_media_bridge.py"),
        ])
        .env_remove("FISH_API_KEY")
        .env_remove("ALICE_FISH_REFERENCE_ID")
        .env_remove("OPENAI_API_KEY")
        .env_remove("XAI_API_KEY")
        .env_remove("ANTHROPIC_API_KEY")
        .env_remove("GEMINI_API_KEY")
        .env_remove("DEEPSEEK_API_KEY")
        .env_remove("OPENROUTER_API_KEY")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "No se pudo iniciar el control multimedia de Ubuntu")?;
    let mut stdin = child.stdin.take().ok_or("No se abrió el canal musical")?;
    let stdout = child.stdout.take().ok_or("No se abrió el recibo musical")?;
    let writer = std::thread::spawn(move || stdin.write_all(&input));
    let reader = std::thread::spawn(move || {
        let mut data = Vec::new();
        stdout.take(16_385).read_to_end(&mut data).map(|_| data)
    });
    let started = Instant::now();
    let result = loop {
        if let Err(error) = check() {
            break Err(error);
        }
        if started.elapsed() > Duration::from_secs(60) {
            break Err("El reproductor no respondió a tiempo; revisa su ventana.".into());
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(30)),
            Err(_) => break Err("No se pudo comprobar el control musical".into()),
        }
    };
    if result.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let written = writer.join();
    let bytes = reader.join();
    let status = result?;
    written
        .map_err(|_| "Se interrumpió la solicitud musical")?
        .map_err(|_| "No se entregó la solicitud musical")?;
    let bytes = bytes
        .map_err(|_| "Se interrumpió el recibo musical")?
        .map_err(|_| "No se pudo leer el recibo musical")?;
    if bytes.len() > 16_384 {
        return Err("El recibo musical excedió su límite".into());
    }
    let receipt: Receipt = serde_json::from_slice(&bytes)
        .map_err(|_| "El control musical no devolvió un recibo válido")?;
    check()?;
    if !status.success() || !receipt.ok {
        return Err(receipt.text);
    }
    Ok(receipt)
}

pub(crate) fn spotify(
    op: MediaOperation,
    query: Option<String>,
    check: CancellationCheck,
) -> Result<String, String> {
    execute("spotify", op, query, None, check).map(|r| r.text)
}

pub(crate) fn youtube(
    op: MediaOperation,
    query: Option<String>,
    previous: Option<String>,
    check: CancellationCheck,
) -> Result<(String, Option<String>), String> {
    execute("youtube", op, query, previous, check).map(|r| (r.text, r.target))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn revoked_sessions_never_start_the_desktop_helper() {
        let check: CancellationCheck = std::sync::Arc::new(|| Err("Sesión revocada".into()));
        assert!(spotify(MediaOperation::Play, None, check.clone())
            .unwrap_err()
            .contains("revocada"));
        assert!(
            youtube(MediaOperation::Play, Some("test".into()), None, check)
                .unwrap_err()
                .contains("revocada")
        );
    }
}
