# ADR-P-108 — Memoria modular y React 19.3.1

Fecha: 2026-11-04. Estado: implementada y verificada.

## Contexto

Carlos autoriza continuar la separación de consultas, validaciones y escrituras
de memoria y solicita actualizar React. El módulo `memory.rs` reunía 10.875
líneas: contratos, reglas, operaciones de archivos, comandos Tauri y pruebas.

## Decisión

Conservar `memory.rs` como fachada de los 28 comandos existentes y su auditoría
R3. Separar el resto en `src-tauri/src/memory/`, con módulos privados e
importaciones explícitas. Los campos internos de los contratos son accesibles
dentro del árbol de memoria; sus nombres y atributos Serde se conservan.

| Módulo | Responsabilidad |
|---|---|
| `model.rs` | Contratos y estructuras serializadas |
| `validation.rs` | Validación de registros, documentos y decisiones |
| `queries.rs` | Lecturas, catálogo Markdown e inspecciones |
| `records.rs` | Preparación y ejecución del guardado, exportación y restauración básicos |
| `storage.rs` | Primitivas de archivos, huellas y reemplazo atómico ya existente |
| `paths.rs` | Inicialización del directorio y migración histórica mediante Tauri |
| `layers.rs`, `lifecycle.rs` | Proyecciones por capas y su ciclo de vida |
| `assessment.rs` | Vigencia, accesibilidad y supresión |
| `retention.rs` | Archivo reversible y eliminación gobernada |
| `reconsolidation.rs` | Corrección versionada y recuperación |
| `consolidation.rs` | Planes, recibos y recuperación de transacciones |
| `learning.rs` | Incorporación confirmada e idempotente |
| `tests.rs` | Pruebas originales y lectura canónica opcional |

La fachada queda en 611 líneas. Los casos básicos reciben rutas en lugar de
`AppHandle`; las consultas no crean almacenes. Se conserva la validación inicial
del guardado antes de abrir o inicializar el directorio, el bloqueo de escritura,
las fronteras de auditoría y el orden de respaldo/restauración. El catálogo
Markdown sigue siendo de sólo lectura, sin inicialización ni migración.

Las operaciones avanzadas mantienen sus reglas transaccionales y parte de su
acceso directo a archivos dentro de sus módulos de caso de uso. Esta separación
no constituye una migración completa a Clean Architecture ni un nuevo motor de
almacenamiento. No se migra el contenido de recuerdos por reorganizar código.

Actualizar React y React DOM de 19.2.8 a **19.3.1**, versión estable publicada en
npm y confirmada en la [publicación oficial](https://github.com/react/react/releases/tag/v19.3.1).
Actualizar ambos paquetes de tipos a **19.3.0** y conservar el lockfile. No se
activan APIs nuevas de presentación como parte de esta actualización.

## Verificación

- 563 pruebas frontend aprobadas, dos sondas omitidas; TypeScript/Vite compilan.
- 326 pruebas Rust aprobadas, 28 sondas omitidas; Clippy con todos los targets y
  `-D warnings`, formato y enlace nativo aprobados.
- Se conservan los 104 cuerpos de tipos originales y 137 de las 142 funciones.
  Cinco comandos delegan ahora en casos de consulta o persistencia.
- Cinco pruebas nuevas cubren lecturas sin creación, edición confirmada rechazada,
  bytes exactos de respaldo/restauración y exportación sin mutación del origen.
- Una sonda ignorada por defecto leyó los tres registros y cinco notas Markdown
  canónicos, comparando las huellas de archivos antes y después sin cambios.
- La auditoría npm reportó cero vulnerabilidades.

Evidencia y límites: [informe de modularización](../testing/MEMORY_MODULAR_REACT_REPORT_2026-11-04.md).
