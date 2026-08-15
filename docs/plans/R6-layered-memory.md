# Plan de implementación R6 — Memoria por capas y consolidación v2

Estado: en curso · R6.1, R6.2-C y R6.3-B validados  
Fecha: 2026-08-15

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

Estado: R6.2-C validado.

El backend mantiene en RAM hasta tres intercambios reales de conversación —seis mensajes y 48.000 caracteres— durante 30 minutos desde la última respuesta. Sólo se registra un intercambio después de recibir una respuesta real del proveedor. El contenido no se escribe en archivos, expira con tiempo real, se descarta al cerrar el proceso y nunca altera `records.json` ni `layer-index-v2.json`.

- [x] Contenedor nativo, efímero y acotado.
- [x] Procedencia de proveedor y modelo por intercambio.
- [x] Expiración, desalojo de intercambios completos y rechazo de sobrepresupuesto.
- [x] Auditoría R3 sólo con SHA-256, sin texto conversacional.
- [x] Conversación real integrada dentro de `[00] CONVERSATION / PERCEPTION INPUT`.
- [x] Consulta defensiva desde React cada cinco segundos.
- [x] Indicador, TTL, presupuesto, procedencia y vaciado confirmado dentro de Memoria.
- [x] Presupuesto explícito de cada fragmento opcional antes del envío.

La previsualización calcula sobre la cadena saliente real los caracteres Unicode y bytes UTF-8 de mensaje, historial, recuerdos y ventana. Los fragmentos opcionales no autorizados muestran cero. El cálculo incluye separadores y total, y evita presentar como exacta una estimación de tokens dependiente del proveedor.

La eliminación de la antigua pestaña independiente Conversación evita duplicar el panel `[00]`. La pantalla Memoria conserva separados **Recuerdos**, **Trabajo RAM** y **Capas R6**. El navegador declara ausencia de backend y nunca fabrica un estado de sesión.

## R6.3 — Consolidación manual

Estado: R6.3-B validado; fusión manual pendiente.

- [x] Contrato cerrado de vista previa nativa y de sólo lectura.
- [x] Duplicados exactos por contenido normalizado y pares de revisión por intención coincidente.
- [x] IDs de candidato ligados al SHA-256 de la fuente y a dos registros ordenados.
- [x] Exclusión de registros archivados y sesiones sin finalizar.
- [x] Interfaz separada `Memoria → Consolidar` con fallback web honesto.
- [x] Sonda real contra los 10 recuerdos canónicos con huellas intactas.
- [x] Decisión humana para mantener ambos recuerdos separados.
- [x] Respaldo previo, bloqueo por SHA-256 y auditoría de `keepSeparate`.
- [x] Registro lateral sin contenido privado, visible e idempotente.
- [ ] Diseño de fusión manual limitado a duplicados exactos.
- [ ] Selección explícita del registro superviviente y restauración verificable.

R6.3 no detecta contradicciones semánticas generales porque el formato v1 no posee campos estructurados de sujeto, predicado y valor. Un mismo tema con contenido diferente se presenta como revisión requerida, nunca como contradicción confirmada. R6.3-B sólo permite `keepSeparate`: no fusiona, elimina, archiva ni modifica `records.json`.

## Fuente futura gobernada — proyectos locales

Alice podrá estudiar carpetas de proyectos elegidas explícitamente por Carlos Nuñez después de definir una capacidad R1 y un grant R2 de solo lectura. El primer alcance leerá estructura, documentación y metadatos; excluirá secretos, `.git`, dependencias, builds, binarios y archivos grandes. Sus resultados serán observaciones efímeras y candidatos revisables, no recuerdos automáticos ni ejecución de código.

Este explorador no forma parte de R6.1 y no autoriza acceso general a discos.
