# Feedback de tomas no atendidas y aclaración de medios

Fecha: 2026-11-12. Entorno: Alice Tauri en Windows.

## Fallo observado antes del incremento

En la prueba posterior a `ef51739`, la interfaz mostró la transcripción
«Alice. Reclosa Spotify.» y una respuesta de Gemma «Recloso Spotify.». La
respuesta no fue un recibo de ejecución ni demuestra un control del reproductor.
El propietario confirmó la frase original: «Alice reproduce Spotify». El ASR
cambió el verbo; no se interpreta esa petición como una orden de pausa.

El detalle visible indicó 7,5 s de toma, Whisper small con 6,0 s de
transcripción, 1,6 s de respuesta, 1,5 s de preparación de voz y 9,1 s hasta
iniciar la reproducción desde el fin de la grabación. Son valores redondeados
de interfaz. La duración de captura y la pausa de cierre no están incluidas
en esos 9,1 s. No se dispone aquí de un audio evaluado que explique la
sustitución de palabras.

La queja de espera sin respuesta también requiere distinguir una toma ignorada
de la transcripción o generación en curso. El incremento registra motivos de
descarte de la aplicación; no diagnostica por sí solo el origen acústico.

## Cambios implementados

- Estado de captura **Escuchando · di Alice y tu frase**.
- Detalle **Resultado de entrada no atendido** dentro del único desplegable
  existente **Audio de entrada · reducción de ruido local**, cerrado de inicio.
  La escucha muestra sólo una línea contextual breve cuando hay un descarte.
  No se abre otro panel ni se repiten avisos de lectura en vivo.
- Motivos distintos para captura sin voz suficiente, ASR sin palabras y texto
  no aceptado como dirigido a Alice, separados del último mensaje atendido.
- Metadatos sólo cuando existen, sin transcribir una toma descartada antes del
  ASR ni inventar un texto que no devolvió el reconocedor.
- Un único resultado efímero, sin chat, ejecución, voz Fish ni persistencia.
  Limpieza al apagar, fallar, iniciar sesión o atender un turno. Un quiet
  posterior no sustituye el descarte ASR que se inspecciona; otro ASR puede
  actualizarlo. Los callbacks revocados no publican resultados.
- Aclaración determinista del fragmento musical ambiguo cubierto por la regla,
  sin corregir fonéticamente el texto, inferir un verbo con Gemma ni ejecutar.
  La regla nueva exige tres palabras: Alice, candidato imperativo desconocido
  y Spotify o YouTube. Excluye verbos delegados, consultas conocidas, preguntas,
  citas, negaciones, condicionales, terceros y frases largas. La petición
  correcta «Alice reproduce Spotify» conserva su ruta habitual.

La selección privada de voz y la personalidad del
[incremento anterior](ALICE_VOICE_PERSONALITY_REPORT_2026-11-12.md) siguen
vigentes. No se cambian cadena de audio, ganancia, silencios ni modelos.

## Resultados del incremento

La validación central informó los resultados siguientes. La aceptación acústica
conserva sus pendientes. Los resultados acústicos del incremento anterior no
se atribuyen a éste.

| Comprobación | Estado actual | Resultado y alcance |
|---|---|---|
| Tests Rust | Aprobado | 393 aprobados y 30 sondas opcionales omitidas; incluye aclaración acotada y exclusiones. |
| Tests frontend | Aprobado | 824 aprobados y 2 sondas opcionales omitidas; incluye motivos, quiet sin ASR, ausencia de efectos y cancelación. |
| Sincronización Obsidian | Aprobado | 15 pruebas aprobadas. |
| Respaldo y restauración | Aprobado | 20 pruebas aprobadas. |
| Compilación TypeScript/Vite | Aprobado | Build completado; comparación de assets indicada debajo. |
| Clippy y comprobación final de formato | Aprobado | Clippy con `-D warnings` y comprobación de formato completados sin errores. |
| Revisión nativa de estados y paneles | Comprobada en el recorrido observado | Estado Escuchando, detalle dentro de Audio de entrada y eliminación del descarte al apagar el micrófono. Durante ASR la interfaz informa micrófono apagado. |
| Aclaración nativa por texto | Aprobada | «Alice. Reclosa Spotify.» recibió «No entendí si quieres abrir, pausar, reanudar o reproducir música. No envié ninguna orden al reproductor…», con proveedor Control multimedia local. No se reprodujo música ni se solicitó voz para esta comprobación. |
| Repetición real de la petición | Pendiente | Original confirmada como «Alice reproduce Spotify»; falta repetir y contrastar transcripción y aclaración o recibo real. |

## Alcance de interfaz y tamaño estático

Para respetar la petición de no recargar Conversación, se reutiliza el
desplegable de audio existente y se mantiene cerrado inicialmente. La escucha
añade sólo una línea breve no viva y conserva un único resultado en RAM, sin
procesos, timers o dependencias nuevos.

La comparación del build mantuvo cinco assets: **7.688.642 bytes antes** y
**7.691.008 bytes después**, una diferencia de **2.366 bytes (0,031 %)**.
Esto mide tamaño estático. No demuestra que el arranque nativo, consumo de CPU
o memoria permanezcan iguales ni sustituye la revisión de funcionamiento real.

Los tests de descarte pueden usar fixtures conocidos para comprobar el flujo;
eso no constituye una prueba de reconocimiento con la voz del propietario.
Una toma sin evidencia suficiente y una medición ausente no equivalen a un
micrófono correcto, silencio físico comprobado o una voz inteligible.

## Pendientes acústicos y preservación

Retomar la comparación de la frase confirmada, sonido filtrado, medición parcial
y texto reconocido según el
[diagnóstico de entrada](VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).
La interfaz nueva mostró un descarte con transcripción «[MÚSICA]» mediante
Whisper small, con 6,0 s de toma y 9,6 s de transcripción. El propietario
confirmó que no había audio sonando. La etiqueta no demuestra música real ni
identifica todavía si el origen está en captura, filtrado o reconocimiento.
Se preparó el dictado manual existente para revisar una toma antes de ASR.
La precisión ASR, continuidad de varios turnos y aceptación cotidiana de R9
siguen abiertas. Este cambio no se presenta como una corrección del micrófono.
La prioridad es estabilizar captura y transcripción sin añadir más funciones
a Conversación antes de la aceptación de R9.

No se incluyen conversaciones personales, grabaciones, claves ni el
identificador real de la voz en este reporte. Se verificó el respaldo de cierre
anterior al incremento. Antes de reabrir Alice, los 136 archivos de datos
comparados conservaron sus hashes y ninguno estaba ausente. El uso posterior
del programa actualiza sus almacenes habituales; no se considera inmutable.

[ADR-P-128](../decisions/ADR-P-128-feedback-de-escucha-y-aclaracion-local.md) ·
[Guía operativa](../runbooks/03-conversacion-y-voz.md#tomas-no-atendidas-y-peticiones-ambiguas).
