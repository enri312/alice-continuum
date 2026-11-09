# 01 · Auditoría maestra de archivos basura, código huérfano y limpieza pendiente

Fecha de verificación: 2026-11-06  
Volver al índice general: [`README.md`](README.md)

Este documento consolida **todos los archivos basura, carpetas vacías, plantillas móviles sobrantes, componentes y comandos huérfanos, scripts rotos, rutas personales hardcodeadas y peso recuperable en disco** detectados al inspeccionar el 100 % del repositorio *Alice Continuum*.

> **Importante:** Durante esta auditoría **no se borró ni modificó ningún archivo de código ni de `data/`**. Todo está clasificado en **5 niveles de riesgo** para que puedas limpiar con seguridad quirúrgica sin romper compilación, pruebas ni datos personales.

---

## Resumen rápido de espacio y residuos detectados

| Categoría | Elementos detectados | Espacio aprox. | Riesgo de limpieza |
|---|---:|---:|---|
| Basura directa en el repo (carpeta vacía, iconos móviles/macOS, escena legacy, docs viejos de agosto) | **49 elementos** | **~2,25 MB** | **Nulo** (Nivel 1) |
| Artefactos viejos descartables en `local/artifacts/` y `local/drafts/` *(respetando `.wav` de tests)* | **~900+ archivos** | **~118 MB** | **Nulo** si se conservan 2 rutas `.wav` (Nivel 1.B) |
| Código huérfano / desconectado de la UI (`src/` + `src-tauri/`) | **7 archivos TS/TSX (+ 3 tests) + 3 módulos Rust** | Código fuente | **Bajo**, requiere borrar en bloque coordinado (Nivel 2) |
| Scripts de prueba rotos, superados o atados a rutas personales (`C:/Users/enri3/...`) | **11 scripts** | **~120 KB** | **Medio**, reparar o retirar (Nivel 4) |
| Caché de compilación Rust (`.cargo-target/`) y bundle web (`dist/`) | **6.976 archivos** | **~9,36 GB** | **Regenerable** (`cargo clean` / `npm run build`) (Nivel 5) |

---

## Nivel 1 · Seguro borrar ya (cero impacto en código, tests ni runtime)

### 1.A Residuos dentro del árbol versionado del proyecto

| Ruta | Qué es y por qué sobra | Acción segura |
|---|---|---|
| `src-tauri/examples/` | Carpeta **totalmente vacía**, sin seguimiento en Git ni entradas `[[example]]` en `Cargo.toml`. | Borrar carpeta vacía. |
| `src-tauri/icons/android/` (`17` archivos) | Iconos adaptativos Android generados por defecto por `tauri icon`. Alice solo soporta Windows y Ubuntu. | Borrar carpeta completa. |
| `src-tauri/icons/ios/` (`18` archivos) | Iconos iOS/App Store generados por plantilla por `tauri icon`. Sin uso alguno. | Borrar carpeta completa. |
| `src-tauri/icons/icon.icns` (**793 KB**) | Contenedor de icono exclusivo de macOS. Nota: si se borra, quitar también `"icons/icon.icns"` del arreglo `bundle.icon` en [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json). | Borrar + quitar línea en `tauri.conf.json`. |
| `src-tauri/icons/64x64.png`, `Square*Logo.png` (`9`) y `StoreLogo.png` (`11` archivos) | PNGs generados por plantilla para Microsoft Store (Appx/MSIX); ninguno está referenciado en `tauri.conf.json` ni en Rust (`lib.rs` usa `icon.png` y Windows usa `icon.ico`). | Borrar si no empaquetarás MSIX para Microsoft Store. |
| [`scripts/icons/legacy/activity-timeline-scene.mjs`](../../scripts/icons/legacy/activity-timeline-scene.mjs) | Escena SVG antigua reemplazada por `scripts/icons/scenes/cognitive-activity-timeline.mjs`. **0 importadores** en todo el proyecto. | Borrar archivo y carpeta `scripts/icons/legacy/`. |
| [`docs/Analisis_Estado_Proyecto_2026-08-19.docx`](../Analisis_Estado_Proyecto_2026-08-19.docx) (**1,22 MB**) | Documento Word binario de agosto de 2026 con capturas viejas de la etapa *Alice Cognitive Core* (hasta R5). Superado por `especificacion_alice_continuum.html`. | Borrar o mover fuera del repositorio. |
| [`docs/analysis_results.md`](../analysis_results.md) | Volcado genérico de IA del 18 de agosto de 2026 (46 ADRs) que además pisó un archivo previo del 10 de agosto. Engañoso y obsoleto. | Borrar. |

