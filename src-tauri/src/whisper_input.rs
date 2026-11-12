//! CPU speech recognition with WAV/stdout pipes. No audio or transcript files.
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const MAX_TEXT: usize = 6_000;

/// A take keeps the same paths and display label through decode and recognition.
#[derive(Clone, Debug)]
pub(crate) struct Configuration {
    binary: PathBuf,
    model: PathBuf,
    label: &'static str,
}
impl Configuration {
    pub(crate) fn label(&self) -> &'static str {
        self.label
    }
}

fn label_for_model(path: &Path) -> &'static str {
    match path.file_name().and_then(|name| name.to_str()) {
        Some("ggml-small.bin") => "Whisper small · local CPU",
        Some("ggml-base.bin") => "Whisper base · local CPU",
        _ => "Whisper local · modelo configurado",
    }
}

fn file_present(path: &Path) -> Result<bool, String> {
    match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => Ok(true),
        Ok(_) => Err("Un recurso de Whisper local no es un archivo válido".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("No se pudo consultar la instalación de Whisper local".into()),
    }
}

fn configuration_at(
    binary: PathBuf,
    model: PathBuf,
    required: bool,
) -> Result<Option<Configuration>, String> {
    let binary_present = file_present(&binary)?;
    let model_present = file_present(&model)?;
    if !binary_present && !model_present && !required {
        return Ok(None);
    }
    if !binary_present || !model_present {
        return Err("Whisper está configurado o instalado, pero falta su motor o modelo. Revisa su instalación local.".into());
    }
    let label = label_for_model(&model);
    Ok(Some(Configuration {
        binary,
        model,
        label,
    }))
}

pub(crate) fn configuration() -> Result<Option<Configuration>, String> {
    let binary = crate::runtime_paths::whisper_bin()?;
    let model = crate::runtime_paths::whisper_model()?;
    let required = ["ALICE_WHISPER_BIN", "ALICE_WHISPER_MODEL"]
        .iter()
        .any(|name| std::env::var_os(name).is_some_and(|value| !value.is_empty()));
    configuration_at(binary, model, required)
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

fn command_for(configuration: &Configuration) -> Command {
    let mut command = Command::new(&configuration.binary);
    command
        .arg("-m")
        .arg(&configuration.model)
        .args(arguments())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
}

pub(crate) fn transcribe(
    configuration: &Configuration,
    wav: Vec<u8>,
    cancelled: impl Fn() -> bool,
) -> Result<(String, bool), String> {
    if cancelled() {
        return Err("La sesión de voz terminó antes de transcribir".into());
    }
    if is_silent(&wav) {
        return Ok((String::new(), true));
    }
    let mut child = command_for(configuration)
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

    struct Installation(PathBuf);
    impl Installation {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("alice-whisper-selection-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            Self(root)
        }
        fn binary(&self) -> PathBuf {
            self.0.join("whisper-cli.test")
        }
        fn model(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }
    impl Drop for Installation {
        fn drop(&mut self) {
            for name in [
                "whisper-cli.test",
                "ggml-base.bin",
                "ggml-small.bin",
                "custom.bin",
            ] {
                let _ = std::fs::remove_file(self.0.join(name));
            }
            let _ = std::fs::remove_dir(&self.0);
        }
    }

    #[test]
    fn only_a_missing_default_installation_allows_the_other_recognizer() {
        let fixture = Installation::new();
        let binary = fixture.binary();
        let model = fixture.model("ggml-base.bin");
        assert!(configuration_at(binary.clone(), model.clone(), false)
            .unwrap()
            .is_none());
        assert!(configuration_at(binary.clone(), model.clone(), true).is_err());
        std::fs::write(&binary, b"fixture-not-executed").unwrap();
        assert!(configuration_at(binary.clone(), model.clone(), false).is_err());
        std::fs::write(&model, b"fixture-not-loaded").unwrap();
        assert!(configuration_at(binary.clone(), model.clone(), false)
            .unwrap()
            .is_some());
        std::fs::remove_file(&binary).unwrap();
        assert!(configuration_at(binary, model, false).is_err());
    }

    #[test]
    fn a_take_keeps_its_paths_and_label_when_small_is_published_after_selection() {
        let fixture = Installation::new();
        let binary = fixture.binary();
        let base = fixture.model("ggml-base.bin");
        let small = fixture.model("ggml-small.bin");
        std::fs::write(&binary, b"fixture-not-executed").unwrap();
        std::fs::write(&base, b"fixture-not-loaded").unwrap();
        let selected = configuration_at(binary.clone(), base.clone(), false)
            .unwrap()
            .unwrap();
        std::fs::write(&small, b"new-fixture-not-loaded").unwrap();
        let next = configuration_at(binary.clone(), small.clone(), false)
            .unwrap()
            .unwrap();
        assert_eq!(selected.label(), "Whisper base · local CPU");
        assert_eq!(next.label(), "Whisper small · local CPU");
        let command = command_for(&selected);
        assert_eq!(command.get_program(), binary.as_os_str());
        let args: Vec<_> = command.get_args().collect();
        assert_eq!(args[0], "-m");
        assert_eq!(args[1], base.as_os_str());
        assert_eq!(
            command_for(&next).get_args().nth(1),
            Some(small.as_os_str())
        );
    }

    #[test]
    fn unknown_model_names_get_a_generic_label_without_private_paths() {
        for (name, expected) in [
            ("ggml-base.bin", "Whisper base · local CPU"),
            ("ggml-small.bin", "Whisper small · local CPU"),
            ("ggml-small.en.bin", "Whisper local · modelo configurado"),
            ("custom.bin", "Whisper local · modelo configurado"),
        ] {
            assert_eq!(label_for_model(&std::env::temp_dir().join(name)), expected);
        }
    }

    #[test]
    fn a_revoked_take_does_not_spawn_and_a_disappeared_binary_returns_an_error() {
        let fixture = Installation::new();
        let configuration = Configuration {
            binary: fixture.binary(),
            model: fixture.model("ggml-small.bin"),
            label: "Whisper small · local CPU",
        };
        assert!(transcribe(&configuration, b"not-audio".to_vec(), || true)
            .unwrap_err()
            .contains("sesión de voz terminó"));
        assert!(transcribe(&configuration, b"not-audio".to_vec(), || false)
            .unwrap_err()
            .contains("No se pudo iniciar Whisper local"));
    }
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
