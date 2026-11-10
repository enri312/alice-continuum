#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
if [[ -e .alice-restore-incomplete ]]; then
  echo 'Esta carpeta contiene una restauracion incompleta. Restaura en un destino nuevo.' >&2
  exit 1
fi
if [[ ${1:-} != '' && ${1:-} != '--check' ]]; then
  echo 'Uso: bash "Iniciar Alice Continuum.sh" [--check]' >&2
  exit 2
fi
# rustup may have been installed after the desktop session began.
if ! command -v cargo >/dev/null && [[ -f $HOME/.cargo/env ]]; then
  source "$HOME/.cargo/env"
fi
# Credentials stay on the Linux home filesystem, outside the shared checkout.
fish_config="${XDG_CONFIG_HOME:-$HOME/.config}/alice-continuum/fish.env"
if [[ -f $fish_config ]]; then
  source "$fish_config"
fi
# Private, Linux-only shell configuration; never loaded by the Windows launcher.
if [[ -f local/ubuntu.env ]]; then
  set -a
  source local/ubuntu.env
  set +a
fi
for tool in node npm cargo pkg-config; do
  command -v "$tool" >/dev/null || { echo "Falta $tool. Consulta docs/runbooks/04-ubuntu.md" >&2; exit 1; }
done
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a===26&&b>=13?0:1)' || {
  echo 'Se requiere Node.js 26.13 o superior de la rama 26.' >&2; exit 1;
}
pkg-config --exists webkit2gtk-4.1 || { echo 'Falta WebKitGTK 4.1 y sus dependencias de desarrollo.' >&2; exit 1; }
[[ -x node_modules/.bin/tauri ]] || { echo 'Ejecuta npm ci en esta carpeta.' >&2; exit 1; }
export ALICE_DATA_DIR="${ALICE_DATA_DIR:-$PWD/data}"
[[ $ALICE_DATA_DIR == /* ]] || { echo 'ALICE_DATA_DIR debe ser absoluta.' >&2; exit 1; }
# Keep Linux artifacts separate when this checkout is shared with Windows.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/.cargo-target/linux}"
echo "[ALICE] Proyecto: $PWD"
echo "[ALICE] Datos: $ALICE_DATA_DIR"
echo "[ALICE] Caché Linux: $CARGO_TARGET_DIR"
node --version
cargo --version
node node_modules/@tauri-apps/cli/tauri.js --version
if [[ ${1:-} == '--check' ]]; then exit 0; fi
mkdir -p -- "$ALICE_DATA_DIR"
command -v flock >/dev/null || { echo 'Falta flock (paquete util-linux).' >&2; exit 1; }
# The lock belongs to this checkout; unrelated apps are never closed.
mkdir -p -- local
exec 9>local/alice-launch.lock
flock -n 9 || { echo 'Alice ya está iniciada desde esta carpeta.' >&2; exit 1; }
exec node scripts/backups/cli.mjs run
