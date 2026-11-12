# Datos locales de Alice

El iniciador configura `ALICE_DATA_DIR` con esta carpeta. Alice crea aquí:

- `memory/`: recuerdos, respaldos, exportaciones, adjuntos e índices.
- `conversation/`: historial local durable de diálogos, separado de los recuerdos.
- `cloud/`: auditoría técnica de llamadas a proveedores, sin claves.
- `voice-profile.json`: selección privada de la voz Fish; esquema 1, separada
  de las credenciales y de los recuerdos.

El avance del autoestudio de arranque se conserva en
`memory/self-study-v1.json`, separado de las memorias personales. Su currículo
está limitado a matemáticas, historia bíblica católica, psicología e inteligencia
emocional, empatía, solidaridad y humildad. Las lecciones aprobadas pueden
recuperarse al conversar y se proyectan en la bóveda. Ver
[Autoestudio al arrancar](../docs/runbooks/06-autoestudio-al-arrancar.md).

## Perfil privado de voz

`voice-profile.json` se lee desde la raíz efectiva de `ALICE_DATA_DIR`.
Ejemplo ficticio de su formato:

```json
{
  "schemaVersion": 1,
  "referenceId": "voz_de_ejemplo_2026"
}
```

Este archivo válido tiene prioridad sobre `ALICE_FISH_REFERENCE_ID`; esa
variable sólo se usa cuando no existe el archivo. Un perfil presente inválido
produce un error, sin cambiar silenciosamente a la voz del entorno.
La clave `FISH_API_KEY` sigue en el entorno del proceso y no se guarda aquí.
El contenido del perfil es privado, queda fuera de Git y forma parte del
respaldo de datos. El identificador de ejemplo no selecciona la voz del
propietario. Procedimiento y personalidad:
[Conversación y voz](../docs/runbooks/03-conversacion-y-voz.md#voz-privada-y-personalidad).

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
