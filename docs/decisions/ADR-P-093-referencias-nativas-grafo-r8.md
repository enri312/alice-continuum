# ADR-P-093 — Referencias nativas para R8

Fecha: 2026-09-04 · Estado: aceptada para R8.1.

El propietario autoriza comenzar R8, conservando experiencias reales y una memoria
que pueda corregirse. Se adopta una primera proyección nativa y de sólo lectura de
`records.json`, respaldada por los validadores y decisiones R6.

Cada nodo identifica un registro y su versión. No se generan aristas por similitud,
por cercanía visual ni por una respuesta histórica de modelo. R8.1 no mantiene un
segundo almacén. Los siguientes incrementos definirán evidencia para asociaciones,
índices regenerables y su representación en el volumen existente.

LightRAG queda como alternativa evaluable para indexar documentos y recuperar
contexto. El contrato de memoria de Alice permanece independiente de esa elección.
El script local no implementa invalidación R6 y acepta host y directorio arbitrarios;
conectarlo ahora introduciría una fuente de datos derivada sin sincronización fiable.

Contrato: [KNOWLEDGE_GRAPH_R8.md](../architecture/KNOWLEDGE_GRAPH_R8.md).
Plan: [R8-knowledge-graph.md](../plans/R8-knowledge-graph.md).
