# ADR-P-055 — Candidatos de procedimientos sustentados en auditoría

Fecha: 2026-08-11  
Estado: aceptada para R5.1

## Contexto

R4 permite describir, simular y gobernar habilidades, pero todavía no ejecuta pasos. R5 debe reconocer procedimientos repetidos sin fingir actividad, copiar contenido privado ni tratar una respuesta de IA como autoridad. La auditoría R3 conserva metadatos mínimos correlacionados y R1 define las únicas capacidades y operaciones reconocidas.

## Decisión

- Un candidato R5 será un objeto cerrado y versionado, separado de habilidades y memoria.
- El método inicial será `r5AuditedRepetitionV1`.
- Se requerirán al menos tres ocurrencias distintas y dos pasos para evitar una sola aparición y los casos más triviales.
- Cada referencia debe resolver a un evento R3 válido con etapa `execution`, resultado `success`, sin decisión adjunta y origen `capability`, `memory` o `cloud`.
- Eventos de permiso, sistema, simulación de habilidades, bloqueo o error no prueban la ejecución de un procedimiento.
- Cada paso debe corresponder a una capacidad no planificada y una operación registrada en R1.
- Las variaciones visibles se limitan inicialmente a duración y `subjectDigest`; sus cantidades se recalculan desde la evidencia y no pueden inventarse.
- El contrato no admite parámetros, valores, mensajes, imágenes, audio ni texto observado.
- La política queda fijada a `proposalOnly=true`, `autoActivation=false`, `executionEnabled=false` y `writesDurableMemory=false`.
- R5.1 no registra comandos Tauri ni crea archivos. Por tanto, el estado real seguirá siendo cero candidatos hasta que un detector posterior encuentre evidencia suficiente.

## Consecuencias positivas

- Cada propuesta puede reconstruirse desde UUID de operación, UUID de evento, capacidad y operación.
- Una visualización activa no puede hacerse pasar por aprendizaje.
- La falta de ejecuciones reales produce ausencia de candidatos, no datos de demostración.
- El futuro envío al Taller puede crear un borrador R4 sin otorgar aprobación ni ejecución.

## Costos y límites

- R3 no conserva valores privados, por lo que R5.1 sólo puede explicar diferencias en metadatos auditables.
- El umbral conservador puede omitir procedimientos útiles de uno o dos pasos; se prefiere el falso negativo a una propuesta infundada.
- R4 todavía no ejecuta habilidades, así que los eventos vigentes de simulación o ciclo de vida no califican.

## Alternativas descartadas

### Inferir habilidades desde conversaciones

Se descarta porque el texto de un proveedor o usuario no demuestra que un procedimiento se ejecutó con éxito.

### Proponer después de una sola ejecución

Se descarta porque no demuestra repetición y eleva el ruido del Taller.

### Guardar parámetros observados en el candidato

Se descarta porque ampliaría innecesariamente la superficie de datos personales y secretos.

