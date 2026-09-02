# ADR-P-088 — Sentido temporal observable R7.3-A

Fecha: 2026-09-02  
Estado: aceptada para R7.3-A

## Contexto

R7.2 puede persistir una intención temporal, pero todavía no existía una lectura continua que distinguiera una tarea futura de una vencida. Agregar de inmediato notificaciones o intentos habría mezclado percepción del tiempo con efectos e idempotencia aún no diseñados.

## Decisión

R7.3 se divide en dos incrementos. R7.3-A incorpora un reloj local de observación que evalúa el registro validado y clasifica cada tarea como `waiting`, `due` o `excluded`. Las tareas pausadas, completadas y canceladas se excluyen con una razón cerrada.

El hilo de fondo comienza apagado en cada arranque, sólo se activa mediante el control visible del propietario y se puede detener por completo. Mientras está activo evalúa una vez por segundo y conserva en RAM únicamente la fecha del último pulso o un error técnico. No escribe el registro, no registra intentos, no completa tareas, no notifica y no ejecuta capacidades.

R7.3-B deberá agregar primero un ledger durable de intentos e idempotencia antes de permitir que cualquier vencimiento produzca una salida.

## Consecuencias

- Alice puede mostrar tiempo útil real sin fingir que actuó.
- Una consulta con registro ausente no crea almacenamiento.
- Reiniciar devuelve el reloj a `APAGADO`.
- Los contratos declaran invariablemente `automaticExecution=false`, `notificationsEnabled=false` y `writesPerformed=false`.
- La capacidad R1 `tasks.temporal.evaluate` amplía el inventario a 29 capacidades.

## Alternativas rechazadas

- Notificar directamente al detectar `due`: no existe todavía recibo de intento durable.
- Persistir el último pulso: convertiría una evaluación pasiva en escritura continua.
- Iniciar automáticamente con Alice: eliminaría el control explícito y dificultaría comprobar el estado de reposo.
