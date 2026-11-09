"""Configure Fish through local masked dialogs; never print credentials."""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile


def ask(title, description):
    result = subprocess.run(
        ["zenity", "--entry", "--hide-text", "--width=520", "--title=" + title,
         "--text=" + description],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    if not value or any(c in value for c in "\r\n\x00"):
        raise ValueError("El valor debe ocupar una sola línea y no estar vacío.")
    return value


def main():
    key = ask("Alice · Clave API de Fish", "Pega tu clave API de Fish Audio.\n"
              "Se guardará sólo en tu cuenta Ubuntu y no se mostrará en el chat.\n"
              "Si no la tienes, pulsa Cancelar para continuar sin voz Fish.")
    if key is None:
        print("Configuración cancelada; credenciales anteriores conservadas.")
        return
    reference = ask("Alice · ID de la voz Fish", "Pega el ID de la voz de Alice que usabas en Windows.\n"
                    "Es el reference_id de Fish, no el nombre visible de la voz.")
    if reference is None:
        print("Configuración cancelada; no se guardaron nuevos valores.")
        return
    directory = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "alice-continuum"
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination = directory / "fish.env"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=directory, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write("# Credenciales privadas de Fish para Alice en Ubuntu.\n")
            handle.write("export FISH_API_KEY=" + shlex.quote(key) + "\n")
            handle.write("export ALICE_FISH_REFERENCE_ID=" + shlex.quote(reference) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print("Configuración Fish guardada con permisos 0600; reinicia Alice para cargarla.")
    subprocess.run(["zenity", "--info", "--title=Alice · Fish configurado",
                    "--text=Configuración guardada. Reinicia Alice para cargar la voz."])


if __name__ == "__main__":
    main()
