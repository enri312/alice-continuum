# Informe R7.3-B — reservas durables de despacho

Fecha: 2026-09-02

## Alcance comprobado

- Un recordatorio local vencido puede recibir una reserva sólo tras confirmación explícita.
- La reserva relee `taskId`, fecha programada, estado y revisión antes de escribir.
- `attempt-ledger-v1.json` usa esquema cerrado, límite de tamaño, UUID y clave SHA-256 determinista de tarea + fecha.
- Repetir la misma ocurrencia devuelve el mismo `attemptId` sin una segunda escritura ni auditoría.
- La reserva no modifica `tasks-v1.json`, no notifica, no invoca red, no cambia el estado de la tarea y no ejecuta capacidades.
- Casos de tarea futura o confirmación ausente se rechazan antes de crear el ledger.

## Evidencia de ejecución

- `cargo test -q --lib`: 243 aprobadas, 0 fallidas, 19 ignoradas.
- `npm run test -- --run src/core/governance/tasks.test.ts src/pages/cognitive/ActionPlannerPage.test.tsx`: 7 aprobadas, 0 fallidas.
- `npm run build`: compilación TypeScript y Vite aprobada; permanece el aviso preexistente de chunks grandes.
- `cargo clippy --all-targets -- -D warnings`: aprobado.

Las pruebas usan una raíz temporal aislada con un registro R7 válido. El registro canónico no fue creado ni modificado porque aún no hay una tarea real confirmada por el propietario.
