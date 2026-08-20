# ADR-P-081 — Observación visual local con candidato revisable

Fecha: 2026-08-20  
Estado: parcial; pendiente validación interactiva del selector

## Contexto

Alice sólo podía leer metadatos de la ventana activa. Para acompañar una clase o trabajo visual necesita recibir píxeles, pero capturar todo el escritorio de forma oculta, almacenar grabaciones o convertir cada salida del modelo en aprendizaje violaría las fronteras de privacidad y evidencia.

## Decisión

- La sesión empieza únicamente mediante `getDisplayMedia`; Windows muestra el selector y limita la fuente a la ventana o pantalla elegida.
- Audio siempre desactivado.
- Una muestra cada cinco minutos; no se acumulan solicitudes si el análisis anterior continúa.
- Reducir el fotograma a 960 píxeles y JPEG 0,72; aceptar como máximo 4 MB base64 en Rust.
- Enviar la imagen únicamente a `127.0.0.1:11434/api/chat`, rechazar modelos cloud, herramientas, streaming y razonamiento visible.
- Qwen devuelve JSON cerrado: tema, hasta cuatro apuntes, dos fragmentos visibles e incertidumbre.
- Descartar la imagen después de cada solicitud. En R3 sólo persisten SHA-256 y metadatos de ejecución.
- Mantener hasta doce análisis como candidato editable en RAM.
- Detener no guarda. Escribir memoria episódica requiere el botón de confirmación y conserva únicamente el texto revisado.
- Mantener `perception.screen.observe` en madurez `partial` y salud `degraded` hasta que el selector se pruebe interactivamente en Alice Desktop.

## Límites

No hay audio, OCR dedicado, grabación, identificación de personas, seguimiento de asistencia, resumen global automático ni aprendizaje semántico. El usuario debe contar con autorización para procesar el contenido compartido.

## Referencias oficiales

- [Microsoft WebView2 — ScreenCaptureStarting y `getDisplayMedia()`](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_27)
- [Ollama — Vision](https://docs.ollama.com/capabilities/vision)
- [Ollama — Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
