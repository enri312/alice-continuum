# ADR-P-068 — Vista previa antes de consolidar memoria

Fecha: 2026-08-15  
Estado: aceptada

## Contexto

R6.3 debe ayudar a mantener una memoria coherente, pero el registro v1 guarda texto libre. Dos frases diferentes sobre un mismo tema no demuestran por sí solas una contradicción y una coincidencia lexical no autoriza fusionar recuerdos.

## Decisión

El primer incremento será exclusivamente una consulta nativa. `consolidation_preview` relee y valida `records.json`, detecta duplicados exactos normalizados y separa como `reviewRequired` cualquier par con la misma intención y contenido diferente. Todos los pares requieren decisión humana.

La vista no crea archivos, no usa modelos y no expone comandos de resolución. Los candidatos quedan ligados a la huella de la fuente mediante SHA-256. La interfaz los muestra en una subpestaña propia, separada de la cola temporal de repasos.

## Consecuencias

- Alice puede señalar mantenimiento potencial sin fingir comprensión semántica.
- Cero candidatos es un resultado válido y visible.
- Cambiar `records.json` invalida materialmente la huella que originó los IDs.
- Fusionar, archivar o mantener separados se diseñará en otro incremento con confirmación, respaldo y auditoría.
