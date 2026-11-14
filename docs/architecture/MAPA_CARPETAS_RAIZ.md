# Mapa de las carpetas de la raíz

La raíz es `D:\Alice Continuum` en esta instalación. Las rutas son relativas a
ella y los comandos se ejecutan desde allí. Este mapa distingue archivos del
proyecto, datos privados y resultados regenerables; mover una carpeta exige
revisar sus consumidores y probarlos antes de cambiarla.

| Carpeta | Función y tratamiento |
|---|---|
| `src/` | Interfaz React, componentes, estilos y lógica TypeScript. Estado y controles se presenta mediante un puente a Dioxus. |
| `crates/` | Módulos Rust independientes; `state-controls/` contiene la pantalla Dioxus. |
| `Backend/` | `src-tauri/` contiene la aplicación nativa, memoria y configuración Tauri; `adapters/` contiene adaptadores Python. |
| `icons/` | SVG editables de la interfaz y del emblema. `src/components/icons/` los incorpora a las pestañas y controles de cámara. |
| `public/` | Recursos estáticos servidos por Vite, incluidas licencias. El paquete Dioxus de Estado se genera en `src/dioxus/state-controls/pkg/`. |
| `scripts/` | Generación de iconos, compilación Dioxus, respaldos, proyección Obsidian, instalación y pruebas. Algunos pilotos requieren servicios o modelos instalados y no forman parte del arranque. |
| `docs/` | Manuales, arquitectura, decisiones y resultados de pruebas. Los informes con fecha describen su momento; no todos son instrucciones vigentes. |
| `data/` | Memoria, conversación, auditorías y bóveda Obsidian privadas. El contenido no se publica en Git. `ALICE_DATA_DIR` permite usar una raíz de datos diferente. |
| `local/` | Configuración, recursos y evidencias privadas; algunas guías están versionadas. No confundirlo con una carpeta vacía de trabajo temporal. |
| `experiments/` | Ensayos privados separados del producto principal. Se excluyen de Git; el respaldo recupera sus fuentes aplicando las exclusiones documentadas. |
| `.github/` | Flujos de integración y comprobaciones del repositorio. |
| `.cargo/` | Configuración de Cargo y ubicación del directorio de compilación. |
| `.git/` | Historial y configuración local del repositorio. |
| `node_modules/` | Dependencias instaladas con npm; regenerables, excluidas de Git. |
| `dist/` | Resultado de compilación del frontend; regenerable, excluido de Git. Tauri lo usa al empaquetar. |
| `.cargo-target/` | Resultados y caché de compilación Rust; regenerables, excluidos de Git. |

Los lanzadores, manifiestos de npm y configuración de Vite, TypeScript y Rust
permanecen en la raíz porque son puntos de entrada o los descubren herramientas.
No debe borrarse una carpeta generada durante una ejecución. Antes de limpiar
archivos privados o mover código, comprobar sus referencias y el respaldo.

## Iconos: qué se usa

- `src/components/icons/NavigationIcon.tsx` carga SVG de `icons/` y los dibuja
  en las pestañas de `src/App.tsx`, incluidas Memoria y Estado y controles.
- `InlineSvgIcon.tsx` los presenta y también dibuja los cinco controles de cámara
  de Volumen cognitivo. Sólo recibe SVG incluidos en la compilación.
- `BridgeViewIcon.tsx` está conectado a la variante de Puentes con selector de
  vistas; la navegación actual abre vistas fijas y no muestra ese selector.

La guía [Componentes de iconos](../../src/components/icons/README.md) y la
[revisión de reorganización](REORGANIZACION_2026-11-14.md) contienen más detalle.

## Verificación de rutas

Las pruebas comprueban las rutas de recursos literales compilados por Rust,
incluyendo módulos que no se ejecutan en Windows, y la renderización de iconos
de navegación. Las pruebas de respaldo y Obsidian usan datos ficticios y raíces
aisladas; no sustituyen una prueba de la instalación personal ni del micrófono.
La copia de seguridad verificada incluye código, datos y los elementos privados
permitidos por su política; no equivale a una copia fuera del disco D:.
