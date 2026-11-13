"""Exercise the isolated static server using disposable synthetic files on D:."""
from __future__ import annotations

from functools import partial
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest

from serve import PilotHandler, PROJECT


class QuietHandler(PilotHandler):
    def log_message(self, *_args):
        pass


class PilotServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        private_root = (PROJECT / "local" / "experiments" / "dioxus-state" / "temp").resolve()
        private_root.mkdir(parents=True, exist_ok=True)
        cls.temporary = TemporaryDirectory(prefix="server-tests-", dir=private_root)
        cls.fixture = Path(cls.temporary.name).resolve()
        if not cls.fixture.is_relative_to(private_root):
            raise RuntimeError("Ruta temporal fuera del piloto")
        cls.dist = cls.fixture / "dist"
        cls.dist.mkdir()
        (cls.dist / "index.html").write_text("synthetic-index", encoding="utf-8")
        (cls.dist / "pilot.wasm").write_bytes(b"\x00asm")
        (cls.dist / "private.json").write_text("not-served", encoding="utf-8")
        (cls.fixture / "outside.css").write_text("outside-marker", encoding="utf-8")
        (cls.dist / "folder").mkdir()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(cls.dist)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        # The resolved target was verified beneath the D: pilot temp root before
        # TemporaryDirectory performs its scoped, recursive fixture cleanup.
        cls.temporary.cleanup()

    def request(self, path):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.request("GET", path)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_only_the_generated_distribution_is_served(self):
        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"synthetic-index")
        self.assertIn("wasm-unsafe-eval", headers["Content-Security-Policy"])
        self.assertNotIn("'unsafe-eval'", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_parent_traversal_cannot_leave_the_distribution(self):
        for route in ["/../outside.css", "/%2e%2e/outside.css", "/..%2foutside.css"]:
            with self.subTest(route=route):
                status, _, body = self.request(route)
                self.assertEqual(status, 404)
                self.assertNotIn(b"outside-marker", body)

    def test_directory_listing_and_unneeded_file_types_are_not_exposed(self):
        for route in ["/folder/", "/private.json", "/data/memory/records.json"]:
            with self.subTest(route=route):
                status, _, body = self.request(route)
                self.assertEqual(status, 404)
                self.assertNotIn(b"not-served", body)

    def test_wasm_has_a_browser_compatible_type(self):
        status, headers, body = self.request("/pilot.wasm")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-type"], "application/wasm")
        self.assertEqual(body, b"\x00asm")


if __name__ == "__main__":
    unittest.main(verbosity=2)
