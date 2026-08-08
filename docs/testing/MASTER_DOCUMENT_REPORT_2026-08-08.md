# Informe del documento maestro v0.16

Fecha: 2026-08-08  
Estado: aprobado

## Objetivo

Convertir `docs/alice_documento_maestro.html` en el documento rector formal de Alice, con la identidad visual del producto y una cobertura comparable a una práctica académica completa de Ingeniería de Software.

## Referencia documental

Se consultó `E:\SKYTECH\documentacion_tecnica.html` únicamente como referencia de organización. No se modificó Skytech ni se copiaron su contenido, identidad o datos. Se adoptaron las prácticas útiles: portada formal, índice visible, requisitos, casos de uso, restricciones, trazabilidad, control de cambios y preparación para impresión.

## Resultado

- Tema propio en `docs/assets/alice-documento.css`: azul marino, cuadrícula, cian operativo, ámbar de advertencia y violeta del Núcleo.
- Portada con autor, formación, versión documental y versión de producto.
- Autoría corregida a Carlos Nuñez y ficha de portada reducida a autor y formación, sin institución ni fecha de actualización.
- Firma del Núcleo rediseñada como un módulo HUD: código del sistema, identidad Alice y señales cognitivo/local/observable.
- Capítulo 7 rediseñado como un pipeline cognitivo de cinco etapas: Percepción, Memoria, Workspace, Planificador y Salida.
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
| Evidencia visual | `artifacts/alice-documento-portada-v015.png`, `artifacts/alice-diagramas-sheet-v015-approved.png` y `artifacts/alice-nucleo-documento-v016.png` |

La primera revisión visual encontró un solapamiento entre las etiquetas de versión y la ficha académica. Se corrigió cambiando la ficha a flujo normal y la tercera captura fue aprobada.

La revisión 0.14 inspeccionó los seis diagramas juntos a resolución de 1440 × 1200. Se corrigió la etiqueta del ramal de corrección en el ciclo de memoria y se confirmó que cada figura mantiene legibilidad, jerarquía cromática y correspondencia con el texto asociado.

La revisión 0.15 verificó la nueva portada a 1440 × 1000: autor y formación ocupan dos columnas equilibradas, los campos retirados ya no aparecen y la firma del Núcleo conserva lectura clara. También se volvieron a renderizar los diagramas después de sustituir el actor por Carlos Nuñez.

La revisión 0.16 sustituyó el antiguo esquema de dos hemisferios y círculo central por un mapa funcional. La captura a 1440 × 800 confirmó lectura continua, estados honestos, separación cromática por etapa y políticas visibles de memoria local, nube externa y aprobación de acciones.

La corrección de identidad se aplicó igualmente al prompt nativo, etiquetas del chat, fuente de enseñanza, contexto de nube, Núcleo y pruebas asociadas. El repositorio ya no contiene referencias versionadas al nombre anterior. Después del cambio aprobaron 28 pruebas TypeScript, 14 pruebas Rust, ambas compilaciones, formato y `clippy -D warnings`.

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
