# 06 · Documentación (`docs/`), estructura de `data/` y carpeta `local/`

Fecha de verificación: 2026-11-06  
Cobertura: todos los documentos de `docs/` (**249 archivos previos a este catálogo**), la estructura completa de almacenamiento en tiempo de ejecución de `data/` (**45 archivos + 4 carpetas vacías**, inspeccionados únicamente por estructura/metadatos respetando 100 % la privacidad de los recuerdos) y el desglose íntegro de `local/` (`assets/`, `drafts/`, `reference-adapters/`, `artifacts/` y `venv/`).

Volver al índice: [`README.md`](README.md) · Ver hallazgos de limpieza: [`01-auditoria-basura-y-huerfanos.md`](01-auditoria-basura-y-huerfanos.md)

---

## 1. Raíz de `docs/` (`9` archivos previos a esta carpeta)

| Archivo | Estado | Qué contiene |
|---|---|---|
| [`docs/Analisis_Estado_Proyecto_2026-08-19.docx`](../Analisis_Estado_Proyecto_2026-08-19.docx) | **BASURA / OBSOLETO (1,22 MB)** | Informe binario en Word del 19–20 de agosto de 2026 con capturas incrustadas sobre la antigua etapa *Alice Cognitive Core* (hasta `ADR-P-074` y R5). Huérfano y desactualizado. |
| [`docs/analysis_results.md`](../analysis_results.md) | **BASURA / OBSOLETO** | Volcado genérico del 18 de agosto de 2026 sobre el commit `8b9dc9c` (*Alice Cognitive Core*, 46 ADRs). Además sobrescribió un análisis previo del 10 de agosto citado en `REVIEW_OPENCLAW_TENCENT_2026-08-10.md`, quedando engañoso y sin uso. |
| [`docs/analisis_estado_seguridad.md`](../analisis_estado_seguridad.md) | **HISTÓRICO SUPERADO PARCIALMENTE** | Auditoría del 4 de octubre de 2026 (`e8158c8`). Varios hallazgos ya se resolvieron (`memory.rs` modularizado en `ADR-P-108`, `.venv-adapters` movido a `local/venv` en `ADR-P-109`, rollback en `ADR-P-111`, bloqueo HTTP 403 en Vite en `ADR-P-112`), aunque conserva contexto histórico de CSP/cifrado en reposo. |
| [`docs/CONTEXTO_RECUPERADO_2026-11-03.md`](../CONTEXTO_RECUPERADO_2026-11-03.md) | **ACTIVO** | Bitácora de recuperación de contexto tras pérdida de chats, documentando el estado desde `e8158c8` hasta inicios de noviembre. |
| [`docs/especificacion_alice_continuum.html`](../especificacion_alice_continuum.html) | **ACTIVO (DOCUMENTO MAESTRO)** | Especificación técnica e interactiva consolidada de 20 secciones (portada, RF/RNF, arquitectura, memoria, seguridad, runbooks, pruebas, trazabilidad e historial de versiones). |
| [`docs/evaluacion_frameworks_ia_asistente.md`](../evaluacion_frameworks_ia_asistente.md) | **ACTIVO** | Evaluación comparativa del stack de Alice frente a los frameworks habituales de una IA asistente moderna (`sqlite-vec`, ONNX/VAD/TTS, streaming + AEC, MCP). |
| [`docs/evaluacion_hardware_economico_backend.md`](../evaluacion_hardware_economico_backend.md) | **ACTIVO** | Análisis de backend Rust vs. Node.js y perfiles recomendados de inferencia/voz para equipos económicos (GTX 1050 2–4 GB o sin GPU dedicada). |
| [`docs/MANUAL_DE_USO.md`](../MANUAL_DE_USO.md) | **ACTIVO** | Manual operativo completo en español para usar conversación escrita y oral, espera por nombre, pausa, RNNoise, Whisper, visión, acciones multimedia y memoria. |
| [`docs/README.md`](../README.md) | **ACTIVO (ÍNDICE CON HUECOS)** | Índice central de documentación. *Nota:* tiene el número `76.` repetido y deja sin enlazar varios ADRs e informes recientes. |

---

## 2. `docs/architecture/` (`20` archivos)

