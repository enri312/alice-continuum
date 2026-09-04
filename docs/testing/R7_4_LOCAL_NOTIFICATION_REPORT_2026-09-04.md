# Informe R7.4 — notificación local idempotente

Fecha: 2026-09-04

## Alcance comprobado

- Una reserva vencida sólo puede entregarse con confirmación explícita y clave de
  idempotencia coincidente.
- El intento se persiste como `dispatching` antes de tocar el adaptador local.
- La aceptación y el fallo quedan como estados terminales auditados.
- Repetir un resultado terminal devuelve el mismo recibo sin una segunda llamada.
- Una tarea cancelada o retirada entre reserva y entrega no llega al adaptador.
- El ledger no guarda mensajes técnicos del sistema operativo ni títulos de tareas.
- El recibo declara ausencia de red, procesos libres y cambios de estado de la tarea.

## Prueba real del sistema operativo

Se compiló y ejecutó el binario principal de Alice con una ruta diagnóstica temporal
que utilizó el mismo complemento y el mismo adaptador nativo de R7.4. Windows aceptó
una notificación real titulada `Alice · Prueba local R7.4` y el proceso devolvió
`R7_4_NOTIFICATION_ACCEPTED_BY_OS`.

La ruta diagnóstica fue retirada inmediatamente después de la prueba. No se creó ni
modificó el registro canónico de tareas, recuerdos ni perfiles. La aceptación prueba
que el adaptador del sistema operativo recibió la solicitud; no prueba que el usuario
haya visto o leído el aviso.

## Evidencia automatizada

- `cargo test -q --lib`: 246 aprobadas, 0 fallidas, 19 ignoradas.
- Pruebas TypeScript de tareas, capacidades y habilidades: aprobadas.
- `npm run build`: aprobado; permanece sólo el aviso conocido de chunks grandes.
- `cargo clippy --all-targets -- -D warnings`: aprobado.

Las pruebas unitarias usan raíces temporales aisladas e inyectan el adaptador para
verificar éxito, fallo e idempotencia sin inventar datos canónicos.
