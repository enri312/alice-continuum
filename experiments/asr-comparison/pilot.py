"""Isolated, manual CPU ASR comparison. No microphone or inference API."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys
import time
import unicodedata
import wave
import zipfile
from bounded_process import run

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STATE = ROOT / "local/experiments/asr-comparison"
PIPER_URL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
HF_REPO = "Systran/faster-whisper-small"
HF_REVISION = "536b0662742c02347bc0e980a01041f333bce120"
MODEL_FILES = {"model.bin", "config.json", "tokenizer.json", "vocabulary.txt"}


def require_model(model):
    missing = sorted(name for name in MODEL_FILES if not (model / name).is_file())
    if missing:
        raise ValueError("Incomplete pinned model; missing " + ", ".join(missing))


def curl_command(url, limit):
    # Standard verified TLS. IPv4/HTTP1.1 works on this notebook where other
    # clients reset connections to the Hub. Disable implicit user curl config.
    return ["curl.exe", "--disable", "-4", "--http1.1", "--location", "--fail",
        "--silent", "--show-error", "--retry", "0", "--connect-timeout", "10",
        "--max-time", "300", "--max-filesize", str(limit), url]


def remote_json(url, state):
    result = run(curl_command(url, 2_000_000), env=environment(state, offline=False),
        timeout=310, stdout_limit=2_000_000)
    if result.code or result.failure:
        raise RuntimeError("Official metadata unavailable: " + result.stderr.decode("utf-8", "replace")[-600:])
    return json.loads(result.stdout)


def environment(state, offline=True):
    result = {key:os.environ[key] for key in ("SystemRoot","WINDIR","PATH","COMSPEC","PATHEXT",
        "PROCESSOR_ARCHITECTURE","NUMBER_OF_PROCESSORS","SystemDrive") if key in os.environ}
    for name, suffix in {"TEMP":"temp", "TMP":"temp", "TMPDIR":"temp",
        "PIP_CACHE_DIR":"cache/pip", "HF_HOME":"cache/huggingface",
        "HF_HUB_CACHE":"cache/huggingface/hub", "HUGGINGFACE_HUB_CACHE":"cache/huggingface/hub",
        "HF_XET_CACHE":"cache/xet", "XDG_CACHE_HOME":"cache", "PYTHONUSERBASE":"cache/user",
        "PYTHONPYCACHEPREFIX":"cache/pycache","HOME":"home","USERPROFILE":"home",
        "APPDATA":"home/AppData/Roaming","LOCALAPPDATA":"home/AppData/Local"}.items():
        target = state / suffix
        target.mkdir(parents=True, exist_ok=True)
        result[name] = str(target)
    result.update(PYTHONDONTWRITEBYTECODE="1", HF_HUB_DISABLE_IMPLICIT_TOKEN="1",
        HF_HUB_DISABLE_TELEMETRY="1", HF_HUB_DISABLE_XET="1", TOKENIZERS_PARALLELISM="false",
        OMP_NUM_THREADS="4", OPENBLAS_NUM_THREADS="4", MKL_NUM_THREADS="4",PYTHONNOUSERSITE="1")
    if offline:
        result.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    return result


def cpp_failure(code, stderr):
    lines = [line.strip() for line in stderr.decode("utf-8", "replace").lower().splitlines()]
    if any("failed to allocate" in line or "not enough memory" in line for line in lines):
        return "memory"
    if any(line.startswith("error: failed to read audio") for line in lines):
        return "decode"
    if any(line.startswith("error: unknown") or (line.startswith("error: argument ") and line.endswith(" requires value")) for line in lines):
        return "configuration"
    if any(line.startswith("error: failed to initialize whisper context") for line in lines):
        return "model"
    if any(line.startswith("error:") or line.endswith(": failed to process audio") for line in lines):
        return "diagnostic"
    return "exit" if code else None


def sha(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def json_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def download(url, target, limit, state, expected=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        if expected and sha(target) != expected:
            raise ValueError("Existing asset hash does not match; it was not overwritten")
        return
    partial = target.with_suffix(target.suffix + ".part")
    if partial.exists():
        raise ValueError("Partial download exists; inspect it before retrying")
    result = run(curl_command(url, limit) + ["--output", str(partial)],
        env=environment(state, offline=False), timeout=310)
    if result.code or result.failure:
        raise RuntimeError("Official download failed: " + result.stderr.decode("utf-8", "replace")[-600:])
    if partial.stat().st_size > limit:
        raise ValueError("Download size limit exceeded")
    if expected and sha(partial) != expected:
        raise ValueError("Downloaded asset SHA-256 mismatch")
    partial.replace(target)


def prepare_tts(state):
    archive = state / "downloads/piper_windows_amd64.zip"
    download(PIPER_URL, archive, 30 * 1024 * 1024, state)
    destination = state / "tts"
    with zipfile.ZipFile(archive) as package:
        if sum(item.file_size for item in package.infolist()) > 256 * 1024 * 1024:
            raise ValueError("Unpacked archive too large")
        for item in package.infolist():
            path = (destination / item.filename).resolve()
            if not path.is_relative_to(destination.resolve()) or (item.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Unsafe archive entry")
        package.extractall(destination)
    json_write(state / "evidence/tts-source.json", {"url":PIPER_URL, "sha256":sha(archive),
        "engine":"eSpeak NG library bundled with official Piper portable release 2023.11.14-2",
        "license":"eSpeak NG GPL-3.0-or-later; Piper MIT; no Windows voice registration"})
    print("Prepared private TTS runtime; no voice installed in Windows", flush=True)


def prepare_model(state):
    url = f"https://huggingface.co/api/models/{HF_REPO}/revision/{HF_REVISION}?blobs=true"
    metadata = remote_json(url, state)
    revision = metadata["sha"]
    if revision != HF_REVISION:
        raise ValueError("Official repository revision mismatch")
    files = []
    allowed = MODEL_FILES
    for item in metadata["siblings"]:
        name = item["rfilename"]
        if name not in allowed:
            continue
        target = state / "models/faster-whisper-small" / name
        expected = item.get("lfs", {}).get("sha256")
        download(f"https://huggingface.co/{HF_REPO}/resolve/{revision}/{name}", target,
            600 * 1024 * 1024, state, expected)
        files.append({"name":name, "bytes":target.stat().st_size, "sha256":sha(target)})
        print("Prepared model asset " + name, flush=True)
    require_model(state / "models/faster-whisper-small")
    json_write(state / "evidence/model-source.json", {"repo":HF_REPO, "revision":revision, "files":files})


def generate_corpus(state):
    libraries = list((state / "tts").rglob("*espeak*.dll"))
    if len(libraries) != 1:
        raise ValueError("Prepare the private portable TTS runtime first")
    library_path = libraries[0]
    dll_directory = os.add_dll_directory(str(library_path.parent))
    library = ctypes.CDLL(str(library_path))
    callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
    captured = bytearray()
    @callback_type
    def callback(samples, length, _events):
        if samples and length:
            captured.extend(ctypes.string_at(samples, length * 2))
        return 0
    library.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    sample_rate = library.espeak_Initialize(1, 0, str(library_path.parent).encode(), 0)
    if sample_rate <= 0:
        raise ValueError("Local eSpeak initialization failed")
    library.espeak_SetSynthCallback.argtypes = [callback_type]
    library.espeak_SetSynthCallback(callback)
    library.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
    if library.espeak_SetVoiceByName(b"es") != 0:
        raise ValueError("Spanish TTS voice is unavailable")
    library.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint,
        ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p]
    sentences = [("pause", "Alice pausa Spotify.", 170),
        ("playlist", "Alice reproduce la playlist Mis favoritos en Spotify.", 170),
        ("question_slow", "Alice, dime qué hora es y cómo estás.", 120)]
    cases = []
    for case_id, expected, rate in sentences:
        captured.clear()
        library.espeak_SetParameter(1, rate, 0)
        text = expected.encode("utf-8") + b"\0"
        text_buffer = ctypes.create_string_buffer(text)
        if library.espeak_Synth(text_buffer, len(text), 0, 1, 0, 1, None, None) != 0:
            raise ValueError("Spanish TTS synthesis failed")
        library.espeak_Synchronize()
        original = struct.unpack("<" + "h" * (len(captured) // 2), captured)
        # Deterministic linear resampling of synthetic speech only. No microphone DSP.
        length = round(len(original) * 16000 / sample_rate)
        normalized = bytearray()
        for index in range(length):
            position = index * sample_rate / 16000
            left = min(len(original) - 1, int(position))
            fraction = position - left
            value = original[left] * (1 - fraction) + original[min(left + 1, len(original) - 1)] * fraction
            normalized.extend(struct.pack("<h", round(value)))
        output = state / "corpus" / (case_id + ".wav")
        output.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(output), "wb") as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000)
            wav.writeframes(normalized)
        cases.append({"id":case_id,"file":output.name,"expected":expected,"tts_rate":rate,
            "seconds":round(length / 16000, 3),"sha256":sha(output)})
    library.espeak_Terminate()
    dll_directory.close()
    json_write(state / "corpus/manifest.json", {"synthetic":True,"human_acceptance":False,
        "tts":"eSpeak NG es, locally synthesized; no Fish/API/microphone", "cases":cases})
    print(json.dumps({"synthetic_cases":len(cases),"human_acceptance":False}), flush=True)


def normalized_words(text):
    text = "".join(c for c in unicodedata.normalize("NFD", text.casefold()) if unicodedata.category(c) != "Mn")
    return re.findall(r"\w+", text)


def word_errors(expected, actual):
    a, b = normalized_words(expected), normalized_words(actual)
    previous = list(range(len(b) + 1))
    for i, word in enumerate(a, 1):
        current = [i]
        for j, other in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (word != other)))
        previous = current
    return {"errors":previous[-1], "reference_words":len(a), "wer":previous[-1] / max(1, len(a))}


def available_memory():
    class Memory(ctypes.Structure):
        _fields_ = [("length",ctypes.c_uint32),("load",ctypes.c_uint32)] + [
            (name,ctypes.c_uint64) for name in ("total_physical","available_physical",
                "total_commit","available_commit","total_virtual","available_virtual","extended")]
    state = Memory()
    state.length = ctypes.sizeof(state)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(state)):
        raise OSError("Could not inspect available memory")
    result = {"available_physical_bytes":state.available_physical,"available_commit_bytes":state.available_commit}
    if min(result.values()) < 1024 ** 3:
        raise RuntimeError("Less than 1 GiB available physical/commit memory; no ASR process was launched")
    return result


def synthetic_manifest(state):
    path = state / "corpus/manifest.json"
    if path.stat().st_size > 16_384:
        raise ValueError("Manifest exceeds 16 KiB")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("synthetic") is not True or manifest.get("human_acceptance") is not False or not 1 <= len(manifest["cases"]) <= 4:
        raise ValueError("This pilot accepts its synthetic corpus only")
    for case in manifest["cases"]:
        file = case["file"]
        wav = (path.parent / file).resolve()
        if Path(file).name != file or not wav.is_relative_to(path.parent.resolve()):
            raise ValueError("Corpus files must remain inside the private corpus directory")
        if wav.stat().st_size > 2_000_000 or sha(wav) != case["sha256"]:
            raise ValueError("Synthetic corpus hash/size mismatch")
        with wave.open(str(wav),"rb") as audio:
            if (audio.getnchannels(),audio.getsampwidth(),audio.getframerate()) != (1,2,16000):
                raise ValueError("Expected the shared PCM16 mono 16 kHz synthetic corpus")
    return manifest


def warm(args, state):
    manifest = synthetic_manifest(state)
    require_model(state / "models/faster-whisper-small")
    memory = available_memory()
    command = [sys.executable,"-B",str(Path(__file__).with_name("faster_worker.py")),
        "--model",str(state / "models/faster-whisper-small"),"--manifest",str(state / "corpus/manifest.json"),
        "--rounds","2","--limit",str(args.limit)]
    result = run(command,cwd=state,env=environment(state),timeout=args.timeout,
        stdout_limit=args.stdout_limit,stderr_limit=args.stderr_limit)
    rows = []
    expected = {case["id"]:case["expected"] for case in manifest["cases"]}
    if result.code == 0 and not result.failure:
        for line in result.stdout.splitlines():
            row = json.loads(line)
            row.update(expected=expected[row["case"]],mode="first_loaded_pass" if row["round"] == 0 else "warm_loaded_pass")
            row.update(word_errors(row["expected"],row["text"]))
            rows.append(row)
            print(json.dumps(row,ensure_ascii=True),flush=True)
    report = {"synthetic":True,"human_acceptance":False,"engine":"faster","cpu_threads":4,
        "warm_cpp_available":False,"equivalent_cpp_warm_comparison":False,
        "memory_before":memory,"worker_wall_ms":result.wall_ms,"exit_code":result.code,
        "failure":result.failure,"stderr_tail":result.stderr.decode("utf-8","replace")[-2000:],"results":rows}
    path = state / "evidence" / ("warm-" + time.strftime("%Y%m%d-%H%M%S") + ".json")
    json_write(path,report)
    print("Private report: " + str(path),flush=True)
    if result.code or result.failure:
        raise SystemExit("Warm evaluation failed; see the private report")


def preflight(args, state):
    synthetic_manifest(state)
    require_model(state / "models/faster-whisper-small")
    command = [sys.executable,"-B",str(Path(__file__).with_name("faster_worker.py")),
        "--model",str(state / "models/faster-whisper-small"),"--manifest",str(state / "corpus/manifest.json"),
        "--limit",str(args.limit),"--decode-only"]
    result = run(command,cwd=state,env=environment(state),timeout=min(args.timeout,30),
        stdout_limit=args.stdout_limit,stderr_limit=args.stderr_limit)
    report = {"synthetic":True,"human_acceptance":False,"model_loaded":False,
        "exit_code":result.code,"failure":result.failure,"wall_ms":result.wall_ms,
        "stderr_tail":result.stderr.decode("utf-8","replace")[-2000:],
        "results":[json.loads(line) for line in result.stdout.splitlines()] if result.code == 0 and not result.failure else []}
    path = state / "evidence" / ("preflight-" + time.strftime("%Y%m%d-%H%M%S") + ".json")
    json_write(path,report)
    print(json.dumps(report,ensure_ascii=True),flush=True)
    if result.code or result.failure:
        raise SystemExit("Decoder preflight failed; no ASR model was loaded")


def compare(args, state):
    manifest = synthetic_manifest(state)
    model = state / "models/faster-whisper-small"
    if "faster" in args.engines.split(","):
        require_model(model)
    worker = Path(__file__).with_name("faster_worker.py")
    env = environment(state)
    rows = []
    for case in manifest["cases"][:args.limit]:
        wav = state / "corpus" / case["file"]
        if sha(wav) != case["sha256"]:
            raise ValueError("Synthetic corpus hash mismatch")
        for engine in args.engines.split(","):
            memory = available_memory()
            if engine == "cpp":
                command = [str(args.cpp_bin),"-m",str(args.cpp_model),"-l","es","-t","4","-ng","-nt","-np","-of","alice-memory-only","-f","-"]
            elif engine == "faster":
                command = [sys.executable,"-B",str(worker),"--model",str(model)]
            else:
                raise ValueError("Unknown engine")
            print(json.dumps({"starting":engine,"case":case["id"],"mode":"cold_process"}), flush=True)
            result = run(command, payload=wav.read_bytes(), cwd=state, env=env, timeout=args.timeout,
                stdout_limit=args.stdout_limit, stderr_limit=args.stderr_limit)
            row = {"case":case["id"],"engine":engine,"expected":case["expected"],"seconds":case["seconds"],
                "mode":"cold_process","wall_ms":result.wall_ms,"exit_code":result.code,
                "failure":result.failure or (cpp_failure(result.code,result.stderr) if engine == "cpp" else ("exit" if result.code else None)),
                "memory_before":memory,"wav_sha256":case["sha256"],"stderr_tail":result.stderr.decode("utf-8","replace")[-2000:]}
            if result.code == 0 and not row["failure"]:
                if engine == "faster":
                    details = json.loads(result.stdout)
                    # The single-input worker calls its input "stdin". Keep the
                    # manifest identity, hash and outcome owned by this runner.
                    row.update({key:details[key] for key in ("text","language","compute_type",
                        "import_ms","load_ms","inference_ms")})
                    actual = details["text"]
                else:
                    actual = result.stdout.decode("utf-8-sig").strip()
                    row.update(text=actual, load_ms=None, inference_ms=None)
                row.update(word_errors(case["expected"], actual))
            rows.append(row)
            print(json.dumps({key:value for key,value in row.items() if key != "stderr_tail"}, ensure_ascii=True), flush=True)
            time.sleep(args.pause)
    report = {"synthetic":True,"human_acceptance":False,"cpu_threads":4,
        "lifecycle":"new child and model load for every case/engine; includes process startup",
        "os_page_cache":"uncontrolled; no system cache flushing",
        "warm_cpp_available":False,"installation_included":False,"results":rows}
    report_path = state / "evidence" / ("comparison-" + time.strftime("%Y%m%d-%H%M%S") + ".json")
    json_write(report_path, report)
    print("Private report: " + str(report_path), flush=True)
    if any(row["failure"] for row in rows):
        raise SystemExit("ASR comparison failed; see the private report")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["prepare-tts","prepare-model","corpus","preflight","compare","warm"])
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--cpp-bin", type=Path, default=Path("D:/Alice-model-evaluation/runtimes/whisper-v1.9.2/bin/Release/whisper-cli.exe"))
    parser.add_argument("--cpp-model", type=Path, default=Path("D:/Alice-model-evaluation/models/whisper/ggml-small.bin"))
    parser.add_argument("--engines", default="cpp,faster")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=90)
    parser.add_argument("--pause", type=float, default=2)
    parser.add_argument("--stdout-limit", type=int, default=65536)
    parser.add_argument("--stderr-limit", type=int, default=65536)
    args = parser.parse_args()
    if not 1 <= args.limit <= 4 or not 0 <= args.pause <= 30 or not 0 < args.timeout <= 180:
        raise ValueError("Use 1–4 cases, pause 0–30 s, and timeout at most 180 s")
    if not 1 <= min(args.stdout_limit,args.stderr_limit) or max(args.stdout_limit,args.stderr_limit) > 1024 * 1024:
        raise ValueError("Pipe limits must be between 1 byte and 1 MiB")
    state = args.state.resolve()
    if state.drive.upper() != "D:":
        raise ValueError("Use a private state directory on D:")
    state.mkdir(parents=True, exist_ok=True)
    safe_environment = environment(state, offline=args.command not in {"prepare-model","prepare-tts"})
    os.environ.clear()
    os.environ.update(safe_environment)
    {"prepare-tts":prepare_tts,"prepare-model":prepare_model,"corpus":generate_corpus,
        "warm":lambda target:warm(args,target),"preflight":lambda target:preflight(args,target)}.get(args.command, lambda target:compare(args,target))(state)


if __name__ == "__main__":
    main()
