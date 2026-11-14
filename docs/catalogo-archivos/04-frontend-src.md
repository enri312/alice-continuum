# 04 · Interfaz React, lógica TypeScript y estilos (`src/`)

Fecha de verificación: 2026-11-06  
Total cubierto en este documento: **178 archivos** reales dentro de `src/` (`3` en raíz + `26` en `components/` + `119` en `core/` + `18` en `pages/` + `11` en `styles/` + `1` en `types/`).

Volver al índice: [`README.md`](README.md) · Ver hallazgos de limpieza: [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)

> **Atención de limpieza en `src/`:** Se trazó el grafo completo de alcanzabilidad desde `index.html` → `src/main.tsx` → `src/App.tsx` (incluyendo `React.lazy`, workers `?worker` / `?worker&url`, CSS y Vitest). De los 178 archivos:
> - **108** están **ACTIVOS** en la aplicación en tiempo de ejecución/compilación.
> - **63** son suites **ACTIVO (TEST)** ejecutadas por Vitest (`3` de ellas prueban módulos ya retirados de la UI).
> - La revisión histórica señaló tres componentes huérfanos. `NucleusViewIcon.tsx` se retiró en la reorganización de noviembre; los otros dos requieren revisión adicional.
> - **1** componente está **TRANSITIVAMENTE SIN USO EN UI** (`BridgeViewIcon.tsx`, dentro de una rama `{!fixedView && ...}` inalcanzable desde `App.tsx`).
> - **3** módulos de `src/core/` quedaron **SOLO USADOS EN TESTS** (`neural-volume-visual.ts`, `teaching-templates.ts` y `learning-candidates.ts`).

---

## 1. Raíz de `src/` (`3` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 1 | [`src/App.tsx`](../../src/App.tsx) | **ACTIVO (CON 2 VARS MUERTAS)** | Componente raíz de la interfaz: coordina el estado global de sesiones (respaldo local y puentes nativos Tauri), memoria durable, memoria de trabajo R6.2, aprendizaje automático con Gemma, perfil del propietario, historial conversacional, eventos cognitivos y selección de proveedor/modelo. Gestiona la barra superior de los tres sistemas (`cognitive`, `body`, `governance`) y enruta las 15 pantallas activas (`React.lazy` para `AvatarPage`). *Residuo menor:* conserva las constantes `ollamaProvider` y `ollamaModel` (líneas 201–202) sin ningún lector tras retirarse los viejos paneles de Ollama. |
| 2 | [`src/main.tsx`](../../src/main.tsx) | **ACTIVO** | Punto de entrada cargado desde `index.html` que monta `<App />` en `#root` bajo `React.StrictMode` e importa las 5 hojas globales base (`base.css`, `industrial-theme.css`, `memory-records.css`, `interaction-affordance.css` y `components/cognitive/NeuralVolume.css`). |
| 3 | [`src/vite-env.d.ts`](../../src/vite-env.d.ts) | **ACTIVO** | Declaración ambiental TypeScript (`/// <reference types="vite/client" />`) incluida por `tsconfig.app.json` para tipar `import.meta.env` y las importaciones especiales de activos/workers de Vite. |

---

## 2. Componentes visuales en `src/components/` (`26` archivos)

### 2.1 `src/components/cognitive/` (`6` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 4 | [`src/components/cognitive/ActionPlanner.tsx`](../../src/components/cognitive/ActionPlanner.tsx) | **ACTIVO** | Renderiza el panel diagnóstico `[04] ACTION / LANGUAGE PLANNER` con el resumen del mensaje de entrada, compuertas del planificador, métricas planificadas aún sin implementar (`INT`, `UTL`, `RSK`, `NOV`) y exporta `plannerInspectorItems` para `ActionPlannerPage`. |
| 5 | [`src/components/cognitive/CognitiveFlow.tsx`](../../src/components/cognitive/CognitiveFlow.tsx) | **ACTIVO** | Dibuja en SVG el grafo funcional `[02] COGNITIVE GRAPH / GLOBAL WORKSPACE` (percepción, inhibición, memoria, espacio global, lenguaje, afecto y salidas corporales), superponiendo la intensidad heurística reciente R3 (`CoreActivitySnapshot`). |
| 6 | [`src/components/cognitive/CognitiveTimeline.tsx`](../../src/components/cognitive/CognitiveTimeline.tsx) | **ACTIVO** | Presenta en `[06] COGNITIVE TIMELINE` un riel temporal interactivo con los últimos 24 eventos cognitivos en memoria de sesión para inspeccionar su origen, hora y detalle. |
| 7 | [`src/components/cognitive/InternalState.tsx`](../../src/components/cognitive/InternalState.tsx) | **ACTIVO** | Muestra el panel de solo lectura `[03] REPLY + AFFECT + DRIVE STATE` con métricas derivadas de `BrainSnapshot` (diferenciando implementadas de planificadas), recuerdo recuperado actual y controles conductuales bloqueados. |
| 8 | [`src/components/cognitive/NeuralVolume.css`](../../src/components/cognitive/NeuralVolume.css) | **ACTIVO** | Hoja de estilos importada en `src/main.tsx` para la maquetación del observatorio volumétrico 3D (`.volume-observatory`), barra de conteos, citas de evidencia, controles de cámara e inspector flotante (sin reglas muertas). |
| 9 | [`src/components/cognitive/NeuralVolume.tsx`](../../src/components/cognitive/NeuralVolume.tsx) | **ACTIVO** | Renderiza en `<canvas>` 2D con proyección 3D interactiva (rotación, paneo, zoom, teclado y órbita) la envolvente cortical, neuronas con soma y dendritas de recuerdos reales, regiones R3 y enlaces trazables de co-aprendizaje, asociación y recuperación. |

### 2.2 `src/components/conversation/` (`3` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 10 | [`src/components/conversation/AudioInputSettings.tsx`](../../src/components/conversation/AudioInputSettings.tsx) | **ACTIVO** | Panel desplegable de entrada de voz que enumera micrófonos disponibles (`enumerateDevices`), permite fijar el dispositivo preferido y muestra el estado del filtro local de ruido y eco. |
| 11 | [`src/components/conversation/ConversationVision.tsx`](../../src/components/conversation/ConversationVision.tsx) | **ACTIVO** | Control multimodal *"Vista de Alice"* exclusivo para Gemma local (`llamacpp`) en Tauri; coordina `VisionSession` para autorizar sesiones temporales (hasta 2 h) con cámara web o escritorio (`start_vision_session`, `preview_vision_desktop`) y expone captura puntual por turno. |
| 12 | [`src/components/conversation/HandsFreeVoice.tsx`](../../src/components/conversation/HandsFreeVoice.tsx) | **ACTIVO** | Sesión conversacional manos libres activada por apelación explícita a *"Alice"* que integra `VoiceLoop`, `VoiceCapture` con RNNoise local y reproducción Web Audio del audio sintetizado con Fish Audio, mostrando telemetría por etapa. |

### 2.3 `src/components/documents/` (`3` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 13 | [`src/components/documents/DocumentPreview.css`](../../src/components/documents/DocumentPreview.css) | **ACTIVO** | Hoja de estilos importada por `DocumentPreview.tsx` y `MemoryAssociations.tsx` para controles de carga documental, estados `:focus-visible`, paneles `<details>/<pre>` y grillas `.memory-associations`. |
| 14 | [`src/components/documents/DocumentPreview.test.tsx`](../../src/components/documents/DocumentPreview.test.tsx) | **ACTIVO (TEST)** | Prueba en Vitest (`renderToStaticMarkup`) que verifica selección manual `.pdf,.md,.txt`, botón inicial deshabilitado y aviso de no persistencia ni envío automático. |
| 15 | [`src/components/documents/DocumentPreview.tsx`](../../src/components/documents/DocumentPreview.tsx) | **ACTIVO** | Herramienta secundaria para previsualizar un documento local PDF/Markdown/TXT (máx. 16 MiB) invocando `preview_document` en Tauri (páginas, caracteres, SHA-256 y fragmentos) sin guardarlo en memoria ni enviarlo al prompt. |