- [`ADAPTER_QUARANTINE.md`](../architecture/ADAPTER_QUARANTINE.md): Estado de cuarentena de los 12 adaptadores Python de referencia y rescate aislado de `document_reader.py` *(cita aún la ruta antigua `adapters/`)*.
- [`AFFECTIVE_SIMULATION_DESIGN.md`](../architecture/AFFECTIVE_SIMULATION_DESIGN.md): Diseño de la simulación cognitivo-afectiva explicable de 10 canales emocionales.
- [`ALICE_ORIGINAL_VOICE_DESIGN_R9.md`](../architecture/ALICE_ORIGINAL_VOICE_DESIGN_R9.md): Prompt y protocolo de selección para diseñar una voz propia de Alice en Fish Audio.
- [`ALICE_VOICE_IDENTITY_R9.md`](../architecture/ALICE_VOICE_IDENTITY_R9.md): Criterios de identidad vocal femenina en español neutro latinoamericano para R9.2.
- [`CAPABILITY_REGISTRY_R1.md`](../architecture/CAPABILITY_REGISTRY_R1.md): Contrato declarativo del Registro de Capacidades R1 *(su tabla lista las 26 capacidades iniciales frente a las ~42 actuales)*.
- [`CODE_REVIEW_2026-11-05.md`](../architecture/CODE_REVIEW_2026-11-05.md): Revisión estructural de código del 5 de noviembre (hallazgos P1 y P2 luego corregidos en `ADR-P-111`).
- [`CODE_REVIEW_INVENTORY_2026-11-05.md`](../architecture/CODE_REVIEW_INVENTORY_2026-11-05.md): Inventario tabular de líneas y estado de lectura de los 297 archivos inspeccionados el 5 de noviembre.
- [`CONSOLIDATION_PREVIEW_R6.md`](../architecture/CONSOLIDATION_PREVIEW_R6.md): Arquitectura R6.3 de detección de duplicados, decisión `keepSeparate`, ensayo y recibo transaccional de consolidación.
- [`CONTINUUM_IDENTITY.md`](../architecture/CONTINUUM_IDENTITY.md): Distinción entre la plataforma *Alice Continuum* y el personaje *Alice*, más compatibilidad de rutas heredadas.
- [`GOVERNED_PROCEDURE_CANDIDATE_R5.md`](../architecture/GOVERNED_PROCEDURE_CANDIDATE_R5.md): Diseño R5.1–R5.5 de detección de procedimientos repetidos sobre R3 y conversión gobernada a borrador R4.
- [`KNOWLEDGE_GRAPH_R8.md`](../architecture/KNOWLEDGE_GRAPH_R8.md): Arquitectura R8 del grafo nativo de referencias y asociaciones con evidencia literal (`associations-v1`).
- [`LAYERED_MEMORY_R6.md`](../architecture/LAYERED_MEMORY_R6.md): Proyección reversible de memoria por capas (`layer-index-v3.json`) sin alterar `records.json`.
- [`LEARNING_CANDIDATES_R6.md`](../architecture/LEARNING_CANDIDATES_R6.md): Diseño histórico R6.4 de candidatos de aprendizaje local con Ollama *(hoy desplazado en UI activa por `conversation_learning.rs` con Gemma)*.
- [`MEMORY_SYSTEM.md`](../architecture/MEMORY_SYSTEM.md): Especificación general vigente del sistema de memoria confirmada y automática.
- [`PERMISSION_GATEWAY_R2.md`](../architecture/PERMISSION_GATEWAY_R2.md): Contrato de la esclusa nativa de permisos efímeros R2 por denegación predeterminada.
- [`PROJECT_STRUCTURE.md`](../architecture/PROJECT_STRUCTURE.md): Mapa de carpetas y módulos del repositorio tras la reorganización y modularización.
- [`SKILL_MANIFEST_R4.md`](../architecture/SKILL_MANIFEST_R4.md): Contrato declarativo de manifiestos locales de habilidades R4 (`simulationOnly`), simulador y ciclo de vida.
- [`TASK_INTENT_REGISTRY_R7.md`](../architecture/TASK_INTENT_REGISTRY_R7.md): Arquitectura R7 del registro gobernado de tareas, motor temporal, `attempt-ledger-v1.json` y notificaciones.
- [`UNIFIED_AUDIT_R3.md`](../architecture/UNIFIED_AUDIT_R3.md): Contrato de la bitácora JSONL unificada R3 (`events-v1.jsonl`), diagnóstico pasivo y actividad del Núcleo.
- [`WORKING_MEMORY_R6.md`](../architecture/WORKING_MEMORY_R6.md): Diseño de la memoria de trabajo efímera en RAM y presupuesto saliente de contexto.

---

## 3. `docs/assets/` (`7` archivos)

- [`alice-documento.css`](../assets/alice-documento.css): Hoja de estilos HUD oscura e impresión para `especificacion_alice_continuum.html`.
- [`diagrams/01-contexto-sistema.svg`](../assets/diagrams/01-contexto-sistema.svg): Diagrama SVG D-01 de contexto general del sistema.
- [`diagrams/02-componentes.svg`](../assets/diagrams/02-componentes.svg): Diagrama SVG D-02 de capas y componentes React / Rust / Datos.
- [`diagrams/03-casos-de-uso.svg`](../assets/diagrams/03-casos-de-uso.svg): Diagrama SVG D-03 con los 10 casos de uso principales del propietario.
- [`diagrams/04-secuencia-conversacion.svg`](../assets/diagrams/04-secuencia-conversacion.svg): Diagrama SVG D-04 de secuencia de conversación autorizada.
- [`diagrams/05-ciclo-memoria.svg`](../assets/diagrams/05-ciclo-memoria.svg): Diagrama SVG D-05 del ciclo de memoria enseñable y repaso.
- [`diagrams/06-modelo-datos.svg`](../assets/diagrams/06-modelo-datos.svg): Diagrama SVG D-06 del modelo lógico de almacenes e índices locales.

---

## 4. `docs/plans/` (`12` archivos), `docs/research/` (`9` archivos) y `docs/runbooks/` (`4` archivos)

