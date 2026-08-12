# ADR-P-064 — Pantallas cognitivas e iconos técnicos

- Estado: aceptada
- Fecha: 2026-08-12
- Reemplaza: ADR-P-063

## Contexto

El panel Núcleo agrupaba cuatro responsabilidades distintas en un selector interno: volumen cognitivo, flujo cognitivo, estado y controles, y planificador de acción. Esa agrupación ocultaba la arquitectura de Alice detrás de una sola pantalla. A la vez, la familia anterior de iconos no reflejaba el lenguaje técnico de chasis, cristal y estado activo usado como referencia visual por Cyrcetech.

## Decisión

- Cada área cognitiva tiene ahora una pantalla y una ruta propias dentro de `src/Page/`: `Nucleo.tsx`, `Flujo.tsx`, `Estado.tsx` y `Planificador.tsx`.
- `nucleus-shared.tsx` concentra únicamente la lectura pasiva del snapshot R3 y el marco común; no inventa actividad ni decisiones.
- Las cuatro rutas permanecen en el espacio `cognitive` y son accesibles desde la navegación principal.
- Los 22 SVG funcionales adoptan un lienzo de `200 × 200`, chasis metálico, capas de cristal, detalles de fijación, paneles luminosos y acentos de color por función.
- La referencia de Cyrcetech se limita a principios visuales observables. No se copian, importan ni distribuyen sus archivos.
- `icons/app-alice.svg` y `src-tauri/icons/` permanecen fuera del alcance.

## Consecuencias

La navegación hace visibles las cuatro responsabilidades cognitivas y cada pantalla puede evolucionar sin convertir el Núcleo en un selector cada vez más denso. Los SVG pesan más que los glifos planos anteriores; el build debe vigilar este coste. Los botones que alojan los iconos siguen siendo el nombre accesible de cada destino.