### 2.4 `src/components/embodiment/` (`3` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 16 | [`src/components/embodiment/AvatarViewer.tsx`](../../src/components/embodiment/AvatarViewer.tsx) | **ACTIVO** | Visor 3D en Three.js + `@pixiv/three-vrm` que carga `Alice.vrm` y animaciones Mixamo, aplica perfiles MToon y mapas de normales textiles, escala la altura a 1,66 m, ejecuta locomoción, Foot-Lock e IK plantar de dos huesos, y admite mando DualSense o ensayo diagnóstico de 10 s. |
| 17 | [`src/components/embodiment/BodySolverPanel.tsx`](../../src/components/embodiment/BodySolverPanel.tsx) | **ACTIVO** | Panel diagnóstico `[05/BODY]` que documenta las 5 etapas reservadas del futuro pipeline cinemático corporal (`RAW`, `ONE EURO`, `FABRIK`, `SPRING`, `RETARGET`) con siluetas SVG y salidas bloqueadas. |
| 18 | [`src/components/embodiment/FaceTrackingPanel.tsx`](../../src/components/embodiment/FaceTrackingPanel.tsx) | **ACTIVO** | Panel diagnóstico `[05/FACE]` que consulta pasivamente `face_readiness_status` sin abrir sensores, dibuja una malla geométrica neutral y permite gestionar permisos temporales R2 para `perception.face.landmarks`. |

### 2.5 `src/components/governance/` (`2` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 19 | [`src/components/governance/PermissionGatewayPanel.tsx`](../../src/components/governance/PermissionGatewayPanel.tsx) | **ACTIVO** | Interfaz del Gateway de Permisos R2 (`permission_gateway_status`) para preparar solicitudes sobre `context.foreground.control`, revisarlas en `<dialog>` modal, aprobar concesiones `oneShot` o `session`, ejecutarlas con recibo auditado y revocarlas. |
| 20 | [`src/components/governance/TaskRegistryPanel.tsx`](../../src/components/governance/TaskRegistryPanel.tsx) | **ACTIVO** | Panel del sistema temporal R7 en `ActionPlannerPage` para previsualizar y confirmar con SHA-256 el alta/pausa/reanudación/cancelación de recordatorios locales, chequeos R7.5, reloj interno R7.3-A en RAM y reservas idempotentes R7.3-B. |

### 2.6 `src/components/icons/` (3 archivos actuales)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 21 | [`src/components/icons/BridgeViewIcon.tsx`](../../src/components/icons/BridgeViewIcon.tsx) | **TRANSITIVAMENTE SIN USO EN UI** | Selector de iconos SVG (`overview`, `face`, `body`) importado únicamente por `CapabilityRegistryPage.tsx` dentro de `{!fixedView && ...}`. Jamás se ejecuta porque `App.tsx` siempre pasa un `fixedView` explícito. |
| 22 | [`src/components/icons/InlineSvgIcon.tsx`](../../src/components/icons/InlineSvgIcon.tsx) | **ACTIVO** | Componente base sin estado que envuelve cadenas SVG crudas (`?raw`) del sistema de iconos dentro de un `<span aria-hidden="true">` para la navegación superior y controles de cámara 3D. |
| 23 | [`src/components/icons/NavigationIcon.tsx`](../../src/components/icons/NavigationIcon.tsx) | **ACTIVO** | Catálogo que asocia los 15 identificadores de pestañas principales con sus respectivos activos SVG en `icons/navigation/` para la barra superior de `App.tsx`. |
| 24 | `src/components/icons/NucleusViewIcon.tsx` | **RETIRADO** | Selector anterior sin importadores; copia local de recuperación y contenido en el historial Git. |

### 2.7 `src/components/memory/` (`5` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 25 | [`src/components/memory/AutomaticMemoryPanel.tsx`](../../src/components/memory/AutomaticMemoryPanel.tsx) | **ACTIVO** | Panel superior de `MemoryVaultPage` (*"Aprender conversando"*) para activar/pausar el aprendizaje automático con Gemma, revisar recuerdos aprendidos con su cita fuente y corregirlos o retirarlos/restaurarlos del RAG. |
| 26 | [`src/components/memory/MemoryAssociations.test.tsx`](../../src/components/memory/MemoryAssociations.test.tsx) | **ACTIVO (TEST)** | Prueba en Vitest que verifica que `MemoryAssociations` deshabilite escrituras fuera de Tauri, advierta que asociación no implica causalidad y no invente episodios fuente. |
| 27 | [`src/components/memory/MemoryAssociations.tsx`](../../src/components/memory/MemoryAssociations.tsx) | **ACTIVO** | Panel en `EvidenceFlowPage` que consulta el grafo R8 (`knowledge_graph_snapshot`, `knowledge_graph_associations`) para previsualizar con citas literales verificadas, confirmar, retirar o restaurar vínculos entre episodios. |
| 28 | [`src/components/memory/MemoryCandidatePanel.tsx`](../../src/components/memory/MemoryCandidatePanel.tsx) | **HUÉRFANO / CÓDIGO MUERTO** | Antiguo panel R6.4-C que pedía a Ollama/Qwen candidatos de aprendizaje derivados de recuerdos previos (`preview_learning_candidates` / `confirm_learning_candidate`). **0 importadores**; reemplazado por `AutomaticMemoryPanel.tsx` y propuestas conversacionales con Gemma. |
| 29 | [`src/components/memory/SensoryLearningPanel.tsx`](../../src/components/memory/SensoryLearningPanel.tsx) | **HUÉRFANO / CÓDIGO MUERTO** | Antiguo panel multimodal para concesiones de 60 s (`sensor_lease_status`) y análisis periódico de pantalla vía Ollama (`analyze_screen_frame`). **0 importadores**; reemplazado por `ConversationVision.tsx`. |

---

## 3. Lógica de dominio y contratos en `src/core/` (`119` archivos)