### `docs/plans/` (`12` archivos)
- [`AFECTO_VOLUMEN.md`](../plans/AFECTO_VOLUMEN.md): Plan para diferenciar memoria real, actividad R3 y afecto futuro en el Volumen Cognitivo.
- [`backend-modularization.md`](../plans/backend-modularization.md): Plan inicial de división modular de `lib.rs` y vistas React.
- [`identity-migration.md`](../plans/identity-migration.md): Plan histórico de migración de `Proyecto P` a `Alice Cognitive Core`.
- [`R1-capability-registry.md`](../plans/R1-capability-registry.md): Plan de ingeniería de la Fase R1 (Registro de capacidades).
- [`R2-permission-gateway.md`](../plans/R2-permission-gateway.md): Plan de ingeniería de la Fase R2 (Gateway de permisos y leases sensoriales).
- [`R3-unified-audit.md`](../plans/R3-unified-audit.md): Plan de ingeniería de la Fase R3 (Auditoría unificada y diagnóstico pasivo).
- [`R4-skill-workshop.md`](../plans/R4-skill-workshop.md): Plan de ingeniería de la Fase R4 (Taller de habilidades y simulación estática).
- [`R5-governed-procedure-learning.md`](../plans/R5-governed-procedure-learning.md): Plan de ingeniería de la Fase R5 (Aprendizaje gobernado de procedimientos).
- [`R6-layered-memory.md`](../plans/R6-layered-memory.md): Plan maestro de la Fase R6 (Memoria por capas, trabajo RAM, consolidación y ciclo funcional).
- [`R7-tasks-intentions.md`](../plans/R7-tasks-intentions.md): Plan de ingeniería de la Fase R7 (Registro de tareas, sentido temporal y notificaciones).
- [`R8-knowledge-graph.md`](../plans/R8-knowledge-graph.md): Plan de ingeniería de la Fase R8 (Grafo de conocimiento y asociaciones).
- [`R9-presence-voice-body.md`](../plans/R9-presence-voice-body.md): Plan vigente de la Fase R9 (Conversación oral, voz, percepción y aplazamiento corporal).

### `docs/research/` (`9` archivos)
- [`ADAPTER_STATIC_AUDIT_2026-09-04.md`](../research/ADAPTER_STATIC_AUDIT_2026-09-04.md): Auditoría estática AST y SHA-256 de los 12 scripts Python puestos en cuarentena.
- [`ALICE_FISH_VOICE_SHORTLIST_2026-09-12.md`](../research/ALICE_FISH_VOICE_SHORTLIST_2026-09-12.md): Preselección histórica de tres voces públicas en Fish Audio luego descartadas.
- [`CHROMADB_FIT_EVALUATION_2026-09-15.md`](../research/CHROMADB_FIT_EVALUATION_2026-09-15.md): Evaluación que descarta ChromaDB como memoria primaria y elige `intfloat/multilingual-e5-small` para futuro índice derivado.
- [`FISH_AUDIO_R9_PRECHECK_2026-09-12.md`](../research/FISH_AUDIO_R9_PRECHECK_2026-09-12.md): Prechequeo técnico de API, costos y privacidad de Fish Audio.
- [`FRAMEWORKS_REVIEW_2026-11-06.md`](../research/FRAMEWORKS_REVIEW_2026-11-06.md): Revisión crítica interna sobre `evaluacion_frameworks_ia_asistente.md` y registro del endurecimiento HTTP 403 en Vite.
- [`HUMAN_MEMORY_FUNCTIONAL_MODEL_2026-08-21.md`](../research/HUMAN_MEMORY_FUNCTIONAL_MODEL_2026-08-21.md): Investigación funcional sobre memoria humana aplicada a los procesos R6.5 de Alice.
- [`LOCAL_MODEL_INVENTORY_2026-08-20.md`](../research/LOCAL_MODEL_INVENTORY_2026-08-20.md): Inventario de los 7 modelos locales instalados en `E:\Ollama\models` y candidatos externos.
- [`REVIEW_AIRI_2026-08-13.md`](../research/REVIEW_AIRI_2026-08-13.md): Revisión de referencia del proyecto `moeru-ai/airi` para patrones VRM y audio.
- [`REVIEW_OPENCLAW_TENCENT_2026-08-10.md`](../research/REVIEW_OPENCLAW_TENCENT_2026-08-10.md): Revisión comparativa sobre OpenClaw y TencentDB Agent Memory.

### `docs/runbooks/` (`4` archivos)
- [`01-arranque-local.md`](../runbooks/01-arranque-local.md): Guía paso a paso de prerrequisitos y arranque local en Windows.
- [`02-operar-memoria.md`](../runbooks/02-operar-memoria.md): Procedimiento operativo para respaldar, exportar y restaurar memoria de forma segura.
- [`03-conversacion-y-voz.md`](../runbooks/03-conversacion-y-voz.md): Guía cotidiana de sesión oral, micrófono, visión, música delegada y evaluación de prompts.
- [`04-ubuntu.md`](../runbooks/04-ubuntu.md): Instalación, variables `ALICE_*` y matriz de compatibilidad en Ubuntu LTS.

---

## 5. `docs/decisions/` (`85` archivos: `README.md` + `84` ADRs)

