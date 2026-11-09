# Catálogo exhaustivo de archivos · Alice Continuum (`docs/catalogo-archivos/`)

Fecha de generación y verificación línea por línea: **2026-11-06**

Esta carpeta documenta **absolutamente todos los archivos del repositorio *Alice Continuum*** —desde la raíz, el frontend React/TypeScript (`src/`), el backend nativo Rust/Tauri (`src-tauri/`), los generadores de iconos (`icons/`, `scripts/icons/`), adaptadores y pilotos (`scripts/`), hasta la documentación (`docs/`), la estructura en tiempo de ejecución de `data/` y los recursos/artefactos de `local/`— señalando además **qué archivos son basura, cuáles quedaron huérfanos y qué espacio en disco se puede recuperar**.

---

## Índice de documentos de este catálogo

1. **[`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)** — **Empieza por aquí antes de limpiar:** auditoría maestra clasificada en 5 niveles de riesgo con todos los archivos basura, carpetas vacías, iconos móviles sobrantes, componentes React huérfanos, comandos Rust desconectados, scripts rotos y gigabytes recuperables en `local/` y `.cargo-target/`.
2. **[`02-raiz-configuracion-public-icons.md`](02-raiz-configuracion-public-icons.md)** — Los **46 archivos** de configuración raíz (`package.json`, `vite.config.ts`, `tsconfig*.json`, lanzadores `.cmd`/`.sh`, `Roadmap.md`), `.cargo/`, `.github/workflows/ubuntu.yml`, activos servidos en `public/` (`7`) y los `22` iconos SVG en `icons/`.
3. **[`03-backend-rust-src-tauri.md`](03-backend-rust-src-tauri.md)** — Los **123 archivos + 1 carpeta vacía** de `src-tauri/`: manifiestos Cargo/Tauri, esquemas `gen/schemas/`, los `52` iconos de `src-tauri/icons/` (separando los 2 activos de la basura móvil) y **los 62 archivos `.rs` y `.txt` de `src-tauri/src/`** explicados uno por uno (incluyendo `local_inference.rs`, `runtime_paths.rs`, `memory/*`, `voice_input.rs`, `permissions.rs`, etc.).
4. **[`04-frontend-src.md`](04-frontend-src.md)** — Los **178 archivos** de `src/`: raíz (`App.tsx`, `main.tsx`), los `26` componentes en `src/components/`, los `119` módulos y suites de dominio en `src/core/`, las `18` páginas en `src/pages/`, las `11` hojas CSS en `src/styles/` y `src/types/`.
5. **[`05-scripts-herramientas-y-pilotos.md`](05-scripts-herramientas-y-pilotos.md)** — Los **59 archivos** de `scripts/`: adaptador documental Python en producción (`scripts/adapters/`), motor y escenas SVG (`scripts/icons/`), y los `31` scripts/pilotos de `scripts/testing/` (marcando cuáles funcionan en CI y cuáles están rotos o superados).
6. **[`06-documentacion-datos-y-local.md`](06-documentacion-datos-y-local.md)** — Los **249 archivos previos** de `docs/` (`architecture/`, `assets/`, `decisions/ADR-P-001..112`, `governance/`, `operations/`, `research/`, `reviews/`, `security/`, `testing/`), el mapa arquitectónico de **`data/`** (respetando 100 % la privacidad de recuerdos y conversaciones) y el desglose completo de **`local/`** (`assets/`, `venv/`, `reference-adapters/`, `drafts/`, `artifacts/`).

---

## Mapa global del repositorio y peso real en disco

| Carpeta / Zona | Archivos | Peso en disco | Naturaleza | Documento donde se detalla |
|---|---:|---:|---|---|
| Raíz del repo + `.cargo/` + `.github/` | `17` | `0,35 MB` | Configuración maestra, lanzadores y CI | [`02-raiz-configuracion-public-icons.md`](02-raiz-configuracion-public-icons.md) |
| `public/` | `7` | `1,30 MB` | Favicon y 6 animaciones FBX Mixamo del avatar | [`02-raiz-configuracion-public-icons.md`](02-raiz-configuracion-public-icons.md) |
| `icons/` | `22` | `0,90 MB` | Sistema de iconos SVG industriales (`navigation/` + `controls/`) | [`02-raiz-configuracion-public-icons.md`](02-raiz-configuracion-public-icons.md) |
| `src-tauri/` | `123` *(+ 1 dir vacío)* | `4,40 MB` | Backend nativo Rust/Tauri 2 (62 archivos en `src-tauri/src/`) | [`03-backend-rust-src-tauri.md`](03-backend-rust-src-tauri.md) |
| `src/` | `178` | `1,46 MB` | Interfaz React 19 + TypeScript + Three.js/VRM + Web Audio/RNNoise | [`04-frontend-src.md`](04-frontend-src.md) |
| `scripts/` | `59` | `0,38 MB` | `document_reader.py`, generador de iconos y pilotos de prueba | [`05-scripts-herramientas-y-pilotos.md`](05-scripts-herramientas-y-pilotos.md) |
| `docs/` *(previo a este catálogo)* | `249` | `~2,32 MB` | Especificación HTML, manual, arquitectura, 112 ADRs, pruebas e informes | [`06-documentacion-datos-y-local.md`](06-documentacion-datos-y-local.md) |
| `data/` *(ignorado en Git salvo README)* | `45` *(+ 4 dirs vacíos)* | `1,78 MB` | Memoria durable, auditoría R3, historial, grafo, tareas y credenciales | [`06-documentacion-datos-y-local.md`](06-documentacion-datos-y-local.md) |
| `local/` *(ignorado en Git salvo READMEs)* | `2.471` | `221,27 MB` | `Alice.vrm` + `venv` Python (~98,5 MB útiles) + **~120 MB de artefactos viejos** | [`06-documentacion-datos-y-local.md`](06-documentacion-datos-y-local.md) · [`01`](01-auditoria-basura-y-huerfanos.md) |
| `dist/` *(generado)* | `13` | `7,29 MB` | Bundle compilado de Vite (`npm run build`) | [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md) |
| `node_modules/` *(generado)* | `4.117` | `158,78 MB` | Dependencias npm instaladas desde `package-lock.json` | [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md) |
| `.cargo-target/` *(generado)* | `6.963` | **`9.352,21 MB` (~9,35 GB)** | Caché compartida de compilación Rust/Cargo (`cargo clean` la vacía) | [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md) |

---

## Búsqueda rápida de ejemplos frecuentes

- **¿Qué hace `local_inference.rs`?** → Gestiona el ciclo de vida completo (`local_runtime_status`, `start_local_runtime`, `stop_local_runtime`) y las peticiones HTTP locales hacia `llama-server` (`127.0.0.1:18089`) con Gemma 4 E2B + `mmproj`, incluyendo arbitraje exclusivo de VRAM frente a Ollama (`InferenceArbiter`), cancelación inmediata por generación (`ADR-P-111`) y utilidades internas de chat, visión y audio. Ver fila **81** en [`03-backend-rust-src-tauri.md`](03-backend-rust-src-tauri.md).
- **¿Qué hace `runtime_paths.rs`?** → Centraliza todas las rutas configurables por variables de entorno (`ALICE_INFERENCE_HOME`, `ALICE_LLAMA_SERVER`, `ALICE_GEMMA_MODEL`, `ALICE_GEMMA_PROJECTOR`, `ALICE_WHISPER_BIN`, `ALICE_WHISPER_MODEL`, `ALICE_PYTHON_BIN` y `ALICE_GPU_LAYERS` —por defecto `"24"` en Windows y `"0"` en Linux—) con respaldos seguros multiplataforma. Ver fila **92** en [`03-backend-rust-src-tauri.md`](03-backend-rust-src-tauri.md).
- **¿Por qué hay dos `.cargo/config.toml`?** → **No son basura duplicada:** el de la raíz (`target-dir = ".cargo-target"`) y el de `src-tauri/.cargo/config.toml` (`target-dir = "../.cargo-target"`) apuntan a la misma carpeta física para evitar compilar Rust dos veces según desde dónde se invoque `cargo`. Ver [`02`](02-raiz-configuracion-public-icons.md) y [`03`](03-backend-rust-src-tauri.md).
- **¿Qué puedo limpiar sin miedo hoy mismo?** → Revisa la tabla **Nivel 1** de [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md).
