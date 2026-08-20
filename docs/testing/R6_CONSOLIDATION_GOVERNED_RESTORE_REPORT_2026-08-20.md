# Informe R6.3-F — Estado nativo y restauración gobernada

Fecha: 2026-08-20  
Resultado: aprobado

## Prueba física controlada

`r6_3_f_exposes_native_status_and_governed_restore_without_merge_command` creó dos recuerdos duplicados en un directorio temporal real, persistió un respaldo y un recibo `projected`, y reemplazó físicamente `records.json` con la proyección.

La prueba verificó:

- snapshot `recoveryRequired` ligado al recibo y a la huella proyectada;
- rechazo de una huella esperada obsoleta antes de auditar;
- fallo de auditoría de solicitud sin cambiar los bytes proyectados;
- restauración posterior de los bytes originales con eventos de solicitud y éxito;
- estado final `restored` sin disponibilidad de una segunda restauración;
- repetición idempotente sin doble auditoría;
- bloqueo de un recibo corrupto sin modificar la fuente;
- ausencia total de un comando que cree o ejecute fusiones.

## Sondas canónicas de sólo lectura

Se ejecutaron contra `E:\Alice Cognitive Core\data`. Los motores de preparación y fusión no se invocaron.

```text
R6_3F_CANONICAL state=Idle transactions=0 receiptExists=false restorationAvailable=false filesIntact=20
R6_3_CANONICAL records=17 eligible=17 exact=0 review=0 filesIntact=20
```

El resultado `idle` significa que Alice no tiene una consolidación interrumpida. Las huellas agregadas antes y después de cada sonda coincidieron.

## Validación ejecutada

| Comando | Resultado |
|---|---|
| `npx vitest run src/core/memory-consolidation-preview.test.ts src/core/icon-system.test.ts` | 104/104 aprobadas |
| `npm test` | 284/284 aprobadas |
| `npm run build` | aprobado; advertencia informativa por tamaño de chunks |
| `cargo test r6_3_f_exposes_native_status_and_governed_restore_without_merge_command` | 1/1 aprobada |
| `cargo test r6_3_` | 10 aprobadas; 2 sondas ignoradas por defecto |
| `cargo test` | 188 aprobadas; 15 sondas ambientales ignoradas |
| `cargo clippy --all-targets -- -D warnings` | aprobado |

## Límite vigente

R6.3-F puede consultar y restaurar una transacción durable que ya exista. No puede crearla ni ejecutar una fusión. Cualquier incremento que modifique canónicamente recuerdos requiere una decisión nueva y pruebas separadas.
