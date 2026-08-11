# ADR-P-053 — Sistema de iconos cyber-isométricos 3D

- Estado: reemplazada por ADR-P-054
- Fecha: 2026-08-11

La familia cyber-isométrica fue implementada y verificada, pero se descartó como estilo vigente porque el volumen sólido resultaba más apropiado para otros formatos. Se conserva este documento para registrar el experimento y la razón del cambio.

## Contexto

Los iconos funcionales anteriores resultaban demasiado simples y varios compartían una apariencia casi intercambiable. Alice necesita una navegación técnica reconocible a primera vista, pero el emblema oficial de la aplicación ya está aprobado y no debe cambiar.

## Decisión

Se adopta una familia de 21 SVG funcionales construida directamente en el repositorio:

- 16 iconos de navegación y vistas con carcasa angular, bisel exterior, tornillos, rieles iluminados, circuitos asimétricos, códigos HUD, volumen central isométrico y caras sólidas;
- 5 controles de cámara con el mismo lenguaje en formato compacto;
- un color dominante distinto por función principal, elegido según su semántica;
- movimiento puramente decorativo y desactivable mediante `prefers-reduced-motion`;
- etiquetas accesibles mediante `role="img"` y `aria-label`.

El emblema `icons/app-alice.svg` y los recursos de `src-tauri/icons/` quedan fuera del alcance y se consideran congelados para este cambio.

## Consecuencias

Los SVG siguen siendo locales, auditables y compatibles con la importación `?raw` usada por React. La familia comparte construcción cyber/HUD, no color: repetir la carcasa preserva coherencia, mientras el acento único evita confundir funciones. Cualquier icono funcional nuevo deberá mantener profundidad, legibilidad a tamaño reducido y un acento no asignado previamente.
