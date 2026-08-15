# Informe R6.3-B — Resolución mantener-separados

Fecha: 2026-08-15  
Resultado: aprobado

## Alcance real

Se ejercitó el flujo Rust sobre directorios temporales reales: creación de `records.json`, detección del par, confirmación `keepSeparate`, copia byte a byte de la fuente, escritura y relectura del registro lateral y auditoría JSONL. No se usaron candidatos inyectados en la aplicación ni respuestas de modelos.

La prueba comprobó:

- SHA-256 vigente y dos IDs ordenados obligatorios;
- respaldo idéntico a la fuente;
- `records.json` idéntico antes y después;
- decisión lateral sin intención ni resumen privados;
- auditoría sin texto privado;
- candidato visible como `keepSeparate` al releer;
- repetición idempotente sin cambios de archivo;
- rechazo de SHA obsoleto e ID desconocido sin escritura.
- bloqueo al faltar el respaldo y reversión del registro si falla la auditoría.

## Sondas canónicas

```text
R6_3_CANONICAL records=10 eligible=10 exact=0 review=0 filesIntact=10
R6_3B_CANONICAL rejectedUnknown=true filesIntact=10
```

La memoria canónica no contiene candidatos, por lo que no se fabricó una resolución positiva. La sonda negativa usó el SHA real y verificó que un candidato inexistente fuera rechazado manteniendo los diez archivos intactos.

## Puertas completas

| Comando | Resultado |
|---|---|
| `npm test` | 239/239 aprobadas |
| `npm run build` | aprobado |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| `cargo test` | 175 aprobadas; 12 sondas ambientales ignoradas |
| `cargo build` | aprobado después de cerrar exclusivamente el ejecutable de Alice del workspace |

## Límites vigentes

R6.3-B no fusiona, archiva, elimina, corrige ni cambia consolidación. No usa LLM, red, cámara o micrófono. El proceso de Alice quedó cerrado tras liberar el binario para la compilación final.
