# 05 · Scripts, adaptadores, generadores de iconos y pilotos (`scripts/`)

Fecha de verificación: 2026-11-06  
Total cubierto en este documento: **59 archivos** reales en `scripts/` (`5` en `adapters/` + `23` en `icons/` + `31` en `testing/`).

Volver al índice: [`README.md`](README.md) · Ver hallazgos de limpieza: [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)

> **Cuidado con `scripts/`:** Aquí conviven archivos críticos de producción/CI con **scripts rotos tras refactorizaciones**, **prototipos antiguos reemplazados** y **sondas con rutas personales hardcodeadas** (`C:/Users/enri3/.cache/codex-runtimes/...` o `D:/Alice-model-evaluation/...`). Cada uno está marcado explícitamente abajo.

---

## 1. `Backend/adapters/` (`5` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 1 | [`Backend/adapters/document_reader.py`](../../Backend/adapters/document_reader.py) | **ACTIVO (PRODUCCIÓN + CI)** | Adaptador Python de solo lectura para extraer y fragmentar texto de `.pdf` (mediante `PyMuPDF`), `.txt` y `.md` con límites estrictos (16 MiB, 1.000 páginas, rechazo de PDFs cifrados y hash `sha256`). `Backend/src-tauri/src/documents.rs` lo incrusta con `include_str!` y lo ejecuta usando `local/venv` en el comando `preview_document`. |
| 2 | [`Backend/adapters/requirements.txt`](../../Backend/adapters/requirements.txt) | **ACTIVO (SETUP + CI)** | Fija `PyMuPDF==1.26.4` para construir el entorno virtual `local/venv` en Windows y en `.github/workflows/ubuntu.yml`. |
| 3 | [`Backend/adapters/test_document_reader.py`](../../Backend/adapters/test_document_reader.py) | **ACTIVO (CI)** | Suite `unittest` en Python (5 pruebas) ejecutada en GitHub Actions para validar extracción PDF, *chunking* con solapamiento, límites de tamaño/páginas y rechazo de UTF-8 inválido. |
| 4 | [`Backend/adapters/README.md`](../../Backend/adapters/README.md) | **ACTIVO (DOC)** | Documenta los límites de seguridad, instalación de `local/venv` y pruebas de `document_reader.py`. |
| 5 | [`Backend/adapters/probe_document_ui.cjs`](../../Backend/adapters/probe_document_ui.cjs) | **SONDA PUNTUAL** | Sonda manual vía Playwright CDP para una instancia aislada. Crea y guarda sus capturas en `local/artifacts/`, sin crear una carpeta suelta en la raíz. |

---

## 2. `scripts/icons/` (`23` archivos)

### 2.1 Generador principal y carpeta `legacy/` (`2` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 6 | [`scripts/icons/generate-icons.mjs`](../../scripts/icons/generate-icons.mjs) | **ACTIVO (CON ~280 LÍNEAS MUERTAS)** | Script de `npm run icons:generate`: genera los 21 iconos SVG funcionales (`200x200`) en `icons/` y preserva `icons/app-alice.svg`. *Deuda interna:* entre las líneas 132 y 420 conserva 16 escenas inline antiguas y helpers obsoletos que son sobrescritos inmediatamente en las líneas 422–437 por las escenas modulares de `./scenes/*.mjs`. |
| 7 | `scripts/icons/legacy/activity-timeline-scene.mjs` | **RETIRADO** | Escena antigua sin importadores; guardada en la copia local de recuperación y en el historial Git. |

### 2.2 `scripts/icons/scenes/` (`16` archivos)

Cada archivo exporta la función constructora SVG de uno de los 16 iconos principales importados por `generate-icons.mjs`:

