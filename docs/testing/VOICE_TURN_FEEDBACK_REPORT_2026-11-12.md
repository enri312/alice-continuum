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
vigentes. El incremento inicial de feedback no cambia cadena de audio,
ganancia, silencios ni modelos; la modificación posterior de ganancia queda
separada en su subsección.

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

## Ajuste posterior: ganancia de voz baja 4 a 2

### Caso manual medido

La toma manual posterior mostró 6,1 s de captura y 5,4 s de transcripción
mediante Whisper small. Con el perfil de ganancia 4×, el diagnóstico visible
registró:

| Indicador | Valor observado |
|---|---|
| Entrada: RMS | 0,10959 |
| Entrada: pico antes de recorte | 1,71576 |
| Muestras de entrada recortadas | 334 de 288.000; 0,12 % redondeado |
| Salida filtrada: RMS | 0,08753 |
| Salida filtrada: pico | 1,07430 |
| Cobertura de entrada medida | 288.000 muestras a 48 kHz: 6,000 s |

La cobertura es parcial y llega hasta el último lote recibido; no acredita
los 6,1 s completos del WebM. La revisión del flujo no detectó arrastre entre
tomas. Esto no identifica todavía la causa de las palabras incorrectas.
El propietario aclaró que en esta prueba dijo «parar y revisar audio»: había
pronunciado la etiqueta del botón de la interfaz. La indicación se aclara para
que haga clic en ese botón. La claridad acústica de la toma aún no se ha
confirmado; no se presenta como otra captura de «Alice reproduce Spotify».

### Cambio acotado y comprobación pendiente

Se reduce sólo la constante de ganancia de **Voz baja y pausada de 4× a 2×**.
Se conservan Normal, filtros, RNNoise, VAD, cierre automático de 2 s,
dispositivo, Whisper small y selección de modelos. No se añaden controles,
dependencias, procesos o timers.

Hay evidencia de recorte de entrada, pero no de que sea la causa única del
error ASR. El pico de salida es una medición, no una evaluación de
inteligibilidad. La reducción busca probar menos amplificación sin introducir
otro cambio simultáneo; no se anuncia una mejora reconocida ni una corrección
del micrófono.

Los resultados del incremento de feedback que figuran arriba son anteriores a
esta modificación y no cierran sus comprobaciones:

| Comprobación del ajuste de ganancia | Estado | Resultado por completar |
|---|---|---|
| Pruebas del perfil y regresión aplicable | Aprobado | 66 pruebas específicas y suite Vitest completa: 824 aprobadas, 2 sondas opcionales omitidas. No se repitieron Rust ni respaldos sintéticos porque esas rutas no cambian. |
| Compilación | Aprobado | `npm run build` pasó. Cinco assets, 7.691.008 bytes antes y 7.691.035 después; la aclaración del texto añade 27 bytes. La reducción de ganancia por sí sola no cambió el tamaño. Permanece el aviso de chunks grandes. |
| Revisión nativa | Parcial | Se preservó el borrador visible tras la actualización; micrófono apagado. La siguiente toma debe confirmar ganancia 2× mediante sus mediciones. |
| Repetición acústica con frase exacta | Pendiente | La frase anterior era la etiqueta del botón. Hace falta escuchar una misma toma antes de transcribirla y contrastar señal y ASR. |
| Nuevo respaldo integral estable | Aprobado | Se repitió con las fuentes congeladas y el CLI confirmó creación y verificación. |

El primer intento manual de copia de este ajuste se rechazó porque las fuentes
cambiaron durante la copia («copia no coincide»); no se presenta como un
respaldo verificado. Se conservaron el archivo de código de HEAD y el respaldo
de arranque de las 22:03. El segundo intento estable se creó y verificó
correctamente antes de la aclaración final del texto de interfaz.

## Confirmación puntual y simplificación visual posterior

El propietario comunicó «Ahora sí entendió». Se registra como confirmación de
un acierto puntual; no demuestra estabilidad entre turnos ni cierra R9. Su
apreciación sobre el ritmo de habla no es una comparación controlada y no se
establece la causa del resultado.

Para mantener Conversación con sólo lo indispensable, se acorta la explicación
de reposo, se muestra la ayuda manual sólo al abrir el dictado y se llevan los
ejemplos de acciones al apartado existente Contexto y permisos. Se conservan la
explicación de transcripción local/Gemma y envío de texto de respuesta a Fish,
los controles para detener y los límites de duración. El diagnóstico sigue
plegado en Audio de entrada. No se añade una función, hook, proceso o cambio
de audio en esta limpieza visual.

La edición parte de un respaldo integral completo y verificado, con el código
anterior preservado. Sus resultados de comprobación quedan separados del
acierto comunicado y de los tests del ajuste de ganancia anterior:

| Comprobación de la limpieza visual | Estado |
|---|---|
| Tests aplicables y compilación | Aprobado: 20 pruebas existentes específicas; suite Vitest completa con 824 aprobadas y 2 sondas opcionales omitidas; `npm run build` completado. |
| Revisión nativa de texto y controles | Comprobada en Tauri: ejemplos accesibles dentro de Contexto y permisos, ayuda manual visible al abrir el dictado, y ambos apartados plegados al terminar. Borrador conservado y micrófono apagado. |

El build conserva cinco assets: 7.691.035 bytes antes y 7.690.837 después,
una reducción de 198 bytes. Es una comparación de tamaño, no una medición
de CPU, memoria o arranque. No hay dependencias ni temporizadores nuevos.

### Próxima comprobación con el propietario

Realizar cinco turnos breves, sin incorporar funciones nuevas a Conversación:

| Turno | Criterio observable | Resultado |
|---|---|---|
| Reproducir Spotify | ASR conserva acción y servicio; el resultado real y el recibo coinciden. | Pendiente |
| Pausar Spotify | ASR conserva la pausa; el reproductor queda pausado. | Pendiente |
| Reanudar Spotify | ASR conserva la reanudación; vuelve la reproducción esperada. | Pendiente |
| Turno libre dirigido a Alice | Respuesta pertinente, sin ejecutar una acción que no se pidió. | Pendiente |
| Apagar el micrófono | La sesión termina y no admite respuestas o eventos tardíos. | Pendiente |

Durante los cuatro primeros turnos, comprobar que Alice vuelve a escuchar
después de procesar y reproducir su respuesta. Si falla alguno, usar la toma
filtrada, el ASR y el diagnóstico existentes para describir ese fallo; no
corregir el texto para contarlo como un acierto del reconocedor.

Después de esa comprobación, retomar el trabajo ya autorizado del núcleo:
continuidad del autoestudio, recuperación de una lección aprobada con su fuente
y actualización de Obsidian. No se amplían las materias autorizadas. El avatar
permanece al final y las aceptaciones prolongadas de R9 conservan sus pendientes.

No se incluyen conversaciones personales, grabaciones, claves ni el
identificador real de la voz en este reporte. Se verificó el respaldo de cierre
anterior al incremento. Antes de reabrir Alice, los 136 archivos de datos
comparados conservaron sus hashes y ninguno estaba ausente. El uso posterior
del programa actualiza sus almacenes habituales; no se considera inmutable.

[ADR-P-128](../decisions/ADR-P-128-feedback-de-escucha-y-aclaracion-local.md) ·
[Guía operativa](../runbooks/03-conversacion-y-voz.md#tomas-no-atendidas-y-peticiones-ambiguas).
