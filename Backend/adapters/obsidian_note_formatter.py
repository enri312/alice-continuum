"""Bounded JSON-to-Markdown worker. No vault, canonical-store or network access."""
from __future__ import annotations

import json
import re
import sys

MAX_INPUT = 8 * 1024 * 1024
MAX_OUTPUT = 32 * 1024 * 1024
JOB_KEYS = {"id", "label", "topic", "content", "states", "provenance", "storage", "technicalJson"}
LABELS = {"Recuerdo registrado", "Recuerdo automatico", "Dato de perfil"}


def unique_object(pairs: list[tuple]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def fence(content: str) -> str:
    delimiter = "`" * max([3, *(len(run) + 1 for run in re.findall(r"`+", content))])
    return f"{delimiter}text\n{content}\n{delimiter}\n"


def render_note(job: dict) -> str:
    return (f"# {job['label']}\n\nCopia de consulta del proyecto. Editar esta nota no cambia la memoria de Alice.\n"
            "Los estados se conservan como datos; esta vista no incorpora recuerdos al contexto.\n\n"
            f"## Tema\n\n{fence(job['topic'])}\n"
            f"## Contenido\n\n{fence(job['content'])}\n"
            f"## Estado en Alice\n\n{fence(chr(10).join(job['states']))}\n"
            f"## Procedencia\n\n{fence(job['provenance'])}\n"
            f"## Fuente de almacenamiento\n\n{fence(job['storage'])}"
            f"\n## Registro tecnico\n\n{fence(job['technicalJson'])}")


def render_batch(request: object) -> list[dict]:
    if (not isinstance(request, dict) or set(request) != {"schemaVersion", "notes"}
            or type(request["schemaVersion"]) is not int or request["schemaVersion"] != 1
            or not isinstance(request["notes"], list) or len(request["notes"]) > 1000):
        raise ValueError("invalid_request")
    ids = set()
    for job in request["notes"]:
        if (not isinstance(job, dict) or set(job) != JOB_KEYS
                or any(not isinstance(job[key], str) for key in JOB_KEYS - {"states"})
                or not job["id"] or job["id"] in ids or len(job["id"]) > 128
                or job["label"] not in LABELS
                or not isinstance(job["states"], list) or len(job["states"]) > 6
                or any(not isinstance(value, str) for value in job["states"])):
            raise ValueError("invalid_note")
        ids.add(job["id"])
    return [{"id": job["id"], "markdown": render_note(job)} for job in request["notes"]]


def main() -> int:
    if len(sys.argv) != 1:
        raise ValueError("arguments_not_supported")
    raw = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(raw) > MAX_INPUT:
        raise ValueError("input_limit")
    request = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    notes = render_batch(request)
    result = json.dumps({"schemaVersion": 1, "notes": notes}, ensure_ascii=True,
                        allow_nan=False, separators=(",", ":")).encode("ascii")
    if len(result) > MAX_OUTPUT:
        raise ValueError("output_limit")
    sys.stdout.buffer.write(result)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, UnicodeError, TypeError, KeyError, RecursionError):
        sys.stderr.buffer.write(b'{"error":"invalid_note_request"}\n')
        raise SystemExit(2)
