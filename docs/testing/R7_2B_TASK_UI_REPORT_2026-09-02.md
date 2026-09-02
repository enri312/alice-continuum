# Informe R7.2-B — Interfaz gobernada de tareas

Fecha: 2026-09-02  
Resultado: aprobado

## Alcance validado

R7.2-B integra en Planificador un bloque visual independiente de control del propietario. La interfaz consulta el registro nativo, prepara recordatorios únicos sin escribir, muestra el plan íntegro para revisión, exige confirmación explícita y permite preparar cancelaciones de tareas reales.

No se agregó una pestaña de Memoria ni se presenta el recordatorio como actividad autónoma de Alice. El planificador cognitivo continúa siendo descriptivo; la mutación R7 está identificada como una decisión del propietario.

## Prueba viva de interfaz

La aplicación Tauri se abrió contra `E:\Alice Cognitive Core\data`. Desde la pantalla Planificador se preparó el recordatorio transitorio **“Revisar el Roadmap de Alice”** para el 3 de septiembre de 2026 a las 18:00, hora local.

La vista previa real mostró:

- operación `PROGRAMAR`;
- título y hora local releíbles;
- identidad UUID canónica;
- alcance `NOTIFICACIÓN LOCAL`;
- respaldo `FUENTE NUEVA`;
- ejecución `APAGADA`;
- casilla de revisión sin marcar y confirmación deshabilitada.

No se marcó la casilla ni se confirmó el plan. Después de la prueba, `data/tasks/tasks-v1.json` continuó ausente. Por tanto, la vista previa no fabricó tareas ni alteró datos canónicos.

## Contratos frontend

Los parsers TypeScript usan objetos cerrados para snapshots, tareas, planes y recibos. Rechazan claves adicionales, UUID o SHA-256 no canónicos, fechas no UTC y cualquier respuesta con `automaticExecution` distinto de `false`. La conversión de fecha local a UTC tiene prueba dedicada.

## Límites preservados

- 0 tareas canónicas.
- Sin scheduler ni hilo en segundo plano.
- Sin notificación del sistema operativo.
- Sin red, comandos ni ejecución de capacidades.
- Sin conversión automática desde memoria, conversación o modelos.

## Validación automatizada

| Comprobación | Resultado |
|---|---|
| `npm test` sobre el índice exacto del commit | 42 archivos, 347/347 pruebas aprobadas |
| `npm run build` sobre el índice exacto del commit | aprobado |
| `cargo fmt --all -- --check` | aprobado |
| `cargo test` | 238 aprobadas; 19 sondas vivas ignoradas por diseño |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| `cargo build` | aprobado |

Antes y después de la compuerta, `data/` conservó 35 archivos y el mismo digest agregado `5b2cd3a6925d215db89bef3a0aff171259a3a92dd0613e22329b9c458159086d`. La aplicación de prueba quedó cerrada.

El workspace completo también aprobó 422/422 pruebas TypeScript, pero 75 pertenecen al rediseño visual aún no comprometido. Por ello el badge y la cifra principal de este informe usan 347/347: es la cantidad reproducible desde el índice exacto que se publica con R7.2-B.

R7.2 queda completo. El siguiente incremento será R7.3 y no debe confundirse con una autorización para notificar o ejecutar automáticamente.