- [`decisions/README.md`](../decisions/README.md): Índice cronológico de decisiones de arquitectura *(nota: omite listar `ADR-P-089`, `090` y `091`)*.
- `ADR-P-029-almacenamiento-de-memoria-v1.md`: Formato JSON local v1 de memoria, manifiesto y límites *(ubicación luego movida por `030`)*.
- `ADR-P-030-datos-locales-en-disco-e.md`: Fija `E:\Alice Cognitive Core\data` como raíz activa de datos.
- `ADR-P-031-camara-interactiva-volumen-neuronal.md`: Rotación, paneo y zoom interactivos en el Volumen Cognitivo 3D.
- `ADR-P-032-visor-vrm-local.md`: Visor local privado de solo lectura para `Alice.vrm`.
- `ADR-P-033-consolidacion-y-repaso-local.md`: Cola local verificable de consolidación y repaso espaciado.
- `ADR-P-034-refuerzo-por-recuperacion-autorizada.md`: Refuerzo de estabilidad cuando un recuerdo es recuperado con permiso en conversación.
- `ADR-P-035-ensenanza-guiada-inicial.md`: Plantillas iniciales de enseñanza guiada sin sembrar recuerdos falsos.
- `ADR-P-036-emblema-estatico-de-alice.md`: Emblema HUD inicial para favicon e icono `.ico`.
- `ADR-P-037-iconos-de-actividad-y-nucleo.md`: Primer rediseño de iconos SVG para Actividad y Núcleo.
- `ADR-P-038-backend-rust-modular.md`: Primera separación modular de `src-tauri/src/lib.rs`.
- `ADR-P-039-documento-maestro-formal.md`: Estructura formal del documento maestro `especificacion_alice_continuum.html`.
- `ADR-P-040-diagramas-svg-autonomos.md`: Incorporación de los 6 diagramas SVG autónomos en `docs/assets/diagrams/`.
- `ADR-P-041-registro-de-capacidades.md`: Creación del Registro declarativo de Capacidades R1.
- `ADR-P-042-identidad-alice-cognitive-core.md`: Adopción histórica de *Alice Cognitive Core* *(reemplazada en nombre por `ADR-P-095`)*.
- `ADR-P-043-aprendizaje-sensorial-gobernado.md`: Reglas de aprendizaje sensorial gobernado sin persistir crudos biométricos.
- `ADR-P-044-gateway-permisos-nativo.md`: Gateway nativo R2 de permisos efímeros con denegación por defecto.
- `ADR-P-045-auditoria-unificada-local.md`: Bitácora unificada R3 (`events-v1.jsonl`) y diagnóstico pasivo.
- `ADR-P-046-paleta-afectiva-y-volumen-cognitivo.md`: Paleta afectiva de 10 emociones y separación estructura/actividad en el volumen.
- `ADR-P-047-actividad-efimera-del-nucleo-desde-r3.md`: Derivación de pulsos del Núcleo desde eventos reales R3.
- `ADR-P-048-manifiesto-local-de-habilidades.md`: Esquema cerrado R4.1 de manifiestos de habilidades sin código ejecutable.
- `ADR-P-049-almacen-local-borradores.md`: Almacén verificable de borradores de habilidades R4.2.
- `ADR-P-050-simulacion-estatica-de-habilidades.md`: Simulador estático de habilidades R4.3 contra R1 sin efectos reales.
- `ADR-P-051-ciclo-de-vida-inmutable-de-habilidades.md`: Transiciones inmutables del ciclo de vida R4.4.
- `ADR-P-052-fronteras-mente-cuerpo-gobierno.md`: Separación arquitectónica en *Cognitive Core*, *Body Solver* y *Governance Core*.
- `ADR-P-053-sistema-iconos-isometricos-3d.md`: Experimento de iconos isométricos 3D *(reemplazada por `054`/`064`)*.
- `ADR-P-054-sistema-iconos-holograficos-planos.md`: Experimento de iconos holográficos planos *(reemplazada por `063`/`064`)*.
- `ADR-P-055-candidatos-procedimientos-auditados.md`: Contrato R5.1 de candidatos de procedimientos sustentados en R3.
- `ADR-P-056-prueba-manual-dualsense-avatar.md`: Control manual de prueba con mando DualSense en el visor VRM.
- `ADR-P-057-detector-conservador-procedimientos.md`: Detector efímero R5.2 de secuencias repetidas en auditoría R3.
- `ADR-P-058-locomocion-retargeteada-con-activos-compatibles.md`: Locomoción VRM con clips Mixamo excluyendo licencias UnityChan.
- `ADR-P-059-maquina-estados-corporal-local.md`: Máquina de 7 estados motores locales para el visor corporal.
- `ADR-P-060-telemetria-motora-y-detalle-superficial.md`: Telemetría R3 de cambios de estado motor y relieve superficial en ropa VRM.
- `ADR-P-061-almacen-decisiones-procedimientos.md`: Almacén R5.3 de decisiones explícitas `retain`/`dismiss` sobre procedimientos.
- `ADR-P-062-conversion-procedimiento-borrador.md`: Conversión única y trazable R5.4 de procedimiento retenido a borrador R4.
- `ADR-P-063-sistema-cyber-glyph-v2.md`: Experimento de iconos *Cyber Glyph V2* *(reemplazada por `064`)*.
- `ADR-P-064-pantallas-cognitivas-e-iconos-cyrcetech.md`: Separación de 4 pantallas cognitivas y adopción del sistema definitivo de iconos técnicos.
- `ADR-P-065-cierre-r5-vigencia-evidencia.md`: Cierre R5.5 diferenciando evidencia R3 vigente vs. histórica fuera de ventana.
- `ADR-P-066-proyeccion-memoria-por-capas.md`: Proyección derivada y reversible de memoria por capas R6.1.
- `ADR-P-067-memoria-trabajo-y-panel-entrada.md`: Memoria de trabajo efímera en RAM R6.2 y panel de entrada inicial.
- `ADR-P-068-vista-previa-consolidacion-manual.md`: Vista previa de solo lectura R6.3-A de posibles recuerdos duplicados.
- `ADR-P-069-resolucion-mantener-separados.md`: Resolución auditada `keepSeparate` R6.3-B sobre candidatos duplicados.
- `ADR-P-070-volumen-neural-compacto-evolutivo.md`: Volumen neural compacto centralizado y trazable.
- `ADR-P-071-sonda-facial-webcam-local.md`: Sonda diagnóstica aislada con MediaPipe Face Landmarker por webcam.
- `ADR-P-072-permiso-facial-r2-separado.md`: Perfil R2 crítico e independiente para `perception.face.landmarks`.
- `ADR-P-073-catalogo-expresiones-vrm-solo-lectura.md`: Lectura en solo lectura del catálogo real de expresiones de `Alice.vrm`.
- `ADR-P-074-aprendizaje-episodico-conversacional.md`: Primer incremento R6.4-A de aprendizaje episódico *(ajustado luego por `087`)*.
- `ADR-P-075-plan-fusion-duplicados-exactos.md`: Vista previa manual R6.3-C de plan de fusión de duplicados exactos.
- `ADR-P-076-ensayo-recuperacion-fusion.md`: Ensayo físico de respaldo y restauración R6.3-D previo a fusiones.
- `ADR-P-077-recibo-durable-recuperacion-reinicio.md`: Recibo transaccional durable R6.3-E para recuperación tras reinicio.
- `ADR-P-078-estado-restauracion-gobernada.md`: Restauración gobernada R6.3-F manteniendo desactivada la fusión destructiva.
- `ADR-P-079-inferencia-ollama-loopback.md`: Adaptador local de Ollama restringido a `127.0.0.1`.
- `ADR-P-080-contexto-rag-local.md`: Ampliación de contexto RAG local y pausa reversible de OpenRouter.
- `ADR-P-081-observacion-visual-local-revisable.md`: Observación visual revisable inicial *(desplazada luego en conversación por `102`)*.
- `ADR-P-082-candidatos-aprendizaje-local.md`: Extracción local R6.4-B de candidatos desde episodios con Ollama.
- `ADR-P-083-confirmacion-transaccional-aprendizaje.md`: Confirmación transaccional R6.4-C en Rust verificando cita literal.
- `ADR-P-084-memoria-funcional-y-volumen-trazable.md`: Ciclo funcional R6.5 (vigencia, latencia, supresión, reconsolidación y trazabilidad).
- `ADR-P-085-registro-tareas-intenciones-solo-lectura.md`: Contrato inicial de solo lectura R7.1 de tareas e intenciones.
- `ADR-P-086-persistencia-gobernada-tareas.md`: Alta y cancelación gobernadas por SHA-256 en `tasks-v1.json` (R7.2).
- `ADR-P-087-conversacion-temporal-sin-consolidacion-automatica.md`: Evita promover cada turno de chat a episodio duradero sin revisión.
- `ADR-P-088-sentido-temporal-observable-r7.md`: Proyección temporal observable (`waiting` vs `due`) en R7.3-A.
- `ADR-P-089-reservas-durables-de-despacho-r7.md`: Libro durable `attempt-ledger-v1.json` para reservas idempotentes (R7.3-B).
- `ADR-P-090-entrega-local-idempotente-r7.md`: Entrega idempotente de recordatorios mediante notificaciones nativas (R7.4).
- `ADR-P-091-historial-conversacion-durable.md`: Historial durable de conversación en `data/conversation/history-v1.json`.
- `ADR-P-092-comprobacion-r7-5-solo-lectura.md`: Comprobación R7.5 en lectura de elegibilidad R1/R2 desde Planificador.
- `ADR-P-093-referencias-nativas-grafo-r8.md`: Proyección inicial R8.1 del grafo nativo de referencias sobre `records.json`.
- `ADR-P-094-puentes-de-presencia-voz-y-cuerpo.md`: Contrato desacoplado R9.1 para puentes unidireccionales de voz, sensores y cuerpo.
- `ADR-P-095-identidad-alice-continuum.md`: Adopción oficial de la identidad *Alice Continuum*.
- `ADR-P-096-prioridad-conversacional-y-voz-contextual.md`: Prioridad en fiabilidad conversacional y voz antes de conectar el avatar.
- `ADR-P-097-conversacion-por-turnos-de-voz.md`: Primer flujo manual por turnos de voz con Gemma 4 y Fish Audio.
- `ADR-P-098-inicio-centrado-en-conversacion.md`: Establece *Conversación* como pantalla principal de arranque.
- `ADR-P-099-sesion-de-voz-y-node-26.md`: Sesión automática continua de voz y actualización a Node 26.13 LTS.
- `ADR-P-100-referentes-parada-de-voz-rust.md`: Distinción de referentes Carlos/Alice/terceros, parada oral y Rust 1.99.1.
- `ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md`: Memoria automática conversacional (`automatic-v1.json`) y volumen orgánico cerebral.
- `ADR-P-102-vision-conversacional-local.md`: Integración de cámara seleccionable y escritorio compartido en Conversación con Gemma.
- `ADR-P-103-actividad-y-herramientas-delegadas.md`: Latido inicial de nodos técnicos y apertura delegada de Spotify y unidades `D:`/`E:`.
- `ADR-P-104-musica-spotify-youtube-chrome.md`: Reproducción/control delegado de Spotify y YouTube en Chrome.
- `ADR-P-105-supresion-local-ruido-vite.md`: Supresión de ruido local con RNNoise WASM y actualización a Vite 8.3.5.
- `ADR-P-106-estabilizacion-oral-y-rumbo-nerumi.md`: Incorporación de Whisper CPU local para español y exclusión de domótica.
- `ADR-P-107-contratos-conversacion-y-sondeos.md`: Extracción de contratos TS de conversación y sondeos serializados sin solapamiento.
- `ADR-P-108-memoria-modular-react-19-3.md`: División modular de `memory.rs` en `src-tauri/src/memory/` y actualización a React 19.3.1.
- `ADR-P-109-organizacion-local-y-ubuntu.md`: Agrupación de recursos privados en `local/` y soporte base para Ubuntu.
- `ADR-P-110-referencias-explicitas-en-citas.md`: Resolución local determinista de posesivos en citas con destinatario explícito.
- `ADR-P-111-persistencia-y-control-del-motor.md`: Rollback transaccional en memoria básica y cancelación inmediata de peticiones HTTP a Gemma.
- `ADR-P-112-espera-por-nombre-y-apagado.md`: Modo de espera oral activado al decir «Alice», pausa por voz, apagado explícito de micrófono y bloqueo HTTP 403 en servidor Vite.

