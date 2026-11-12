# Revisión de la pérdida de acción en órdenes cortas

Fecha: 2026-11-12. Entorno: Alice Tauri, Windows y Whisper base local CPU.

El propietario confirmó que intentaba decir «Alice pausa Spotify». El último
turno observado llegó como «Alice, Spotify.» y Gemma preguntó si quería
reproducir música. La pérdida se repitió al probar con Spotify en pausa. No se
considera aceptada la orden corta ni se atribuye todo el problema a la música.

La orden larga de abrir la playlist sí había pasado con micrófono, recibo
verificado y música/voz audibles. [Prueba anterior y recuperación del filtro](VOICE_PLAYLIST_ACCEPTANCE_REPORT_2026-11-11.md).

## Cambios y alcance

- Whisper deja de recibir el texto inicial fijo de cuatro nombres. Se conservan
  español, CPU, modelo, canales por memoria y límites del proceso. Es una línea
  base sin ese condicionamiento; la causa acústica aún debe comprobarse.
- «Alice» más un servicio, sin acción, pide aclaración local antes de Gemma y
  de herramientas. La respuesta ofrece pausar, reanudar o reproducir sin
  suponer una acción y sin prefijarla como reproducción fallida.
- Preguntas informativas, citas, terceros y negaciones conservan su tratamiento.
  No se añadieron verbos, aliases ni autorización para reconstruir palabras.

[ADR-P-122](../decisions/ADR-P-122-transcripcion-sin-texto-prefijado.md) enlaza la
referencia oficial del parámetro retirado. La repetición de una palabra del
texto inicial en una salida no demuestra por sí sola causalidad.

## Validación

- **378 pruebas Rust aprobadas; 30 sondas opcionales omitidas**.
- Formato, Clippy de todos los targets con `-D warnings` y compilación nativa aprobados.
- La prueba de argumentos comprueba español, CPU, canales sin archivos y ausencia
  de texto inicial/gramática. Las regresiones de mención incompleta comprueban
  aclaración equilibrada y exclusión de relatos, preguntas, citas y negaciones.
- El frontend no cambió en este incremento. Su validación anterior conserva
  724 aprobadas, 2 sondas omitidas, 15 de Obsidian y 20 de respaldo.

Antes de editar se cerró Alice normalmente y se verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T03-05-10-807Z-749681f2-afad-4fb0-8969-999ff68716f6`.
El archivo de código anterior está en `local/backups/voice-asr-20261112/source-before.zip`.
Los 134 archivos privados mantuvieron sus huellas durante edición y pruebas
aisladas, hasta reabrir la aplicación. Los turnos posteriores de la prueba usan
el guardado normal del historial; no se publican audio ni conversaciones privadas.

## Repetición acústica

Alice se reabrió con el backend compilado. En una toma posterior llegó
«Alice, pausa es potable.»: se reconoció la acción pero no el nombre del servicio.
No se considera aceptada la orden corta. El propietario indicó que hablaba bajo
y despacio por ser de madrugada y solicitó aumentar la sensibilidad.

Para las siguientes tomas, repetir la frase completa en una
sola toma, esperando el estado **En espera** y sin esperar una respuesta justo
después de decir «Alice». La pausa de un segundo termina la toma; no hay un
detector acústico independiente que primero confirme el nombre.

Revisar por separado texto reconocido, recibo de pausa, sonido y continuidad de
la escucha. Una aclaración correcta ante una transcripción incompleta acredita
el límite de ejecución, no la precisión del reconocedor. El cierre de R9 sigue
requiriendo la aceptación cotidiana con varias frases y música.
