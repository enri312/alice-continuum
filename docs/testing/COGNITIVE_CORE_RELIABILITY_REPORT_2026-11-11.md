# Núcleo: evaluación fiable y prioridad de conversación

Fecha local: 2026-11-11. Proyecto: `D:\Alice Continuum`.

## Resultado

Se corrigen dos problemas del núcleo sin ampliar materias, formatos o permisos:

- Una lección aprobada ya no pierde disponibilidad por timeout, fallo de
  transporte o respuesta no evaluable. Sólo una respuesta completa y validada
  modifica su calificación. Una respuesta válida equivocada sigue contando como
  ejercicio fallido bajo la política existente.
- La conversación reserva prioridad antes de entrar al worker. El autoestudio
  no puede adelantarse a una solicitud pendiente y vuelve a comprobar la cesión
  al recibir la respuesta, además de comprobar la generación del motor.

`local_inference/priority.rs` separa las intenciones de primer plano y su
liberación automática del transporte y del control de procesos. El árbitro
global de residencia Gemma/Ollama conserva su responsabilidad anterior.
El nuevo paso de persistencia de autoestudio comprueba pausa y generación antes
y bajo su bloqueo. No se altera el contrato de los comandos Tauri.

Un fallo técnico termina el ciclo con `phase="error"` y un aviso constante, sin
copiar salida del modelo. Conserva los resultados válidos anteriores del ciclo,
los registros de las lecciones y `lastCompletedAt`; lo restante queda para otro
ciclo. No añade intentos ni nodos de conocimiento ficticios y no reclasifica
resultados históricos cuyo origen no puede reconstruirse.

## Protección de la base

Alice se cerró normalmente antes de editar Rust, evitando reinicios automáticos
del modo de desarrollo por cada archivo guardado. Se creó y verificó un respaldo
integral privado antes del cambio:

`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T00-39-52-150Z-5f2991a3-87a9-48fb-a1eb-ac358b939859`

El nombre del snapshot usa UTC; corresponde al 11 de noviembre en la zona del
propietario. El archivo de código versionado previo está en
`local/backups/core-learning-20261111/source-before.zip`, SHA-256
`80A90D377D6511FFE9C9B795929DC07EFB385023EB788088CCF3024FDF4043B8`.
Este ZIP no incluye recuerdos ni modelos. Los recursos externos conservan los
límites del respaldo integral documentado.

Se verificaron las mismas huellas de los **130 archivos privados** antes y
después de las pruebas aisladas y de la sonda de motor real, antes de reabrir
Alice. No se imprimieron contenidos personales ni se añadieron a Git.

## Validación en Windows

| Comprobación | Resultado |
|---|---|
| Suite Rust anterior al cambio | 354 aprobadas; 30 sondas omitidas |
| Suite Rust final | 367 aprobadas; 30 sondas omitidas |
| Pruebas nuevas del núcleo | 6 de evaluación/persistencia y 7 de prioridad/runtime |
| Frontend completo | 702 aprobadas; 2 sondas opcionales omitidas |
| Obsidian y respaldos | 15 y 20 aprobadas con datos aislados |
| Formato Rust y Clippy de todos los targets | Aprobados, advertencias como errores |
| Compilación frontend y nativa | Aprobadas; aviso conocido de paquetes frontend grandes |
| Sonda real de motor propio | 1 aprobada: arranque, respuesta, exclusividad y cierre |
| Reinicio con el lanzador | Alice reabierta; Memoria y la fase de autoestudio disponibles en Tauri |

Las regresiones de evaluación cubren transporte fallido, JSON malformado,
respuesta de otra lección o sin contenido, conocimiento nuevo sin evidencia,
respuestas válidas correctas e incorrectas y los controles bajo bloqueo. El
frontend conserva una lección aprobada en recuperación y en el Volumen al
recibir una fase `error` o `deferred`, sin anunciar un aprendizaje nuevo.

Las regresiones de prioridad cubren una conversación reservada antes de tener
worker o mutex, varias reservas, liberación por error/cancelación y respuesta
lista después de revocar su turno. Se mantienen las comprobaciones anteriores
de parada, generación y liberación del futuro antes de reutilizar la inferencia.

La sonda real ejecuta únicamente
`local_inference::tests::live_owned_start_inference_stop`, que normalmente está
omitida. Inicia el Gemma instalado, pide una respuesta breve de control y cierra
su proceso propio. Verifica reutilización del proceso propio, rechazo de otro
controlador y exclusión de una solicitud Ollama mientras Gemma está activo.
No escribe memoria, historial ni calificaciones canónicas. No es una prueba de
voz, de aprendizaje personal ni de todas las materias con Gemma.

Después de comprobar la integridad se reabrió Alice mediante el lanzador normal.
La ventana nativa cargó Memoria y mostró el ciclo de autoestudio en marcha con
el backend compilado. No se enviaron mensajes de prueba al historial personal.
Las escrituras posteriores del ciclo normal quedan fuera de la comparación de
integridad anterior y corresponden al aprendizaje ya autorizado al arrancar.

Los logs y las huellas locales están en
`local/artifacts/core-learning-20261111/`, fuera de Git. Las pruebas no introducen
un almacén nuevo ni cambian los pesos del modelo.

## Continuación

Queda pendiente revisar la reanudación rápida del autoestudio cuando el ciclo
anterior aún termina, para no perder solicitudes ni publicar una fase inexacta.
La aceptación personal completa de continuidad, recuperación con fuente,
Obsidian y voz conserva los criterios del Roadmap. Esta revisión no presenta
las comprobaciones automatizadas como aceptación cotidiana del propietario.

[Decisión](../decisions/ADR-P-118-evaluacion-fiable-y-prioridad-de-conversacion.md) ·
[Uso](../runbooks/06-autoestudio-al-arrancar.md).