### 1.B Peso muerto descartable en `local/` (~118 MB ignorados por Git)

`local/` pesa **221,27 MB**, pero solo `local/assets/` (~57,5 MB: `Alice.vrm`, animaciones FBX y `face_landmarker.task`) y `local/venv/` (~41 MB: entorno Python con `PyMuPDF`) son necesarios para usar Alice. El resto es basura de corridas pasadas:

1. `local/artifacts/vision-conversation-2026-11-03/` (**~27,8 MB**): contiene un ejecutable compilado viejo **`alice-review.exe` (27,75 MB)** más una carpeta temporal `alice-data/`. **100 % descartable.**
2. `local/artifacts/architecture-review-2026-11-05/` (**10,16 MB**): contiene **una copia duplicada entera del código fuente** en `snapshot/` (646 archivos) más `source-aa6a749.zip`. **100 % descartable.**
3. `local/artifacts/r9-hands-free-2026-11-03/` (**8,56 MB**): contiene `node-msi.log` y datos de prueba aislados. **100 % descartable.**
4. **216 archivos sueltos `.html`/`.png` en la raíz de `local/artifacts/` (~57,34 MB)** + subcarpetas `icons-v3-2026-11-01/`, `icons-v4-2026-11-01/`, `ui-affordance-2026-11-01/` y `avatar-clothing-2026-11-05/` (~14 MB): capturas históricas de iteraciones visuales (incluyendo `r7-2b-live-before.png` truncado a 144 bytes). **Descartables.**
5. `local/drafts/` (**1,48 MB**, 17 archivos): 3 PNG de agosto + 14 scripts sueltos en `local/drafts/avatar-height-detail/` que apuntan a la ruta antigua inexistente `Assets/Alice.vrm`. **Descartable.**
6. `data/visual-checks/*.png` (**592 KB**, 3 capturas): capturas de verificación visual Playwright que no forman parte de la memoria ni configuración de Alice.

> **CUIDADO al limpiar `local/artifacts/`:** No borres `local/artifacts/conversation-session-2026-11-04/*.wav` ni `local/artifacts/voice-noise-2026-11-04/synthetic-speech.wav` sin antes copiarlos a `scripts/testing/.fixtures/`, porque [`scripts/testing/prepare-voice-fixtures.mjs`](../../scripts/testing/prepare-voice-fixtures.mjs) los busca como origen para regenerar fixtures de voz.

---

## Nivel 2 · Código huérfano desconectado de la aplicación activa (`src/` y `src-tauri/`)

Cuando Alice migró su aprendizaje conversacional y su visión desde **Ollama/Qwen** hacia **Gemma 4 E2B local (`llama-server`)**, varios paneles antiguos dejaron de renderizarse en `App.tsx`, dejando una cadena huérfana tanto en React/TypeScript como en Rust:

### 2.1 Componentes y módulos TypeScript sin uso en la UI (`src/`)

