# Nyxia

[![Rust 1.99.1](https://img.shields.io/badge/Rust-1.99.1-DEA584?logo=rust&logoColor=black)](rust-toolchain.toml)
[![TypeScript 7.0.2](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript&logoColor=white)](package-lock.json)
[![Dioxus 0.7.10](https://img.shields.io/badge/Dioxus-0.7.10-25A7D7?logo=rust&logoColor=white)](Frontend/crates/dioxus-ui/Cargo.toml)
[![Tauri 2.11.5](https://img.shields.io/badge/Tauri-2.11.5-FFC131?logo=tauri&logoColor=black)](Backend/src-tauri/Cargo.lock)
[![Node.js 26.13.0](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![npm 11.20.0](https://img.shields.io/badge/npm-11.20.0-CB3837?logo=npm&logoColor=white)](package.json)
[![Vite 8.3.5](https://img.shields.io/badge/Vite-8.3.5-646CFF?logo=vite&logoColor=white)](package-lock.json)
[![Vitest 4.1.12](https://img.shields.io/badge/Vitest-4.1.12-6E9F18?logo=vitest&logoColor=white)](package-lock.json)

**Nyxia (Ník-sia) es una asistente personal de escritorio.** Podés conversar con ella, revisar qué recuerda y pedirle acciones autorizadas, como reproducir una playlist. El Dashboard muestra el estado del motor, los recuerdos y los recursos del equipo.

Nyxia es el nombre que adopta el proyecto Alice Continuum. La instalación
sigue usando el repositorio `alice-continuum` y su almacenamiento existente.

[Manual de uso](docs/MANUAL_DE_USO.md) · [Guías por tarea](docs/README.md) · [Roadmap](Roadmap.md)

## Instalar y arrancar

**Windows.** Para ejecutar el proyecto desde el código fuente necesitás Node.js y npm en las versiones indicadas arriba, Rust mediante rustup, las herramientas de compilación de C++ de Visual Studio y WebView2. Desde PowerShell, en la carpeta del proyecto, ejecutá estos comandos.

```powershell
npm ci
& '.\Iniciar Nyxia.cmd' --check
& '.\Iniciar Nyxia.cmd'
```

El primer arranque compila la aplicación. Para las siguientes sesiones podés abrir el lanzador con doble clic. Si el arranque se detiene, la guía explica cómo comprobar dependencias, rutas y el puerto 5173. [Arranque local](docs/runbooks/01-arranque-local.md).

**Ubuntu.** Instalá las dependencias del sistema y del proyecto siguiendo la guía. Probá el entorno con `bash 'Iniciar Nyxia.sh' --check` y abrí Nyxia con `bash 'Iniciar Nyxia.sh'`. La validación en macOS sigue pendiente. [Instalación en Ubuntu](docs/runbooks/04-ubuntu.md).

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
renderiza las pantallas migradas, entre ellas Conversación, Auditoría y
diagnóstico, Configuración, Planificador, Volumen cognitivo, Memoria, Rostro,
Cuerpo y Avatar. Rostro consulta el diagnóstico local y R2 con la cámara cerrada.
Cuerpo conserva el esquema de referencia. Avatar integra el visor Three.js para
el modelo VRM local y carga el motor 3D al necesitarlo.
Gobernanza renderiza Capacidades y permisos, Procedimientos y Taller de
habilidades en Dioxus. Tauri sigue verificando las confirmaciones, las huellas
y el alcance de cada operación.
Configuración comparte el proveedor
y el historial con Conversación. El registro R7 del Planificador revisa los
recordatorios con Tauri antes de programarlos o cancelarlos. Rust mantiene
las sesiones de Actividad, Conversación, Memoria,
Aprendizaje y Observación de ventana. Memoria monta navegación, registros,
edición versionada, perfil, aprendizaje, sesión, capas, respaldo, Revisión y
ciclo y Consolidación en Dioxus. Tauri verifica las huellas, el plazo de
retención y los recibos antes de aceptar cambios.
Conversación comparte el borrador, el historial visible, el proveedor, el modelo
y los ajustes de comportamiento. La sesión registra los recuerdos revisados
y el modo de contexto aplicado a la respuesta. El adaptador de Conversación
gestiona la comunicación con Tauri y los recursos de voz y visión. Memoria
proyecta los recuerdos guardados y el estado de RAM usando los datos de Tauri.
Aprendizaje comparte entre Memoria y
Volumen cognitivo la última lectura válida del autoestudio y de los recuerdos
aprendidos al conversar. Volumen presenta el inspector, las señales y los
cambios observados desde la apertura en Dioxus. La escena conserva su dibujo
Canvas 2D y las asociaciones confirmadas por Tauri. Memoria también carga el
perfil confirmado por Tauri.
Conversación recupera lecciones activas con el último ejercicio aprobado y
Volumen permite inspeccionar también las pendientes de repaso o retiradas.
La observación de ventana solo presenta metadatos mientras R2 confirma el
permiso de sesión. El vencimiento o la revocación los retira de la interfaz.
Si un mensaje incluye esos metadatos, el permiso se comprueba otra vez antes del envío.
La entrada `Frontend/src/main.ts` monta la raíz Dioxus de
`Frontend/crates/dioxus-ui/src/app.rs`. Esa raíz controla la navegación y el
filtro de Auditoría. Los adaptadores TypeScript conectan las pantallas a
Tauri y al WebView. Si WebAssembly falla, la interfaz permite reintentar y
conserva los respaldos interactivos de Flujo, Estado y controles y relaciones
entre recuerdos. El arranque y las recuperaciones funcionan sin React.
`Backend/` contiene el núcleo nativo de Tauri y sus adaptadores.
La consulta del Dashboard reúne en un módulo el comando Tauri, el muestreo y
las lecturas por plataforma. [Módulo de estado del equipo](Backend/src-tauri/src/system_overview/).
Los iconos funcionales son SVG locales. Se regeneran con `npm run icons:generate`.
Las vistas React y sus pruebas históricas se conservan en `Frontend/src/Legacy/`.
React sólo se declara como dependencia de desarrollo para ese archivo histórico.
[Mapa del proyecto](docs/architecture/MAPA_CARPETAS_RAIZ.md) · [Estado de Dioxus](docs/architecture/DIOXUS_MIGRATION_STATUS.md).

```sh
npm test
npm run build
```

La verificación posterior a la migración incluye el arranque en Tauri para
Windows con datos aislados, las 15 pantallas en Edge y la recuperación con
WebAssembly bloqueado. La aceptación con voz, Spotify y el proveedor de uso
cotidiano sigue en R9. [Próximo paso](Roadmap.md#próximo-paso-autorizado).
Si Nyxia transcribe mal una orden, «Corregir en el borrador» recupera el texto
desde el diagnóstico de voz para editarlo y revisarlo antes de enviarlo.
Para la escucha automática, decí «Nyxia, pausa Spotify» o «Nyxia, reproduce
Spotify». El nombre se pronuncia «Ník-sia».
En Windows, **Audio de entrada** permite bajar el volumen de Spotify durante
la escucha y recuperarlo al cerrar el micrófono o terminar Nyxia normalmente.
En ese panel, **Probar señal directa para transcribir** permite comparar la
captura previa a RNNoise. La detección de voz conserva su filtro local.
La comparación de Whisper y Parakeet en este equipo está en
[las pruebas de voz de R9](Roadmap.md#próximo-paso-autorizado).
Para probar Parakeet al arrancar Nyxia, definí `ALICE_PARAKEET_HOME` con la
ruta absoluta a una instalación local que tenga `venv/` y `model/`.
El entorno usa `sherpa-onnx` y `model/` contiene `encoder.int8.onnx`,
`decoder.int8.onnx`, `joiner.int8.onnx` y `tokens.txt` de la edición INT8.
Nyxia usa la selección habitual de Whisper o Gemma al arrancar sin esa variable.
Tras validar R9, el Roadmap plantea evaluar **Nod**, el agente personal de
n8n Labs, como posible ejecutor externo de tareas acotadas.
[Alcance de la evaluación](Roadmap.md#evaluar-nod-de-n8n-labs).

Después de los cinco turnos de R9 y de comprobar el autoestudio con Obsidian,
Python asumirá otra parte del formateo manual por lotes de las notas. Node.js seguirá
a cargo de Vite, npm y el arranque de desarrollo. [Reparto de responsabilidades](docs/architecture/REPARTO_NODE_PYTHON.md#próximo-incremento).

**Versión del producto** 0.1.0 · **Documento maestro** 0.65 · **Rama de trabajo** `master`. [Especificación ilustrada](docs/especificacion_alice_continuum.html).
