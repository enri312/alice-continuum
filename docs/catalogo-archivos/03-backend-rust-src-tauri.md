# 03 · Backend nativo Rust y Tauri (`src-tauri/`)

Fecha de verificación: 2026-11-06  
Total cubierto en este documento: **123 archivos + 1 carpeta vacía (`examples/`) = 124 elementos** dentro de `src-tauri/`.

Volver al índice: [`README.md`](README.md) · Ver hallazgos de limpieza: [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)

---

## 1. Raíz de `src-tauri/`, `.cargo/` y `examples/` (`5` archivos + `1` carpeta vacía)

| # | Archivo / Carpeta | Estado | Qué hace exactamente |
|---:|---|---|---|
| 1 | [`src-tauri/build.rs`](../../src-tauri/build.rs) | **ACTIVO** | Script de compilación de Cargo (4 líneas) que ejecuta `tauri_build::build()`: incrusta el ícono `.ico` y metadatos Win32 en el `.exe`, valida `tauri.conf.json` y regenera `src-tauri/gen/schemas/`. |
| 2 | [`src-tauri/Cargo.toml`](../../src-tauri/Cargo.toml) | **ACTIVO** | Manifiesto Rust del paquete `alice-continuum` `0.1.0` (`alice_continuum_lib`). Declara `tauri` v2, `tauri-plugin-notification`, `serde`/`serde_json`, `sha2`, `uuid`, `reqwest` (`rustls`), `base64`, `image` y, en Windows, el crate `windows` `0.62` (WinRT Media Control, UI Automation, GDI, COM y archivos). Desactiva `incremental` en `dev`/`test` para no inflar el disco con gigabytes extra. |
| 3 | [`src-tauri/Cargo.lock`](../../src-tauri/Cargo.lock) | **ACTIVO** | Bloqueo exacto de versiones y hashes criptográficos de todas las dependencias Rust para compilaciones reproducibles. |
| 4 | [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) | **ACTIVO** | Configuración principal de Tauri 2 (`Alice Continuum`, ID `com.carlosnunez.alicecognitivecore`): conecta `devUrl` (`http://localhost:5173`) y `frontendDist` (`../dist`), fija ventana inicial de `1000x800`, define la CSP (restringiendo tráfico local a `127.0.0.1:11434` y `127.0.0.1:18089` más APIs HTTPS), abre `assetProtocol` con `scope: []` (ampliado en arranque por `avatar.rs`) y mantiene `bundle.active: false`. |
| 5 | [`src-tauri/.cargo/config.toml`](../../src-tauri/.cargo/config.toml) | **ACTIVO (COMPLEMENTARIO)** | Fija `target-dir = "../.cargo-target"` cuando Cargo corre desde `src-tauri/`, apuntando exactamente al mismo `.cargo-target` que el `.cargo/config.toml` de la raíz para compartir caché y evitar bloquear `src-tauri/target/`. |
| 6 | `src-tauri/examples/` | **BASURA (CARPETA VACÍA)** | Directorio completamente vacío, sin seguimiento en Git ni `[[example]]` en `Cargo.toml`. Se puede borrar sin impacto. |

---

## 2. Esquemas autogenerados en `src-tauri/gen/schemas/` (`4` archivos)

Tauri 2 genera y actualiza automáticamente estos archivos al ejecutar `cargo build` / `tauri dev`:

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 7 | [`src-tauri/gen/schemas/acl-manifests.json`](../../src-tauri/gen/schemas/acl-manifests.json) | **AUTOGENERADO TAURI** | Catálogo JSON de permisos ACL nativos de Tauri 2 para `core:*` y `notification`. |
| 8 | [`src-tauri/gen/schemas/capabilities.json`](../../src-tauri/gen/schemas/capabilities.json) | **AUTOGENERADO TAURI** | Proyecta la ACL de `src-tauri/capabilities/main-events.json`: permite escuchar y liberar suscripciones de eventos sólo en la ventana local `main`. La ACL nativa complementa el `PermissionGateway` R2 de Alice; ese gateway no sustituye los permisos de los comandos internos de Tauri. |
| 9 | [`src-tauri/gen/schemas/desktop-schema.json`](../../src-tauri/gen/schemas/desktop-schema.json) | **AUTOGENERADO TAURI** | Esquema JSON Draft-07 de autocompletado IDE para archivos de capacidades de escritorio en Tauri 2. |
| 10 | [`src-tauri/gen/schemas/windows-schema.json`](../../src-tauri/gen/schemas/windows-schema.json) | **AUTOGENERADO TAURI** | Esquema JSON Draft-07 para capacidades Windows en Tauri 2 (idéntico byte a byte a `desktop-schema.json`; `tauri-build` lo regenera solo). |

