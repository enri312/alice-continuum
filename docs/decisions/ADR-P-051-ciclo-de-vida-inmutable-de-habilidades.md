# ADR-P-051 — Ciclo de vida inmutable de habilidades

Fecha: 2026-08-10  
Estado: aceptada

## Contexto

R4.2 conserva borradores verificables y R4.3 simula planes sin efectos. Faltaba representar decisiones explícitas de revisión, aprobación, desactivación, restauración y retiro sin convertir una respuesta del modelo en autoridad ni sobrescribir una versión previamente aprobada.

## Decisión

Alice incorpora un índice cerrado `data/skills/lifecycle.json` y revisiones JSON inmutables bajo `data/skills/revisions/<skillId>/<revisionId>.json`.

- Cada transición exige `skillId`, revisión esperada, SHA-256 esperado, actor `localOwner`, confirmación explícita y motivo visible.
- Las transiciones válidas son `submitReview`, `approve`, `disable`, `restore` y `retire`.
- La primera revisión conserva como evidencia el borrador fuente y crea una revisión `inReview` nueva.
- Aprobar, desactivar, restaurar o retirar siempre crea otra revisión con UUID v4 y padre explícito.
- Volver a someter cambios después de una aprobación incrementa la versión y conserva la aprobación anterior byte por byte.
- `approved` no significa ejecutable: `simulationOnly` y todas las banderas de efecto continúan en `false`.
- Una solicitud R3 debe persistirse antes de escribir. El resultado o bloqueo usa el mismo UUID de operación y sólo conserva digests, nunca el motivo ni el contenido.
- Cada simulación estática también emite solicitud y resultado R3 correlacionados.

## Consecuencias

- Carlos puede acreditar exactamente qué bytes revisó antes de decidir.
- Alteraciones del historial se detectan por SHA-256 y no se reparan silenciosamente.
- La auditoría puede mostrar actividad real de habilidades sin revelar manifiestos o razones privadas.
- R4.5 podrá construir una interfaz sobre contratos nativos ya cerrados.
- La ejecución de adaptadores continúa fuera del alcance.

