# Núcleo cognitivo: primer incremento de estructura

Fecha: 2026-11-10. Proyecto: `D:\Alice Continuum`.

## Base conservada

Se recibió el checkout con los cambios de autoestudio e integración de Obsidian
sin commit. Antes de modificarlos se copiaron y verificaron por SHA-256 sus
34 archivos de código/documentación y los 87 archivos privados presentes en
`data/`. El respaldo independiente está en
`%USERPROFILE%\.codex\backups\alice-continuum\cognitive-structure-20261110-101041`.
Los datos privados siguen excluidos de Git. El checkpoint `ae75dce` conserva los
cambios recibidos, después de comprobar su suite y buscar credenciales en los
archivos candidatos sin encontrar coincidencias.

Al cerrar la revisión se añade `project-final.bundle`, con el historial Git de
la rama, verificado mediante `git bundle verify`; el manifiesto inicial y los
archivos privados conservan sus huellas. Los modelos y runtimes externos no
forman parte de esta copia.

## Cambio realizado

Autoestudio separa contratos, reglas, persistencia y adaptación de ejercicios a
Gemma. La fachada nativa pasa de **600 a 255 líneas**; las funciones existentes
se distribuyen entre módulos privados. Los dos comandos, la serialización,
las 42 lecciones y la precedencia de conversación y voz se conservan.

La decisión y la tabla de responsabilidades están en
[ADR-P-113](../decisions/ADR-P-113-autoestudio-modular.md).

## Comprobaciones de esta sesión

| Comprobación | Resultado |
|---|---|
| Base frontend | 627 aprobadas, 2 omitidas |
| Sincronización Obsidian | 15 aprobadas, con almacenes de prueba aislados |
| Base Rust | 352 aprobadas, 30 sondas opcionales omitidas |
| Rust después de la separación | 352 aprobadas, 30 sondas opcionales omitidas |
| TypeScript y compilación frontend | Aprobados; persiste el aviso conocido de paquetes grandes |
| Rustfmt y Clippy de todos los targets | Aprobados, con advertencias como errores |
| Compilación nativa Windows | Aprobada |
| Integridad de la extracción | 18 cuerpos de función conservados; sólo se normalizan formato/comentarios y la ruta relativa del currículo incluido |
| Datos personales después de las comprobaciones | 87 archivos con las mismas huellas SHA-256 |
| Ubuntu 26.04, CI | 355 Rust aprobadas, 32 omitidas; 627 frontend, 15 Obsidian y 19 Python aprobadas |
| Ubuntu, ejecución aislada | Formato, Clippy, compilación, arranque, WebM/Opus y captura WebKit simulada con permiso/denegación aprobados |

[CI aprobada](https://github.com/enri312/alice-continuum/actions/runs/42823666373)
para el commit `6b702c2`. Los cambios posteriores sólo añaden el resultado a la
documentación y registran la prioridad del propietario en el plan de R9.

La suite incluye planificación y repaso, rechazo de ejercicios fabricados,
lectura del progreso persistido, pausa, prioridad de conversación, cancelación y
plazo de inferencia. Se reutilizan las pruebas de comportamiento; la extracción
no añade pruebas que repitan el código sólo por haberlo movido.

El informe de autoestudio anterior describe una sonda real con Gemma. Esa sonda
no se repitió para esta separación. En el equipo del propietario no se inició
la aplicación, el estudio personal, Fish, micrófono o cámaras. CI arrancó Alice
con datos aislados y empleó dispositivos simulados. La aceptación visual y la
conversación real de R9 continúan pendientes.

## Revisión con colaboradores

La rama `codex/cognitive-structure-20261110-101041` conserva dos hitos:
`ae75dce` incorpora la base de autoestudio/Obsidian recibida y `6b702c2` separa
autoestudio con su documentación. Revisar el segundo commit permite evaluar la
extracción sin confundirla con la introducción de esas capacidades.

La arquitectura actual es un monolito de escritorio parcialmente modularizado.
El objetivo siguiente es dirigir las dependencias de cada capacidad: reglas y
contratos, casos de uso, adaptadores y presentación. Las carpetas convencionales
de Tauri/Vite y el almacén privado mantienen sus ubicaciones.

Pendientes estructurales: extraer coordinación de `App.tsx`, delimitar el control
del motor frente al transporte de inferencia y evaluar una primitiva de archivos
compartida para los almacenes. Son incrementos posteriores; este informe no
afirma que todo el proyecto aplique Clean Architecture estricta.

Evidencia local: `local/artifacts/cognitive-structure-20261110-101041/`.
