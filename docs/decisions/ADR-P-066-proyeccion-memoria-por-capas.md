# ADR-P-066 — Proyección reversible de memoria por capas

Fecha: 2026-08-13  
Estado: aceptada

## Contexto

La memoria v1 mezcla conversaciones, enseñanzas, preferencias y procedimientos en un único arreglo. R6 necesita separar funciones cognitivas, pero los registros privados existentes no deben reescribirse ni reclasificarse mediante inferencias ocultas.

## Decisión

R6.1 crea `memory/layer-index-v2.json` como índice derivado, sin contenido privado. Cada revisión referencia IDs v1 y queda ligada al SHA-256 completo de `records.json`.

La clasificación inicial usa sólo campos explícitos:

- `Conversación` o `memoryType=episodic` → `episodic`;
- `Enseñanza` con `memoryType=semantic` → `taughtFacts`;
- el resto → `unclassified` con razón cerrada;
- `working` permanece vacío.

La migración nunca ocurre al cargar Alice. Requiere vista previa, confirmación visible y coincidencia SHA-256 comprobada otra vez por Rust. Las revisiones son inmutables. La reversión desactiva la revisión activa sin borrar la fuente, el índice o su historial.

## Ampliación R6.6-A — 2026-08-24

El índice v2 activo se conserva como evidencia del contrato original. R6.6-A crea `memory/layer-index-v3.json` con `schemaVersion=2`; no migra, reescribe ni desactiva v2 automáticamente.

Un registro con `memoryType=procedural` se proyecta en la capa `procedural` con `linkState=pendingR5`. Esto reconoce un dato explícito sin afirmar que exista una habilidad R5/R4, sin crear un enlace y sin habilitar ejecución. Preferencias y tipos sin contrato continúan `unclassified`.

La vista previa v3 sigue siendo de sólo lectura. Crear o activar v3 exige la misma confirmación ligada al SHA-256 vigente y conserva sus propias revisiones y respaldos.

## Consecuencias

- Los datos actuales permanecen recuperables y editables.
- R6 puede evolucionar por revisiones sin perder trazabilidad.
- Una clasificación limitada deja elementos sin clasificar en vez de inventar significado.
- Durante R6.1 existen dos vistas: registros v1 como fuente y capas v2 como proyección.
- Una fase posterior deberá migrar las operaciones de edición antes de declarar v2 como fuente primaria.

## Rechazado

- Reescribir `records.json` en carpetas por capa.
- Copiar contenido completo al índice.
- Clasificar con un LLM.
- Guardar conversaciones, señal sensorial o preferencias como hechos por defecto.
- Borrar revisiones al revertir.
