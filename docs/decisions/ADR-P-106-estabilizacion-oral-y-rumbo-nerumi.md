# ADR-P-106 — Transcripción dedicada y estabilidad de la sesión oral

Fecha: 2026-11-04. Estado: implementada y comprobada con audio sintético español;
aceptación con la voz del propietario y música real pendiente.

## Contexto y alcance

Carlos prioriza conversar y ejecutar las acciones del PC ya delegadas, tomando
Atlas como referencia. Excluye domótica y deja el avatar al final. Nerumi sirve
como referencia posterior de compañía de escritorio; su publicidad no demuestra
que Alice posea sus funciones ni autoriza nuevas acciones.

Una prueba nativa con Gemma como transcriptor atendió dos frases, pero reconoció
mal «Detén la conversación, Alice». La parada depende primero de entender el
audio. No se amplía el detector de órdenes para aceptar texto incoherente.

## Decisión

- Mantener **Gemma 4 E2B** como modelo de diálogo y visión. Adoptar **Whisper base
  multilingüe** sólo para reconocimiento de voz en español, en CPU con cuatro
  hilos. No se carga otro LLM ni se ocupa la GPU de Gemma con ASR.
- Usar `whisper.cpp` **v1.9.2**, paquete oficial Windows CPU x64. La versión
  v1.9.5 consultada no ofrece ese binario. El instalador explícito fija URLs y
  hashes; Alice no descarga modelos al iniciar. Si falta la instalación completa,
  conserva la ruta Gemma previa; un fallo de Whisper instalado se muestra como
  error, sin cambiar de motor silenciosamente.
- Pasar WAV mono de 16 kHz por stdin y leer stdout, sin archivos de audio ni
  formatos de exportación. Cancelar y recoger el proceso al terminar la sesión;
  límite de 90 segundos. FFmpeg mantiene la conversión en RAM.
- Acortar el prompt oral conservando identidad, interlocutores y límites. Las
  citas y los pronombres ambiguos siguen requiriendo evaluación; no se declaran
  resueltos por añadir instrucciones.
- Ignorar callbacks duplicados y resultados de capturas antiguas. Volver a
  comprobar el identificador de sesión antes de aceptar transcripción o respuesta
  y antes de iniciar la persistencia de un intercambio. No se afirma una
  transacción atómica entre detener y escribir.
- Ante un fallo de Fish o reproducción, conservar el texto y volver a escuchar,
  con aviso y sin reintentos externos automáticos. Errores de ASR o diálogo
  detienen la sesión. Fish conserva `s2.1-pro-free` y el perfil existente.
- Mostrar **Último mensaje atendido** en un detalle cerrado por defecto: texto
  aceptado y tiempos de transcripción, respuesta y voz. Es efímero. Las frases
  ignoradas por el filtro de dirección no aparecen ahí.

Los tiempos comienzan al terminar la grabación: excluyen el habla del usuario y
la pausa de cierre. «Hasta iniciar la voz» termina al programar la reproducción,
después de decodificar el audio; no mide el retraso físico de los altavoces.

## Evidencia y límites

El mismo conjunto español atravesó RNNoise, Opus, ASR nativo, Gemma y Fish:
**tres transcripciones, dos respuestas reproducidas y parada directa sin tercer
mensaje**. Otra prueba canceló una respuesta pendiente y mantuvo sin cambios el
historial de prueba. Los datos canónicos no se usaron como fixtures.

Ver [informe completo](../testing/CONVERSATION_SESSION_REPORT_2026-11-04.md).
No hay escucha al arrancar, wake word dedicado, interrupción durante la voz,
identificación del hablante ni garantía de eliminar cantantes u otras personas.
R9 permanece en progreso. Primero se acepta la experiencia oral real; después
se estudian activación por nombre, interrupción con control de eco y latencia.
La presencia VRM queda para una etapa posterior.

## Fuentes y licencias

- [Atlas: vídeo de AlehandoroVR](https://www.youtube.com/watch?v=pAmOlBBai7I&t=748s):
  descripción y capítulos consultados; no se obtuvo una transcripción completa.
- [Nerumi oficial](https://nerumi.ch/): referencia de producto, sin instalarlo ni
  verificar sus promesas en este equipo.
- [whisper.cpp v1.9.2](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2),
  [modelo multilingüe](https://huggingface.co/ggerganov/whisper.cpp) y
  [OpenAI Whisper](https://github.com/openai/whisper). Licencias MIT conservadas en
  `public/licenses/`; binarios y pesos fuera de Git.
