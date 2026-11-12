# ADR-P-124 — Reconocedor local small y selección por toma

Fecha: 2026-11-12. Estado: implementado; precisión con voz baja pendiente.

El perfil de mayor sensibilidad captó la voz del propietario, pero Whisper
base continuó cambiando palabras en órdenes cortas. Una toma sí reconoció la
orden completa de pausa. Se evalúa **Whisper small multilingüe** conservando
la captura, los filtros y los límites de las acciones para separar el cambio
del reconocedor de los ajustes acústicos anteriores.

La documentación de Whisper describe un compromiso entre tamaño, velocidad y
precisión. Esto justifica probar small; no garantiza que reconozca una toma
concreta ni permite trasladar cifras de una GPU a la CPU de este equipo.
[Whisper: modelos](https://github.com/openai/whisper#available-models-and-languages).

El instalador explícito obtiene small de la distribución enlazada por
whisper.cpp y verifica SHA-256 antes de activar el archivo. Base permanece
disponible. No se descargan modelos al arrancar ni se incluyen pesos en Git.
[Distribución ggml](https://github.com/ggml-org/whisper.cpp/tree/v1.9.2/models) ·
[Archivo y huella de small](https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-small.bin).

Sin override, Alice prefiere `ggml-small.bin` cuando ya está instalado y usa
`ggml-base.bin` si small falta. `ALICE_WHISPER_MODEL` conserva la prioridad para
una ruta absoluta explícita, incluida la vuelta a base. Binario, modelo y
etiqueta se seleccionan una vez por toma; el proceso usa esa misma selección.
La etiqueta deja de afirmar base para cualquier modelo. Los nombres distintos
de los dos archivos conocidos muestran una etiqueta genérica sin exponer rutas.

Se conservan español, CPU con cuatro hilos, entrada/salida por tuberías, límite
de 90 s y cancelación. Un reconocedor instalado que falla no reenvía la toma a
Gemma. Tampoco se añaden aliases de servicio, un texto inicial, una gramática
de órdenes ni una inferencia de verbos perdidos.

[Pruebas y aceptación](../testing/WHISPER_SMALL_REPORT_2026-11-12.md).
