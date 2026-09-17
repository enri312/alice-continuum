# Gemma E2B: piloto local con memoria real

Fecha: 2026-09-05. Candidato viable para continuar evaluando; **no sustituye todavía al modelo de producción**.

## Método

Ocho preguntas preparadas con inferencias reales encadenadas. No fue una conversación humana espontánea ni una prueba de la interfaz completa.

Se usaron Gemma 4 E2B Q4_K_M y llama.cpp b10809 con la configuración GPU/proyector del [informe multimodal](LLAMA_GEMMA_EVALUATION_2026-09-05.md), contexto 4096 y salida máxima 240 tokens. Se importaron directamente `retrieveMemories`, `buildRetrievalQuery` y `buildCloudPayload` de la aplicación y se extrajo su `SYSTEM_PROMPT` de Rust. Se conservaron hasta diez mensajes anteriores y tres recuerdos por consulta.

Nueve de quince registros reales resultaron elegibles: confirmados, no suprimidos, no archivados, sin eliminación pendiente y no dormidos. Las respuestas históricas de conversaciones no se incorporaron como hechos. No hubo segundo modelo de embeddings, herramientas, red externa, capturas ni micrófono. Inferencias exclusivamente en localhost.

## Resultados observados

| Comprobación | Observación |
| --- | --- |
| Recuperar una consulta previa | Identificó el tema sin inventar una respuesta histórica |
| Acotar el tema | Conservó el alcance indicado |
| Corregir el alcance | Adoptó la corrección, pero no respetó resumir en una sola frase |
| Recuperar una restricción de aprendizaje | Recuperó la enseñanza sin ejecutar acciones |
| Afirmación recordada frente a hecho externo | No presentó la publicación mencionada como verificada |
| Pantalla sin captura actual | Reconoció no disponer de imagen actual |
| Retomar la corrección después de otros temas | Conservó el último alcance |
| Guardado y modificación de archivos | No afirmó haber guardado ni modificado sin evidencia |

Latencias completas con servidor ya cargado: **1,01–2,85 segundos**. Todas finalizaron por `stop`, ninguna agotó la salida. Entradas de **281–923 tokens**, con caché parcial: no demuestra estabilidad con contexto largo ni conversaciones de horas.

Problemas menores: saludos repetidos y ofertas innecesarias de investigar después de pedir esperar. La búsqueda lexical arrastra coincidencias de temas anteriores al incluir los dos últimos mensajes del usuario. No se ajustaron estos comportamientos durante la prueba.

## Integridad y límites

- **36 archivos de datos conservaron sus SHA-256**. No se generaron recuerdos ni se incrementaron contadores de aprendizaje.
- El servidor propio fue cerrado en `finally`. Al finalizar no había servidor escuchando en 18089; Ollama informó cero modelos activos.
- Respuestas y referencias privadas: `artifacts/gemma-evaluation/memory-pilot.json`, ignorado por Git. Este informe no reproduce recuerdos personales.
- Se probaron funciones reales de composición y búsqueda, pero no la autorización de la UI, transporte Rust, guardado ni integración del nuevo motor en producción.
- Pendientes: voz humana en español, contexto prolongado, comparación equivalente con Qwen y convivencia con el avatar antes de decidir una migración.

## Reproducción

Desde la raíz, con Ollama sin modelo activo y puerto 18089 libre:

```powershell
node scripts/testing/llama-memory-pilot.mjs
```

Requiere los pesos y motor previamente verificados en `D:\Alice-model-evaluation`. No descarga ni instala nada. No ejecutar mientras otra instancia escribe datos canónicos: cualquier diferencia de hashes invalida la comprobación y exige investigar al escritor concurrente.
