# ADR-P-092 — Comprobación R7.5 de capacidades en modo lectura

Estado: aceptada · 2026-09-04

## Decisión

Una comprobación R7.5 vuelve a resolver el registro R1 y los grants R2 vigentes en
el instante de cada intento. No reutiliza un estado mostrado anteriormente por la
interfaz, no llama al adaptador evaluado y no guarda el resultado como memoria,
tarea ejecutada ni evento de actividad.

Sólo puede declarar apta una capacidad `query` u `observation` que esté `idle` o
`active` y cuyos efectos declarados sean únicamente `none`, `localRead` o
`credentialPresenceRead`. Las capacidades mutantes, de presentación, proceso o
exportación, y cualquier efecto de red, escritura, proceso, notificación, cámara,
micrófono, pantalla o metadatos de ventana se bloquean. Si R1 declara
`sessionOptIn`, R7.5 exige un grant R2 activo del mismo `capabilityId`.

## Consecuencias

- R7 puede presentar una decisión visible de elegibilidad sin ejecutar acciones.
- La ausencia o expiración de R2 bloquea el intento; nunca crea ni consume un grant.
- El recibo declara `capabilityExecuted=false`, `memoryCreated=false`,
  `writesPerformed=false` y `networkUsed=false`.
