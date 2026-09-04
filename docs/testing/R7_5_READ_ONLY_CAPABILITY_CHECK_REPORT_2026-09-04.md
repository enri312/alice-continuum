# Informe R7.5 — comprobación de capacidades en modo lectura

Fecha: 2026-09-04

## Alcance validado

- El backend vuelve a obtener el registro R1 y el estado R2 al pulsar comprobar.
- Una consulta local apta devuelve elegibilidad sin ejecutar su adaptador, escribir,
  crear memoria ni usar red.
- Una capacidad con `sessionOptIn` permanece bloqueada sin grant R2 activo.
- Mutaciones y efectos externos, incluida red, se bloquean por contrato.
- Puentes reconoce el dominio `task` y el efecto `screenObserve` del registro nativo.

## Evidencia automatizada

- `cargo test -q --lib`: 251 aprobadas, 0 fallidas, 19 ignoradas.
- `npm test`: 429 aprobadas en 43 archivos, 0 fallidas.
- `npm run build`: aprobado; permanece el aviso conocido de chunks grandes.
- `cargo clippy --all-targets -- -D warnings`: aprobado.

## Límite vivo

La aplicación abierta aún corresponde al binario previo y su conversación reside en
RAM. Por ello no se reinició ni se ejecutó una comprobación canónica contra la
instancia actual. La validación viva se realizará después de guardar o copiar esa
conversación y reiniciar Alice; la acción sólo deberá leer la capacidad elegida.