---

## 6. `docs/testing/` (`103` informes de validación)

Todos los informes de evidencia verificada por fase e incremento:

- **Conversación, voz, visión, música y fiabilidad reciente (R9):** `ACTIVITY_DESKTOP_TOOLS_REPORT_2026-11-03.md`, `AUTOMATIC_MEMORY_VOLUME_REPORT_2026-11-03.md`, `CONVERSATION_HISTORY_REPORT_2026-09-04.md`, `CONVERSATION_HOME_REPORT_2026-11-03.md`, `CONVERSATION_ICON_REPORT_2026-11-04.md`, `CONVERSATION_REFERENCES_REPORT_2026-11-05.md`, `CONVERSATION_SESSION_REPORT_2026-11-04.md`, `CONVERSATION_VISION_REPORT_2026-11-03.md`, `MEDIA_PLAYBACK_REPORT_2026-11-03.md`, `MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md`, `MEMORY_MODULAR_REACT_REPORT_2026-11-04.md`, `ORGANIZATION_UBUNTU_REPORT_2026-11-04.md`, `R9_HANDS_FREE_NODE26_REPORT_2026-11-03.md`, `R9_REFERENCES_VOICE_STOP_RUST_REPORT_2026-11-03.md`, `R9_VOICE_TURNS_REPORT_2026-11-03.md`, `RELIABILITY_REPORT_2026-11-05.md`, `VOICE_NOISE_VITE_REPORT_2026-11-04.md`, `VOICE_STANDBY_REPORT_2026-11-06.md`, `VOICE_TURN_PILOT_2026-09-05.md`.
- **Evaluaciones locales Gemma / Ollama / `llama.cpp`:** `GEMMA_HUMAN_AUDIO_2026-09-05.md`, `GEMMA_LOCAL_EVALUATION_2026-09-05.md`, `GEMMA_MEMORY_PILOT_2026-09-05.md`, `GEMMA_QWEN_CONTINUITY_2026-09-05.md`, `GEMMA_SETTINGS_CHAT_2026-09-05.md`, `LLAMA_GEMMA_EVALUATION_2026-09-05.md`, `LOCAL_OLLAMA_ADAPTER_REPORT_2026-08-20.md`, `LOCAL_RAG_VISUAL_LEARNING_REPORT_2026-08-20.md`, `NATIVE_LOCAL_RUNTIME_2026-09-05.md`.
- **Base inicial, identidad, iconos, UI y documento maestro:** `AFFECTIVE_VOLUME_VISUAL_REPORT_2026-08-09.md`, `BACKEND_MODULARIZATION_REPORT_2026-08-08.md`, `COGNITIVE_SCREENS_AND_ICON_SYSTEM_REPORT_2026-08-12.md`, `CONSOLIDATION_REPORT_2026-08-07.md`, `CONTINUUM_REBRAND_REPORT_2026-09-17.md`, `CYBER_GLYPH_V2_REPORT_2026-08-11.md` *(histórico superado)*, `DOCUMENT_PRESENTATION_REPORT_2026-11-04.md`, `FLAT_HOLOGRAPHIC_ICON_SYSTEM_REPORT_2026-08-11.md` *(histórico superado)*, `GUIDED_TEACHING_ICON_REPORT_2026-08-08.md`, `HARDWARE_INPUT_READINESS_REPORT_2026-08-09.md`, `IDENTITY_MIGRATION_REPORT_2026-08-08.md`, `ISOMETRIC_ICON_SYSTEM_REPORT_2026-08-11.md` *(histórico superado)*, `MASTER_DOCUMENT_REPORT_2026-08-08.md`, `NEURAL_VOLUME_COMPACT_REPORT_2026-08-15.md`, `RECALL_REINFORCEMENT_REPORT_2026-08-08.md`, `TEST_REPORT_2026-08-07.md`, `WIDE_LAYOUT_REPORT_2026-08-09.md`.
- **Avatar VRM y preparación facial:** `AVATAR_BODY_STATE_MACHINE_REPORT_2026-08-11.md`, `AVATAR_EXPRESSION_CATALOG_REPORT_2026-08-16.md`, `AVATAR_LOCOMOTION_APPEARANCE_REPORT_2026-08-11.md`, `AVATAR_MOTOR_R3_SURFACE_REPORT_2026-08-11.md`, `AVATAR_REFERENCE_ANALYSIS_2026-08-11.md`, `AVATAR_REPORT_2026-08-07.md`, `DUALSENSE_MANUAL_AVATAR_REPORT_2026-08-11.md`, `FACE_LANDMARKER_READINESS_REPORT_2026-08-15.md`, `FACE_READINESS_PANEL_REPORT_2026-08-16.md`.
- **Fases R1 a R5 (Capacidades, Permisos, Auditoría, Habilidades y Procedimientos):** `R1_CAPABILITY_REGISTRY_REPORT_2026-08-09.md`, `R1_FACE_CAPABILITY_CONTRACT_REPORT_2026-08-16.md`, `R2_FACE_PERMISSION_CONTRACT_REPORT_2026-08-16.md`, `R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md`, `R2_SENSOR_LEASE_REPORT_2026-08-09.md`, `R3_AUDIT_FOUNDATION_REPORT_2026-08-09.md`, `R3_CORE_ACTIVITY_REPORT_2026-08-09.md`, `R3_MEMORY_CLOUD_AUDIT_REPORT_2026-08-09.md`, `R3_PASSIVE_DIAGNOSTIC_REPORT_2026-08-09.md`, `R3_PERMISSION_AUDIT_REPORT_2026-08-09.md`, `R4_LIFECYCLE_AUDIT_REPORT_2026-08-10.md`, `R4_SKILL_DRAFT_STORE_REPORT_2026-08-09.md`, `R4_SKILL_MANIFEST_REPORT_2026-08-09.md`, `R4_SKILL_SIMULATION_REPORT_2026-08-10.md`, `R4_VISIBLE_WORKSHOP_REPORT_2026-08-10.md`, `R5_CLOSEOUT_REPORT_2026-08-13.md`, `R5_PROCEDURE_CANDIDATE_REPORT_2026-08-11.md`, `R5_PROCEDURE_DECISION_STORE_REPORT_2026-08-11.md`, `R5_PROCEDURE_DETECTOR_REPORT_2026-08-11.md`, `R5_PROCEDURE_DRAFT_CONVERSION_REPORT_2026-08-11.md`.
- **Fase R6 (Memoria por capas, trabajo RAM y consolidación):** `MEMORY_RAG_EVIDENCE_BOUNDARY_REPORT_2026-09-04.md`, `OBSIDIAN_MARKDOWN_CATALOG_REPORT_2026-08-16.md`, `R6_CLOSEOUT_AUDIT_2026-08-24.md`, `R6_CLOSEOUT_REPORT_2026-09-01.md`, `R6_CONSOLIDATION_GOVERNED_RESTORE_REPORT_2026-08-20.md`, `R6_CONSOLIDATION_MERGE_PREVIEW_REPORT_2026-08-20.md`, `R6_CONSOLIDATION_PREVIEW_REPORT_2026-08-15.md`, `R6_CONSOLIDATION_RECOVERY_REHEARSAL_REPORT_2026-08-20.md`, `R6_CONSOLIDATION_RESOLUTION_REPORT_2026-08-15.md`, `R6_CONSOLIDATION_RESTART_RECOVERY_2026-08-20.md`, `R6_LAYERED_MEMORY_REPORT_2026-08-13.md`, `R6_LOCAL_LEARNING_CANDIDATES_REPORT_2026-08-20.md`, `R6_OUTGOING_BUDGET_AND_ICONS_REPORT_2026-08-14.md`, `R6_TRANSACTIONAL_LEARNING_CONFIRMATION_REPORT_2026-08-20.md`, `R6_WORKING_MEMORY_REPORT_2026-08-14.md`, `R6_WORKING_MEMORY_UI_REPORT_2026-08-14.md`. *(Nota de nombre exacto: `R6_CONSOLIDATION_RESTART_RECOVERY_REPORT_2026-08-20.md`).*
- **Fase R7 (Tareas y recordatorios) y Fase R8 (Documentos y Grafo):** `DOCUMENT_READER_R8_PROGRESS_2026-09-04.md`, `R7_2A_TASK_MUTATION_REPORT_2026-09-01.md`, `R7_2B_TASK_UI_REPORT_2026-09-02.md`, `R7_3A_TEMPORAL_ENGINE_REPORT_2026-09-02.md`, `R7_3B_ATTEMPT_LEDGER_REPORT_2026-09-02.md`, `R7_4_LOCAL_NOTIFICATION_REPORT_2026-09-04.md`, `R7_5_LIVE_VALIDATION_2026-09-04.md`, `R7_5_READ_ONLY_CAPABILITY_CHECK_REPORT_2026-09-04.md`, `R7_TASK_REGISTRY_REPORT_2026-09-01.md`, `R8_1_SOURCE_GRAPH_REPORT_2026-09-04.md`, `R8_2_ASSOCIATIONS_REPORT_2026-09-05.md`, `R8_3_GEMMA_EMBEDDING_EVALUATION.md`, `R8_4_VOLUME_CLOSEOUT_2026-09-11.md`.

