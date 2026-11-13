# ADR-P-128 — Feedback de escucha y aclaración local de medios

Fecha: 2026-11-12. Estado: implementado y comprobado con tests y compilación
frontend, formato y Clippy; aclaración y estados revisados en Tauri. La
aceptación acústica sigue pendiente.

Una prueba posterior al cambio de voz volvió a producir un fragmento musical
incorrecto. La generación conversacional respondió con una formulación de
acción que no acreditaba ninguna ejecución. Además, las tomas descartadas
volvían a espera sin explicar al propietario por qué no había respuesta.
El propietario confirmó que dijo «Alice reproduce Spotify». La transcripción
cambió el verbo; no se trataba de una orden de pausa inferida del contexto.

## Motivos de tomas no atendidas

La interfaz identifica la captura preparada con **Escuchando · di Alice y tu
frase**. Transcribir, generar respuesta y reproducir voz mantienen sus estados
propios y el micrófono apagado.

El desplegable existente **Audio de entrada · reducción de ruido local**, cerrado
inicialmente, contiene el detalle **Resultado de entrada no atendido**. Distingue
captura sin evidencia suficiente de voz, ASR sin palabras y texto no aceptado
como dirigido a Alice, sin inventar una transcripción cuando no existe. La
escucha sólo añade una línea contextual breve, sin panel abierto adicional ni
avisos de lectura en vivo repetidos.

La observación pertenece sólo a la pantalla: no añade chat, historial, recuerdo,
auditoría con texto, ejecución ni petición a Fish. Se conserva un único resultado,
limpiado al apagar, fallar o iniciar sesión y al atender un turno. Un silencio
posterior conserva el resultado ASR que se está inspeccionando; otro ASR puede
actualizarlo. El último mensaje atendido sigue separado. Los callbacks revocados
no publican resultados de una sesión anterior. No se añaden procesos, timers ni
dependencias para este diagnóstico.

## Petición musical ambigua

La regla local se limita a tres palabras: «Alice», un candidato imperativo
desconocido y Spotify o YouTube. Conserva verbos delegados y excluye consultas
conocidas, preguntas, citas, negaciones, condicionales, terceros y frases más
largas. La decisión es pedir una acción completa, sin transformar la palabra
desconocida en un verbo autorizado. La salida del
reconocedor no se reescribe por parecido fonético, ni se consulta a Gemma para
elegir una acción que falte.
«Alice reproduce Spotify» conserva su parser normal; «Reclosa» y «Replosa» no
se convierten en operaciones musicales.

Esta aclaración no ejecuta controles musicales ni constituye un recibo.
Las peticiones válidas conservan el camino existente. Preguntas informativas,
citas, negaciones y menciones de terceros no se convierten en órdenes por
nombrar un servicio.

## Límites

El incremento inicial de feedback no cambia DSP, ganancia, endpoint, modelo
ASR, voz Fish, personalidad ni permisos; el ajuste posterior de ganancia se
describe en el anexo. El feedback explica una decisión del programa; no demuestra que el
propietario haya callado o que Whisper haya reconocido bien. La aclaración
tampoco acredita una mejora acústica ni detección general de toda frase
ambigua. La aceptación cotidiana de R9 sigue abierta.
La prioridad inmediata es estabilizar captura y transcripción y conservar este
diagnóstico compacto, sin incorporar más funciones a Conversación antes de su
aceptación.

La compilación del incremento de feedback conserva cinco assets: 7.688.642 bytes antes y 7.691.008 después,
una diferencia de 2.366 bytes, aproximadamente 0,031 %. Esa comparación mide
tamaño estático; no sustituye una medición de CPU, memoria o arranque nativo.

## Anexo — reducción posterior de ganancia de voz baja

Una toma manual posterior de 6,1 s, transcrita por Whisper small en 5,4 s,
mostró con ganancia 4× un pico de entrada de 1,71576 y 334 muestras recortadas
de 288.000 medidas (0,12 % redondeado). El pico de salida fue 1,07430.
La medición parcial cubrió 6,000 s; no equivale al archivo completo.

Se reduce sólo la ganancia del perfil Voz baja y pausada de 4× a 2×.
Normal, RNNoise, filtros anteriores, VAD, silencio de 2 s, dispositivo y
modelos se conservan. No se añaden controles, procesos, timers o dependencias.
Las referencias a 4× de los incrementos anteriores conservan su valor histórico.

El recorte observado justifica probar menos amplificación, pero no demuestra
la causa única del reconocimiento impreciso ni la claridad del audio.
El propietario confirmó que había dicho «parar y revisar audio», la etiqueta
del botón que debía pulsar con el ratón. Se aclara esa instrucción sin añadir
controles. No se equipara esta toma a «Alice reproduce Spotify» del caso anterior.
Pasaron 824 pruebas frontend y la compilación; la repetición acústica queda
pendiente. La aclaración de texto añade 27 bytes al build posterior, conservando
cinco assets.

[Procedimiento](../runbooks/03-conversacion-y-voz.md#tomas-no-atendidas-y-peticiones-ambiguas) ·
[Resultados y pendientes](../testing/VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md).
