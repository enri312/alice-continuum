# Auditoría de cierre R6 — Memoria por capas y consolidación v2

Fecha: 2026-08-24  
Resultado: implementación técnica aprobada; aceptación canónica pendiente

## Alcance

Esta auditoría verifica la implementación acumulada R6.1–R6.5-J y mide el estado real de la memoria canónica. No clasifica recuerdos, no confirma su vigencia, no crea fusiones y no escribe decisiones en nombre del propietario.

## Estado canónico real

Las sondas ignoradas se ejecutaron explícitamente con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`. Antes y después se calcularon las huellas SHA-256 de todos los archivos bajo `data/`.

| Comprobación | Resultado |
|---|---|
| Archivos canónicos antes | 21 |
| Archivos canónicos después | 21 |
| Diferencias SHA-256 | 0 |
| Recuerdos reales | 20 |
| Capas | 19 `episodic`, 1 `unclassified` |
| Procedencia explícita | 11 presente, 9 ausente |
| Vigencia | 11 `current`, 9 `notAssessed` |
| Conflictos explícitos | 0 |
| Archivo reversible | 0 |
| Eliminaciones programadas | 0 |
| Accesibilidad evaluada | 0 |
| Supresiones | 0 |
| Reconsolidaciones | 0 |

Salidas verificadas:

```text
R6_CANONICAL records=20 working=0 episodic=19 taughtFacts=0 unclassified=1 filesIntact=21
R6_5_LIFECYCLE_CANONICAL records=20 current=11 conflict=0 archived=0 retention=0 notAssessed=9 accessible=0 dormant=0 suppressed=0 reconsolidated=0 outcomes=0 assessed=0 reviewRequired=0 filesIntact=21
CANONICAL_FILES_BEFORE=21
CANONICAL_FILES_AFTER=21
CANONICAL_HASH_DELTA=0
```

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Cada recuerdo tiene capa, origen, estado y reglas de vigencia | Pendiente | 1 recuerdo sin capa; 9 sin procedencia explícita y sin evaluación de vigencia |
| Los conflictos no se resuelven silenciosamente | Aprobado | Contratos `keepSeparate`, revisión y estados explícitos |
| La consolidación ofrece vista previa y respaldo | Aprobado | Vista previa, respaldo exacto, recibo durable y restauración gobernada |
| La memoria de trabajo puede descartarse sin borrar memoria duradera | Aprobado | RAM nativa separada y borrado por generación |
| Los índices derivados pueden reconstruirse desde la fuente de verdad | Aprobado | Proyecciones R6.1 y R6.5 releídas desde `records.json` |

El criterio pendiente afecta diez recuerdos y exige diecinueve decisiones de campo: asignar la capa del recuerdo `unclassified`, declarar la procedencia de nueve recuerdos y confirmar o marcar en conflicto esos mismos nueve recuerdos `notAssessed`. El recuerdo sin capa es distinto de los nueve sin procedencia y vigencia. No se completan automáticamente porque hacerlo fabricaría conocimiento sobre datos personales reales.

## Puerta completa de calidad

| Comando | Resultado |
|---|---|
| `npx vitest run src/core/icon-system.test.ts` | 96/96 aprobadas |
| `npm test` | 335/335 aprobadas en 40 archivos |
| `npm run build` | Aprobado; sólo advertencias conocidas por chunks mayores a 500 kB |
| `cargo fmt --check` | Aprobado |
| `cargo test` | 227 aprobadas, 18 ignoradas, 0 fallidas |
| `cargo clippy --all-targets --all-features -- -D warnings` | Aprobado |
| `cargo build` | Aprobado |

Las 18 pruebas ignoradas requieren autorización o condiciones externas concretas —datos canónicos, hardware, escritorio interactivo, runtime facial u Ollama— y no se sustituyeron con resultados ficticios. Las dos sondas canónicas necesarias para esta auditoría sí fueron activadas explícitamente y pasaron.

## Decisión de fase

La arquitectura y los contratos de R6.1–R6.5-J quedan técnicamente validados. R6 permanece abierta únicamente por el primer criterio de aceptación. No se inicia R7 ni se altera la memoria canónica hasta que el propietario revise los diez recuerdos afectados desde las superficies gobernadas de Memoria.
