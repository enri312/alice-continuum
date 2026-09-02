# Registro de tareas e intenciones R7

## Propósito

R7 separa tres conceptos que no deben confundirse:

- un **recuerdo** describe información o una experiencia y continúa gobernado por R6;
- un **recordatorio local** solicita presentar un aviso en una fecha revisada;
- una **comprobación de solo lectura** propone consultar una capacidad R1 sin modificar el equipo.

R7.1 implementó el contrato y la inspección nativa. R7.2-A agregó una transacción gobernada para preparar, confirmar y cancelar un recordatorio único. R7.2-B hace visible esa transacción bajo control del propietario. R7.3-A incorpora evaluación temporal observable sin convertir un vencimiento en acción.

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

## Límites actuales

- La escritura nativa tiene una pantalla visible, pero todavía no se usó sobre datos canónicos: el registro permanece ausente y contiene 0 tareas.
- Sin recurrencia, zona horaria configurable o cálculo de vencimiento.
- El hilo temporal es opcional y está apagado al iniciar; no sobrevive a un reinicio.
- Sin notificaciones del sistema operativo.
- Sin ejecución de capacidades, red, procesos o acciones externas.
- La auditoría cubre programación y cancelación; todavía no existen intentos de ejecución ni ledger de vencimientos.
- Sin enlace automático desde recuerdos, conversación o salidas de modelos.

El siguiente incremento será R7.3-B: ledger durable de intentos e idempotencia antes de cualquier salida. El primer recordatorio canónico sólo se creará cuando el propietario decida confirmarlo desde la pantalla; no es necesario fabricarlo para validar el reloj.
