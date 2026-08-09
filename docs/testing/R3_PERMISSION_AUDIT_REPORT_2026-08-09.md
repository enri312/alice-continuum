# Informe de validación — R3 Incremento 2: Gateway correlacionado

Fecha: 2026-08-09  
Resultado: aprobado en pruebas automatizadas y persistencia aislada  
Hardware abierto durante este incremento: ninguno

## Alcance implementado

- Cada solicitud R2 nueva recibe un `operationId` UUID v4 interno.
- Una repetición con la misma `idempotencyKey` reutiliza solicitud y correlación; no crea otra operación.
- Solicitud, autorización, ejecución, detención, revocación, bloqueo y error usan el mismo contexto R3.
- El digest de la previsualización es la única huella asociada; no se persisten propósito, parámetros, identificador de dispositivo, ventana, imagen o audio.
- Cámara, micrófono y observación de ventana se cierran y revocan si el evento de inicio no puede escribirse.
- Detener, revocar o vencer siempre reduce acceso aunque falle la escritura de auditoría; el fallo se informa por `stderr` y nunca se deshace la detención.
- El fin natural de un proceso sensorial y el vencimiento de grants producen eventos `stop` cuando la auditoría está disponible.

## Evidencia ejecutada

La prueba Rust `correlated_permission_flow_persists_without_private_content` escribió tres líneas JSONL reales en una carpeta temporal aislada, volvió a leerlas mediante el mismo parser nativo y comprobó una sola correlación para `request`, `authorization` y `execution`.

La prueba `audit_correlation_is_uuid_v4_stable_across_idempotency_request_and_grant` ejercitó el almacén real en memoria del Gateway: preparación, repetición idempotente, aprobación y consulta del grant conservaron el mismo UUID v4 y digest.

No se abrió cámara ni micrófono porque este incremento modifica telemetría y política de fallo, no los adaptadores ya validados en R2. Las dos sondas vivas continúan ignoradas por defecto y requieren ejecución explícita.

El ejecutable release se abrió con la raíz canónica `ALICE_DATA_DIR=E:\Alice Cognitive Core\data`, se cerró de forma controlada y aumentó el JSONL de 7 a 8 líneas. El último evento volvió a deserializarse como `process.startup / execution / success`.

## Privacidad comprobada

El JSONL aislado fue inspeccionado para confirmar ausencia de las cadenas y campos:

- `message`;
- `purpose`;
- `parameters`;
- `deviceStableId`.

El parser TypeScript ahora exige el conjunto exacto de campos y rechaza propiedades adicionales, incluida una propiedad privada `message`.

## Política ante fallos

| Operación | Si R3 no puede escribir |
|---|---|
| Preparar solicitud | se cancela la solicitud y se devuelve error |
| Aprobar | se revoca el grant y se devuelve error |
| Iniciar ventana/cámara/micrófono | se detiene el adaptador, se revoca el grant y se devuelve error |
| Denegar o cancelar | no se concede acceso y se devuelve el fallo de auditoría |
| Detener, revocar o vencer | se conserva el cierre; nunca se reactiva para intentar auditar |

## Puertas

| Puerta | Resultado |
|---|---|
| Rust normal | 88/88; dos sondas vivas ignoradas por defecto |
| TypeScript | 68/68 |
| JSONL real en carpeta temporal | aprobado |
| Correlación UUID v4 | aprobada |
| Reintento idempotente | una solicitud y un `operationId` |
| Contenido sensorial persistido | ninguno |
| Build web | aprobado |
| Build Tauri | aprobado; ejecutable release generado |
| Arranque release sobre raíz canónica | aprobado; evento real 7 → 8 |

## Siguiente incremento

R3 Incremento 3 incorporará memoria y nube como productores correlacionados sin copiar texto completo, respuestas, claves o parámetros privados.
