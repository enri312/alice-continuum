# Plan de implementación R6 — Memoria por capas y consolidación v2

Estado: en curso · R6.1 implementado y validado  
Fecha: 2026-08-13

## R6.1 — Proyección inicial y migración reversible

Objetivo: separar memoria de trabajo, episodios y hechos enseñados sin reescribir los registros v1 ni inferir significado mediante un modelo.

- [x] Contrato cerrado de capas, estados y revisiones.
- [x] Vista previa nativa y defensiva sin escritura.
- [x] Clasificación determinista por campos explícitos.
- [x] Activación ligada al SHA-256 exacto revisado.
- [x] Revisiones inmutables en un índice sin contenido privado.
- [x] Reversión que desactiva sin borrar datos o historial.
- [x] Interfaz visible dentro de Memoria.
- [x] Pruebas físicas temporales de activación, cambio de fuente, bloqueo y reversión.
- [x] Sonda canónica de solo lectura con verificación SHA-256.

La fuente vigente continúa siendo `records.json`. R6.1 produce `layer-index-v2.json` sólo después de una confirmación humana. La memoria de trabajo permanece vacía y no persistente. Procedimientos y preferencias quedan sin clasificar hasta que sus capas tengan un contrato propio.

## R6.2 — Memoria de trabajo de sesión

Estado: pendiente.

Deberá definir un contenedor efímero descartable, presupuesto de contexto, procedencia y vista previa de todo fragmento que pudiera salir a un proveedor. Cerrar Alice o elegir descartar no eliminará memoria duradera.

## R6.3 — Consolidación manual

Estado: pendiente.

Detectará duplicados, contradicciones y vigencia como candidatos. No resolverá conflictos o promoverá recuerdos automáticamente. Cada aplicación tendrá vista previa, respaldo y auditoría.

## Fuente futura gobernada — proyectos locales

Alice podrá estudiar carpetas de proyectos elegidas explícitamente por Carlos Nuñez después de definir una capacidad R1 y un grant R2 de solo lectura. El primer alcance leerá estructura, documentación y metadatos; excluirá secretos, `.git`, dependencias, builds, binarios y archivos grandes. Sus resultados serán observaciones efímeras y candidatos revisables, no recuerdos automáticos ni ejecución de código.

Este explorador no forma parte de R6.1 y no autoriza acceso general a discos.
