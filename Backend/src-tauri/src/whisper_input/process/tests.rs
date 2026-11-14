use super::*;
use crate::audit::{AuditEvent, AuditOutcome, AuditSource, AuditStage};
use std::io::Cursor;
use std::process::Stdio;

// Scripts below are fixed synthetic fixtures. They never inspect the microphone,
// load a model, write files, or interpolate owner data into a shell command.
#[cfg(any(windows, unix))]
fn fixture(windows_script: &'static str, unix_script: &'static str) -> Command {
    #[cfg(windows)]
    let mut command = {
        use std::os::windows::process::CommandExt;
        let _ = unix_script;
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile", "-NonInteractive", "-Command", windows_script]);
        command.creation_flags(0x0800_0000);
        command
    };
    #[cfg(unix)]
    let mut command = {
        let _ = windows_script;
        let mut command = Command::new("sh");
        command.args(["-c", unix_script]);
        command
    };
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn diagnostic(bytes: &[u8]) -> BoundedOutput {
    BoundedOutput {
        bytes: bytes.to_vec(),
        exceeded: false,
    }
}

#[test]
fn drain_retains_only_the_limit_but_consumes_the_entire_stream() {
    let source: Vec<_> = (0..(MAX_STDERR * 4 + 17))
        .map(|index| (index % 251) as u8)
        .collect();
    let mut reader = Cursor::new(&source);
    let retained = drain(&mut reader, MAX_STDERR).unwrap();
    assert_eq!(retained.bytes, source[..MAX_STDERR]);
    assert!(retained.exceeded);
    assert_eq!(reader.position(), source.len() as u64);

    let exact = drain(Cursor::new(b"four"), 4).unwrap();
    assert_eq!(exact.bytes, b"four");
    assert!(!exact.exceeded);
    let empty = drain(Cursor::new([]), 0).unwrap();
    assert!(empty.bytes.is_empty());
    assert!(!empty.exceeded);
}

#[test]
fn interrupted_reads_resume_instead_of_discarding_the_diagnostic() {
    struct InterruptedOnce {
        interrupted: bool,
        remaining: Cursor<&'static [u8]>,
    }
    impl Read for InterruptedOnce {
        fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
            if !self.interrupted {
                self.interrupted = true;
                return Err(io::Error::from(io::ErrorKind::Interrupted));
            }
            self.remaining.read(output)
        }
    }
    let retained = drain(
        InterruptedOnce {
            interrupted: false,
            remaining: Cursor::new(b"synthetic-only"),
        },
        4,
    )
    .unwrap();
    assert_eq!(retained.bytes, b"synt");
    assert!(retained.exceeded);
}

#[test]
fn known_fatal_diagnostics_are_failures_even_when_the_cli_exits_zero() {
    for (stderr, expected) in [
        ("error: failed to read audio file '-'\n", FailureKind::Audio),
        (
            "error: failed to initialize whisper context\n",
            FailureKind::Model,
        ),
        (
            "error: unknown argument: --fixture\n",
            FailureKind::Configuration,
        ),
        (
            "error: argument --fixture requires value\n",
            FailureKind::Configuration,
        ),
        (
            "error: unknown language 'fixture'\n",
            FailureKind::Configuration,
        ),
        (
            "error: cannot use both --diarize and --tinydiarize\n",
            FailureKind::Configuration,
        ),
        (
            "error: unknown DTW preset 'fixture'\n",
            FailureKind::Configuration,
        ),
        (
            "error: failed to parse grammar 'fixture'\n",
            FailureKind::Configuration,
        ),
        (
            "ggml_backend_cpu_buffer: failed to allocate 16 bytes\n",
            FailureKind::Memory,
        ),
        ("what(): std::bad_alloc\n", FailureKind::Memory),
        (
            "error: synthetic processing failure\n",
            FailureKind::Processing,
        ),
        (
            "fixture-cli: failed to process audio\n",
            FailureKind::Processing,
        ),
    ] {
        let failure = failure_at_exit(true, Some(0), &diagnostic(stderr.as_bytes())).unwrap();
        assert_eq!(failure.kind, expected);
        assert_eq!(failure.exit_code, Some(0));
    }
}

#[test]
fn ordinary_diagnostics_and_quoted_error_words_do_not_become_fatal() {
    let stderr = diagnostic(
        b"read_audio_data: read 32044 bytes from stdin\n\
          warning: model is not multilingual\n\
          warning: error: failed to initialize whisper context\n\
          reading D:\\synthetic-only\\failed to allocate\\fixture.bin\n",
    );
    assert!(failure_at_exit(true, Some(0), &stderr).is_none());
    // Exit 3 alone is not evidence that the model or memory caused the failure.
    let failure = failure_at_exit(false, Some(3), &diagnostic(b"")).unwrap();
    assert_eq!(failure.kind, FailureKind::Exit);
}

