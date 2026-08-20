# ADR-P-064 — Pantallas cognitivas e iconos técnicos

- Estado: aceptada
- Fecha: 2026-08-12
- Reemplaza: ADR-P-063

## Contexto

El panel Núcleo agrupaba cuatro responsabilidades distintas en un selector interno: volumen cognitivo, flujo cognitivo, estado y controles, y planificador de acción. Esa agrupación ocultaba la arquitectura de Alice detrás de una sola pantalla. A la vez, la familia anterior de iconos no reflejaba el lenguaje técnico de chasis, cristal y estado activo usado como referencia visual por Cyrcetech.

## Decisión

- Cada área cognitiva tiene ahora una pantalla y una ruta propias dentro de `src/Page/`: `Volumen.tsx`, `Flujo.tsx`, `Estado.tsx` y `Planificador.tsx`. La clave de navegación `nucleo` se conserva únicamente como alias compatible del volumen neuronal.
- `nucleus-shared.tsx` concentra únicamente la lectura pasiva del snapshot R3 y el marco común; no inventa actividad ni decisiones.
- Las cuatro rutas permanecen en el espacio `cognitive` y son accesibles desde la navegación principal.
- Los veintidós SVG funcionales se generan desde cero mediante `scripts/generate-alice-icon-system.mjs` como teclas redondeadas de glifo grueso con escena semántica basada en el contenido real de cada pantalla, etiqueta inferior y colores por área; `nav-avatar.svg` es la única composición manual protegida y conserva la consola técnica de chasis multicapa que fija el lenguaje de la familia. La barra de controles de cámara comparte el estilo tecla y no se confunde con destinos de navegación. Conversación no declara voz implementada: muestra entrada textual, revisión de contexto y autorización, con micrófono `SAFE OFF`. Avatar usa una estación de personalización VRM sin rostro ni figura humana: cabello, conjunto techwear, arnés, botas, rig, biblioteca de 12 clips, archivo privado y DualSense aparecen como activos separados. Las animaciones son decorativas y acotadas (órbitas de datos, escaneos, parpadeos y flujos de estado); no desplazan la geometría estructural y se desactivan con `prefers-reduced-motion`. Rostro usa un calibrador óptico diferente con cámara y perfil humano abstracto, cinco dependencias en cero, ocho canales reservados, cámara apagada y video no almacenado; no presenta tracking ficticio. La navegación reserva `108 × 112 px` por destino y muestra el SVG a `98 × 98 px`.
- La referencia de Cyrcetech se limita a principios visuales observables. No se copian, importan ni distribuyen sus archivos.
- `icons/app-alice.svg` y `src-tauri/icons/` permanecen fuera del alcance.

## Consecuencias

La navegación hace visibles las cuatro responsabilidades cognitivas y cada pantalla puede evolucionar sin convertir el Núcleo en un selector cada vez más denso. Los SVG pesan más que los glifos planos anteriores; el build debe vigilar este coste. Los botones que alojan los iconos siguen siendo el nombre accesible de cada destino.

## Nota de vigencia (2026-08-20)

A solicitud del propietario, `nav-avatar.svg` se rehízo desde cero para reflejar el contenido real de la pantalla Avatar: visor 3D con maniquí sin rostro y rig visible, estado `MODELO CARGADO`, inspector VRM (huesos, 14 expresiones, springs, 12 clips, catálogo facial de solo lectura y licencia privada), control manual DualSense auditado en R3 y las cuatro fronteras de conexión (01 render activo; 02 expresión, 03 voz y 04 ragdoll desconectados). Se conservan el lienzo `200 × 200`, la política de movimiento decorativo desactivable y su condición de única fuente manual protegida. Los otros 22 iconos funcionales se rediseñaron como teclas redondeadas de glifo grueso con escena semántica real y colores por área, incluidos los cinco controles de cámara; `nav-audit` pasó a un escudo forense con cadena de evidencia y `nav-settings` adoptó una paleta gris de gobierno con engranaje y deslizadores. En la misma fecha el propietario autorizó rediseñar el emblema `icons/app-alice.svg` con más detalle (retícula, tornillería, trazas, anillo orbital y ticks) manteniendo su identidad; `src-tauri/icons/` continúa congelado.
