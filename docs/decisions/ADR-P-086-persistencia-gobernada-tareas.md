# ADR-P-086 — Persistencia gobernada de tareas R7

Fecha: 2026-09-01  
Estado: aceptada

## Contexto

R7.1 separó memoria e intención, pero escribir directamente un recordatorio todavía permitiría confirmar datos distintos de los revisados, perder el estado anterior o duplicar una cancelación al reintentar.

## Decisión

R7.2-A adopta una transacción en dos pasos. La vista previa no escribe y devuelve un plan íntegro ligado por SHA-256. La confirmación recibe ese mismo plan, exige `confirmed=true`, relee la fuente bajo exclusión mutua y rechaza cualquier cambio de identidad, título, hora, alcance, revisión o huella.

Antes de activar la nueva fuente se conserva un respaldo byte a byte cuando existe una versión anterior y se escribe una revisión inmutable. El índice durable identifica la revisión activa. La auditoría R3 conserva la huella del `taskId`, la operación y el resultado, pero no el título del recordatorio.

Una cancelación no elimina la tarea: cambia el estado a `cancelled`, retira la próxima ejecución y deja de ser cancelable. Repetir el mismo plan ya aplicado es un éxito idempotente sin otra escritura ni auditoría.

## Consecuencias

- Una vista previa puede descartarse sin crear carpetas.
- Un plan alterado u obsoleto falla cerrado.
- La historia puede reconstruirse desde revisiones y respaldos locales.
- La capacidad `tasks.registry.write` describe una mutación local de riesgo medio con confirmación nativa.
- Persistir no equivale a ejecutar: no hay reloj, scheduler, notificación, red ni procesos.
- R7.2-B materializa la pantalla visible dentro de Planificador como un bloque separado de control del propietario.
- La prueba de interfaz prepara y descarta una vista previa real sin escritura; la primera tarea canónica deberá surgir de una decisión del propietario, no de una prueba.

## Alternativas rechazadas

- Guardar al pulsar “crear” sin vista previa: no prueba qué datos revisó el propietario.
- Sobrescribir un único JSON: elimina evidencia de la versión anterior.
- Auditar el título: filtraría contenido privado innecesario.
- Eliminar físicamente al cancelar: confunde cancelación con borrado y rompe la trazabilidad.
