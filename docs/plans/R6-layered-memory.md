# Plan de implementación R6 — Memoria por capas y consolidación v2

Estado: en curso · R6.1 validado y motor R6.2-A integrado  
Fecha: 2026-08-14

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

Estado: primer incremento implementado; control visual de vaciado pendiente.

El backend mantiene en RAM hasta tres intercambios reales de conversación —seis mensajes y 48.000 caracteres— durante 30 minutos desde la última respuesta. Sólo se registra un intercambio después de recibir una respuesta real del proveedor. El contenido no se escribe en archivos, expira con tiempo real, se descarta al cerrar el proceso y nunca altera `records.json` ni `layer-index-v2.json`.

- [x] Contenedor nativo, efímero y acotado.
- [x] Procedencia de proveedor y modelo por intercambio.
- [x] Expiración, desalojo de intercambios completos y rechazo de sobrepresupuesto.
- [x] Auditoría R3 sólo con SHA-256, sin texto conversacional.
- [x] Conversación real integrada dentro de `[00] CONVERSATION / PERCEPTION INPUT`.
- [x] Consulta defensiva desde React cada cinco segundos.
- [ ] Indicador y vaciado confirmado dentro de Memoria.
- [ ] Presupuesto explícito de cada fragmento opcional antes del envío.

La eliminación de la antigua pestaña independiente Conversación evita duplicar el panel `[00]`. La pantalla Memoria permanece porque administra recuerdos duraderos y, en el siguiente microincremento, también mostrará el estado del contenedor efímero sin mezclarlos.

## R6.3 — Consolidación manual

Estado: pendiente.

Detectará duplicados, contradicciones y vigencia como candidatos. No resolverá conflictos o promoverá recuerdos automáticamente. Cada aplicación tendrá vista previa, respaldo y auditoría.

## Fuente futura gobernada — proyectos locales

Alice podrá estudiar carpetas de proyectos elegidas explícitamente por Carlos Nuñez después de definir una capacidad R1 y un grant R2 de solo lectura. El primer alcance leerá estructura, documentación y metadatos; excluirá secretos, `.git`, dependencias, builds, binarios y archivos grandes. Sus resultados serán observaciones efímeras y candidatos revisables, no recuerdos automáticos ni ejecución de código.

Este explorador no forma parte de R6.1 y no autoriza acceso general a discos.
