# Dirección visual de Alice Continuum

Actualización del 17 de noviembre de 2026. Los iconos de `Frontend/icons`
son la referencia visual de Alice. El Dashboard y las 15 pantallas existentes
comparten el marco de consola, las superficies oscuras y los SVG del proyecto.
Los acentos cian, ámbar y violeta identifican los tres núcleos.

## Dashboard

El inicio presenta el estado de Alice, los accesos a sus herramientas y la
telemetría. Conversación reúne el texto, la voz y la revisión del mensaje.
El borrador queda en Conversación al pasar por el Dashboard.
La telemetría es local y de sólo lectura. Usa recursos del sistema operativo
y se consulta mientras el Dashboard está visible. El anillo presenta
ocupación de RAM con una unidad y una fuente identificables.
La pantalla se renderiza con Dioxus. El Rust de la vista formatea las lecturas
y emite las acciones de navegación. `DashboardHost.tsx`
es el puente con el contenedor actual y el comando Tauri de telemetría.

## Lenguaje visual adoptado

- Fondo oscuro `#07111d`, retícula tenue, luz ambiental azul y paneles con
  bordes biselados inspirados en los iconos.
- Acento cian para acciones y lecturas. Los estados de error, grabación,
  actividad y disponibilidad conservan sus colores, significados y textos.
- Sora para lectura y controles; JetBrains Mono para identificadores y datos
  técnicos. Archivos WOFF2 locales, con licencias SIL OFL 1.1 incluidas, sin
  solicitudes a Google Fonts durante el uso.
- Sistemas y accesos con superficies de metal oscuro. Los SVG y sus etiquetas
  se alinean en filas separadas de sus contadores. El desplazamiento horizontal
  nativo permite recorrer todas las pestañas en ventanas estrechas.
- Mensajes en un área de lectura diferenciada; controles de voz junto al
  compositor, acción principal con degradado y revisión explícita antes de enviar.
- Contexto, documentos y diagnóstico bajo demanda. Foco visible, adaptación a
  anchos pequeños y respeto de `prefers-reduced-motion`.

La marca, el lema y el indicador Local-first permanecen en una línea compacta.
Los 21 iconos funcionales se dibujan como instrumentos de metal con óptica,
cableado y piezas específicas. Conversación combina dos turnos con una señal
de audio, el Volumen muestra hemisferios conectados, Memoria un archivo y
Auditoría una lente sobre un registro. El emblema `app-alice.svg` conserva su
trazado. Las escenas editables están en `scripts/icons/scenes/`. El comando
`npm run icons:generate` reproduce la colección de `Frontend/icons/`.

Tras la revisión del propietario se quitaron el aro decorativo y las dos flechas
añadidas. El encabezado técnico vuelve al tratamiento compacto previo, sin
repetirse visualmente sobre Conversación. No se añaden emblemas a los originales.

## Contenido de Conversación

La composición de Conversación parte del HTML «Propuesta 04». El tema de
consola aporta su marco y paleta. Los contratos, permisos y funciones de
Conversación se conservan.

| Contenido | Tratamiento |
|---|---|
| Texto e historial | Mensajes reales; borrador e historial de la sesión se conservan al navegar. |
| Revisión del mensaje | Texto exacto, presupuesto, fuentes incluidas, cancelar y autorización explícita. Editar invalida la revisión anterior. |
| Voz | Escucha y dictado existentes, perfiles y diagnóstico de entrada plegado; el diseño no certifica precisión ASR. |
| Vista de Alice | Cámara y escritorio con sus permisos, disponibilidad, errores y ciclo de vida actuales. |
| Recuerdos | Recuperación y propuesta manual existentes; sin insertar el recuerdo EPISODIC de ejemplo. |
| Contexto | Historial, recuerdos y ventana seleccionables; información real del motor y límites actuales. |
| Herramientas secundarias | Diagnóstico de entrada y documentos locales conservados, cerrados inicialmente. |

`Frontend/src/styles/console-theme.css` define el fondo, la paleta, el marco
común y la navegación. `conversation-proposal04.css` conserva la disposición
propia del chat, el compositor y la revisión. Dashboard y las vistas en Rust
reutilizan la misma base de estilos.

## Validación y límites

- El ensayo de navegador comprueba el marco y las etiquetas en las 15 rutas a
  390 y 1280 px. Dashboard y Conversación también se prueban a 320 px.
  El envío, la cancelación y los errores de Conversación usan IPC sintético.
- La aceptación Tauri abre Dashboard en Dioxus y consulta métricas del equipo.
  Comprueba el acceso a Conversación, la conservación de su borrador, Estado,
  Flujo, Actividad y la persistencia de relaciones con registros aislados.
- Las pruebas de voz, cámara y proveedores reales tienen su propio alcance.
- [Informe de la incorporación inicial de Conversación](../testing/CONVERSATION_PROPOSAL04_REPORT_2026-11-15.md).

La adaptación visual y la migración a Dioxus se registran por separado.
[Inventario de migración](DIOXUS_MIGRATION_STATUS.md).

## Exploraciones anteriores

Observatorio y Cuaderno fueron maquetas privadas de organización, sin adoptar.
La posterior evolución CSS sobre las 15 rutas reales también quedó como estudio
previo; sus capturas y comprobación de 22 SVG intactos no certifican el nuevo tema.
Estos archivos permanecen en `experiments/` y la evidencia en `runtime/artifacts/`,
ambas ubicaciones excluidas de Git. Ninguna exploración sustituye el contenido
de las pantallas del producto.
