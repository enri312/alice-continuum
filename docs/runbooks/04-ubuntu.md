# Ubuntu: instalación desde el código fuente

Objetivo inicial: Ubuntu 24.04 LTS x86_64 con escritorio. Este procedimiento no
instala Ubuntu ni modifica particiones. El avatar sigue pospuesto.

El propietario confirmó Ubuntu **26.04.1** instalado en otro disco de 2 TB de
esta computadora. Al arrancar ese sistema, clona el proyecto en su carpeta
personal. Las pruebas automatizadas realizadas corresponden a **24.04**;
la compatibilidad específica de 26.04.1 aún requiere verificar paquetes,
arranque y dispositivos en esa instalación. Las letras D: y E: de Windows no
son rutas Linux: identifica sus montajes antes de configurar modelos externos.
Utiliza un `data/` propio en Ubuntu y copia un respaldo con Alice cerrada si
quieres continuar con la memoria actual. Este incremento no sincroniza almacenes
entre las dos instalaciones.

## Preparar el sistema

Instala Node.js de la versión indicada en `.node-version`, npm según
`package.json` y Rust mediante rustup. `rust-toolchain.toml` fija la versión
verificada. Fuentes: [Node.js](https://nodejs.org/en/download),
[Rust](https://www.rust-lang.org/tools/install) y
[dependencias Linux de Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  python3-venv ffmpeg util-linux gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
git clone https://github.com/enri312/alice-continuum.git
cd alice-continuum
npm ci
python3 -m venv local/venv
local/venv/bin/python -m pip install -r scripts/adapters/requirements.txt
bash 'Iniciar Alice Continuum.sh' --check
bash 'Iniciar Alice Continuum.sh'
```

El repositorio es privado: el clon requiere autenticación propia. El lanzador
conserva datos en `data/`, acepta `ALICE_DATA_DIR` absoluta y evita otra instancia
desde el mismo checkout. `--check` valida herramientas y WebKit; no acredita que
los modelos o dispositivos estén disponibles. Sin lanzador, Tauri usa su
directorio de datos de aplicación, salvo que se defina `ALICE_DATA_DIR`.

## Motores y recursos privados

No copies los ejecutables `.exe`, el entorno Python, `node_modules`, `dist` ni el
caché Cargo de Windows. Reinstala dependencias y utiliza motores compilados para
Linux. Los GGUF sí son archivos de modelo portables. Los activos privados y
`data/` se copian sólo con Alice cerrada; conserva un respaldo del original.

La instalación de Windows conserva sus rutas evaluadas en D:. Ubuntu busca:

```text
local/inference/
  runtimes/llama/bin/llama-server
  runtimes/whisper/bin/whisper-cli
  models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf
  models/gemma4-e2b/mmproj-F16.gguf
  models/whisper/ggml-base.bin
```

Utiliza llama.cpp compatible con Gemma 4 y los parámetros del motor evaluado
(referencia Windows: b10809), y whisper.cpp v1.9.2. Consulta las instrucciones
Linux de [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
y [whisper.cpp](https://github.com/ggml-org/whisper.cpp). Sus ejecutables deben
tener permiso de ejecución. Alice no descarga ni instala modelos al iniciarse.

Puedes usar cualquier otra ubicación mediante variables **absolutas**:

| Variable | Recurso |
|---|---|
| `ALICE_INFERENCE_HOME` | Raíz de motores y modelos con la estructura anterior |
| `ALICE_LLAMA_SERVER` | Ejecutable llama-server |
| `ALICE_GEMMA_MODEL` | GGUF Gemma |
| `ALICE_GEMMA_PROJECTOR` | Proyector multimodal |
| `ALICE_WHISPER_BIN` | Ejecutable whisper-cli |
| `ALICE_WHISPER_MODEL` | Modelo Whisper |
| `ALICE_PYTHON_BIN` | Python del entorno documental; predeterminado `local/venv/bin/python` |
| `ALICE_AVATAR_PATH` | Avatar VRM; predeterminado `local/assets/Alice.vrm` |
| `ALICE_ANIMATION_DIR` | Clips privados; predeterminado `local/assets/Animations/private/mixamo` |
| `ALICE_GPU_LAYERS` | Capas GPU; Ubuntu inicia en CPU (`0`), Windows conserva `24` |

Ejemplo antes del lanzador:

```bash
export ALICE_LLAMA_SERVER="$HOME/motores/llama-server"
export ALICE_WHISPER_BIN="$HOME/motores/whisper-cli"
export ALICE_DATA_DIR="$HOME/Alice/data"
bash 'Iniciar Alice Continuum.sh'
```

Usar CUDA exige compilar/configurar un motor Linux compatible con la GPU y su
controlador. No se presupone que otra computadora tenga la RTX de esta notebook.
Fish mantiene `s2.1-pro-free`; configura `FISH_API_KEY` y
`ALICE_FISH_REFERENCE_ID` en el entorno sin guardarlos en Git.

## Alcance y comprobación

| Función | Ubuntu |
|---|---|
| Compilación Tauri, memoria, RAG, historial y lógica conversacional | Incluidos en la verificación Linux automatizada |
| Arranque nativo | Ensayo aislado con Xvfb/DBus, sin dispositivos ni modelos privados |
| Gemma, Whisper y lector documental | Rutas nativas configurables; requiere instalar sus motores y modelos |
| Micrófono, RNNoise, Fish y cámara en Conversación | Requieren aceptación en un escritorio Ubuntu con el hardware real y permisos WebKit |
| Captura nativa del escritorio y observación de ventana | Adaptadores Windows; aún no portados a X11/Wayland |
| Spotify, YouTube en Chrome y apertura D:/E: | Adaptadores Windows; no disponibles en Ubuntu en este incremento |
| Diagnóstico sensorial DirectShow de Identificación | Sólo Windows; no se presenta como disponible en Linux |

El workflow `.github/workflows/ubuntu.yml` instala dependencias y ejecuta pruebas
frontend, Rust y Python, Clippy, compilación y arranque aislado en Ubuntu 24.04.
Un resultado correcto allí no demuestra entrada/salida de audio, inferencia con
modelos, cámara, Wayland ni aceleración GPU. La prueba final debe hacerse en la
instalación Ubuntu elegida por el propietario.