### 3.1 `src/core/cognitive/` (`15` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 30 | [`src/core/cognitive/affect.ts`](../../src/core/cognitive/affect.ts) | **ACTIVO** | Define la paleta diagnóstica de 10 emociones RGB (`affectPalette`), canales planificados en cero (`createPlannedAffectChannels`) y `parseMemoryAffects` (hasta 3 emociones por recuerdo con evidencia léxica literal no negada). |
| 31 | [`src/core/cognitive/affect.test.ts`](../../src/core/cognitive/affect.test.ts) | **ACTIVO (TEST)** | Verifica los 10 canales RGB de `affectPalette`, canales planificados en cero y rechazo de emociones negadas o sin cita literal en `parseMemoryAffects`. |
| 32 | [`src/core/cognitive/brain.ts`](../../src/core/cognitive/brain.ts) | **ACTIVO** | Construye `BrainSnapshot` combinando mensajes, recuerdos proyectados (`buildCognitiveMemoryNodes`), ventana activa y consultas al modelo, separando densidad persistente de actividad efímera del turno (*nota:* el arreglo `nodes` hoy solo se lee en tests). |
| 33 | [`src/core/cognitive/brain.test.ts`](../../src/core/cognitive/brain.test.ts) | **ACTIVO (TEST)** | Comprueba densidad cero sin recuerdos reales, separación entre pulso efímero y estructura persistente, y tope de densidad en 86 %. |
| 34 | [`src/core/cognitive/cognitive-events.ts`](../../src/core/cognitive/cognitive-events.ts) | **ACTIVO** | Declara `CognitiveEvent`, módulos y severidades de sesión junto con `createCognitiveEvent` usado en toda la UI y mostrado en `CognitiveTimeline` y `ActivityPage`. |
| 35 | [`src/core/cognitive/cognitive-volume.ts`](../../src/core/cognitive/cognitive-volume.ts) | **ACTIVO** | Ensambla el `CognitiveVolumeGraph` 3D integrando neuronas persistentes, regiones R3, latido del runtime y recuperación activa con aristas auditables (`audit`, `retrieval`, `association`, `coLearning`) y colores RGB. |
| 36 | [`src/core/cognitive/cognitive-volume.test.ts`](../../src/core/cognitive/cognitive-volume.test.ts) | **ACTIVO (TEST)** | Verifica `buildCognitiveVolumeGraph`, escalado de `cognitiveMemoryRadius`, coloración afectiva/funcional y exclusión de recuerdos dormidos/suprimidos en rutas RAG. |
| 37 | [`src/core/cognitive/core-activity.ts`](../../src/core/cognitive/core-activity.ts) | **ACTIVO** | Valida el snapshot heurístico nativo R3 (`parseCoreActivitySnapshot`, esquema v2 con 7 regiones y 5 enlaces) y aplica sus pulsos sobre `BrainSnapshot` (`applyCoreActivitySnapshot`). |
| 38 | [`src/core/cognitive/core-activity.test.ts`](../../src/core/cognitive/core-activity.test.ts) | **ACTIVO (TEST)** | Prueba `parseCoreActivitySnapshot` y `applyCoreActivitySnapshot` rechazando topologías desconocidas, intensidades fuera de rango y campos no autorizados. |
| 39 | [`src/core/cognitive/identification.ts`](../../src/core/cognitive/identification.ts) | **ACTIVO** | Tokeniza entradas en español (`tokenizeIdentificationInput`, máx. 32 tokens) y construye `buildIdentificationSnapshot` clasificando intenciones (`CONSULTA`, `AJUSTE / REVISIÓN`, `INSTRUCCIÓN`, `FRIENDLY`) y señales heurísticas. |
| 40 | [`src/core/cognitive/identification.test.ts`](../../src/core/cognitive/identification.test.ts) | **ACTIVO (TEST)** | Verifica tokenización en español, prioridad del borrador activo y clasificación determinista en `buildIdentificationSnapshot`. |
| 41 | [`src/core/cognitive/neural-geometry.ts`](../../src/core/cognitive/neural-geometry.ts) | **ACTIVO** | Funciones geométricas deterministas con hash FNV-1a (`neuralSeed`) para trazar arcos corticales (`cortexPoint`, `cortexPaths`) y ubicar cada recuerdo en el elipsoide bihemisférico (`neuralMemoryPosition`). |
| 42 | [`src/core/cognitive/neural-geometry.test.ts`](../../src/core/cognitive/neural-geometry.test.ts) | **ACTIVO (TEST)** | Comprueba estabilidad espacial de `neuralMemoryPosition`, reparto bihemisférico y ausencia de valores no finitos en `cortexPaths`. |
| 43 | [`src/core/cognitive/neural-volume-visual.ts`](../../src/core/cognitive/neural-volume-visual.ts) | **SOLO USADO EN TESTS** | Módulo heredado de pulso por grupo y coloración neuronal (`resolveNeuralGroupActivity`, `compactGrowthReveal`, `visibleMemoryAnchorCount`, `resolveNeuralColor`), reemplazado por `cognitive-volume.ts` y `NeuralVolume.tsx`. |
| 44 | [`src/core/cognitive/neural-volume-visual.test.ts`](../../src/core/cognitive/neural-volume-visual.test.ts) | **ACTIVO (TEST)** | Suite de Vitest que ejercita el módulo desconectado `neural-volume-visual.ts`. |

### 3.2 `src/core/conversation/` (`13` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 45 | [`src/core/conversation/cloud-payload.ts`](../../src/core/conversation/cloud-payload.ts) | **ACTIVO** | Construye el paquete exacto enviado al modelo (`buildCloudPayload`) y su revisión previa (`buildCloudPayloadReview`), etiquetando procedencia epistémica y midiendo caracteres Unicode y bytes UTF-8 exactos. |
| 46 | [`src/core/conversation/cloud-payload.test.ts`](../../src/core/conversation/cloud-payload.test.ts) | **ACTIVO (TEST)** | Valida inclusión exclusiva de contexto autorizado, distinción entre episodios y hechos confirmados, y conteo UTF-8 en `buildCloudPayload`. |
| 47 | [`src/core/conversation/conversation-contracts.ts`](../../src/core/conversation/conversation-contracts.ts) | **ACTIVO** | Contratos TypeScript compartidos del subsistema conversacional (`ConversationMessage`, `CloudStatus`, `CloudProvider`, `CloudRequest`, `CloudResponse`, `HybridRetrieval*`). |
| 48 | [`src/core/conversation/conversation-history.ts`](../../src/core/conversation/conversation-history.ts) | **ACTIVO** | Valida el snapshot nativo del historial durable (`parseConversationHistorySnapshot`, tope de 1.000 intercambios y `automaticMemoryPromotion: false`) y reconstruye mensajes (`messagesFromConversationHistory`). |
| 49 | [`src/core/conversation/conversation-history.test.ts`](../../src/core/conversation/conversation-history.test.ts) | **ACTIVO (TEST)** | Comprueba aceptación de historiales verificados con SHA-256 y rechazo de conteos alterados o promoción automática indebida. |
| 50 | [`src/core/conversation/conversation-learning.ts`](../../src/core/conversation/conversation-learning.ts) | **ACTIVO** | Valida vistas previas no persistidas de aprendizaje manual por intercambio con Gemma (`parseConversationLearningPreview`, hasta 3 candidatos con citas y afectos verificados) y su confirmación (`parseConversationLearningConfirmation`). |
| 51 | [`src/core/conversation/conversation-learning.test.ts`](../../src/core/conversation/conversation-learning.test.ts) | **ACTIVO (TEST)** | Verifica revisión humana obligatoria y bloqueo de candidatos emocionales cuya cita no aparezca literalmente en el intercambio. |
| 52 | [`src/core/conversation/owner-profile.ts`](../../src/core/conversation/owner-profile.ts) | **ACTIVO** | Valida el snapshot nativo del perfil confirmado del propietario (`parseOwnerProfileSnapshot`), exigiendo hashes SHA-256 válidos y `memoryStatus: "confirmed"`. |
| 53 | [`src/core/conversation/owner-profile.test.ts`](../../src/core/conversation/owner-profile.test.ts) | **ACTIVO (TEST)** | Prueba aceptación de registros de perfil confirmados y rechazo de propuestos o con integridad inválida. |
| 54 | [`src/core/conversation/teaching-templates.ts`](../../src/core/conversation/teaching-templates.ts) | **SOLO USADO EN TESTS** | Catálogo de 6 plantillas guiadas del antiguo formulario retirado *"Enseñarle a Alice"* (`teachingTemplates`). Sin uso en componentes actuales de UI. |
| 55 | [`src/core/conversation/teaching-templates.test.ts`](../../src/core/conversation/teaching-templates.test.ts) | **ACTIVO (TEST)** | Suite que verifica las 6 plantillas del módulo desconectado `teaching-templates.ts`. |
| 56 | [`src/core/conversation/vision-session.ts`](../../src/core/conversation/vision-session.ts) | **ACTIVO** | Clase `VisionSession` (con control generacional frente a condiciones de carrera al abrir/cerrar permisos visuales) y `openConversationCamera` para capturar un fotograma PNG (`<= 4 MB`) por turno. |
| 57 | [`src/core/conversation/vision-session.test.ts`](../../src/core/conversation/vision-session.test.ts) | **ACTIVO (TEST)** | Prueba revocación de sesiones/cámaras tardías, captura exclusiva en turnos activos y limpieza ante errores nativos. |

