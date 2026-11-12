# ADR-P-126 — Diagnóstico local de la entrada de voz

Fecha: 2026-11-12. Estado: implementado; aceptación acústica pendiente.

La frase «Alice pausa Spotify» continúa cambiando palabras incluso con cierre
manual y el perfil pausado que conserva la salida de RNNoise. El propietario
confirmó que la línea correcta del borrador había sido escrita por él. Por
tanto, esa corrección no acredita un acierto del reconocedor.

Se añaden observaciones de señal, sin modificar las muestras ni seleccionar
otro filtro o modelo. El worklet mide entrada antes del recorte de amplitud y
salida realmente entregada, con contadores independientes. La entrada ya
incluye procesamiento del navegador, pasaaltos y ganancia de Alice: no es una
medición directa del micrófono físico. La salida incluye ceros de arranque y
de falta de datos; los niveles no identifican por sí solos la inteligibilidad.

Los acumulados llegan en los mensajes de métricas existentes. El pipeline
valida y conserva el último lote, sin volver a sumarlo ni reiniciarlo al leer
VAD. La captura copia su snapshot antes de cerrar recursos. Los datos son
parciales hasta el último lote recibido: no se retrasa el apagado para obtener
un vaciado final ni se afirma cobertura exacta del archivo WebM.

En dictado manual se muestran niveles, picos, proporción de muestras recortadas
y cobertura medida. Un dato ausente o inválido queda sin medición. Esos datos
permanecen en la pantalla y no se incorporan a conversación, memoria ni envíos.

La nueva acción **Parar y revisar audio** termina sin iniciar ASR. Utiliza la
toma filtrada que el modo manual ya conserva en estado listo. Un reproductor
local permite escucharla por acción del propietario antes de **Transcribir
localmente**. No se amplía la conservación de audio después del ASR: la vía
normal de transcribir y descartar mantiene su comportamiento.

El reproductor no inicia sonido al aparecer. Su URL local se revoca y su salida
se detiene al comenzar otra toma, transcribir, descartar, cerrar, pasar a la
sesión automática o salir de la pantalla. No se crean archivos de audio ni se
envía esta reproducción a Fish u otro servicio.

Cada resultado ASR se muestra además como **Última transcripción**, separado
del borrador. El borrador sigue conservando texto anterior y correcciones del
propietario; repetir tres tomas puede acumular tres resultados sin que exista
repetición dentro de una sola toma.

[Comprobaciones y límites](../testing/VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).
