# Vista previa de consolidación R6.3

Versión: R6.3-F  
Estado: implementado y validado  
Fecha: 2026-08-20

## Propósito

Localizar pares de recuerdos que una persona podría consolidar sin modificar la memoria ni atribuir comprensión semántica inexistente. La fuente continúa siendo `memory/records.json`.

## Reglas cerradas

Sólo participan registros terminados y no archivados. El texto se convierte a minúsculas, la puntuación se reemplaza por espacios y los espacios repetidos se colapsan.

| Candidato | Condición |
|---|---|
| `exactDuplicate` | Coinciden tipo, clase de memoria, intención, resumen y próximo paso normalizados |
| `reviewRequired` | Coincide la intención normalizada, pero difiere al menos otro campo |

`reviewRequired` no significa contradicción. Puede representar una ampliación, una versión posterior o dos recuerdos legítimamente separados.

## Contrato de salida

El snapshot v2 contiene estado, ruta, SHA-256 de la fuente, conteos y candidatos. Cada candidato contiene un SHA-256 determinista, exactamente dos IDs, un código de razón cerrado, `requiresHumanReview: true` y una resolución opcional. React muestra los registros que ya cargó desde la misma memoria.

## Resolución R6.3-B

La única acción aceptada es `keepSeparate`. El comando exige `confirmed: true`, el SHA-256 revisado, el ID del candidato y sus dos registros ordenados. Rust relee y valida la fuente antes de escribir.

La fuente se respalda byte a byte como `backups/consolidation-source-<sha>.json`. La decisión se guarda en `consolidation-decisions-v1.json` con IDs y huellas, nunca con intención, resumen o próximo paso. Una repetición idéntica es idempotente. La vista conserva el candidato y lo marca resuelto.

La vista bloquea una decisión cuyo respaldo falte o no coincida. Si la auditoría local no puede escribirse, la transacción restaura el registro lateral anterior y no presenta la resolución como aceptada.

## Plan manual R6.3-C

`preview_consolidation_merge` acepta únicamente un candidato `exactDuplicate` pendiente. La persona debe elegir uno de los dos IDs como superviviente. Rust exige el SHA-256 revisado, el ID determinista del candidato y el par ordenado; después relee `records.json`, valida nuevamente ambos registros y confirma que sus firmas normalizadas sigan siendo iguales.

La respuesta es un plan cerrado de solo lectura. Incluye:

- registro superviviente y registro que se retiraría;
- cantidad actual y proyectada de registros;
- SHA-256 y tamaño en bytes de la serialización proyectada;
- campos originales que difieren aunque el contenido normalizado coincida;
- estado `missing` o `verified` del respaldo ligado a la fuente;
- impacto `absent`, `inactive` o `activeRevisionWillBecomeStale` sobre R6.1;
- indicadores explícitos de que la fusión no está disponible y la restauración sólo puede actuar sobre un recibo pendiente ya existente.

El comando no crea el respaldo faltante, no escribe auditoría y no modifica ningún archivo. La interfaz invalida el plan al cambiar el superviviente o actualizar la fuente. No existe botón de fusión.

## Ensayo de recuperación R6.3-D

El plan v2 incorpora un protocolo ordenado de ocho pasos: verificar fuente, crear o verificar respaldo, preparar proyección, reemplazar atómicamente, verificar resultado, auditar, restaurar ante un fallo y verificar la restauración. Todas las garantías son obligatorias y una revisión R6.1 activa bloquea el ensayo antes de tocar archivos.

Rust contiene un motor de ensayo deliberadamente desconectado del registro de comandos Tauri. Sobre almacenamiento físico controlado, el motor:

1. crea o verifica el respaldo byte a byte;
2. escribe un temporal en el mismo directorio y fuerza sus bytes a disco;
3. usa `MoveFileExW` con reemplazo y escritura forzada;
4. verifica el SHA-256 proyectado;
5. ejecuta el punto de auditoría;
6. restaura siempre la fuente original durante el ensayo;
7. relee y compara bytes y SHA-256 originales.

Un fallo de auditoría inducido también termina con la fuente original restaurada. El motor no puede invocarse desde React ni desde IPC; por eso una vista previa canónica continúa siendo de solo lectura.

## Recibo durable R6.3-E

