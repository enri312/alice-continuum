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
- Dieciocho SVG funcionales se generan desde cero mediante `scripts/generate-alice-icon-system.mjs`; `nav-memory.svg` y la base de `nav-conversation.svg` fueron aportados por el propietario y adaptados como fuentes manuales. `nav-avatar.svg` y `bridge-face.svg` son composiciones manuales originales y el generador debe preservarlas. Los 22 usan un lienzo de `200 × 200` y escenas semánticas basadas en el contenido real de sus pantallas. Conversación no declara voz implementada: muestra entrada textual, revisión de contexto y autorización, con micrófono `SAFE OFF`. Avatar usa una estación de personalización VRM sin rostro ni figura humana: cabello, conjunto techwear, arnés, botas, rig, biblioteca de 12 clips, archivo privado y DualSense aparecen como activos separados. Ninguna animación desplaza su geometría; sólo pulsa lentamente la intensidad de LEDs. Rostro usa un calibrador óptico diferente con cámara y perfil humano abstracto, cinco dependencias en cero, ocho canales reservados, cámara apagada y video no almacenado; no presenta tracking ficticio. La navegación reserva `108 × 112 px` por destino y muestra el SVG a `98 × 98 px`.
- La referencia de Cyrcetech se limita a principios visuales observables. No se copian, importan ni distribuyen sus archivos.
- `icons/app-alice.svg` y `src-tauri/icons/` permanecen fuera del alcance.

## Consecuencias

La navegación hace visibles las cuatro responsabilidades cognitivas y cada pantalla puede evolucionar sin convertir el Núcleo en un selector cada vez más denso. Los SVG pesan más que los glifos planos anteriores; el build debe vigilar este coste. Los botones que alojan los iconos siguen siendo el nombre accesible de cada destino.
