# R8.1 — Proyección nativa de fuentes de memoria

Fecha: 2026-09-04.

## Resultado comprobado

El comando Tauri `knowledge_graph_snapshot` reconstruye referencias versionadas de
`memory/records.json`, registrado en R1 como `memory.graph.inspect`. El inventario
R1 pasa a 34 capacidades. La clasificación y los bloqueos se obtienen del código R6.
No existe aún un productor de aristas ni integración nueva en el volumen visual.

## Prueba sobre los datos canónicos

Se ejecutó `knowledge_graph::tests::live_canonical_graph_is_read_only_and_reproducible`
con `ALICE_LIVE_DATA_DIR` apuntando a la raíz local autorizada. La prueba comparó
SHA-256 y nombres relativos de todos los archivos antes y después, sin imprimir su
contenido. Dos reconstrucciones sucesivas produjeron exactamente el mismo resultado.

```text
files_preserved=36 nodes=15 edges=0
blocked=6 episodeOnly=8 procedureReferenceOnly=1
writes=0 inference=0
```

Los seis bloqueados corresponden a dos conflictos y cuatro supresiones ya existentes.
El perfil de propietario y las notas Markdown no están dentro de esta primera
fuente. Los episodios disponibles acreditan experiencias; no certifican respuestas
de los modelos como conocimiento semántico.

## Regresión

- Rust: 256 pruebas aprobadas; 20 sondas opcionales ignoradas por defecto.
- Sonda canónica R8 ejecutada explícitamente: 1 aprobada, 36 archivos intactos.
- TypeScript: 44 archivos y 433 pruebas aprobadas.
- Build frontend aprobado; permanece la advertencia de tamaño de chunks del visor.
- Fuentes ausentes/vacías, identidad estable, texto privado no duplicado, estados
  R6, corrección versionada, eliminación, corrupción, IDs repetidos, UTF-8 y límites
  de bytes/registros cubiertos por pruebas en archivos temporales separados.

La prueba de reconsolidación detectó inicialmente que `baseVersion` de R6 es siempre
1. Se corrigió la proyección añadiendo `recordVersion` explícito y se verificaron la
versión 2 y su contador de revisión antes de aprobar la suite final.

## Alcance pendiente

Aristas con evidencia, índices semánticos, perfil separado, navegación a fuentes e
integración visual se siguen en el [plan R8](../plans/R8-knowledge-graph.md).
Ningún prototipo de `adapters/` se ejecutó o se incorporó al runtime en este incremento.