---

## 7. `data/` — Almacén privado en tiempo de ejecución (`45` archivos + `4` carpetas vacías)

*(Documentado exclusivamente por nombres y propósito arquitectónico, sin leer registros privados).*

- [`data/README.md`](../../data/README.md): Único archivo de `data/` rastreado en Git; explica las subcarpetas de persistencia local.
- `data/audit/events-v1.jsonl`: Bitácora técnica unificada R3 activa.
- `data/cloud/cloud-audit.jsonl`: Registro local de intercambios con proveedores de inferencia.
- `data/conversation/history-v1.json` + `data/conversation/backups/` (`3` respaldos previos a limpiezas): Historial cotidiano durable de conversación.
- `data/memory/`:
  - **Activos:** `records.json` (recuerdos confirmados), `automatic-v1.json` + `automatic-v1.backup.json` (memoria automática de conversación), `manifest.json`, `owner-profile.json`, `layer-index-v3.json`, `lifecycle-index-v1.json`, `audit/memory-events.jsonl`, `reviews/episode-review-2026-09-04.md`, `notes/` (`9` archivos de bóveda Markdown/Obsidian del perfil) y `backups/` (`14` respaldos transaccionales).
  - **Legados inactivos en `data/memory/` (no en uso actual, conservar respaldo antes de tocar):** `sessions.json`, `sessions.backup.json`, `memory-audit.jsonl` (de agosto pre-v1) y `layer-index-v2.json` (sustituido por `v3`).
  - **Carpetas vacías reservadas (`4`):** `attachments/`, `exports/`, `indexes/` y `revisions/`.
