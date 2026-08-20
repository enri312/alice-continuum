# Vista previa de consolidación R6.3

Versión: R6.3-C  
Estado: implementado y validado  
Fecha: 2026-08-20

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

## Plan manual R6.3-C

`preview_consolidation_merge` acepta únicamente un candidato `exactDuplicate` pendiente. La persona debe elegir uno de los dos IDs como superviviente. Rust exige el SHA-256 revisado, el ID determinista del candidato y el par ordenado; después relee `records.json`, valida nuevamente ambos registros y confirma que sus firmas normalizadas sigan siendo iguales.

La respuesta es un plan cerrado de solo lectura. Incluye:

- registro superviviente y registro que se retiraría;
- cantidad actual y proyectada de registros;
- SHA-256 y tamaño en bytes de la serialización proyectada;
- campos originales que difieren aunque el contenido normalizado coincida;
- estado `missing` o `verified` del respaldo ligado a la fuente;
- impacto `absent`, `inactive` o `activeRevisionWillBecomeStale` sobre R6.1;
- indicadores explícitos de que ejecución y restauración no están disponibles.

El comando no crea el respaldo faltante, no escribe auditoría y no modifica ningún archivo. La interfaz invalida el plan al cambiar el superviviente o actualizar la fuente. No existe botón de fusión.

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
- R6.3-C sólo calcula planes para `exactDuplicate` sin resolución previa;
- una vista R6.3-C declara `recordsModified: false`, `filesCreated: false`, `auditWritten: false` y `modelUsed: false`;
- el hash proyectado describe el resultado hipotético y nunca sustituye la fuente canónica.

La ejecución de la fusión permanece fuera de alcance hasta implementar restauración verificable, auditoría transaccional y tratamiento explícito de una revisión R6.1 que quedaría obsoleta.
