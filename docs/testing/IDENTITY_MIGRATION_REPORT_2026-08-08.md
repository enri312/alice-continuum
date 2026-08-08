# Informe de migración — Alice Cognitive Core

Fecha: 2026-08-08  
Estado: migración local y publicación privada aprobadas

## Alcance

Se migró la identidad técnica temporal `Proyecto P` hacia **Alice Cognitive Core** sin borrar el origen, sin modificar `E:\Alice` y sin incluir memoria, claves o avatar dentro de Git.

## Identificadores adoptados

| Elemento | Valor |
|---|---|
| Carpeta canónica | `E:\Alice Cognitive Core` |
| Paquetes JavaScript y Rust | `alice-cognitive-core` |
| Biblioteca Rust | `alice_cognitive_core_lib` |
| Identificador Tauri | `com.carlosnunez.alicecognitivecore` |
| Clave web vigente | `alice-cognitive-core-sessions-v1` |
| Clave web compatible | `proyecto-p-sessions-v1` |

## Verificación de copia

| Elemento | Resultado |
|---|---|
| Commit del origen y destino | Coinciden en `77867c9` antes del informe |
| Archivos privados en `data/` | 9 archivos; conteo, tamaño y SHA-256 coinciden |
| Tamaño total de `data/` | 65.890 bytes |
| Activos privados | 1 archivo; conteo, tamaño y SHA-256 coinciden |
| Tamaño total de `Assets/` | 18.631.596 bytes |
| Carpeta de origen | Conservada intacta como respaldo |
| Estado Git inicial del destino | Limpio |

Las firmas completas se compararon durante la operación, pero no se escriben en este informe para evitar publicar huellas innecesarias de datos privados.

## Verificación técnica en la nueva ruta

| Puerta | Resultado |
|---|---|
| `npm ci` | 180 paquetes; 0 vulnerabilidades informadas |
| `npm test` | 6 archivos y 31 pruebas aprobadas |
| `npm run build` | Aprobado |
| `cargo fmt --check` | Aprobado |
| `cargo test` | 14 pruebas aprobadas |
| `cargo clippy -- -D warnings` | Aprobado |
| `cargo build` | Aprobado |

La primera construcción limpia de Rust produjo metadatos parciales inválidos dentro de `src-tauri/target`. Se eliminó únicamente esa caché regenerable mediante `cargo clean` y se repitió la compilación con un solo trabajo. La reconstrucción completa y todas las puertas posteriores aprobaron; no se modificaron código, memoria ni avatar para resolver el incidente.

Vite conserva una advertencia informativa porque el módulo diferido del visor VRM supera 500 kB. El avatar continúa separado por carga diferida y la advertencia no bloquea esta migración.

## Privacidad

- `data/*` continúa ignorado salvo su README público.
- `Assets/*.vrm` y `Assets/*.vroid` continúan ignorados.
- No se detectaron claves con el escaneo de archivos versionados.
- `node_modules`, `dist` y cachés Rust se regeneraron y no se versionaron.
- El remoto será añadido solamente en la nueva carpeta.

## Verificación de GitHub

| Comprobación | Resultado |
|---|---|
| Repositorio | `enri312/alice-cognitive-core` |
| URL | `https://github.com/enri312/alice-cognitive-core` |
| Visibilidad informada por GitHub | `PRIVATE` |
| Rama predeterminada | `master` |
| Primer commit remoto verificado | `151d3cf` |
| Seguimiento local | `master...origin/master` |

La única acción operativa pendiente es abrir `E:\Alice Cognitive Core` como workspace de Codex antes de continuar R1. La conversación puede mantenerse, pero una tarea abierta sobre la ruta anterior no cambia automáticamente su raíz de herramientas.
