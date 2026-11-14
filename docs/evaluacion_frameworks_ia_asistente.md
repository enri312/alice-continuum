# Evaluación de frameworks y motores para una IA asistente en Alice Continuum

Fecha del análisis: 2026-11-05 · Rama `master`  
Fuentes inspeccionadas: [`package.json`](../package.json), [`src-tauri/Cargo.toml`](../Backend/src-tauri/Cargo.toml), entorno `local/venv`, [`Roadmap.md`](../Roadmap.md), [`docs/architecture/CODE_REVIEW_2026-11-05.md`](architecture/CODE_REVIEW_2026-11-05.md) y módulos de `src/` y `src-tauri/src/`.

---

## 1. Diagnóstico general

**Alice Continuum cuenta con la base correcta de motores nativos**, pero **prescinde deliberadamente de frameworks agénticos pesados en Python** (como LangChain, LlamaIndex, CrewAI o AutoGen) a favor de un orquestador, sistema de memoria y pasarela de permisos propios en **Rust + TypeScript**.

Esta decisión es coherente con los principios del proyecto (*local-first*, denegación predeterminada, trazabilidad R3 y ejecutable de escritorio liviano sobre Tauri 2). Sin embargo, frente al stack completo de una IA asistente moderna de uso cotidiano, existen **cuatro brechas técnicas concretas** (principalmente en búsqueda semántica/vectorial, audio neuronal local y voz en streaming con cancelación de eco).

---

## 2. Mapa comparativo por capas

| Capa de una IA Asistente | Estándar habitual en la industria | Qué utiliza Alice Continuum hoy | Estado actual |
|---|---|---|---|
| **1. Plataforma y UI de escritorio** | Tauri o Electron + React | **Tauri 2 + Rust 1.99.1 + React 19.3.1 + Vite 8.3.5** ([`package.json`](../package.json), [`Cargo.toml`](../Backend/src-tauri/Cargo.toml)) + APIs Win32 vía crate `windows` `0.62` | **Óptimo.** Mucho menor consumo de RAM y superficie de ataque más acotada que Electron. |
| **2. Inferencia LLM / VLM** | `llama.cpp`, Ollama, vLLM o APIs Cloud | **llama.cpp** local ejecutando **Gemma 4 E2B** con proyector multimodal ([`local_inference.rs`](../Backend/src-tauri/src/local_inference.rs)) + conectores HTTP propios (`reqwest` + `rustls`) para Ollama local, Google Gemini, OpenAI, Anthropic, xAI y endpoints compatibles ([`cloud.rs`](../Backend/src-tauri/src/cloud.rs)) | **Completo en conectividad**, aunque las respuestas conversacionales aún se esperan completas en bloque (sin *streaming* token a token hacia la síntesis de voz). |
| **3. Orquestación y *Tool Calling*** | LangGraph, Semantic Kernel, Rig (Rust), Vercel AI SDK, **MCP** | Enrutador determinista propio en Rust + validación estricta con *JSON Schema* y *tool choice* acotado para multimedia y escritorio ([`cloud.rs`](../Backend/src-tauri/src/cloud.rs), [`media_actions.rs`](../Backend/src-tauri/src/media_actions.rs), [`desktop_actions.rs`](../Backend/src-tauri/src/desktop_actions.rs), [`skills.rs`](../Backend/src-tauri/src/skills.rs)) | **Sólido para acciones acotadas y gobernadas**, pero sin protocolo estándar de conectores (**MCP**) ni planificación multi-paso abierta. |
| **4. Memoria, Embeddings y RAG** | SQLite + `sqlite-vec` / `LanceDB` + modelo de embeddings local | Almacenes locales JSON/JSONL ([`memory.rs`](../Backend/src-tauri/src/memory.rs), [`src-tauri/src/memory/`](../Backend/src-tauri/src/memory/)), grafo ([`knowledge_graph.rs`](../Backend/src-tauri/src/knowledge_graph.rs)), **búsqueda léxica con *stemming* en español** ([`memory-retrieval.ts`](../src/core/memory/memory-retrieval.ts)), re-ranking por LLM con Gemma sobre hasta 24 candidatos ([`hybrid_retrieval.rs`](../Backend/src-tauri/src/hybrid_retrieval.rs)) y lector documental con **PyMuPDF `1.26.4`** ([`document_reader.py`](../Backend/adapters/document_reader.py)) | **Funcional a pequeña escala, incompleto a escala mayor:** no hay índice vectorial/embeddings activo ni motor transaccional SQL embebido. |
| **5. Pipeline de Voz y Audio** | Silero VAD + Wake-Word + Whisper + TTS local/streaming + WebRTC AEC | Reducción de ruido con **`@shiguredo/rnnoise-wasm`**, detector de fin de turno propio ([`speech-endpoint.ts`](../src/core/voice/speech-endpoint.ts)), **Whisper base CPU** + FFmpeg ([`whisper_input.rs`](../Backend/src-tauri/src/whisper_input.rs)) y síntesis remota con **Fish Audio** ([`voice_output.rs`](../Backend/src-tauri/src/voice_output.rs)) | **Parcial (en curso en R9):** faltan motor de *wake-word* (activación por nombre), cancelación de eco acústico (AEC) para interrupción (*barge-in*) y TTS local de baja latencia. |
| **6. Percepción Visual y Avatar 3D** | Three.js + VRM + MediaPipe / VLM | **Three.js `0.185` + `@pixiv/three-vrm` `3.5.5`**, cinemática inversa (IK) y FSM de 7 estados ([`src/core/embodiment/`](../src/core/embodiment/)), visión efímera por turnos con Gemma ([`conversation_vision.rs`](../Backend/src-tauri/src/conversation_vision.rs)) y sonda validada con **MediaPipe Face Landmarker** | **Bien cubierto** para su integración prevista al cierre de R9. |
| **7. Seguridad, Permisos y Auditoría** | NeMo Guardrails, políticas RBAC, OpenTelemetry | Registro tipado de capacidades R1 ([`capabilities.rs`](../Backend/src-tauri/src/capabilities.rs)), gateway de permisos R2 con previsualización inmutable ([`permissions.rs`](../Backend/src-tauri/src/permissions.rs)) y auditoría unificada R3 con SHA-256 ([`audit.rs`](../Backend/src-tauri/src/audit.rs)) | **Muy superior al promedio** de los frameworks genéricos de agentes. |

