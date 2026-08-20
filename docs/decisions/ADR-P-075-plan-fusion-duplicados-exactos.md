# ADR-P-075 — Plan manual de fusión para duplicados exactos

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.3-A detecta candidatos sin escribir y R6.3-B permite decidir que un par permanezca separado. Antes de habilitar una transformación de `records.json`, Alice debe mostrar exactamente qué registro sobreviviría, qué cambiaría y qué mecanismos todavía faltan. Una igualdad normalizada no implica que todos los campos originales sean idénticos.

## Decisión

R6.3-C añade `preview_consolidation_merge` como comando nativo de solo lectura. Sólo acepta candidatos pendientes `exactDuplicate`, exige seleccionar explícitamente un superviviente y vuelve a verificar SHA-256, candidato, par ordenado, existencia de ambos registros e igualdad normalizada.

El plan proyecta el nuevo conteo, SHA-256 y tamaño; enumera diferencias originales; verifica si ya existe un respaldo idéntico; e informa si una revisión R6.1 activa quedaría obsoleta. No crea respaldo, auditoría ni archivos y no altera memoria, índices o estado.

La interfaz permite seleccionar y previsualizar, pero declara la fusión no disponible. Cambiar la selección o releer la fuente descarta el plan anterior.

## Consecuencias

- no se puede planificar un par `reviewRequired`;
- una fuente o candidato obsoleto falla sin efectos;
- la persona ve los metadatos que se perderían antes de cualquier futura decisión;
- la presencia de un respaldo se verifica por contenido, no por nombre solamente;
- una proyección R6.1 activa se señala como futura revisión obsoleta;
- la ejecución queda bloqueada hasta cerrar restauración y auditoría transaccional.
