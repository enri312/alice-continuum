# ADR-P-039 — Documento maestro formal con identidad Alice

Fecha: 2026-08-08  
Estado: aceptada e implementada

## Contexto

El documento maestro ya reunía la evolución técnica de Alice, pero su presentación conservaba un tema visual ajeno al tablero y no mostraba en una portada e índice visibles toda la estructura esperable en una práctica de Ingeniería de Software. El documento de Skytech demostró una disciplina útil: control documental, requisitos verificables, casos completos, restricciones, anexos, trazabilidad e historial.

## Decisión

- Mantener `docs/alice_documento_maestro.html` como fuente de verdad legible sin servidor.
- Adoptar el lenguaje visual del producto: fondo azul marino, cuadrícula, cian operativo, ámbar de advertencia y violeta del Núcleo.
- Separar el tema en `docs/assets/alice-documento.css` para que contenido y presentación puedan evolucionar sin mezclarse.
- Incluir portada formal, índice navegable, actores, requisitos, diez casos de uso, restricciones, arquitectura, seguridad, operación, calidad, trazabilidad, decisiones, historial, glosario y créditos.
- Ofrecer un modo de impresión claro en A4, sin navegación lateral, fondos pesados ni pérdida de legibilidad.
- Usar Skytech solamente como referencia de práctica documental; Alice conserva contenido, estructura semántica e identidad propios.
- Validar sintaxis, identificadores, enlaces internos, recursos locales, representación visual y puertas de calidad antes de registrar la versión.

## Consecuencias

- La versión documental 0.13 puede utilizarse tanto como tablero técnico local como base para una entrega académica o PDF.
- La trazabilidad conecta objetivos, requisitos, casos y evidencias reales del repositorio.
- Las cifras de calidad se derivan de la suite vigente: 28 pruebas TypeScript y 14 pruebas Rust.
- Cualquier capacidad futura debe actualizar el documento y su evidencia antes de considerarse terminada.
- La hoja CSS pasa a ser parte del contrato documental y debe incluirse al mover o publicar el HTML.

## Evidencia

La verificación estructural y visual se registra en `docs/testing/MASTER_DOCUMENT_REPORT_2026-08-08.md`.
