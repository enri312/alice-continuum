# Informe R3 — Auditoría correlacionada de memoria y nube

Fecha: 2026-08-09  
Incremento: R3.3  
Resultado: aprobado

## Alcance implementado

- `memory.save`, `memory.export`, `memory.restore` y `memory.migrate` emiten solicitud y resultado con un `operationId` UUID v4 compartido.
- `cloud.send` emite un evento antes de cualquier red y otro al recibir resultado o error.
- Todos los eventos usan las capacidades canónicas del registro R1.
- Las auditorías heredadas continúan en escritura dual; no se migró ni eliminó historial.
- El parser TypeScript valida campos exactos, UUID, capacidades, operaciones, digest, duración y coherencia entre etapa y resultado.

## Privacidad y política de fallo

El sobre R3 no posee campos para mensajes, recuerdos, sesiones, proveedor, modelo, identificador remoto, tokens o claves. Memoria usa una huella SHA-256 del documento validado. Nube usa la huella del contexto aceptado en la solicitud y la de la respuesta en el resultado.

Si R3 no puede escribir el primer evento, la mutación de memoria o la solicitud de red no empieza. Si el resultado no puede escribirse después de que el efecto terminó, no se repite ni revierte automáticamente: queda el evento inicial, se conserva la auditoría heredada cuando fue posible y el error técnico va a stderr.

## Pruebas reales

| Puerta | Resultado |
|---|---|
| Rust normal | 91/91 aprobadas; dos sondas vivas ignoradas por defecto |
| TypeScript/Vitest | 70/70 aprobadas |
| JSONL aislado | cuatro eventos reales de memoria/nube escritos, releídos y correlacionados |
| Operación de memoria aislada | archivo real escrito y dos eventos R3 reales; contenido ausente del JSONL |
| Red externa | no ejecutada; esta prueba no autoriza enviar conversaciones ni consumir una API |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| Build TypeScript/Vite | aprobado |
| Build Tauri `release` | aprobado |
| Sonda del ejecutable | un `process.startup` real añadido: 8 → 9 eventos |
| Datos canónicos | 7 archivos de memoria sin cambios; nueve archivos base preservados y R3 como décimo archivo |
| Avatar privado | SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3`, sin cambios |

Las carpetas de prueba se crearon bajo el directorio temporal de Windows y fueron eliminadas al finalizar. No se utilizaron recuerdos canónicos, claves, cámara, micrófono ni avatar como fixtures.

La sonda de arranque usó `ALICE_DATA_DIR=E:\Alice Cognitive Core\data`, mantuvo el proceso cinco segundos y lo cerró deliberadamente. El código de salida `-1` corresponde a esa terminación controlada, no a un fallo de inicio; el evento persistido declaró `system / process.startup / execution / success / PROCESS_STARTED`.
