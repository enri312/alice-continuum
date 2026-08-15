# ADR-P-069 — Resolución humana mantener-separados

Fecha: 2026-08-15  
Estado: aceptada

## Contexto

R6.3-A detecta pares sin modificarlos. Una misma intención puede describir recuerdos complementarios y no autoriza fusión, eliminación ni declaración automática de contradicción. La primera resolución debe ser reversible, verificable y útil aun sin transformar la fuente canónica.

## Decisión

R6.3-B expone únicamente `keepSeparate`. La persona confirma el par visto; Rust exige el SHA-256 exacto de `records.json`, el ID determinista del candidato y sus dos IDs ordenados. Antes de persistir, guarda una copia byte a byte de la fuente ligada a su huella.

La decisión vive en `consolidation-decisions-v1.json`. Sólo contiene IDs, huellas, clasificación cerrada, acción y fecha: nunca intención, resumen o próximo paso. La operación es idempotente, genera auditoría sin contenido privado y no modifica `records.json`. La vista releída mantiene el par visible como resuelto.

## Consecuencias

- una fuente cambiada invalida la confirmación;
- una decisión repetida no duplica archivos ni entradas;
- un registro lateral corrupto bloquea la vista en vez de ignorarse;
- la copia canónica permite demostrar qué bytes fueron revisados;
- fusión, archivado y eliminación siguen bloqueados;
- la futura fusión requerirá seleccionar el registro superviviente y probar restauración.
