# ADR-P-077 — Recibo durable para recuperación después de reiniciar

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.3-D demuestra restauración dentro de una misma ejecución. Una caída del proceso elimina la RAM y exige que el siguiente arranque pueda determinar, usando sólo archivos, si la fuente quedó original, proyectada o en un estado desconocido.

## Decisión

R6.3-E introduce `consolidation-merge-transactions-v1.json` con estados `prepared`, `projected` y `restored`. Cada recibo conserva IDs, huellas, nombre del respaldo y fechas; no almacena intención, resumen ni próximo paso. Se permite una sola transacción activa.

El recibo se persiste atómicamente antes de sustituir `records.json` y se actualiza después. La recuperación relee recibo, fuente y respaldo desde disco sin aceptar estado en RAM. Una fuente proyectada se restaura; una fuente ya original permite reintentar la auditoría; cualquier otra huella bloquea. Sólo después de auditar se marca `restored`.

Preparación y recuperación permanecen como funciones internas no registradas en Tauri.

## Consecuencias

- una caída entre recibo y sustitución es recuperable;
- una caída después de la sustitución es recuperable;
- un fallo de auditoría puede reintentarse sin volver a modificar la fuente;
- una recuperación terminada es idempotente;
- un recibo corrupto no provoca reparación automática;
- todavía no existe ejecución o restauración accesible desde la interfaz.
