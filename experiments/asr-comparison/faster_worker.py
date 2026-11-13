"""Explicit pilot child, never imported by or launched with Alice."""
import argparse
import io
import json
from pathlib import Path
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument("--model", required=True, type=Path)
parser.add_argument("--manifest", type=Path)
parser.add_argument("--rounds", type=int, default=1)
parser.add_argument("--limit", type=int, default=3)
parser.add_argument("--decode-only", action="store_true")
args = parser.parse_args()
if not 1 <= args.rounds <= 2 or not 1 <= args.limit <= 4:
    raise SystemExit("At most four cases and two passes are permitted")
required_files = ("model.bin", "config.json", "tokenizer.json", "vocabulary.txt")
if any(not (args.model / name).is_file() for name in required_files):
    raise SystemExit("All four pinned local model assets are required; implicit download is forbidden")
if args.manifest:
    if args.manifest.stat().st_size > 16_384:
        raise SystemExit("Manifest exceeds 16 KiB")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("synthetic") is not True or manifest.get("human_acceptance") is not False or not 1 <= len(manifest["cases"]) <= 4:
        raise SystemExit("Only a bounded synthetic corpus is permitted")
    cases = []
    for case in manifest["cases"][:args.limit]:
        file = (args.manifest.parent / case["file"]).resolve()
        if Path(case["file"]).name != case["file"] or not file.is_relative_to(args.manifest.parent.resolve()) or file.stat().st_size > 2_000_000:
            raise SystemExit("Invalid corpus file or size")
        cases.append((case["id"],file.read_bytes()))
else:
    cases = [("stdin", sys.stdin.buffer.read(2_000_001))]
if any(len(wav) > 2_000_000 for _case,wav in cases):
    raise SystemExit("Input limit exceeded")
started = time.perf_counter()
if args.decode_only:
    from faster_whisper.audio import decode_audio
    import av
    for case_id, wav in cases:
        samples = decode_audio(io.BytesIO(wav), sampling_rate=16000)
        if samples.ndim != 1 or not 0 < len(samples) <= 1_000_000:
            raise SystemExit("Decoded synthetic audio is empty or outside its bound")
        print(json.dumps({"case":case_id,"samples":len(samples),"av_version":av.__version__,
            "synthetic":True,"model_loaded":False}),flush=True)
    raise SystemExit(0)
from faster_whisper import WhisperModel
import_done = time.perf_counter()
model = WhisperModel(str(args.model), device="cpu", compute_type="int8",
                     cpu_threads=4, num_workers=1, local_files_only=True)
loaded = time.perf_counter()
for iteration in range(args.rounds):
    for case_id, wav in cases:
        if len(wav) > 2_000_000:
            raise SystemExit("Input limit exceeded")
        tick = time.perf_counter()
        segments, info = model.transcribe(io.BytesIO(wav), language="es", task="transcribe",
            beam_size=5, temperature=0.0, vad_filter=False, condition_on_previous_text=False,
            initial_prompt=None, hotwords=None, without_timestamps=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        print(json.dumps({"case": case_id, "round": iteration, "text": text,
            "language": info.language, "compute_type": model.model.compute_type,
            "import_ms": round((import_done - started) * 1000, 3),
            "load_ms": round((loaded - import_done) * 1000, 3),
            "inference_ms": round((time.perf_counter() - tick) * 1000, 3)}, ensure_ascii=True), flush=True)
