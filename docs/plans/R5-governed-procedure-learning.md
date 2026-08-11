# Plan de implementación R5 — Aprendizaje gobernado de procedimientos

Estado: activo; incrementos 1, 2 y 3 implementados y validados  
Fecha: 2026-08-11

## Objetivo

Permitir que Alice detecte secuencias repetidas únicamente cuando existan ejecuciones exitosas y auditadas, y que las presente como candidatos revisables sin convertirlas automáticamente en habilidades, recuerdos o acciones.

## Incremento 1 — Contrato y validación de evidencia ✅

- Contrato Rust cerrado con `deny_unknown_fields` y parser TypeScript defensivo.
- Método fijo `r5AuditedRepetitionV1`.
- Mínimo conservador de tres ocurrencias y dos pasos para excluir apariciones únicas y tareas triviales.
- Cada paso se valida contra una capacidad y operación reales del Registro R1.
- Cada evidencia debe resolver a un evento R3 de ejecución exitosa producido por `capability`, `memory` o `cloud`.
- Los UUID de operación y evento no se pueden reutilizar entre ocurrencias.
- Las variaciones de duración o huella se calculan desde R3 y deben coincidir exactamente con la propuesta.
- Riesgo declarado igual o mayor al máximo observado.
- Política fija: sólo propuesta, sin autoactivación, ejecución ni escritura en memoria duradera.
- Sin comandos Tauri, persistencia o cambios visibles durante este incremento.

## Incremento 2 — Detector local conservador ✅

- Leer una ventana acotada de auditoría R3 sin modificarla.
- Agrupar secuencias por capacidad y operación, nunca por texto privado.
- Excluir permisos, simulaciones, bloqueos, errores y eventos incompletos.
- Aplicar umbrales explícitos de repetición, temporalidad y trivialidad.
- Devolver cero candidatos cuando la evidencia actual no alcance el contrato.

**Resultado 2026-08-11:** el comando nativo de sólo lectura examina la ventana visible R3, agrupa únicamente secuencias de 2 a 16 pasos con orden temporal inequívoco y exige tres operaciones correlacionadas distintas. El snapshot conserva huella, riesgo, evidencias y variaciones, pero fija persistencia, creación de candidatos y ejecución en `false`. La sonda canónica real más reciente leyó 22 eventos, calificó 0 ejecuciones y devolvió 0 patrones sin modificar ninguno de los 10 archivos de datos.

## Incremento 3 — Almacén y decisiones del propietario ✅

- Persistir decisiones y candidatos conservados separados de habilidades y memoria.
- Permitir conservar o descartar una huella vigente con confirmación explícita.
- Rechazar o descartar no modifica capacidades, memoria ni manifiestos R4.
- Toda decisión deja auditoría R3 mínima, sin copiar contenido privado ni el motivo.
- Consultar no crea almacenamiento; reemplazar preserva el archivo anterior hasta publicar el nuevo.

**Resultado 2026-08-11:** `data/procedures/candidate-decisions-v1.json` conserva una decisión inmutable por huella. `retain` guarda el candidato validado y su SHA-256; `dismiss` guarda sólo la decisión y el digest del motivo. La pestaña **Procedimientos** está en Governance y no se mezcla con el Taller. La sonda canónica real leyó 200 eventos, encontró 0 patrones y 0 decisiones y no creó el almacén. Ejecución y borrador R4 permanecen en `false`.

## Incremento 4 — Conversión revisable a borrador R4

- Permitir corregir metadatos del candidato antes de una conversión explícita.
- Convertir un candidato aceptado en un manifiesto `draft`, nunca `approved`.
- Conservar referencias de evidencia y procedencia R5.
- Crear una versión nueva si ya existe una habilidad relacionada.
- Mantener simulación, revisión humana y restauración de R4.

## Incremento 5 — Interfaz y cierre de fase

- Mostrar evidencia, repeticiones, pasos, diferencias, riesgo y límites.
- Estados vacío, candidato válido, descartado, bloqueado y evidencia obsoleta.
- Prueba integral con archivos temporales y eventos R3 generados por código real.
- Actualizar Roadmap, documento maestro, README e informe final.

## Puertas obligatorias

- Ninguna respuesta de proveedor se interpreta como instrucción confiable.
- Ningún candidato se activa, ejecuta o consolida automáticamente.
- Los fixtures permanecen aislados; `data/`, avatar y credenciales no se usan como prueba.
- Rust, TypeScript, `fmt`, `clippy`, build web y build Tauri deben aprobar.