### 3.3 `src/core/embodiment/` (`18` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 58 | [`src/core/embodiment/avatar-animation.ts`](../../src/core/embodiment/avatar-animation.ts) | **ACTIVO** | Mezclas continuas de locomoción/carrera/pivote (`computeLocomotionWeights`, `locomotionCycleRate`), correcciones plantares (`footGroundCorrection`, `advanceFootLockOffset`, `bakeFootLockOffset`) y retargeting FBX de Mixamo a VRM (`loadMixamoAnimation`). |
| 59 | [`src/core/embodiment/avatar-animation.test.ts`](../../src/core/embodiment/avatar-animation.test.ts) | **ACTIVO (TEST)** | Verifica pesos de locomoción, cadencia, Foot-Lock plantar y limpieza de traslación/guiñada raíz al adaptar animaciones Mixamo. |
| 60 | [`src/core/embodiment/avatar-appearance.ts`](../../src/core/embodiment/avatar-appearance.ts) | **ACTIVO** | Clasifica materiales de ropa VRM por rol textil (`avatarClothingFinish`) para afinar sombreado MToon y aplica anisotropía y escala de normales (`applyAvatarClothingSurfaceDetail`). |
| 61 | [`src/core/embodiment/avatar-appearance.test.ts`](../../src/core/embodiment/avatar-appearance.test.ts) | **ACTIVO (TEST)** | Comprueba reconocimiento de materiales reales de ropa de `Alice.vrm` excluyendo piel/rostro/cabello y preservación del color base. |
| 62 | [`src/core/embodiment/avatar-body-state.ts`](../../src/core/embodiment/avatar-body-state.ts) | **ACTIVO** | Máquina de estados corporales pura (`advanceAvatarBodyState`, `bodyStateAnimation`, `isBodyTransition`) para reposo, inicio de marcha, locomoción, salto y postura sentada. |
| 63 | [`src/core/embodiment/avatar-body-state.test.ts`](../../src/core/embodiment/avatar-body-state.test.ts) | **ACTIVO (TEST)** | Valida transiciones atómicas de `advanceAvatarBodyState`, sentado/levantado, aterrizaje de saltos y degradación segura sin clips opcionales. |
| 64 | [`src/core/embodiment/avatar-clothing-detail.ts`](../../src/core/embodiment/avatar-clothing-detail.ts) | **ACTIVO** | Genera proceduralmente mapas de normales `DataTexture` con microrrelieve textil y costuras (`clothingNormalPixels`, `createAvatarClothingDetail`) para prendas MToon, con `dispose()`. |
| 65 | [`src/core/embodiment/avatar-clothing-detail.test.ts`](../../src/core/embodiment/avatar-clothing-detail.test.ts) | **ACTIVO (TEST)** | Verifica normales unitarias, respeto de bordes UV transparentes y restauración de texturas originales al liberar recursos. |
| 66 | [`src/core/embodiment/avatar-expression-catalog.ts`](../../src/core/embodiment/avatar-expression-catalog.ts) | **ACTIVO** | Sanea y deduplica nombres de expresiones faciales de un activo VRM (`catalogAvatarExpressions`), filtrando vacíos, caracteres de control o cadenas `> 96` caracteres. |
| 67 | [`src/core/embodiment/avatar-expression-catalog.test.ts`](../../src/core/embodiment/avatar-expression-catalog.test.ts) | **ACTIVO (TEST)** | Comprueba orden preservado sin duplicados y filtrado de entradas malformadas en `catalogAvatarExpressions`. |
| 68 | [`src/core/embodiment/avatar-foot-ik.ts`](../../src/core/embodiment/avatar-foot-ik.ts) | **ACTIVO** | Solucionador iterativo acotado de cinemática inversa de dos huesos (`solveTwoBoneFootIK`) para muslo/pantorrilla preservando orientación mundial del pie, y `footIKTargetNeedsReanchor`. |
| 69 | [`src/core/embodiment/avatar-foot-ik.test.ts`](../../src/core/embodiment/avatar-foot-ik.test.ts) | **ACTIVO (TEST)** | Verifica acercamiento del tobillo sin rotar el pie, descarte de `NaN` y detección de reanclaje necesario. |
| 70 | [`src/core/embodiment/avatar-scale.ts`](../../src/core/embodiment/avatar-scale.ts) | **ACTIVO** | Escala uniformemente cualquier VRM a `1,66 m` (`AVATAR_HEIGHT_METRES`) con suelas exactamente en `y = 0` (`createAvatarScale`) y convierte offsets verticales mundiales de cadera (`offsetAvatarJointWorldY`). |
| 71 | [`src/core/embodiment/avatar-scale.test.ts`](../../src/core/embodiment/avatar-scale.test.ts) | **ACTIVO (TEST)** | Prueba escalado exacto a 1,66 m con apoyo en `y = 0` y traslación vertical en jerarquías rotadas/escaladas. |
| 72 | [`src/core/embodiment/face-readiness.ts`](../../src/core/embodiment/face-readiness.ts) | **ACTIVO** | Valida el diagnóstico pasivo nativo de `face_landmarker` (`parseFaceReadinessStatus`), exigiendo `sensorOpened: false` y huella SHA-256 válida. |
| 73 | [`src/core/embodiment/face-readiness.test.ts`](../../src/core/embodiment/face-readiness.test.ts) | **ACTIVO (TEST)** | Verifica aceptación de diagnósticos pasivos legítimos y rechazo si `sensorOpened` es `true` o el hash es inválido. |
| 74 | [`src/core/embodiment/manual-avatar-control.ts`](../../src/core/embodiment/manual-avatar-control.ts) | **ACTIVO** | Lee y suaviza mandos vía Gamepad API priorizando Sony DualSense (`selectManualGamepad`, `readManualAvatarInput`, `smoothManualAvatarInput`), integra locomoción planar (`advanceManualAvatarMotion`) y ensayo determinista de 10 s (`diagnosticManualInputAt`). |
| 75 | [`src/core/embodiment/manual-avatar-control.test.ts`](../../src/core/embodiment/manual-avatar-control.test.ts) | **ACTIVO (TEST)** | Valida zonas muertas, prioridad DualSense, cinemática planar rotada, suavizado exponencial y ensayo técnico de 10 s. |

### 3.4 `src/core/governance/` (`19` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 76 | [`src/core/governance/audit.ts`](../../src/core/governance/audit.ts) | **ACTIVO** | Valida eventos y snapshots del registro inmutable de auditoría R3 (`parseAuditEvent`, `parseAuditSnapshot` en todos los dominios gobernados) y formatea el peso en disco (`auditSizeLabel`). |
| 77 | [`src/core/governance/audit.test.ts`](../../src/core/governance/audit.test.ts) | **ACTIVO (TEST)** | Comprueba aceptación de secuencias correlacionadas válidas y bloqueo de campos privados o categorías inventadas. |
| 78 | [`src/core/governance/capabilities.ts`](../../src/core/governance/capabilities.ts) | **ACTIVO** | Valida el Registro de Capacidades R1 (`parseCapabilityRegistrySnapshot`), provee el registro vacío en modo navegador (`createWebDevelopmentCapabilityRegistry`) y resume conteos por riesgo/disponibilidad (`summarizeCapabilityRegistry`). |
| 79 | [`src/core/governance/capabilities.test.ts`](../../src/core/governance/capabilities.test.ts) | **ACTIVO (TEST)** | Verifica descriptores R1, prohibición de capacidades planificadas marcadas como disponibles y `summarizeCapabilityRegistry`. |
| 80 | [`src/core/governance/diagnostics.ts`](../../src/core/governance/diagnostics.ts) | **ACTIVO** | Valida el snapshot pasivo de autodiagnóstico R3 (`parseDiagnosticSnapshot`), verificando coherencia aritmética entre ítems (`path`, `dataVersion`, `provider`, `adapter`, `permission`) y estado global. |
| 81 | [`src/core/governance/diagnostics.test.ts`](../../src/core/governance/diagnostics.test.ts) | **ACTIVO (TEST)** | Prueba rechazo de conteos desfasados, estados globales mal derivados o filtraciones sensibles en `parseDiagnosticSnapshot`. |
| 82 | [`src/core/governance/permissions.ts`](../../src/core/governance/permissions.ts) | **ACTIVO (PARCIALMENTE HUÉRFANO)** | Constructores y validadores R2 (`parsePermissionGatewayStatus`, `createForegroundControlPreparation`, `createFaceLandmarkPreparation`, decisiones, ejecuciones y revocaciones). *Residuo parcial:* conserva helpers de *sensor leases* (`createSensorPreparation`, `parseSensorLease*`) que solo usaba el huérfano `SensoryLearningPanel.tsx`. |
| 83 | [`src/core/governance/permissions.test.ts`](../../src/core/governance/permissions.test.ts) | **ACTIVO (TEST)** | Prueba contratos R2, huellas de parámetros, concesiones `oneShot`/`session`, límite de 60 s facial y leases sensoriales. |
| 84 | [`src/core/governance/procedure-detection.test.ts`](../../src/core/governance/procedure-detection.test.ts) | **ACTIVO (TEST)** | Suite dedicada a `parseProcedureDetectionSnapshot` (exportado por `procedure-learning.ts`), verificando detección de patrones R5 sin solapar evidencia. |
| 85 | [`src/core/governance/procedure-learning.ts`](../../src/core/governance/procedure-learning.ts) | **ACTIVO** | Valida la detección nativa de secuencias repetidas sobre auditoría R3 (`parseProcedureDetectionSnapshot`, activo en `ProcedureObserverPage.tsx`) y `parseProcedureCandidate`. |
| 86 | [`src/core/governance/procedure-learning.test.ts`](../../src/core/governance/procedure-learning.test.ts) | **ACTIVO (TEST)** | Prueba trazabilidad R3/R1, cálculo de riesgo heredado máximo y prohibición de automatización implícita en `parseProcedureCandidate`. |
| 87 | [`src/core/governance/procedure-store.ts`](../../src/core/governance/procedure-store.ts) | **ACTIVO** | Valida el almacén de decisiones humanas sobre patrones R5 (`parseProcedureCandidateStoreSnapshot`, `parseProcedurePatternDecisionResult`) y su conversión gobernada hacia borradores R4 (`parseProcedureDraftConversion*`). |
| 88 | [`src/core/governance/procedure-store.test.ts`](../../src/core/governance/procedure-store.test.ts) | **ACTIVO (TEST)** | Comprueba decisiones `retain`/`dismiss`, estados de vigencia (`current`, `stale`, `blocked`, `dismissed`) y conversión R5→R4 sin ejecución. |
| 89 | [`src/core/governance/skill-workshop.ts`](../../src/core/governance/skill-workshop.ts) | **ACTIVO** | Determina transiciones legales del ciclo de vida R4 (`lifecycleActionsForStatus`) y sus advertencias de gobierno (`lifecycleActionDescription`) para `SkillWorkshopPage`. |
| 90 | [`src/core/governance/skill-workshop.test.ts`](../../src/core/governance/skill-workshop.test.ts) | **ACTIVO (TEST)** | Verifica transiciones permitidas por estado y avisos explícitos de no ejecución en `skill-workshop.ts`. |
| 91 | [`src/core/governance/skills.ts`](../../src/core/governance/skills.ts) | **ACTIVO** | Contratos completos de Habilidades R4: manifiestos (`parseSkillManifest`), almacén de borradores (`parseSkillDraftStoreSnapshot`), ciclo de vida versionado (`parseSkillLifecycleSnapshot`) y simulación estática (`parseSkillSimulationResult`). |
| 92 | [`src/core/governance/skills.test.ts`](../../src/core/governance/skills.test.ts) | **ACTIVO (TEST)** | Prueba manifiestos R4, hashes SHA-256 de borradores, transiciones R4.4 y simulación estática R4.3 sin efectos secundarios. |
| 93 | [`src/core/governance/tasks.ts`](../../src/core/governance/tasks.ts) | **ACTIVO** | Contratos completos del sistema temporal R7: recordatorios únicos, planes/recibos SHA-256, reloj interno R7.3-A, reservas idempotentes R7.3-B, notificaciones locales R7.4, chequeos R7.5 y `localDateTimeToUtc`. |
| 94 | [`src/core/governance/tasks.test.ts`](../../src/core/governance/tasks.test.ts) | **ACTIVO (TEST)** | Verifica de punta a punta recordatorios R7, recibos SHA-256, conversión UTC, reloj en RAM, reservas idempotentes y despachos manuales. |

