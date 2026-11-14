# Revisión de herramientas, persistencia y latencia

Fecha: 2026-11-13. Alcance: evaluar las sugerencias del documento local
`docs/herramientas-y-persistencia-alice.md` y Open Interpreter frente al código
actual y documentación oficial. El documento recibido se conserva sin editar.
Esta revisión no instala herramientas ni activa una migración o un motor nuevo.

## Evidencia de la demora

El propietario confirmó que Alice respondió en la repetición con micrófono,
aunque tardó. El último turno completo registrado en R3 presenta:

| Operación | Duración |
|---|---:|
| Transcripción | 6998 ms |
| Respuesta | 1721 ms |
| Síntesis de voz | 2361 ms |
| Suma de esas operaciones | 11080 ms |

La suma excluye captura, pausa de cierre, coordinación entre operaciones y
reproducción. No es una medición hasta el primer sonido ni una mediana de varias
tomas. Se consultaron sólo metadatos de auditoría, sin publicar conversaciones,
audio, hashes o IDs. En esta muestra ASR es la etapa más costosa.

El motor operativo usa Whisper small local en CPU con cuatro hilos. El equipo
dispone de GPU NVIDIA de 4 GiB compartida con el modelo de conversación; disponer
de NVIDIA no garantiza memoria libre para otro modelo simultáneo.

## Evaluación de las propuestas

| Herramienta | Evaluación para Alice | Próximo paso razonable |
|---|---|---|
| faster-whisper | Candidato prioritario para comparar ASR; no garantiza mayor precisión o menor tiempo que whisper.cpp. | Piloto aislado, primero small multilingüe e INT8 CPU, sin cambiar el motor activo. |
| openWakeWord | Puede evitar transcribir habla que no se dirige a Alice, pero requiere validar el nombre con pronunciación española. | Después de estabilizar ASR: modelo adecuado, pruebas de falsas activaciones y búfer previo acotado que preserve el verbo siguiente. |
| sentence-transformers y un índice vectorial | Útiles para evaluar recuperación semántica; no requieren migrar la fuente histórica. | Índice secundario reconstruible, con IDs, revisión, hash, procedencia y las exclusiones actuales. Elegir un backend por piloto. |
| spaCy | Anota el texto recibido. No recupera con certeza un verbo perdido por el reconocedor. | Evaluar sólo si un corpus de órdenes demuestra que las reglas actuales necesitan análisis adicional. |
| pywinauto | Ofrece UIAutomation/Win32 para habilidades concretas de Windows. | Adaptador de habilidad bajo demanda, con alcance y auditoría existentes; separar de ASR. |
| SQLite y sqlite-vec | Pueden servir a persistencia o índices, pero el esquema propuesto no conserva los contratos actuales. | Medir necesidad y corregir el diseño antes de una migración respaldada y reversible. |
| Open Interpreter | Puede ayudar a desarrollar código o ejecutar tareas complejas; es otra capa de ejecución. | Evaluarlo por separado o como adaptador futuro de habilidad. No priorizarlo para la demora de voz. |

### Precisiones sobre ASR y activación

