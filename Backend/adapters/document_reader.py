"""Explicit, read-only document extraction. Not an automatic memory importer."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

MAX_BYTES = 16 * 1024 * 1024
MAX_CHARS = 2_000_000
MAX_PAGES = 1000


def chunks(text: str, size: int, overlap: int) -> list[dict]:
    if not 64 <= size <= 16000 or not 0 <= overlap <= size // 2:
        raise ValueError("chunk_size must be 64..16000; overlap at most half")
    result = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        result.append({"startChar": start, "endChar": end, "text": text[start:end]})
        if end == len(text):
            break
        start = end - overlap
    return result


def extract(root: Path, file: Path, size: int = 3000, overlap: int = 200) -> dict:
    # Validate before opening a file. Resolve junctions/symlinks before containment.
    chunks("", size, overlap)
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root must be a directory")
    source = (root / file).resolve(strict=True)
    relative = source.relative_to(root)
    if not source.is_file() or source.suffix.lower() not in {".pdf", ".txt", ".md"}:
        raise ValueError("supported files: PDF, TXT, MD")
    with source.open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    return extract_bytes(raw, source.suffix.lower(), relative.as_posix(), size, overlap)


def extract_bytes(raw: bytes, suffix: str, label: str = "selected-document", size: int = 3000,
                  overlap: int = 200) -> dict:
    chunks("", size, overlap)
    if suffix not in {".pdf", ".txt", ".md"}:
        raise ValueError("unsupported format")
    if len(raw) > MAX_BYTES:
        raise ValueError("document exceeds byte limit")
    pages = []
    if suffix == ".pdf":
        try:
            import pymupdf
        except ImportError:
            raise RuntimeError("PDF requires PyMuPDF in the selected Python environment") from None
        with pymupdf.open(stream=raw, filetype="pdf") as doc:
            if doc.needs_pass or len(doc) > MAX_PAGES:
                raise ValueError("encrypted document or page limit exceeded")
            total = 0
            for number, page in enumerate(doc, 1):
                text = page.get_text()
                total += len(text)
                if total > MAX_CHARS:
                    raise ValueError("document exceeds character limit")
                pages.append((number, text))
    else:
        text = raw.decode("utf-8-sig")
        if len(text) > MAX_CHARS:
            raise ValueError("document exceeds character limit")
        pages.append((1, text))
    fragments = []
    for page, text in pages:
        for fragment in chunks(text, size, overlap):
            fragments.append({"page": page, **fragment})
    return {"schemaVersion": 1, "status": "ok" if fragments else "noText",
            "source": label, "sourceSha256": hashlib.sha256(raw).hexdigest(),
            "totalPages": len(pages), "chunks": fragments,
            "memoryWritten": False, "inferencePerformed": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path)
    parser.add_argument("--file", type=Path)
    parser.add_argument("--stdin", action="store_true")
    parser.add_argument("--format", choices=["pdf", "txt", "md"])
    parser.add_argument("--chunk-size", type=int, default=3000)
    parser.add_argument("--chunk-overlap", type=int, default=200)
    args = parser.parse_args()
    try:
        if args.stdin:
            if not args.format or args.root or args.file:
                raise ValueError("stdin requires format, without paths")
            result = extract_bytes(sys.stdin.buffer.read(MAX_BYTES + 1), "." + args.format,
                                   size=args.chunk_size, overlap=args.chunk_overlap)
        else:
            if not args.root or not args.file:
                raise ValueError("root and file required")
            result = extract(args.root, args.file, args.chunk_size, args.chunk_overlap)
    except Exception as error:
        # No paths, document excerpts or traceback in errors.
        print(json.dumps({"status": "error", "code": type(error).__name__,
                          "message": "Extraction failed; check scope, format, limits and PDF dependency"}))
        return 1
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
