# ADR-P-054 — Sistema de iconos holográficos planos

- Estado: reemplazada por ADR-P-063
- Fecha: 2026-08-11
- Reemplaza: ADR-P-053

## Contexto

El experimento cyber-isométrico confirmó que una carcasa 3D sólida consume demasiado espacio visual y hace que funciones distintas compartan una silueta dominante. Como referencia de lenguaje visual se estudió una colección externa de iconos técnicos; no se incorporaron ni copiaron sus archivos.

## Decisión

Alice adopta 21 SVG funcionales originales y planos:

- 16 iconos de navegación y vistas con silueta propia;
- 5 controles de cámara igualmente planos;
- degradados independientes adecuados a cada función;
- capas concéntricas, nodos, circuitos, marcos parciales y espacio negativo para conservar complejidad sin simular volumen;
- animaciones exclusivamente decorativas y compatibles con `prefers-reduced-motion`;
- `role="img"` y `aria-label` en cada recurso.

El emblema `icons/app-alice.svg` y `src-tauri/icons/` continúan congelados. Una futura familia 3D podrá evaluarse para formatos que realmente soporten profundidad, sin reemplazar automáticamente estos recursos de interfaz.

## Consecuencias

Los iconos se leen mejor a tamaño reducido, pesan menos que ilustraciones rasterizadas y continúan siendo locales, auditables e importables mediante `?raw`. Un icono nuevo deberá ser reconocible por su silueta antes de aplicar color; no podrá depender de una carcasa común para comunicar su función.
