# 02 · Raíz del proyecto, `.cargo/`, `.github/`, `public/` e `icons/`

Fecha de verificación: 2026-11-06  
Total cubierto en este documento: **46 archivos** (`15` en raíz + `1` en `.cargo/` + `1` en `.github/` + `7` en `public/` + `22` en `icons/`).

Volver al índice: [`README.md`](README.md) · Ver hallazgos de limpieza: [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)

---

## 1. Raíz del repositorio (`15` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 1 | [`.gitattributes`](../../.gitattributes) | **Activo** | Normaliza saltos de línea en Git: fuerza `LF` en código, configuración y documentos (`.rs`, `.ts`, `.tsx`, `.md`, `.json`, `.toml`, `.sh`, `.py`, etc.), fuerza `CRLF` en `*.cmd` para `cmd.exe` en Windows y declara binarios los iconos rasterizados (`.png`, `.ico`, `.icns`). |
| 2 | [`.gitignore`](../../.gitignore) | **Activo (con reglas heredadas)** | Excluye `node_modules/`, `dist/`, `.env*`, claves privadas, cachés de Rust (`Backend/src-tauri/target/`, `.cargo-target/`), datos personales (`data/*` salvo `data/README.md`), recursos locales (`local/*` salvo READMEs) y `/scripts/testing/.fixtures/`. *Nota:* conserva reglas de carpetas antiguas ya migradas (`/.openchamber/`, `/scratch/`, `/artifacts/`, `Assets/`, `/adapters/`, `/.venv-adapters/`). |
| 3 | [`.node-version`](../../.node-version) | **Activo** | Fija la versión exacta de Node.js en `26.13.0` (rama 26 LTS). Lo consumen automáticamente GitHub Actions (`ubuntu.yml`) y los lanzadores Windows/Linux. |
| 4 | [`index.html`](../../index.html) | **Activo** | Documento HTML raíz de Vite/Tauri (`lang="es"`, título `Alice Continuum`). Enlaza `/favicon.svg`, define `<div id="root"></div>` y carga `/src/main.tsx`. |
| 5 | [`Iniciar Alice Continuum.cmd`](../../Iniciar%20Alice%20Continuum.cmd) | **Activo (acoplado a ruta local)** | Lanzador oficial en Windows (con modo `--check` en seco). Define `ALICE_DATA_DIR` (`data/`) y `CARGO_TARGET_DIR` (`.cargo-target/`), valida versiones de `node`, `npm`, `cargo`, `vite` y `tauri`, evita instancias duplicadas, verifica el puerto `5173`, comprueba/inicia opcionalmente Ollama e inicia `npm run tauri -- dev`. *Nota:* contiene `if exist "E:\Ollama\models"` acoplado al disco `E:` del equipo actual. |
| 6 | [`Iniciar Alice Continuum.sh`](../../Iniciar%20Alice%20Continuum.sh) | **Activo** | Lanzador equivalente en Bash para Ubuntu/Linux (validado en CI con `--check`). Comprueba `node 26.13+`, `npm`, `cargo`, `pkg-config` y `webkit2gtk-4.1`, toma un candado exclusivo (`flock`) sobre `local/alice-launch.lock` y lanza `npm run tauri dev`. |
| 7 | [`package-lock.json`](../../package-lock.json) | **Activo** | Árbol exacto de versiones bloqueadas de npm para instalaciones reproducibles con `npm ci` en desarrollo local y CI. |
| 8 | [`package.json`](../../package.json) | **Activo** | Manifiesto principal del frontend (`alice-continuum` `0.1.0`). Declara scripts (`dev`, `icons:generate`, `build`, `test`, `test:watch`, `preview`, `tauri`) y dependencias: React `19.3.1`, Three.js `0.185.1`, `@pixiv/three-vrm`, `@shiguredo/rnnoise-wasm`, `@tauri-apps/api`, Vite `8.3.5`, TypeScript `7.0.2` y Vitest `4.1.12`. |
| 9 | [`README.md`](../../README.md) | **Activo** | Portada y guía técnica general del repositorio: estado actual de R9, uso de conversación por voz, requisitos e instalación en Windows y Ubuntu, comandos de verificación y resumen de carpetas. |
| 10 | [`Roadmap.md`](../../Roadmap.md) | **Activo** | Hoja de ruta maestra del producto escrita por Carlos Nuñez: principios innegociables y criterios de aceptación/evidencia desde R1 hasta R10. |
| 11 | [`rust-toolchain.toml`](../../rust-toolchain.toml) | **Activo** | Fija el compilador Rust en `1.99.1` (`profile = "minimal"`) con `clippy` y `rustfmt` para garantizar compilaciones idénticas en Windows y Ubuntu CI. |
| 12 | [`tsconfig.app.json`](../../tsconfig.app.json) | **Activo** | Configuración estricta de TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`) para todo el código fuente bajo `src/`. |
| 13 | [`tsconfig.json`](../../tsconfig.json) | **Activo** | Archivo solución raíz de TypeScript que agrupa `tsconfig.app.json` y `tsconfig.node.json` cuando `npm run build` ejecuta `tsc -b`. |
| 14 | [`tsconfig.node.json`](../../tsconfig.node.json) | **Activo** | Configuración TypeScript específica para verificar `vite.config.ts` en entorno Node (`ES2023`). |
| 15 | [`vite.config.ts`](../../vite.config.ts) | **Activo (con lista heredada menor)** | Configura Vite en `127.0.0.1:5173` (`strictPort: true`), workers ES, exclusiones de Vitest e implementa el plugin de seguridad `alice-private-development-files` que responde `403` ante cualquier intento HTTP de leer `.env*`, claves o carpetas privadas (`data`, `local`, `.cargo-target`). Conserva además nombres históricos (`Assets`, `adapters`, `artifacts`, `scratch`) en la lista de bloqueo. |

---

## 2. `.cargo/` (`1` archivo) y `.github/` (`1` archivo)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 16 | [`.cargo/config.toml`](../../.cargo/config.toml) | **Activo** | Fija `target-dir = ".cargo-target"` cuando `cargo` se ejecuta desde la raíz del proyecto. Se complementa intencionalmente con `Backend/src-tauri/.cargo/config.toml` (`../../.cargo-target`) para compartir una única caché de compilación Rust y no duplicar gigabytes en `Backend/src-tauri/target/`. |
| 17 | [`.github/workflows/ubuntu.yml`](../../.github/workflows/ubuntu.yml) | **Activo** | Pipeline de integración continua en GitHub Actions (`ubuntu-24.04`): instala WebKitGTK 4.1, FFmpeg, GStreamer y `xvfb`, prepara `local/venv` con `PyMuPDF`, corre `unittest`, `npm ci`, `npm test`, `npm run build`, `cargo fmt`, `cargo test`, `cargo clippy`, `cargo build`, `./Iniciar Alice Continuum.sh --check` y el smoke headless `ubuntu-startup-smoke.py`. |

---

## 3. `public/` (`7` archivos)

Vite copia todo el contenido de `public/` sin transformaciones dentro de `dist/` al compilar el frontend.

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 18 | [`public/favicon.svg`](../../public/favicon.svg) | **Activo (estética antigua)** | Icono SVG `512x512` enlazado directamente en `index.html` (`href="/favicon.svg"`). Conserva un diseño plano anterior (monograma «A» sobre cerebro estilizado), distinto del emblema actual `icons/app-alice.svg`. |
| 19 | [`public/licenses/rnnoise-BSD-3-Clause.txt`](../../public/licenses/rnnoise-BSD-3-Clause.txt) | **Activo (legal en build)** | Licencia BSD-3-Clause original de Xiph.Org para el algoritmo de supresión de ruido RNNoise. Se distribuye en `dist/licenses/` (no tiene enlace visible en la UI). |
| 20 | [`public/licenses/RNNoise-NOTICE.txt`](../../public/licenses/RNNoise-NOTICE.txt) | **Activo (legal en build)** | Aviso de atribución de Alice explicando el uso local en navegador de `@shiguredo/rnnoise-wasm` derivado de Xiph RNNoise. |
| 21 | [`public/licenses/rnnoise-wasm-Apache-2.0.txt`](../../public/licenses/rnnoise-wasm-Apache-2.0.txt) | **Activo (legal en build)** | Texto completo de la licencia Apache 2.0 del paquete WebAssembly `@shiguredo/rnnoise-wasm`. |
| 22 | [`public/licenses/whisper-model-MIT.txt`](../../public/licenses/whisper-model-MIT.txt) | **Activo (legal en build)** | Licencia MIT de OpenAI aplicable a los pesos del modelo `ggml-base.bin` de Whisper. |
| 23 | [`public/licenses/whisper-NOTICE.txt`](../../public/licenses/whisper-NOTICE.txt) | **Activo (legal en build)** | Aviso de atribución sobre la ejecución local opcional en CPU de `whisper.cpp` (`v1.9.2`) y el modelo `base` de OpenAI. |
| 24 | [`public/licenses/whisper.cpp-MIT.txt`](../../public/licenses/whisper.cpp-MIT.txt) | **Activo (legal en build)** | Licencia MIT de Georgi Gerganov para el motor nativo `whisper.cpp`. |

---

## 4. `icons/` (`22` archivos `.svg`)

Catálogo vectorial SVG del sistema visual de Alice. Los 21 iconos de `200x200` son generados automáticamente por `scripts/icons/generate-icons.mjs` (`npm run icons:generate`), mientras que `app-alice.svg` (`512x512`) se preserva como emblema maestro.

| # | Archivo | Estado | Qué hace y dónde se usa |
|---:|---|---|---|
| 25 | [`icons/app-alice.svg`](../../icons/app-alice.svg) | **Activo (fuente maestra, no en UI React)** | Emblema maestro estático `512x512` de marca. No se pinta dentro del DOM React, sino que actúa como fuente maestra para generar los iconos nativos de ventana/ejecutable (`Backend/src-tauri/icons/`) y es auditado en `icon-system.test.ts` y `project-identity.test.mjs`. |
| 26 | [`icons/camera-orbit-control.svg`](../../icons/camera-orbit-control.svg) | **Activo** | Icono del botón de rotación orbital 3D en `NeuralVolume.tsx`. |
| 27 | [`icons/camera-pan-control.svg`](../../icons/camera-pan-control.svg) | **Activo** | Icono del botón de paneo planar de cámara en `NeuralVolume.tsx`. |
| 28 | [`icons/camera-reset-control.svg`](../../icons/camera-reset-control.svg) | **Activo** | Icono del botón para restablecer el encuadre 3D en `NeuralVolume.tsx`. |
| 29 | [`icons/camera-zoom-in-control.svg`](../../icons/camera-zoom-in-control.svg) | **Activo** | Icono del botón de acercar zoom en `NeuralVolume.tsx`. |
| 30 | [`icons/camera-zoom-out-control.svg`](../../icons/camera-zoom-out-control.svg) | **Activo** | Icono del botón de alejar zoom en `NeuralVolume.tsx`. |
| 31 | [`icons/cognitive-action-planner.svg`](../../icons/cognitive-action-planner.svg) | **Activo** | Icono de la vista *Planificador / Tareas R7*, usado en `NavigationIcon.tsx` (y referenciado por el componente huérfano `NucleusViewIcon.tsx`). |
| 32 | [`icons/cognitive-activity-timeline.svg`](../../icons/cognitive-activity-timeline.svg) | **Activo** | Icono de la pestaña *Actividad*, usado en `NavigationIcon.tsx`. |
| 33 | [`icons/cognitive-conversation-channel.svg`](../../icons/cognitive-conversation-channel.svg) | **Activo** | Icono principal del canal *Conversación* (texto, voz y visión opcional), usado en `NavigationIcon.tsx`. |
| 34 | [`icons/cognitive-evidence-flow.svg`](../../icons/cognitive-evidence-flow.svg) | **Activo** | Icono de la vista *Flujo de evidencia*, usado en `NavigationIcon.tsx`. |
| 35 | [`icons/cognitive-memory-vault.svg`](../../icons/cognitive-memory-vault.svg) | **Activo** | Icono de la pestaña *Memoria*, usado en `NavigationIcon.tsx`. |
| 36 | [`icons/cognitive-neural-volume.svg`](../../icons/cognitive-neural-volume.svg) | **Activo** | Icono de la vista *Núcleo / Volumen cognitivo*, usado en `NavigationIcon.tsx`. |
| 37 | [`icons/cognitive-state-controls.svg`](../../icons/cognitive-state-controls.svg) | **Activo** | Icono de la vista *Estado y controles*, usado en `NavigationIcon.tsx`. |
| 38 | [`icons/embodiment-avatar-vrm.svg`](../../icons/embodiment-avatar-vrm.svg) | **Activo** | Icono de la pestaña *Avatar VRM*, usado en `NavigationIcon.tsx`. |
| 39 | [`icons/embodiment-body-solver.svg`](../../icons/embodiment-body-solver.svg) | **Activo** | Icono de *Cuerpo / Body Solver*, usado en `NavigationIcon.tsx` y `BridgeViewIcon.tsx`. |
| 40 | [`icons/embodiment-face-calibration.svg`](../../icons/embodiment-face-calibration.svg) | **Activo** | Icono de *Rostro / Calibración facial*, usado en `NavigationIcon.tsx` y `BridgeViewIcon.tsx`. |
| 41 | [`icons/governance-audit-diagnostics.svg`](../../icons/governance-audit-diagnostics.svg) | **Activo** | Icono de *Auditoría y diagnóstico R3*, usado en `NavigationIcon.tsx`. |
| 42 | [`icons/governance-capability-registry.svg`](../../icons/governance-capability-registry.svg) | **Activo** | Icono del *Registro de capacidades R1*, usado en la subvista `BridgeViewIcon.tsx`. |
| 43 | [`icons/governance-permissions-gateway.svg`](../../icons/governance-permissions-gateway.svg) | **Activo** | Icono del *Gateway de permisos R2 / Puentes*, usado en `NavigationIcon.tsx`. |
| 44 | [`icons/governance-procedure-observer.svg`](../../icons/governance-procedure-observer.svg) | **Activo** | Icono de *Procedimientos R5*, usado en `NavigationIcon.tsx`. |
| 45 | [`icons/governance-skill-workshop.svg`](../../icons/governance-skill-workshop.svg) | **Activo** | Icono del *Taller de habilidades R4*, usado en `NavigationIcon.tsx`. |
| 46 | [`icons/governance-system-settings.svg`](../../icons/governance-system-settings.svg) | **Activo** | Icono de *Configuración del sistema*, usado en `NavigationIcon.tsx`. |

