# Operar, respaldar y restaurar la memoria

## Localizar los datos

Abrir la pestaña Memoria y usar `Abrir carpeta de memoria`. Al arrancar mediante `Iniciar Alice.cmd`, la ruta activa es `E:\Proyecto P\data\memory`.

La variable `ALICE_DATA_DIR` controla la raíz. No cambiarla con Alice abierta. Para trasladar datos: cerrar Alice, copiar la carpeta completa, validar `records.json`, cambiar la variable y confirmar desde la pantalla Memoria antes de borrar la fuente anterior.

## Crear una enseñanza

1. Completar tema, tipo, contenido, fuente e importancia.
2. Revisar el contenido.
3. Pulsar `Guardar enseñanza local`.
4. Confirmar que aparece como registro y que la Actividad contiene `TEACHING_COMMIT`.

## Exportar

Pulsar `Exportar memoria`. Alice crea una copia con fecha dentro de `memory/exports/` y registra una huella SHA-256 en la auditoría.

## Restaurar

Pulsar `Restaurar respaldo` y confirmar. Antes de reemplazar la memoria vigente, Alice conserva una copia en `memory/backups/records.pre-restore.json`.

## Recuperación manual

Si la interfaz no puede abrir:

1. Cerrar Alice.
2. Copiar toda la carpeta `memory/` a una ubicación segura.
3. Revisar `records.json` con un editor de texto, sin modificar el original.
4. Conservar `manifest.json` y `audit/memory-events.jsonl` junto al respaldo.

No pegar claves de API dentro de ningún archivo de memoria.
