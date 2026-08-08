# ADR-P-040 — Diagramas SVG autónomos

Fecha: 2026-08-08  
Estado: aceptada e implementada

## Contexto

La versión 0.13 del documento maestro contenía bloques conceptuales y tablas, pero omitía los diagramas formales que permiten comprender relaciones, secuencias y límites con mayor rapidez. Además, el HTML debe continuar funcionando desde el disco local, sin servidor ni conexión a Internet.

## Decisión

- Mantener cada diagrama como un SVG independiente dentro de `docs/assets/diagrams/`.
- Documentar seis vistas: contexto, componentes, casos de uso, secuencia de conversación, ciclo de memoria y modelo lógico de datos.
- Usar el lenguaje visual de Alice y no reutilizar los diagramas ni la marca de Skytech.
- Incluir `title`, `desc`, texto alternativo, pie numerado y enlace al SVG original.
- Diferenciar de forma explícita las entidades o relaciones futuras de las capacidades implementadas.
- Evitar Mermaid, JavaScript, fuentes remotas y otras dependencias que impidan abrir el documento sin conexión.

## Consecuencias

- Los diagramas pueden inspeccionarse, ampliarse, imprimirse y versionarse por separado.
- La versión 0.14 del documento maestro ya no depende únicamente de explicaciones textuales.
- Un cambio estructural futuro debe actualizar tanto el diagrama afectado como su tabla o requisito asociado.

## Evidencia

Los seis SVG se validan en `docs/testing/MASTER_DOCUMENT_REPORT_2026-08-08.md` y se integran en `docs/alice_documento_maestro.html`.
