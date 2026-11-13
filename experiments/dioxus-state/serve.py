"""Serve only the generated pilot distribution on loopback; never the repo."""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

PROJECT = Path(__file__).resolve().parents[2]
DIST = PROJECT / "local" / "experiments" / "dioxus-state" / "dist"
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; "
       "style-src 'self' 'unsafe-inline'; connect-src 'self'; "
       "img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")


class PilotHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm"}

    def log_message(self, *_args):
        # Request URLs could contain arbitrary text; never persist them.
        pass

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        root = Path(self.directory).resolve()
        route = unquote(urlsplit(self.path).path)
        candidate = (root / ("index.html" if route == "/" else route.lstrip("/"))).resolve()
        if not candidate.is_relative_to(root) or not candidate.is_file() or candidate.suffix not in {".html", ".js", ".css", ".wasm"}:
            self.send_error(404, "Recurso del piloto no disponible")
            return None
        self.path = "/" + candidate.relative_to(root).as_posix()
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5178)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("el puerto debe estar entre 1024 y 65535")
    if not (DIST / "index.html").is_file():
        parser.error("compila primero el piloto con build.ps1")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(PilotHandler, directory=str(DIST)))
    print(f"Piloto Dioxus local: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
