# Informe R6.3-D — Ensayo de recuperación de consolidación

Fecha: 2026-08-20  
Resultado: aprobado

## Ensayo físico controlado

La prueba creó un `records.json` real con dos duplicados normalizados, seleccionó un superviviente mediante el contrato R6.3-C y ejecutó el motor R6.3-D sobre ese directorio temporal.

Se comprobó el recorrido completo:

- respaldo creado e idéntico a la fuente;
- temporal exclusivo escrito y sincronizado;
- reemplazo real mediante `MoveFileExW`;
- SHA-256 proyectado verificado;
- evento R3 físico con razón `MEMORY_CONSOLIDATION_RECOVERY_REHEARSED`;
- restauración inmediata de los bytes originales;
- SHA-256 restaurado igual al inicial;
- temporal eliminado por el reemplazo.

Luego se indujo un fallo real en el punto de auditoría. El motor devolvió error y restauró byte a byte `records.json`; todas las huellas del directorio quedaron iguales a las medidas antes de la tentativa. Finalmente se activó una revisión R6.1 controlada: el ensayo quedó bloqueado antes de llamar a auditoría y sin alterar archivos.

## Sonda canónica

El motor de ensayo no es un comando Tauri y nunca se ejecutó sobre datos canónicos. La única sonda canónica fue la lectura R6.3:

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
| `cargo test r6_3_d_rehearsal_restores_real_bytes_and_blocks_active_layers` | 1/1 aprobada |
| `cargo test` | 186 aprobadas; 14 sondas ambientales ignoradas |
| `cargo clippy --all-targets -- -D warnings` | aprobado |

## Límite vigente

No existe ejecución canónica. El siguiente incremento deberá persistir un recibo transaccional con estados cerrados y demostrar recuperación después de reiniciar antes de considerar un botón de fusión.
