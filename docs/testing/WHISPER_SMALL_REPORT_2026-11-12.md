# Evaluación local de Whisper small para voz baja

Fecha: 2026-11-12. Entorno: Windows, Alice Tauri y CPU local.

El propietario informó que Alice lo oye pero sustituye palabras. Con el perfil
**Voz baja y pausada** confirmado en la interfaz, una toma reconoció la orden
completa de pausa y recibió el recibo local correspondiente; otras alteraron el
servicio o la acción. No se considera estable el reconocimiento de voz baja.

## Cambio que se evalúa

Se instala **small multilingüe** junto a base, con el mismo whisper.cpp v1.9.2.
El archivo se activa sólo tras comprobar SHA-256:
`1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`.
La distribución y su huella se consultaron en la
[fuente enlazada por whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-small.bin).

La selección por defecto prefiere small instalado y conserva base si falta.
La variable explícita `ALICE_WHISPER_MODEL` prevalece. La selección del proceso
y la etiqueta del resultado comparten la misma configuración inmutable por
toma. No se cambia el perfil 4×/2 s, RNNoise, el parseo de órdenes, Gemma ni Fish.

El primer intento con curl de Windows falló al comprobar revocación del
certificado del CDN. La transferencia se realiza mediante HTTPS de Node,
con validación de certificados y verificación posterior del hash; no se
deshabilita TLS ni se modifica el almacén de confianza del sistema.

## Validación

- **385 pruebas Rust aprobadas; 30 sondas opcionales omitidas**.
- Formato, Clippy de todos los targets con `-D warnings` y compilación nativa aprobados.
- Las regresiones comprueban preferencia small/base, override absoluto,
  instalación parcial, etiqueta genérica y configuración conservada cuando
  aparece small después de seleccionar una toma. La cancelación previa impide
  iniciar el proceso; un binario desaparecido informa error.
- El frontend y la captura no cambian en este incremento. Su comprobación
  anterior conserva **738 aprobadas y 2 sondas omitidas**, más 15 de Obsidian y
  20 de respaldo. No se presentan como pruebas nuevas de precisión acústica.
- Los enlaces locales de los nueve documentos afectados se comprobaron.

- El instalador verificó motor, archivo oficial y modelo small de **487.601.967
  bytes**. La transferencia interrumpida por su plazo inicial se reanudó por
  rango; la publicación del archivo esperó la huella completa correcta.
- El CLI cargó small con español, CPU y cuatro hilos, recibió 1 s de silencio
  PCM por stdin y terminó con código **0** en **6.024 ms**. No se guardó audio
  ni se usó una voz personal. Ese tiempo corresponde a este control de carga,
  no a la latencia de una orden real.

El audio controlado sólo acredita carga y ejecución local, no reconocimiento
correcto de voz baja real. Base también se verificó y permanece instalado.

## Protección de datos

Alice se cerró normalmente. Se creó y verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T03-38-04-453Z-3519c32b-7d49-450e-a121-3a8e43327cb7`.
El código previo está en `local/backups/voice-small-20261112/source-before.zip`.
Los **134 archivos privados** conservaron sus huellas durante los cambios y las
pruebas, antes de reabrir Alice. Los modelos quedan fuera del repositorio y los audios de conversación siguen
siendo efímeros. No se guardan tomas personales para esta evaluación.

## Aceptación acústica pendiente

Confirmar en el detalle del siguiente turno que se usó **Whisper small · local
CPU**. Con los demás audios en pausa, decir «Alice pausa Spotify» en voz baja
natural y comprobar texto, recibo, voz y vuelta a espera. Una toma correcta no
completa la prueba prolongada con música ni demuestra mejora estadística frente
a base. Para comparar precisión se necesitaría el mismo conjunto de audio real
con referencias; no se ha realizado esa comparación.
