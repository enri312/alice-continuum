# Registro de tareas e intenciones R7

## Propósito

R7 separa tres conceptos que no deben confundirse:

- un **recuerdo** describe información o una experiencia y continúa gobernado por R6;
- un **recordatorio local** solicita presentar un aviso en una fecha revisada;
- una **comprobación de solo lectura** propone consultar una capacidad R1 sin modificar el equipo.

R7.1 implementó el contrato y la inspección nativa. R7.2-A agregó una transacción gobernada para preparar, confirmar y cancelar un recordatorio único. R7.2-B hace visible esa transacción bajo control del propietario. R7.3 incorpora evaluación temporal y reservas durables. R7.4 entrega una reserva confirmada al adaptador local de notificaciones sin red ni procesos libres.

## Fuente durable

El archivo reservado es `data/tasks/tasks-v1.json`. Su ausencia es un estado normal `missing`: consultar el estado no crea `data/`, la carpeta `tasks/` ni el archivo.

El archivo se limita a 1 MiB antes de deserializar. El documento contiene:

- `schemaVersion=1`;
- `revisionId` UUID;
- hasta 200 tareas con `taskId` UUID único.

Cada tarea declara título, tipo, estado, creación, última actualización, programación, alcance, origen y si puede cancelarse. UUID y fechas usan representación canónica; las fechas se almacenan como UTC `YYYY-MM-DDTHH:MM:SSZ` y una próxima ejecución debe ser posterior a la vista previa que crea el recordatorio. El esquema es cerrado y rechaza campos adicionales; por ello no admite comandos, prompts, argumentos de procesos ni parámetros libres de herramientas.

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

La capacidad R1 `tasks.registry.inspect` registra esta consulta como lectura local de bajo riesgo. `tasks.registry.write` representa únicamente la escritura gobernada R7.2-A y exige confirmación nativa; ninguna de las dos implica que Alice pueda notificar o ejecutar.

## Transacción R7.2-A

`preview_task_mutation` prepara un plan ligado por SHA-256 que muestra identidad UUID, título, hora UTC, alcance `localNotification`, huella de la fuente y revisión proyectada. La preparación no crea la raíz de datos ni escribe archivos.

`confirm_task_mutation` exige devolver el plan completo sin alteraciones y `confirmed=true`. Bajo un bloqueo de escritura vuelve a leer la fuente, rechaza cambios desde la vista previa y sólo entonces:

1. verifica o crea un respaldo byte a byte de la fuente anterior;
2. escribe una revisión inmutable con UUID;
3. sustituye atómicamente `tasks-v1.json` y su `revision-index-v1.json`;
4. registra auditoría R3 usando sólo la huella del `taskId`, nunca el título.

La cancelación conserva el registro, cambia su estado a `cancelled`, retira `nextRunAt` y vuelve `cancellable=false`. Repetir exactamente la misma confirmación devuelve un recibo idempotente sin otra revisión ni otro evento de auditoría.

## Interfaz R7.2-B

El bloque **R7 · Control del propietario** vive en la pantalla Planificador, pero está separado del plan cognitivo descriptivo. La ubicación reúne intención y control temporal sin presentar la escritura como una decisión autónoma de Alice ni añadir una pestaña de Memoria.

La interfaz:

1. consulta el registro nativo real al abrir;
2. acepta un título y una fecha y hora locales para un recordatorio único;
3. convierte la hora a UTC antes de solicitar la vista previa;
4. vuelve a mostrar operación, identidad UUID, título, hora local, alcance, respaldo y ejecución apagada;
5. exige una casilla de revisión antes de habilitar la confirmación;
6. presenta las tareas reales y prepara su cancelación mediante la misma transacción gobernada.

Los contratos TypeScript son cerrados y rechazan claves adicionales, fechas o UUID no canónicos y cualquier respuesta que declare ejecución automática. Preparar o descartar una vista previa no escribe. Sólo la confirmación explícita invoca la mutación nativa.