El plan v3 exige `consolidation-merge-transactions-v1.json`. El documento admite hasta cien recibos y como máximo una transacción sin restaurar. Cada recibo contiene únicamente IDs, SHA-256, nombre cerrado del respaldo, fechas y uno de tres estados:

| Estado | Significado recuperable |
|---|---|
| `prepared` | El respaldo y el recibo existen; la sustitución puede no haber ocurrido |
| `projected` | La fuente proyectada pudo quedar activa y debe recuperarse |
| `restored` | La fuente original y la auditoría de recuperación fueron verificadas |

El recibo se escribe y relee mediante reemplazo atómico. Una recuperación nueva no depende de variables en RAM: compara `records.json` contra la huella original y la proyectada del recibo. Si encuentra la proyección, restaura el respaldo; si ya encuentra el original, continúa desde allí. Una tercera huella bloquea sin sobrescribir.

Si la auditoría de recuperación falla después de restaurar, el recibo permanece pendiente. Otro arranque puede reintentar la auditoría y cerrarlo. Una recuperación `restored` es idempotente y no vuelve a auditar.

## Estado y restauración gobernada R6.3-F

El plan de fusión v4 continúa declarando `executionAvailable: false`, pero reconoce que el comando de restauración existe como vía de seguridad independiente.

`consolidation_recovery_status` es una consulta Tauri de sólo lectura. Devuelve un snapshot v1 cerrado con uno de cuatro estados:

| Estado | Condición |
|---|---|
| `idle` | No existe ninguna transacción durable |
| `recoveryRequired` | Hay un recibo `prepared` o `projected` y la fuente coincide con la huella original o proyectada |
| `restored` | El recibo está cerrado y la fuente coincide con los bytes originales |
| `blocked` | El recibo es inválido, falta la fuente o aparece una huella distinta de las dos autorizadas |

El snapshot expone únicamente huellas, estado, nombre del respaldo y fechas. Declara `automaticRecovery: false`, `mergeExecutionAvailable: false`, `recordsModified: false` y `filesCreated: false`.

`restore_consolidation_transaction` es el único comando nuevo con escritura. Requiere `confirmed: true`, ID de transacción y ambas huellas exactas obtenidas del snapshot vigente. La ruta de fuente y respaldo siempre se deriva internamente; el cliente no puede elegir archivos. Una auditoría R3 de solicitud debe persistirse antes de restaurar y la auditoría de éxito debe persistirse antes de cerrar el recibo. Después se releen fuente y recibo. Repetir una restauración cerrada no modifica ni vuelve a auditar.

El comando no crea transacciones, no proyecta recuerdos y no fusiona registros. `prepare_interrupted_consolidation_at` continúa siendo una función interna accesible sólo por pruebas controladas.

## Límites y fronteras

- máximo 1.000 registros por revisión;
- máximo 2.000 pares candidatos;
- cero fusión, archivado, corrección o reescritura de recuerdos;
- cero modelo local o de nube;
- cero cambio de consolidación, importancia o estado;
- fuente corrupta o fuera de presupuesto produce `blocked`;
- fuente ausente produce `unavailable` sin crear directorios;
- registro lateral corrupto bloquea la vista;
- la resolución requiere confirmación, respaldo, auditoría y SHA-256 vigente.
- R6.3-C sólo calcula planes para `exactDuplicate` sin resolución previa;
- una vista R6.3-C declara `recordsModified: false`, `filesCreated: false`, `auditWritten: false` y `modelUsed: false`;
- el hash proyectado describe el resultado hipotético y nunca sustituye la fuente canónica.
- el protocolo R6.3-D debe declarar ocho pasos exactos y todas sus garantías en `true`;
- R6.1 activa establece `activeLayerExecutionBlocked: true`;
- el motor de ensayo no está registrado como comando Tauri.
- R6.3-E exige recibo durable v1 y recuperación independiente de RAM;
- un recibo sólo almacena IDs, huellas, estado, nombre de respaldo y fechas;
- un recibo corrupto o una huella ajena bloquean sin reparar silenciosamente;
- la preparación y la ejecución de fusión continúan desconectadas de IPC;
- R6.3-F registra sólo la consulta de estado y la restauración de una transacción pendiente;
- una restauración exige confirmación, huellas vigentes y auditoría R3 previa al cierre.

La ejecución de la fusión permanece fuera de alcance. R6.3-F completa la vía de seguridad previa, pero no autoriza crear una transacción ni modificar la memoria canónica para fusionar recuerdos.