| Archivo | Estado exacto | Explicación |
|---|---|---|
| [`src/components/icons/NucleusViewIcon.tsx`](../../src/components/icons/NucleusViewIcon.tsx) | **HUÉRFANO TOTAL** | **0 importadores.** Era el icono de subpestañas del viejo panel unificado del Núcleo; hoy las 4 vistas usan `NavigationIcon.tsx`. |
| [`src/components/memory/MemoryCandidatePanel.tsx`](../../src/components/memory/MemoryCandidatePanel.tsx) | **HUÉRFANO TOTAL** | **0 importadores.** Viejo panel R6.4-C de candidatos vía Ollama; reemplazado por `AutomaticMemoryPanel.tsx` y propuestas por turno en `ConversationPage.tsx`. |
| [`src/components/memory/SensoryLearningPanel.tsx`](../../src/components/memory/SensoryLearningPanel.tsx) | **HUÉRFANO TOTAL** | **0 importadores.** Viejo panel de concesiones de cámara/micrófono de 60 s y análisis de pantalla cada 5 min vía Ollama; reemplazado por `ConversationVision.tsx`. |
| [`src/components/icons/BridgeViewIcon.tsx`](../../src/components/icons/BridgeViewIcon.tsx) | **MUERTO EN RUNTIME** | Solo se importa en `CapabilityRegistryPage.tsx` dentro de `{!fixedView && ...}`, pero `App.tsx` (líneas 667–669) **siempre** pasa `fixedView` definido (`"overview"`, `"face"` o `"body"`). |
| [`src/core/cognitive/neural-volume-visual.ts`](../../src/core/cognitive/neural-volume-visual.ts) *(+ `.test.ts`)* | **SOLO USADO EN SU TEST** | Cálculos visuales antiguos superados por `cognitive-volume.ts` y `NeuralVolume.tsx`. |
| [`src/core/conversation/teaching-templates.ts`](../../src/core/conversation/teaching-templates.ts) *(+ `.test.ts`)* | **SOLO USADO EN SU TEST** | Plantillas del formulario retirado *"Enseñarle a Alice"*. Ningún componente las importa. |
| [`src/core/memory/learning-candidates.ts`](../../src/core/memory/learning-candidates.ts) *(+ `.test.ts`)* | **SOLO USADO EN SU TEST + HUÉRFANO** | En código de app solo lo importaba el huérfano `MemoryCandidatePanel.tsx`. |

### 2.2 Módulos y comandos Tauri en Rust desconectados de la UI activa (`src-tauri/src/`)

> Nota: todos siguen registrados en `tauri::generate_handler![]` dentro de [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) y tienen tests unitarios en `cargo test`, por lo que **si algún día decides retirarlos debes quitar a la vez el módulo, su registro en `lib.rs` y sus referencias en `capabilities.rs` / `diagnostics.rs`**.

| Módulo / Comando Rust | Quién lo invoca hoy en `src/` | Situación real |
|---|---|---|
| Comando `markdown_note_catalog` ([`memory.rs`](../../src-tauri/src/memory.rs) → [`memory/queries.rs`](../../src-tauri/src/memory/queries.rs)) | **Nadie (`0` invocaciones en todo `src/`)** | Comando Tauri completamente huérfano en el frontend. |
| [`src-tauri/src/learning_candidates.rs`](../../src-tauri/src/learning_candidates.rs) (`preview_learning_candidates`, `confirm_learning_candidate`) + `append_confirmed_learning` en [`memory/learning.rs`](../../src-tauri/src/memory/learning.rs) | Solo el componente huérfano `MemoryCandidatePanel.tsx` | Flujo heredado R6.4-C basado en Ollama (`127.0.0.1:11434`), desplazado en la app viva por `conversation_learning.rs` (Gemma). |
| [`src-tauri/src/visual_learning.rs`](../../src-tauri/src/visual_learning.rs) (`analyze_screen_frame`) | Solo el componente huérfano `SensoryLearningPanel.tsx` | Analizador de pantalla heredado vía Ollama multimodal, desplazado por `conversation_vision.rs` (`preview_vision_desktop` + Gemma). |
| [`src-tauri/src/sensory.rs`](../../src-tauri/src/sensory.rs) (`sensor_lease_status`) + `execute_sensor_lease_grant` y `stop_sensor_lease` en [`permissions.rs`](../../src-tauri/src/permissions.rs) | Solo el componente huérfano `SensoryLearningPanel.tsx` *(más helpers sin uso en `src/core/governance/permissions.ts`)* | Circuito antiguo de *leases* sensoriales de 60 s con FFmpeg/Python. Además, `sensory.rs` tiene hardcodeados los dispositivos del portátil del autor (`"ACER HD User Facing"`, `"Varios micrófonos (Realtek(R) Audio)"`). |

