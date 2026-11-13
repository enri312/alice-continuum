//! One local recognizer process. Diagnostics stay bounded in RAM, never in errors.
use std::io::{self, Read, Write};
use std::process::{Child, Command};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const MAX_STDOUT: usize = 24 * 1024;
const MAX_STDERR: usize = 16 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum FailureKind {
    Start,
    Resources,
    Io,
    Cancelled,
    Timeout,
    Memory,
    Instruction,
    Crash,
    Model,
    Audio,
    Configuration,
    Processing,
    Exit,
    OutputLimit,
    DiagnosticLimit,
    InvalidText,
}

#[derive(Debug)]
pub(crate) struct WhisperFailure {
    kind: FailureKind,
    exit_code: Option<u32>,
}

impl WhisperFailure {
    pub(super) fn new(kind: FailureKind) -> Self {
        Self {
            kind,
            exit_code: None,
        }
    }

    fn at_exit(kind: FailureKind, exit_code: Option<u32>) -> Self {
        Self { kind, exit_code }
    }

    pub(crate) fn audit_reason(&self) -> String {
        let class = match self.kind {
            FailureKind::Start => "START_FAILED",
            FailureKind::Resources => "RESOURCES_UNAVAILABLE",
            FailureKind::Io => "PIPE_FAILED",
            FailureKind::Cancelled => "CANCELLED",
            FailureKind::Timeout => "TIMEOUT",
            FailureKind::Memory => "MEMORY_UNAVAILABLE",
            FailureKind::Instruction => "INSTRUCTION_FAULT",
            FailureKind::Crash => "PROCESS_CRASHED",
            FailureKind::Model => "MODEL_INIT_FAILED",
            FailureKind::Audio => "AUDIO_INVALID",
            FailureKind::Configuration => "CONFIGURATION_ERROR",
            FailureKind::Processing => "PROCESSING_FAILED",
            FailureKind::Exit => "PROCESS_FAILED",
            FailureKind::OutputLimit => "OUTPUT_LIMIT",
            FailureKind::DiagnosticLimit => "DIAGNOSTIC_LIMIT",
            FailureKind::InvalidText => "TEXT_INVALID",
        };
        match self.exit_code {
            Some(code) => format!("VOICE_WHISPER_{class}_EXIT_{code:08X}"),
            None => format!("VOICE_WHISPER_{class}"),
        }
    }

    pub(crate) fn public_message(&self) -> String {
        let message = match self.kind {
            FailureKind::Start => "No se pudo iniciar Whisper local. Revisa su instalación.",
            FailureKind::Resources => "Whisper no pudo preparar los recursos locales necesarios. Revisa los recursos disponibles y vuelve a intentarlo.",
            FailureKind::Io => "No se pudo completar la entrega local de audio o texto de Whisper. La toma no se envió al chat.",
            FailureKind::Cancelled => "La sesión de voz terminó; la transcripción fue descartada.",
            FailureKind::Timeout => "Whisper local tardó más de 90 segundos. La toma fue descartada.",
            FailureKind::Memory => "Whisper no pudo reservar la memoria necesaria. Libera memoria antes de volver a intentarlo.",
            FailureKind::Instruction => "Whisper se detuvo al ejecutar una instrucción no válida. Revisa la compatibilidad del motor local.",
            FailureKind::Crash => "El proceso de Whisper terminó inesperadamente. La toma no se envió al chat.",
            FailureKind::Model => "Whisper no pudo preparar el modelo local. Revisa su instalación y la memoria disponible.",
            FailureKind::Audio => "Whisper no pudo leer el audio de esta toma. Graba otra toma para volver a intentarlo.",
            FailureKind::Configuration => "Whisper rechazó su configuración. Revisa la instalación del motor local.",
            FailureKind::Processing => "Whisper falló al procesar el audio. La toma no se envió al chat.",
            FailureKind::Exit => "Whisper terminó con un error del proceso. La toma no se envió al chat.",
            FailureKind::OutputLimit => "La salida de Whisper superó el límite y fue descartada.",
            FailureKind::DiagnosticLimit => "Whisper produjo un diagnóstico excesivo. El resultado fue descartado.",
            FailureKind::InvalidText => "Whisper devolvió texto inválido. El resultado fue descartado.",
        };
        if matches!(
            self.kind,
            FailureKind::Exit | FailureKind::Crash | FailureKind::Instruction
        ) {
            if let Some(code) = self.exit_code {
                return format!("{message} Código: 0x{code:08X}.");
            }
        }
        message.into()
    }
}