- `data/visual-checks/` (`2` PNG: `volume-observatory-desktop.png`, `volume-observatory-mobile.png`): **Residuos visuales desechables** generados el `2026-09-08` por `scripts/testing/volume-observatory.cjs`.

---

## 8. `local/` — Recursos privados, borradores, adaptadores en cuarentena y artefactos (`221 MB`)

- [`local/README.md`](../../local/README.md): Guía rastreada en Git sobre la organización de carpetas privadas bajo `local/`.
- **`local/assets/` (`17` archivos — ACTIVO PRIVADO, NO BORRAR):**
  - `Alice.vrm` (26,7 MB): Avatar 3D privado de Alice.
  - [`local/assets/Animations/README.md`](../../local/assets/Animations/README.md) + `Animations/private/mixamo/` (`13` archivos `.fbx`: `Breathing Idle`, `Idle`, `Jump`, `Left Strafe Walking`, `Left Turn`, `Right Strafe Walking`, `Right Turn`, `Run Forward`, `Sitting Idle`, `Standing Up`, `Start Walking`, `Walking Backwards`, `Walking`).
  - [`local/assets/Models/README.md`](../../local/assets/Models/README.md) + `Models/private/face_landmarker_float16_v1.task` (3,6 MB): Modelo MediaPipe Face Landmarker.
