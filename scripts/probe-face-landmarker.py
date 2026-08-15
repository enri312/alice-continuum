#!/usr/bin/env python3
"""Sonda facial local, explícita y sin persistencia para Alice Cognitive Core."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = (
    PROJECT_ROOT / "Assets" / "Models" / "private" / "face_landmarker_float16_v1.task"
)
DEFAULT_CAMERA = "ACER HD User Facing"
EXPECTED_MODEL_SHA256 = "64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF"
TRACKED_CHANNELS = (
    "browInnerUp",
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "eyeLookDownLeft",
    "eyeLookDownRight",
    "eyeLookInLeft",
    "eyeLookInRight",
    "eyeLookOutLeft",
    "eyeLookOutRight",
    "eyeLookUpLeft",
    "eyeLookUpRight",
    "jawOpen",
    "mouthSmileLeft",
    "mouthSmileRight",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def percentile_95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round(0.95 * (len(ordered) - 1)))))
    return ordered[index]


def directshow_video_devices() -> list[str]:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("FFmpeg no está disponible en PATH")
    query = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-list_devices",
            "true",
            "-f",
            "dshow",
            "-i",
            "dummy",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=8,
        check=False,
    )
    listing = query.stdout + query.stderr
    return re.findall(r'"([^"\r\n]+)" \(video\)', listing)


def validate_runtime(model_path: Path, camera_label: str, *, require_camera: bool) -> dict[str, Any]:
    if sys.platform != "win32":
        raise RuntimeError("esta sonda está confinada a Windows y DirectShow")
    if not model_path.is_file():
        raise RuntimeError(f"falta el modelo local: {model_path}")
    actual_hash = sha256_file(model_path)
    if actual_hash != EXPECTED_MODEL_SHA256:
        raise RuntimeError(
            "el SHA-256 del modelo no coincide; la sonda se niega a cargarlo "
            f"(recibido {actual_hash})"
        )

    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except ImportError as error:
        raise RuntimeError(f"falta una dependencia local: {error.name}") from error

    cameras = directshow_video_devices()
    if require_camera and camera_label not in cameras:
        raise RuntimeError(f"la cámara exacta autorizada no aparece en DirectShow: {camera_label}")

    return {
        "python": sys.version.split()[0],
        "opencv": cv2.__version__,
        "mediapipe": getattr(mp, "__version__", "unknown"),
        "numpy": np.__version__,
        "modelPath": str(model_path),
        "modelSha256": actual_hash,
        "modelBytes": model_path.stat().st_size,
        "cameraLabel": camera_label,
        "cameraPresent": camera_label in cameras,
    }


def run_live_probe(
    model_path: Path,
    camera_label: str,
    duration_seconds: float,
    analyze_every: int,
    required_face_ratio: float,
) -> dict[str, Any]:
    import cv2
    import mediapipe as mp

    cameras = directshow_video_devices()
    if camera_label not in cameras:
        raise RuntimeError(f"la cámara exacta autorizada no aparece en DirectShow: {camera_label}")
    camera_index = cameras.index(camera_label)

    capture = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not capture.isOpened():
        raise RuntimeError("no se pudo abrir la cámara mediante DirectShow")

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=True,
    )

    frames_read = 0
    frames_analyzed = 0
    frames_with_face = 0
    width = 0
    height = 0
    landmark_count = 0
    blendshape_count = 0
    latencies_ms: list[float] = []
    peaks = {channel: 0.0 for channel in TRACKED_CHANNELS}
    started = time.monotonic()
    last_timestamp_ms = -1

    try:
        with mp.tasks.vision.FaceLandmarker.create_from_options(options) as landmarker:
            while time.monotonic() - started < duration_seconds:
                ok, frame = capture.read()
                if not ok or frame is None:
                    continue
                frames_read += 1
                height, width = frame.shape[:2]
                if frames_read % analyze_every != 0:
                    continue

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = max(last_timestamp_ms + 1, int((time.monotonic() - started) * 1000))
                last_timestamp_ms = timestamp_ms
                inference_started = time.perf_counter()
                result = landmarker.detect_for_video(mp_image, timestamp_ms)
                latencies_ms.append((time.perf_counter() - inference_started) * 1000)
                frames_analyzed += 1

                if not result.face_landmarks:
                    continue
                frames_with_face += 1
                landmark_count = max(landmark_count, len(result.face_landmarks[0]))

                if result.face_blendshapes:
                    categories = result.face_blendshapes[0]
                    blendshape_count = max(blendshape_count, len(categories))
                    for category in categories:
                        name = category.category_name
                        if name in peaks:
                            peaks[name] = max(peaks[name], float(category.score))
    finally:
        capture.release()

    elapsed = time.monotonic() - started
    face_ratio = frames_with_face / frames_analyzed if frames_analyzed else 0.0
    if frames_read == 0:
        raise RuntimeError("la cámara abrió pero no entregó fotogramas")
    if frames_analyzed == 0:
        raise RuntimeError("no se llegó a analizar ningún fotograma")
    if face_ratio < required_face_ratio:
        raise RuntimeError(
            f"presencia facial insuficiente: {face_ratio:.3f} < {required_face_ratio:.3f}"
        )

    return {
        "status": "passed",
        "scope": "diagnostic-only",
        "device": camera_label,
        "resolution": {"width": width, "height": height},
        "durationSeconds": round(elapsed, 2),
        "framesRead": frames_read,
        "framesAnalyzed": frames_analyzed,
        "analysisFps": round(frames_analyzed / elapsed, 2),
        "framesWithFace": frames_with_face,
        "facePresenceRatio": round(face_ratio, 3),
        "landmarksPerFace": landmark_count,
        "blendshapeChannels": blendshape_count,
        "latencyMs": {
            "average": round(statistics.fmean(latencies_ms), 2),
            "p95": round(percentile_95(latencies_ms), 2),
        },
        "trackedChannelPeaks": {name: round(value, 4) for name, value in peaks.items()},
        "rawFramesPersisted": 0,
        "landmarkCoordinatesPersisted": 0,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Comprueba MediaPipe Face Landmarker contra la cámara local y sólo imprime métricas "
            "agregadas. No guarda imágenes, video ni coordenadas."
        )
    )
    parser.add_argument("--live", action="store_true", help="autoriza esta apertura puntual de cámara")
    parser.add_argument("--check-runtime", action="store_true", help="valida runtime y modelo sin abrir cámara")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--camera-label", default=DEFAULT_CAMERA)
    parser.add_argument("--duration-seconds", type=float, default=12.0)
    parser.add_argument("--analyze-every", type=int, default=2)
    parser.add_argument("--require-face-ratio", type=float, default=0.75)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.live == args.check_runtime:
        print("ERROR: elegí exactamente uno de --live o --check-runtime", file=sys.stderr)
        return 2
    if not 3.0 <= args.duration_seconds <= 30.0:
        print("ERROR: --duration-seconds debe estar entre 3 y 30", file=sys.stderr)
        return 2
    if not 1 <= args.analyze_every <= 10:
        print("ERROR: --analyze-every debe estar entre 1 y 10", file=sys.stderr)
        return 2
    if not 0.0 <= args.require_face_ratio <= 1.0:
        print("ERROR: --require-face-ratio debe estar entre 0 y 1", file=sys.stderr)
        return 2

    try:
        runtime = validate_runtime(args.model.resolve(), args.camera_label, require_camera=args.live)
        if args.check_runtime:
            print(json.dumps({"status": "ready", **runtime}, ensure_ascii=False, indent=2))
            return 0
        result = run_live_probe(
            args.model.resolve(),
            args.camera_label,
            args.duration_seconds,
            args.analyze_every,
            args.require_face_ratio,
        )
        print(json.dumps({**runtime, **result}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:  # La sonda debe cerrar con un único diagnóstico legible.
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
