# Informe R7.3-A — Sentido temporal observable

Fecha: 2026-09-02  
Resultado: aprobado

## Alcance validado

R7.3-A agrega una proyección temporal de solo lectura. Clasifica tareas programadas futuras como `waiting`, fechas alcanzadas como `due` y estados pausado, completado o cancelado como `excluded`. No existe transición de estado, intento, notificación o ejecutor.

El reloj de fondo comienza apagado, se activa y detiene desde Planificador y conserva el pulso únicamente en RAM. Reiniciar Alice vuelve a dejarlo apagado.

## Prueba viva aislada

La aplicación Tauri real se abrió con una raíz temporal dedicada y el registro de tareas ausente. En Planificador:

1. el motor apareció `APAGADO`, con todos los conteos en cero;
2. **ACTIVAR RELOJ INTERNO** inició pulsos reales visibles;
3. **DETENER EVALUACIÓN** detuvo el motor;
4. la huella agregada de la raíz fue idéntica antes y después de activar, pulsar y detener;
5. `tasks/tasks-v1.json` permaneció ausente.

La captura de evidencia local es `artifacts/r7-3a-live-temporal-engine.png`. No se creó ninguna tarea ficticia.

## Contratos y pruebas

- Rust rechaza esquemas desconocidos y conserva el registro byte a byte.
- TypeScript rechaza cualquier snapshot que habilite ejecución, notificación o escritura.
- La capacidad R1 `tasks.temporal.evaluate` amplía el inventario real a 29 capacidades.
- La interfaz sondea el backend una vez por segundo sólo mientras el propietario mantiene el reloj activo.

| Comprobación | Resultado |
|---|---|
| `npm test` sobre el árbol publicado previsto | 42 archivos, 348/348 pruebas aprobadas |
| `npm test` sobre el workspace completo | 42 archivos, 423/423 pruebas aprobadas |
| `npm run build` | aprobado; sólo advertencia conocida por chunks grandes |
| `cargo fmt --all -- --check` | aprobado |
| `cargo test` | 241 aprobadas; 19 sondas vivas ignoradas por diseño |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| prueba viva de activación y detención | aprobada, cero escrituras |

R7.3-A queda cerrado. R7.3-B deberá crear primero un ledger durable de intentos e idempotencia; todavía no autoriza notificaciones.
