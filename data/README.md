# Datos locales de Alice

El iniciador configura `ALICE_DATA_DIR` con esta carpeta. Alice crea aquí:

- `memory/`: recuerdos, respaldos, exportaciones, adjuntos e índices.
- `conversation/`: historial local durable de diálogos, separado de los recuerdos.
- `cloud/`: auditoría técnica de llamadas a proveedores, sin claves.

El avance del autoestudio de arranque se conserva en
`memory/self-study-v1.json`, separado de las memorias personales. Su currículo
está limitado a matemáticas, historia bíblica católica, psicología e inteligencia
emocional, empatía, solidaridad y humildad. Las lecciones aprobadas pueden
recuperarse al conversar y se proyectan en la bóveda. Ver
[Autoestudio al arrancar](../docs/runbooks/06-autoestudio-al-arrancar.md).

## Cerebro de Alice en Obsidian

La carpeta `obsidian/` es una bóveda privada para organizar identidad, recuerdos,
conocimiento y diseño del cerebro de Alice en notas Markdown enlazadas.
En Obsidian, elegir **Abrir carpeta como bóveda** y seleccionar `data/obsidian`.
La entrada es [Inicio](obsidian/Inicio.md).

El origen es `data/memory/`: en la instalación principal,
`D:\Alice Continuum\data\memory`. `Alice (sincronizado)/` contiene la proyección
de los recuerdos, el perfil, el autoestudio y las notas Markdown anteriores.
Su mapa muestra los almacenes de datos y la ruta efectiva de origen.
Se actualiza al arrancar el servidor del lanzador y mientras permanece abierto.
También puede actualizarse con `npm run obsidian:sync`, o mantenerse al día con
`npm run obsidian:watch`. Se respeta `ALICE_DATA_DIR`.

La dirección es **Alice → Obsidian**. Para corregir recuerdos operativos, usar
Memoria en Alice; las notas manuales de esta bóveda todavía no se incorporan a
su conversación. No editar los archivos de la carpeta sincronizada: una edición
manual detiene la actualización para evitar sobrescribirla. Guardar anotaciones
propias en las demás carpetas. Los originales de `memory/`, los estados de
retirada y el historial de `conversation/` conservan su función actual.
Incluir `obsidian/` al respaldar los datos privados.

Procedimiento y límites: [Memoria en Obsidian](../docs/runbooks/05-memoria-obsidian.md).

El contenido generado dentro de `data/` está excluido de Git. Este archivo sí se
conserva para explicar la estructura cuando el proyecto se comparte.

No guardar claves de API, contraseñas ni otros secretos como recuerdos.
