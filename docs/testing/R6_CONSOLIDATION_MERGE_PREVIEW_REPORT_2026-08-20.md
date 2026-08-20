# Informe R6.3-C — Vista previa manual de fusión

Fecha: 2026-08-20  
Resultado: aprobado

## Alcance real

La prueba Rust creó un `records.json` físico en un directorio temporal con dos registros distintos en sus campos originales, pero iguales bajo la normalización cerrada de R6.3. Se eligió cada registro como superviviente y se ejecutó el mismo código que usa el comando Tauri.

Se verificó:

- candidato `exactDuplicate`, SHA-256 vigente y par ordenado;
- rechazo de un superviviente ajeno al par;
- proyección real de dos registros a uno;
- SHA-256 y longitud de bytes de la serialización proyectada;
- diferencias originales de título, fechas y fuente visibles;
- respaldo ausente informado sin crearlo;
- respaldo existente aceptado sólo cuando coincide byte a byte;
- revisión R6.1 activa informada como futura revisión obsoleta;
- archivos idénticos antes y después de cada vista previa;
- cero escritura de memoria, respaldo, auditoría o modelo.

El validador TypeScript aceptó el contrato cerrado y rechazó efectos prohibidos, supervivientes incoherentes, diferencias repetidas e impacto R6.1 contradictorio.

## Sonda canónica real

```text
R6_3_CANONICAL records=17 eligible=17 exact=0 review=0 filesIntact=20
CANONICAL_FILES_BEFORE=20
CANONICAL_FILES_AFTER=20
CANONICAL_HASH_CHANGES=0
```

La memoria canónica no contiene duplicados exactos ni pares de revisión. Alice devolvió cero candidatos y no fabricó un plan. Los veinte archivos conservaron sus huellas SHA-256.

## Puertas completas

| Comando | Resultado |
|---|---|
| `npx vitest run src/core/memory-consolidation-preview.test.ts` | 6/6 aprobadas |
| `npm test` | 282/282 aprobadas |
| `npm run build` | aprobado; advertencia informativa por tamaño de chunks |
| `cargo test r6_3_c_merge_preview_requires_exact_pair_and_never_writes` | 1/1 aprobada |
| `cargo test` | 185 aprobadas; 14 sondas ambientales ignoradas |
| `cargo clippy --all-targets -- -D warnings` | aprobado |

## Límite vigente

R6.3-C no fusiona ni elimina recuerdos. Tampoco crea el respaldo que necesitaría una futura ejecución. El próximo incremento deberá cerrar restauración y auditoría transaccional antes de permitir cualquier modificación canónica.
