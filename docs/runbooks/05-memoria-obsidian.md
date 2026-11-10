# Memoria guardada de Alice en Obsidian

La bóveda está en `<directorio de datos>/obsidian`. En esta instalación, el
directorio de datos del lanzador es `D:\Alice Continuum\data`; si se configura
`ALICE_DATA_DIR`, se utiliza esa ubicación. Un checkout distinto usa su propia
carpeta `data/` salvo configuración expresa.

En Obsidian, elegir **Abrir carpeta como bóveda**, seleccionar esa carpeta y
abrir `Inicio.md`. Si ya se abrió `data/` como bóveda, las notas también se pueden
explorar dentro de su subcarpeta `obsidian/`; se recomienda abrir esta última
directamente para centrar el grafo en las notas.

## Qué se sincroniza

La fuente de los recuerdos es `<directorio de datos>/memory`, que en la
instalación principal es `D:\Alice Continuum\data\memory`. El índice y el
**Mapa de la memoria** muestran esa ruta de forma explícita. La sincronización
consulta los almacenes de datos; no lee módulos TypeScript para crear recuerdos.

`Alice (sincronizado)/` contiene una vista de los datos del propietario:

- Recuerdos de `memory/records.json`, con sus estados y procedencia.
- Selecciones de `memory/automatic-v1.json`, distinguiendo activas y retiradas.
- Hechos del perfil en `memory/owner-profile.json`.
- Notas existentes de `memory/notes/`, conservando su estructura relativa.
- Un mapa del almacenamiento real de `data/memory/`, con la función de cada fuente.

`records.json` es el almacén de registros actual. `sessions.json` corresponde al
formato anterior; Alice lo valida y migra sólo cuando falta `records.json`.
La vista no importa ambos como recuerdos nuevos ni convierte auditorías,
respaldos o revisiones en conocimiento adicional.

Los archivos JSON y las notas anteriores siguen siendo los originales.
La sincronización no modifica recuerdos, permisos, pesos de modelos ni la
selección del contexto de conversación. No exporta claves, auditorías, respaldos
ni el historial completo de diálogos.

Los recuerdos archivados, en conflicto, suprimidos, en reposo o retirados se
identifican como tales en esta vista para el propietario. Su presencia en
Obsidian no los habilita para la conversación de Alice.

## Actualización

El servidor Vite que utiliza el lanzador inicia la sincronización y vuelve a
comprobar las fuentes cada dos segundos. Al cerrar el servidor, se detiene.
La vista puede tardar un ciclo en reflejar un cambio guardado por Alice.

Desde la raíz del proyecto:

```powershell
npm run obsidian:sync
npm run obsidian:watch
```

El primer comando actualiza una vez; el segundo mantiene un observador hasta
cerrarlo con Ctrl+C. No es necesario ejecutar el observador manual cuando ya
está activo el servidor del lanzador. Una aplicación empaquetada que no utiliza
Vite requiere ejecutar el comando de sincronización o el observador por separado.

También se pueden seleccionar explícitamente el proyecto y los datos:

```powershell
node scripts/obsidian/sync.mjs --project-root "D:\Alice Continuum" --data-root "D:\Alice Continuum\data"
```

## Ediciones y conflictos

La sincronización es de **Alice hacia Obsidian**. Las correcciones operativas se
hacen en Alice. Una nota nueva escrita en Obsidian aún no se importa a su memoria
ni se usa automáticamente para responder.

Las notas manuales se guardan fuera de `Alice (sincronizado)/`. Los archivos
administrados tienen un manifiesto de huellas; si se modifica uno a mano, la
sincronización informa un conflicto y conserva la edición. Mover la nota editada
fuera de esa carpeta y volver a sincronizar para regenerar la vista. Hasta
resolver el conflicto, la vista puede contener datos anteriores.

No retirar el manifiesto o el marcador para forzar un reemplazo. Ante un error
de lectura o un formato inválido, corregir la fuente mediante las herramientas
de Alice y volver a ejecutar la sincronización. Consultar los mensajes del
lanzador o del comando; los errores no imprimen el texto de los recuerdos.

La bóveda permanece excluida de Git junto con los demás datos privados. Incluirla
en los respaldos personales; el manifiesto sirve para sincronizar, no como copia
de seguridad.

Al actualizar una bóveda creada con el mapa de código anterior, la sincronización
retira únicamente las notas generadas que todavía coincidan con su manifiesto.
Si fueron editadas a mano, conserva el conflicto para proteger esos cambios.
Las notas personales y la configuración de Obsidian se mantienen.

## Verificación de la integración

```powershell
npm run test:obsidian
```

Las pruebas usan datos sintéticos aislados. Comprueban actualización, estados,
borrado de copias obsoletas, conservación de fuentes y notas manuales, conflictos
y límites de rutas. La revisión visual de la bóveda se realiza en Obsidian.
