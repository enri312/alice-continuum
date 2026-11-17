# Mapa de las carpetas de la raíz

La raíz es `D:\Alice Continuum` en esta instalación. Las rutas son relativas a
ella y los comandos se ejecutan desde allí. Este mapa distingue archivos del
proyecto, datos privados y resultados regenerables; mover una carpeta exige
revisar sus consumidores y probarlos antes de cambiarla.

| Carpeta | Función y tratamiento |
|---|---|
| `Frontend/` | Workspace de interfaz: `src/`, estilos, iconos, recursos públicos, entrada/configuración Vite/TypeScript y `crates/state-controls/` con Rust/Dioxus. Su `dist/` es regenerable. |
| `Backend/` | `src-tauri/` contiene la aplicación nativa, memoria y configuración Tauri; `adapters/` contiene adaptadores Python. |
| `scripts/` | Generación de iconos, compilación Dioxus, respaldos, proyección Obsidian, instalación y pruebas. Algunos pilotos requieren servicios o modelos instalados y no forman parte del arranque. |
| `docs/` | Manuales, guías operativas y contratos técnicos vigentes. El [índice](../README.md) incluye el acceso al archivo histórico. |
| `data/` | Memoria, conversación, auditorías y bóveda Obsidian privadas. El contenido no se publica en Git. `ALICE_DATA_DIR` permite usar una raíz de datos diferente. |
| `runtime/` | Configuración y recursos instalados; `artifacts/` para pruebas, `cache/` para cachés, `archives/` para recuperaciones, `drafts/` para originales de trabajo y `maintenance/` para intervenciones puntuales. Algunas guías están versionadas. |
| `experiments/` | Ensayos privados separados del producto principal. Se excluyen de Git; el respaldo recupera sus fuentes aplicando las exclusiones documentadas. |
| `.github/` | Flujos de integración y comprobaciones del repositorio. |
| `.cargo/` | Configuración de Cargo y ubicación del directorio de compilación. |
| `.git/` | Historial y configuración local del repositorio. |
| `node_modules/` | Dependencias npm compartidas del workspace; regenerables y excluidas de Git. No son código propio ni se borran durante una ejecución. |
| `.cargo-target/` | Resultados y caché de compilación Rust; regenerables, excluidos de Git. |

Los lanzadores y los manifiestos de coordinación npm permanecen en la raíz.
Vite, TypeScript y la entrada HTML viven en `Frontend/`; las herramientas comunes
`.cargo/`, `.node-version` y `rust-toolchain.toml` siguen en la raíz. Hay un único
`package-lock.json`; las dependencias de interfaz están declaradas en
`Frontend/package.json`. Los comandos habituales desde la raíz delegan al workspace.
No debe borrarse una carpeta generada durante una ejecución. Antes de limpiar
archivos privados o mover código, comprobar sus referencias y el respaldo.

Las guías de [`runtime/`](../../runtime/README.md) y [`data/`](../../data/README.md)
explican sus ubicaciones y límites. La [revisión del 15 de noviembre](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/LOCAL_DATA_ORGANIZATION_REPORT_2026-11-15.md)
reubicó evidencias y auxiliares; mantuvo los datos operativos, modelos, entornos
y herramientas en sus rutas activas. Las nuevas pruebas Dioxus escriben en
`runtime/artifacts/dioxus/{browser,native}/`. Los scripts privados de
`runtime/maintenance/` son históricos y requieren revisar rutas antes de reutilizarlos.

## Iconos: qué se usa

- `Frontend/src/components/icons/NavigationIcon.tsx` carga SVG de `Frontend/icons/`
  y los dibuja en las pestañas de `Frontend/src/App.tsx`, incluidas Memoria y Estado.
- `InlineSvgIcon.tsx` los presenta y también dibuja los cinco controles de cámara
  de Volumen cognitivo. Sólo recibe SVG incluidos en la compilación.
- `BridgeViewIcon.tsx` está conectado a la variante de Puentes con selector de
  vistas; la navegación actual abre vistas fijas y no muestra ese selector.

La guía [Componentes de iconos](../../Frontend/src/components/icons/README.md) y la
[revisión de reorganización](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/architecture/REORGANIZACION_2026-11-14.md) contienen más detalle.

## Verificación de rutas

Las pruebas comprueban las rutas de recursos literales compilados por Rust,
incluyendo módulos que no se ejecutan en Windows, y la renderización de iconos
de navegación. Las pruebas de respaldo y Obsidian usan datos ficticios y raíces
aisladas; no sustituyen una prueba de la instalación personal ni del micrófono.
La copia de seguridad verificada incluye código, datos y los elementos privados
permitidos por su política; no equivale a una copia fuera del disco D:.