---

## Nivel 3 · Deuda interna parcial dentro de archivos activos

Estos archivos **sí son esenciales y no deben borrarse**, pero contienen bloques muertos adentro:

1. [`scripts/icons/generate-icons.mjs`](../../scripts/icons/generate-icons.mjs) (**líneas 132–420, ~280 líneas muertas**): define las 16 escenas inline antiguas en `const scenes = { ... }` e inmediatamente después (líneas 422–437) sobrescribe esas mismas 16 claves con las escenas modulares importadas de `./scenes/*.mjs`.
2. [`src/App.tsx`](../../src/App.tsx) (**líneas 201–202**): constantes `ollamaProvider` y `ollamaModel` calculadas en cada render sin ningún consumidor.
3. [`src/pages/governance/CapabilityRegistryPage.tsx`](../../src/pages/governance/CapabilityRegistryPage.tsx) (**líneas 84–92**): bloque `{!fixedView && <div className="bridge-view-tabs">...}` nunca alcanzado desde `App.tsx`.
4. **Selectores CSS heredados en 5 hojas activas:**
   - [`src/styles/industrial-theme.css`](../../src/styles/industrial-theme.css): `.learning-candidate-*`, `.sensory-*`, `.sensor-*`, `.neuro-view-icon`, `.neuro-view-tabs`, `.bridge-view-tabs`, `.brain-node-strip`, `.teaching-panel`, `.provider-picker`, `.social-hypotheses`.
   - [`src/styles/base.css`](../../src/styles/base.css): `.teaching-panel`, `.teaching-starters`, `.kind-grid`, `.session-overview`, `.reflection`, `.lobe`, `.focus-core`, `.neuro-node`.
   - [`src/styles/interaction-affordance.css`](../../src/styles/interaction-affordance.css): `.neuro-view-tabs`, `.identification-injector`.
   - [`src/styles/conversation-context.css`](../../src/styles/conversation-context.css): `.conversation-history-gate`, `.voice-turn-steps`.
   - [`src/styles/conversation-home.css`](../../src/styles/conversation-home.css): `.audio-focus-option`.
5. **Listas heredadas de rutas antiguas ya migradas** en [`.gitignore`](../../.gitignore) y [`vite.config.ts`](../../vite.config.ts): entradas como `Assets/`, `adapters/`, `.venv-adapters/`, `artifacts/`, `scratch/`, `.openchamber/` (inofensivas como defensa extra, pero históricas).

---

## Nivel 4 · Scripts rotos, prototipos superados y rutas personales acopladas

### 4.1 Scripts rotos hoy mismo (`TypeError` al arrancar)
- [`scripts/testing/compare-local-models.mjs`](../../scripts/testing/compare-local-models.mjs)
- [`scripts/testing/llama-memory-pilot.mjs`](../../scripts/testing/llama-memory-pilot.mjs)
  - **Por qué fallan:** ambos ejecutan una expresión regular buscando `const SYSTEM_PROMPT: &str = "..."` dentro de `src-tauri/src/cloud.rs`, pero `cloud.rs` ahora carga el prompt con `include_str!("prompts/conversation.txt")`. Resultado: `match(...)` devuelve `null` y el script explota con `TypeError` al iniciar.
  - **Efecto colateral:** `compare-local-models.mjs` y [`scripts/adapters/probe_document_ui.cjs`](../../scripts/adapters/probe_document_ui.cjs) ejecutan `fs.mkdirSync("artifacts", ...)` creando una carpeta basura `artifacts/` en la raíz del proyecto.

