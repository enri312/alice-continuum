# ADR-P-050 — Simulación estática de habilidades sin adaptadores

Fecha: 2026-08-10  
Estado: aceptada para R4.3

## Contexto

Un borrador R4 puede declarar pasos y capacidades, pero mostrar solamente el JSON obliga al usuario a interpretar manualmente permisos, efectos, madurez y disponibilidad. El Taller necesita explicar qué ocurriría antes de cualquier aprobación futura sin convertir la simulación en una vía de ejecución.

## Decisión

- R4.3 incorpora `simulate_skill_plan`, un comando nativo de análisis estático.
- El manifiesto se valida nuevamente contra el snapshot R1 vigente.
- El resultado cerrado `r4-static-plan-v1` enumera identidad, campos, capacidades, pasos, permisos, efectos, datos, precondiciones, comprobaciones y bloqueos.
- Nunca se aceptan valores de entrada. Sólo se muestran IDs, etiquetas, tipos y marcas de sensibilidad.
- Descripciones generales, descripciones de campos y descripciones de pasos no se copian al resultado.
- Toda simulación declara `canExecute: false`, `adapterInvocationCount: 0` y `sideEffectsApplied: false`.
- `executionDisabled` es un bloqueo global obligatorio, incluso si el manifiesto llegara a estar aprobado en una fase posterior.
- Capacidades planificadas, no disponibles, degradadas o sin autoridad de permisos generan bloqueos explícitos por paso.
- Manifiesto y resultado reciben digests SHA-256 canónicos; la misma entrada y el mismo snapshot producen el mismo resultado.
- R4.3 no escribe auditoría: la correlación R3 y el ciclo de vida pertenecen a R4.4.

## Consecuencias positivas

- El usuario puede inspeccionar el plan sin conceder autoridad.
- La interfaz futura podrá explicar riesgos y permisos sin duplicar lógica de seguridad.
- Un resultado alterado deja de coincidir con su digest.
- La prueba viva puede usar los datos canónicos sin abrir cámara, micrófono o red.

## Costos y límites

- Las entradas y precondiciones quedan expresamente sin evaluar.
- `available` significa que el descriptor R1 no presenta un bloqueo estático; no autoriza una llamada futura.
- No existe todavía interfaz visible del simulador.
- No existe aprobación, activación ni ejecución.

## Alternativas descartadas

### Ejecutar en modo seco

Se descarta porque un adaptador puede producir efectos aun cuando afirme soportar “dry run”. R4.3 no llama adaptadores.

### Simular en React

Se descarta porque duplicaría la fuente de verdad R1 y permitiría resultados distintos entre interfaz y backend.

### Incluir valores de entrada para mayor realismo

Se descarta porque ampliaría innecesariamente la exposición de contenido sensible durante una explicación estructural.
