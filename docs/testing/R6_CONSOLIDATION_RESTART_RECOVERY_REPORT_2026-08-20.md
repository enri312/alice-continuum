# Informe R6.3-E — Recuperación durable después de reinicio

Fecha: 2026-08-20  
Resultado: aprobado

## Prueba física

La prueba creó dos duplicados normalizados en un `records.json` físico y preparó una interrupción controlada. El proceso interno dejó:

- respaldo verificado y sincronizado;
- recibo durable en estado `projected`;
- fuente proyectada con SHA-256 distinto del original;
- cero contenido privado dentro del recibo.

La recuperación se llamó después únicamente con el directorio y el ID del recibo, sin reutilizar el plan ni las sesiones en RAM.

Primero se indujo un fallo de auditoría. La fuente volvió a sus bytes originales y el recibo permaneció `projected` para permitir un reintento. La segunda llamada escribió un evento R3 real, cambió el recibo a `restored` y conservó la fuente original. Una tercera llamada resultó idempotente y no volvió a auditar. Finalmente, un recibo corrupto fue rechazado sin modificar `records.json`.

## Sonda canónica

Los motores R6.3-D/E no son comandos Tauri y no se ejecutaron sobre datos canónicos.

```text
R6_3_CANONICAL records=17 eligible=17 exact=0 review=0 filesIntact=20
CANONICAL_FILES_BEFORE=20
CANONICAL_FILES_AFTER=20
CANONICAL_HASH_CHANGES=0
```

## Puertas completas

| Comando | Resultado |
|---|---|
| `npx vitest run src/core/memory/memory-consolidation-preview.test.ts` | 6/6 aprobadas |
| `npm test` | 282/282 aprobadas |
| `npm run build` | aprobado; advertencia informativa por tamaño de chunks |
| `cargo test r6_3_e_durable_receipt_recovers_after_restart_and_retries_audit` | 1/1 aprobada |
| `cargo test` | 187 aprobadas; 14 sondas ambientales ignoradas |
| `cargo clippy --all-targets -- -D warnings` | aprobado |

## Límite vigente

El recibo y la recuperación continúan inaccesibles desde IPC. El siguiente incremento debe exponer primero una consulta nativa de estado y una restauración gobernada; no un botón de fusión.
