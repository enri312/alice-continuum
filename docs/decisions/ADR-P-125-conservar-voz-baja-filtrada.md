# ADR-P-125 — Conservar la salida filtrada en voz baja

Fecha: 2026-11-12. Estado: implementado; precisión acústica pendiente.

El propietario confirmó que dijo «Alice pausa Spotify» en dictado manual y que
la transcripción sustituyó palabras. El dictado manual espera el botón y no
cierra por silencio: el cierre automático no explica por sí solo este fallo.
La interfaz nativa confirmó Whisper small en los datos de una toma posterior.

Después de RNNoise existe otra etapa que atenúa la señal según la probabilidad
de voz. Su objetivo mínimo es 0,08, intermedio 0,4 y máximo 1, con suavizado.
No se dispone de audio personal guardado que pruebe que esa etapa causó el fallo;
se cambia una sola capa para evaluar si preserva mejor el habla suave.

En **Voz baja y pausada** se conserva la salida ya procesada por RNNoise con
ganancia interna 1, sin esa atenuación adicional. **Normal** mantiene su
comportamiento anterior. El perfil se resuelve al preparar la captura y se fija
al conectar el worklet; un valor ausente o desconocido conserva Normal. No se
permite cambiarlo mediante una segunda conexión de la misma toma.

Se mantienen supresión del navegador, cancelación de eco, pasaaltos, ganancia
local 4×/1×, umbrales de voz, pausas 2 s/1 s, límites, cancelación y errores. El
grabador sigue recibiendo la salida de RNNoise. Si el filtro falla se descarta
la toma; no se cambia a audio crudo ni se reconstruyen verbos o servicios.

El perfil de voz baja puede conservar más ruido residual. Normal queda visible
para volver al comportamiento anterior. Este cambio modifica señal, no pesos,
vocabulario ni autorización de acciones. La aceptación con voz real sigue
siendo necesaria.

[Validación](../testing/SOFT_VOICE_SIGNAL_REPORT_2026-11-12.md).
