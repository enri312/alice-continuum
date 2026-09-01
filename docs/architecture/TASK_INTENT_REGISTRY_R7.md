# Registro de tareas e intenciones R7

## Propósito

R7 separa tres conceptos que no deben confundirse:

- un **recuerdo** describe información o una experiencia y continúa gobernado por R6;
- un **recordatorio local** solicita presentar un aviso en una fecha revisada;
- una **comprobación de solo lectura** propone consultar una capacidad R1 sin modificar el equipo.

El primer incremento implementa únicamente el contrato y una inspección nativa de solo lectura. No crea tareas, no ejecuta comprobaciones, no inicia un scheduler y no convierte recuerdos en acciones.

## Fuente futura

El archivo reservado es `data/tasks/tasks-v1.json`. Su ausencia es un estado normal `missing`: consultar el estado no crea `data/`, la carpeta `tasks/` ni el archivo.

El archivo se limita a 1 MiB antes de deserializar. El documento contiene:

- `schemaVersion=1`;
- `revisionId` UUID;
- hasta 200 tareas con `taskId` UUID único.

Cada tarea declara título, tipo, estado, creación, programación, alcance, origen y si puede cancelarse. UUID y fechas usan representación canónica; las fechas se almacenan como UTC `YYYY-MM-DDTHH:MM:SSZ` y una próxima ejecución no puede ser anterior a la creación. El esquema es cerrado y rechaza campos adicionales; por ello no admite comandos, prompts, argumentos de procesos ni parámetros libres de herramientas.

## Tipos cerrados

| Eje | Valores R7.1 |
|---|---|
| Tipo | `localReminder`, `readOnlyCheck` |
| Estado | `scheduled`, `paused`, `completed`, `cancelled` |
| Programación | `once` |
| Alcance | `localNotification`, `capabilityRead` |
| Origen | `ownerConfirmed` |

Una tarea `scheduled` o `paused` debe conservar `nextRunAt` y `cancellable=true`. Una tarea `completed` o `cancelled` no puede declarar próxima ejecución y no es cancelable.

Un recordatorio sólo puede usar `localNotification` y no referencia una capacidad. Una comprobación sólo puede usar `capabilityRead` y exige un identificador R1 sintácticamente válido. R7.1 todavía no resuelve ni consume esa capacidad.

## Snapshot nativo

`task_registry_status` devuelve:

- estado `missing`, `ready` o `invalid`;
- existencia del almacén;
- conteos totales y por estado;
- tareas validadas cuando el documento es correcto;
- error técnico controlado cuando el documento es inválido;
- `automaticExecution=false` de forma invariable.

La capacidad R1 `tasks.registry.inspect` registra esta consulta como lectura local de bajo riesgo. Su existencia no implica que Alice pueda programar, notificar o ejecutar.

## Límites del primer incremento

- Sin escritura ni edición de tareas.
- Sin recurrencia, zona horaria configurable o cálculo de vencimiento.
- Sin hilo en segundo plano.
- Sin notificaciones del sistema operativo.
- Sin ejecución de capacidades, red, procesos o acciones externas.
- Sin auditoría de intentos porque todavía no existen intentos de ejecución.
- Sin enlace automático desde recuerdos, conversación o salidas de modelos.

El siguiente incremento deberá diseñar una vista previa de creación y cancelación con identidad e idempotencia antes de habilitar persistencia.
