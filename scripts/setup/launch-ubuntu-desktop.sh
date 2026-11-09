#!/usr/bin/env bash
set -uo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
state="${XDG_STATE_HOME:-$HOME/.local/state}/alice-continuum"
mkdir -p -- "$state"
bash "$root/Iniciar Alice Continuum.sh" >> "$state/launcher.log" 2>&1
status=$?
if (( status != 0 )) && command -v zenity >/dev/null; then
  if tail -n 1 "$state/launcher.log" | grep -q '^Alice ya está iniciada'; then
    zenity --info --title='Alice Continuum' --text='Alice ya está abierta. Selecciona su ventana para continuar.'
  else
    zenity --error --title='Alice Continuum' --text="No se pudo iniciar Alice. El registro está en: $state/launcher.log"
  fi
fi
exit "$status"
