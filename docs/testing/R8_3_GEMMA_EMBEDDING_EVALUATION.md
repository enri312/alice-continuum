# R8.3 — Evaluación de recuperación híbrida con un solo modelo

Estado: arnés preparado; ejecución real pendiente de apagar el modo chat de Gemma.

## Decisión bajo prueba

Carlos Nuñez estableció que Alice no mantendrá más de un modelo funcionando. La
primera opción de R8.3 es, por tanto, evaluar el mismo GGUF de Gemma ya adoptado,
en un modo separado y secuencial de embeddings. No se descargó otro modelo.

La sonda al servidor de chat real respondió HTTP 501 e indicó que embeddings está
desactivado. La documentación oficial de llama.cpp aclara que `--embeddings`
restringe el servidor al caso de embeddings y recomienda modelos dedicados. Por
eso no se agregará esa bandera al runtime normal ni se prometerá convivencia con
chat. El arnés inicia temporalmente el mismo modelo en modo embeddings solamente
cuando el runtime conversacional esté apagado y Ollama no tenga modelos residentes.

## Evaluación preparada

`scripts/testing/r8-gemma-embedding-eval.test.ts`:

- relee `data/memory/records.json` y aplica exclusiones R6;
- no usa respuestas históricas de modelos como texto documental de conversaciones;
- usa las intenciones reales elegibles como consultas de control;
- usa los títulos y resúmenes de los registros confirmados del perfil como una
  prueba cruzada real, sin imprimir su contenido;
- compara recuperación léxica y vectorial en Top-1 y Top-3;
- verifica dimensión, finitud, repetibilidad y latencia;
- comprueba SHA-256 antes/después;
- no persiste vectores, consultas ni texto privado en el informe.

La autorrecuperación demuestra funcionamiento y coste, no superioridad semántica:
la consulta de control coincide con su propia fuente. La prueba cruzada del perfil
sí compara cada intención confirmada contra los resúmenes confirmados y espera que
recupere su propio registro. Cualquier evaluación posterior de paráfrasis todavía
necesitará preguntas reales del propietario con relevancia esperada, sin fabricar
recuerdos ni declarar verdad por similitud.

## Ejecución

Con Alice abierta pero Gemma apagada desde Configuración y Ollama vacío:

```powershell
$env:ALICE_R8_REAL_EMBEDDING_EVAL='1'
npx vitest run scripts/testing/r8-gemma-embedding-eval.test.ts
Remove-Item Env:ALICE_R8_REAL_EMBEDDING_EVAL
```

El resultado decidirá si Gemma sirve siquiera como candidato técnico. Un resultado
positivo no bastará para adoptarlo: llama.cpp recomienda un modelo dedicado y R8.3
debe comparar calidad real antes de crear un índice regenerable.

## Resultado inicial: `mean`

La ejecución real con 9 recuerdos elegibles y 9 registros confirmados del perfil
produjo vectores L2 de 1536 dimensiones. La autorrecuperación obtuvo 100% Top-1 y
Top-3 y repetibilidad coseno 1. El lote de recuerdos tardó 1240 ms y la prueba
cruzada del perfil 1889 ms.

En la comparación significativa intención → resumen del perfil, la búsqueda léxica
obtuvo 66.7% Top-1 y 88.9% Top-3; Gemma con `mean` obtuvo sólo 22.2% y 55.6%.
Ambas fuentes conservaron sus SHA-256 y no se persistió un índice. `mean` queda
rechazado para R8.3 por calidad inferior. Se evaluará `last` antes de cerrar el
diagnóstico del mismo modelo causal.

`last` tampoco superó la línea base: produjo 22.2% Top-1 y 44.4% Top-3, con
1499 ms para recuerdos y 2210 ms para el perfil. Los dos modos de embeddings del
modelo causal quedan rechazados y no se crea índice vectorial.

## Siguiente alternativa con un solo modelo

