# Estructura del proyecto

Reorganización: 2026-09-14. Identidad actualizada: 2026-09-16. Esta guía describe la reorganización de archivos, no un
cambio de funcionalidades ni de contratos de Alice.

## Organización actual

```text
Alice Continuum/
├── src/
│   ├── App.tsx                    composición y navegación de la aplicación
│   ├── main.tsx                   punto de entrada de React
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
│   │   └── voice/                 contratos de entrada y salida de voz
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
│   └── testing/                   sondas visuales y evaluaciones opcionales
├── docs/                          manual, arquitectura, ADR, planes e informes
├── Assets/                        avatar, animaciones y modelos locales
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
| `Assets/` | Rutas de modelos y animaciones declaradas en el backend y el alcance de recursos de Tauri. |
| `data/` | Datos privados; el lanzador y el backend dependen de esta ruta configurable. |
| `adapters/`, `.venv-adapters/` | Cuarentena local y entorno Python; no equivalen a `scripts/adapters/`. |
| `artifacts/`, `scratch/`, `.openchamber/` | Evidencia local y trabajo privado, excluidos de Git. |
| `node_modules/`, `dist/`, `.cargo-target/` | Dependencias o resultados regenerables, excluidos de Git. |

No se movieron ni borraron datos, modelos, adaptadores privados o cachés. Estas
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
