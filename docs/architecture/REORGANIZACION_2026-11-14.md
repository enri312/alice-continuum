# Organización del proyecto — 14 de noviembre de 2026

Revisión posterior: el [mapa de carpetas de la raíz](MAPA_CARPETAS_RAIZ.md)
describe las fuentes, datos privados y resultados generados. Se corrigió el árbol
de `PROJECT_STRUCTURE.md` y los pilotos `llama-memory-pilot.mjs` y
`conversation-reference-eval.mjs` leen de nuevo las instrucciones de Rust,
incluidas las declaraciones `concat!` con archivos `include_str!`. Sus pruebas
verifican la reconstrucción del texto; las evaluaciones con modelos reales no se
ejecutaron en esta revisión.

En la revisión posterior se arrancó Tauri con `ALICE_DATA_DIR` y perfil WebView
aislados en `local/`: un recuerdo ficticio terminado apareció en la lista y en
el contador de Memoria, y se observaron los iconos de navegación. El autoestudio
estaba pausado; no se usaron los recuerdos personales, el modelo ni el micrófono.

El backend Rust/Tauri se trasladó de `src-tauri/` a `Backend/src-tauri/` y los
adaptadores Python de `scripts/adapters/` a `Backend/adapters/`. Se actualizaron
las rutas de compilación, Python, documentación, pruebas y CI. Los datos de
`data/`, los modelos, las credenciales y `experiments/` no se trasladaron.

## Iconos

`src/components/icons/` contiene adaptadores de presentación, mientras `icons/`
contiene los SVG versionados:

- `NavigationIcon.tsx` se usa en las pestañas principales de `App.tsx`.
- `InlineSvgIcon.tsx` se usa para los SVG de navegación y los controles de cámara.
- `BridgeViewIcon.tsx` se usa en la variante no fijada de `CapabilityRegistryPage`;
  se conserva aunque la navegación actual utilice vistas fijadas.
- `NucleusViewIcon.tsx` no tenía importadores y se retiró del código activo.
  La escena anterior `scripts/icons/legacy/activity-timeline-scene.mjs` tampoco
  tenía importadores y se retiró. Ambos están en el historial Git y en
  `local/cleanup-archive-2026-11-14/`, excluido de Git.

Los generadores y SVG activos permanecen en su lugar; los iconos de Tauri se
conservaron junto con el backend trasladado. Se retiró el comparador antiguo
`scripts/testing/compare-local-models.mjs`:
dependía de un formato de prompt que ya no existe y no tenía llamadas operativas;
se conservó junto a los dos archivos anteriores. No se eliminaron otros scripts sólo por no aparecer
como importados: algunos son ejecutables manuales o documentan pruebas históricas.
La sonda documental ahora crea su carpeta de capturas en `local/artifacts/`, en
lugar de dejar un directorio `artifacts/` en la raíz.
El [catálogo de 2026-11-06](../catalogo-archivos/README.md) es un inventario
histórico; sus propuestas de borrado requieren validación individual.

## Rutas de uso

Los lanzadores siguen en la raíz; `npm run dev`, `npm run build` y `npm test`
siguen ejecutándose desde ella. Los comandos Cargo usan el manifiesto
`Backend/src-tauri/Cargo.toml`. `Backend/README.md` describe la separación.
Las carpetas `node_modules/`, `dist/` y `.cargo-target/` contienen dependencias
o resultados regenerables; no son fuentes ni deben borrarse durante una ejecución.

La migración se ensayó primero en una copia aislada en `local/`, con autoestudio
desactivado y datos separados. El respaldo anterior a la reorganización está en
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-14T12-50-10-779Z-b45c1c49-703b-4ed9-a412-732720356dc6`.

El backend en la ruta definitiva aprobó 420 pruebas Rust (32 omitidas), las 866
pruebas de interfaz (2 omitidas), 15 de Obsidian, 20 de respaldo y 2 de privacidad.
También pasaron Rustfmt, Clippy con `-D warnings`, la compilación con
`tauri/custom-protocol` y la comprobación del lanzador Windows.
Los adaptadores Python ejecutaron 18 pruebas en Windows y omitieron una exclusiva
de Linux. También pasó una lectura real del manual mediante el intérprete y el
adaptador instalados, sin escribir recuerdos. La aplicación arrancó en Tauri con
memoria y perfil WebView aislados;
se revisaron la navegación, los iconos, la actividad R3 y Estado y controles.
No se realizó una prueba con el modelo, el micrófono o los datos personales.
