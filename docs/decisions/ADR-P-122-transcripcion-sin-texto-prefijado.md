# ADR-P-122 — Transcripción sin texto prefijado

Fecha: 2026-11-12. Estado: implementado; aceptación acústica en curso.

El propietario intentó decir «Alice pausa Spotify». En las tomas observadas,
incluida una con Spotify en pausa, llegó «Alice, Spotify.» y Gemma preguntó si
quería reproducir música. La pérdida de la acción ocurrió antes del parser.

Whisper recibía `--prompt` con una lista fija de nombres. Se retira ese texto
inicial y se conserva el modelo, idioma español, CPU, canales por stdin/stdout,
plazos, cancelación y ausencia de archivos de audio/transcripción. No se añade
una gramática que fuerce comandos. Es una línea base sin ese condicionamiento;
el cambio por sí solo no demuestra que el prompt causara la pérdida observada.

La CLI documenta `--prompt` como texto inicial del decodificador, con valor
predeterminado vacío. [Referencia oficial de whisper.cpp v1.9.2](https://github.com/ggml-org/whisper.cpp/blob/v1.9.2/examples/cli/README.md).

La mención acotada «Alice» más «Spotify» o «YouTube», sin acción, recibe ahora
una aclaración determinista y equilibrada: pausar, reanudar o reproducir. No
pasa a Gemma ni ejecuta herramientas. El mensaje evita presentar esa aclaración
como un intento fallido de reproducción. Consultas informativas, terceros,
citas y negaciones conservan el recorrido conversacional anterior.

No se reconstruye «pausa» a partir del nombre del servicio ni se amplían aliases,
verbos o permisos. Una frase ambigua continúa requiriendo que el propietario
repita la acción completa. La aceptación de órdenes cortas y de escucha con
música sigue pendiente de la prueba con la versión nueva.

[Validación y alcance acústico](../testing/VOICE_ASR_REVIEW_2026-11-12.md).