struct BoundedOutput {
    bytes: Vec<u8>,
    exceeded: bool,
}

// A full pipe must not block the child. Retain only the prefix, but drain to EOF.
fn drain(mut reader: impl Read, limit: usize) -> io::Result<BoundedOutput> {
    let mut result = BoundedOutput {
        bytes: Vec::new(),
        exceeded: false,
    };
    let mut chunk = [0u8; 4096];
    loop {
        let count = match reader.read(&mut chunk) {
            Ok(0) => return Ok(result),
            Ok(count) => count,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error),
        };
        let keep = count.min(limit.saturating_sub(result.bytes.len()));
        result.bytes.extend_from_slice(&chunk[..keep]);
        result.exceeded |= keep != count;
    }
}

fn failure_at_exit(
    success: bool,
    code: Option<u32>,
    stderr: &BoundedOutput,
) -> Option<WhisperFailure> {
    // Windows exposes NTSTATUS through a signed i32; the caller preserves its bits.
    let system_fault = match code {
        Some(0xC0000017 | 0xC000012D) => Some(FailureKind::Memory),
        Some(0xC000009A) => Some(FailureKind::Resources),
        Some(0xC000001D) => Some(FailureKind::Instruction),
        Some(0xC0000005) => Some(FailureKind::Crash),
        _ => None,
    };
    if !success {
        if let Some(kind) = system_fault {
            return Some(WhisperFailure::at_exit(kind, code));
        }
    }
    // A fatal message could be beyond the retained prefix. Never accept a partial diagnostic.
    if stderr.exceeded {
        return Some(WhisperFailure::at_exit(FailureKind::DiagnosticLimit, code));
    }
    let text = String::from_utf8_lossy(&stderr.bytes).to_ascii_lowercase();
    let starts = |prefix: &str| text.lines().any(|line| line.trim().starts_with(prefix));
    let memory = text.lines().any(|line| {
        let line = line.trim();
        (line.starts_with("ggml_") || line.starts_with("whisper_"))
            && (line.contains(": failed to allocate ") || line.contains(": not enough memory"))
            || line == "what(): std::bad_alloc"
            || line.starts_with("terminate called after throwing an instance of 'std::bad_alloc'")
    });
    let configuration = starts("error: unknown argument:")
        || starts("error: unknown language")
        || starts("error: unknown dtw preset")
        || starts("error: failed to parse grammar")
        || starts("error: cannot use both --diarize")
        || text.lines().any(|line| {
            let line = line.trim();
            line.starts_with("error: argument ") && line.ends_with(" requires value")
        });
    let kind = if memory {
        Some(FailureKind::Memory)
    } else if starts("error: failed to read audio file ") {
        Some(FailureKind::Audio)
    } else if configuration {
        Some(FailureKind::Configuration)
    } else if starts("error: failed to initialize whisper context") {
        Some(FailureKind::Model)
    } else if starts("error:")
        || text
            .lines()
            .any(|line| line.trim().ends_with(": failed to process audio"))
    {
        Some(FailureKind::Processing)
    } else if !success {
        Some(if code.is_some() {
            FailureKind::Exit
        } else {
            FailureKind::Crash
        })
    } else {
        None
    };
    kind.map(|kind| WhisperFailure::at_exit(kind, code))
}

type PipeThread<T> = Option<JoinHandle<io::Result<T>>>;

struct RunningWhisper {
    child: Child,
    exited: bool,
    writer: PipeThread<()>,
    stdout: PipeThread<BoundedOutput>,
    stderr: PipeThread<BoundedOutput>,
}

