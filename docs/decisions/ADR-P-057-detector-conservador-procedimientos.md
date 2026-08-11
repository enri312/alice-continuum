# ADR-P-057 — Detector conservador y efímero de secuencias auditadas

Fecha: 2026-08-11  
Estado: aceptada para R5.2

## Contexto

R5.1 definió candidatos verificables, pero no examinaba la auditoría. El siguiente paso debe detectar repetición sin crear archivos, inventar orden entre eventos, convertir simulaciones en ejecuciones ni producir habilidades automáticamente.

## Decisión

- El detector usa la ventana visible y validada de R3, actualmente acotada a 200 eventos.
- Sólo acepta eventos productores exitosos de capacidad, memoria o nube.
- Sistema, permisos, habilidades, solicitudes, bloqueos, errores y capacidades planificadas se excluyen.
- Los eventos se agrupan por UUID de operación y luego por secuencia exacta de capacidad/operación.
- Se exigen entre 2 y 16 pasos y al menos 3 UUID de operación distintos.
- Si dos pasos comparten `timestampMs`, la operación completa se excluye porque R3 no demuestra su orden.
- La firma usa SHA-256 de la secuencia cerrada; no incluye parámetros ni contenido.
- El resultado es efímero y fija persistencia, creación de candidato y ejecución en `false`.
- TypeScript vuelve a validar campos, conteos, umbrales, evidencias, capacidades, operaciones y riesgo.

## Evidencia inicial

La sonda canónica real más reciente examinó 22 eventos R3, encontró 0 ejecuciones calificadas y devolvió 0 patrones. Los 10 archivos de datos permanecieron idénticos antes y después.

## Consecuencias

- La ausencia de evidencia produce un estado vacío verdadero.
- R5.3 podrá decidir cómo conservar o descartar patrones sin cambiar este detector.
- Una operación rápida con timestamps empatados puede ser un falso negativo; se acepta para evitar ordenar evidencia arbitrariamente.
