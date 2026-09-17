# Informe de verificación — Pantallas cognitivas e iconos técnicos

Fecha: 2026-08-12

## Cambio realizado

Las cuatro áreas que estaban bajo Núcleo se separaron en páginas React reales:

| Pantalla | Archivo | Ruta de interfaz |
|---|---|---|
| Volumen cognitivo | `src/pages/cognitive/NeuralVolumePage.tsx` | `nucleo` (alias de compatibilidad) |
| Flujo cognitivo | `src/pages/cognitive/EvidenceFlowPage.tsx` | `flujo` |
| Estado y controles | `src/pages/cognitive/StateControlsPage.tsx` | `estado` |
| Planificador de acción | `src/pages/cognitive/ActionPlannerPage.tsx` | `planificador` |

Las cuatro reutilizan el snapshot nativo R3 mediante `src/pages/shared/nucleus-shared.tsx`. Separar las pantallas no agrega capacidad cognitiva ni convierte métricas en emociones o decisiones.

## Iconos

Dieciocho SVG funcionales se generan desde cero en una familia técnica de `200 × 200`; `nav-memory.svg` y la base visual de `nav-conversation.svg` fueron aportados por el propietario, auditados como SVG autónomos y adaptados como fuentes manuales. `nav-avatar.svg` y `bridge-face.svg` se diseñaron manualmente desde cero y quedaron protegidos contra regeneración. Se revisó la colección de Cyrcetech para identificar su gramática visual real: capas de chasis, retículas, anillos discontinuos, tornillos, LEDs, plataformas isométricas, caras laterales, sombras y reflejos. Ningún recurso de `E:\proyect2026\Cyrcetech\apps\web\icons` fue importado o enlazado. La fuente reproducible de los otros 18 iconos se conserva en `scripts/icons/generate-icons.mjs`.

La segunda revisión semántica sustituyó los adornos genéricos por componentes de cada pantalla: privacidad y salida a nube en Conversación; timeline R3 en Actividad; registro pasivo y `SAFE OFF` en Puentes; tokens, fuente e intención en Identificación; manifiesto, simulación y SHA-256 en Habilidades; evidencia R3 y conversión a borrador R4 en Procedimientos; y señales verificables o bloqueadas en las cuatro vistas cognitivas. La revisión de agosto rehízo Avatar y Rostro como instrumentos claramente distintos y eliminó facciones frontales que perdían legibilidad al reducirse. Avatar representa una estación de personalización VRM: cabello, conjunto techwear, arnés, botas, rig humanoide, 12 clips y DualSense son módulos separados; ningún elemento cambia de posición y la animación se limita a dos pulsos lentos de luminosidad. Rostro representa una cámara de calibración y un perfil humano abstracto, cinco dependencias inactivas, ocho canales reservados, cero landmarks, cero FPS y persistencia de video desactivada.

`icons/app-alice.svg` no se modificó. SHA-256 verificado: `91412F987203DA9B0191E3CC2F3CED85CFD7781F12AF74FE8113280F499BFF5D`.

## Resultados reales

| Verificación | Resultado |
|---|---|
| XML | 23/23 SVG válidos |
| Vitest | 25 archivos; 220/220 pruebas aprobadas |
| TypeScript + Vite | 117 módulos transformados; build aprobado |
| Revisión visual Edge | lámina completa de 22 SVG renderizada en Edge headless |
| Rust | 158 pruebas aprobadas; 9 pruebas de hardware/datos reales ignoradas explícitamente |
| Clippy | todos los targets y features, cero advertencias |

La revisión de pantallas se conserva en `artifacts/alice-nucleus-separated-preview.png` y la lámina de iconos en `artifacts/alice-icon-system-cyrcetech-reference.png`. El bundle principal quedó en 584,47 kB minificado después de incorporar la estación avanzada de Conversación, telemetría semántica y animación accesible; deberá reducirse posteriormente mediante carga diferida por pantalla. La advertencia independiente del módulo 3D del avatar permanece fuera del alcance de este cambio.

La navegación principal muestra cada SVG a `98 × 98 px` dentro de un destino de `108 × 112 px`; el tamaño móvil conserva `86 × 86 px` y permite salto de línea. La comprobación cognitiva se conserva en `artifacts/alice-navigation-icons-large.png`; las comprobaciones reales de Body Solver se conservan en `artifacts/alice-avatar-icon-redesign.png` y `artifacts/alice-face-icon-redesign.png`. El tamaño se verifica renderizando la interfaz real, ya que Vitest sustituye las importaciones CSS por módulos vacíos en su entorno de Node.