### 3.5 `src/core/memory/` (`30` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 95 | [`src/core/memory/automatic-memory.ts`](../../src/core/memory/automatic-memory.ts) | **ACTIVO** | Valida el snapshot nativo de recuerdos aprendidos automáticamente con Gemma (`parseAutomaticMemorySnapshot`) y los proyecta a memoria conversacional/RAG (`automaticMemoryForConversation`) preservando co-aprendizaje y correcciones. |
| 96 | [`src/core/memory/automatic-memory.test.ts`](../../src/core/memory/automatic-memory.test.ts) | **ACTIVO (TEST)** | Prueba desde `parseAutomaticMemorySnapshot` hasta recuperación léxica, etiquetado en `buildCloudPayload` y enlaces `coLearning` 3D. |
| 97 | [`src/core/memory/cognitive-memory.ts`](../../src/core/memory/cognitive-memory.ts) | **ACTIVO** | Convierte registros de memoria local en nodos proyectables (`buildCognitiveMemoryNodes`) con capa funcional, vigencia, posición cortical determinista y emociones validadas. |
| 98 | [`src/core/memory/cognitive-memory.test.ts`](../../src/core/memory/cognitive-memory.test.ts) | **ACTIVO (TEST)** | Verifica correspondencia 1:1 con recuerdos reales, metadatos de archivo/supresión y ausencia de enlaces inventados. |
| 99 | [`src/core/memory/knowledge-graph-volume.ts`](../../src/core/memory/knowledge-graph-volume.ts) | **ACTIVO** | Valida asociaciones confirmadas R8 (`parseConfirmedMemoryAssociations`), extrae citas por offsets exactos de bytes UTF-8 (`resolveKnowledgeGraphEvidenceQuote`) y proyecta el grafo al volumen 3D (`parseKnowledgeGraphVolumeProjection`). |
| 100 | [`src/core/memory/knowledge-graph-volume.test.ts`](../../src/core/memory/knowledge-graph-volume.test.ts) | **ACTIVO (TEST)** | Prueba aristas confirmadas del grafo R8, extracción UTF-8 multibyte exacta y estados degradados/vacíos. |
| 101 | [`src/core/memory/layered-memory.ts`](../../src/core/memory/layered-memory.ts) | **ACTIVO** | Valida el índice de memoria por capas R6.1 (`parseLayeredMemorySnapshot`, `schemaVersion: 2`) comprobando conteos por capa (`working`, `episodic`, `semantic`, `procedural`) y ausencia de migración implícita. |
| 102 | [`src/core/memory/layered-memory.test.ts`](../../src/core/memory/layered-memory.test.ts) | **ACTIVO (TEST)** | Verifica invariantes de solo lectura, conteos exactos y obligatoriedad de `blockingReason` cuando el índice está bloqueado. |
| 103 | [`src/core/memory/learning-candidates.ts`](../../src/core/memory/learning-candidates.ts) | **SOLO USADO EN TESTS** | Validadores del antiguo flujo R6.4-C con Ollama (`parseLearningCandidatePreview`, `parseLearningCandidateConfirmation`). En la UI solo lo importaba el huérfano `MemoryCandidatePanel.tsx`. |
| 104 | [`src/core/memory/learning-candidates.test.ts`](../../src/core/memory/learning-candidates.test.ts) | **ACTIVO (TEST)** | Suite en Vitest del módulo desconectado `learning-candidates.ts`. |
| 105 | [`src/core/memory/memory-archive.ts`](../../src/core/memory/memory-archive.ts) | **ACTIVO** | Valida vistas previas sin escritura y recibos auditados de archivo reversible y restauración de recuerdos (`parseMemoryArchivePreview`, `parseMemoryArchiveResult`). |
| 106 | [`src/core/memory/memory-archive.test.ts`](../../src/core/memory/memory-archive.test.ts) | **ACTIVO (TEST)** | Comprueba sincronía de banderas de archivo con el ciclo de vida R6.5 y eventos de auditoría válidos. |
| 107 | [`src/core/memory/memory-consolidation.ts`](../../src/core/memory/memory-consolidation.ts) | **ACTIVO** | Calcula intervalos y colas de repaso espaciado (`reviewIntervalDays`, `scheduleReview`, `buildReviewQueue`), revisiones (`applyMemoryReview`) y utilidad RAG (`applyMemoryRetrievalOutcome`). |
| 108 | [`src/core/memory/memory-consolidation.test.ts`](../../src/core/memory/memory-consolidation.test.ts) | **ACTIVO (TEST)** | Verifica intervalos de repaso, orden de `buildReviewQueue`, refuerzo y métricas inmutables de utilidad RAG. |
| 109 | [`src/core/memory/memory-consolidation-preview.ts`](../../src/core/memory/memory-consolidation-preview.ts) | **ACTIVO** | Valida los contratos deterministas R6.3 de consolidación: detección de duplicados/conflictos, `keepSeparate`, simulación de fusión y recuperación/restauración transaccional. |
| 110 | [`src/core/memory/memory-consolidation-preview.test.ts`](../../src/core/memory/memory-consolidation-preview.test.ts) | **ACTIVO (TEST)** | Prueba los 5 validadores R6.3 de consolidación y restauración sin modelos generativos. |
| 111 | [`src/core/memory/memory-deletion.ts`](../../src/core/memory/memory-deletion.ts) | **ACTIVO** | Valida la espera obligatoria de 7 días antes de borrar un recuerdo (`parseMemoryDeletionSchedule*`) y el retiro definitivo con respaldo previo y *tombstone* sin texto privado (`parseMemoryDeletion*`). |
| 112 | [`src/core/memory/memory-deletion.test.ts`](../../src/core/memory/memory-deletion.test.ts) | **ACTIVO (TEST)** | Comprueba retención mínima de `604800` s, respaldo previo verificado y ausencia de texto sensible en el *tombstone*. |
| 113 | [`src/core/memory/memory-discard.ts`](../../src/core/memory/memory-discard.ts) | **ACTIVO** | Exporta `isLegacyMemoryDiscardable` para limitar el descarte directo en `MemoryVaultPage` únicamente a registros locales heredados fuera del gobierno durable versionado. |
| 114 | [`src/core/memory/memory-discard.test.ts`](../../src/core/memory/memory-discard.test.ts) | **ACTIVO (TEST)** | Verifica que `isLegacyMemoryDiscardable` proteja cualquier recuerdo con versión, estado durable o retención activa. |
| 115 | [`src/core/memory/memory-lifecycle.ts`](../../src/core/memory/memory-lifecycle.ts) | **ACTIVO** | Valida el índice funcional de ciclo de vida R6.5 (`parseMemoryLifecyclePreview`), elegibilidad RAG, señales de debilitamiento y recibos de vigencia, accesibilidad y supresión. |
| 116 | [`src/core/memory/memory-lifecycle.test.ts`](../../src/core/memory/memory-lifecycle.test.ts) | **ACTIVO (TEST)** | Prueba invariantes R6.5, filtrado RAG, debilitamiento por recuperaciones no útiles y transiciones auditadas. |
| 117 | [`src/core/memory/memory-reconsolidation.ts`](../../src/core/memory/memory-reconsolidation.ts) | **ACTIVO** | Valida vistas previas sin escritura (`parseMemoryReconsolidationPreview`) y confirmaciones versionadas (`+1` versión con copia de respaldo e historial auditado). |
| 118 | [`src/core/memory/memory-reconsolidation.test.ts`](../../src/core/memory/memory-reconsolidation.test.ts) | **ACTIVO (TEST)** | Comprueba incremento consecutivo exacto de versión, respaldo verificable y sincronía con R6.5. |
| 119 | [`src/core/memory/memory-retrieval.ts`](../../src/core/memory/memory-retrieval.ts) | **ACTIVO** | Motor local de recuperación léxica TF-IDF con normalización diacrítica y *stemming* ligero en español (`retrieveMemories`, `buildRetrievalQuery`), excluyendo recuerdos dormidos/suprimidos/archivados y texto previo del asistente. |
| 120 | [`src/core/memory/memory-retrieval.test.ts`](../../src/core/memory/memory-retrieval.test.ts) | **ACTIVO (TEST)** | Verifica emparejamiento morfológico en español, contextualización en `buildRetrievalQuery` y bloqueo de registros no elegibles. |
| 121 | [`src/core/memory/memory-review-proposals.ts`](../../src/core/memory/memory-review-proposals.ts) | **ACTIVO** | Clasifica el origen documental (`memoryOrigin`, `memoryOriginLabel`) y genera avisos diagnósticos (`memoryReviewProposal`) ante episodios sin certificar o respuestas truncadas. |
| 122 | [`src/core/memory/memory-review-proposals.test.ts`](../../src/core/memory/memory-review-proposals.test.ts) | **ACTIVO (TEST)** | Comprueba diferenciación entre enseñanzas confirmadas y observaciones conversacionales o truncadas. |
| 123 | [`src/core/memory/working-memory.ts`](../../src/core/memory/working-memory.ts) | **ACTIVO** | Valida el estado efímero en RAM de la memoria de trabajo R6.2 (`parseWorkingMemorySnapshot`, `parseWorkingMemoryOperationResult`: máx. 12 mensajes, 72.000 caracteres, TTL 2 h, `persisted: false`) y ayudantes de formato. |
| 124 | [`src/core/memory/working-memory.test.ts`](../../src/core/memory/working-memory.test.ts) | **ACTIVO (TEST)** | Prueba límites estrictos de capacidad, expiración y no persistencia en disco de la memoria de trabajo R6.2. |

