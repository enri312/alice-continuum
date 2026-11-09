# Preparación de Ubuntu para continuar R9

Fecha: 2026-11-06. Equipo del propietario: Ubuntu 26.04.1, kernel
7.0.0-43, sesión Wayland, Intel de 12.ª generación y RTX 3050 Laptop de 4 GiB.
El checkout sigue en la partición NTFS compartida con Windows.

## Instalación realizada

- Node 26.13.0 y npm 11.20.0 ya estaban instalados.
- Rust 1.99.1, Cargo, rustfmt y Clippy instalados mediante rustup oficial en
  la cuenta del propietario. El lanzador carga el entorno si la sesión del
  escritorio aún no conoce Cargo.
- Instaladas las dependencias de desarrollo de Tauri/WebKitGTK 4.1, compiladores,
  FFmpeg, Python venv, GStreamer good/bad, CMake, Ninja, Xvfb y DBus X11.
- Instaladas las dependencias Vulkan, glslc y SPIR-V. El controlador NVIDIA
  595.99.02 ya funcionaba: su comprobación inicial falló dentro del aislamiento
  de herramientas, no por falta de controlador. No se cambió el controlador.
- Añadidas las cuatro variantes Linux de Node verificando la integridad del
  lockfile. Se conservaron las variantes Windows y ambos archivos de paquetes.
  `scripts/setup/install-linux-node-bindings.py` permite repetir este paso.
- Python documental Linux separado en `local/venv-linux/`, con PyMuPDF 1.26.4.
  Windows conserva `local/venv/`.
- llama.cpp b10809, commit `5266f24da75dc449bd56cbed7addb9c8e4a6a73e`, compilado
  para Linux con Vulkan y bibliotecas internas estáticas. Instalado en
  `local/inference/runtimes/llama/bin/llama-server`.
- whisper.cpp v1.9.2, commit `306c88f4d1286aec1bf96e544632897886af5501`,
  compilado para CPU e instalado en
  `local/inference/runtimes/whisper/bin/whisper-cli`.
- Reutilizados Gemma E2B Q4_K_M, su proyector y Whisper base desde la partición
  Windows de datos, montada en lectura. Se copiaron a `local/inference/models/`:
  el uso cotidiano no depende de mantener montada esa partición. Whisper
  conserva el SHA-256 fijado en el instalador Windows.

## Compatibilidad entre sistemas

El lanzador Linux usa `.cargo-target/linux/` y admite una configuración local
`local/ubuntu.env`; el perfil de esta notebook configura 24 capas GPU. Los
ejecutables, rutas D:, entorno Python y lanzador Windows se conservan.
El chequeo de arranque respeta `CARGO_TARGET_DIR`; el workflow Ubuntu adopta
el mismo destino y el entorno Python Linux.

Este checkout conserva el mismo `data/` al cambiar de sistema. No hay dos
instancias simultáneas ni sincronización de almacenes; hay que cerrar Alice
antes de cambiar de sistema. El mismo puerto 5173 sigue reservado al lanzador.

## Corrección descubierta durante la instalación

Gemma no podía arrancar sin Ollama, porque cualquier fallo al consultar su
puerto se interpretaba como estado desconocido. No se instaló un segundo motor
para satisfacer esa consulta. Ahora sólo un error de conexión rechazada indica
que no hay servicio escuchando. Tiempo agotado, permisos insuficientes, HTTP
fallido, JSON inválido y un modelo residente continúan bloqueando el inicio.

Tres regresiones comprueban la clasificación de errores, la ausencia real del
servicio en loopback y respuestas HTTP reales de un servicio vacío, ocupado o
inválido. La prueba de ciclo real verifica el bloqueo del slot compartido sin
exigir una instalación Ollama al finalizar. El cambio se aplica a ambas
plataformas; Windows no se volvió a ejecutar desde Ubuntu.

## Validación local

- **608 pruebas frontend aprobadas**, dos sondas opcionales omitidas.
- **337 pruebas Rust aprobadas**, 28 sondas opcionales omitidas.
- **Cinco pruebas Python aprobadas** y PyMuPDF real disponible.
- TypeScript/Vite y compilación nativa aprobados. Persiste el aviso de paquetes
  JavaScript superiores a 500 kB.
- Formato Rust, Clippy con `-D warnings` y sintaxis del lanzador aprobados.
- Arranque nativo con Xvfb y datos temporales aprobado: proceso vivo y evento
  `PROCESS_STARTED` comprobado.