| # | Archivo | Estado | Qué dibuja |
|---:|---|---|---|
| 8 | [`scripts/icons/scenes/cognitive-action-planner.mjs`](../../scripts/icons/scenes/cognitive-action-planner.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-action-planner.svg` (planificador sellado y muelle R7 de tareas/recordatorios). |
| 9 | [`scripts/icons/scenes/cognitive-activity-timeline.mjs`](../../scripts/icons/scenes/cognitive-activity-timeline.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-activity-timeline.svg` (consola temporal de actividad con búfer de 24 ranuras). |
| 10 | [`scripts/icons/scenes/cognitive-conversation-channel.mjs`](../../scripts/icons/scenes/cognitive-conversation-channel.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-conversation-channel.svg` (canal de diálogo, micrófono, filtro RNNoise y lente de visión). |
| 11 | [`scripts/icons/scenes/cognitive-evidence-flow.mjs`](../../scripts/icons/scenes/cognitive-evidence-flow.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-evidence-flow.svg` (grafo funcional de flujo cognitivo y asociaciones). |
| 12 | [`scripts/icons/scenes/cognitive-memory-vault.mjs`](../../scripts/icons/scenes/cognitive-memory-vault.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-memory-vault.svg` (bóveda versionada de recuerdos, memoria de trabajo, lente RAG y respaldos). |
| 13 | [`scripts/icons/scenes/cognitive-neural-volume.mjs`](../../scripts/icons/scenes/cognitive-neural-volume.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-neural-volume.svg` (observatorio volumétrico 3D de nodos de memoria). |
| 14 | [`scripts/icons/scenes/cognitive-state-controls.mjs`](../../scripts/icons/scenes/cognitive-state-controls.mjs) | **ACTIVO** | Escena SVG de `icons/cognitive-state-controls.svg` (señales internas y deslizadores bloqueados en solo lectura). |
| 15 | [`scripts/icons/scenes/embodiment-avatar-vrm.mjs`](../../scripts/icons/scenes/embodiment-avatar-vrm.mjs) | **ACTIVO** | Escena SVG de `icons/embodiment-avatar-vrm.svg` (pórtico de inspección del avatar VRM, rig y expresiones). |
| 16 | [`scripts/icons/scenes/embodiment-body-solver.mjs`](../../scripts/icons/scenes/embodiment-body-solver.mjs) | **ACTIVO** | Escena SVG de `icons/embodiment-body-solver.svg` (rig cinemático corporal IK en estado reservado). |
| 17 | [`scripts/icons/scenes/embodiment-face-calibration.mjs`](../../scripts/icons/scenes/embodiment-face-calibration.mjs) | **ACTIVO** | Escena SVG de `icons/embodiment-face-calibration.svg` (máscara facial neutra con obturador cerrado y bloqueo R2). |
| 18 | [`scripts/icons/scenes/governance-audit-diagnostics.mjs`](../../scripts/icons/scenes/governance-audit-diagnostics.mjs) | **ACTIVO** | Escena SVG de `icons/governance-audit-diagnostics.svg` (libro mayor de auditoría R3 y celdas de diagnóstico pasivo). |
| 19 | [`scripts/icons/scenes/governance-capability-registry.mjs`](../../scripts/icons/scenes/governance-capability-registry.mjs) | **ACTIVO** | Escena SVG de `icons/governance-capability-registry.svg` (inventario R1 de capacidades y estado de adaptadores). |
| 20 | [`scripts/icons/scenes/governance-permissions-gateway.mjs`](../../scripts/icons/scenes/governance-permissions-gateway.mjs) | **ACTIVO** | Escena SVG de `icons/governance-permissions-gateway.svg` (esclusa R2 de permisos con expiración y revocación). |
| 21 | [`scripts/icons/scenes/governance-procedure-observer.mjs`](../../scripts/icons/scenes/governance-procedure-observer.mjs) | **ACTIVO** | Escena SVG de `icons/governance-procedure-observer.svg` (detector R5 de procedimientos repetidos y paso a borrador R4). |
| 22 | [`scripts/icons/scenes/governance-skill-workshop.mjs`](../../scripts/icons/scenes/governance-skill-workshop.mjs) | **ACTIVO** | Escena SVG de `icons/governance-skill-workshop.svg` (taller R4 de manifiestos locales y simulación sin efectos). |
| 23 | [`scripts/icons/scenes/governance-system-settings.mjs`](../../scripts/icons/scenes/governance-system-settings.mjs) | **ACTIVO** | Escena SVG de `icons/governance-system-settings.svg` (consola de ajustes, control de motor local y rueda selectora). |

### 2.3 `scripts/icons/shared/` (`5` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 24 | [`scripts/icons/shared/component-hardware-details.mjs`](../../scripts/icons/shared/component-hardware-details.mjs) | **ACTIVO** | Añade pestillos mecánicos, conectores y costuras sobre paneles verificados de las 16 escenas SVG. |
| 25 | [`scripts/icons/shared/component-panel-finish.mjs`](../../scripts/icons/shared/component-panel-finish.mjs) | **ACTIVO** | Aplica biseles recortados con `clipPath` (`finishComponentPanels`) y aros exteriores de precisión (`precisionControlRim`) a los iconos de cámara. |
| 26 | [`scripts/icons/shared/component-panel-finish.test.mjs`](../../scripts/icons/shared/component-panel-finish.test.mjs) | **ACTIVO (VITEST + CI)** | Prueba automatizada (7 tests) que valida geometría, `clipPath` únicos y exclusión de `app-alice` en el sistema de iconos. |
| 27 | [`scripts/icons/shared/gear-drive-hub.mjs`](../../scripts/icons/shared/gear-drive-hub.mjs) | **ACTIVO** | Construye la corona dentada y el rodamiento central del icono de Configuración. |
| 28 | [`scripts/icons/shared/settings-selector-core.mjs`](../../scripts/icons/shared/settings-selector-core.mjs) | **ACTIVO** | Dibuja el núcleo octogonal con tres deslizadores dentro del engranaje de Configuración. |

---

## 3. `scripts/testing/` y subdirectorios piloto (`31` archivos)

### 3.1 Nivel superior de `scripts/testing/` (`24` archivos)

| # | Archivo | Estado | Qué hace y advertencias de limpieza |
|---:|---|---|---|
| 29 | `scripts/testing/compare-local-models.mjs` | **RETIRADO** | Comparador antiguo incompatible con el formato actual del prompt y sin referencias operativas; copia local de recuperación e historial Git. |
| 30 | [`scripts/testing/conversation-reference-eval.mjs`](../../scripts/testing/conversation-reference-eval.mjs) | **EVALUADOR MANUAL (RUTA FIJA)** | Script citado en `docs/runbooks/03-conversacion-y-voz.md` para evaluar resolución de pronombres/referencias en Gemma. Funciona, pero si no recibe `--runtime-pid` tiene hardcodeado `D:/Alice-model-evaluation/...`. |
| 31 | [`scripts/testing/create-audio-fixture.ps1`](../../scripts/testing/create-audio-fixture.ps1) | **ONE-OFF HISTÓRICO** | Genera un WAV en inglés (`speech.wav`) con la voz Windows `'Microsoft Zira Desktop'` para pruebas antiguas de audio en Gemma. Falla si Windows no tiene instalada esa voz en inglés. |
| 32 | [`scripts/testing/create-session-fixtures.mjs`](../../scripts/testing/create-session-fixtures.mjs) | **SOPORTE QA MANUAL** | Genera 3 archivos WAV sintéticos en español (`fixture-0..2.wav`) usando Fish Audio + `ffmpeg` en `local/artifacts/conversation-session-2026-11-04/` para alimentar el piloto de sesión de voz. |
| 33 | [`scripts/testing/dev-server-boundary.test.ts`](../../scripts/testing/dev-server-boundary.test.ts) | **ACTIVO (VITEST + CI)** | Prueba de seguridad que levanta Vite real y comprueba que rutas privadas (`data/`, `local/`, `.cargo-target/`, `.env`, `.key`, `/@fs/`, URL-encoded) respondan `403 Forbidden`. |
| 34 | [`scripts/testing/gemma-audio-evaluation.mjs`](../../scripts/testing/gemma-audio-evaluation.mjs) | **ONE-OFF HISTÓRICO** | Experimento antiguo para probar audio directo en `gemma4` vía Ollama antes de adoptar Whisper local + `llama.cpp`. |
| 35 | [`scripts/testing/gemma-evaluation.mjs`](../../scripts/testing/gemma-evaluation.mjs) | **BASURA / RUTA PERSONAL ROTA** | Benchmark antiguo de `gemma4` en Ollama. **No portable:** importa Playwright desde `C:/Users/enri3/.cache/codex-runtimes/.../playwright`. |
| 36 | [`scripts/testing/gemma-vision-control.mjs`](../../scripts/testing/gemma-vision-control.mjs) | **ONE-OFF HISTÓRICO** | Comparaba visión en Ollama (`gemma4` vs `qwen3.5:4b`) leyendo `vision.png` generado por `gemma-evaluation.mjs`. |
| 37 | [`scripts/testing/install-llama-evaluation.ps1`](../../scripts/testing/install-llama-evaluation.ps1) | **SETUP LOCAL (RUTA FIJA `D:`)** | Descarga y verifica por SHA-256 `llama-b10809` CUDA 12.4 en `D:\Alice-model-evaluation\runtimes\llama-b10809` sin consultar `ALICE_INFERENCE_HOME`. |
| 38 | [`scripts/testing/install-whisper-local.ps1`](../../scripts/testing/install-whisper-local.ps1) | **ACTIVO SETUP (RUTA FIJA `D:`)** | Instalador oficial documentado en `README.md` que descarga `whisper.cpp v1.9.2` y `ggml-base.bin` verificando SHA-256. *Advertencia:* escribe fijo en `D:\Alice-model-evaluation\...` sin leer variables de entorno. |
| 39 | [`scripts/testing/llama-memory-pilot.mjs`](../../scripts/testing/llama-memory-pilot.mjs) | **BASURA / ROTO** | Piloto antiguo de memoria/RAG contra `llama-server` u Ollama. **Está roto** por el mismo regex obsoleto de `SYSTEM_PROMPT` sobre `cloud.rs` y rutas fijas en `D:/`. |
| 40 | [`scripts/testing/llama-multimodal-evaluation.mjs`](../../scripts/testing/llama-multimodal-evaluation.mjs) | **ONE-OFF HISTÓRICO** | Ejecutaba 7 pruebas multimodales contra un `llama-server` abierto manualmente con `start-llama-evaluation.ps1`. |
| 41 | [`scripts/testing/native-runtime-smoke.mjs`](../../scripts/testing/native-runtime-smoke.mjs) | **QA MANUAL LOCAL** | Ejecuta el test ignorado `live_owned_start_inference_stop` de Cargo verificando con SHA-256 que `data/` no cambie. |
| 42 | [`scripts/testing/prepare-voice-fixtures.mjs`](../../scripts/testing/prepare-voice-fixtures.mjs) | **SOPORTE QA MANUAL** | Copia los WAV sintéticos desde `local/artifacts/...` hacia `scripts/testing/.fixtures/` para poder abrir los pilotos web de voz bajo Vite sin exponer `local/`. |
| 43 | [`scripts/testing/probe-associations-ui.cjs`](../../scripts/testing/probe-associations-ui.cjs) | **SONDA PUNTUAL R8** | Sonda manual vía Playwright CDP (`9222`) que ejercitó el alta/retiro de asociaciones del grafo R8 sobre datos temporales. |
| 44 | [`scripts/testing/project-identity.test.mjs`](../../scripts/testing/project-identity.test.mjs) | **ACTIVO (VITEST + CI)** | Verifica en cada `npm test` que `package.json`, `Cargo.toml`, `tauri.conf.json`, `README.md`, `index.html` e iconos mantengan la identidad coherente `Alice Continuum`. |
| 45 | [`scripts/testing/r8-gemma-embedding-eval.test.ts`](../../scripts/testing/r8-gemma-embedding-eval.test.ts) | **EVAL CONDICIONAL (OMITIDA)** | Test Vitest desactivado por defecto (`skipIf(ALICE_R8_REAL_EMBEDDING_EVAL !== "1")`) con ruta fija `D:/Alice-model-evaluation/...` usado en R8.3 para evaluar embeddings de Gemma. |
| 46 | [`scripts/testing/r8-gemma-rerank-eval.test.ts`](../../scripts/testing/r8-gemma-rerank-eval.test.ts) | **EVAL CONDICIONAL (OMITIDA)** | Test Vitest desactivado por defecto (`skipIf(ALICE_R8_REAL_RERANK_EVAL !== "1")`) con ruta fija `D:/...` usado en R8.3 para evaluar re-ranking JSON con Gemma. |
| 47 | [`scripts/testing/settings-runtime-visual.cjs`](../../scripts/testing/settings-runtime-visual.cjs) | **BASURA / RUTA PERSONAL ROTA** | Sonda puntual de contraste/tamaño de botones de Gemma en Configuración. Importa Playwright desde `C:/Users/enri3/.cache/codex-runtimes/...`. |
| 48 | [`scripts/testing/start-llama-evaluation.ps1`](../../scripts/testing/start-llama-evaluation.ps1) | **OBSOLETO (SUPERADO)** | Script PowerShell que lanzaba `llama-server.exe` manualmente antes de existir `local_inference.rs`, con rutas fijas a `E:\Alice Cognitive Core` y `D:\Alice-model-evaluation`. |
| 49 | [`scripts/testing/ubuntu-startup-smoke.py`](../../scripts/testing/ubuntu-startup-smoke.py) | **ACTIVO (CI UBUNTU)** | Smoke test oficial ejecutado al final de `.github/workflows/ubuntu.yml`: inicia el binario compilado `alice-continuum` con `ALICE_DATA_DIR` aislado y comprueba que registre `PROCESS_STARTED` en auditoría R3. |
| 50 | [`scripts/testing/voice-turn-pilot-smoke.mjs`](../../scripts/testing/voice-turn-pilot-smoke.mjs) | **BASURA / OBSOLETO + RUTA PERSONAL** | Probaba el viejo servidor `voice-turn-pilot.mjs` (`18090`) e importa Playwright desde `C:/Users/enri3/.cache/codex-runtimes/...`. |
| 51 | [`scripts/testing/voice-turn-pilot.mjs`](../../scripts/testing/voice-turn-pilot.mjs) | **OBSOLETO (PROTOTIPO SUPERADO)** | Antiguo servidor HTTP independiente (`127.0.0.1:18090`) que transcribía audio con Gemma multimodal antes de integrar RNNoise + Whisper + sesiones de voz en Tauri. |
| 52 | [`scripts/testing/volume-observatory.cjs`](../../scripts/testing/volume-observatory.cjs) | **SONDA PUNTUAL (RUTA PERSONAL)** | Renderiza `NeuralVolume` en Edge headless y guarda capturas en `data/visual-checks/`. Importa Playwright desde `C:/Users/enri3/.cache/codex-runtimes/...`. |

### 3.2 Subdirectorios de pilotos interactivos en `scripts/testing/` (`7` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 53 | [`scripts/testing/conversation-session-pilot/client.tsx`](../../scripts/testing/conversation-session-pilot/client.tsx) | **PILOTO QA MANUAL R9** | Mini-cliente React de prueba que monta `HandsFreeVoice` inyectando los 3 WAV sintéticos de `.fixtures/` (sin abrir micrófono físico) y valida turnos + revocación de sesión contra Tauri. |
| 54 | [`scripts/testing/conversation-session-pilot/index.html`](../../scripts/testing/conversation-session-pilot/index.html) | **PILOTO QA MANUAL R9** | Página HTML de entrada bajo Vite para abrir `conversation-session-pilot/client.tsx`. |
| 55 | [`scripts/testing/conversation-session-pilot/pilot.css`](../../scripts/testing/conversation-session-pilot/pilot.css) | **PILOTO QA MANUAL R9** | Hoja de estilos mínima del piloto de sesión de conversación por voz. |
| 56 | [`scripts/testing/voice-noise-pilot/client.ts`](../../scripts/testing/voice-noise-pilot/client.ts) | **PILOTO QA MANUAL R9** | Prueba en navegador el pipeline real `processMicrophone` (RNNoise WASM) + `SpeechEndpoint` mezclando ruido sintético y voz (`noise`, `speech`, `speech+noise`) y midiendo atenuación en dB. |
| 57 | [`scripts/testing/voice-noise-pilot/index.html`](../../scripts/testing/voice-noise-pilot/index.html) | **PILOTO QA MANUAL R9** | Página HTML de entrada para abrir `voice-noise-pilot/client.ts` desde el servidor Vite. |
| 58 | [`scripts/testing/voice-turn-pilot/client.js`](../../scripts/testing/voice-turn-pilot/client.js) | **OBSOLETO (PROTOTIPO SUPERADO)** | Cliente JS del antiguo servidor independiente `voice-turn-pilot.mjs` (puerto `18090`), ya superado por la integración nativa de voz en Alice. |
| 59 | [`scripts/testing/voice-turn-pilot/index.html`](../../scripts/testing/voice-turn-pilot/index.html) | **OBSOLETO (PROTOTIPO SUPERADO)** | Página HTML del antiguo prototipo `voice-turn-pilot.mjs`. |