### 4.2 Prototipos de evaluación ya reemplazados
- [`scripts/testing/voice-turn-pilot.mjs`](../../scripts/testing/voice-turn-pilot.mjs) + [`scripts/testing/voice-turn-pilot/client.js`](../../scripts/testing/voice-turn-pilot/client.js) + [`scripts/testing/voice-turn-pilot/index.html`](../../scripts/testing/voice-turn-pilot/index.html): primer piloto de voz de un solo turno manual, superado primero por `conversation-session-pilot` y luego integrado de forma nativa en `src/core/voice/` y `src-tauri/src/voice_input.rs`.
- [`scripts/testing/start-llama-evaluation.ps1`](../../scripts/testing/start-llama-evaluation.ps1): lanzador manual previo a [`local_inference.rs`](../../src-tauri/src/local_inference.rs), con rutas atadas a `D:\Alice-model-evaluation\...`.

### 4.3 Rutas personales hardcodeadas a la máquina actual
- **Caché personal de Playwright en Codex (`C:/Users/enri3/.cache/codex-runtimes/.../node_modules/playwright`):** presente en [`gemma-evaluation.mjs`](../../scripts/testing/gemma-evaluation.mjs), [`settings-runtime-visual.cjs`](../../scripts/testing/settings-runtime-visual.cjs), [`voice-turn-pilot-smoke.mjs`](../../scripts/testing/voice-turn-pilot-smoke.mjs) y [`volume-observatory.cjs`](../../scripts/testing/volume-observatory.cjs). Fallan en cualquier otro PC si no se define `PLAYWRIGHT_MODULE_PATH`.
- **Disco `D:\Alice-model-evaluation\...`:** usado como ruta por defecto en varios pilotos de `scripts/testing/` (mientras que `runtime_paths.rs` ya unificó el runtime real bajo `local/runtimes/` y `local/models/` o variables `ALICE_*`).
- **Disco `E:\Ollama\models`:** comprobado directamente en [`Iniciar Alice Continuum.cmd`](../../Iniciar%20Alice%20Continuum.cmd).
- **`"python"` global en vez de `runtime_paths::python()`:** tanto [`src-tauri/src/face_readiness.rs`](../../src-tauri/src/face_readiness.rs) como [`src-tauri/src/sensory.rs`](../../src-tauri/src/sensory.rs) invocan `"python"` del `PATH` global en vez del intérprete aislado de `local/venv` que sí usa `documents.rs`.

---

## Nivel 5 · Cachés regenerables y archivos delicados que NO debes borrar a ciegas

1. **`.cargo-target/` (`9.352,21 MB` / `~9,35 GB`, 6.963 archivos):**
   - No es código fuente sino la caché de compilación de Rust compartida por `.cargo/config.toml` y `src-tauri/.cargo/config.toml`.
   - Si necesitas recuperar ~9 GB de disco de golpe, puedes ejecutar `cargo clean --manifest-path src-tauri/Cargo.toml`; se regenerará limpia la próxima vez que compiles (tardando unos minutos en recompilar crates).
2. **`dist/` (`7,29 MB`, 13 archivos) y `node_modules/` (`158,78 MB`, 4.117 archivos):**
   - Salida del frontend compilado (`npm run build`) y dependencias npm (`npm ci`). Regenerables en cualquier momento.
3. **`local/reference-adapters/` (`12` scripts Python en cuarentena):**
   - **No intervienen en ejecución**, pero están documentados intencionalmente en [`docs/architecture/ADAPTER_QUARANTINE.md`](../architecture/ADAPTER_QUARANTINE.md) como material de referencia aislado para futuras etapas de rostro/cuerpo/voz local. Conviene mantenerlos mientras sirvan de referencia.
4. **Archivos históricos pre-v1 en `data/memory/` (`sessions.json`, `sessions.backup.json`, `memory-audit.jsonl`, `layer-index-v2.json`):**
   - Hoy están inactivos (el runtime vigente usa `records.json`, `layer-index-v3.json` y `data/audit/events-v1.jsonl`), pero contienen historia local del propietario y siguen listados en rutas de compatibilidad/diagnóstico. **Regla de oro del proyecto: jamás borrar nada dentro de `data/memory/` sin copia de seguridad externa previa y decisión explícita tuya.**