#[test]
fn ntstatus_bits_select_only_the_supported_system_fault_classes() {
    for (raw, expected) in [
        (0xC0000017u32, FailureKind::Memory),
        (0xC000009A, FailureKind::Resources),
        (0xC000012D, FailureKind::Memory),
        (0xC000001D, FailureKind::Instruction),
        (0xC0000005, FailureKind::Crash),
    ] {
        let signed = raw as i32;
        assert!(signed < 0);
        let failure = failure_at_exit(false, Some(signed as u32), &diagnostic(b"")).unwrap();
        assert_eq!(failure.kind, expected);
        assert_eq!(failure.exit_code, Some(raw));
        assert!(failure
            .audit_reason()
            .ends_with(&format!("_EXIT_{raw:08X}")));
    }
    assert_eq!(
        failure_at_exit(false, None, &diagnostic(b"")).unwrap().kind,
        FailureKind::Crash
    );
    assert_eq!(
        failure_at_exit(false, Some(0xC0000006), &diagnostic(b""))
            .unwrap()
            .kind,
        FailureKind::Exit
    );
}

#[cfg(windows)]
#[test]
fn windows_exit_status_preserves_the_native_unsigned_exception_code() {
    use std::os::windows::process::ExitStatusExt;
    let status = std::process::ExitStatus::from_raw(0xC000001D);
    assert!(!status.success());
    assert!(status.code().unwrap() < 0);
    let failure = failure_at_exit(
        status.success(),
        status.code().map(|code| code as u32),
        &diagnostic(b""),
    )
    .unwrap();
    assert_eq!(failure.kind, FailureKind::Instruction);
    assert!(failure.audit_reason().ends_with("_EXIT_C000001D"));
}

#[test]
fn every_failure_reason_is_valid_r3_and_has_no_unbounded_payload() {
    for kind in [
        FailureKind::Start,
        FailureKind::Resources,
        FailureKind::Io,
        FailureKind::Cancelled,
        FailureKind::Timeout,
        FailureKind::Memory,
        FailureKind::Instruction,
        FailureKind::Crash,
        FailureKind::Model,
        FailureKind::Audio,
        FailureKind::Configuration,
        FailureKind::Processing,
        FailureKind::Exit,
        FailureKind::OutputLimit,
        FailureKind::DiagnosticLimit,
        FailureKind::InvalidText,
    ] {
        for code in [None, Some(0), Some(u32::MAX)] {
            let failure = WhisperFailure::at_exit(kind, code);
            let reason = failure.audit_reason();
            assert!((1..=64).contains(&reason.len()));
            assert!(reason
                .bytes()
                .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'_'));
            let event = AuditEvent::producer(
                uuid::Uuid::new_v4().to_string(),
                AuditSource::Cloud,
                "perception.voice.transcribe".into(),
                "voice.turn.transcribe".into(),
                AuditStage::Error,
                AuditOutcome::Error,
                Some(10),
                None,
                reason,
            )
            .unwrap();
            assert!(event.validate().is_ok());
            assert!(!failure.public_message().is_empty());
        }
    }
}

#[cfg(any(windows, unix))]
#[test]
fn zero_exit_fatal_stderr_discards_partial_text_without_exposing_it() {
    let command = fixture(
        r#"[Console]::Out.Write('PRIVATE_SYNTHETIC_TRANSCRIPT'); [Console]::Error.WriteLine("error: failed to read audio file 'D:\synthetic-private\FAKE_KEY_ONLY.wav'"); exit 0"#,
        "printf PRIVATE_SYNTHETIC_TRANSCRIPT; printf \"error: failed to read audio file 'D:/synthetic-private/FAKE_KEY_ONLY.wav'\\n\" >&2; exit 0",
    );
    let failure = run(command, Vec::new(), || false, Duration::from_secs(10)).unwrap_err();
    assert_eq!(failure.kind, FailureKind::Audio);
    assert_eq!(failure.exit_code, Some(0));
    for observable in [
        failure.public_message(),
        failure.audit_reason(),
        format!("{failure:?}"),
    ] {
        for secret in [
            "PRIVATE_SYNTHETIC_TRANSCRIPT",
            "synthetic-private",
            "FAKE_KEY_ONLY",
        ] {
            assert!(!observable.contains(secret));
        }
    }
}

#[cfg(any(windows, unix))]
#[test]
fn warning_only_process_delivers_its_text() {
    let command = fixture(
        "[Console]::Error.WriteLine('warning: synthetic fixture only'); [Console]::Out.Write('fixture-success'); exit 0",
        "printf 'warning: synthetic fixture only\\n' >&2; printf fixture-success; exit 0",
    );
    let text = run(command, Vec::new(), || false, Duration::from_secs(10)).unwrap();
    assert_eq!(text, b"fixture-success");
}

