# Informe R7.2-A — Persistencia gobernada de tareas

Fecha: 2026-09-01

## Resultado

El backend nativo puede preparar, confirmar y cancelar un recordatorio único sin ejecutar nada. La vista previa es de sólo lectura y la confirmación exige el plan SHA-256 completo, la misma fuente y `confirmed=true`.

## Pruebas físicas temporales

Las pruebas usan directorios reales del sistema temporal, archivos JSON, reemplazos atómicos, respaldos, revisiones e historial JSONL. Verifican que:

- preparar sobre una raíz ausente no crea archivos;
- confirmar crea una fuente válida, una revisión y un índice coherente;
- la auditoría contiene `TASK_REMINDER_CONFIRMED` pero no el título privado;
- repetir la confirmación es idempotente y no duplica auditoría;
- cancelar crea un respaldo exacto, conserva el registro como `cancelled` y retira `nextRunAt`;
- repetir la cancelación no crea otra revisión;
- planes no confirmados, alterados u obsoletos fallan sin escritura.

## Estado canónico

R7.2-A no crea una tarea ficticia para probar producción. `data/tasks/tasks-v1.json` continúa ausente y la sonda R7.1 de sólo lectura debe conservar íntegros los datos canónicos. La primera tarea real se confirmará desde R7.2-B, después de que Carlos pueda revisar título, hora e identidad en pantalla.

La sonda se ejecutó nuevamente después de la implementación: encontró `Missing`, 0 tareas y 35 archivos. Un inventario ordenado de rutas relativas y SHA-256 produjo el mismo digest antes y después, `cebd99a3ed1bdfc60db9e8e73c8fe8fc2f8c8c521352628fc9dc305975af43d0` (`CANONICAL_UNCHANGED=True`). Este digest usa un método de agregación explícito distinto del informe R7.1; sólo se compara consigo mismo dentro de esta ejecución.

## Puerta completa

| Verificación | Resultado |
|---|---:|
| `npm test` | 418/418 aprobadas |
| `npm run build` | aprobado con Vite 8.2.2 |
| `cargo fmt --manifest-path src-tauri\Cargo.toml --all -- --check` | aprobado |
| `cargo test --manifest-path src-tauri\Cargo.toml` | 238 aprobadas, 19 sondas ignoradas, 0 fallos |
| `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets --all-features -- -D warnings` | aprobado |
| `cargo build --manifest-path src-tauri\Cargo.toml` | aprobado después de cerrar únicamente el proceso local de Alice que bloqueaba el `.exe` |

Vite conserva la advertencia informativa por chunks grandes. El enlazador Rust informó solamente la creación normal de bibliotecas Windows `.lib` y `.exp`.

## Límite

No existe scheduler, hilo de vencimiento, notificación, recurrencia ni ejecución de capacidades. `automaticExecution=false` permanece invariable.
