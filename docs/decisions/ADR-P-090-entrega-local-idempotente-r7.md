# ADR-P-090 — Entrega local idempotente R7

Estado: aceptada · 2026-09-04

## Decisión

R7.4 entrega recordatorios mediante el adaptador nativo de notificaciones sólo desde
una reserva durable y tras confirmación explícita. Antes de solicitar la salida se
persiste el estado `dispatching`; después se persiste `accepted` o `failed` y se
auditan el inicio y el resultado sin incluir el título privado.

Un resultado terminal no se vuelve a entregar. Un `dispatching` recuperado tras un
cierre inesperado se trata como incierto y se bloquea, porque repetirlo podría crear
dos avisos aunque el primer resultado no haya llegado a persistirse.

## Consecuencias

- El adaptador no usa red ni inicia procesos libres.
- La aceptación confirma recepción por el sistema operativo, no lectura humana.
- La tarea permanece programada; cerrar su ciclo será una decisión posterior.
- No existe scheduler de salida: reserva y entrega continúan siendo manuales.
- El ledger puede demostrar una salida aceptada sin afirmar que la automatización
  esté habilitada.
