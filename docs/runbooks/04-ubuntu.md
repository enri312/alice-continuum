# Ubuntu: instalación desde el código fuente

Objetivo vigente: Ubuntu 26.04 LTS x86_64 con escritorio. Este procedimiento no
instala Ubuntu ni modifica particiones. El avatar sigue pospuesto.

El propietario trabaja también en Ubuntu **26.04.1** en esta computadora.
CI verifica **26.04**; las comprobaciones en el escritorio del propietario se
registran por separado. Las letras D: y E: de Windows no son rutas Linux:
identifica sus montajes antes de configurar modelos externos.
Un checkout compartido conserva el mismo `data/`; cierra Alice antes de cambiar
de sistema o copiar respaldos. También puedes usar un almacén independiente
mediante `ALICE_DATA_DIR`. No hay sincronización automática entre almacenes.

## Ubicación compartida en esta computadora

Desde el 9 de noviembre de 2026, la carpeta de trabajo es **Datos → Alice
Continuum**. En Ubuntu se monta en
`/run/media/carlos-nu-ez/Datos/Alice Continuum`; los accesos del menú y del
escritorio apuntan a esa carpeta. En Windows, abre el volumen **Datos**, entra
en **Alice Continuum** y ejecuta `Iniciar Alice Continuum.cmd`. La letra que
Windows asigne al volumen puede variar; el lanzador obtiene su propia ubicación.

La recuperación conservó Git, los cambios locales, los datos y los recursos
privados. Consulta el [informe de recuperación](../testing/PROJECT_RECOVERY_REPORT_2026-11-09.md).

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
  python3-venv python3-gi gir1.2-atspi-2.0 ffmpeg util-linux \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
