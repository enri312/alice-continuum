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

## Almacén y decisiones R5.3

`procedure_candidate_store_status` consulta de forma pasiva `data/procedures/candidate-decisions-v1.json`; la ausencia del archivo devuelve una lista vacía sin crear el directorio. `record_procedure_pattern_decision` vuelve a ejecutar R5.2 antes de aceptar una huella y exige confirmación del propietario ligada exactamente a ella.

- Cada huella recibe una sola decisión inmutable: `retain` o `dismiss`.
- `retain` reconstruye el candidato, lo valida otra vez contra R1/R3 y conserva su SHA-256.
- `dismiss` no conserva candidato, título, propósito ni pasos.
- El motivo visible se reduce a SHA-256 antes de escribir; su texto no aparece en el almacén ni en R3.
- El archivo se publica mediante temporal sincronizado y preservación restaurable de la versión anterior.
- Los eventos R3 de gobierno usan `source=procedure` y no activan regiones cognitivas.
- La respuesta fija `executionEnabled=false` y `skillDraftCreated=false`.

La prueba canónica posterior examinó 200 eventos, mantuvo cero patrones y confirmó cero decisiones con el almacén ausente, sin crear contenido. La conversión a borrador R4 sigue fuera de R5.3.

## Conversión gobernada R5.4

`convert_procedure_candidate_to_draft` sólo acepta una decisión `retain` existente. La confirmación liga huella y SHA-256 del candidato; el propietario corrige metadatos antes de crear una identidad R4 nueva. Un descarte, un digest distinto, una huella ya convertida o un `skillId` ocupado fallan de forma cerrada.

El manifiesto resultante usa `draft`, versión 1 y `simulationOnly`; declara exactamente las capacidades y operaciones observadas, un resultado sensible y una comprobación manual. `provenance.procedure` conserva `decisionId`, `candidateId`, `fingerprint` y `candidateSha256`. Ese enlace es inmutable durante las ediciones y se copia a cada revisión del ciclo R4.

`procedure_draft_conversion_status` reconstruye conversiones únicamente desde borradores R4 verificados. Consultar es pasivo. La sonda canónica real produjo cero conversiones, ejecución falsa y aprobación automática falsa sin alterar el árbol de datos.

Los eventos R3 de conversión siguen siendo gobierno del propietario: no activan regiones ni señal global del Núcleo. Crear un borrador no significa que Alice recordó, pensó o ejecutó el procedimiento.
