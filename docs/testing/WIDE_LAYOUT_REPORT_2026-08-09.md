# Informe de distribución panorámica — 2026-08-09

## Objetivo

Aprovechar el espacio horizontal disponible en monitores de escritorio sin alargar el texto hasta volverlo difícil de leer ni alterar el diseño móvil.

## Cambio aplicado

- El marco principal pasó de un máximo de 1.040 px a 1.440 px.
- A partir de 1.280 px, los inspectores de Conversación, Núcleo y Puentes reciben 340, 260 y 320 px respectivamente.
- Los límites internos de lectura se mantienen; el ancho adicional se dedica a paneles, controles y visualizaciones.
- La regla móvil existente continúa activándose por debajo de 720 px y Conversación/Puentes conservan su columna única por debajo de 900 px.

## Verificación real

| Prueba | Resultado |
|---|---|
| Navegador Edge/Playwright, viewport 1.920×1.000 | marco de 1.440 px, márgenes de 240 px por lado |
| Desbordamiento horizontal | ninguno; `scrollWidth = viewportWidth = 1.920` |
| Captura completa | inspeccionada visualmente; encabezado, selector, pestañas, conversación y control de contexto permanecen alineados |
| TypeScript/Vitest | 68/68 aprobadas |
| Build TypeScript/Vite | aprobado |
| Build de escritorio Tauri en perfil `release` | aprobado; ejecutable generado |

La evidencia visual local se generó fuera del repositorio en `alice-wide-layout-1920.png`; no contiene claves, mensajes privados ni datos de sensores.