git clone https://github.com/enri312/alice-continuum.git
cd alice-continuum
npm ci
python3 -m venv --copies local/venv-linux
local/venv-linux/bin/python -m pip install -r scripts/adapters/requirements.txt
bash 'Iniciar Alice Continuum.sh' --check
bash 'Iniciar Alice Continuum.sh'
```

El repositorio figura como público al 10 de noviembre de 2026; los datos y
recursos privados se recuperan por separado y no se incluyen en el clon. El lanzador
conserva datos en `data/`, acepta `ALICE_DATA_DIR` absoluta y evita otra instancia
desde el mismo checkout. `--check` valida herramientas y WebKit; no acredita que
los modelos o dispositivos estén disponibles. Sin lanzador, Tauri usa su
directorio de datos de aplicación, salvo que se defina `ALICE_DATA_DIR`.

El lanzador incluye [copias integrales versionadas](07-respaldo-integral.md)
al inicio, cada 15 minutos y al cierre normal. En Linux se puede elegir una
carpeta absoluta con `destinations.linux` en `local/backup.json` o
`ALICE_BACKUP_DIR`. El destino predeterminado es una carpeta junto al proyecto;
no supone que esté en otro disco. `--check` no escribe respaldos.

Si rustup se instaló después de iniciar la sesión del escritorio, el lanzador
carga su entorno automáticamente. Linux compila en `.cargo-target/linux/`
(o en `CARGO_TARGET_DIR` si se define); Windows conserva `.cargo-target/`.
El Python Linux vive en `local/venv-linux/`; Windows conserva `local/venv/`.
No se reutilizan entornos Python entre sistemas.

La grabación WebM/Opus de WebKit requiere **GStreamer 1.24.9 o posterior**.
Ubuntu 24.04 con sus paquetes estándar 1.24.2 compila y arranca Alice, pero no
supera la comprobación de grabación de R9. Instalar los plugins por sí solo no
resuelve esa diferencia. La validación usa Ubuntu 26.04 y conserva la exigencia
de `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')`, sin abrir dispositivos.
Fuentes: [requisito de WebKitGTK](https://webkitgtk.org/2025/03/14/webkitgtk2.48.0-released.html)
y [runner oficial de Ubuntu 26.04](https://github.com/actions/runner-images/issues/14747).

El lanzador Linux carga opcionalmente `local/ubuntu.env`, un archivo de shell
privado excluido de Git. Allí puedes definir rutas, `ALICE_GPU_LAYERS` y
`ALICE_YOUTUBE_PLAYLIST_URL` (el enlace de tu playlist).
El lanzador Windows no lee este archivo.

Para configurar Fish sin editar archivos, ejecuta desde el escritorio Ubuntu:

```bash
python3 scripts/setup/configure-fish-ubuntu.py
```

Dos cuadros locales de Zenity piden la clave API y el ID de la voz (reference_id).
Cancelar conserva la configuración anterior. Los valores no se muestran en el
chat ni en registros: se guardan en
`~/.config/alice-continuum/fish.env` con permisos `0600` (respeta
`XDG_CONFIG_HOME`). El lanzador carga ese archivo al iniciar. Reinicia Alice
después de configurarlo. Windows conserva sus propias variables de entorno.
Zenity suele estar instalado en Ubuntu Desktop; si falta, instala `zenity`.

## Abrir desde el menú y el escritorio

Para registrar el acceso directo y el icono existente en tu cuenta Ubuntu:

```bash
python3 scripts/setup/install-ubuntu-desktop.py
```

Luego busca **Alice Continuum** en el menú de aplicaciones o abre su acceso
directo del escritorio. Si Ubuntu pide «Permitir lanzamiento» la primera vez,
selecciónalo. El registro del lanzador gráfico se conserva en
`~/.local/state/alice-continuum/launcher.log`. La partición del proyecto debe
estar montada en la misma ruta. El acceso directo sigue usando el lanzador
Bash de desarrollo y las credenciales privadas de Ubuntu.

El nombre de aplicación GTK coincide con el archivo `.desktop`, lo que permite
a GNOME/Wayland asociar la ventana con el icono instalado. El icono se copia al
tema de usuario sin cambiar los archivos de iconos de Windows.

Linux atiende SIGINT, SIGTERM y SIGHUP para detener y recoger su propio Gemma
antes de salir o recompilar. No puede atender SIGKILL ni un corte de energía.
Si el puerto 18089 pertenece a otro proceso, Alice sigue rechazando adoptarlo
o cerrarlo automáticamente. No cierres procesos ajenos para liberar ese puerto.

## Motores y recursos privados

No reutilices los ejecutables `.exe`, el entorno Python ni los binarios nativos
de Node o Cargo de Windows en Linux. En un clon nuevo, `npm ci` instala los
binarios de la plataforma actual. En un checkout compartido deben estar presentes
ambas variantes nativas de Tauri, Rolldown, TypeScript y Lightning CSS; ejecutar
`npm ci` de nuevo puede requerir reinstalar las variantes del otro sistema.
Si `node_modules/` ya funciona en Windows, ejecuta
`python3 scripts/setup/install-linux-node-bindings.py` para añadir las cuatro
variantes Linux x64/glibc verificadas contra el lockfile sin podar las de Windows.
Utiliza motores compilados para Linux. Los GGUF sí son portables. Los activos privados y
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
| `ALICE_PYTHON_BIN` | Python del entorno documental; predeterminado `local/venv-linux/bin/python` |
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

Para compilar llama.cpp b10809 con GPU Vulkan (sin instalar CUDA):

```bash
sudo apt install cmake ninja-build libvulkan-dev glslc spirv-headers glslang-tools vulkan-tools
cmake -S local/inference/sources/llama.cpp -B local/inference/build/llama \
  -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  -DGGML_VULKAN=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
  -DLLAMA_BUILD_WEBUI=OFF
cmake --build local/inference/build/llama --target llama-server -j 4
```

Las fuentes deben proceder del tag oficial b10809. Copia el ejecutable compilado
a `local/inference/runtimes/llama/bin/llama-server`. Valida el dispositivo mediante
`--list-devices` antes de definir las capas GPU en `local/ubuntu.env`.
En esta RTX 3050 se verificó `ALICE_GPU_LAYERS=99` con el proyector también en
GPU; no se cambia el valor de Windows ni se prescribe para otras computadoras.
Whisper v1.9.2 se compila para CPU; no comparte la GPU del diálogo.

## Música por voz

Spotify necesita la aplicación nativa instalada, una sesión iniciada y canciones
en **Tus me gusta**. El instalador del acceso directo añade
`--force-renderer-accessibility` al lanzador Snap de Spotify de esta cuenta;
respeta los lanzadores personalizados existentes. Si Spotify ya estaba abierto
sin esa opción, ciérralo normalmente y vuelve a abrirlo. Alice inicia Spotify
con esa opción cuando todavía no está en ejecución. No modifica la modalidad
Free, el orden que Spotify permita ni los anuncios.

YouTube utiliza Google Chrome con un perfil propio en
`~/.local/share/alice-continuum/youtube-profile`. No reutiliza ni reinicia tu
perfil habitual. Configura el enlace completo en `local/ubuntu.env`:

```bash
export ALICE_YOUTUBE_PLAYLIST_URL='https://www.youtube.com/playlist?list=ID_DE_TU_PLAYLIST'
```

Si la lista es privada, inicia sesión tú mismo en esa ventana de Chrome con la
cuenta que tiene acceso. Una sesión iniciada en el navegador habitual no se
comparte con este perfil. No se copian cookies, contraseñas ni tokens.

Con «Iniciar escucha de Alice» activo, puedes decir:

- «Alice, abre Spotify».
- «Alice, reproduce Tus me gusta en Spotify».
- «Alice, pausa Spotify» / «Alice, continúa Spotify».
- «Alice, reproduce mi playlist en YouTube».
- «Alice, pausa YouTube» / «Alice, continúa YouTube».

Por preferencia del propietario, YouTube sólo reproduce la lista configurada.
Las solicitudes de otros títulos o listas se rechazan antes de abrir búsquedas.
Se exige verificar el panel de esa playlist, la repetición de **toda** la lista
y el orden secuencial; se desactiva la reproducción automática externa cuando
su control está presente. Una URL que contenga `list=` no demuestra que YouTube
haya cargado la lista. Si aparece «La playlist no existe», inicia sesión o
corrige el enlace; Alice no sustituye la lista por recomendaciones.

Los recibos se basan en el estado real de MPRIS/AT-SPI. Un error no equivale a
reproducción confirmada. La lista privada y su vuelta al primer video se
verificaron con esa sesión iniciada. Estos adaptadores son de Ubuntu;
al volver a Windows habrá que comprobar también esta preferencia allí.

Ver [mediciones y aceptación de música](../testing/UBUNTU_LATENCY_MEDIA_REPORT_2026-11-06.md).

## Alcance y comprobación

Linux conecta el permiso de micrófono WebKitGTK con la sesión iniciada mediante
«Iniciar escucha de Alice». Una captura manual o de cámara muestra un diálogo
nativo «Alice · Permiso de captura»; pulsa Permitir para esa captura. Cancelar no
abre dispositivos. Si se rechaza el micrófono, Alice muestra el motivo en español.
Ver [corrección y prueba reproducible](../testing/UBUNTU_MICROPHONE_REPORT_2026-11-06.md).

Si Alice se queda en espera sin llegar a transcribir, revisa primero la entrada
real de audio. En esta Nitro, Ubuntu exponía **Stereo Microphone** (entrada
analógica con señal casi nula) y **Digital Microphone** (micrófono integrado con
señal). Se seleccionó Digital Microphone como predeterminado de Ubuntu. Tras
cambiarlo, cierra y vuelve a abrir Alice: WebKit puede conservar el dispositivo
anterior aunque se reinicie sólo la sesión de escucha. También puedes elegir
el dispositivo en **Audio de entrada → Actualizar micrófonos**.

| Función | Ubuntu |
|---|---|
| Compilación Tauri, memoria, RAG, historial y lógica conversacional | Incluidos en la verificación Linux automatizada |
| Arranque nativo | Ensayo aislado con Xvfb/DBus, sin dispositivos ni modelos privados |
| Gemma, Whisper y lector documental | Rutas nativas configurables; requiere instalar sus motores y modelos |
| Micrófono, RNNoise, Fish y cámara en Conversación | Requieren aceptación en un escritorio Ubuntu con el hardware real y permisos WebKit |
| Captura nativa del escritorio y observación de ventana | Adaptadores Windows; aún no portados a X11/Wayland |
| Spotify | Tus me gusta, pausa y reanudación mediante la aplicación nativa; comprobado con la cuenta real |
| YouTube en Chrome | Sólo la playlist configurada, pausa, reanudación y repetición completa; comprobados los controles nativos y el regreso natural del último video al primero |
| Apertura D:/E: | Sólo Windows |
| Diagnóstico sensorial DirectShow de Identificación | Sólo Windows; no se presenta como disponible en Linux |

El workflow `.github/workflows/ubuntu.yml` instala dependencias y ejecuta pruebas
frontend, Rust y Python, Clippy, compilación y arranque aislado en Ubuntu 26.04.
Comprueba también las API WebKit de R9 y el permiso/denegación de una captura
simulada; ninguna de esas pruebas usa el micrófono físico.
Un resultado correcto allí no demuestra entrada/salida de audio, inferencia con
modelos, cámara, Wayland ni aceleración GPU. La prueba final debe hacerse en la
instalación Ubuntu elegida por el propietario.