#[cfg(any(windows, unix))]
#[test]
fn both_flooded_pipes_drain_and_a_fatal_after_the_prefix_cannot_be_silence() {
    let command = fixture(
        "$o=[Console]::OpenStandardOutput(); $e=[Console]::OpenStandardError(); $b=[Text.Encoding]::ASCII.GetBytes(('x'*4096)); for($i=0;$i -lt 128;$i++){ $o.Write($b,0,$b.Length); $e.Write($b,0,$b.Length) }; $f=[Text.Encoding]::ASCII.GetBytes(\"`nerror: failed to read audio file '-'`n\"); $e.Write($f,0,$f.Length); exit 0",
        "i=0; while [ $i -lt 4096 ]; do printf 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; printf 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' >&2; i=$((i+1)); done; printf \"\\nerror: failed to read audio file '-'\\n\" >&2; exit 0",
    );
    let started = Instant::now();
    let failure = run(command, Vec::new(), || false, Duration::from_secs(10)).unwrap_err();
    assert_eq!(failure.kind, FailureKind::DiagnosticLimit);
    assert_eq!(failure.exit_code, Some(0));
    assert!(started.elapsed() < Duration::from_secs(10));
}

#[cfg(any(windows, unix))]
#[test]
fn oversized_stdout_is_rejected_after_the_process_finishes() {
    let command = fixture(
        "$o=[Console]::OpenStandardOutput(); $b=[Text.Encoding]::ASCII.GetBytes(('x'*4096)); for($i=0;$i -lt 32;$i++){ $o.Write($b,0,$b.Length) }; exit 0",
        "i=0; while [ $i -lt 2048 ]; do printf 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; i=$((i+1)); done; exit 0",
    );
    let failure = run(command, Vec::new(), || false, Duration::from_secs(10)).unwrap_err();
    assert_eq!(failure.kind, FailureKind::OutputLimit);
    assert_eq!(failure.exit_code, Some(0));
}

#[cfg(any(windows, unix))]
#[test]
fn an_early_failed_exit_takes_priority_over_its_broken_stdin_pipe() {
    let command = fixture("exit 7", "exit 7");
    let failure = run(
        command,
        vec![1; 4 * 1024 * 1024],
        || false,
        Duration::from_secs(10),
    )
    .unwrap_err();
    assert_eq!(failure.kind, FailureKind::Exit);
    assert_eq!(failure.exit_code, Some(7));
    assert!(failure.audit_reason().ends_with("_EXIT_00000007"));
}

#[cfg(any(windows, unix))]
fn unread_stdin_fixture() -> Command {
    // exec replaces sh: cancellation owns one process, with no sleeping child
    // left holding inherited pipes after the recognizer fixture is terminated.
    fixture("[Threading.Thread]::Sleep(15000); exit 0", "exec sleep 15")
}

#[cfg(any(windows, unix))]
#[test]
fn cancellation_terminates_before_joining_a_writer_blocked_on_unread_stdin() {
    let command = unread_stdin_fixture();
    let started = Instant::now();
    let failure = run(
        command,
        vec![1; 4 * 1024 * 1024],
        || started.elapsed() >= Duration::from_millis(350),
        Duration::from_secs(10),
    )
    .unwrap_err();
    assert_eq!(failure.kind, FailureKind::Cancelled);
    assert_eq!(failure.exit_code, None);
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[cfg(any(windows, unix))]
#[test]
fn deadline_terminates_before_joining_a_writer_blocked_on_unread_stdin() {
    let command = unread_stdin_fixture();
    let started = Instant::now();
    let failure = run(
        command,
        vec![1; 4 * 1024 * 1024],
        || false,
        Duration::from_millis(150),
    )
    .unwrap_err();
    assert_eq!(failure.kind, FailureKind::Timeout);
    assert_eq!(failure.exit_code, None);
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[cfg(any(windows, unix))]
#[test]
fn a_missing_pipe_after_spawn_still_terminates_the_owned_process() {
    for missing in ["stdin", "stdout", "stderr"] {
        let mut command = unread_stdin_fixture();
        match missing {
            "stdin" => {
                command.stdin(Stdio::null());
            }
            "stdout" => {
                command.stdout(Stdio::null());
            }
            "stderr" => {
                command.stderr(Stdio::null());
            }
            _ => unreachable!(),
        }
        let started = Instant::now();
        let failure = run(command, Vec::new(), || false, Duration::from_secs(10)).unwrap_err();
        assert_eq!(failure.kind, FailureKind::Resources);
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