Antes de concluir R8.3 se evaluará la misma Gemma en su modo normal como reranqueador
semántico. La prueba compara intención → resumen sobre los nueve registros reales
confirmados del perfil, rota candidatos para reducir sesgo de posición y exige tres
IDs mediante JSON Schema. Es inferencia secuencial: no convive con otro modelo ni
escribe historial, auditoría conversacional, recuerdos o índices.

La primera variante con UUID completos falló porque Gemma repitió o produjo
identificadores ajenos. Restringir el JSON Schema a los UUID no corrigió la copia.
La evaluación final usó etiquetas efímeras `R01…R09`, resueltas localmente a los
IDs canónicos después de inferir; así el formato no oculta la calidad semántica.

Con el orden de candidatos rotado por consulta, la línea léxica obtuvo 44.4% Top-1
y 55.6% Top-3. Gemma obtuvo 22.2% Top-1 y **100% Top-3**. Los nueve reranqueos
tardaron 15097 ms, 1677 ms de media. El perfil conservó su SHA-256 y no se escribió
ningún índice.

Gemma no es apta para elegir automáticamente un único recuerdo. Sí es candidata a
ampliar tres resultados revisables cuando el propietario solicita una previsualización.
La integración no debe ejecutarse mientras se escribe, ni promover sus resultados
a verdad, asociación R8.2 o recuerdo.

## Resultado del reranqueo

Los UUID completos resultaron frágiles: Gemma produjo identificadores repetidos o
ajenos incluso con un esquema limitado. El arnés sustituyó los UUID dentro del prompt
por etiquetas efímeras `R01…R09` y las resolvió localmente después. Esto separa la
capacidad de copiar identificadores de la capacidad de ordenar significado.

Con candidatos rotados en cada consulta, para reducir el sesgo por orden, la línea
léxica obtuvo 44.4% Top-1 y 55.6% Top-3. Gemma obtuvo 22.2% Top-1 y **100% Top-3**.
El reranqueo completo tardó 15097 ms: 1677 ms de media por consulta. La fuente
conservó su SHA-256 y no se persistió índice ni respuesta del modelo.

Conclusión: Gemma no debe escoger automáticamente un único recuerdo, pero puede
ampliar la cobertura de tres candidatos en el corpus pequeño actual. La integración
debe ser una previsualización explícita, cancelable y visible antes de adjuntar
recuerdos a una conversación. La salida del reranqueador sólo indica similitud; no
confirma la verdad del recuerdo ni crea asociaciones R8.2.

## Integración controlada en Conversación

La interfaz incorpora `Ampliar con Gemma` como acción manual, sólo para el motor
local llama.cpp. Escribir un mensaje conserva la recuperación léxica inmediata y
no inicia inferencia. Al pulsar el botón, el backend acepta entre 3 y 24 recuerdos
accesibles, usa etiquetas efímeras, exige exactamente tres identificadores únicos y
devuelve una vista revisable. Conversaciones previas aportan únicamente el mensaje
real del propietario; una respuesta anterior de Alice no se trata como evidencia.

El contrato declara `persisted=false`, `truthVerified=false` y
`requiresOwnerReview=true`. La interfaz vuelve a validar estas tres condiciones y
los identificadores antes de mostrar el resultado. La operación registra auditoría
mediante huellas y estados, no copia el texto privado al evento visible y no escribe
memoria, historial, asociaciones ni índice. Pasaron 441 pruebas TypeScript, 276
pruebas Rust, `cargo clippy --lib -- -D warnings` y la compilación de producción.
La comprobación manual integrada se completó el 6 de septiembre de 2026 después de
reiniciar Alice e iniciar Gemma expresamente. Un mensaje real produjo tres resultados
revisables a partir de 18 candidatos accesibles y cambió el control a `Revisar otra
vez con Gemma`. No se documentaron el mensaje ni los títulos privados. La fuente de
memoria conservó su fecha de modificación anterior a la prueba, no apareció ningún
archivo de embeddings, vectores o recuperación híbrida y la auditoría registró una
solicitud y un resultado. R8.3 queda validada sin índice vectorial persistente.
