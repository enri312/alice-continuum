# ADR-P-129 — Fallos tipados y diagnóstico seguro del proceso Whisper

Fecha: 2026-11-13. Estado: implementado; tests, comprobaciones Rust, compilación
y apertura nativa aprobados. Causa original y aceptación acústica pendientes.

Tras un acierto puntual comunicado por el propietario, se observaron nuevos
fallos de Whisper de corta duración. Una ejecución CLI con audio sintético
funcionó por separado. Estas observaciones no identifican la causa original
ni prueban que la captura o el reconocimiento con voz real estén corregidos.

## Frontera del proceso

La gestión del proceso se separa en `src-tauri/src/whisper_input/process.rs`.
`FailureKind` clasifica el fallo y `WhisperFailure` lo transporta, para que un fallo técnico no se reduzca a
una transcripción vacía o se interprete como ausencia de habla.

stdout conserva hasta 24 KiB y stderr hasta 16 KiB en RAM. Los lectores siguen
drenando los canales hasta EOF después de alcanzar esos límites; un buffer
lleno no deja al child bloqueado esperando al padre. Las salidas técnicas no
se escriben como archivos ni se incorporan a mensajes de auditoría.

Una salida no exitosa o un error fatal detectado en stderr produce un fallo,
incluso si el código de salida es cero. Preparación y decodificación fallidas
no devuelven `noSpeech`. Este estado se conserva para PCM silencioso detectado
localmente antes de lanzar el CLI y para un reconocimiento exitoso sin palabras.

Cancelación, límite de 90 segundos y errores de preparación deben liberar los
canales, terminar y esperar al child CLI directo cuando corresponda y unir los lectores y
el escritor creados. Se añade un lector efímero de stderr por ejecución; no se
afirma que el incremento carezca de hilos nuevos. No se crean procesos o
servicios persistentes. Este alcance no administra árboles de descendientes
arbitrarios ni termina procesos ajenos.

## Diagnóstico y privacidad

`WhisperFailure` produce códigos R3 con prefijos y clases fijos y, cuando existe,
el sufijo `_EXIT_{8HEX}` normalizado, incluido el caso Windows. El formato es
`VOICE_WHISPER_<CLASE>_EXIT_<8HEX>` y respeta el límite de 64 caracteres.
La clase y el código de salida no se presentan como
una explicación confirmada de la causa original.

No se incluyen stderr sin procesar, rutas locales, texto reconocido ni datos
del modelo en esos códigos. El error comprensible se muestra en el aviso ya
existente, sin otro panel o controles. La transcripción válida conserva su
flujo habitual; estos buffers no crean un almacén de audio o conversación.

## Alcance conservado

La interfaz, captura, DSP, ganancia, dispositivo y selección de modelos siguen
igual. No se reintenta automáticamente ni se recurre a otro reconocedor ante
el fallo de Whisper instalado. La opinión sobre diseño solicitada por el
propietario permanece separada, sin implementación de un rediseño.

Las pruebas de proceso y una CLI sintética no sustituyen los cinco turnos
reales pendientes ni cierran R9. Después de esa comprobación se retoma el
núcleo ya autorizado, sin ampliar materias y con el avatar al final.

La suite Rust aprobó 408 pruebas y omitió 32 por defecto. Las dos sondas de
runtime instalado se seleccionaron y aprobaron aparte; quedan 30 sondas
opcionales sin ejecutar. También aprobaron la sonda positiva con Alice/Gemma
activos y las comprobaciones de compilación. La apertura nativa normal se
observó con micrófono apagado; no se forzó el aviso de error de la interfaz
ni se realizó otra prueba con voz real.

[Reporte, resultados y límites](../testing/WHISPER_PROCESS_FAILURE_REPORT_2026-11-13.md).
