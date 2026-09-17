# Gemma E2B: grabación humana en español

Fecha: 2026-09-05. Prueba local autorizada de una grabación aportada por el propietario. No es voz sintetizada ni captura en directo.

## Método

- Original M4A de aproximadamente 13,91 segundos, preservado en su ubicación. Se convirtió una copia con FFmpeg 8.1.1 ya instalado a WAV PCM de 16 bits, mono, 16 kHz.
- Gemma 4 E2B Q4_K_M con llama.cpp b10809, configuración del piloto anterior. Un solo modelo residente.
- Seis inferencias: audio humano, silencio digital de igual duración y ausencia de audio, primero con instrucción española y luego con la instrucción inglesa del ensayo anterior.
- La instrucción **no contenía la frase esperada**, recuerdos, prompt de personalidad ni historial. Se pidió transcribir, no responder al contenido del audio.
- Semilla 42, temperatura 0,2, salida máxima 240 tokens. Cada grupo arrancó su servidor y lo cerró al terminar.

## Resultados

| Caso | Instrucción española | Instrucción inglesa |
| --- | --- | --- |
| Audio humano español | Transcripción en español, 1,55 s | Transcripción en español, 1,50 s |
| Silencio | Cadena vacía: incumple `NO_SPEECH` | `NO_SPEECH`, 0,63 s |
| Sin audio adjunto | Inventó un saludo: fallo | `NO_SPEECH`, 0,34 s |

Ambas transcripciones coinciden en el contenido principal. El propietario confirmó después que la palabra final «Hagan» sí fue pronunciada por equivocación: no era una alucinación del transcriptor. No se calculó una tasa de error estandarizada; la validación es humana sobre esta muestra, no un benchmark de español.

El idioma de la instrucción afectó los controles en estas ejecuciones. Esto no demuestra que la instrucción inglesa elimine las alucinaciones en general. No habilitar escucha autónoma basándose en una sola grabación.

## Consecuencias para una futura integración

Rechazar entradas sin audio antes de invocar el modelo; tratar silencio/respuestas vacías como ausencia de entrada, no como información aprendida. Evaluar detección de voz, ruido y fragmentación sin añadir por defecto otro modelo de IA. Mantener la transcripción separada de instrucciones ejecutables y del conocimiento confirmado.

## Integridad y archivos

En ambos grupos, los **36 archivos canónicos conservaron sus SHA-256**. No se guardaron recuerdos ni se activó el micrófono. Los audios, respuestas y hashes de prueba permanecen bajo `artifacts/gemma-evaluation`, ignorado por Git. El M4A original no fue movido ni alterado.

Script: `scripts/testing/llama-memory-pilot.mjs gemma --audio <archivo.wav>`, con `--audio-prompt-en` para el segundo grupo. Los WAV de esta prueba son PCM s16le; no usar el generador de silencio del script con codificaciones diferentes.

Pendientes: más grabaciones con ruido, conversación hablada real, latencia con avatar y prueba de salida de voz independiente. Gemma aquí produce **texto**, no voz sintetizada.

## Seguimiento: pausa al pensar

El propietario explicó que hace pausas para pensar. No deben tratarse como un error del hablante.

Se examinó la misma grabación con `silencedetect` de FFmpeg (umbral -35 dB, duración mínima 0,4 s). Detectó un tramo de bajo nivel de unos 2,16 segundos cerca del final. Ese umbral mide amplitud: **no es un detector semántico de fin de turno ni una prueba de ausencia absoluta de voz**.

Se creó una copia de ensayo insertando tres segundos de silencio digital en el segundo 10, dentro de ese tramo. No se recortaron palabras, no se modificó el original y no se presentó esta transformación como otra grabación humana. Duración resultante: 16,91 segundos.

Con instrucción inglesa, Gemma conservó el texto principal y la palabra final después de la pausa: 1,28 s de inferencia sobre el archivo completo. Los controles de silencio y ausencia de audio respondieron `NO_SPEECH` (0,64 y 0,28 s). Los 36 archivos canónicos conservaron sus hashes.

Esto comprueba tolerancia a una pausa **en un archivo ya terminado**. No prueba que una escucha en directo vaya a esperar correctamente: eso depende de cómo la aplicación decida cerrar el turno. La captura de micrófono actual se describe en `SensoryLearningPanel.tsx` como muestras descartables sin transcripción; esta evaluación no la convirtió en chat por voz.

Para la primera integración se propone finalizar el turno con una acción explícita de «Terminé de hablar», pudiendo pausar sin enviar prematuramente. Un modo automático quedaría para después, con espera configurable y pruebas de pausas naturales, sin confiar únicamente en un umbral de volumen. Esta propuesta todavía no está implementada.

Resultado local ignorado por Git: `human-audio-pilot-gemma-prompt-en-pause3.json`. Reproducir con `--audio <copia.wav> --audio-prompt-en --label pause3`; la etiqueta evita sobrescribir los resultados iniciales.
