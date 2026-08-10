# ADR-P-049 — Almacén local verificable de borradores

Fecha: 2026-08-09  
Estado: aceptada para R4.2

## Contexto

R4.1 definió un manifiesto cerrado, pero todavía no podía conservar una habilidad entre sesiones. La persistencia debe impedir rutas arbitrarias, sobreescrituras silenciosas y estados que aparenten aprobación o ejecución.

## Decisión

- Los borradores viven exclusivamente bajo `data/skills/`.
- `manifest.json` es un índice cerrado, acotado a 128 entradas y enlaza cada archivo mediante SHA-256.
- Los nombres se derivan de un `skillId` canónico `local.*`; la interfaz no entrega rutas de archivo.
- Leer o listar es pasivo: si el almacén no existe, no se crea ninguna carpeta.
- Crear exige `draft`, versión 1 y ausencia de padre.
- Editar exige `expectedRevisionId`, un UUID nuevo y `parentRevisionId` igual a la revisión reemplazada.
- Un bloqueo nativo serializa consulta y guardado dentro del proceso para que dos ediciones simultáneas no superen la misma revisión esperada.
- Autor, identidad, versión y fecha de creación no pueden cambiar durante una edición R4.2.
- Cada edición conserva el archivo anterior en `backups/` y registra también su SHA-256.
- Borrador e índice se reemplazan mediante archivos temporales sincronizados; ante un fallo se intenta restaurar el estado anterior.
- Los únicos comandos nuevos son consulta, lectura y guardado de borradores. No existe aprobación, activación, simulación operativa ni ejecución.

## Consecuencias positivas

- Alice puede conservar trabajo local sin convertirlo en autoridad ejecutable.
- La concurrencia optimista evita que una ventana antigua borre una revisión más reciente.
- La manipulación de un borrador o de su respaldo se detecta antes de devolverlo a la interfaz.
- La raíz de datos y los recuerdos existentes permanecen fuera de los fixtures de prueba.

## Costos y límites

- Se conserva un solo respaldo anterior por borrador durante R4.2.
- No se ofrece eliminación ni recuperación automática de archivos corruptos.
- Las revisiones aprobadas e inmutables pertenecen a R4.4.
- El Taller visual pertenece a R4.5.

## Alternativas descartadas

### Guardar todo en un único JSON

Se descarta porque vuelve costosa la verificación individual y amplía el daño potencial de una escritura incompleta.

### Aceptar una ruta desde React

Se descarta porque abriría una vía de escape fuera de `data/skills`.

### Sobrescribir sin revisión esperada

Se descarta porque dos vistas podrían perder cambios sin advertencia.
