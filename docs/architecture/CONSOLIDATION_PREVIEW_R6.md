# Vista previa de consolidación R6.3

Versión: R6.3-B  
Estado: implementado y validado  
Fecha: 2026-08-15

## Propósito

Localizar pares de recuerdos que una persona podría consolidar sin modificar la memoria ni atribuir comprensión semántica inexistente. La fuente continúa siendo `memory/records.json`.

## Reglas cerradas

Sólo participan registros terminados y no archivados. El texto se convierte a minúsculas, la puntuación se reemplaza por espacios y los espacios repetidos se colapsan.

| Candidato | Condición |
|---|---|
| `exactDuplicate` | Coinciden tipo, clase de memoria, intención, resumen y próximo paso normalizados |
| `reviewRequired` | Coincide la intención normalizada, pero difiere al menos otro campo |

`reviewRequired` no significa contradicción. Puede representar una ampliación, una versión posterior o dos recuerdos legítimamente separados.

## Contrato de salida

El snapshot v2 contiene estado, ruta, SHA-256 de la fuente, conteos y candidatos. Cada candidato contiene un SHA-256 determinista, exactamente dos IDs, un código de razón cerrado, `requiresHumanReview: true` y una resolución opcional. React muestra los registros que ya cargó desde la misma memoria.

## Resolución R6.3-B

La única acción aceptada es `keepSeparate`. El comando exige `confirmed: true`, el SHA-256 revisado, el ID del candidato y sus dos registros ordenados. Rust relee y valida la fuente antes de escribir.

La fuente se respalda byte a byte como `backups/consolidation-source-<sha>.json`. La decisión se guarda en `consolidation-decisions-v1.json` con IDs y huellas, nunca con intención, resumen o próximo paso. Una repetición idéntica es idempotente. La vista conserva el candidato y lo marca resuelto.

La vista bloquea una decisión cuyo respaldo falte o no coincida. Si la auditoría local no puede escribirse, la transacción restaura el registro lateral anterior y no presenta la resolución como aceptada.

## Límites y fronteras

- máximo 1.000 registros por revisión;
- máximo 2.000 pares candidatos;
- cero fusión, archivado, corrección o reescritura de recuerdos;
- cero modelo local o de nube;
- cero cambio de consolidación, importancia o estado;
- fuente corrupta o fuera de presupuesto produce `blocked`;
- fuente ausente produce `unavailable` sin crear directorios;
- registro lateral corrupto bloquea la vista;
- la resolución requiere confirmación, respaldo, auditoría y SHA-256 vigente.

La futura fusión manual permanece fuera de alcance hasta definir un registro superviviente, restauración verificable y efectos exactos sobre los índices derivados.
