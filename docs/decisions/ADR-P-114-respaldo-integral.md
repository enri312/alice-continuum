# ADR-P-114: respaldos integrales versionados desde el lanzador

Fecha: 2026-11-10. Estado: implementado para los lanzadores del código fuente.

La recuperación del proyecto demostró que Git no contiene los recuerdos,
conversaciones ni recursos privados. La exportación de Memoria cubre registros
confirmados, y la proyección de Obsidian no reemplaza un respaldo integral.

Se incorpora un supervisor Node, ya disponible en los lanzadores Windows/Ubuntu,
sin cambiar el backend Rust, los modelos ni los formatos de memoria. Copia al
iniciar, cada 15 minutos y al cierre normal. Las versiones idénticas se reutilizan
sólo después de verificarlas. El proceso no sube datos ni borra versiones.

`scripts/backups/files.mjs` contiene las operaciones de archivos y hashes;
`permissions.mjs` protege las carpetas; `snapshot.mjs` define alcance, inventario,
Git, validación y restauración; `session.mjs` coordina el ciclo; `cli.mjs` adapta
los comandos y el proceso de Tauri. No hay efectos al importar los módulos.

La copia debe publicarse por renombrado sólo después de verificarla. Se usan
archivos nuevos, sincronización a disco, manifiesto con SHA-256 y comprobación
de estabilidad de las fuentes. Esto no se presenta como una transacción de todos
los almacenes ni como garantía frente a cualquier fallo físico.

La restauración exige una carpeta inexistente y aislada. No ejecuta contenido
recuperado ni activa claves. Conserva los cambios de archivos sin commit, aunque
no la separación entre staging y working tree. El bundle es independiente del
repositorio original; se comprueba el historial recuperado con `git fsck`.

Por instrucción del propietario, las copias y pruebas de este incremento están
en D:, sin usar C: como destino. Se mantiene pendiente seleccionar otra unidad
física o un destino fuera del equipo. El modelo Gemma y la prioridad del núcleo
cognitivo permanecen; R9 y el cuerpo no forman parte de este cambio.

Consecuencias: las copias completas consumen espacio y el primer arranque añade
el tiempo de copia/verificación. No se añade retención destructiva ni cifrado.
La conservación histórica al alcanzar los límites de conversaciones o recuerdos
se evaluará por separado. Un binario iniciado sin estos lanzadores aún necesita
integración propia para respaldar automáticamente.

Contrato operativo y límites: [respaldo integral](../runbooks/07-respaldo-integral.md).

## Ampliación del alcance privado, 2026-11-15

Al ordenar `runtime/`, los originales de trabajo, recuperaciones y auxiliares
puntuales quedaron en `runtime/drafts/`, `runtime/archives/` y `runtime/maintenance/`.
Estos tres árboles se incluyen completos en los nuevos respaldos. Se mantienen
el manifiesto versión 1, sus categorías existentes y la restauración aislada;
los respaldos anteriores conservan el inventario que tenían al crearse.

Las pruebas de copia y restauración verifican las tres ubicaciones nuevas y la
exclusión de artefactos, entornos Python y caché de compilación. Los modelos,
herramientas instaladas y perfiles de ensayo siguen fuera del respaldo integral.
Antes de mover se verificó una copia integral y otra auxiliar de los originales
que aún no cubría la política. Ver [alcance y evidencia de organización](../testing/LOCAL_DATA_ORGANIZATION_REPORT_2026-11-15.md).
