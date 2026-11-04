"""Headless process startup only. Never activates hardware or downloads models."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="alice-ubuntu-smoke-") as temporary:
    env = {**os.environ, "ALICE_DATA_DIR": temporary}
    binary = root / ".cargo-target/debug/alice-continuum"
    process = subprocess.Popen([str(binary)], env=env)
    try:
        time.sleep(10)
        if process.poll() is not None:
            raise RuntimeError(f"Alice terminó antes de tiempo: {process.returncode}")
        audit = Path(temporary) / "audit/events-v1.jsonl"
        events = [json.loads(line) for line in audit.read_text().splitlines()]
        assert any(event.get("reasonCode") == "PROCESS_STARTED" for event in events), events
        print("Ubuntu: proceso vivo y auditoría de inicio comprobada; sin acceso a dispositivos.")
    finally:
        process.terminate()
        process.wait(timeout=10)