El «hasta 4×» de faster-whisper se compara con `openai/whisper`, no promete ese
factor frente a la instalación de Alice. Su benchmark CPU usa small sobre un
audio de 13 minutos; no demuestra que medium iguale la latencia de small en
órdenes cortas de esta notebook. El ejemplo recibido carga el modelo en cada
proceso y puede descargarlo por nombre. El piloto debe separar carga e inferencia,
fijar rutas locales en D: y revisar dependencias; los pesos convertidos para
CTranslate2 no son un reemplazo directo del archivo GGML actual.
[Benchmark oficial](https://github.com/SYSTRAN/faster-whisper#benchmark) ·
[Contrato de carga](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py).

El contrato externo WAV/stdio propuesto necesita un adaptador real: argumentos,
cancelación, límites y errores saneados compatibles con Alice. Compartir stdin
y stdout no acredita esa compatibilidad.

openWakeWord documenta modelos incluidos en inglés y tramas de 80 ms. Un tiempo
de cómputo no equivale a detectar «Alice» en 10 ms de extremo a extremo. La
licencia del código y la de los modelos incluidos son distintas. Además, Alice
ya segmenta por actividad de voz: actualmente transcribe las tomas admitidas y
después busca la invocación; Whisper no procesa continuamente cada instante de
silencio. Hay que validar el ahorro real y evitar cortar «Alice pausa…» al
activar la grabación después del nombre.
[Repositorio oficial y modelos](https://github.com/dscripka/openWakeWord#pre-trained-models) ·
[Licencias](https://github.com/dscripka/openWakeWord#license).

spaCy recibe texto y produce anotaciones lingüísticas. Mi evaluación es que
usarlo para inventar una acción ausente empeoraría la aclaración conservadora
de Alice. [Funciones oficiales](https://spacy.io/usage/linguistic-features).
Los modelos de embeddings también necesitan evaluación por tarea, no una promesa
de recuperación correcta. [Sentence Transformers](https://www.sbert.net/docs/sentence_transformer/pretrained_models.html).
[pywinauto](https://github.com/pywinauto/pywinauto) aporta automatización de UI;
las autorizaciones y recibos de Alice seguirían siendo responsabilidad del adaptador.

## El SQL propuesto no acredita paridad 1:1

La revisión del código encontró incompatibilidades que deben resolverse antes
de usar ese DDL o esas consultas:

1. `importance` admite 0–100, mientras Alice valida 1–5. El DDL excluye el estado
   legado `memory_status='archived'`. `memory_version DEFAULT 1` tampoco refleja
   el contrato: una versión explícita empieza en 2 y exige metadatos coherentes
   de reconsolidación. Véanse [modelo](../../src-tauri/src/memory/model.rs) y
   [validación](../../src-tauri/src/memory/validation.rs).
2. La consulta híbrida no conserva las exclusiones de conflicto, archivo y
   eliminación programada. Exigir accesibilidad explícita también pierde
   registros heredados válidos. Indexar indiscriminadamente `summary` de
   conversaciones reutilizaría respuestas anteriores como evidencia. El
   [RAG actual](../../src/core/memory/memory-retrieval.ts) distingue esos campos;
   [Gemma reranquea](../../src-tauri/src/hybrid_retrieval.rs), sin verificar verdad.
3. El CTE del grafo admite revisiones históricas no retiradas aunque exista una
   retirada posterior, y no liga ambas evidencias a la misma revisión ni valida
   su vigencia/hash. El [grafo actual](../../src-tauri/src/knowledge_graph/associations.rs)
   selecciona la última revisión y valida las fuentes antes de admitir aristas.
4. FTS5 declara `record_id` como columna de contenido externo, pero la tabla
   fuente declara `id`. Una reproducción sintética en SQLite `:memory:` produjo
   `no such column: T.record_id`. También faltan el mecanismo de mantenimiento
   del índice y su comprobación de consistencia.
   [Requisitos oficiales de contenido externo](https://sqlite.org/fts5.html#external_content_tables).

No se ejecutó SQL sobre recuerdos reales. Un futuro exportador deberá conservar
campos, valores ausentes, revisiones y procedencia, además de las garantías de
respaldo, auditoría y reversión. Igualdad semántica y huella exacta de bytes son
criterios distintos: ordenar o serializar JSON de otra manera cambia su SHA-256.
Ninguna medición local respalda aún la cifra de búsqueda «<3 ms» del documento.

## Open Interpreter

La documentación oficial vigente presenta un agente de terminal que lee y
edita proyectos, ejecuta comandos y admite varios proveedores/modelos. Hay que
identificar edición y versión al evaluar ejemplos antiguos de la biblioteca
Python. Esta investigación no prueba compatibilidad de esa herramienta con
los contratos de memoria, permisos o auditoría de Alice.
[Producto y alcance](https://www.openinterpreter.com/docs/terminal).

Mi recomendación es mantenerlo como candidato para desarrollo o una habilidad
aislada. Integrarlo dentro de Alice exigiría que cada operación pase por R2/R3;
una confirmación propia de la herramienta no reemplaza esos contratos. Su
documentación distingue aislamiento de ejecución y política de aprobaciones.
[Sandbox y aprobaciones](https://www.openinterpreter.com/docs/terminal/sandbox).

## Orden de trabajo recomendado

1. Conservar el motor de voz operativo y medir varias tomas cortas: carga,
   transcripción, respuesta, síntesis y tiempo hasta empezar a oír.
2. Preparar una comparación ASR equivalente: mismo audio, idioma, tamaño y
   configuración de decodificación; carga fría/caliente separadas y memoria
   máxima. Comparar CPU INT8 y, si hay recursos suficientes, una variante GPU.
3. Promover un motor sólo si mejora tiempo y exactitud en las órdenes reales,
   conservando cancelación y descarte seguro. Confirmar después cinco turnos.
4. Retomar autoestudio/Obsidian. Evaluar activación acústica e índice semántico
   como incrementos separados; adoptar almacenamiento nuevo cuando exista
   necesidad medida. La propuesta de diseño visual conserva su alcance previo.

La revisión es documental y de contratos; no ejecuta un benchmark faster-whisper,
no entrena una wake word y no afirma resuelta la aceptación prolongada de R9.

## Pilotos factibles y alcance propuesto para Dioxus

Esta ampliación delimita qué probar primero y qué parte de la interfaz evaluar.
Los pilotos separados de `experiments/` (carpeta local privada) implementan la comparación
ASR y la vista Dioxus con sus propias dependencias; no sustituyen pantallas ni
cambian el arranque de Alice. Su incorporación al principal exige validación y
aceptación posterior.
[Evidencia y límites de la implementación](../testing/ISOLATED_PILOTS_REPORT_2026-11-13.md).

Por indicación del propietario, **«Persistencia y Grafos: Evolución futura de
R6 y R8» queda aplazada** hasta revisar en profundidad el proyecto, sus contratos
y los problemas del esquema señalados arriba. Esta evaluación no autoriza una
migración de datos, índice vectorial ni nueva base de memoria.

| Candidato | Factibilidad del piloto | Cómo decidir |
|---|---|---|
| faster-whisper | Alta para una comparación aislada: small multilingüe, INT8 CPU, cuatro hilos y configuración de decodificación equivalente. | Comparar tiempo de carga/inferencia, memoria y errores de las mismas tomas. Mantener el motor operativo hasta tener resultados. |
| Embeddings e índice secundario | Factible como segundo piloto sobre un corpus sintético o copia aislada. | Medir recuperación y exclusiones sin convertir el índice en fuente canónica. |
| openWakeWord | Condicionada al modelo y pronunciación de «Alice». | Evaluar falsos positivos/negativos y preservación del comienzo de la orden. |
| spaCy | Factible técnicamente, de prioridad baja para el problema actual. | Exigir una mejora en interpretación de texto; no usarlo para completar verbos ausentes. |
| pywinauto / Open Interpreter | Factibles en tareas de prueba delimitadas y separadas de la conversación. | Comprobar alcance, resultado y detención de cada tarea antes de diseñar un adaptador R4. |
| SQLite / sqlite-vec | Factibles como laboratorio de almacenamiento con datos sintéticos; el esquema recibido necesita correcciones. | Demostrar paridad, filtros, reversión y necesidad medida antes de migrar datos. |

### Primera pantalla: Estado y controles

En la revisión original, la candidata más acotada era la presentación de
[la antigua StateControlsPage](../testing/STATE_CONTROLS_DIOXUS_REPORT_2026-11-14.md) y
[InternalState](../../src/components/cognitive/InternalState.tsx). Entonces recibían
un snapshot y permitían seleccionar indicadores; los controles eran informativos.
El enlace anterior recoge los cambios posteriores y las funciones ahora activas.

La prueba debe conservar señales internas, memoria recuperada, controles,
etiquetas de implementación/bloqueo, valores, inspector y procedencia. Los
estados de carga, ausencia de actividad y error deben seguir diferenciados;
no deben presentarse datos sintéticos como actividad real de Alice.

Conversación, Memoria y Volumen no son las primeras candidatas: combinan captura,
transacciones o visualización canvas con más dependencias. Flujo incorpora
asociaciones editables; Capacidades incluye permisos y adaptadores de dispositivos.
Actividad mezcla vistas cognitivas con auditoría y diagnóstico. Esto aumenta el
alcance frente a una primera vista de indicadores.

### Arquitectura y comparación propuestas

1. Crear un proyecto Dioxus-Web separado, por ejemplo en
   `experiments/dioxus-state/`, con manifiesto, dependencias y salida propios.
   Usar fixtures sintéticos e identificarlos como demostración. No añadirlo al
   lanzador, build o navegación predeterminados de Alice.
2. Reproducir el contenido y la selección del inspector. Reutilizar estilos e
   iconos existentes y comparar ambas vistas con los mismos datos a varios anchos,
   incluido teclado, estados y legibilidad. Medir carga, respuesta y memoria;
   migrar a Rust no demuestra por sí solo una mejora de rendimiento o diseño.
3. Si el piloto resulta útil, evaluar Dioxus-Web dentro del contenedor Tauri
   existente, con un adaptador de sólo lectura y las mismas restricciones. La
   [lectura actual](../../src/pages/shared/nucleus-shared.tsx) usa
   `core_activity_snapshot` cada cinco segundos; conservar un solo responsable
   del polling y no duplicar solicitudes entre interfaces.

Dioxus-Web ejecuta la interfaz como WebAssembly en el WebView. La documentación
describe su uso con Tauri; esto permite estudiar el frontend conservando el
backend Rust, los comandos y el gobierno actuales. Dioxus Desktop tiene un modelo
de ejecución distinto y no es un reemplazo directo de un componente React.
[Dioxus-Web](https://dioxuslabs.com/learn/0.7/guides/platforms/web/) ·
[Dioxus con Tauri](https://dioxuslabs.com/learn/0.7/essentials/ui/escape/#using-dioxus-in-tauri) ·
[Modelo de escritorio](https://dioxuslabs.com/learn/0.7/guides/platforms/desktop/).

El piloto se descarta cerrando su vista y manteniendo la interfaz React operativa.
Una adopción posterior requerirá equivalencia de contenido/acciones y validación
nativa. La comparación ASR y la prueba de interfaz son experimentos independientes.
