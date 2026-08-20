# ADR-P-079 — Inferencia Ollama limitada a loopback

> Nota 2026-08-20: ADR-P-080 amplía el contexto y la memoria de trabajo. Los límites operativos vigentes son 4096 tokens de contexto y 900 tokens máximos de salida.

Fecha: 2026-08-20  
Estado: Aceptada

## Contexto

Alice ya conversa mediante adaptadores remotos y registra respuestas reales en R3 y memoria de trabajo. La notebook también posee Ollama y siete modelos locales compartidos con Cyrcetech y Azyreth. El adaptador genérico `compatible` exige HTTPS y clave porque representa servicios externos; admitir allí HTTP local relajaría una frontera existente y confundiría inferencia local con salida a Internet.

## Decisión

- Registrar `ollama` como proveedor independiente.
- Fijar su único endpoint en `http://127.0.0.1:11434/api/chat`; no aceptar host, puerto ni URL desde React o variables de entorno.
- Habilitarlo sólo cuando `Iniciar Alice.cmd` compruebe una respuesta real de Ollama y verifique que todos los listeners del puerto 11434 son loopback.
- Si no hay servidor, el iniciador ejecuta `ollama serve` con `OLLAMA_HOST=127.0.0.1:11434` en una ventana oculta y espera hasta diez segundos.
- Usar `qwen3.5:4b` por defecto, sustituible mediante `ALICE_OLLAMA_MODEL` sin descargar ni borrar modelos.
- Rechazar identificadores Ollama terminados en `:cloud` o `-cloud`; la ruta local no puede delegar inferencia al servicio remoto de Ollama.
- Enviar `stream:false`, `think:false`, contexto 2048, temperatura 0.2, máximo 1200 tokens y ninguna herramienta.
- Mantener la previsualización y autorización del mismo payload. En ruta local la interfaz debe decir “procesar localmente”, nunca “salir a la nube”.
- Registrar actividad, memoria de trabajo y aprendizaje episódico sólo después de una respuesta real. Un servidor o modelo cargado en reposo no constituye actividad cognitiva.

## Consecuencias

- Alice puede conversar sin transmitir el payload a Internet.
- Cyrcetech y Azyreth conservan sus modelos y manifiestos; Alice comparte la biblioteca sin reclamar propiedad exclusiva.
- El proceso puede utilizar CPU y GPU simultáneamente cuando un modelo no cabe completo en 4 GiB de VRAM.
- La disponibilidad mostrada depende de la sonda del iniciador. Un fallo posterior se registra como error real y no produce una respuesta ni memoria ficticias.
- Un servidor ya abierto en `0.0.0.0`, `::` u otra interfaz de red no se acepta como proveedor de Alice, aunque también responda por `127.0.0.1`.
- La primera versión no inicia herramientas, visión, búsqueda, cámara, micrófono ni acciones corporales desde el modelo.

## Alternativas rechazadas

- Permitir HTTP en `compatible`: mezcla una excepción local con destinos remotos y debilita la validación HTTPS.
- Conectar directamente la interfaz web a Ollama: omite auditoría, memoria de trabajo y la frontera nativa.
- Descargar un modelo nuevo antes de medir los ya instalados: consume disco sin evidencia comparativa.
