# Revisión técnica de Project AIRI para Alice Continuum

Fecha: 2026-08-13  
Fuente: `moeru-ai/airi`  
Snapshot revisado: `addfec198118028da55142344e5d20777b2ced5a` · versión raíz `0.11.3`  
Estado: investigación; no modifica el Roadmap ni autoriza incorporación de código

## Dictamen

AIRI es una referencia valiosa para la **presencia** de Alice —voz en tiempo real, VRM, mirada, parpadeo, sincronización labial, proveedores intercambiables y telemetría del escenario—, pero no es un reemplazo de Alice Continuum ni una base adecuada para R6.

Su centro actual es un personaje virtual gobernado por LLM y distribuido en web, escritorio y móvil. Alice, en cambio, está construyendo primero una fuente de verdad local, capacidades cerradas, permisos nativos, auditoría y aprendizaje gobernado. Conviene adaptar patrones aislados y verificables; no hacer fork, fusionar runtimes ni trasladar su monorepo.

## Qué se revisó realmente

Se clonó el repositorio oficial con profundidad 1 fuera del workspace de Alice y se inspeccionaron 5.088 archivos versionados, 68 manifiestos `package.json` y 428 archivos de prueba. No se instalaron dependencias, no se ejecutó AIRI y no se copió código o activo al repositorio de Alice.

La estructura vigente separa:

- aplicaciones web, Electron y Capacitor;
- renderizadores VRM, Live2D, MMD, Spine y Tachie;
- agente conversacional, contexto, audio, plugins y servidor;
- integraciones con Discord, Telegram, Minecraft y otros sistemas;
- experimentos de memoria y motores alternativos.

El proyecto usa principalmente Vue, TypeScript, Electron, Three.js/TresJS, WebAudio, WebGPU/WASM y un monorepo pnpm/Turbo. Su aplicación de escritorio actual es **Electron**, no Tauri.

## Comparación honesta

| Área | AIRI actual | Alice actual | Decisión |
|---|---|---|---|
| Propósito | Plataforma extensible de personaje virtual impulsado por LLM | Asistente privado con cognición observable y gobierno local | No fusionar productos |
| Escritorio | Electron con múltiples ventanas | Tauri 2 + Rust | Mantener Tauri/Rust |
| Proveedores | Catálogo amplio de LLM, STT y TTS | Router controlado y credenciales fuera de React | Adaptar sólo interfaces |
| Cuerpo | VRM/Live2D/MMD, expresiones, mirada y lipsync | VRM privado, 12 clips, FSM e IK local | Referencia prioritaria para R9 |
| Audio | VAD/transcripción, streaming, colas y reproducción | Leases reales de micrófono; voz aún no conectada | Referencia prioritaria para R9 |
| Memoria | Base local disponible; Memory Alaya continúa WIP | JSON gobernado, recuperación explicable; R6 por diseñar | No copiar como motor R6 |
| Herramientas | Tool calls y plugins extensibles | R1–R5 cerrados, simulación y aprobación explícita | Mantener barrera Alice |
| Permisos | Grants de plugin y consentimiento granular en desarrollo | R1 + R2 + R3 nativos y cerrados | Estudiar para extensiones futuras |
| Multiplataforma | Web, Windows, macOS, Linux y móvil | Windows local-first | Fuera de prioridad |

## Patrones que sí conviene adaptar

### 1. Ciclo de vida y observabilidad VRM — R9

`stage-ui-three` separa carga, montaje, reutilización, cambio de modelo y disposición. También distingue las fases `pending`, `loading`, `binding`, `mounted`, `error` y `no-model`, y conserva trazas de carga, frame, hit-test y recursos del renderer.

Para Alice esto se traduce en:

- mantener una sola instancia gobernada del avatar;
- diferenciar modelo ausente, cargando, listo y error;
- medir coste de frame, memoria y latencia de expresión;
- impedir comandos de cámara o cuerpo durante una transición incompleta;
- conservar telemetría visual separada de la auditoría cognitiva.

Debe reimplementarse sobre React/Three y la arquitectura actual, no copiar los componentes Vue/TresJS.

### 2. Expresión facial y lipsync desacoplados — R9

AIRI separa animación, expresiones, mirada, movimiento ocular y sincronización labial. Esa frontera coincide con el principio de Alice: el Body Solver transforma una salida aprobada, pero no toma decisiones.

El puente futuro de Alice debería recibir un paquete tipado como:

```text
utteranceId + audioClock + viseme weights + expression + gaze + provenance
```

Cada canal tendrá capacidad R1 independiente, grant R2 revocable y eventos R3 correlacionados. La expresión no se deducirá directamente de texto sin una política explicable.

### 3. Pipeline de voz por etapas — R9

Los paquetes de audio de AIRI separan captura, transcripción, fragmentación de texto para TTS, prioridad, reproducción, timeline y control del streaming. Es un patrón mejor que acoplar Fish Audio directamente a la conversación.

Secuencia recomendada para Alice:

```text
respuesta aprobada
  -> adaptador TTS seleccionado
  -> audio temporal con metadatos
  -> cola de reproducción cancelable
  -> reloj común para lipsync
  -> descarte según política de retención
```

El repositorio AIRI revisado no ofrece una integración Fish Audio vigente lista para reutilizar. Fish aparece sólo en documentación histórica. Por tanto, cuando se autorice, Alice necesitará su propio adaptador proveedor-neutral y pruebas contractuales con la API elegida.

