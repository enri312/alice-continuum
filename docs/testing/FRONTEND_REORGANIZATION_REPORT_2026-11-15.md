# Reubicación de la interfaz en Frontend

Fecha: 2026-11-15. Alcance: ordenar fuentes y herramientas sin cambiar el diseño,
el contenido ni los formatos de persistencia. No migra otra pantalla a Dioxus.

## Estructura y rutas

Se trasladaron `src/`, `icons/`, `public/`, `crates/`, `dist/`, `index.html`,
`vite.config.ts` y los tres `tsconfig*.json` a `Frontend/`. El crate Dioxus
pertenece a la interfaz; el backend Rust/Tauri y sus iconos nativos permanecen
en `Backend/`. `data/`, `runtime/` y `experiments/` no se trasladaron.

`Frontend/package.json` declara las dependencias de interfaz. La raíz coordina
el workspace npm, conserva el lockfile único, Tauri, pruebas integrales y
lanzadores. `npm run dev`, `npm run build`, `npm run preview`, `npm test` y los
comandos Dioxus/iconos se siguen ejecutando desde la raíz. Las dependencias
compartidas y la caché Rust permanecen en `node_modules/` y `.cargo-target/`.
No se tratan como archivos sobrantes ni se borraron como parte del traslado.

Se actualizaron el destino `Frontend/dist/` de Tauri, la configuración de Vite,
los generadores, importaciones de pilotos, pruebas y rutas CI del crate. Vite
mantiene la proyección Obsidian ligada a la raíz real del repositorio, no al
workspace de interfaz. Conserva el bloqueo de datos y archivos privados tanto
dentro de la raíz de desarrollo como en sus directorios hermanos.

El [mapa de la raíz](../architecture/MAPA_CARPETAS_RAIZ.md), la estructura,
README y Roadmap describen las rutas actuales. Los enlaces de nueve documentos
se ajustaron sólo cuando el nuevo destino existe; no se reinterpretan las
conclusiones de inventarios históricos ni se borran sus archivos recomendados.

## Comprobaciones

- Se comparó SHA-256 antes y después en **293 archivos** de código, Rust,
  bindings/WASM, iconos y recursos. No cambiaron. Las guías y configuraciones
  que debían documentar o resolver rutas se revisan por separado.
- La resolución del workspace se actualizó mediante npm offline. Las versiones
  ya fijadas en `package-lock.json` no cambiaron. `npm ci --dry-run --offline
  --ignore-scripts` aprobó la consistencia del lockfile; no se presenta como una
  instalación completa desde cero en otro equipo.
- `npm run dioxus:check` y `npm run build`: aprobados desde la raíz. Los nombres
  hash de los bundles, CSS y WASM coinciden con el build anterior. Persiste el
  aviso previo de chunks mayores de 500 kB.
- `npm test`: **894 pruebas Vitest** aprobadas, dos omitidas; **15** Obsidian,
  **20** respaldos y **dos** privacidad aprobadas. Las siete comprobaciones
  añadidas verifican las rutas/workspace y que no se sirvan archivos privados
  hermanos de `Frontend` aunque se permita leer el workspace de pruebas.
- Crate Rust desde su nueva ruta: **25 pruebas**, Rustfmt y Clippy WASM con
  `-D warnings` aprobados. No fue necesario regenerar el WASM, que conserva
  los hashes verificados de fuentes y artefactos.
- `cargo check --locked --offline --manifest-path Backend/src-tauri/Cargo.toml
  --features tauri/custom-protocol`: aprobado. Comprueba que el backend puede
  incorporar los recursos de `Frontend/dist/`. El lanzador Windows `--check`
  también aprobó sus rutas y requisitos de desarrollo.
- Edge aislado sobre el build nuevo: aprobado. Conserva 11 nodos, navegación,
  teclado, formulario/confirmaciones, sondeo R3 sin solapamientos, cancelación
  al navegar y recuperación ante descarga WASM fallida. Evidencia privada en
  `runtime/artifacts/dioxus/browser/dioxus-browser-rOpNAp/`.
- Tauri/WebView2 real: **aprobado** con el backend real y fuentes sintéticas.
  Abrió Conversación y Estado/Flujo, inspector y R3; revisó y confirmó una
  relación, canceló su retirada y comprobó persistencia al recargar. Las fuentes
  conservaron su SHA-256. Captura revisada y resultado en
  `runtime/artifacts/dioxus/native/dioxus-native-3oQOrX/`. No usa mocks de IPC ni recuerdos personales.
- Lanzador habitual: tras la prueba aislada, inició Vite desde el workspace y
  abrió la ventana normal de Alice. La página y `/src/main.tsx` respondieron
  HTTP 200 en el servidor de desarrollo. Se dejó Alice abierta.

## Límites y recuperación

Las pruebas aisladas no activaron modelos, voz ni dispositivos. La CI de
Ubuntu usa las rutas nuevas, pero este incremento se ejecutó en Windows; no
declara una nueva aceptación de Linux o macOS. Las vistas de recuperación y el
host React siguen siendo necesarios según el inventario de migración.

Respaldo previo creado y verificado en
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-15T06-38-42-810Z-bc5844d1-9121-47a8-a536-229d6dc80d1b`.
Las evidencias y el inventario de hashes están en `runtime/`, excluido de Git.
El documento personal `docs/herramientas-y-persistencia-alice.md` permanece
sin cambios y fuera del commit.
