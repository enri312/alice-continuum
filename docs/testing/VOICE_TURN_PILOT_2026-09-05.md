# Piloto local: turno de voz manual

## Alcance

Interfaz aislada en `http://127.0.0.1:18090`, no una nueva pestaña de Alice. No modifica el proveedor de producción, no conversa, no carga recuerdos y no guarda audio ni transcripciones en disco durante el uso. El usuario decide cuándo abrir el micrófono, finalizar la toma, transcribir y copiar el texto revisado.

Gemma E2B corre en llama.cpp en localhost 18089; el piloto rechaza iniciar si Ollama tiene un modelo activo. No usar Ollama en paralelo. No se descarga ni instala ningún motor adicional.

## Uso

Desde la raíz del proyecto:

```powershell
node scripts/testing/voice-turn-pilot.mjs
```

Abrir la dirección local en Edge o Chrome una vez que la terminal indique «Piloto listo».

1. Pulsar **Grabar mi voz** y aceptar el permiso de micrófono.
2. Hablar con pausas naturales. No hay cierre por detección de silencio.
3. Pulsar **Terminé de hablar**: apaga el micrófono. No transcribe todavía.
4. Pulsar **Transcribir localmente** o **Descartar toma**.
5. Revisar/corregir el texto. **Copiar texto revisado** solo usa el portapapeles por solicitud explícita; no lo envía al chat.
6. Pulsar **Cerrar piloto y liberar modelo** al terminar.

Máximo 60 segundos por toma. Al alcanzar el límite se detiene la grabación sin enviar automáticamente. La toma queda en RAM del navegador; al transcribir se procesa en RAM del servicio y de FFmpeg. No se debe usar esta prueba para audios confidenciales que no se quiera entregar al modelo local.

Cerrar la página libera el micrófono, pero no necesariamente el servidor. El botón de cierre sí apaga el servidor y su proceso de inferencia; también existe un cierre tras 15 minutos sin solicitudes o mediante Ctrl+C en la terminal.

## Validación realizada

`node scripts/testing/voice-turn-pilot-smoke.mjs`, con servicio activo:

- Audio vacío: no invoca el modelo.
- WAV con silencio digital: no invoca el modelo.
- Archivo inválido: HTTP 400.
- Origen no autorizado: HTTP 403.
- Token ausente: HTTP 403.
- Grabación humana real, convertida a WebM: transcripción mediante motor real, aproximadamente 1,51 s. Verificación automática de los dos lenguajes mencionados; no es una métrica exhaustiva de exactitud.
- Edge automatizado: no solicita micrófono ni envía transcripciones al abrir, controles iniciales deshabilitados correctamente y edición del campo habilita copiar. Captura visual inspeccionada.

Los 36 archivos canónicos conservaron sus SHA-256. Audios de ensayo, informe detallado y captura permanecen en `artifacts/gemma-evaluation`, ignorado por Git.

## Límites pendientes

La prueba automatizada de UI **no grabó un micrófono ni validó los botones durante una captura humana en directo**. Posteriormente el propietario realizó la prueba manual y aportó una captura: se ve una transcripción en el campo revisable y el estado «Piloto cerrado», con botones deshabilitados. Esto aporta evidencia del resultado visible y del estado de cierre, pero no mide exactitud respecto del audio original, duración de pausas, ni verifica por sí solo la liberación del dispositivo. No se reproduce aquí el contenido personal de la transcripción.

Siguen pendientes permisos denegados, dispositivos desconectados, ruido ambiental y uso con avatar. No es necesario repetir el piloto básico únicamente por una interrupción de créditos.

## Punto de reanudación

El piloto sigue separado de producción. Próximo paso propuesto: integrar la captura y revisión manual como entrada de texto de la conversación existente, preservando la revisión de contexto y sin guardar una transcripción aislada como conocimiento confirmado. Antes de implementarlo, resolver el ciclo de vida del motor local para no ejecutar Gemma y Qwen simultáneamente. No añadir una pestaña nueva ni activar escucha permanente. La respuesta de voz es una etapa posterior y distinta de transcribir.

Avance posterior: controlador nativo implementado y probado con el motor real; ver [estado y punto exacto de continuación](NATIVE_LOCAL_RUNTIME_2026-09-05.md). Todavía no está habilitado en la interfaz: faltan las tres rutas de inferencia compartiendo el mismo control.

El filtro previo reconoce solo silencio digital exacto; no afirma detectar todas las pausas ni el ruido de una habitación. El motor puede equivocarse con ruido. La transcripción sigue siendo texto revisable, nunca conocimiento confirmado ni una orden ejecutable.

Archivos implementados: `scripts/testing/voice-turn-pilot.mjs`, `scripts/testing/voice-turn-pilot/index.html`, `scripts/testing/voice-turn-pilot/client.js`. Se usa MediaRecorder WebM/Opus en el navegador y FFmpeg ya instalado para decodificar; no se amplió la política de permisos de Tauri ni su capacidad R2.