---

## 3. Iconos de empaquetado en `src-tauri/icons/` (`52` archivos)

> **Atención de limpieza:** De los 52 archivos aquí dentro, **solo 2 intervienen hoy en ejecución/compilación real** (`icon.png` e `icon.ico`) y otros 3 PNG de escritorio están listados en `tauri.conf.json` para futuro instalador. **Los 35 archivos de `android/` e `ios/` y `icon.icns` (775 KB de macOS) son residuos de plantilla generados por `tauri icon` para plataformas que Alice no soporta.**

### 3.1 Raíz de `src-tauri/icons/` (`17` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 11 | `src-tauri/icons/icon.png` | **ACTIVO EN RUNTIME** | PNG `512x512` incrustado en compilación por `src-tauri/src/lib.rs` (`include_bytes!("../icons/icon.png")`) para asignar el icono de la ventana principal de escritorio. |
| 12 | `src-tauri/icons/icon.ico` | **ACTIVO EN BUILD WIN32** | Icono multirresolución de Windows incrustado por `tauri-build` como icono del ejecutable `.exe` y listado en `tauri.conf.json`. |
| 13 | `src-tauri/icons/32x32.png` | **RESERVADO BUNDLE** | PNG `32x32` listado en `tauri.conf.json` (`bundle.icon`) para futuro empaquetado Linux/escritorio (`bundle.active` hoy es `false`). |
| 14 | `src-tauri/icons/128x128.png` | **RESERVADO BUNDLE** | PNG `128x128` listado en `tauri.conf.json` (`bundle.icon`) para futuro empaquetado de escritorio. |
| 15 | `src-tauri/icons/128x128@2x.png` | **RESERVADO BUNDLE** | PNG HiDPI `256x256` listado en `tauri.conf.json` (`bundle.icon`) para futuro empaquetado de escritorio. |
| 16 | `src-tauri/icons/64x64.png` | **SIN USO ACTUAL** | PNG `64x64` generado por `tauri icon`, no referenciado en `tauri.conf.json` ni en código. |
| 17 | `src-tauri/icons/icon.icns` | **RESIDUO macOS (793 KB)** | Contenedor de icono exclusivo de macOS (`.app`/`.dmg`). Aunque `tauri icon` lo puso por defecto en `bundle.icon`, Alice solo apunta a Windows y Ubuntu. |
| 18–27 | `Square30x30Logo.png`, `Square44x44Logo.png`, `Square71x71Logo.png`, `Square89x89Logo.png`, `Square107x107Logo.png`, `Square142x142Logo.png`, `Square150x150Logo.png`, `Square284x284Logo.png`, `Square310x310Logo.png`, `StoreLogo.png` (`10` archivos) | **SIN USO ACTUAL (MSIX)** | Azulejos PNG generados por plantilla para paquetes Appx/MSIX de Microsoft Store; ninguno está referenciado en `tauri.conf.json` (`bundle.active: false`). |

### 3.2 `src-tauri/icons/android/` (`17` archivos — **100 % BASURA MÓVIL**)

| # | Archivos | Estado | Qué son |
|---:|---|---|---|
| 28–44 | `mipmap-anydpi-v26/ic_launcher.xml`, `values/ic_launcher_background.xml`, y `ic_launcher.png`, `ic_launcher_foreground.png`, `ic_launcher_round.png` en `mipmap-mdpi/`, `mipmap-hdpi/`, `mipmap-xhdpi/`, `mipmap-xxhdpi/` y `mipmap-xxxhdpi/` (`17` archivos) | **BASURA MÓVIL ANDROID** | Recursos de lanzador adaptativo Android creados automáticamente al correr `tauri icon`. No existe soporte ni carpeta `gen/android` en el proyecto. |

### 3.3 `src-tauri/icons/ios/` (`18` archivos — **100 % BASURA MÓVIL**)

