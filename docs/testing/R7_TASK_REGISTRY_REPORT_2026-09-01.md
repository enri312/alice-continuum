# Informe R7.1 — Registro de tareas e intenciones

Fecha: 2026-09-01

## Resultado

R7.1 implementa el contrato nativo y la inspección pasiva de tareas. No existe scheduler, no se creó ninguna tarea y no se modificó la memoria de Alice.

El contrato distingue:

- recordatorio local con alcance `localNotification`;
- comprobación de solo lectura con alcance `capabilityRead` y referencia sintáctica a R1;
- estados `scheduled`, `paused`, `completed` y `cancelled`;
- programación única `once`;
- origen obligatorio `ownerConfirmed`.

El esquema cerrado rechaza campos adicionales, incluidos comandos o parámetros ejecutables. La identidad usa UUID y los estados pendientes exigen próxima ejecución y cancelabilidad coherentes.

## Pruebas físicas

Seis pruebas nuevas verificaron:

- consulta de un almacén ausente sin crear la raíz;
- lectura de un archivo JSON real preservando exactamente sus bytes;
- rechazo de JSON corrupto sin repararlo ni sobrescribirlo;
- rechazo previo de archivos superiores a 1 MiB sin leerlos ni reescribirlos;
- rechazo de IDs duplicados y transiciones incoherentes;
- separación estricta entre recordatorios y comprobaciones.

La suite completa encontró una expectativa histórica de 26 capacidades dentro de R4. Se actualizó a 27 porque `tasks.registry.inspect` es ahora una capacidad R1 real; no se relajó la validación del manifiesto.

## Sonda canónica

Se ejecutó:

```powershell
$env:ALICE_LIVE_DATA_DIR='E:\Alice Cognitive Core\data'
cargo test --manifest-path src-tauri\Cargo.toml live_canonical_r7_registry_probe_is_read_only -- --ignored --nocapture
```

Resultado:

- estado: `Missing`;
- tareas: 0;
- ejecución automática: `false`;
- archivos antes y después: 35;
- digest agregado antes y después: `a7b6aa4cd14701b978848c2493d6984e0215df742bdf3195916bb0b5e7845835`.

La ausencia es evidencia correcta: R7.1 no fabrica un archivo vacío para aparentar actividad.

## Puerta completa

| Verificación | Resultado |
|---|---:|
| `npm test` | 418/418 aprobadas |
| `npm run build` | aprobado con Vite 8.2.2 |
| `cargo fmt --manifest-path src-tauri\Cargo.toml -- --check` | aprobado |
| `cargo test --manifest-path src-tauri\Cargo.toml` | 235 aprobadas, 19 sondas ignoradas, 0 fallos |
| `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets --all-features -- -D warnings` | aprobado |
| `cargo build --manifest-path src-tauri\Cargo.toml` | aprobado |

Vite conserva la advertencia no bloqueante sobre chunks superiores a 500 kB. El enlazador Rust sólo informó la creación de bibliotecas Windows `.lib` y `.exp`.

## Próximo límite

R7.2 podrá preparar y confirmar un recordatorio único. Antes de escribir deberá definir respaldo, revisión durable, auditoría R3, cancelación idempotente y una vista previa visible. No se habilitará ejecución en ese incremento.
