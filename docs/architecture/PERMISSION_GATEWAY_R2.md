# Contrato del Gateway de permisos R2

Estado: definido para implementación incremental  
Versión del contrato: 1  
Fecha: 2026-08-09  
Propietario: Carlos Nuñez

## Objetivo

Convertir el Registro de Capacidades R1 en una frontera nativa que deniegue por defecto, prepare una previsualización inmutable y permita a Carlos Nuñez aprobar, rechazar, cancelar o revocar un uso concreto.

R2 gobierna permisos. No convierte al modelo en ejecutor, no instala herramientas y no concede acceso general a Windows.

## Modelo de confianza

| Parte | Confianza y límite |
|---|---|
| Carlos Nuñez | Única autoridad humana que puede decidir una solicitud en la versión personal |
| React | Presenta la previsualización y transmite la decisión; no crea permisos ni modifica el plan preparado |
| Rust / Tauri | Fuente de verdad para solicitudes, decisiones, vencimiento, revocación e idempotencia |
| Adaptador de capacidad | Valida parámetros y prepara una descripción segura antes de solicitar permiso |
| Modelo de IA | Contenido no confiable; puede sugerir un propósito, pero no aprobar ni poseer un grant |
| Windows | Puede imponer permisos adicionales de cámara, micrófono, archivos o procesos; un permiso de Alice no lo sustituye |

## Principios obligatorios

1. **Denegar por defecto:** ausencia, error, vencimiento o inconsistencia equivalen a rechazo.
2. **Preparar antes de decidir:** el adaptador valida y congela los parámetros en Rust antes de mostrar la solicitud.
3. **No reenviar parámetros al ejecutar:** una ejecución usa exclusivamente el plan retenido por el backend.
4. **Permiso específico:** cada decisión queda ligada a capacidad, versión, operación, recurso, datos, efectos y propósito.
5. **Duración limitada:** no existen permisos permanentes ni la opción “recordar para siempre”.
6. **Revocación efectiva:** detener o revocar invalida el grant y cualquier lease de sesión.
7. **Idempotencia:** repetir la misma solicitud no crea múltiples permisos ni ejecuciones.
8. **Preservar límites del sistema operativo:** Alice nunca elude controles de Windows.
9. **Sin métricas inventadas:** la interfaz solo muestra solicitudes y grants que existan en el almacén nativo.

## Separación de objetos

### Solicitud preparada

Representa un plan validado todavía no autorizado. El backend conserva de forma privada los parámetros ejecutables; React recibe únicamente una previsualización segura y la huella del plan congelado, nunca sus parámetros privados.

```json
{
  "schemaVersion": 1,
  "requestId": "opaque-random-id",
  "idempotencyKey": "caller-stable-key",
  "capabilityId": "perception.camera.observe",
  "capabilityVersion": 1,
  "operation": "observeAuthorizedCamera",
  "mode": "session",
  "purpose": "Analizar gestos durante esta sesión",
  "resource": {
    "kind": "camera",
    "stableId": "device-fingerprint",
    "label": "ACER HD User Facing"
  },
  "dataScopes": ["cameraFrames"],
  "effects": ["cameraObserve"],
  "risk": "high",
  "createdAt": "2026-08-09T14:00:00Z",
  "decisionExpiresAt": "2026-08-09T14:01:00Z",
  "requestedDurationSeconds": 120,
  "maximumDurationSeconds": 300,
  "executionPlanDigest": "sha256:...",
  "previewDigest": "sha256:...",
  "state": "awaitingDecision",
  "summary": "Alice solicita observar la cámara durante un máximo de 2 minutos.",
  "warnings": ["La luz de la cámara puede encenderse."]
}
```

`executionPlanDigest` prueba que los parámetros retenidos siguen intactos. `previewDigest` cubre toda la previsualización, incluida esa huella. Ninguno de los dos permite reconstruir el plan privado.

### Decisión

La interfaz solo envía:

```json
{
  "requestId": "opaque-random-id",
  "previewDigest": "sha256:...",
  "decision": "approve"
}
```

Rust asigna `decidedAt` y rechaza una decisión si la solicitud no está pendiente, venció o el digest no coincide. Las decisiones posibles son `approve` y `deny`; cerrar el diálogo produce `cancelled`, nunca aprobación implícita.

### Grant

Un grant es una autorización nativa opaca. No contiene parámetros modificables y no es una credencial persistente.

```json
{
  "schemaVersion": 1,
  "grantId": "opaque-random-id",
  "requestId": "opaque-random-id",
  "previewDigest": "sha256:...",
  "capabilityId": "perception.camera.observe",
  "operation": "observeAuthorizedCamera",
  "mode": "session",
  "issuedAt": "2026-08-09T14:00:15Z",
  "expiresAt": "2026-08-09T14:02:15Z",
  "remainingUses": null,
  "state": "approved"
}
```

`remainingUses` vale `1` para `oneShot` y `null` para una sesión limitada por tiempo. Reiniciar o cerrar Alice elimina todos los grants.

## Modos admitidos

| Modo | Uso | Regla |
|---|---|---|
| `implicitRead` | Sondas pasivas no sensibles ya descritas por R1 | No crea grant; solo para capacidades aprobadas explícitamente en la política |
| `oneShot` | Una mutación, exportación, envío o lanzamiento concreto | Se consume una vez, incluso si la operación termina con error |
| `session` | Observación continua de una fuente seleccionada | Requiere indicador visible, vencimiento y control Detener |

