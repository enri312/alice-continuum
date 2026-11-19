# Alice Continuum

[![Rust 1.99.1](https://img.shields.io/badge/Rust-1.99.1-DEA584?logo=rust&logoColor=black)](rust-toolchain.toml)
[![TypeScript 7.0.2](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript&logoColor=white)](package-lock.json)
[![React 19.3.1](https://img.shields.io/badge/React-19.3.1-149ECA?logo=react&logoColor=white)](package-lock.json)
[![Dioxus 0.7.0](https://img.shields.io/badge/Dioxus-0.7.0-25A7D7?logo=rust&logoColor=white)](Frontend/crates/dioxus-ui/Cargo.toml)
[![Tauri 2.11.5](https://img.shields.io/badge/Tauri-2.11.5-FFC131?logo=tauri&logoColor=black)](Backend/src-tauri/Cargo.lock)
[![Node.js 26.13.0](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![npm 11.20.0](https://img.shields.io/badge/npm-11.20.0-CB3837?logo=npm&logoColor=white)](package.json)
[![Vite 8.3.5](https://img.shields.io/badge/Vite-8.3.5-646CFF?logo=vite&logoColor=white)](package-lock.json)
[![Vitest 4.1.12](https://img.shields.io/badge/Vitest-4.1.12-6E9F18?logo=vitest&logoColor=white)](package-lock.json)

**Alice Continuum es una asistente personal de escritorio.** Podés conversar con Alice, revisar qué recuerda y pedirle acciones autorizadas, como reproducir una playlist. El Dashboard muestra el estado del motor, los recuerdos y los recursos del equipo.

[Manual de uso](docs/MANUAL_DE_USO.md) · [Guías por tarea](docs/README.md) · [Roadmap](Roadmap.md)

## Instalar y arrancar

**Windows.** Para ejecutar el proyecto desde el código fuente necesitás Node.js y npm en las versiones indicadas arriba, Rust mediante rustup, las herramientas de compilación de C++ de Visual Studio y WebView2. Desde PowerShell, en la carpeta del proyecto, ejecutá estos comandos.

```powershell
npm ci
& '.\Iniciar Alice Continuum.cmd' --check
& '.\Iniciar Alice Continuum.cmd'
```

El primer arranque compila la aplicación. Para las siguientes sesiones podés abrir el lanzador con doble clic. Si el arranque se detiene, la guía explica cómo comprobar dependencias, rutas y el puerto 5173. [Arranque local](docs/runbooks/01-arranque-local.md).

**Ubuntu.** Instalá las dependencias del sistema y del proyecto siguiendo la guía. Probá el entorno con `bash 'Iniciar Alice Continuum.sh' --check` y abrí Alice con `bash 'Iniciar Alice Continuum.sh'`. La validación en macOS sigue pendiente. [Instalación en Ubuntu](docs/runbooks/04-ubuntu.md).

**Primer mensaje.** Abrí **Conversación** y comprobá que el proveedor seleccionado esté listo. Los motores y modelos locales se instalan por separado. Para usar un proveedor remoto, configurá sus credenciales en tu equipo y revisá el mensaje y el contexto antes de enviarlos. [Configurar conversación y voz](docs/runbooks/03-conversacion-y-voz.md).

## Qué funciona actualmente

| Área | Qué podés hacer |
|---|---|
| Conversación | Escribir, dictar y hablar por turnos. Whisper transcribe localmente cuando está instalado. La salida de voz Fish requiere configuración y conexión. |
| Memoria y aprendizaje | Revisar recuerdos y sus fuentes, retirar información del contexto o consultar la bóveda de Obsidian. El autoestudio ofrece matemáticas, historia bíblica católica, psicología e inteligencia emocional, empatía, solidaridad, humildad, pensamiento crítico y ética. |
| Núcleo cognitivo | Explorar los recuerdos y sus asociaciones en **Volumen cognitivo**. **Flujo cognitivo** muestra qué rutas tienen evidencia reciente. |
| Acciones y permisos | Usar los controles de Spotify disponibles en tu sistema, revisar las capacidades, autorizar o revocar permisos y consultar su historial. |
| Presencia física | Inspeccionar el avatar local y los controles disponibles en el equipo. El desarrollo de voz y acciones está en la fase R9. |

El alcance por plataforma y las pruebas pendientes se mantienen en el [roadmap](Roadmap.md).

## Datos, respaldo y privacidad

`data/` guarda la memoria, la auditoría y la bóveda privada. `runtime/` reúne los recursos y la configuración de la instalación. Clonar el repositorio recupera el código y las guías. Para recuperar también tus recuerdos, usá los respaldos del lanzador. [Datos](data/README.md) · [Recursos locales](runtime/README.md) · [Respaldar y restaurar](docs/runbooks/07-respaldo-integral.md).

## Desarrollo y verificación

La interfaz vive en `Frontend/`. Dioxus controla la navegación general y
renderiza las pantallas migradas, entre ellas Conversación y Auditoría y
diagnóstico. Rust mantiene la sesión de Actividad y alimenta sus contadores.
React mantiene otros estados compartidos y monta las pantallas en la
ruta activa. `Backend/` contiene el núcleo nativo de Tauri y sus adaptadores.
Los iconos funcionales son SVG locales. Se regeneran con `npm run icons:generate`.
Las vistas React desactivadas se conservan en `Frontend/src/Legacy/`.
[Mapa del proyecto](docs/architecture/MAPA_CARPETAS_RAIZ.md) · [Estado de Dioxus](docs/architecture/DIOXUS_MIGRATION_STATUS.md).

```sh
npm test
npm run build
```

**Versión del producto** 0.1.0 · **Documento maestro** 0.65 · **Rama de trabajo** `master`. [Especificación ilustrada](docs/especificacion_alice_continuum.html).
