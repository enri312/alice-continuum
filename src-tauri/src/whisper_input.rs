//! CPU speech recognition with WAV/stdout pipes. No audio or transcript files.
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub(crate) const MODEL_NAME: &str = "Whisper base · local CPU";
const MAX_TEXT: usize = 6_000;

pub(crate) fn available() -> bool {
    [
        crate::runtime_paths::whisper_bin(),
        crate::runtime_paths::whisper_model(),
    ]
    .iter()
    .all(|p| p.as_ref().is_ok_and(|p| p.is_file()))
}

fn arguments() -> Vec<&'static str> {
    // v1.9.2 treats input '-' as an output prefix too. A non-dash prefix keeps
    // results on stdout. No --output-* format is enabled, so no file is written.
    // Keep decoding unseeded: a fixed list of app names must not replace a
    // short spoken action. Real accuracy still needs microphone acceptance.
    vec![
        "-l",
        "es",
        "-t",
        "4",
        "-ng",
        "-nt",
        "-np",
        "-of",
        "alice-memory-only",
        "-f",
        "-",
    ]
}

fn parse_text(bytes: Vec<u8>) -> Result<(String, bool), String> {
    let text = String::from_utf8(bytes).map_err(|_| "Whisper devolvió texto inválido")?;
    let text = text.trim().trim_start_matches('\u{feff}').trim();
    if text.chars().count() > MAX_TEXT {
        return Err("La transcripción superó el límite y fue descartada".into());
    }
    let quiet = text.is_empty() || matches!(text, "[BLANK_AUDIO]" | "[Silencio]" | "(silencio)");
    Ok((if quiet { String::new() } else { text.into() }, quiet))
}

fn is_silent(wav: &[u8]) -> bool {
    let mut offset = 12usize;
    while let Some(header) = wav.get(offset..offset.saturating_add(8)) {
        let length = u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize;
        let start = offset + 8;
        if &header[..4] == b"data" {
            let end = start.saturating_add(length).min(wav.len());
            return wav[start..end]
                .as_chunks::<2>()
                .0
                .iter()
                .all(|sample| i16::from_le_bytes(*sample).unsigned_abs() <= 3);
        }
        offset = start.saturating_add(length).saturating_add(length % 2);
    }
    false
}

pub(crate) fn transcribe(
    wav: Vec<u8>,
    cancelled: impl Fn() -> bool,
) -> Result<(String, bool), String> {
    if cancelled() {
        return Err("La sesión de voz terminó antes de transcribir".into());
    }
    if is_silent(&wav) {
        return Ok((String::new(), true));
    }
    let mut command = Command::new(crate::runtime_paths::whisper_bin()?);
    command
        .arg("-m")
        .arg(crate::runtime_paths::whisper_model()?)
        .args(arguments())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut child = command
        .spawn()
        .map_err(|_| "No se pudo iniciar Whisper local. Revisa su instalación.")?;
    let mut input = child
        .stdin
        .take()
        .ok_or("Whisper no abrió su canal de entrada")?;
    let mut output = child
        .stdout
        .take()
        .ok_or("Whisper no abrió su canal de salida")?;
    let writer = std::thread::spawn(move || input.write_all(&wav));
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        output.read_to_end(&mut bytes).map(|_| bytes)
    });
    let started = Instant::now();
    let status = loop {
        if cancelled() {
            break Err("La sesión de voz terminó durante la transcripción".to_string());
        }
        if started.elapsed() > Duration::from_secs(90) {
            break Err("Whisper local tardó demasiado. La toma se descartó.".to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => break Err("No se pudo comprobar el reconocedor local".to_string()),
        }
    };
    if status.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let written = writer.join();
    let bytes = reader.join();
    if !status?.success() {
        return Err("Whisper no pudo transcribir esta toma".into());
    }
    written
        .map_err(|_| "Se interrumpió la entrada de audio")?
        .map_err(|_| "Whisper no recibió la toma completa")?;
    let bytes = bytes
        .map_err(|_| "Se interrumpió la salida de texto")?
        .map_err(|_| "Whisper no entregó la transcripción")?;
    if cancelled() {
        return Err("La sesión de voz terminó antes de recibir la transcripción".into());
    }
    parse_text(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recognition_stays_on_cpu_and_uses_pipes_without_output_files() {
        let args = arguments();
        assert!(args.contains(&"-ng"));
        assert!(args.windows(2).any(|pair| pair == ["-l", "es"]));
        // No preset transcript or grammar may complete an unheard action.
        assert!(!args.contains(&"--prompt"));
        assert!(!args.contains(&"--grammar"));
        assert_eq!(&args[args.len() - 2..], &["-f", "-"]);
        for forbidden in ["-otxt", "-oj", "-ojf", "-osrt", "-owts", "--output-txt"] {
            assert!(!args.contains(&forbidden));
        }
    }
    #[test]
    fn accepts_unicode_and_rejects_oversized_or_invalid_transcripts() {
        assert_eq!(
            parse_text("\r\n Detén la conversación, Alice. ".as_bytes().to_vec()).unwrap(),
            ("Detén la conversación, Alice.".into(), false)
        );
        assert_eq!(
            parse_text(b"[BLANK_AUDIO]".to_vec()).unwrap(),
            (String::new(), true)
        );
        assert!(parse_text(vec![255]).is_err());
        assert!(parse_text("a".repeat(MAX_TEXT + 1).into_bytes()).is_err());
    }
    #[test]
    fn skips_zero_pcm_but_retains_soft_nonzero_speech() {
        let mut wav = b"RIFF0000WAVEdata".to_vec();
        wav.extend(4u32.to_le_bytes());
        wav.extend([0, 0, 0, 0]);
        assert!(is_silent(&wav));
        wav[20..22].copy_from_slice(&40i16.to_le_bytes());
        assert!(!is_silent(&wav));
    }
}
