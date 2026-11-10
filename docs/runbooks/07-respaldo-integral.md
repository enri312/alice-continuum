# Respaldo integral y restauración aislada

Desde el 10 de noviembre de 2026, los lanzadores de Windows y Ubuntu realizan
una copia al iniciar, cada **15 minutos** mientras se ejecutan y al cerrar
normalmente. Si no cambió el contenido, verifican la última copia y la reutilizan.
`--check`, las compilaciones y las pruebas no activan respaldos de datos reales.

El destino de esta instalación es **`D:\Alice Backups\Alice Continuum`**.
Por indicación del propietario, este mecanismo no utiliza C:. El destino por
defecto es una carpeta `Alice Backups/<nombre-del-proyecto>` junto al checkout;
no se elige automáticamente el perfil de Windows. Esta copia en D: protege
frente a borrados o modificaciones del proyecto, pero comparte el disco del
original. Falta una copia en otra unidad física o fuera del equipo.

## Qué incluye

| Contenido | Recuperación |
|---|---|
| Todo `ALICE_DATA_DIR`, por defecto `data/` | Memoria confirmada y automática, perfil, conversaciones, autoestudio, auditorías, índices, respaldos previos y bóveda Obsidian completa con notas manuales |
| Archivos versionados y nuevos no ignorados por Git | Código y documentos tal como estaban, incluidos cambios sin commit y eliminaciones locales |
| `project.bundle` | Historial Git completo alcanzable desde sus referencias y HEAD; ramas y etiquetas |
| Todo `local/assets/` | Avatar, animaciones y recursos privados existentes en esa carpeta |
| `.env`, `.env.*`, `local/ubuntu.env`, `local/backup.json` | Archivos de configuración privados presentes |
| Configuración Fish de Linux y variables de entorno seleccionadas de Alice/proveedores | Copias privadas bajo `local/recovered-settings/`; no se ejecutan ni importan automáticamente |

Las claves se copian sólo desde los archivos indicados y el entorno del proceso
que respalda. No se recorren el registro, llaveros, otros perfiles ni credenciales
ajenas a Alice. Las variables seleccionadas están enumeradas en
`scripts/backups/snapshot.mjs`. Los archivos privados permanecen fuera de Git.

No se incluyen los modelos o motores **externos** a `local/assets/`,
`node_modules`, `dist`, caches Rust, entornos Python, otros archivos ignorados,
reflogs/objetos Git sin referencias ni la distribución de cambios entre staging
y working tree. Tampoco se conserva la memoria RAM, el audio o los fotogramas
efímeros. Las dependencias se reinstalan y las rutas de modelos se revisan al
recuperar. Los directorios vacíos se recrean cuando se necesitan.

## Operación manual

Desde la raíz de Alice:

```powershell
npm run backup -- create
npm run backup -- status
npm run backup -- list
npm run backup -- verify --snapshot 'D:\Alice Backups\Alice Continuum\snapshot-FECHA-ID'
```

`status` verifica la última versión completa; `list` sólo enumera versiones.
Para forzar otra copia aunque el contenido no haya cambiado, usar
`npm run backup -- create --force`. No se eliminan versiones automáticamente.

El archivo privado `local/backup.json` permite configurar cada sistema:

```json
{
  "schemaVersion": 1,
  "intervalMinutes": 15,
  "destinations": {
    "win32": "D:\\Alice Backups\\Alice Continuum"
  }
}
```

En Ubuntu puede agregarse una ruta **absoluta** bajo la clave `linux`.
`ALICE_BACKUP_DIR` tiene precedencia sobre el archivo; `--destination` permite
una operación manual en otro destino. No se puede usar el interior del proyecto
o de sus datos, ni una carpeta que los contenga. Se rechazan enlaces simbólicos,
junctions y rutas no portables.

Los permisos del destino se restringen al propietario, SYSTEM y administradores
en Windows; en Linux la raíz usa `0700` y las copias `0600`. Las copias **no están
cifradas**. No subirlas a un repositorio ni compartirlas con colaboradores.

## Recuperar sin sobrescribir el proyecto

Cerrar Alice antes de escoger qué versión se utilizará. La herramienta puede
ejecutarse desde un checkout nuevo que tenga Node y Git instalados, sin instalar
las dependencias de la interfaz:

```powershell
node scripts/backups/cli.mjs verify --snapshot 'D:\Alice Backups\Alice Continuum\snapshot-FECHA-ID'
node scripts/backups/cli.mjs restore --snapshot 'D:\Alice Backups\Alice Continuum\snapshot-FECHA-ID' --target 'D:\Alice Restaurada'
```

La carpeta de destino **no debe existir**, ni estar dentro del original o del
respaldo. La restauración verifica el inventario y cada SHA-256, reconstruye
Git sin conexión, conserva las ramas y comprueba `git fsck --full`. Los datos
se colocan en `data/` del nuevo proyecto aunque antes se usara una raíz externa.
El remoto `backup` apunta al bundle; no se configura un push a GitHub.

Después de recuperar:

1. Revisar código y datos antes de abrir la copia.
2. Comprobar `ALICE_DATA_DIR`: el entorno anterior podría apuntar al original.
3. Revisar los valores de `local/recovered-settings/`; restaurar sólo los que
   correspondan al equipo. El archivo Fish externo se conserva allí para revisión.
4. Reinstalar dependencias, revisar rutas de modelos y ejecutar el lanzador con
   `--check`. No iniciar las dos copias sobre los mismos datos.
5. Conservar el original y la copia anterior hasta aceptar la recuperación.

Una restauración interrumpida deja `.alice-restore-incomplete`. Los lanzadores
rechazan esa carpeta. Usar un destino nuevo para reintentar; no borrar el
original ni tratar la carpeta incompleta como una recuperación terminada.

## Fallos y límites

La copia compara los archivos y referencias Git antes y después de copiar,
valida JSON/JSONL y verifica nuevamente los archivos copiados. Un cambio durante
la lectura, falta de espacio o un archivo inválido impide publicar esa versión.
El directorio `.incomplete-*` queda separado para inspección. Un respaldo anterior
dañado se conserva y se intenta crear otro a partir de las fuentes actuales.

Un bloqueo evita dos copias simultáneas al mismo destino. Se recupera un bloqueo
de un proceso ya terminado en el mismo equipo; un bloqueo desconocido, malformado
o de otro equipo requiere revisión. No borrar bloqueos mientras haya procesos
de respaldo activos. La herramienta no borra copias para liberar espacio.

Los errores aparecen en la consola del lanzador y se reintenta en el siguiente
intervalo o cierre. Un fallo de copia no impide iniciar la conversación. Un
archivo de configuración inválido sí requiere corregirlo antes del arranque.

Esto comprueba estabilidad de archivos, **no una transacción global** entre
almacenes. Los checkpoints con Alice cerrada ofrecen una base más sencilla de
recuperar. Un corte de energía o cierre forzado puede perder cambios posteriores
a la última copia completa; el cierre final no está garantizado en ese caso.

La automatización está en los **lanzadores del código fuente**. Abrir directamente
el ejecutable nativo, `npm run dev` o `npm run tauri -- dev` no activa este
supervisor. No se ha añadido un servicio de Windows, tarea programada ni función
equivalente al instalador empaquetado.

[Decisión técnica](../decisions/ADR-P-114-respaldo-integral.md) ·
[Pruebas y recuperación real](../testing/INTEGRAL_BACKUP_REPORT_2026-11-10.md).