### 4. Contexto proyectado e inspeccionable — R6, con cautela

`core-agent` construye snapshots de contexto separados del historial y expone proyecciones del prompt para diagnóstico. La idea es útil para que Alice pueda explicar **qué recuerdos entrarían** a una consulta sin confundir recuperación con verdad.

En R6 debe limitarse primero a:

- vista previa local de memoria de trabajo;
- presupuesto y procedencia por fragmento;
- exclusión visible de contenido no autorizado;
- cero escritura automática durante la recuperación.

No implica adoptar su orquestador LLM ni sus tool calls.

### 5. Grants estrechos para extensiones — R10 o posterior

El protocolo de plugins diferencia permiso solicitado, concedido, denegado y vigente. El host puede conceder menos que lo solicitado y los módulos heredan un techo de permisos de la extensión. Es una referencia útil para una futura distribución de Alice.

No debe adelantarse a R6–R9: R1/R2 ya ofrecen una frontera más pequeña y adecuada para la aplicación privada actual.

## Lo que no conviene adoptar

1. **El monorepo completo.** Sus 68 paquetes y múltiples superficies resolverían problemas que Alice todavía no tiene y multiplicarían dependencias y caminos de datos.
2. **Electron como sustituto de Tauri.** AIRI migró por sus necesidades de audio y ventanas; Alice ya tiene permisos, sensores y persistencia validados en Rust. Una migración borraría esa ventaja sin demostrar necesidad.
3. **Tool calls directos como autonomía.** En Alice toda acción debe atravesar capacidad, grant, auditoría y política. El LLM nunca constituye autorización.
4. **Memoria AIRI como diseño de R6.** Su README declara Memory Alaya en progreso y el paquete `memory-pgvector` inspeccionado es todavía un esqueleto de conexión. R6 necesita contratos propios, migración reversible y consolidación manual inicial.
5. **Canales y juegos ahora.** Discord, Telegram, Minecraft, Factorio, MCP y computer-use amplían superficie de ataque y no ayudan al primer incremento de memoria.
6. **Suposiciones de seguridad del host.** Muchas ventanas Electron revisadas configuran `sandbox: false`. AIRI también posee controles de permisos valiosos, pero Alice no debe heredar la configuración del host ni asumir equivalencia con su Gateway nativo.
7. **Telemetría externa por defecto.** Cualquier analítica o tracing remoto debe permanecer fuera de Alice salvo consentimiento específico y un contrato posterior.

## Licencia y activos

El código raíz de AIRI usa licencia MIT. Esto permite estudiar, modificar y reutilizar código conservando el aviso de copyright y la licencia. No significa que todos los modelos, fuentes, animaciones, SDK o activos transitivos tengan automáticamente la misma autorización.

Regla para Alice:

- preferir reimplementación de patrones;
- si se copia código sustancial, registrar archivo, commit de origen, licencia y modificaciones;
- auditar por separado modelos VRM, animaciones, tipografías y SDK;
- no importar avatares o recursos visuales de AIRI al repositorio privado sin revisar su licencia individual.

## Prioridad resultante

| Prioridad | Acción | Fase |
|---|---|---|
| 1 | Diseñar contratos propios de memoria de trabajo, episodios y hechos enseñados | R6.1 |
| 2 | Adoptar la idea de proyección de contexto explicable, sin tool calls ni escritura | R6.2+ |
| 3 | Diseñar interfaz TTS neutral, cola cancelable y reloj audio/lipsync | R9.1 |
| 4 | Reimplementar estados y trazas del ciclo VRM en el Body Solver | R9.2 |
| 5 | Evaluar grants jerárquicos sólo al diseñar extensiones distribuibles | R10+ |

## Relación con el análisis OpenClaw + Tencent

Este estudio refuerza la revisión anterior: Alice debe tomar **patrones**, no runtimes completos. AIRI aporta más valor en cuerpo, audio y superficies de interacción que en memoria gobernada. Tencent continúa siendo una referencia conceptual más relevante para capas de memoria; AIRI ofrece una referencia más madura para el futuro puente de presencia.

No cambia el próximo paso autorizado del Roadmap: R6.1 comienza por contratos y migración reversible. No comienza por Fish Audio, VRM, extracción automática, plugins, juegos ni “dreaming”.

## Fuentes primarias

- Repositorio y hoja de ruta: <https://github.com/moeru-ai/airi>
- Licencia MIT: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/LICENSE>
- Workspace y dependencias: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/pnpm-workspace.yaml>
- Aplicación Electron: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/apps/stage-tamagotchi/package.json>
- Ciclo y trazas VRM: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/packages/stage-ui-three/README.md>
- Pipeline de audio: <https://github.com/moeru-ai/airi/tree/addfec198118028da55142344e5d20777b2ced5a/packages/pipelines-audio>
- Orquestador y proyección de contexto: <https://github.com/moeru-ai/airi/tree/addfec198118028da55142344e5d20777b2ced5a/packages/core-agent>
- Protocolo de permisos: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/packages/plugin-protocol/src/types/events.ts>
- Servicio de grants: <https://github.com/moeru-ai/airi/blob/addfec198118028da55142344e5d20777b2ced5a/packages/plugin-sdk/src/plugin-host/runtimes/shared/services/permissions.ts>
- DevLog del ciclo VRM: <https://airi.moeru.ai/docs/en/blog/DevLog-2026.03.14/>
