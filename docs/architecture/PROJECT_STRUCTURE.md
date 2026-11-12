# Estructura del proyecto

[Revisión estructural con hallazgos, 5 de noviembre de 2026](CODE_REVIEW_2026-11-05.md).
El inventario registra por separado lectura automática y revisión focal; las
pruebas aprobadas no equivalen a una auditoría manual completa de cada línea.

Actualización 2026-11-11 — [ADR-P-116](../decisions/ADR-P-116-fuentes-de-aprendizaje-observables.md):
`src/hooks/useLearningSources.ts` adapta los estados y eventos de aprendizaje.
El controlador puro `src/core/memory/learning-source.ts` serializa lecturas,
ordena mutaciones e invalida respuestas desplazadas. `App.tsx` conserva la
composición y los filtros de conversación; las vistas reciben estados y acciones.

Actualización 2026-11-10 — [ADR-P-113](../decisions/ADR-P-113-autoestudio-modular.md):
el autoestudio conserva `self_study.rs` como fachada Tauri y coordinador del ciclo.
`self_study/model.rs` contiene los contratos; `domain.rs`, validación y reglas;
`storage.rs`, persistencia y bloqueo; `prompts.rs`, el adaptador de ejercicios
Gemma. Se mantiene una aplicación Tauri parcialmente modularizada, con formatos
de memoria estables. La revisión del núcleo cognitivo precede a continuar R9.
[Comprobación y pendientes](../testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).

Protección 2026-11-10 — [ADR-P-114](../decisions/ADR-P-114-respaldo-integral.md):
`scripts/backups/` separa archivos, permisos, snapshots, supervisión de sesión y
CLI. Los lanzadores crean versiones privadas completas y permiten restaurarlas
en otra carpeta. No modifica los contratos ni formatos del núcleo Rust.

Organización 2026-11-04 — [ADR-P-109](../decisions/ADR-P-109-organizacion-local-y-ubuntu.md):
los recursos privados se agrupan en `local/`; se conservan las carpetas
convencionales de Tauri, Rust y Vite. `runtime_paths.rs` concentra rutas nativas
configurables. Las API Win32 se compilan sólo en Windows.
[Compatibilidad Ubuntu](../runbooks/04-ubuntu.md).

Incremento 2026-11-04 — [ADR-P-108](../decisions/ADR-P-108-memoria-modular-react-19-3.md):
`src-tauri/src/memory.rs` conserva 28 comandos y la auditoría como fachada de 611
líneas en ese incremento. `src-tauri/src/memory/` separa modelo, validación, consultas, registros,
primitivas de archivos, rutas, capas, ciclo de vida, evaluación, retención,
reconsolidación, consolidación, aprendizaje y pruebas. Los casos básicos reciben
rutas; las consultas no inicializan almacenes. Se mantienen firmas y formatos.
React/React DOM 19.3.1 y tipos 19.3.0 verificados.

Actualización arquitectónica 2026-11-04 —
[ADR-P-107](../decisions/ADR-P-107-contratos-conversacion-y-sondeos.md): el proyecto
es un monolito de escritorio parcialmente modularizado, con capas técnicas y
áreas funcionales. Todavía no aplica Clean Architecture estricta ni organiza
todo por Vertical Slice. Los contratos compartidos de conversación viven en
`src/core/conversation/conversation-contracts.ts`, fuera de las pantallas React.
`src/core/shared/polling.ts` serializa los sondeos de ventana y memoria de trabajo
y descarta sus resultados después de cerrar la suscripción. La memoria básica ya separa casos de uso y persistencia; quedan casos avanzados
para incrementos posteriores.

Actualización de interfaz 2026-11-03: `InputIdentificationPage.tsx` presenta ahora
Conversación y monta el diagnóstico secundario desde `InputDiagnostics.tsx` sólo
al abrirlo. Se conserva la ruta `identificacion`. El icono actual se genera desde
`scripts/icons/scenes/cognitive-conversation-channel.mjs`. Ver [ADR-P-098](../decisions/ADR-P-098-inicio-centrado-en-conversacion.md).

