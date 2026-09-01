# Plan de implementación R7 — Tareas programadas e intenciones

Estado: en curso · R7.1 implementado  
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

- [ ] Preparar un recordatorio único sin escribir.
- [ ] Confirmar con identidad, hora y alcance releídos.
- [ ] Crear respaldo e índice de revisión antes del reemplazo.
- [ ] Cancelar de forma explícita e idempotente.
- [ ] Auditar programación y cancelación sin texto privado.

## R7.3 — Motor local de vencimiento

- [ ] Resolver el reloj y tareas vencidas sin duplicar tras reinicio.
- [ ] Distinguir programación, intento, omisión y resultado.
- [ ] Mantener tareas pausadas, canceladas o vencidas fuera de ejecución.
- [ ] Permitir apagar completamente el modo en segundo plano.

## R7.4 — Recordatorio local

- [ ] Mostrar una notificación local autorizada.
- [ ] No requerir red ni procesos libres.
- [ ] Registrar resultado y conservar idempotencia.

## R7.5 — Comprobación de solo lectura

- [ ] Resolver de nuevo la capacidad R1 en cada intento.
- [ ] Exigir R2 cuando la capacidad lo requiera.
- [ ] Rechazar capacidades mutantes o con efectos externos.
- [ ] Presentar el resultado sin convertirlo automáticamente en recuerdo.