### 3.6 `src/core/navigation/` (`3` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 125 | [`src/core/navigation/icon-system.test.ts`](../../src/core/navigation/icon-system.test.ts) | **ACTIVO (TEST)** | Suite de integridad gráfica/semántica que inspecciona los 22 SVG (`?raw`) en `icons/`, validando ausencia de `<script>`/`<text>`, atributos `data-semantic` y soporte `prefers-reduced-motion`. |
| 126 | [`src/core/navigation/workspaces.ts`](../../src/core/navigation/workspaces.ts) | **ACTIVO** | Define `Workspace`, `Screen`, `workspaceScreens` con las 15 pantallas activas repartidas en `cognitive` (7), `body` (3) y `governance` (5), y `workspaceForScreen`. |
| 127 | [`src/core/navigation/workspaces.test.ts`](../../src/core/navigation/workspaces.test.ts) | **ACTIVO (TEST)** | Verifica unicidad de las 15 pantallas en `workspaceScreens` y resolución exacta en `workspaceForScreen`. |

### 3.7 `src/core/shared/` (`4` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 128 | [`src/core/shared/polling.ts`](../../src/core/shared/polling.ts) | **ACTIVO** | Exporta `startSerializedPolling`: planificador periódico que garantiza como máximo una lectura asíncrona en vuelo y descarta respuestas tardías al desmontar vistas. |
| 129 | [`src/core/shared/polling.test.ts`](../../src/core/shared/polling.test.ts) | **ACTIVO (TEST)** | Verifica con relojes simulados ausencia de solapamientos, cancelación limpia y recuperación ante errores transitorios. |
| 130 | [`src/core/shared/storage-migration.ts`](../../src/core/shared/storage-migration.ts) | **ACTIVO** | Provee `loadCompatibleArray` para leer arreglos JSON desde `localStorage`, migrando datos desde claves históricas sin destruir copias previas. |
| 131 | [`src/core/shared/storage-migration.test.ts`](../../src/core/shared/storage-migration.test.ts) | **ACTIVO (TEST)** | Comprueba prioridad de la clave vigente, migración desde claves heredadas y retorno seguro `[]` ante entradas corruptas. |

