"""Add Linux x64 bindings to a shared Windows checkout without pruning Windows.

For a fresh Linux checkout use npm ci instead. Archives are verified against the
existing lockfile before extraction; package.json and package-lock.json stay intact.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import urllib.request


def main():
    if sys.platform != "linux":
        raise RuntimeError("Este preparador sólo se ejecuta en Linux.")
    root = Path(__file__).resolve().parents[2]
    lock = json.loads((root / "package-lock.json").read_text())
    names = (
        "@rolldown/binding-linux-x64-gnu",
        "@tauri-apps/cli-linux-x64-gnu",
        "@typescript/typescript-linux-x64",
        "lightningcss-linux-x64-gnu",
    )
    for name in names:
        entry = lock["packages"]["node_modules/" + name]
        dest = root / "node_modules" / name
        manifest = dest / "package.json"
        if manifest.exists():
            if json.loads(manifest.read_text())["version"] != entry["version"]:
                raise RuntimeError(f"Versión distinta al lockfile: {name}. Revisa la instalación.")
            print("Ya instalado:", name, entry["version"], flush=True)
            continue
        url = entry["resolved"]
        if not url.startswith("https://registry.npmjs.org/"):
            raise RuntimeError(f"Origen no admitido: {name}")
        data = urllib.request.urlopen(url, timeout=90).read()
        algorithm, expected = entry["integrity"].split("-", 1)
        actual = base64.b64encode(hashlib.new(algorithm, data).digest()).decode()
        if actual != expected:
            raise RuntimeError(f"Integridad incorrecta: {name}; no se instalará.")
        dest.mkdir(parents=True, exist_ok=True)
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            for member in archive.getmembers():
                if not member.name.startswith("package/"):
                    raise RuntimeError(f"Ruta inesperada en el paquete: {name}")
                member.name = member.name[len("package/"):]
                if member.name:
                    archive.extract(member, path=dest, filter="data")
        print("Instalado y verificado:", name, entry["version"], flush=True)


if __name__ == "__main__":
    main()
