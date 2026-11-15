# Dirección visual de Alice Continuum

Fecha: 2026-11-15. Estado: **Propuesta 04 incorporada a Conversación; las demás
pantallas conservan su diseño**.

El propietario eligió su archivo «Alice Continuum · Propuesta 04 — Mejora del
diseño actual.html» como referencia. La dirección conserva la identidad oscura,
los iconos elaborados y todo el contenido del producto, con superficies más
tranquilas, tipografía legible y una jerarquía clara. Esta incorporación es
visual: Conversación y el contenedor raíz todavía usan React y su migración a
Dioxus continúa pendiente.

## Lenguaje visual adoptado

- Fondo oscuro `#07080f`, luz ambiental estática violeta y cian, paneles
  translúcidos y bordes blancos suaves. Sin animaciones ambientales continuas.
- Acento principal violeta → azul → cian. Los estados de error, grabación,
  actividad y disponibilidad conservan sus significados y sus textos reales.
- Sora para lectura y controles; JetBrains Mono para identificadores y datos
  técnicos. Archivos WOFF2 locales, con licencias SIL OFL 1.1 incluidas, sin
  solicitudes a Google Fonts durante el uso.
- Sistemas en tarjetas redondeadas, área de trabajo con radio de 24 px y pestañas
  con los SVG propios. Desplazamiento horizontal nativo y acceso por teclado.
- Mensajes en un área de lectura diferenciada; controles de voz junto al
  compositor, acción principal con degradado y revisión explícita antes de enviar.
- Contexto, documentos y diagnóstico bajo demanda. Foco visible, adaptación a
  anchos pequeños y respeto de `prefers-reduced-motion`.

La marca, el lema y el indicador Local-first permanecen en una línea compacta.
Los tres sistemas y todos los destinos siguen accesibles. No se renombraron
funciones ni se reemplazaron iconos por los glifos genéricos del HTML.
Después de aprobar la alineación, el propietario pidió adaptar el icono de
Conversación al estilo de IA con más detalle. Su composición conserva mensajes,
micrófono, filtro, onda vocal y lente opcional, con capas de cristal y circuitos
violeta/azul/cian. Es un SVG estático con identificadores propios. Los otros 21
recursos, incluido el emblema de Alice, conservan sus contenidos originales.
[Fuente reproducible y validación](../testing/CONVERSATION_ICON_PROPOSAL04_REPORT_2026-11-15.md).
Tras la revisión del propietario se quitaron el aro decorativo y las dos flechas
añadidas. El encabezado técnico vuelve al tratamiento compacto previo, sin
repetirse visualmente sobre Conversación. No se añaden emblemas a los originales.

## Del HTML de referencia al producto

La referencia contiene conversación, alarmas, recuerdos, proveedores y respuestas
de demostración. Se tomó su presentación; sus manejadores JavaScript y datos
ficticios no se incorporaron. La interfaz conserva los contratos, permisos y
acciones reales de Alice:

| Contenido | Tratamiento |
|---|---|
| Texto e historial | Mensajes reales; borrador e historial de la sesión se conservan al navegar. |
| Revisión del mensaje | Texto exacto, presupuesto, fuentes incluidas, cancelar y autorización explícita. Editar invalida la revisión anterior. |
| Voz | Escucha y dictado existentes, perfiles y diagnóstico de entrada plegado; el diseño no certifica precisión ASR. |
| Vista de Alice | Cámara y escritorio con sus permisos, disponibilidad, errores y ciclo de vida actuales. |
| Recuerdos | Recuperación y propuesta manual existentes; sin insertar el recuerdo EPISODIC de ejemplo. |
| Contexto | Historial, recuerdos y ventana seleccionables; información real del motor y límites actuales. |
| Herramientas secundarias | Diagnóstico de entrada y documentos locales conservados, cerrados inicialmente. |

`Frontend/src/styles/conversation-proposal04.css` acota sus reglas a
`.shell.is-conversation`, incluidos los fondos del documento mientras esa ruta
está activa. No cambia los tokens globales. Se retiró el controlador de carrusel
añadido inicialmente: la navegación conserva su desplazamiento nativo.

## Validación y límites

Se comprobaron compilación, pruebas existentes y el flujo de revisión, edición,
cancelación, autorización y error en un navegador aislado con IPC y respuesta
sintéticos. Se revisaron tamaños de 320, 390, 1024 y 1280 px, carga local de las
fuentes, ausencia de solicitudes externas, navegación por teclado y regreso a
Conversación conservando su borrador y chat.

La aceptación nativa abre una ventana Tauri con datos sintéticos separados y
puente real. Comprueba el tema, los iconos, la revisión/cancelación sin enviar y
la continuidad de Estado, Flujo y Actividad en Dioxus. No abre cámara ni
micrófono y no llama a modelos, Fish o Spotify.
[Resultados y evidencia](../testing/CONVERSATION_PROPOSAL04_REPORT_2026-11-15.md).

## Siguientes incorporaciones

1. Revisar con el propietario Conversación funcionando en Alice.
2. Adaptar una sola pantalla por incremento, partiendo del mismo lenguaje visual.
   Conservar su contenido completo, iconos, subpestañas, permisos y acciones.
3. Comparar estados de carga, vacío, datos, error y recuperación, además de teclado
   y anchos. Volumen conserva su escena 3D; las señales observadas no se confunden
   con actividad simulada ni se añaden datos para rellenar una composición.
4. Comprobar compilación y apertura nativa, actualizar README/Roadmap y cerrar con
   un commit revisado antes de avanzar a otra pantalla.

El trabajo visual y la sustitución de framework se coordinan, pero se verifican
por separado. No se añade una segunda implementación de las funciones de
Conversación para reproducir la maqueta.

## Exploraciones anteriores

Observatorio y Cuaderno fueron maquetas privadas de organización, sin adoptar.
La posterior evolución CSS sobre las 15 rutas reales también quedó como estudio
previo; sus capturas y comprobación de 22 SVG intactos no certifican el nuevo tema.
Estos archivos permanecen en `experiments/` y la evidencia en `runtime/artifacts/`,
ambas ubicaciones excluidas de Git. Ninguna exploración sustituye el contenido
de las pantallas del producto.
