# ADR-P-089 — Reservas durables de despacho R7

Estado: aceptada · 2026-09-02

## Decisión

Una tarea vencida no se considera ejecutada. Antes de que exista cualquier adaptador de salida, el propietario puede confirmar una reserva durable e idempotente en `attempt-ledger-v1.json`.

La clave de idempotencia es SHA-256 de `taskId` y `scheduledFor`. La reserva guarda sólo metadatos técnicos, se audita y no altera el registro de tareas.

## Consecuencias

- Un reinicio no puede generar una segunda reserva para la misma ocurrencia.
- R7.4 deberá consumir y cerrar una reserva con un resultado de notificación; no podrá fingir que una reserva ya fue entregada.
- Sin confirmación explícita, sin vencimiento o si los datos cambiaron, no se escribe nada.
