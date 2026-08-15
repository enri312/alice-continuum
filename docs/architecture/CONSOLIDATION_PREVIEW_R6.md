# Vista previa de consolidación R6.3

Versión: R6.3-A  
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

El snapshot contiene estado, ruta, SHA-256 de la fuente, conteos y candidatos. Cada candidato contiene un SHA-256 determinista, exactamente dos IDs, un código de razón cerrado y `requiresHumanReview: true`. No copia el contenido a un nuevo archivo; React muestra los registros que ya cargó desde la misma memoria.

## Límites y fronteras

- máximo 1.000 registros por revisión;
- máximo 2.000 pares candidatos;
- cero escritura, fusión, archivado o corrección;
- cero modelo local o de nube;
- cero cambio de consolidación, importancia o estado;
- fuente corrupta o fuera de presupuesto produce `blocked`;
- fuente ausente produce `unavailable` sin crear directorios.

La futura resolución deberá releer la fuente, exigir el SHA-256 exacto revisado, crear respaldo, registrar auditoría sin contenido privado y permitir mantener ambos registros.
