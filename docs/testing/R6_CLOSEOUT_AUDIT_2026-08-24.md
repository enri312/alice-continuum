# Auditoría de cierre R6 — Memoria por capas y consolidación v2

Fecha: 2026-08-24  
Resultado: implementación R6.6-A aprobada; aceptación canónica pendiente de nueve revisiones del propietario

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

## Remediación R6.6-A

La auditoría inicial detectó que el único registro sin capa ya declaraba `memoryType=procedural`, fuente y vigencia. R6.6-A no lo relabeló: creó el contrato paralelo `layer-index-v3.json`, donde conserva la capa `procedural` y `linkState=pendingR5`. Ese estado no crea una habilidad ni permite ejecución.

La nueva sonda canónica fue exclusivamente de sólo lectura:

```text
R6_CANONICAL records=20 working=0 episodic=19 taughtFacts=0 procedural=1 proceduralPendingR5=1 unclassified=0 filesIntact=21
CANONICAL_FILES_BEFORE=21
CANONICAL_FILES_AFTER=21
CANONICAL_HASH_DELTA=0
V3_CREATED=False
```

El índice v2 activo no fue reescrito. La interfaz permite revisar v3 y activarlo posteriormente sobre la huella final. Para los nueve recuerdos sin procedencia, la misma operación gobernada de vigencia exige ahora una declaración de procedencia; crea respaldo exacto, reemplaza atómicamente y audita. No puede cambiar una procedencia existente.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Cada recuerdo tiene capa, origen, estado y reglas de vigencia | Pendiente | v3 proyecta las 20 capas; 9 recuerdos aún requieren procedencia explícita y evaluación de vigencia |
| Los conflictos no se resuelven silenciosamente | Aprobado | Contratos `keepSeparate`, revisión y estados explícitos |
| La consolidación ofrece vista previa y respaldo | Aprobado | Vista previa, respaldo exacto, recibo durable y restauración gobernada |
| La memoria de trabajo puede descartarse sin borrar memoria duradera | Aprobado | RAM nativa separada y borrado por generación |
| Los índices derivados pueden reconstruirse desde la fuente de verdad | Aprobado | Proyecciones R6.1 y R6.5 releídas desde `records.json` |

El criterio pendiente afecta nueve recuerdos y exige dieciocho decisiones humanas: declarar nueve procedencias y confirmar o marcar en conflicto esos mismos nueve recuerdos `notAssessed`. Después deberá activarse la proyección v3 sobre la huella resultante. No se completan automáticamente porque hacerlo fabricaría conocimiento sobre datos personales reales.

## Puerta completa de calidad

| Comando | Resultado |
|---|---|
| `npx vitest run src/core/icon-system.test.ts` | 96/96 aprobadas |
| `npm test` | 335/335 aprobadas en 40 archivos |
| `npm run build` | Aprobado; sólo advertencias conocidas por chunks mayores a 500 kB |
| `cargo fmt --check` | Aprobado |
| `cargo test` | 228 aprobadas, 18 ignoradas, 0 fallidas |
| `cargo clippy --all-targets --all-features -- -D warnings` | Aprobado |
| `cargo build` | Aprobado |

Las 18 pruebas ignoradas requieren autorización o condiciones externas concretas —datos canónicos, hardware, escritorio interactivo, runtime facial u Ollama— y no se sustituyeron con resultados ficticios. Las dos sondas canónicas necesarias para esta auditoría sí fueron activadas explícitamente y pasaron.

## Decisión de fase

La arquitectura y los contratos de R6.1–R6.6-A quedan técnicamente validados. R6 permanece abierta únicamente por el primer criterio de aceptación. No se inicia R7. El propietario debe revisar los nueve recuerdos desde **Memoria → Ciclo** y, al terminar, revisar y activar v3 desde **Memoria → Capas R6**.