---

## 3. Frameworks que NO conviene incorporar

- **Frameworks agénticos pesados en Python (`LangChain`, `LlamaIndex`, `CrewAI`, `AutoGen`):**
  - Introducirían un servidor Python permanente en segundo plano y varios gigabytes de dependencias transitivas.
  - Dificultarían mantener las garantías de denegación predeterminada, auditoría R3 y control explícito de memoria que hoy están centralizadas en Rust.
  - Python funciona bien en su rol actual dentro de Alice: como adaptador acotado y aislado (por ejemplo, `PyMuPDF` para extracción documental).

---

## 4. Los 4 motores / frameworks que SÍ le faltan para completarse

Alineado con los pendientes de R9 en [`Roadmap.md`](../Roadmap.md) y con las evaluaciones previas en [`docs/research/`](research/), estos son los componentes que suelen estar presentes en una asistente madura y que vale la pena evaluar:

### 4.1. Índice vectorial derivado + almacenamiento embebido (`rusqlite` + `sqlite-vec` o `LanceDB`, más embeddings locales)
- **Situación actual:** La recuperación primaria en [`memory-retrieval.ts`](../src/core/memory/memory-retrieval.ts) depende de coincidencia léxica de raíces en español, y la persistencia reescribe archivos JSON. Si el usuario consulta usando sinónimos («auto» vs. «coche») o acumula miles de recuerdos y fragmentos documentales, el filtro léxico previo no rescatará todos los candidatos relevantes.
- **Cómo integrarlo sin romper principios:** Tal como se estableció en [`CHROMADB_FIT_EVALUATION_2026-09-15.md`](research/CHROMADB_FIT_EVALUATION_2026-09-15.md), un índice vectorial **nunca debe sustituir la fuente canónica gobernada de recuerdos**, sino operar como **índice secundario reconstruible** usando un modelo local ligero (como `intfloat/multilingual-e5-small` vía ONNX/`fastembed` o embeddings de `llama.cpp`) respaldado por SQLite (`rusqlite` + `sqlite-vec`) en un único archivo local sin servidor externo.

### 4.2. Runtime de audio neuronal local en Rust (`ort` / ONNX Runtime o `sherpa-onnx`)
- **Situación actual:** La voz depende de Fish Audio en red (~4,5 s de latencia de síntesis), no existe detección dedicada de palabra de activación (*wake-word*) y el fin de voz se estima solo con RMS + probabilidad de RNNoise.
- **Qué resolvería un único runtime ONNX en Rust:**
  1. **Activación por nombre (*Wake-Word*):** Modelos ligeros tipo *OpenWakeWord* corriendo en CPU con consumo mínimo para detectar «Alice» sin transcribir audio continuamente.
  2. **VAD neuronal (*Silero VAD*):** Detección de voz más robusta ante música o ruido ambiente que un umbral energético simple.
  3. **TTS neuronal local de baja latencia (*Kokoro-82M* o *Piper*):** Síntesis local en milisegundos como alternativa privada o respaldo inmediato sin depender de conexión ni cuotas externas.

### 4.3. Pipeline de *Streaming* por frases + Cancelación de Eco Acústico (WebRTC AEC)
- **Situación actual:** El micrófono se apaga mientras Alice procesa y reproduce audio; además, se espera el texto completo de Gemma antes de enviarlo al sintetizador.
- **Qué aportaría:**
  - Consumir la salida de `llama.cpp` mediante **SSE (*Server-Sent Events*)** para enviar la primera oración al TTS apenas se genera, reduciendo drásticamente el tiempo percibido de respuesta.
  - Incorporar **AEC (*Acoustic Echo Cancellation*, ej. `webrtc-audio-processing`)** para permitir **interrupción hablando (*barge-in*)** sin que el micrófono vuelva a capturar la propia voz de Alice.

### 4.4. Soporte opcional para MCP (*Model Context Protocol*, ej. SDK `rmcp` en Rust)
- **Situación actual:** Cada integración nueva (Spotify, YouTube, carpetas locales) requiere escribir y mantener su propio adaptador ad hoc dentro del backend Rust.
- **Qué aportaría a mediano plazo:** Adoptar **MCP** como protocolo estándar de adaptadores locales permitiría conectar herramientas futuras (calendario, notas, sistema de archivos acotado, navegador) de forma uniforme, **siempre interponiendo el Gateway de Permisos R2 y la Auditoría R3** antes de autorizar cualquier ejecución.

