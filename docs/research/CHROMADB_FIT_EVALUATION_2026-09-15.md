# Evaluación de ChromaDB para Alice

Fecha: 2026-09-15  
Decisión: no integrar en la memoria persistente actual. Carlos autorizó un modelo
secundario dedicado exclusivamente a recuperación y eligió
`intfloat/multilingual-e5-small` como primer candidato. Chroma permanece como
candidato para un índice derivado si ese modelo supera la prueba local.

## Qué sí aporta

Chroma almacena documentos, vectores y metadatos por identificador, y permite
búsqueda vectorial, texto completo, filtros, actualización y borrado. Su modo de
un solo nodo está pensado para cargas mucho mayores que la memoria actual de
Alice. Hay clientes oficiales Python, TypeScript y Rust.

Esto podría ser útil más adelante para recuperar fragmentos entre cientos o miles
de documentos académicos y técnicos. En ese caso sería un índice reconstruible:
los documentos autorizados y sus metadatos seguirían siendo la fuente canónica.

## Por qué no reemplaza la memoria de Alice

Chroma resuelve almacenamiento y similitud, no el ciclo cognitivo diseñado para
Alice. No representa por sí mismo:

- confirmación del propietario y evidencia literal;
- memoria episódica, semántica, procedimental y preferencias;
- importancia, impacto afectivo y accesibilidad;
- supresión, latencia de recuperación, debilitamiento y reconsolidación;
- revisiones inmutables de asociaciones y procedencia auditable.

El borrado de un registro de Chroma elimina sus vectores, documento y metadatos;
no ofrece el historial gobernado y reversible que mantiene el núcleo de Alice.
Por eso nunca debe ser la autoridad sobre qué recuerda u olvida el personaje.

## Separación respecto del modelo principal

La función de embedding predeterminada de Chroma usa `all-MiniLM-L6-v2` y puede
descargar ese modelo automáticamente. No se usará de forma implícita. El cliente
Rust espera que la aplicación entregue los embeddings y normalmente se conecta a
un servidor Chroma separado.

R8.3 ya evaluó embeddings derivados de Gemma y rechazó los modos causales probados
por calidad inferior a la recuperación léxica. Chroma no mejora un embedding
deficiente: sólo lo almacena e indexa. Por eso se admite un codificador secundario
especializado, pero no un segundo agente: `multilingual-e5-small` podrá buscar y
ordenar candidatos; Gemma seguirá siendo el único modelo que interpreta el
contexto, decide y redacta respuestas.

La elección de E5 no equivale a adopción. Primero deberá ejecutarse sin Chroma
sobre un corpus autorizado y compararse con la búsqueda léxica actual. No se
persistirán vectores durante esa prueba. BGE-M3 queda aplazado por su mayor consumo
y sólo se reconsiderará si E5 no alcanza la calidad necesaria.

## Condición para reevaluarlo

Chroma sólo se reconsiderará si se cumplen juntas estas condiciones:

1. el corpus documental autorizado supera claramente la búsqueda actual;
2. `multilingual-e5-small` supera una prueba contra consultas reales en español,
   incluyendo nombres, preferencias y conceptos relacionados sin palabras
   idénticas;
3. el índice es local, derivado, borrable y reconstruible;
4. recuerdos confirmados, asociaciones, estados afectivos y auditoría permanecen
   en el almacenamiento nativo de Alice;
5. su proceso se inicia y detiene explícitamente, sin nube ni escucha de red fuera
   de loopback.

## Fuentes primarias

- [Arquitectura y modos de despliegue de Chroma](https://docs.trychroma.com/reference/architecture/overview)
- [Modo cliente-servidor local](https://docs.trychroma.com/guides/deploy/client-server-mode)
- [Cliente Rust y embeddings proporcionados por la aplicación](https://docs.trychroma.com/docs/overview/getting-started)
- [Funciones de embedding y modelo predeterminado](https://docs.trychroma.com/docs/embeddings/embedding-functions)
- [Modelo seleccionado: multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)
- [Filtros por metadatos y contenido](https://docs.trychroma.com/reference/where-filter)
- [Actualización y upsert](https://docs.trychroma.com/docs/collections/update-data)
- [Semántica destructiva del borrado](https://docs.trychroma.com/docs/collections/delete-data?lang=typescript)

No se instaló, descargó ni ejecutó ChromaDB o E5 durante esta evaluación.
