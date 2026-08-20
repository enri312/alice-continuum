# ADR-P-076 — Ensayo físico de recuperación antes de fusionar memoria

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.3-C permite revisar una fusión hipotética, pero una copia de respaldo por sí sola no demuestra que Alice pueda recuperarse de una escritura o auditoría fallida. Habilitar la acción sobre la memoria privada antes de probar la restauración sería un riesgo innecesario.

## Decisión

R6.3-D define ocho pasos obligatorios y un motor Rust de ensayo que no se registra como comando Tauri. El motor trabaja únicamente cuando el llamador interno le entrega un directorio controlado y un punto de auditoría.

La sustitución usa un temporal creado de forma exclusiva en el mismo directorio, `sync_all` y `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH`. Después de verificar el resultado proyectado, el ensayo restaura siempre el respaldo y vuelve a comparar contenido y SHA-256. Si la auditoría falla, la restauración sigue siendo obligatoria. Una revisión R6.1 activa bloquea antes de escribir.

El contrato visible informa el protocolo, pero mantiene `executionAvailable: false` y `restorationCommandAvailable: false`.

## Consecuencias

- existe evidencia física de reemplazo y restauración byte a byte;
- un fallo de auditoría no deja la fuente proyectada activa;
- un temporal previo bloquea en vez de sobrescribirse;
- el respaldo permanece disponible después del ensayo;
- el código de riesgo no es accesible desde React o IPC;
- aún falta un recibo transaccional durable para recuperar una operación después de reiniciar la aplicación.
