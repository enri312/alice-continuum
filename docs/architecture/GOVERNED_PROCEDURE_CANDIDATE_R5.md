# Contrato R5.1 — Candidato de procedimiento gobernado

## Límite

R5.1 valida propuestas; no detecta, almacena, aprueba ni ejecuta procedimientos. El contrato conecta tres fuentes de verdad:

1. R1 acredita la capacidad, operación y riesgo.
2. R3 acredita cada ejecución exitosa mediante UUID correlacionados.
3. R4 recibirá en un incremento posterior únicamente un borrador revisable.

## Estructura

`ProcedureCandidate` contiene identidad, método, título descriptivo, futura identidad `local.*`, riesgo, política fija, pasos, ocurrencias y variaciones.

Cada ocurrencia conserva un `operationId` distinto y exactamente una referencia de evento por paso. La referencia sólo incluye `stepId` y `eventId`; el resto se resuelve desde R3 para evitar duplicar o reinterpretar evidencia.

## Invariantes

- `schemaVersion = 1`.
- `method = r5AuditedRepetitionV1`.
- `status = proposed`.
- Entre 2 y 16 pasos consecutivos.
- Entre 3 y 32 ocurrencias con UUID únicos.
- Una evidencia R3 no puede reutilizarse.
- La secuencia temporal de eventos debe respetar el orden de pasos.
- Capacidad y operación deben coincidir en candidato, R1 y R3.
- Sólo `execution + success` de productores admitidos califica.
- `declaredRisk` no puede ocultar el riesgo máximo de R1.
- `variations` coincide exactamente con diferencias recalculadas de `durationMs` y `subjectDigest`.
- No existe campo para contenido, parámetros ni valores observados.

## Estado vacío verdadero

Los eventos actuales de R4 son simulaciones y transiciones de gobierno, no ejecuciones de procedimientos. Por ello no satisfacen este contrato. Hasta implementar el detector y disponer de evidencia real válida, Alice debe informar cero candidatos.

## Detector R5.2

`procedure_detection_status` lee únicamente la ventana visible vigente de R3 y produce `ProcedureDetectionSnapshot` mediante `r5-audited-sequence-v1`.

- Sólo califica productores `capability`, `memory` o `cloud` con `execution + success`.
- Capacidad y operación deben existir en R1 y no estar planificadas.
- Los eventos se agrupan por `operationId` y su secuencia exacta de capacidad/operación.
- Un grupo con dos eventos en el mismo milisegundo se descarta porque no demuestra su orden.
- Una firma necesita al menos tres operaciones correlacionadas y dos pasos.
- La huella SHA-256 representa la secuencia, no contenido privado.
- El snapshot fija `persistenceApplied`, `candidateCreated` y `executionEnabled` en `false`.

La ejecución canónica más reciente del 11 de agosto examinó 22 eventos válidos y produjo cero patrones. Los 10 archivos de datos permanecieron idénticos. Ese resultado vacío se conserva como evidencia, no se rellena con demostraciones.