impl Drop for RunningWhisper {
    fn drop(&mut self) {
        // Always terminate/reap before joining a writer blocked on a full stdin.
        if !self.exited {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
        if let Some(thread) = self.writer.take() {
            let _ = thread.join();
        }
        if let Some(thread) = self.stdout.take() {
            let _ = thread.join();
        }
        if let Some(thread) = self.stderr.take() {
            let _ = thread.join();
        }
    }
}

fn join_pipe<T>(thread: PipeThread<T>) -> Result<T, WhisperFailure> {
    thread
        .ok_or_else(|| WhisperFailure::new(FailureKind::Resources))?
        .join()
        .map_err(|_| WhisperFailure::new(FailureKind::Io))?
        .map_err(|_| WhisperFailure::new(FailureKind::Io))
}

pub(super) fn run(
    mut command: Command,
    wav: Vec<u8>,
    cancelled: impl Fn() -> bool,
    timeout: Duration,
) -> Result<Vec<u8>, WhisperFailure> {
    if cancelled() {
        return Err(WhisperFailure::new(FailureKind::Cancelled));
    }
    let child = command
        .spawn()
        .map_err(|_| WhisperFailure::new(FailureKind::Start))?;
    let mut running = RunningWhisper {
        child,
        exited: false,
        writer: None,
        stdout: None,
        stderr: None,
    };
    let mut input = running
        .child
        .stdin
        .take()
        .ok_or_else(|| WhisperFailure::new(FailureKind::Resources))?;
    let output = running
        .child
        .stdout
        .take()
        .ok_or_else(|| WhisperFailure::new(FailureKind::Resources))?;
    let diagnostic = running
        .child
        .stderr
        .take()
        .ok_or_else(|| WhisperFailure::new(FailureKind::Resources))?;
    running.stdout = Some(
        std::thread::Builder::new()
            .name("alice-whisper-out".into())
            .spawn(move || drain(output, MAX_STDOUT))
            .map_err(|_| WhisperFailure::new(FailureKind::Resources))?,
    );
    running.stderr = Some(
        std::thread::Builder::new()
            .name("alice-whisper-err".into())
            .spawn(move || drain(diagnostic, MAX_STDERR))
            .map_err(|_| WhisperFailure::new(FailureKind::Resources))?,
    );
    running.writer = Some(
        std::thread::Builder::new()
            .name("alice-whisper-in".into())
            .spawn(move || input.write_all(&wav))
            .map_err(|_| WhisperFailure::new(FailureKind::Resources))?,
    );
    let started = Instant::now();
    let status = loop {
        if cancelled() {
            return Err(WhisperFailure::new(FailureKind::Cancelled));
        }
        if started.elapsed() >= timeout {
            return Err(WhisperFailure::new(FailureKind::Timeout));
        }
        match running.child.try_wait() {
            Ok(Some(status)) => {
                running.exited = true;
                break status;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => return Err(WhisperFailure::new(FailureKind::Io)),
        }
    };
    // Collect every handle, even when a sibling returns an error.
    let written = join_pipe(running.writer.take());
    let stdout = join_pipe(running.stdout.take());
    let stderr = join_pipe(running.stderr.take());
    if cancelled() {
        return Err(WhisperFailure::new(FailureKind::Cancelled));
    }
    let exit_code = status.code().map(|code| code as u32);
    let stderr = match stderr {
        Ok(stderr) => stderr,
        Err(error) if status.success() => return Err(error),
        Err(_) => return Err(WhisperFailure::at_exit(FailureKind::Exit, exit_code)),
    };
    if let Some(failure) = failure_at_exit(status.success(), exit_code, &stderr) {
        return Err(failure);
    }
    written?;
    let stdout = stdout?;
    if stdout.exceeded {
        return Err(WhisperFailure::at_exit(FailureKind::OutputLimit, exit_code));
    }
    Ok(stdout.bytes)
}

#[cfg(test)]
mod tests;
