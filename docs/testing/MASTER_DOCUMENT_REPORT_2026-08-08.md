# Informe del documento maestro v0.14

Fecha: 2026-08-08  
Estado: aprobado

## Objetivo

Convertir `docs/alice_documento_maestro.html` en el documento rector formal de Alice, con la identidad visual del producto y una cobertura comparable a una práctica académica completa de Ingeniería de Software.

## Referencia documental

Se consultó `E:\SKYTECH\documentacion_tecnica.html` únicamente como referencia de organización. No se modificó Skytech ni se copiaron su contenido, identidad o datos. Se adoptaron las prácticas útiles: portada formal, índice visible, requisitos, casos de uso, restricciones, trazabilidad, control de cambios y preparación para impresión.

## Resultado

- Tema propio en `docs/assets/alice-documento.css`: azul marino, cuadrícula, cian operativo, ámbar de advertencia y violeta del Núcleo.
- Portada con autor, formación, institución, versión documental y versión de producto.
- Índice navegable de 20 capítulos y navegación lateral agrupada.
- 11 requisitos funcionales y 12 no funcionales verificables.
- 10 casos de uso con actor, precondición, flujo, alternativas, postcondición y requisitos asociados.
- 6 diagramas SVG: contexto, componentes, casos de uso, secuencia, ciclo de memoria y modelo lógico de datos.
- Restricciones de plataforma, hardware, persistencia, datos iniciales, adaptadores y avatar.
- Arquitectura por capas y mapa de los seis módulos del backend.
- Matriz de trazabilidad entre objetivos, requisitos, casos y evidencias.
- Estrategia de calidad, puerta de entrega, licencias, créditos, historial, ADR-P-039 y ADR-P-040.
- Hoja de impresión A4 clara para exportar el HTML a PDF.

## Validación documental

| Verificación | Resultado |
|---|---|
| Análisis con `html.parser` | Aprobado |
| Identificadores HTML | 22 únicos; ninguno duplicado |
| Enlaces internos | 42; ningún destino ausente |
| Recursos y enlaces locales únicos | 8; ninguno ausente |
| Capítulos numerados | 20 |
| Casos de uso | 10 |
| Diagramas SVG | 6/6 con XML válido, `title` y `desc` |
| Figuras integradas | 6/6 con texto alternativo, pie y enlace al original |
| Revisión real en Microsoft Edge | Aprobada |
| Evidencia visual | `artifacts/alice-documento-maestro-v013-approved.png` y `artifacts/alice-diagramas-sheet-v014-approved.png` |

La primera revisión visual encontró un solapamiento entre las etiquetas de versión y la ficha académica. Se corrigió cambiando la ficha a flujo normal y la tercera captura fue aprobada.

La revisión 0.14 inspeccionó los seis diagramas juntos a resolución de 1440 × 1200. Se corrigió la etiqueta del ramal de corrección en el ciclo de memoria y se confirmó que cada figura mantiene legibilidad, jerarquía cromática y correspondencia con el texto asociado.

## Regresión del proyecto

| Verificación | Resultado |
|---|---|
| `npm test` | 28/28 aprobadas |
| `npm run build` | Aprobada |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 14/14 aprobadas |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Aprobada; cero advertencias |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprobada |
| `cargo build --manifest-path src-tauri/Cargo.toml` | Aprobada |

Vite informa que el módulo diferido del Avatar supera 500 kB. Es un aviso de optimización, no un error: el módulo 3D continúa separado del paquete principal y la compilación finaliza correctamente.

## Protección de datos

La revisión no leyó ni modificó `E:\Alice`, `Assets/Alice.vrm` ni los recuerdos reales de `data/`. Credenciales, memoria, VRM, artefactos de compilación y dependencias continúan cubiertos por `.gitignore` cuando corresponde.