- WebKit real declara contexto seguro, API de micrófono, WebM/Opus, AudioContext,
  AudioWorklet y WebAssembly disponibles. Esta sonda no solicita permisos ni
  captura micrófono/cámara; se incorpora al workflow para futuras ejecuciones.
- Whisper transcribió la fixture sintética española: «Hola, Alice. Quiero
  mejorar tu forma de conversar.» También pasó el recorrido WebM/Opus → FFmpeg
  por tuberías → Whisper, sin grabación del propietario. FFmpeg emitió un aviso
  de cabecera Opus en esa conversión sintética; terminó con código cero y la
  transcripción correcta. No se confunde con aceptación acústica real.
- Vulkan enumera Intel y RTX 3050. El ciclo nativo real de Gemma con el perfil
  de 24 capas pasó inicio, reutilización del hijo propio, respuesta `LISTO`,
  bloqueo de conflictos y parada. La última ejecución duró 4,87 segundos en
  conjunto; no es una medición de latencia de conversación.
- Los **45 archivos de datos personales** conservaron su SHA-256 durante la
  instalación y estas pruebas. Las pruebas utilizaron datos aislados.

Después se abrió Alice mediante `Iniciar Alice Continuum.sh` en el escritorio
real: Vite inició en 127.0.0.1:5173 y Cargo ejecutó el binario Linux. Sólo se
añadió `PROCESS_STARTED` a la auditoría R3; su prefijo anterior y los demás
archivos de datos permanecieron intactos. No se activaron dispositivos desde
las herramientas de preparación.

Los intentos de ejecutar pruebas de puertos dentro del aislamiento devolvieron
`EPERM`; las verificaciones finales se ejecutaron autorizadas fuera de ese
aislamiento. No se modificaron los controles de la aplicación para sortearlo.
La configuración CI se actualizó, pero no se lanzó una ejecución remota nueva.

## Fish recuperado de Windows y aceptación pendiente

La primera aceptación del propietario detectó un permiso WebKitGTK sin conectar.
Se corrigió y comprobó posteriormente en el
[informe del micrófono](UBUNTU_MICROPHONE_REPORT_2026-11-06.md). La sonda inicial
de APIs no bastaba para verificar la captura nativa.

Al comenzar, Ubuntu no tenía `FISH_API_KEY` ni `ALICE_FISH_REFERENCE_ID`.
Se añadió `scripts/setup/configure-fish-ubuntu.py`: dos cuadros locales con
entrada oculta guardan ambos valores en
`~/.config/alice-continuum/fish.env`, permisos `0600`, fuera del checkout
compartido. Cancelar conserva la configuración anterior. El lanzador Linux
carga este archivo; Windows conserva su configuración independiente.

Después se localizaron ambas variables en `HKEY_CURRENT_USER\Environment` del
perfil Windows, leyendo `NTUSER.DAT` desde la partición Acer montada en modo de
sólo lectura. El script histórico `create-session-fixtures.mjs` confirma que
usaba las variables de usuario Windows como respaldo. Se importaron los mismos
valores a `fish.env`, sin mostrarlos, escribirlos en el repositorio ni modificar
el registro Windows. El formulario manual dejó de ser necesario.

Alice se reinició y se comprobó que su proceso recibió ambas variables. Fish
respondió **HTTP 200**, `audio/mpeg`, a una frase sintética de prueba con el
modelo existente `s2.1-pro-free`: 38.869 bytes, petición de 3,57 segundos y MP3
válido de 2,43 segundos según FFprobe. Esto verifica credenciales, referencia y
síntesis en Ubuntu; no acredita reproducción por altavoces ni conversación oral
completa. Evidencia sin credenciales: `fish-verification.json` y la muestra
sintética privada dentro del directorio de evidencias.

R9 continúa pendiente de cinco turnos con Carlos, referentes, pausa/reanudación,
apagado, música real y latencia. La escucha simultánea con interrupción sigue
pendiente. Cámara requiere aceptación real; escritorio, Spotify, YouTube y
acciones Windows siguen necesitando adaptadores Linux, no paquetes adicionales.
El avatar continúa pospuesto.

Evidencia privada: `local/artifacts/ubuntu-r9-2026-11-06/` y el informe
`local/artifacts/gemma-evaluation/native-runtime-smoke.json`.

Fuentes de instalación: [Tauri](https://v2.tauri.app/start/prerequisites/),
[rustup](https://rust-lang.github.io/rustup/installation/index.html),
[llama.cpp b10809](https://github.com/ggml-org/llama.cpp/tree/b10809),
[whisper.cpp v1.9.2](https://github.com/ggml-org/whisper.cpp/tree/v1.9.2).