### 3.8 `src/core/voice/` (`17` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 132 | [`src/core/voice/noise-pipeline.ts`](../../src/core/voice/noise-pipeline.ts) | **ACTIVO** | Abre el micrófono a 48 kHz con cancelación de eco (`getMicrophone`) y arma el grafo Web Audio local (`processMicrophone`): filtro paso alto 80 Hz + `AudioWorkletNode` (`noise-worklet?worker&url`) + `Worker` dedicado (`noise-worker?worker`) vía `MessageChannel`. |
| 133 | [`src/core/voice/noise-types.ts`](../../src/core/voice/noise-types.ts) | **ACTIVO** | Contratos TypeScript compartidos del filtrado acústico local (`SpeechEvidence`, `MicrophoneOptions`, `NoiseStatus`, `ProcessedMicrophone`). |
| 134 | [`src/core/voice/noise-worker.ts`](../../src/core/voice/noise-worker.ts) | **ACTIVO (WEB WORKER)** | Web Worker dedicado empaquetado por Vite que ejecuta `@shiguredo/rnnoise-wasm` sobre tramas de 480 muestras para atenuar ruido de fondo y calcular probabilidad VAD y energía RMS fuera del hilo principal. |
| 135 | [`src/core/voice/noise-worklet.ts`](../../src/core/voice/noise-worklet.ts) | **ACTIVO (AUDIO WORKLET)** | `AudioWorkletProcessor` (`alice-noise-bridge`) que gestiona buffers circulares de 500 ms en tiempo real, aplica compuerta suave por probabilidad de voz y emite telemetría acústica sin correr WASM en el hilo de audio. |
| 136 | [`src/core/voice/noise-worklet.test.ts`](../../src/core/voice/noise-worklet.test.ts) | **ACTIVO (TEST)** | Simula `AudioWorkletProcessor` para verificar absorción de hasta 320 ms de jitter y fallo explícito ante saturación (`> 50` tramas pendientes). |
| 137 | [`src/core/voice/speech-endpoint.ts`](../../src/core/voice/speech-endpoint.ts) | **ACTIVO** | Detector local de fin de turno (`SpeechEndpoint`): adapta piso de ruido, exige `>= 120 ms` de voz sostenida, cierra turno tras `1 s` de pausa (`"end"`) y descarta `8 s` de silencio/ruido sin habla (`"quiet"`). |
| 138 | [`src/core/voice/speech-endpoint.test.ts`](../../src/core/voice/speech-endpoint.test.ts) | **ACTIVO (TEST)** | Verifica rechazo de golpes breves o ruido estacionario, tolerancia de pausas cortas y corte exacto tras 1 s de silencio. |
| 139 | [`src/core/voice/voice-capture.ts`](../../src/core/voice/voice-capture.ts) | **ACTIVO** | Clase `VoiceCapture` que graba WebM/Opus efímero (máx. 60 s manual / 20 s automático y 8 MB) exclusivamente sobre el stream filtrado por `processMicrophone`, liberando micrófono y concesiones tardías ante cualquier salida. |
| 140 | [`src/core/voice/voice-capture.test.ts`](../../src/core/voice/voice-capture.test.ts) | **ACTIVO (TEST)** | Prueba liberación inmediata antes de transcribir, guardas generacionales, tope de 8 MB, corte por silencio y rechazo a grabar audio crudo sin filtro. |
| 141 | [`src/core/voice/voice-commands.ts`](../../src/core/voice/voice-commands.ts) | **ACTIVO** | Reconocedor gramatical acotado sobre texto ASR normalizado para órdenes directas no citadas de pausa (`isVoiceStopCommand`, incluyendo *"detend"*), apagado de micrófono (`isMicrophoneOffCommand`) y apelación vocativa a Alice (`isAddressedToAlice`). |
| 142 | [`src/core/voice/voice-commands.test.ts`](../../src/core/voice/voice-commands.test.ts) | **ACTIVO (TEST)** | Comprueba frases afirmativas, negativas, citadas y ruido conversacional ambiental para evitar falsos disparos o cierres accidentales. |
| 143 | [`src/core/voice/voice-input.ts`](../../src/core/voice/voice-input.ts) | **ACTIVO** | Valida la transcripción efímera devuelta por Rust (`parseVoiceTurnTranscript`: exige `ephemeralAudio: true`, `sentToConversation: false`, `persisted: false`) y codifica binarios en Base64 (`bytesToBase64`). |
| 144 | [`src/core/voice/voice-input.test.ts`](../../src/core/voice/voice-input.test.ts) | **ACTIVO (TEST)** | Verifica rechazo de transcripciones persistidas o incoherentes con `noSpeech` y codificación `bytesToBase64`. |
| 145 | [`src/core/voice/voice-loop.ts`](../../src/core/voice/voice-loop.ts) | **ACTIVO** | Orquestador `VoiceLoop` manos libres (caducidad dura de 2 h y guardas generacionales): autorización única, escucha filtrada, ASR local, comandos de voz, espera por nombre *"Alice"*, respuesta LLM, TTS degradable a texto y telemetría (`VoiceTurnObservation`). |
| 146 | [`src/core/voice/voice-loop.test.ts`](../../src/core/voice/voice-loop.test.ts) | **ACTIVO (TEST)** | Suite integral de múltiples turnos, rearme ante frases ajenas, parada/apagado por voz, degradación ante fallos de Fish Audio y caducidad a las 2 horas. |
| 147 | [`src/core/voice/voice-output.ts`](../../src/core/voice/voice-output.ts) | **ACTIVO** | Valida los contratos de síntesis vocal temporal con Fish Audio: vista previa con SHA-256 (`parseVoiceOutputPreview`) y respuesta MP3 efímera en Base64 (`parseVoiceOutputResult`). |
| 148 | [`src/core/voice/voice-output.test.ts`](../../src/core/voice/voice-output.test.ts) | **ACTIVO (TEST)** | Comprueba bloqueo sin credenciales (`missingApiKey` / `missingVoiceProfile`) y aceptación exclusiva de `audio/mpeg` temporal válido. |

---

## 4. Pantallas y vistas principales en `src/pages/` (`18` archivos)

### 4.1 `src/pages/cognitive/` (`8` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 149 | [`src/pages/cognitive/ActionPlannerPage.tsx`](../../src/pages/cognitive/ActionPlannerPage.tsx) | **ACTIVO** | Pantalla `Planificador` (`[04]`): integra `ActionPlanner`, su inspector de etapas futuras y `TaskRegistryPanel` dentro de `NucleusFrame`. |
| 150 | [`src/pages/cognitive/ActivityPage.tsx`](../../src/pages/cognitive/ActivityPage.tsx) | **ACTIVO** | Pantalla dual: en `Actividad` muestra `CognitiveTimeline` y eventos en RAM; en `Auditoría` consulta `audit_snapshot` y `diagnostic_snapshot` en Tauri para mostrar el libro inmutable R3 y el autodiagnóstico. |
| 151 | [`src/pages/cognitive/EvidenceFlowPage.tsx`](../../src/pages/cognitive/EvidenceFlowPage.tsx) | **ACTIVO** | Pantalla `Flujo` (`[02]`): despliega `CognitiveFlow` con su inspector de señales R3 y debajo `MemoryAssociations` para vínculos explícitos entre recuerdos. |
| 152 | [`src/pages/cognitive/InputDiagnostics.tsx`](../../src/pages/cognitive/InputDiagnostics.tsx) | **ACTIVO** | Panel diagnóstico interactivo de clasificación léxica local (`buildIdentificationSnapshot`) con modos en vivo, congelado y paso a paso sobre hasta 32 tokens. |
| 153 | [`src/pages/cognitive/InputIdentificationPage.tsx`](../../src/pages/cognitive/InputIdentificationPage.tsx) | **ACTIVO** | Pantalla inicial predeterminada (`Identificación`): aloja el canal principal `ConversationPage` y mantiene cerrados al pie los `<details>` secundarios de `InputDiagnostics` y `DocumentPreview`. |
| 154 | [`src/pages/cognitive/InputIdentificationPage.test.tsx`](../../src/pages/cognitive/InputIdentificationPage.test.tsx) | **ACTIVO (TEST)** | Verifica que la pantalla inicial priorice la conversación y mantenga colapsadas las herramientas secundarias por defecto. |
| 155 | [`src/pages/cognitive/NeuralVolumePage.tsx`](../../src/pages/cognitive/NeuralVolumePage.tsx) | **ACTIVO** | Pantalla `Volumen` (`[01]`): sincroniza asociaciones confirmadas y estado del grafo R8 en Tauri y renderiza el observatorio 3D `NeuralVolume`. |
| 156 | [`StateControlsHost.tsx`](../../src/components/cognitive/state-controls/StateControlsHost.tsx) | **ACTIVO** | Puente de la pantalla Dioxus con la sesión de React; el renderer Rust está en `crates/state-controls/src/ui.rs` y la vista React se conserva sólo como recuperación. |

### 4.2 `src/pages/conversation/` (`2` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 157 | [`src/pages/conversation/ConversationPage.tsx`](../../src/pages/conversation/ConversationPage.tsx) | **ACTIVO** | Panel central de chat con Alice: recuperación léxica automática e híbrida manual con Gemma (R8.3), cajón de autorización y revisión UTF-8 (`buildCloudPayloadReview`), voz manos libres y dictado por turno, visión multimodal (`ConversationVision`), revisión TTS (Fish Audio), evaluación RAG y propuestas de aprendizaje. |
| 158 | [`src/pages/conversation/ConversationPage.test.tsx`](../../src/pages/conversation/ConversationPage.test.tsx) | **ACTIVO (TEST)** | Amplia suite en Vitest que valida límites de historial visible, vigencia de ruta, candidatos híbridos, bloqueo de envío sin revisión previa, aprendizaje por turno y controles de voz. |

