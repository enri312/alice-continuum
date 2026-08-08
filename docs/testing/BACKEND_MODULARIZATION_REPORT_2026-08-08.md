# Informe de modularización del backend

Fecha: 2026-08-08  
Estado: aprobado

## Alcance

Se modularizó `src-tauri/src/lib.rs` sin cambiar contratos Tauri ni comportamiento observable. También se consolidaron las pantallas React en `src/Page` y se retiraron de la raíz el plan temporal y los archivos `*.tsbuildinfo` generados.

## Estructura resultante

| Archivo | Responsabilidad |
|---|---|
| `avatar.rs` | Ruta y estado del VRM local |
| `cloud.rs` | Proveedores, validación, llamadas HTTPS, parsers y auditoría |
| `memory.rs` | Validación, persistencia, respaldo, exportación y auditoría de memoria |
| `observation.rs` | Estado, captura Win32 y worker autorizado |
| `util.rs` | Tiempo y raíz local de datos |
| `lib.rs` | Orquestación y registro de diez comandos Tauri |

## Controles preservados

- Diez nombres de comandos Tauri sin cambios.
- Contratos JSON `camelCase` sin cambios.
- Seis proveedores y las mismas variables de entorno.
- `ALICE_DATA_DIR`, formatos y subcarpetas de memoria sin cambios.
- Icono de ventana y worker de observación conservados.
- Ninguna operación sobre `Assets/Alice.vrm`, `data/` o `E:\Alice`.

## Pruebas

| Verificación | Resultado |
|---|---|
| `cargo fmt --check` | Aprobada |
| `cargo test` | 14/14 aprobadas |
| `cargo clippy -- -D warnings` | Aprobada, cero advertencias |
| `cargo build` | Aprobada |
| `npm test` | 28/28 aprobadas |
| `npm run build` | Aprobada |
| Arranque real Tauri + Vite | Aprobado; proceso respondía y puerto de depuración cerrado |

Las cuatro pruebas Rust nuevas cubren validación de ruta VRM, extensión insensible a mayúsculas, estado inicial apagado de la observación y eliminación del último contexto al desactivarla.

## Observaciones

- La línea base poseía una advertencia de `clippy` por recibir `&PathBuf`; la migración de Memoria la corrigió a `&Path` sin cambiar resultados.
- `Page` fue movida por Carlos Nuñez a `src/Page`; se actualizaron todas las importaciones y referencias documentales.
- La caché histórica `.cargo-target` permanece ignorada y fuera del flujo de arranque. El destino vigente continúa siendo `src-tauri/target`.
- `records.json` contenía 10 registros antes de iniciar la refactorización. Su última auditoría corresponde a una acción explícita `save` de las 14:19:08, anterior al trabajo de modularización; la huella auditada y la huella final coinciden en `f74bec5a…83a`. No hubo una escritura posterior producida por las migraciones o verificaciones.
