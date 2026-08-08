# ADR-P-030 — Datos locales activos en el disco E

Fecha: 2026-08-07  
Estado: aceptada

## Contexto

El equipo de Enrique mantiene el sistema en C: con espacio limitado y utiliza E: para proyectos y datos de trabajo. La ubicación predeterminada de Tauri colocó memoria y auditorías en `AppData\Roaming`, aunque esos archivos pueden crecer con el uso de Alice.

## Decisión

La raíz de datos será configurable mediante `ALICE_DATA_DIR`. `Iniciar Alice.cmd` establece esa variable en `E:\Proyecto P\data`. La memoria activa vive en `data\memory` y la auditoría de nube en `data\cloud`.

El contenido generado dentro de `data/` se excluye de Git. Si la variable no está definida, Tauri conserva `app_data_dir()` como fallback compatible para otras instalaciones.

La migración inicial copia los datos existentes desde C: hacia E:, valida el archivo principal y no elimina la fuente anterior automáticamente.

## Consecuencias

- El crecimiento normal de recuerdos, respaldos, adjuntos, índices y auditorías ocurre en E:.
- La pantalla Memoria muestra y abre la fuente activa para evitar ambigüedad.
- Ejecutar Alice por un método distinto al iniciador requiere definir `ALICE_DATA_DIR` si se desea usar la misma memoria.
- La copia de C: podrá eliminarse manualmente solo después de verificar varios arranques desde E:.