### 4.3 `src/pages/embodiment/` (`1` archivo)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 159 | [`src/pages/embodiment/AvatarPage.tsx`](../../src/pages/embodiment/AvatarPage.tsx) | **ACTIVO (`React.lazy`)** | Pantalla `Avatar` cargada diferidamente desde `App.tsx`: consulta `avatar_status` y `avatar_animation_status`, alimenta `AvatarViewer`, muestra licencia/huesos/materiales/expresiones de `Alice.vrm` y audita transiciones motoras manuales (`record_avatar_motor_transition`). |

### 4.4 `src/pages/governance/` (`5` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 160 | [`src/pages/governance/CapabilityRegistryPage.tsx`](../../src/pages/governance/CapabilityRegistryPage.tsx) | **ACTIVO (CON RAMA MUERTA)** | Pantalla `Puentes` que según `fixedView` muestra el inventario R1 + `PermissionGatewayPanel` (`"overview"`), `FaceTrackingPanel` (`"face"`) o `BodySolverPanel` (`"body"`). *Rama muerta:* conserva `{!fixedView && <div className="bridge-view-tabs">...}` (líneas 84–92) que jamás se ejecuta desde `App.tsx`. |
| 161 | [`src/pages/governance/ProcedureObserverPage.tsx`](../../src/pages/governance/ProcedureObserverPage.tsx) | **ACTIVO** | Pantalla `Procedimientos` (R5): cruza secuencias repetidas detectadas en R3 (`procedure_detection_status`) con decisiones humanas (`retain`/`dismiss`) y convierte candidatos vigentes en borradores R4 sin ejecución automática. |
| 162 | [`src/pages/governance/SkillWorkshopPage.tsx`](../../src/pages/governance/SkillWorkshopPage.tsx) | **ACTIVO** | Pantalla `Habilidades` (Taller R4): plantillas declarativas, edición/guardado de borradores con SHA-256, simulaciones estáticas sin efectos (`simulate_skill_plan`) y gobierno auditado del ciclo de vida. |
| 163 | [`src/pages/governance/SystemSettingsPage.tsx`](../../src/pages/governance/SystemSettingsPage.tsx) | **ACTIVO** | Pantalla `Configuración`: arranque y parada manual del servidor local de Gemma (`start_local_runtime` / `stop_local_runtime`), selección de proveedor/modelo predeterminado, interruptor de historial completo y diagnóstico de hardware/privacidad. |
| 164 | [`src/pages/governance/SystemSettingsPage.test.tsx`](../../src/pages/governance/SystemSettingsPage.test.tsx) | **ACTIVO (TEST)** | Verifica controles manuales de encendido/apagado de Gemma, interruptor de historial completo y nombre de modelo de solo lectura para `llamacpp`. |

### 4.5 `src/pages/memory/` y `src/pages/shared/` (`2` archivos)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 165 | [`src/pages/memory/MemoryVaultPage.tsx`](../../src/pages/memory/MemoryVaultPage.tsx) | **ACTIVO** | Bóveda integral `Memoria` en 7 pestañas (`records`, `working`, `profile`, `layers`, `review`, `consolidate`, `safety`): integra `AutomaticMemoryPanel`, búsqueda/filtrado, memoria de trabajo R6.2, perfil del propietario, capas R6.1, ciclo de vida R6.5, borrado con espera de 7 días, reconsolidación versionada, consolidación/restauración R6.3 y respaldos JSON. |
| 166 | [`src/pages/shared/nucleus-shared.tsx`](../../src/pages/shared/nucleus-shared.tsx) | **ACTIVO** | Marco compartido por `Volumen`, `Flujo`, `Estado` y `Planificador`: provee `useNucleusSnapshot` (sondeo serializado cada 5 s de `core_activity_snapshot`) y los componentes `NucleusFrame`, `NucleusPageHeader` y `NucleusProvenanceBand`. |

---

## 5. Hojas de estilo en `src/styles/` (`11` archivos)

Todas las hojas `.css` están importadas activamente, aunque **5 conservan selectores heredados** de paneles antiguos:

| # | Archivo | Estado | Qué estiliza (y qué selectores muertos conserva) |
|---:|---|---|---|
| 167 | [`src/styles/automatic-memory.css`](../../src/styles/automatic-memory.css) | **ACTIVO (LIMPIO)** | Tarjetas de recuerdos aprendidos automáticamente, formularios de corrección inline y barra `.conversation-learning-status`. |
| 168 | [`src/styles/base.css`](../../src/styles/base.css) | **ACTIVO (CON REGLAS HEREDADAS)** | Reset global, `.shell`, `.hero`, `.screen-tabs`, grillas de memoria y formularios base. *Reglas sin uso actual:* `.teaching-panel`, `.teaching-starters`, `.kind-grid`, `.session-overview`, `.reflection`, `.lobe`, `.focus-core`, `.neuro-node`. |
| 169 | [`src/styles/conversation-context.css`](../../src/styles/conversation-context.css) | **ACTIVO (CON 2 SELECTORES MUERTOS)** | Compositor de chat, cajón de contexto y presupuesto UTF-8, RAG híbrido, reproductor de voz y tarjetas emocionales. *Sin uso:* `.conversation-history-gate`, `.voice-turn-steps`. |
| 170 | [`src/styles/conversation-home.css`](../../src/styles/conversation-home.css) | **ACTIVO (CON 1 SELECTOR MUERTO)** | Pantalla inicial centrada en conversación, barra manos libres, selector de micrófono y paneles colapsables. *Sin uso:* `.audio-focus-option`. |
| 171 | [`src/styles/conversation-vision.css`](../../src/styles/conversation-vision.css) | **ACTIVO (LIMPIO)** | Controles de sesión visual multimodal, selector de cámara, previsualización de fotogramas/escritorio y aviso `.conversation-delegated-actions`. |
| 172 | [`src/styles/industrial-theme.css`](../../src/styles/industrial-theme.css) | **ACTIVO (CON BLOQUES HEREDADOS)** | Tema oscuro industrial cian/ámbar del observatorio cognitivo, avatar y gobernanza. *Bloques heredados de paneles huérfanos/retirados:* `.learning-candidate-*`, `.sensory-*`, `.sensor-*`, `.neuro-view-icon`, `.neuro-view-tabs`, `.bridge-view-tabs`, `.brain-node-strip`, `.teaching-panel`, `.provider-picker`, `.social-hypotheses`. |
| 173 | [`src/styles/interaction-affordance.css`](../../src/styles/interaction-affordance.css) | **ACTIVO (CON REFS MENORES)** | Estados interactivos unificados (`:hover`, `:active`, `:focus-visible`, `:disabled`), barra compacta v2 de navegación SVG y responsividad. *Referencias antiguas puntuales:* `.neuro-view-tabs`, `.identification-injector`. |
| 174 | [`src/styles/memory-records.css`](../../src/styles/memory-records.css) | **ACTIVO (LIMPIO)** | `@container memory-records` para distribuir sin solapamientos metadatos, citas de evidencia y acciones de gobierno de cada tarjeta de memoria. |
| 175 | [`src/styles/settings-runtime.css`](../../src/styles/settings-runtime.css) | **ACTIVO (LIMPIO)** | Botones semánticos de alto contraste (`.runtime-start` y `.runtime-stop`) para el motor local de Gemma en `SystemSettingsPage`. |
| 176 | [`src/styles/task-engine.css`](../../src/styles/task-engine.css) | **ACTIVO (LIMPIO)** | Tarjetas del reloj interno R7.3-A (`.task-clock`), chequeos R7.5 y filas de reserva/despacho R7.3-B (`.task-reserve-row`). |
| 177 | [`src/styles/task-registry.css`](../../src/styles/task-registry.css) | **ACTIVO (LIMPIO)** | Formulario de creación de recordatorios únicos, vista previa verificada con SHA-256 y lista local de tareas R7. |

---

## 6. Declaraciones TypeScript en `src/types/` (`1` archivo)

| # | Archivo | Estado | Qué hace exactamente |
|---:|---|---|---|
| 178 | [`src/types/icon-assets.d.ts`](../../src/types/icon-assets.d.ts) | **ACTIVO** | Declaración de módulo TypeScript (`declare module "*.svg?raw"`) incluida por `tsconfig.app.json` para importar los activos SVG versionados del sistema de iconos como cadenas de texto tipadas. |

