# Evaluación de backend y perfiles para hardware económico (GTX 1050 / sin GPU)

Fecha del análisis: 2026-11-06 · Rama `master`  
Documento relacionado: [`evaluacion_frameworks_ia_asistente.md`](evaluacion_frameworks_ia_asistente.md)  
Fuentes inspeccionadas: [`src-tauri/src/local_inference.rs`](../Backend/src-tauri/src/local_inference.rs), [`src-tauri/src/runtime_paths.rs`](../Backend/src-tauri/src/runtime_paths.rs), [`package.json`](../package.json) y [`docs/research/LOCAL_MODEL_INVENTORY_2026-08-20.md`](research/LOCAL_MODEL_INVENTORY_2026-08-20.md).

---

## 1. Veredicto: ¿Backend en Rust o en Node.js para máquinas económicas?

Para equipos económicos —con **GPUs pequeñas como una GTX 1050 (2 GB o 4 GB VRAM)** o **sin GPU dedicada (solo CPU + gráficos integrados y 8–16 GB de RAM)**— **conviene mantener el backend en Rust con Tauri 2** y **no migrar el backend a Node.js**.

### Por qué Rust + Tauri marca diferencia en hardware ajustado

En una PC sin GPU dedicada (o cuando una GPU de 2 GB desborda capas hacia la memoria principal), **el modelo LLM, Whisper y el contexto viven en la RAM del sistema y compiten por el ancho de banda de la CPU**. Cada megabyte ahorrado por la aplicación queda disponible para la inferencia:

- **Rust + Tauri 2 (arquitectura actual de Alice):**
  - El backend compilado en modo `release` consume apenas **~15–30 MB de RAM**, sin *Garbage Collector* ni pausas de ejecución.
  - Aunque en desarrollo se utiliza Node.js para servir Vite (`Iniciar Alice Continuum.cmd`), **en producción (`tauri build`) Node.js desaparece por completo**: la interfaz se compila a archivos estáticos (`dist/`) y solo se ejecuta el binario nativo en Rust junto con el WebView2 del sistema operativo.
- **Backend en Node.js (Electron o proceso *sidecar* en Node):**
  - Electron + Node levanta un Chromium propio más un runtime V8 (~350–700 MB de RAM base solo por abrir la aplicación).
  - En equipos de 8 GB de RAM, ese consumo extra fuerza paginación en disco (*swap*) durante la inferencia, degradando la respuesta de unos pocos segundos a decenas de segundos.
  - **Cuándo tendría sentido Node.js:** únicamente si la asistente fuera un cliente 100 % *cloud* (cero modelos locales) y se buscara reutilizar código con un servidor web.

---

## 2. Ajustes necesarios en el código actual de Alice para correr en PCs chicas

Aunque Rust + Tauri es la base ideal, cerca del 90 % del consumo proviene de cómo se invocan los motores de IA (`llama.cpp`, `whisper.cpp` y renderizado 3D). En la implementación actual existen **cuatro parámetros fijos** que chocarían en una GTX 1050 o en un equipo sin GPU:

1. **`ALICE_GPU_LAYERS = "24"` predeterminado en Windows** ([`runtime_paths.rs`](../Backend/src-tauri/src/runtime_paths.rs)):
   - En una PC sin GPU dedicada o con una GTX 1050 de 2 GB VRAM, solicitar 24 capas en GPU más un contexto de `4096` provocará un fallo por falta de memoria (*Out of Memory*) al iniciar.
2. **`--mmproj-offload` siempre activo** ([`local_inference.rs`](../Backend/src-tauri/src/local_inference.rs)):
   - Cargar permanentemente el proyector multimodal `mmproj-F16.gguf` en VRAM reserva cientos de megabytes incluso cuando el usuario solo conversa por texto o voz sin cámara. Además, la arquitectura Pascal (GTX 1050) no acelera `FP16` como una serie RTX.
3. **`-t 8` (8 hilos fijos de CPU)** ([`local_inference.rs`](../Backend/src-tauri/src/local_inference.rs)):
   - Muchos procesadores económicos tienen 4 núcleos físicos (por ejemplo, Intel Core i3 / i5 antiguos o Ryzen 3). Forzar 8 hilos introduce contención por *HyperThreading* y reduce los tokens por segundo en `llama.cpp`. Conviene detectar y usar el número real de **núcleos físicos**.
4. **Dependencia de compilación CUDA vs. Vulkan:**
   - Un binario `llama-server` compilado exclusivamente para CUDA no iniciará en equipos con gráficos integrados Intel UHD / Iris Xe o AMD Radeon.

---

## 3. Arquitectura y perfiles de hardware recomendados

La estrategia recomendada es conservar **Rust + Tauri 2** e incorporar en Rust un **selector de perfil de hardware** al iniciar el motor local:

| Equipo objetivo | Backend de `llama.cpp` | Modelo local recomendado | Parámetros clave de arranque | Pipeline de voz sugerido |
|---|---|---|---|---|
| **GTX 1050 (4 GB VRAM)** | **Vulkan** o CUDA | `1.5B` a `3B` en `Q4_K_M` (ej. Qwen 2.5/3 3B, Llama 3.2 3B o Gemma E2B **sin** `mmproj` permanente) | `-ngl 20..99`, `-c 2048` o `4096`; cargar `--mmproj` **solo bajo demanda** al abrir Visión | Whisper `tiny`/`base` cuantizado + **Piper TTS** local |
| **GTX 1050 (2 GB VRAM)** | **Vulkan** o CUDA (híbrido GPU+CPU) | `1.5B` a `2B` en `Q4_K_M` | `-ngl 8..14` (offload parcial según VRAM libre), `-c 2048`, sin `mmproj` en VRAM | Whisper `tiny` (`q5_1`) + **Piper TTS** local |
| **Sin GPU (CPU + 8–16 GB RAM)** | **CPU AVX2** (o Vulkan en iGPU Radeon/Iris) | `0.8B` a `1.5B` en `Q4_K_M` / `IQ4_XS` (o modo híbrido usando proveedor *cloud* para consultas complejas) | `-ngl 0`, `-c 2048`, `-t` = núcleos físicos reales | **Piper TTS** (~50 MB RAM, <0,3 s en CPU) + Whisper `tiny` |

---

## 4. Recomendaciones prácticas de implementación

1. **Empaquetar con `tauri build` para pruebas en equipos económicos:** elimina el servidor de desarrollo de Node/Vite y deja únicamente el ejecutable nativo en Rust.
2. **Distribuir `llama-server` con backend Vulkan + CPU AVX2:** un único binario acelera tanto tarjetas NVIDIA veteranas (GTX 1050) como gráficas integradas AMD e Intel, con caída limpia a CPU pura si no hay GPU compatible.
3. **Separar modo texto/voz de modo visión:** no cargar `--mmproj` por defecto en perfiles de 2–4 GB VRAM o sin GPU; recargar o abrir sesión multimodal únicamente cuando el usuario habilite cámara o escritorio.
4. **Incorporar Piper (ONNX en CPU) como voz local ligera:** consume alrededor de 50–100 MB de RAM, no compite por la VRAM de la GPU y sintetiza respuestas en español en fracciones de segundo incluso en procesadores modestos.
5. **Pausar o desmontar el canvas WebGL/Three.js cuando no esté visible:** en equipos con 2 GB de VRAM o GPU integrada, evita que el renderizado 3D compita por memoria gráfica con `llama.cpp`.