La sesión automática de voz se presenta en
`src/components/conversation/HandsFreeVoice.tsx`. La captura, el detector de pausa
y el ciclo viven en `src/core/voice/`; `src-tauri/src/voice_session.rs` mantiene la
sesión nativa revocable. `.node-version` y `package.json` fijan la rama Node 26
LTS. Ver [ADR-P-099](../decisions/ADR-P-099-sesion-de-voz-y-node-26.md).

Las instrucciones conversacionales legibles viven en
`src-tauri/src/prompts/conversation.txt`, incluidas en el binario mediante
`include_str!`. `src/core/voice/voice-commands.ts` reconoce la orden directa de
parada antes de inferencia conversacional. `rust-toolchain.toml` fija Rust 1.99.1.

Reorganización: 2026-09-14. Identidad actualizada: 2026-09-16. Esta guía describe la reorganización de archivos, no un
cambio de funcionalidades ni de contratos de Alice.

La memoria automática vive en `src-tauri/src/automatic_memory.rs` y su proyección
se valida en `src/core/memory/automatic-memory.ts`. `AutomaticMemoryPanel.tsx`
ofrece pausa, corrección y retirada. `src/core/cognitive/neural-geometry.ts`
define la forma ilustrativa y `NeuralVolume.tsx` dibuja los registros reales.
Ver [ADR-P-101](../decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

## Organización actual

```text
Alice Continuum/
├── src/
│   ├── App.tsx                    composición y navegación de la aplicación
│   ├── main.tsx                   punto de entrada de React
│   ├── hooks/                     coordinación React de fuentes nativas
│   ├── pages/                     pantallas, agrupadas por responsabilidad
│   │   ├── cognitive/
│   │   ├── conversation/
│   │   ├── embodiment/
│   │   ├── governance/
│   │   ├── memory/
│   │   └── shared/                marco y lectura pasiva del núcleo
│   ├── components/                paneles reutilizables y visualizaciones
│   │   ├── cognitive/
│   │   ├── documents/
│   │   ├── embodiment/
│   │   ├── governance/
│   │   ├── icons/
│   │   └── memory/
│   ├── core/                      lógica y contratos TypeScript
│   │   ├── cognitive/             estado, eventos, afecto y volumen
│   │   ├── conversation/          conversación, perfil y contexto de envío
│   │   ├── embodiment/            avatar, animación y preparación facial
│   │   ├── governance/            permisos, auditoría, habilidades y tareas
│   │   ├── memory/                ciclo de memoria, recuperación y grafo
│   │   ├── navigation/            espacios de trabajo y pruebas de iconos
│   │   ├── shared/                compatibilidad del almacenamiento
│   │   └── voice/                 entrada/salida, sesión y filtro RNNoise local
│   ├── styles/                    estilos globales y de áreas funcionales
│   └── types/                     declaraciones de recursos SVG
├── src-tauri/                     backend Rust y configuración de Tauri
├── icons/                         catálogo SVG consumido por la interfaz
├── public/                        recursos públicos de Vite
├── scripts/
│   ├── icons/
│   │   ├── generate-icons.mjs     generador del catálogo funcional
│   │   ├── scenes/                una escena por icono de equipo
│   │   ├── shared/                geometría y acabados compartidos; pruebas
│   │   └── legacy/                escena anterior conservada, no importada
│   ├── adapters/                  lector documental revisado y sus pruebas
│   ├── backups/                   copias integrales, verificación y restauración
│   ├── obsidian/                  proyección privada de memoria hacia la bóveda
│   └── testing/                   sondas visuales y evaluaciones opcionales
├── docs/                          manual, arquitectura, ADR, planes e informes
├── local/                         recursos privados y generados
│   ├── assets/                    avatar, animaciones y modelos locales
│   ├── reference-adapters/        prototipos originales en cuarentena
│   ├── drafts/                    borradores y capturas útiles
│   ├── artifacts/                 evidencias y resultados de pruebas
│   └── venv/                      Python recreado por sistema operativo
└── data/                          memoria y auditorías privadas
```

Las pruebas permanecen junto a los módulos que verifican. `src/core/` no concede
autoridad nativa: reagrupar un contrato TypeScript no mueve permisos desde Rust.
La página de capacidades conserva sus vistas de rostro y cuerpo; no se han
dividido sus funciones ni cambiado las claves de navegación existentes.

## Nombres y ubicación de las pantallas

Todas las rutas anteriores partían de `src/Page/`. Ahora parten de `src/pages/`:

| Archivo anterior | Ruta actual dentro de `src/pages/` |
|---|---|
| `Actividad.tsx` | `cognitive/ActivityPage.tsx` |
| `Identificacion.tsx` | `cognitive/InputIdentificationPage.tsx` |
| `Volumen.tsx` | `cognitive/NeuralVolumePage.tsx` |
| `Flujo.tsx` | `cognitive/EvidenceFlowPage.tsx` |
| `Estado.tsx` | `cognitive/StateControlsPage.tsx` |
| `Planificador.tsx` | `cognitive/ActionPlannerPage.tsx` |
| `Memoria.tsx` | `memory/MemoryVaultPage.tsx` |
| `Conversacion.tsx` | `conversation/ConversationPage.tsx` |
| `Avatar.tsx` | `embodiment/AvatarPage.tsx` |
| `Configuracion.tsx` | `governance/SystemSettingsPage.tsx` |
| `Habilidades.tsx` | `governance/SkillWorkshopPage.tsx` |
| `Procedimientos.tsx` | `governance/ProcedureObserverPage.tsx` |
| `Puentes.tsx` | `governance/CapabilityRegistryPage.tsx` |
| `nucleus-shared.tsx` | `shared/nucleus-shared.tsx` |

Los nombres de los archivos identifican su función técnica. Se conservaron los
símbolos exportados, las etiquetas en español, los IDs de pantalla, las clases
CSS y los formatos de almacenamiento; no hay una migración de datos.

## Convenciones

- Pantallas: `PascalCasePage.tsx`. Componentes React: `PascalCase.tsx`.
- Lógica TypeScript y herramientas JavaScript/PowerShell: `kebab-case`.
  `faceReadiness.ts` pasó a `core/embodiment/face-readiness.ts`.
- Pruebas colocadas junto al módulo: `nombre.test.ts`, `Nombre.test.tsx` o
  `nombre.test.mjs`. Las sondas de evaluación permanecen en `scripts/testing/`.
- Rust y Python conservan `snake_case`, sus convenciones de módulos y las rutas
  que el backend utiliza para cargar el lector documental.
- `src/styles/base.css` reemplaza a `src/styles.css`;
  `src/styles/industrial-theme.css` reemplaza a `src/cyrcetech-theme.css`.
  Se conserva el orden de carga de estilos. Los CSS exclusivos de un componente
  permanecen junto a él.
- Los archivos de `scripts/icons/scenes/` coinciden con el nombre del SVG que
  representan. Los controles de cámara siguen definidos por el generador.
- `scripts/icons/legacy/activity-timeline-scene.mjs` es una versión anterior que
  no usaba el generador. Se conserva como referencia, sin conectarla al catálogo.
- Los nombres y contenido de `icons/*.svg` se mantienen, incluido `app-alice.svg`.

## Revisión de la raíz: rutas que deben permanecer estables

| Elemento | Motivo para conservarlo |
|---|---|
| `README.md` | Conservado durante la reorganización; actualizado con autorización al adoptar Alice Continuum. |
| `Roadmap.md` | Enlazado desde el README y la documentación. |
| `Iniciar Alice Continuum.cmd` | Entrada de uso cotidiano; resuelve la raíz desde su ubicación. |
| `package.json`, `package-lock.json` | Manifiesto y bloqueo de dependencias; no se actualizaron versiones. |
| `index.html`, `vite.config.ts`, `tsconfig*.json` | Puntos de descubrimiento del frontend y sus herramientas. |
| `rust-toolchain.toml`, `.cargo/` | Selección de Rust y destino compartido de compilación. |
| `src-tauri/` | Backend y estructura convencional de Tauri. |
| `local/assets/` | Activos privados; rutas configurables y alcance Tauri limitado a archivos conocidos. |
| `data/` | Datos privados; el lanzador y el backend dependen de esta ruta configurable. |
| `local/reference-adapters/`, `local/venv/` | Cuarentena local y entorno Python; no equivalen a `scripts/adapters/`. |
| `local/artifacts/`, `local/drafts/` | Evidencia local y trabajo privado, excluidos de Git. |
| `node_modules/`, `dist/`, `.cargo-target/` | Dependencias o resultados regenerables, excluidos de Git. |

Se agruparon recursos privados según el mapa anterior; datos y motores conservan su ubicación. Estas
carpetas no deben fusionarse con fuentes versionadas para reducir el número de
entradas de la raíz.

El README contiene ahora el diagrama actualizado de `src/pages/`. Esta guía
mantiene el mapa de la reorganización. Los informes
históricos que describen aquella estructura siguen siendo evidencia de su fecha;
las referencias explícitas a archivos trasladados se actualizaron donde procedía,
sin cambiar los resultados que documentan.

La antigua carpeta `src/Page/` quedó vacía y el propietario la retiró manualmente.
Git no versiona directorios vacíos. La nueva identidad y las rutas preservadas
están documentadas en [CONTINUUM_IDENTITY.md](CONTINUUM_IDENTITY.md).

## Comandos y validación de la reorganización

Desde la raíz:

```powershell
npm test
npm run build
npm run icons:generate
& '.\Iniciar Alice Continuum.cmd' --check
```

La generación también puede ejecutarse mediante
`node scripts/icons/generate-icons.mjs`; la carpeta de salida se resuelve desde
el módulo y no depende del directorio de trabajo. Escribe los 21 iconos
funcionales, nunca `app-alice.svg`.

Se trasladaron o renombraron 178 archivos. La comparación contra el estado local
previo confirmó que los 200 archivos de la migración sólo recibieron los cambios
de rutas previstos (además de la normalización de finales de línea).

Validaciones realizadas:

- Antes y después: 54 archivos de pruebas aprobados y 2 sondas omitidas;
  473 pruebas aprobadas y 2 omitidas.
- Compilación TypeScript/Vite aprobada; mismo contenido CSS generado.
- Las 15 pantallas abrieron en Edge en modo web, sin errores JavaScript,
  respuestas HTTP fallidas de Vite ni errores de importación. No sustituye una
  prueba viva de los adaptadores nativos o del modelo VRM privado.
- Generación en una carpeta temporal desde otro directorio de trabajo:
  los 21 SVG resultaron idénticos por SHA-256 a los originales.
- Sintaxis de 36 herramientas JavaScript comprobada con `node --check`.
- Los tres scripts PowerShell se analizaron sin ejecutarlos y no presentaron
  errores de sintaxis.
- Comprobación del lanzador aprobada, sin iniciar Alice ni activar hardware.
- 167 archivos protegidos conservaron su SHA-256, incluidos README, iconos,
  archivos nativos revisados y datos locales.

Persiste el aviso previo de Vite sobre paquetes JavaScript superiores a 500 kB.
No se cambió la estrategia de carga en esta reorganización. Las sondas vivas de
modelos, voz, cámara o proveedores externos no se ejecutaron.

Visión conversacional (ADR-P-102): `src-tauri/src/conversation_vision.rs` mantiene
la sesión efímera, valida cámaras y captura escritorio con GDI; `cloud.rs` construye
la petición multimodal local. `src/core/conversation/vision-session.ts` controla
cámara y cancelaciones; `ConversationVision.tsx` expone controles y selector.

Aperturas delegadas: `src-tauri/src/desktop_actions.rs` contiene intención actual,
esquema de función, validación de llamadas y ejecutor de destinos cerrados.
`cloud.rs` conecta acciones, conversación y voz. R1 y R3 registran la capacidad.

Música delegada (ADR-P-104): `src-tauri/src/media_actions.rs` valida la orden y
la función Gemma; `media_windows.rs` controla Tus me gusta mediante UI Automation,
pausa/reanuda Spotify con transporte multimedia de Windows y busca/reproduce
YouTube en Chrome mediante sus controles accesibles. No se usan scripts de shell.
La gramática musical admite órdenes habladas compuestas y devuelve aclaraciones
sin inventar recibos. Pausa/reanudación de Spotify tiene respaldo mediante el
grupo de controles del reproductor si Windows no expone su sesión multimedia.