No se admite automatización persistente en R2.

## Estados y transiciones

```text
awaitingDecision ──approve──> approved ──consume──> consuming ──> completed
       │                         │                       └──────> error
       │                         └──start session──> active ───> stopped
       ├──deny──────────────> denied                    ├──────> revoked
       ├──close/cancel──────> cancelled                 └──────> expired
       └──timeout───────────> expired
```

Una transición no listada se rechaza. `denied`, `cancelled`, `completed`, `stopped`, `revoked`, `expired` y `error` son terminales.

## Idempotencia

- El llamador aporta `idempotencyKey`; Rust la combina con capacidad, operación y digest del plan.
- Repetir la misma clave y el mismo plan devuelve la solicitud existente.
- Repetir la clave con parámetros diferentes produce conflicto y no reemplaza nada.
- Un grant `oneShot` consumido no puede reutilizarse aunque la interfaz repita la invocación.
- Cada adaptador recibe un `grantId` ya validado y nunca decide permisos por su cuenta.

## Vencimiento y límites iniciales

| Elemento | Límite R2 |
|---|---|
| Espera de decisión para riesgo alto | 60 segundos |
| Espera de decisión para riesgo medio o menor | 5 minutos |
| Sesión inicial de cámara o micrófono | máximo 5 minutos |
| Cantidad de cámara activa | una |
| Cantidad de micrófono activo | uno |
| Persistencia después de cerrar Alice | ninguna |

El usuario puede solicitar menos tiempo, nunca ampliar el máximo desde React.

## Reglas para cámara y micrófono

- La comprobación física de hardware no equivale a un permiso de ejecución.
- La fuente exacta debe figurar en la previsualización.
- Cámara y micrófono requieren `session`, riesgo `high` e indicador persistente mientras estén activos.
- Debe existir un control visible **Detener** que funcione sin depender del modelo.
- Cerrar Alice, revocar, vencer o perder el dispositivo detiene la sesión y descarta el búfer.
- Los fotogramas y muestras crudas son efímeros; persistirlos requiere otra capacidad y otra aprobación futura.
- El permiso de cámara no concede micrófono, y viceversa.
- Fish Audio es una salida de voz futura independiente; no forma parte del permiso de entrada del micrófono.

## Comandos nativos previstos

| Comando | Estado actual | Efecto permitido en R2 |
|---|---|---|
| `permission_gateway_status` | Expuesto | Consulta solicitudes, grants y límites sin exponer parámetros privados |
| `prepare_permission_request` | Expuesto | Prepara solo `context.foreground.control`; no concede ni ejecuta |
| `decide_permission_request` | Expuesto | Aprueba o rechaza una previsualización vigente; aprobar solo crea un grant efímero |
| `cancel_permission_request` | Expuesto | Cancela una solicitud pendiente sin crear un grant |
| `revoke_permission_grant` | Expuesto | Invalida un grant antes de su futura ejecución |

La presencia en esta tabla no autoriza ejecución. Los cinco comandos marcados **Expuesto** están registrados; el estado nativo publica `r2DecisionCommandsExposed: true` y `r2ExecutionCommandsExposed: false`. Ningún comando permite consumir un grant, iniciar una sesión o acceder a dispositivos. El control de observación anterior continúa expuesto fuera del Gateway hasta su migración obligatoria en el paso 5, por lo que R1 todavía declara `enforcedBy: currentUi`.

## Migración de capacidades existentes

La migración será individual. Una capacidad no puede declarar `permission.enforcedBy: native` hasta que el comando protegido rechace invocaciones sin grant.

Orden propuesto:

1. `context.foreground.control`, porque es local, reversible y ya tiene estado real.
2. exportación, restauración y apertura de la carpeta de memoria.
3. envío de conversación de nube.
4. escrituras de memoria.
5. futuras sesiones de cámara y micrófono.

Las lecturas pasivas de registro, estado de proveedores, salud de memoria y disponibilidad del avatar pueden permanecer `implicitRead`.

## Persistencia y auditoría

R2 mantiene solicitudes y grants solamente en memoria. Un reinicio los revoca por diseño. R3 añadirá auditoría persistente de metadatos; hasta entonces R2 no guarda señal sensorial, parámetros privados ni decisiones en archivos nuevos.

## Criterios de validación

- Los IDs son aleatorios, opacos y no predecibles.
- El digest cubre todos los campos que afectan la ejecución.
- Cambiar un campo después de preparar invalida la decisión.
- Cerrar, rechazar o dejar vencer nunca ejecuta.
- Revocar una sesión detiene el lease antes de responder éxito.
- Reloj, expiración y duplicados se validan en Rust.
- Las pruebas de integración usan los comandos y archivos reales de Alice; la interfaz no fabrica solicitudes o actividad.
- Las pruebas con cámara y micrófono usan el hardware real autorizado, no archivos pregrabados presentados como señal viva.

## Fuera de alcance

- permisos permanentes;
- ejecución de PowerShell o shell genérico;
- elevación administrativa;
- control de teclado global;
- captura silenciosa o al iniciar Windows;
- almacenamiento automático de audio, video o pantalla;
- Fish Audio, TTS, clonación de voz o sincronización labial;
- auditoría unificada persistente, que corresponde a R3.