- **`local/venv/` (`1.026` archivos, ~63 MB — ACTIVO EN WINDOWS):** Entorno virtual Python con `pip` y `PyMuPDF 1.26.4` usado por `documents.rs` para leer PDFs.
- **`local/reference-adapters/` (`12` scripts Python — EN CUARENTENA, SIN USO EN RUNTIME):** `document-reader.py`, `knowledge-graph.py`, `probe-face-landmarker.py`, `stt.py`, `system-actuator.py`, `tts.py`, `video-analyzer.py`, `vision-analyzer.py`, `weather-sensor.py`, `web-scraper.py`, `web-searcher.py`, `windows-ocr.py`. Prototipos antiguos auditados y aislados fuera del runtime.
- **`local/drafts/` (`17` archivos, ~1,48 MB — BORRADORES HISTÓRICOS DESECHABLES):**
  - 3 capturas PNG de agosto (`neural-volume-redesign.png`, `volume-review.png`, `volume-review-final.png`).
  - `avatar-height-detail/` (`14` scripts/archivos puntuales de septiembre usados una vez para ajustar texturas/ojos/piel de `Alice.vrm`: `check.mjs`, `compare-textures.mjs`, `eye-life-preview.mjs`, `eye-life-settings.mjs`, `hair-eyes-palette.mjs`, `hair-eyes-preview.mjs`, `package-textures.py`, `prepare-texture.mjs`, `preview.html`, `preview.tsx`, `skin-preview.mjs`, `update-eye-life.mjs`, `update-hair-eyes.mjs`, `update-skin.mjs`; varios apuntan a rutas antiguas `Assets/Alice.vrm` y caché interna de Codex).
- **`local/artifacts/` (`1.410` archivos, ~120 MB — EVIDENCIAS Y BASURA PESADA DE QA/BUILDS):**
  - **`vision-conversation-2026-11-03/` (27,75 MB):** Incluye un ejecutable compilado antiguo `alice-review.exe` (~27 MB).
  - **`architecture-review-2026-11-05/` (10,16 MB):** Duplica dos veces el repositorio completo (`snapshot/` con 646 archivos + `source-aa6a749.zip`).
  - **`r9-hands-free-2026-11-03/` (8,56 MB):** Log gigante de instalador `node-msi.log` y datos de prueba.
  - **Otras 19 carpetas fechadas** (`architecture-increment-2026-11-04`, `automatic-memory-volume-2026-11-03`, `conversation-home-2026-11-03`, `conversation-icon-2026-11-04`, `conversation-session-2026-11-04` *[contiene los WAV fuente de `prepare-voice-fixtures.mjs`]*, `github-sync-2026-11-04`, `media-playback-2026-11-03`, `media-voice-fix-2026-11-03`, `media-voice-fix-2026-11-04`, `memory-modular-react-2026-11-04`, `organization-ubuntu-2026-11-04`, `project-cleanup-2026-11-04`, `r9-conversation-context-2026-11-05`, `r9-reference-stop-rust-2026-11-03`, `r9-voice-2026-11-03`, `reliability-2026-11-05`, `review-2026-11-03`, `voice-noise-2026-11-04` *[contiene `synthetic-speech.wav`]*, `voice-standby-2026-11-06`).
  - **216 archivos sueltos (~57,34 MB):** 37 maquetas `.html` temporales de pruebas de iconos, 178 capturas `.png` de iteraciones visuales descartadas de agosto–septiembre (incluida `r7-2b-live-before.png` vacía de 144 bytes) y `local-model-comparison.json`.

