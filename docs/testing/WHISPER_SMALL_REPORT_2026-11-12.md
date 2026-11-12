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
- La selección nativa corresponde al commit `b936a0d`; la presentación de
  modelo y duración se valida en el incremento de observación posterior.
  La captura y los filtros conservan el comportamiento previo. Las pruebas
  automatizadas no se presentan como aceptación de precisión acústica.
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

Antes de añadir observación a la interfaz se cerró Alice normalmente y se
verificó otro respaldo completo:
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T04-01-30-371Z-2579c91b-943a-4d0d-acf2-31ae24c5a292`.
El código previo a ese incremento está en
`local/backups/voice-dictation-20261112/source-before.zip`.
Durante las comprobaciones Alice volvió a abrirse desde el lanzador del
escritorio. La comparación posterior encontró 4 cambios de 134 archivos:
auditoría, estado de autoestudio, manifiesto de Obsidian y progreso del
currículo. Se conserva el respaldo; no se presenta esa comparación como una
prueba de inmutabilidad con la aplicación en ejecución.

## Repetición con voz real

Después de reabrir Alice con small instalado, el propietario volvió a informar
sustituciones al hablar bajo y despacio. La toma observada conservó «Alice» y
cambió el resto por una frase ajena a la orden de pausa. Gemma respondió a ese
texto; no se observó un recibo multimedia de esa toma. El detalle registró
6,5 s de transcripción y 10,4 s hasta iniciar la voz, excluyendo grabación y
pausa de cierre. Son valores de un turno, no una latencia general.

El propietario no alcanzó a ver si Alice empezó a procesar antes de que
terminara de hablar. Por eso no se atribuye todavía el fallo a un cierre
prematuro, a la supresión de ruido o al reconocedor. Small no resolvió la
aceptación con voz baja en esta repetición.

## Observación del turno y siguiente prueba

El backend ya devolvía el nombre del reconocedor, pero los detalles de la
interfaz lo descartaban. Se añade su visualización en ambos modos; la sesión
automática también conserva los segundos emitidos por VoiceCapture. No se
guardan estos datos ni se añaden audios, transcripciones o envíos de diagnóstico.

La observación se valida con **753 pruebas frontend aprobadas y 2 sondas
opcionales omitidas**, **15 de Obsidian**, **20 de respaldo/restauración** y
compilación TypeScript/Vite aprobada. Las 49 pruebas de los tres archivos
afectados también pasaron tras conservar el detalle del último turno al apagar
el micrófono. Los 385 tests Rust y Clippy corresponden al incremento nativo
anterior; no se modificó el backend en este cambio. Permanece el aviso conocido
de tamaño de chunks de Vite.

El dictado manual ya existente usa la misma entrada, filtros y reconocedor,
pero no termina por silencio. Se propone repetir ahí la frase y pulsar
**Terminé de hablar y transcribir** al terminar, sin enviar el borrador al chat.
Si retiene la frase completa, se investigará el cierre automático; si mantiene
las sustituciones, se continuará con nivel/filtro/reconocimiento. Una sola
toma no demuestra precisión estable ni una causa definitiva.

El propietario informó después que no veía esa opción. No se considera hecha
la prueba manual por ese aviso. Se encontró un acceso detrás de dos controles
y oculto durante la escucha automática. Se reemplaza por **Dictar con botón**,
visible desde el arranque, que sólo abre el panel. **Empezar a grabar** conserva
el inicio explícito de la toma. Durante la escucha automática, el acceso manual
permanece visible y bloqueado con una explicación; el controlador también
rechaza iniciar dictado en ese estado.

Para ese ajuste se cerró Alice y se verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T18-33-32-220Z-947bf83b-6def-4f6a-959b-e18c3f840f50`.
El código anterior está en `local/backups/voice-manual-entry-20261112/source-before.zip`.
No se cambian filtros, modelo, umbrales de voz ni plazo de cierre.
Las **10 pruebas existentes de la pantalla** y la compilación TypeScript/Vite
pasaron para ese ajuste. La suite global anterior conserva 753 pruebas frontend
aprobadas y 2 sondas omitidas; no se vuelve a presentar como aceptación de voz.
Durante las comprobaciones hubo una nueva apertura desde el lanzador del
escritorio y se observaron cambios normales en autoestudio, auditoría y Obsidian;
no se afirma inmutabilidad de los datos con Alice en ejecución.

En Tauri se confirmó el acceso visible y se observó una toma manual que terminó
en revisión con borrador, sin enviarlo al chat. El propietario confirmó por
escrito que había dicho «Alice pausa Spotify»; el texto no conservó esa frase.
Por tanto, la aceptación manual también falla. El cierre automático por
silencio no es una explicación suficiente de ese resultado; falta evaluar la
señal y el filtrado antes de atribuir la causa al micrófono o a Whisper.

La escucha automática mantiene su cierre tras 2 s sin evidencia válida de
voz en el perfil pausado. Su botón **Terminé de hablar** sólo puede adelantar
el cierre, mientras el dictado manual espera el botón o su límite de 60 s.
En la interfaz nativa se dejó abierto el panel de dictado con **Empezar a
hablar** disponible y el micrófono apagado. La transcripción de esa prueba
manual requiere la voz real del propietario y sigue pendiente.

## Aceptación acústica pendiente

Confirmar en los datos del siguiente turno que se usó **Whisper small · local
CPU**. Con los demás audios en pausa, decir «Alice pausa Spotify» en voz baja
natural con cierre manual y comprobar el borrador completo. Una toma correcta no
completa la prueba prolongada con música ni demuestra mejora estadística frente
a base. Para comparar precisión se necesitaría el mismo conjunto de audio real
con referencias; no se ha realizado esa comparación.
