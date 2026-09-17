import hashlib
from pathlib import Path
import tempfile
import unittest

from document_reader import chunks, extract, extract_bytes


class DocumentReaderTests(unittest.TestCase):
    def test_pdf_real_engine_and_empty_page(self):
        import pymupdf
        with pymupdf.open() as doc:
            doc.new_page().insert_text((72, 72), "Controlled PDF extraction test")
            doc.new_page()
            raw = doc.tobytes()
        result = extract_bytes(raw, ".pdf")
        self.assertEqual(result["totalPages"], 2)
        self.assertIn("Controlled PDF extraction test", result["chunks"][0]["text"])
        self.assertEqual(result["chunks"][0]["page"], 1)
        self.assertEqual(result["sourceSha256"], hashlib.sha256(raw).hexdigest())

    def test_overlap_terminates_and_offsets_are_exact(self):
        text = "abcdefghijklmnopqrstuvwxyz\n" * 100
        pieces = chunks(text, 128, 32)
        self.assertEqual(pieces[-1]["endChar"], len(text))
        for part in pieces:
            self.assertEqual(part["text"], text[part["startChar"]:part["endChar"]])
        self.assertLess(len(pieces), 30)

    def test_invalid_chunk_parameters(self):
        for size, overlap in [(0, 0), (64, -1), (64, 64), (64, 63)]:
            with self.assertRaises(ValueError):
                chunks("", size, overlap)

    def test_read_only_source_and_containment(self):
        with tempfile.TemporaryDirectory(prefix="alice-doc-test-") as directory:
            parent = Path(directory)
            root = parent / "scope"
            root.mkdir()
            path = root / "test.md"
            raw = "# Prueba controlada\nContenido de prueba.".encode()
            path.write_bytes(raw)
            outside = parent / "outside.md"
            outside.write_text("outside")
            result = extract(root, path)
            self.assertEqual(result["sourceSha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(path.read_bytes(), raw)
            self.assertFalse(result["memoryWritten"])
            self.assertEqual(result["source"], "test.md")
            with self.assertRaises(ValueError):
                extract(root, outside)

    def test_empty_and_invalid_utf8(self):
        with tempfile.TemporaryDirectory(prefix="alice-doc-test-") as directory:
            root = Path(directory)
            path = root / "test.txt"
            path.touch()
            self.assertEqual(extract(root, path)["status"], "noText")
            path.write_bytes(b"\xff")
            with self.assertRaises(UnicodeDecodeError):
                extract(root, path)


if __name__ == "__main__":
    unittest.main()
