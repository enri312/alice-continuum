# Informe R6.1 — Memoria por capas reversible

Fecha: 2026-08-13  
Resultado: aprobado

## Alcance

R6.1 añade una proyección derivada de memoria con estados `unavailable`, `ready`, `active`, `sourceChanged`, `rolledBack` y `blocked`. `records.json` continúa siendo la fuente histórica y editable.

## Pruebas físicas temporales

Las pruebas Rust escriben archivos JSON reales en raíces temporales distintas de `data/` y verifican:

- vista previa sin crear `layer-index-v2.json`;
- clasificación sólo por `kind` y `memoryType` explícitos;
- cero memoria de trabajo persistente;
- activación ligada al SHA-256 revisado;
- rechazo cuando `records.json` cambia antes de confirmar;
- revisión inmutable y reversible;
- índice corrupto bloqueado y preservado para diagnóstico;
- `records.json` idéntico byte a byte después de activar y revertir.

Las pruebas TypeScript rechazan campos desconocidos, conteos incoherentes, automatización, copia de contenido y estados sin evidencia obligatoria.

## Puertas completas

| Puerta | Resultado |
|---|---:|
| `npm test` | 224/224 aprobadas |
| `npm run build` | aprobado |
| `cargo test` | 164 aprobadas, 10 sondas ignoradas, 0 fallidas |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| `cargo build` | aprobado |

## Sonda canónica de sólo lectura

Ejecutada explícitamente con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`:

| Resultado | Valor |
|---|---:|
| Registros v1 | 10 |
| Memoria de trabajo | 0 |
| Episodios | 9 |
| Hechos semánticos enseñados | 0 |
| Sin clasificar | 1 |
| Procedimientos pendientes de vínculo R5 | 1 |
| Archivos canónicos con SHA-256 intacto | 10 |

La sonda no creó el índice R6. Esta ausencia es intencional: activar la proyección pertenece al propietario desde la pestaña **Memoria → Capas R6**.

## Límites

- No analiza proyectos o discos.
- No llama a LLM, embeddings o proveedores.
- No copia contenido al índice.
- No extrae hechos o preferencias.
- No guarda señal sensorial.
- No consolida en segundo plano.
- No convierte un procedimiento enseñado en habilidad aprendida.
