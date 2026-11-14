"""Install per-user Ubuntu launchers and the existing Alice icon; no sudo."""
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[2]
app_id = "com.carlosnunez.alicecognitivecore"
data = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
applications = data / "applications"
icons = data / "icons/hicolor/256x256/apps"
applications.mkdir(parents=True, exist_ok=True)
icons.mkdir(parents=True, exist_ok=True)
shutil.copyfile(root / "Backend/src-tauri/icons/128x128@2x.png", icons / (app_id + ".png"))


def quoted(value):
    escaped = str(value).replace("%", "%%")
    for character in ("\\", '"', "`", "$"):
        escaped = escaped.replace(character, "\\" + character)
    return '"' + escaped + '"'


entry = applications / (app_id + ".desktop")
entry.write_text(
    "[Desktop Entry]\nType=Application\nVersion=1.0\n"
    "Name=Alice Continuum\nComment=Asistente personal con conversación y memoria local\n"
    "Exec=/bin/bash " + quoted(root / "scripts/setup/launch-ubuntu-desktop.sh") + "\n"
    "Icon=" + app_id + "\nTerminal=false\nStartupNotify=true\n"
    "StartupWMClass=alice-continuum\nCategories=Utility;\nKeywords=Alice;Asistente;Voz;\n",
    encoding="utf-8",
)
entry.chmod(0o755)
# Preserve the Snap launcher but enable its native accessibility controls on
# subsequent manual launches too. Existing custom user launchers are preserved.
spotify_source = Path('/var/lib/snapd/desktop/applications/spotify_spotify.desktop')
spotify_entry = applications / 'spotify_spotify.desktop'
if spotify_source.is_file() and (not spotify_entry.exists() or 'X-Alice-Managed=true' in spotify_entry.read_text()):
    spotify_text = spotify_source.read_text()
    if 'Exec=/snap/bin/spotify %U' in spotify_text:
        spotify_text = spotify_text.replace('Exec=/snap/bin/spotify %U', 'Exec=/snap/bin/spotify --force-renderer-accessibility %U')
        spotify_text += '\nX-Alice-Managed=true\n'
        spotify_entry.write_text(spotify_text)
        subprocess.run(['desktop-file-validate', str(spotify_entry)], check=True)
subprocess.run(["desktop-file-validate", str(entry)], check=True)
subprocess.run(["update-desktop-database", str(applications)], check=True)
subprocess.run(["gtk-update-icon-cache", "--force", "--ignore-theme-index", str(data / "icons/hicolor")], check=True)

# xdg-user-dir handles translated desktop folder names without parsing shell.
result = subprocess.run(["xdg-user-dir", "DESKTOP"], capture_output=True, text=True, check=True)
desktop = Path(result.stdout.strip())
if desktop.is_dir() and desktop != Path.home():
    shortcut = desktop / "Alice Continuum.desktop"
    shutil.copyfile(entry, shortcut)
    shortcut.chmod(0o755)
    subprocess.run(["gio", "set", str(shortcut), "metadata::trusted", "true"], check=False)
print("Alice Continuum registrada en el menú de aplicaciones y en el escritorio.")