| # | Archivos | Estado | Qué son |
|---:|---|---|---|
| 45–62 | `AppIcon-20x20@1x.png`, `AppIcon-20x20@2x.png`, `AppIcon-20x20@2x-1.png`, `AppIcon-20x20@3x.png`, `AppIcon-29x29@1x.png`, `AppIcon-29x29@2x.png`, `AppIcon-29x29@2x-1.png`, `AppIcon-29x29@3x.png`, `AppIcon-40x40@1x.png`, `AppIcon-40x40@2x.png`, `AppIcon-40x40@2x-1.png`, `AppIcon-40x40@3x.png`, `AppIcon-512@2x.png` (334 KB), `AppIcon-60x60@2x.png`, `AppIcon-60x60@3x.png`, `AppIcon-76x76@1x.png`, `AppIcon-76x76@2x.png`, `AppIcon-83.5x83.5@2x.png` (`18` archivos) | **BASURA MÓVIL iOS** | Catálogo de iconos de iPhone/iPad/App Store creado por `tauri icon` (incluye 3 archivos `*-1.png` duplicados byte a byte). Sin ningún uso en escritorio. |

---

## 4. Código fuente Rust y Prompts en `src-tauri/src/` (`62` archivos)

### 4.1 Módulos principales en `src-tauri/src/` (`40` archivos `.rs`)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 63 | [`src-tauri/src/audit.rs`](../../src-tauri/src/audit.rs) | **ACTIVO** | Libro mayor de auditoría unificada R3 (`data/audit/events-v1.jsonl` con rotación automática al pasar de 5 MiB). Valida que cada evento no guarde contenido privado ni rutas sensibles y expone `audit_snapshot` para la pantalla *Actividad*. |
| 64 | [`src-tauri/src/automatic_memory.rs`](../../src-tauri/src/automatic_memory.rs) | **ACTIVO** | Aprendizaje conversacional autónomo (`ADR-P-101`): tras cada respuesta local de Gemma evalúa en segundo plano con `prompts/automatic-memory.txt` si conviene guardar hasta 2 citas literales del usuario en `data/memory/automatic-v1.json`, permitiendo pausar, corregir o retirar recuerdos (`automatic_memory_status`, `set_automatic_memory_enabled`, `review_automatic_memory`). |
| 65 | [`src-tauri/src/avatar.rs`](../../src-tauri/src/avatar.rs) | **ACTIVO** | Verifica en solo lectura `local/assets/Alice.vrm` y los clips `.fbx` de `local/assets/Animations/private/mixamo`, habilita exactamente esos archivos en el protocolo `asset://` de Tauri al iniciar (`configure_asset_scope`) y audita en R3 los cambios de estado motor del visor manual (`avatar_status`, `avatar_animation_status`, `record_avatar_motor_transition`). |
| 66 | [`src-tauri/src/capabilities.rs`](../../src-tauri/src/capabilities.rs) | **ACTIVO** | Registro declarativo de Capacidades R1 (~42 capacidades con nivel de riesgo, permisos requeridos, madurez y sonda de salud en tiempo real sin efectos secundarios). Expone `capability_registry_status` consumido en las pantallas de gobernanza. |
| 67 | [`src-tauri/src/cloud.rs`](../../src-tauri/src/cloud.rs) | **ACTIVO** | Orquestador central de conversación (`cloud_status` y `send_cloud_message`). Conecta Gemma local (`llamacpp`), Ollama local y proveedores cloud (`google`, `openai`, `anthropic`, `xai`, `compatible`; mantiene `OPENROUTER_PAUSED = true`). Coordina resolución de citas (`conversation_reference`), acciones multimedia/escritorio (`media_actions`, `desktop_actions`), visión (`conversation_vision`), memoria de trabajo, historial durable y disparo de memoria automática. |
| 68 | [`src-tauri/src/conversation_history.rs`](../../src-tauri/src/conversation_history.rs) | **ACTIVO** | Persiste de forma atómica (con rollback si falla R3) el historial cotidiano de conversación en `data/conversation/history-v1.json` (hasta 1.000 intercambios), separado de la RAM de trabajo y de la memoria duradera R6. Expone `conversation_history_status`. |
| 69 | [`src-tauri/src/conversation_learning.rs`](../../src-tauri/src/conversation_learning.rs) | **ACTIVO** | Extracción manual gobernada de recuerdos desde un turno real del historial de conversación usando Gemma local, detectando emociones explícitas (`memory_affect`) y confirmando el guardado transaccional en `records.json` (`preview_conversation_learning`, `confirm_conversation_learning`). |
| 70 | [`src-tauri/src/conversation_reference.rs`](../../src-tauri/src/conversation_reference.rs) | **ACTIVO** | Resuelve localmente sin llamar al LLM preguntas metalingüísticas acotadas sobre citas con posesivos explícitos del turno previo (ej. *«tu explicación» ¿a quién se refería?*), evitando confusiones entre Carlos y Alice (`ADR-P-110`). |
| 71 | [`src-tauri/src/conversation_vision.rs`](../../src-tauri/src/conversation_vision.rs) | **ACTIVO** | Administra sesiones efímeras de visión en RAM (`VisionSessionStore`) para adjuntar fotogramas de cámara WebView o capturas del escritorio en memoria (vía Win32 GDI en Windows, sin tocar disco) al conversar con Gemma (`start_vision_session`, `stop_vision_session`, `preview_vision_desktop`). |
| 72 | [`src-tauri/src/core_activity.rs`](../../src-tauri/src/core_activity.rs) | **ACTIVO** | Deriva en solo lectura la intensidad reciente de 7 regiones y 5 enlaces del Núcleo Cognitivo a partir de los últimos 5 minutos de eventos reales en R3 (`core_activity_snapshot`). |
| 73 | [`src-tauri/src/desktop_actions.rs`](../../src-tauri/src/desktop_actions.rs) | **ACTIVO** | Ejecuta aperturas locales acotadas en escritorio bajo lista blanca estricta: iniciar `Spotify` o abrir las raíces `D:\` y `E:\` en el Explorador, ya sea por orden directa en español o por *tool calling* validado de Gemma. |
| 74 | [`src-tauri/src/diagnostics.rs`](../../src-tauri/src/diagnostics.rs) | **ACTIVO** | Diagnóstico pasivo de salud del sistema en solo lectura (`diagnostic_snapshot`): comprueba rutas, ledger R3, integridad de memoria/respaldos, proveedores IA, avatar, sondas Python y gateway de permisos sin crear archivos ni abrir sensores. |
| 75 | [`src-tauri/src/documents.rs`](../../src-tauri/src/documents.rs) | **ACTIVO** | Previsualiza documentos locales (`.pdf`, `.md`, `.txt` hasta 16 MiB) incrustando `scripts/adapters/document_reader.py` y ejecutándolo con el Python aislado de `local/venv` por tuberías `stdin`/`stdout` sin guardar el texto extraído (`preview_document`). |
| 76 | [`src-tauri/src/face_readiness.rs`](../../src-tauri/src/face_readiness.rs) | **ACTIVO (NOTA PYTHON)** | Sonda pasiva del panel *Rostro* (`face_readiness_status`): verifica el hash SHA-256 de `face_landmarker_float16_v1.task` y si Python tiene `cv2`, `mediapipe` y `numpy` sin abrir la cámara (`sensorOpened = false`). *Nota:* invoca `"python"` del `PATH` global en vez de `local/venv`. |
| 77 | [`src-tauri/src/hybrid_retrieval.rs`](../../src-tauri/src/hybrid_retrieval.rs) | **ACTIVO** | Re-ranking híbrido opcional (`preview_hybrid_memory_retrieval`): pide a Gemma local (con *JSON Schema strict* y timeout de 25 s) elegir los 3 recuerdos más pertinentes entre 3 y 24 candidatos prefiltrados sin modificar datos persistentes. |
| 78 | [`src-tauri/src/knowledge_graph.rs`](../../src-tauri/src/knowledge_graph.rs) | **ACTIVO** | Proyecta en solo lectura los nodos del Grafo de Conocimiento R8 (`knowledge_graph_snapshot`) desde `records.json` y valida vistas previas de asociaciones con citas literales (`preview_knowledge_graph_association`). Enlaza además `knowledge_graph/associations.rs`. |
| 79 | [`src-tauri/src/learning_candidates.rs`](../../src-tauri/src/learning_candidates.rs) | **DESCONECTADO DE UI ACTIVA (HEREDADO)** | Antiguo extractor R6.4 basado en **Ollama** (`preview_learning_candidates`, `confirm_learning_candidate`). Sus comandos siguen registrados en `lib.rs`, pero **solo los llama `MemoryCandidatePanel.tsx` (componente huérfano no montado en React)**; en la UI viva fue desplazado por `conversation_learning.rs` con Gemma. |
| 80 | [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) | **ACTIVO** | Punto de composición principal del backend Tauri: declara los 38 módulos raíz, registra los estados compartidos (`manage`), configura el scope de assets del avatar, el icono de ventana, los 3 hilos de fondo (observador de ventana, *reaper* de sensores y motor temporal de tareas R7), registra los **102 comandos IPC** y detiene `llama-server` al cerrar la app. |
| 81 | [`src-tauri/src/local_inference.rs`](../../src-tauri/src/local_inference.rs) | **ACTIVO** | Gestiona el arranque, parada, estado y peticiones HTTP del servidor local propio `llama-server` (`127.0.0.1:18089`) con Gemma 4 E2B + proyector multimodal `mmproj`. Incluye arbitraje exclusivo de VRAM frente a Ollama (`InferenceArbiter`), cancelación inmediata por generación (`ADR-P-111`), funciones internas de chat/visión/audio y los comandos `local_runtime_status`, `start_local_runtime` y `stop_local_runtime`. |
| 82 | [`src-tauri/src/main.rs`](../../src-tauri/src/main.rs) | **ACTIVO** | Punto de entrada mínimo (6 líneas) del ejecutable nativo: oculta la consola en builds `release` de Windows y llama a `alice_continuum_lib::run()`. |
| 83 | [`src-tauri/src/media_actions.rs`](../../src-tauri/src/media_actions.rs) | **ACTIVO** | Coordina el control multimedia local sobre **Spotify** (reproducir *Tus me gusta*, pausar, continuar, siguiente, anterior) y **YouTube en Chrome** (abrir inicio, buscar, reproducir primer resultado, pausar/continuar), recordando el último medio usado y auditando en R3. |
| 84 | [`src-tauri/src/media_windows.rs`](../../src-tauri/src/media_windows.rs) | **ACTIVO (SOLO WINDOWS)** | Implementación nativa Win32/WinRT de `media_actions.rs`: combina `GlobalSystemMediaTransportControlsSessionManager` (SMTC), `IUIAutomation` (árbol de accesibilidad COM) y `ShellExecuteW` para controlar Spotify y Chrome sin inyectar teclas globales ciegas. |
| 85 | [`src-tauri/src/memory.rs`](../../src-tauri/src/memory.rs) | **ACTIVO (1 COMANDO HUÉRFANO)** | Fachada del subsistema de memoria R6 (`ADR-P-108`): coordina los submódulos de `src-tauri/src/memory/`, serializa escrituras con `MEMORY_WRITE_LOCK`, audita en R3 y expone 25 comandos IPC. *Nota:* uno de sus comandos (`markdown_note_catalog`) no es invocado por ningún archivo del frontend. |
| 86 | [`src-tauri/src/memory_affect.rs`](../../src-tauri/src/memory_affect.rs) | **ACTIVO** | Analizador léxico determinista en español de las 10 emociones explícitas del modelo afectivo (descartando negaciones cercanas y exigiendo cita literal verificable) antes de guardar recuerdos. |
| 87 | [`src-tauri/src/observation.rs`](../../src-tauri/src/observation.rs) | **ACTIVO** | Hilo observador en segundo plano que consulta cada 2 s la ventana activa de Windows (solo nombre de proceso y clase, nunca títulos privados) únicamente cuando existe un permiso R2 activo de sesión (`get_foreground_context`). |
| 88 | [`src-tauri/src/owner_profile.rs`](../../src-tauri/src/owner_profile.rs) | **ACTIVO** | Lee en modo solo lectura `data/memory/owner-profile.json` y comprueba la existencia y hash SHA-256 de sus fuentes Markdown asociadas (`owner_profile_status`). |
| 89 | [`src-tauri/src/permissions.rs`](../../src-tauri/src/permissions.rs) | **ACTIVO (2 COMANDOS HUÉRFANOS)** | Fachada IPC y ejecutor gobernado del Gateway de Permisos R2 sobre `permissions/gateway.rs` (8 comandos). *Nota:* `execute_sensor_lease_grant` y `stop_sensor_lease` solo son llamados desde el componente huérfano `SensoryLearningPanel.tsx`. |
| 90 | [`src-tauri/src/procedure_learning.rs`](../../src-tauri/src/procedure_learning.rs) | **ACTIVO** | Detector determinista R5.1/R5.2 (`procedure_detection_status`): analiza en solo lectura la ventana de auditoría R3 para detectar secuencias repetidas exitosas (≥ 3 apariciones, ≥ 2 pasos) como candidatos a procedimientos. |
| 91 | [`src-tauri/src/procedure_store.rs`](../../src-tauri/src/procedure_store.rs) | **ACTIVO** | Almacén gobernado R5.3/R5.4 (`data/procedures/candidate-decisions-v1.json`): guarda decisiones inmutables (`Retain`/`Dismiss`) del propietario y convierte una única vez un procedimiento retenido en borrador de habilidad R4 (`SimulationOnly`). |
| 92 | [`src-tauri/src/runtime_paths.rs`](../../src-tauri/src/runtime_paths.rs) | **ACTIVO** | Centraliza todas las rutas configurables por variables de entorno (`ALICE_INFERENCE_HOME`, `ALICE_LLAMA_SERVER`, `ALICE_GEMMA_MODEL`, `ALICE_GEMMA_PROJECTOR`, `ALICE_WHISPER_BIN`, `ALICE_WHISPER_MODEL`, `ALICE_PYTHON_BIN`, `ALICE_GPU_LAYERS` —por defecto `"24"` en Windows y `"0"` en Linux—) con respaldos seguros por plataforma. |
| 93 | [`src-tauri/src/sensory.rs`](../../src-tauri/src/sensory.rs) | **PARCIALMENTE DESCONECTADO** | Gestiona arrendamientos temporales R2 (1–60 s) de cámara/micrófono y sondas Python para `capabilities.rs`/`diagnostics.rs`. Su comando `sensor_lease_status` solo se llama desde el panel huérfano `SensoryLearningPanel.tsx`, usa `"python"` global y contiene nombres de dispositivos del portátil de desarrollo (`ACER HD User Facing`). |
| 94 | [`src-tauri/src/skills.rs`](../../src-tauri/src/skills.rs) | **ACTIVO** | Contrato y almacén atómico de borradores de habilidades declarativas R4.1/R4.2 (`data/skills/manifest.json`, modo `SimulationOnly` sin código ejecutable), más enlace a `skills/{lifecycle,simulation,templates}.rs`. |
| 95 | [`src-tauri/src/tasks.rs`](../../src-tauri/src/tasks.rs) | **ACTIVO** | Motor y almacén gobernado de tareas/intenciones y recordatorios R7 (`tasks-v1.json`, `attempt-ledger-v1.json`), hilo supervisor de vencimientos y despacho idempotente de notificaciones nativas (9 comandos usados en `TaskRegistryPanel.tsx`). |
| 96 | [`src-tauri/src/util.rs`](../../src-tauri/src/util.rs) | **ACTIVO** | Utilidades transversales mínimas: codificación hexadecimal SHA-256 (`encode_hex_lower`/`upper`), reloj en milisegundos (`timestamp_ms`) y resolución de `ALICE_DATA_DIR` (`alice_data_root`). |
| 97 | [`src-tauri/src/visual_learning.rs`](../../src-tauri/src/visual_learning.rs) | **DESCONECTADO DE UI ACTIVA (HEREDADO)** | Antiguo analizador de capturas de pantalla contra **Ollama** (`analyze_screen_frame`). Registrado en `lib.rs`, pero **solo era invocado por el panel huérfano `SensoryLearningPanel.tsx`**; hoy la visión activa usa `conversation_vision.rs` con Gemma. |
| 98 | [`src-tauri/src/voice_input.rs`](../../src-tauri/src/voice_input.rs) | **ACTIVO** | Comando `transcribe_voice_turn`: valida audio WebM/Opus en memoria, lo convierte a WAV PCM 16 kHz mono por tuberías con `ffmpeg` (sin escribir archivos temporales), transcribe preferentemente con Whisper CPU (`whisper_input.rs`) y mantiene Gemma audio como respaldo si Whisper no está instalado. |
| 99 | [`src-tauri/src/voice_output.rs`](../../src-tauri/src/voice_output.rs) | **ACTIVO** | Síntesis de voz TTS mediante Fish Audio (`s2.1-pro-free`), comprobando antes que el texto exista realmente como respuesta de Alice en `history-v1.json`. Soporta modo manual con previsualización y modo continuo de sesión (`speak_voice_session_response`). |
| 100 | [`src-tauri/src/voice_session.rs`](../../src-tauri/src/voice_session.rs) | **ACTIVO** | Almacén en RAM de sesiones continuas de voz (`VoiceSessionStore`): valida credenciales de Fish Audio al iniciar, invalida respuestas o audios tardíos al detener/revocar sesión y audita en R3 (`start_voice_session`, `stop_voice_session`). |
| 101 | [`src-tauri/src/whisper_input.rs`](../../src-tauri/src/whisper_input.rs) | **ACTIVO** | Adaptador nativo de `whisper-cli` en CPU (`-l es -t 4 -ng`) alimentado por `stdin` en RAM. Cortocircuita silencios por energía PCM y filtra alucinaciones típicas de subtítulos (`[Música]`, `Subtítulos realizados por...`). |
| 102 | [`src-tauri/src/working_memory.rs`](../../src-tauri/src/working_memory.rs) | **ACTIVO** | Memoria de trabajo volátil en RAM (máx. 6 turnos / 72.000 caracteres / TTL 2 h) protegida por contador de generación ante limpiezas concurrentes (`working_memory_status`, `clear_working_memory`). |

### 4.2 Submódulos especializados (`22` archivos)

#### `src-tauri/src/knowledge_graph/` (`1` archivo)
| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 103 | [`src-tauri/src/knowledge_graph/associations.rs`](../../src-tauri/src/knowledge_graph/associations.rs) | **ACTIVO** | Diario inmutable encadenado por SHA-256 de asociaciones explícitas entre recuerdos (`memory/associations-v1/000001.json`…), permitiendo confirmar, retirar o restaurar relaciones tipadas sin mutar `records.json`. |

#### `src-tauri/src/memory/` (`14` archivos)
| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 104 | [`src-tauri/src/memory/assessment.rs`](../../src-tauri/src/memory/assessment.rs) | **ACTIVO** | Evaluaciones gobernadas del propietario sobre recuerdos en `records.json` (validez, accesibilidad `accessible`/`dormant` y supresión reversible) con respaldo previo y rollback atómico. |
| 105 | [`src-tauri/src/memory/consolidation.rs`](../../src-tauri/src/memory/consolidation.rs) | **ACTIVO** | Detección en lectura de recuerdos duplicados R6.3, decisión auditada `KeepSeparate`, vista previa de fusión y recibo durable de recuperación ante fallos (`consolidation-merge-transactions-v1.json`). |
| 106 | [`src-tauri/src/memory/layers.rs`](../../src-tauri/src/memory/layers.rs) | **ACTIVO** | Proyección reversible de memoria por capas (`layer-index-v3.json`: episódica, hechos enseñados, procedimental pendiente y sin clasificar) sin duplicar textos privados. |
| 107 | [`src-tauri/src/memory/learning.rs`](../../src-tauri/src/memory/learning.rs) | **ACTIVO (CON RUTA HEREDADA)** | Persistencia transaccional en `records.json` de aprendizajes confirmados: contiene la ruta activa de conversación Gemma (`append_confirmed_conversation_learning`) y la ruta heredada de Ollama (`append_confirmed_learning`, usada solo por `learning_candidates.rs`). |
| 108 | [`src-tauri/src/memory/lifecycle.rs`](../../src-tauri/src/memory/lifecycle.rs) | **ACTIVO** | Calcula elegibilidad de recuperación RAG (`Eligible`, bloqueado por archivo/conflicto/supresión/latencia) y gestiona `lifecycle-index-v1.json`. |
| 109 | [`src-tauri/src/memory/model.rs`](../../src-tauri/src/memory/model.rs) | **ACTIVO** | Contratos de datos, structs y enums `serde` compartidos por todo el subsistema `memory`. |
| 110 | [`src-tauri/src/memory/paths.rs`](../../src-tauri/src/memory/paths.rs) | **ACTIVO** | Crea bajo demanda la estructura interna de `data/memory/`, escribe `manifest.json` y migra transparentemente archivos antiguos `sessions.json` si existieran. |
| 111 | [`src-tauri/src/memory/queries.rs`](../../src-tauri/src/memory/queries.rs) | **ACTIVO (CON FUNCIÓN SIN UI)** | Consultas puras de lectura sobre `records.json`, sondas de salud y proyección de referencias R8. Incluye además `markdown_note_catalog_at` (catálogo de notas `.md` en `memory/notes`), cuyo comando IPC no tiene consumidor en el frontend. |
| 112 | [`src-tauri/src/memory/reconsolidation.rs`](../../src-tauri/src/memory/reconsolidation.rs) | **ACTIVO** | Reconsolidación versionada de recuerdos: incrementa `memoryVersion`, archiva la versión anterior en `memory/revisions/` y aplica rollback completo si falla la auditoría. |
| 113 | [`src-tauri/src/memory/records.rs`](../../src-tauri/src/memory/records.rs) | **ACTIVO** | Guardado básico validado, exportación con sello temporal a `memory/exports/` y restauración atómica desde `records.backup.json` (`ADR-P-111`). |
| 114 | [`src-tauri/src/memory/retention.rs`](../../src-tauri/src/memory/retention.rs) | **ACTIVO** | Archivo reversible, programación de borrado con ventana obligatoria de 7 días y borrado definitivo con resguardo y lápida sin datos privados (`deletion-tombstones/`). |
| 115 | [`src-tauri/src/memory/storage.rs`](../../src-tauri/src/memory/storage.rs) | **ACTIVO** | Primitivas de archivos e integridad SHA-256 del subsistema de memoria, incluyendo reemplazo atómico con `sync_all` + `MoveFileExW` en Windows y verificación byte a byte. |
| 116 | [`src-tauri/src/memory/tests.rs`](../../src-tauri/src/memory/tests.rs) | **ACTIVO (TESTS RUST)** | Batería de pruebas unitarias e integración del subsistema `memory` (~3.637 líneas, compilada solo bajo `#[cfg(test)]`). |
| 117 | [`src-tauri/src/memory/validation.rs`](../../src-tauri/src/memory/validation.rs) | **ACTIVO** | Validadores deterministas puros (sin E/S) de invariantes de sesiones, capas, ciclo de vida, consolidación y citas literales del grafo R8. |

