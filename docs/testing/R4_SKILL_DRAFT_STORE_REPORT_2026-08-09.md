# Informe R4.2 — Almacén local de borradores

Fecha: 2026-08-09  
Estado: validado

## Alcance comprobado

- Índice cerrado `data/skills/manifest.json`, máximo 128 borradores.
- Archivo independiente derivado de `skillId`, sin rutas aportadas por React.
- SHA-256 del borrador vigente y del respaldo anterior.
- Consulta pasiva sin crear `data/skills`.
- Creación y lectura real sobre archivos temporales aislados.
- Edición con `expectedRevisionId`, revisión padre y respaldo verificable.
- Dos ediciones concurrentes reales: exactamente una se guarda y la obsoleta recibe conflicto.
- Rechazo sin mutación ante conflicto de revisión, estado no `draft`, intento de traversal o digest alterado.
- Tres comandos nativos de almacenamiento; cero comandos de aprobación o ejecución.

## Pruebas específicas

Las pruebas Rust escriben y leen archivos reales bajo una carpeta única de `%TEMP%`. No simulan el sistema de archivos y eliminan únicamente su fixture controlado. Las pruebas TypeScript validan snapshots y registros cerrados antes de que la interfaz pueda consumirlos.

| Comprobación | Resultado |
|---|---|
| Rust R4 (`skills::tests`) | 17/17 aprobadas |
| TypeScript R4 (`skills.test.ts`) | 8/8 aprobadas |
| TypeScript completo | 87/87 aprobadas |
| Rust completo | 117/117 normales; 4 sondas vivas ignoradas por diseño |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| Build web | aprobado |
| Build Tauri release | aprobado |

## Integridad privada antes y después

| Recurso | Antes | Después |
|---|---:|---:|
| Archivos bajo `data/` | 10 | 10 |
| SHA-256 agregado de rutas y contenidos | `0CF187A5A5E04D12E960743EA51BDC43A0EC58ECD134C20FB03242F847907B35` | igual |
| `data/skills` canónico | inexistente | inexistente |
| Avatar privado | `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B` | igual |

La batería normal no abrió cámara, micrófono, red ni aplicaciones. Los borradores de prueba vivieron únicamente en `%TEMP%` y se eliminaron al terminar cada caso.

## Límites preservados

- `execution.enabled`, red, procesos y escritura de la habilidad continúan en `false`.
- Guardar el manifiesto es una operación administrativa del Taller; no ejecuta ninguno de sus pasos.
- No se abren cámara, micrófono, red ni aplicaciones.
- No se usan recuerdos personales como datos de prueba.
