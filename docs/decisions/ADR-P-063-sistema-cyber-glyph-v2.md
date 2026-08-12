# ADR-P-063 — Sistema Cyber Glyph V2

- Estado: reemplazada por ADR-P-064
- Fecha: 2026-08-11
- Reemplaza: ADR-P-054

## Contexto

La familia holográfica plana confirmó que SVG es el formato correcto para la interfaz, pero su acumulación de marcos, líneas concéntricas y adornos técnicos debilitó la lectura de algunas funciones. El catálogo también creció de 21 a 22 piezas al incorporar Procedimientos. El emblema oficial de Alice está aprobado y no pertenece a la navegación.

## Decisión

Alice adopta Cyber Glyph V2 para sus 22 iconos funcionales:

- diez destinos de navegación, tres vistas de puentes, cuatro vistas del Núcleo y cinco controles de cámara;
- silueta central diferente y relacionada directamente con la función;
- color principal diferenciado, superficies sólidas y detalle técnico secundario;
- lienzo `64 × 64` para navegación y vistas, y `48 × 48` para controles;
- `role="img"`, `aria-label` y `title` en cada fuente SVG;
- archivos exclusivamente locales, sin scripts, `foreignObject`, imágenes embebidas ni vínculos externos;
- contrato Vitest que comprueba cantidad, unicidad, accesibilidad, seguridad y lienzo.

`icons/app-alice.svg` y todo `src-tauri/icons/` quedan explícitamente fuera del alcance y congelados.

## Consecuencias

Las figuras se reconocen mejor a tamaños reducidos y la paleta diferencia áreas sin convertirse en el único portador de significado. El sistema pierde animaciones decorativas innecesarias, reduce el peso total de los SVG funcionales y queda protegido por pruebas repetibles. Cualquier pieza nueva deberá añadirse al catálogo de pruebas y conservar estas reglas.