## Sentido temporal R7.3-A

`task_engine_status` relee el registro validado y compara `nextRunAt` con una fecha UTC canónica. Devuelve una proyección cerrada:

- `waiting`: recordatorio programado para el futuro;
- `due`: fecha alcanzada o superada, sin que eso constituya un intento;
- `excluded`: tarea pausada, completada o cancelada, con razón explícita.

`set_task_engine_enabled` controla un hilo local que empieza apagado en cada proceso. Cuando el propietario lo activa, evalúa una vez por segundo y conserva solamente el último pulso o error en RAM. Detenerlo limpia ese pulso. La lectura no crea la raíz ausente ni modifica bytes del registro.

La respuesta declara siempre `automaticExecution=false`, `notificationsEnabled=false` y `writesPerformed=false`. La capacidad R1 `tasks.temporal.evaluate` es observacional, de lectura local y estado inicial `disabled`.

## Reservas durables R7.3-B

`data/tasks/attempt-ledger-v1.json` permanece ausente hasta que el propietario confirma una reserva para un recordatorio local ya vencido. Cada entrada contiene sólo UUID de intento, UUID de tarea y revisión, fecha programada, fecha de reserva, estado `reserved` y una clave SHA-256 determinista de tarea + fecha. No conserva título ni contenido privado.

`reserve_task_attempt` vuelve a leer la tarea, exige que su fecha coincida y que ya esté vencida, y escribe la reserva junto con una auditoría R3. Repetir la misma ocurrencia devuelve el mismo intento sin volver a escribir ni auditar. No envía avisos, no invoca capacidades, no cambia el estado de la tarea y no produce una salida. La capacidad `tasks.dispatch.reserve` exige confirmación nativa explícita.

## Entrega local R7.4

`dispatch_task_notification` acepta únicamente una reserva `reserved`, su clave de
idempotencia exacta y `confirmed=true`. Antes de llamar al sistema operativo cambia
el intento a `dispatching` y registra `TASK_NOTIFICATION_STARTED`. Después conserva
un resultado terminal:

- `accepted` + `acceptedByOs`: el adaptador del sistema operativo aceptó el aviso;
- `failed` + `notificationError`: el adaptador rechazó el aviso, sin almacenar su
  texto de error dentro del ledger.

Los estados terminales devuelven el recibo original ante una repetición y no vuelven
a invocar el adaptador. Un estado `dispatching` encontrado tras un cierre inesperado
es una entrega incierta: se bloquea el reintento para evitar un aviso duplicado. El
ledger informa `outputPerformed=true` si contiene al menos una aceptación real, pero
`notificationsEnabled=false` sigue indicando que no existe despacho automático en
segundo plano. La tarea programada no se marca completada en esta fase.

La capacidad `tasks.notification.deliver` es R2, requiere confirmación explícita y
declara lectura local, escritura local y notificación al usuario. El recibo declara
`networkUsed=false`, `processSpawned=false` y `taskStateChanged=false`.

## Límites actuales

- La escritura nativa tiene una pantalla visible, pero todavía no se usó sobre datos canónicos: el registro permanece ausente y contiene 0 tareas.
- Sin recurrencia, zona horaria configurable o cálculo de vencimiento.
- El hilo temporal es opcional y está apagado al iniciar; no sobrevive a un reinicio.
- Sin entrega automática: cada aviso requiere reserva y confirmación manuales.
- Sin ejecución de capacidades, red, procesos o acciones externas.
- La auditoría cubre programación, cancelación, reserva, inicio y resultado de notificación.
- Sin enlace automático desde recuerdos, conversación o salidas de modelos.

El siguiente incremento será R7.5: comprobaciones gobernadas de sólo lectura. El primer recordatorio canónico sólo se creará cuando el propietario decida confirmarlo desde la pantalla; no fue necesario fabricarlo para validar R7.4.
