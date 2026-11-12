# ADR-P-121 — Recuperación acotada de captura de voz

Fecha: 2026-11-11. Estado: implementado, con regresiones automatizadas.

La orden de reproducir la playlist pasó con la voz del propietario y salida
audible de Spotify y Fish. Después se detuvo la escucha con el aviso genérico de
que el filtro no mantenía el ritmo. Ese aviso no distinguía cola de entrada de
acumulación de salida; la observación no permite atribuir una causa específica.

El worklet conserva el límite de 50 tramas pendientes, el búfer de 24.000
muestras, el arranque de 960 y el procesamiento RNNoise existente. Ahora distingue
`input_backlog`, `output_overflow` y `unsupported_rate`. Las respuestas y
reconexiones tardías no reactivan un procesador cerrado.

El pipeline cierra el filtro antes de notificar el fallo. VoiceCapture descarta
la toma completa y libera sus pistas, callbacks y grabador. Sólo los dos fallos
de planificación permiten a VoiceLoop preparar una nueva captura una vez por
sesión, con un aviso que pide repetir la frase al volver a espera. No se vuelve
a transcribir la toma descartada ni se repiten respuesta, Fish o acciones de PC.

El presupuesto se consume antes del nuevo filtro y se conserva entre silencios
y turnos completados. Sólo un inicio explícito lo restablece. La identidad de la
captura y la generación de sesión rechazan resultados tardíos; apagar el
micrófono cancela también la recuperación. El límite original de dos horas no
se renueva. Un fallo repetido, desconocido o de formato sigue deteniendo la sesión.

Esto añade recuperación local; no demuestra resuelta la causa de la demora ni
sustituye la aceptación acústica de una sesión prolongada.

[Prueba real, regresiones y límites](../testing/VOICE_PLAYLIST_ACCEPTANCE_REPORT_2026-11-11.md).