#### `src-tauri/src/permissions/` (`1` archivo)
| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 118 | [`src-tauri/src/permissions/gateway.rs`](../../src-tauri/src/permissions/gateway.rs) | **ACTIVO** | Máquina de estados en memoria `PermissionGateway` R2: gestiona solicitudes preparadas inmutables, grants `OneShot` y `Session`, idempotencia, expiración TTL y revocación inmediata. |

#### `src-tauri/src/prompts/` (`3` archivos `.txt`)
| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 119 | [`src-tauri/src/prompts/automatic-memory.txt`](../../src-tauri/src/prompts/automatic-memory.txt) | **ACTIVO** | Prompt de sistema incrustado en `automatic_memory.rs` para seleccionar citas literales útiles del propietario en formato JSON estricto (`skip` / `save`). |
| 120 | [`src-tauri/src/prompts/conversation-voice.txt`](../../src-tauri/src/prompts/conversation-voice.txt) | **ACTIVO** | Prompt de sistema incrustado en `cloud.rs` para conversación hablada con Gemma: respuestas orales breves (1–3 frases sin Markdown), distinción Carlos/Alice y prohibición de fingir acciones. |
| 121 | [`src-tauri/src/prompts/conversation.txt`](../../src-tauri/src/prompts/conversation.txt) | **ACTIVO** | Prompt principal de conversación escrita incrustado en `cloud.rs`: define identidad de Alice, frontera entre recuerdos reales y `Conocimiento interno no verificado:` y reglas anti-alucinación. |

#### `src-tauri/src/skills/` (`3` archivos `.rs`)
| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 122 | [`src-tauri/src/skills/lifecycle.rs`](../../src-tauri/src/skills/lifecycle.rs) | **ACTIVO** | Ciclo de vida inmutable de habilidades R4.4 (`InReview`, `Approved`, `Disabled`, `Retired`) manteniendo siempre deshabilitada la ejecución automática (`execution_enabled: false`). |
| 123 | [`src-tauri/src/skills/simulation.rs`](../../src-tauri/src/skills/simulation.rs) | **ACTIVO** | Simulador estático R4.3 (`simulate_skill_plan`): contrasta un manifiesto de habilidad contra el inventario vivo R1 sin ejecutar ningún efecto real. |
| 124 | [`src-tauri/src/skills/templates.rs`](../../src-tauri/src/skills/templates.rs) | **ACTIVO** | Generador de plantilla inicial de solo lectura R4.5 (`prepare_read_only_skill_template`) para el Taller de habilidades. |

