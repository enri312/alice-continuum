# Plan de implementación R7 — Tareas programadas e intenciones

Estado: en curso · R7.5 implementado; validación viva pendiente  
Inicio: 2026-09-01

## R7.1 — Contrato e inspección pasiva

- [x] Separar recuerdos, recordatorios y comprobaciones.
- [x] Esquema JSON cerrado sin comandos ni parámetros ejecutables.
- [x] Identidad UUID y rechazo de duplicados.
- [x] Próxima ejecución, alcance, estado y cancelabilidad coherentes.
- [x] Consulta nativa que no crea el almacén ausente.
- [x] Bloqueo de archivos corruptos sin reparación silenciosa.
- [x] Registro de la consulta como capacidad R1.
- [x] Pruebas físicas temporales con preservación byte a byte.
- [x] Sonda canónica de ausencia con todos los archivos intactos.

R7.1 no programa ni ejecuta. `automaticExecution=false` forma parte de la respuesta nativa.

## R7.2 — Vista previa y persistencia gobernada

- [x] Preparar un recordatorio único sin escribir.
- [x] Confirmar con identidad, hora y alcance releídos.
- [x] Crear respaldo, revisión inmutable e índice antes de confirmar el reemplazo.
- [x] Cancelar de forma explícita e idempotente.
- [x] Auditar programación y cancelación sin texto privado.
- [x] Integrar la revisión y confirmación en una pantalla visible para el propietario.

El backend R7.2-A persiste únicamente después de recibir el plan completo devuelto por la vista previa y `confirmed=true`. R7.2-B expone esa transacción en **Planificador**, dentro de un bloque separado de control del propietario: permite preparar un recordatorio único, releer identidad, título, hora local, alcance, respaldo y estado de ejecución, confirmar mediante una casilla explícita, inspeccionar el registro y preparar una cancelación. Todavía no existe scheduler, notificación ni ejecución automática. La validación de interfaz usó sólo una vista previa y conservó el registro canónico ausente.

## R7.3 — Motor local de vencimiento

- [x] Evaluar el reloj y distinguir tareas futuras, vencidas y excluidas sin efectos.
- [x] Exponer el pulso real y permitir apagar completamente el modo en segundo plano.
- [x] Reiniciar siempre con el reloj apagado y sin persistir pulsos.
- [x] Crear un ledger durable de reservas antes de producir salidas.
- [x] Evitar reservas duplicadas tras reinicio.
- [x] Distinguir programación, reserva y resultado futuro.
- [x] Mantener tareas pausadas, canceladas o terminales fuera de despacho.

R7.3-A es sentido temporal observable: `waiting`, `due` y `excluded` se calculan desde la fuente validada; no existen intentos, notificaciones, escrituras ni ejecución. R7.3-B añade una reserva durable, explícita e idempotente para un recordatorio local vencido. La reserva no es un aviso ni un resultado: sólo impide duplicar una futura salida después de reiniciar.

## R7.4 — Recordatorio local

- [x] Mostrar una notificación local autorizada.
- [x] No requerir red ni procesos libres.
- [x] Registrar resultado y conservar idempotencia.

R7.4 consume una reserva únicamente después de otra confirmación visible. Primero
persiste `dispatching`, luego solicita el aviso al sistema operativo y finalmente
cierra el intento como `accepted` o `failed`. Una aceptación o fallo terminal no se
reintenta; un `dispatching` recuperado después de un cierre inesperado se considera
incierto y tampoco se repite automáticamente.

## R7.5 — Comprobación de solo lectura

- [x] Resolver de nuevo la capacidad R1 en cada intento.
- [x] Exigir R2 cuando la capacidad lo requiera.
- [x] Rechazar capacidades mutantes o con efectos externos.
- [x] Presentar el resultado sin convertirlo automáticamente en recuerdo.

R7.5 no ejecuta la capacidad elegida: relee exclusivamente su descriptor R1 y los
grants R2 vigentes. Sólo declara aptas las consultas u observaciones con efectos
`none`, `localRead` o `credentialPresenceRead`; bloquea toda mutación, salida,
proceso, red, notificación o percepción. La primera validación viva deberá hacerse
después de reiniciar Alice con el binario actualizado, sin tocar la conversación RAM
actual.
