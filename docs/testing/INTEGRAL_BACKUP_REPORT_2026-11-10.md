# Respaldo integral y restauración — 10 de noviembre de 2026

## Resultado en Windows

Se implementó el respaldo integral desde los lanzadores de Alice y una
restauración que exige una carpeta nueva. Las copias se verifican antes de
publicarse, conservan versiones anteriores y no se envían a GitHub.

El ensayo inicial con datos reales copió **810 archivos**, además del bundle
Git, y los restauró en una carpeta aislada de D:. La copia inicial tomó 12,7 s;
copia y restauración juntas, 21,5 s en este equipo. Son mediciones de esa muestra,
no una garantía de rendimiento. Los **87 archivos de `data/`** conservaron sus
hashes y el historial restaurado pasó `git fsck --full`.

Se preservaron código sin commit, memoria confirmada y automática, conversaciones,
autoestudio, Obsidian y sus notas manuales, recursos de `local/assets/` y
configuración privada. No se inició la aplicación recuperada ni se aplicaron
credenciales. El ensayo usó HEAD `4fa6da6` más el árbol de trabajo de este
incremento; las copias posteriores identifican su HEAD en el manifiesto.

Un segundo ensayo restauró **813 archivos** y el historial del commit publicado
`746e9ca`, con 706 archivos de código/documentación, 87 de datos, 17 recursos y
3 de configuración privada. El respaldo ocupó unos 78 MiB. Los 87 archivos
originales continuaron intactos. Su detalle está en `live-restore-final.json`.

Destinos de esta instalación:

- Copias completas: `D:\Alice Backups\Alice Continuum`.
- Restauración de ensayo: `D:\Alice Restore Checks\snapshot-2026-11-10T16-26-07-916Z-92ba991a-faf4-4792-a9e0-57405bf20dc3`.
- Evidencia local, excluida de Git: `local/artifacts/backup-integral-20261110/`.

Por instrucción del propietario, las nuevas copias, restauraciones y archivos
temporales de pruebas se hicieron en D:. No se usó C: como destino. D: sigue
siendo el mismo disco del proyecto: una copia en otra unidad física está pendiente.

## Validación automatizada

| Comprobación | Resultado Windows |
|---|---|
| Vitest | 627 aprobadas; 2 sondas opcionales omitidas |
| Proyección Obsidian | 15 aprobadas |
| Respaldo integral Node | 20 aprobadas |
| TypeScript y Vite | Compilación aprobada |
| Lanzador Windows `--check` | Aprobado sin abrir Alice |

Las 20 pruebas de respaldo cubren:

- Recuperación de los almacenes, código modificado/nuevo/eliminado y ramas Git.
- Snapshots distintos al cambiar contenido y reutilización verificada si no cambia.
- Detección de archivos dañados, ausentes o extra, manifiesto alterado y bundle dañado.
- Creación de una nueva copia cuando la anterior se dañó, conservando la anterior.
- Rechazo de destinos existentes, rutas fuera del inventario, junctions y enlaces.
- Rechazo de una subcarpeta como raíz del repositorio y aislamiento frente a
  variables Git heredadas que podrían redirigir una restauración al original.
- JSON inválido, escritura durante la copia y espacio insuficiente sin publicar éxito.
- Bloqueo de escritores concurrentes, recuperación de bloqueo de un proceso muerto
  y rechazo de bloqueos pertenecientes a otro equipo.
- `ALICE_DATA_DIR` externo, credenciales de recuperación aún no aplicadas y HEAD
  separado de una rama.
- Restauración interrumpida con marcador visible y fuentes intactas.
- Copias serializadas al inicio, durante la sesión y al cierre; fallo de respaldo
  informado sin bloquear el proceso de la aplicación.
- Supervisor CLI con proceso hijo **sintético**, sin abrir Tauri, micrófono o modelo.
- Permisos privados: ACL de Windows limitada al usuario, SYSTEM y administradores;
  permisos `0700` en Linux.

Se mantienen los avisos de Vite sobre bundles grandes ya existentes. No hubo
cambios en el backend Rust ni en los modelos; la validación nativa previa no se
presenta como una nueva prueba de voz de este incremento.

## Integración y documentación

`npm test` incluye las pruebas de respaldo, de modo que la CI Ubuntu existente
las ejecuta junto al resto. La [ejecución final Ubuntu 26.04 de `3a4f1dd`](https://github.com/enri312/alice-continuum/actions/runs/42857888652)
aprobó 627 pruebas frontend, 15 de Obsidian, 20 de respaldo, 355 Rust con 32
omitidas y 19 Python. También pasaron fmt, clippy, compilación, arranque aislado,
soporte WebM/Opus y captura WebKit simulada. El escritorio Ubuntu del propietario
no se abrió durante esta sesión Windows.
Esta ejecución incluye el aislamiento de las variables Git heredadas. La
[ejecución inicial de `746e9ca`](https://github.com/enri312/alice-continuum/actions/runs/42856181138)
también aprobó el conjunto completo.

Se actualizaron README, estructura, índice documental, lanzadores, runbooks y
documento maestro **0.65**. Los cambios del HTML se colocan en los capítulos e
historial; se conserva el estilo y la composición de la portada.
La revisión comprobó 23 IDs HTML únicos y 363 enlaces locales, sin modificar
la portada salvo el número de versión ni sus estilos.

GitHub reportó `isPrivate: false` al comprobar el repositorio. La copia remota
contiene código y documentación; los datos privados, configuración de respaldo,
recursos y pruebas recuperadas permanecen excluidos de Git.

## Límites

La estabilidad por hashes no equivale a una transacción global entre almacenes.
Se puede perder trabajo posterior a la última versión completa ante un corte.
No se eliminan versiones, no se cifra el contenido y no se incluyen modelos
externos, dependencias reinstalables, RAM ni material efímero. Los permisos de
archivos y SHA-256 no reemplazan una copia fuera del disco.

La automatización acompaña a los lanzadores del código fuente; iniciar el binario
directamente no la activa. La aceptación de voz, continuidad, interrupción y
música de R9 queda pendiente. Este incremento protege la base del núcleo
cognitivo y no incorpora un cuerpo ni domótica.

[Operación](../runbooks/07-respaldo-integral.md) ·
[ADR-P-114](../decisions/ADR-P-114-respaldo-integral.md).
