# Memoria modular y actualización React — 4 de noviembre de 2026

Se implementa [ADR-P-108](../decisions/ADR-P-108-memoria-modular-react-19-3.md).
La interfaz conserva los comandos y formatos de almacenamiento de memoria.
React/React DOM pasan a **19.3.1** y sus tipos a **19.3.0**.

## Alcance y conservación de comportamiento

El archivo `src-tauri/src/memory.rs` pasa de **10.875 a 611 líneas**, con 14
archivos subordinados que separan contratos, validaciones, consultas,
persistencia, casos de uso y pruebas. Se conservan importaciones explícitas y
visibilidad restringida al árbol de memoria para sus detalles internos.

La comparación de cuerpos originales confirma 104 tipos conservados y 137
funciones sin cambios. Las cinco excepciones son `load_memory`,
`markdown_note_catalog`, `save_memory`, `export_memory` y
`restore_memory_backup`: sus comandos mantienen firma y nombre, delegando el
trabajo a casos que reciben rutas. Se mantienen los 28 comandos Tauri.

La validación de una solicitud de guardado precede a la inicialización de rutas.
El bloqueo y las llamadas de auditoría R3 siguen en la fachada. Los respaldos,
la protección previa a restaurar y las comprobaciones de fuentes mantienen el
orden original. Las consultas del catálogo no crean carpetas ni ejecutan
migraciones. Las reglas avanzadas se reubican sin reescribir sus transacciones;
parte de su acceso a archivos sigue dentro de esos casos de uso.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Frontend completo con React 19.3.1 | 563 aprobadas; dos sondas omitidas |
| Compilación TypeScript/Vite | Aprobada; persiste el aviso previo de tamaño de paquetes |
| Rust completo | 326 aprobadas; 28 sondas omitidas |
| Clippy `--all-targets -- -D warnings` | Aprobado |
| Formato y enlace nativo | Aprobados |
| Lectura canónica opcional | Una aprobada; tres registros y cinco notas; archivos intactos |
| Auditoría npm | Cero vulnerabilidades reportadas |

Las cinco pruebas nuevas ejercitan:

1. Leer una fuente ausente sin crear el almacén.
2. Leer un catálogo Markdown ausente sin crear memoria o notas.
3. Rechazar cambios de contenido confirmado sin tocar origen, respaldo o temporal.
4. Guardar y restaurar conservando los bytes originales y protegiendo el estado desplazado.
5. Exportar los bytes exactos sin modificar la fuente.

La suite utiliza datos temporales de prueba. La sonda canónica únicamente lee
archivos y compara sus huellas; no guarda, exporta ni restaura datos del
propietario. Antes de la intervención se registraron hashes de los 62 archivos
de datos y activos privados del proyecto.

Para repetir la sonda de lectura explícita desde PowerShell:

```powershell
$previousLiveData = $env:ALICE_LIVE_DATA_DIR
try {
    $env:ALICE_LIVE_DATA_DIR = 'E:\Alice Cognitive Core\data'
    cargo test --manifest-path src-tauri/Cargo.toml --lib live_modular_memory_reads_preserve_canonical_files -- --ignored --nocapture
} finally {
    $env:ALICE_LIVE_DATA_DIR = $previousLiveData
}
```

Los logs, el original de `memory.rs`, el mapa de funciones y la comparación de
cuerpos se conservan localmente en `artifacts/memory-modular-react-2026-11-04/`,
fuera de Git. Los modelos, recuerdos y activos privados tampoco se publican.

## Límites

Se abrió la aplicación normal con la raíz canónica y se observó la pantalla de
conversación, su historial y los 16 recuerdos habituales. El micrófono permaneció
apagado. Vite volvió a preparar las dependencias al cambiar el lockfile.

El control final encontró 61 de los 62 archivos protegidos sin cambios. El
restante es la auditoría R3: conservó sus bytes previos y añadió únicamente un
evento `PROCESS_STARTED` al abrir Alice. Los almacenes personales y activos
permanecen intactos.

La división mejora responsabilidad y posibilidad de probar el almacenamiento;
no demuestra menor latencia de conversación ni sustituye la aceptación de voz.
La extracción de más interfaces de persistencia en casos avanzados puede hacerse
después, manteniendo los controles transaccionales existentes.

Versiones verificadas contra el registro npm y la
[publicación oficial React 19.3.1](https://github.com/react/react/releases/tag/v19.3.1).
