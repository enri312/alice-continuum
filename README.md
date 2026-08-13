# Alice Cognitive Core

![Estado](https://img.shields.io/badge/estado-prototipo%20funcional-0ea5e9?style=flat-square)
![R1](https://img.shields.io/badge/R1-validado-16a34a?style=flat-square)
![R2](https://img.shields.io/badge/R2-alcance%20inicial%20validado-16a34a?style=flat-square)
![R3](https://img.shields.io/badge/R3-validado-16a34a?style=flat-square)
![R4](https://img.shields.io/badge/R4-validado-16a34a?style=flat-square)
![R5](https://img.shields.io/badge/R5-completado-16a34a?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-221%2F221%20pruebas-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-160%20aprobadas%20%7C%209%20sondas-b7410e?style=flat-square&logo=rust&logoColor=white)
![Python](https://img.shields.io/badge/Python-adaptador%20sensorial%20local-3776ab?style=flat-square&logo=python&logoColor=white)
![Hardware](https://img.shields.io/badge/hardware-CAM%20%2B%20MIC%20vivos-0f766e?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react&logoColor=white)
![Windows](https://img.shields.io/badge/plataforma-Windows-0078d4?style=flat-square&logo=windows11&logoColor=white)
![Privacidad](https://img.shields.io/badge/datos-local--first-0f766e?style=flat-square)
![Repositorio](https://img.shields.io/badge/repositorio-privado-6b7280?style=flat-square&logo=github&logoColor=white)

Aplicación de escritorio local-first para que **Alice** gestione conversación, memoria, percepción autorizada, estado cognitivo observable y futuras señales de rostro y cuerpo bajo control de Carlos Nuñez.

El nombre técnico del sistema es **Alice Cognitive Core**. La interfaz separa tres espacios actuales y reserva un cuarto para el futuro:

- `ALICE_NEURAL_CORE // COGNITIVE IDENTIFICATION`: conversación, núcleo, identificación, memoria y actividad cognitiva.
- `ALICE_NEURAL_CORE // BODY SOLVER`: rostro, cuerpo y avatar.
- `ALICE_LOCAL_CONTROL // GOVERNANCE`: capacidades, permisos, auditoría, diagnóstico, Taller y configuración; pertenece al propietario, no al cerebro de Alice.
- `ENVIRONMENT // OBSERVATION ROOM`: sala futura, todavía no implementada, para sesiones delimitadas de comportamiento y maduración trazable.

> Los badges de pruebas reflejan la validación local real del 13 de agosto de 2026. No representan un workflow de CI remoto; este repositorio privado todavía no contiene uno.

## Estado verificado

| Área | Estado real |
|---|---|
| Registro de capacidades R1 | Validado: snapshot nativo v1 con 24 capacidades |
| Gateway de permisos R2 | Alcance inicial validado: ventana, cámara y micrófono protegidos por grants nativos |
| Auditoría unificada R3 | Validada: evidencia correlacionada, diagnóstico pasivo y actividad efímera del Núcleo |
| Taller de habilidades R4 | Validado: editor visible, borradores, simulación, gobierno inmutable y primera habilidad de lectura; sin ejecución |
| Aprendizaje gobernado R5 | Cinco incrementos validados: contrato, detector, decisiones, puente R4 y vigencia de evidencia; 0 conversiones canónicas |
| Capacidades implementadas o parciales | 14 |
| Capacidades planificadas | 10, sin adaptador y no disponibles |
| Pruebas TypeScript | 221/221 aprobadas |
| Pruebas Rust | 160 normales aprobadas; nueve sondas vivas disponibles por separado |
| Builds | Frontend y ejecutable Tauri aprobados |
| Prueba viva de ventana | Win32 devolvió metadatos reales del primer plano; el contenido no se imprimió ni persistió |
| Prueba viva sensorial | Cámara y micrófono entregaron señal real mediante leases separados; 107 archivos multimedia antes y después, delta 0 |
| Datos privados preservados | Nueve archivos base intactos; R3 añade `audit/events-v1.jsonl` como décimo archivo gobernado |
| Avatar privado | Preservado y excluido de Git |

La evidencia completa está en [el informe de validación R1](docs/testing/R1_CAPABILITY_REGISTRY_REPORT_2026-08-09.md).

## Límites actuales

- Nada se envía a Internet sin una previsualización y autorización visibles.
- Alice no ejecuta PowerShell, comandos libres ni herramientas remotas.
- React no recibe ni muestra claves de proveedores.
- Una respuesta de nube no se convierte automáticamente en recuerdo o verdad.
- La observación vigente se limita a metadatos autorizados de la ventana activa; no registra teclas, archivos ni imágenes.
- Cámara y micrófono son capacidades parciales con leases R2 de 60 segundos; pantalla, reproductores, acciones accesibles y gestos siguen planificados.
- Voz, rostro, mirada, puente corporal y adaptadores externos permanecen desconectados. El visor posee una prueba manual DualSense que no representa salida de Alice.
- R1 describe capacidades; no concede permisos nuevos ni ejecuta las capacidades desde el registro.
- R2 consume grants efímeros para ventana, cámara o micrófono. Aprobar no abre hardware: cada sensor exige una activación posterior y ofrece Detener inmediato.
- El envío a la nube todavía usa previsualización y confirmación en React; R1 lo declara `enforcedBy: currentUi` hasta una migración nativa futura.

## Pantallas

| Espacio | Pantallas | Responsabilidad |
|---|---|---|
| Cognitive Core | Conversación, Volumen cognitivo, Flujo cognitivo, Estado y controles, Planificador, Identificación, Memoria y Actividad | Percepción interpretada, estructura, flujo, estado, planificación y eventos de conducta |
| Body Solver | Rostro, Cuerpo y Avatar | Expresión y presencia física; sus adaptadores continúan desconectados |
| Governance Core | Capacidades y permisos, Auditoría y diagnóstico, Taller y Configuración | Controles externos de Carlos sobre alcance, autorización, evidencia técnica y evolución de Alice |
| Observation Room | Futura | Entorno delimitado para observar sesiones, estímulos, conducta y cambios trazables |

### Sistema de insignias técnicas Alice

La navegación y los controles visuales usan 22 SVG locales de alta definición con escenas técnicas propias: revisión de privacidad, señales R3, registro de capacidades, VRM y locomoción, tokens, manifiestos, evidencia de procedimientos, canales corporales y controles de cámara. El lenguaje visual se estudió auditando la colección de Cyrcetech, sin importar sus archivos ni sus figuras. Dieciocho iconos se generan desde cero con `npm run icons:generate`; `nav-memory.svg` y la base visual de `nav-conversation.svg`, aportados por el propietario, se adaptan y preservan como fuentes manuales. `nav-avatar.svg` y `bridge-face.svg` también quedan protegidos como composiciones manuales originales: Avatar es una estación de personalización VRM que presenta el cabello, el conjunto techwear, el arnés, las botas, el rig y los 12 clips como activos separados, sin rostro ni figura humana; su geometría permanece fija y sólo varía lentamente la intensidad de LEDs. Rostro es un calibrador óptico independiente con perfil humano abstracto, landmarks, cinco dependencias inactivas, ocho canales reservados, cámara apagada y video no almacenado. Conversación representa entrada textual, contexto, compuerta de privacidad y autorización; mantiene el micrófono en `SAFE OFF` hasta que exista una integración real de voz. La navegación presenta los SVG a `98 × 98 px` (`86 × 86 px` en móvil) para conservar sus microdetalles. Las pruebas verifican catálogo, accesibilidad, lienzo, unicidad, semántica de Avatar/Rostro y ausencia de recursos externos o contenido ejecutable.

El emblema de la aplicación no forma parte de este rediseño: [`icons/app-alice.svg`](icons/app-alice.svg) y el conjunto de iconos de Tauri permanecen intactos. La decisión vigente y la verificación están documentadas en [ADR-P-064](docs/decisions/ADR-P-064-pantallas-cognitivas-e-iconos-cyrcetech.md). [ADR-P-063](docs/decisions/ADR-P-063-sistema-cyber-glyph-v2.md) conserva el antecedente reemplazado.

## Cámara, micrófono y aprendizaje sensorial

Carlos Nuñez autorizó las pruebas con la cámara y el micrófono integrados. Alice ya prepara una previsualización específica, crea un grant separado por dispositivo y solo abre el hardware después de pulsar **Activar**. El indicador permanece visible y **Detener**, revocar, vencer o cerrar la aplicación finaliza el lease.

Comprobación real de hardware del 09 de agosto de 2026:

| Dispositivo | Resultado |
|---|---|
| `ACER HD User Facing` | 12 fotogramas recibidos mediante DirectShow, 640×480, sin guardar imágenes |
| `Microphone Array (Intel Smart Sound Technology)` | 77.175 muestras recibidas, 44.100 Hz, 1,75 s, señal RMS real y sin guardar audio |

El incremento R2 volvió a abrir ambos dispositivos mediante la ruta gobernada real: la prueba exigió señal positiva, detuvo cada lease y confirmó `MEDIA_DELTA=0` sobre 107 archivos. Las capacidades `perception.camera.observe` y `perception.microphone.observe` son ahora `partial`, usan `enforcedBy: native` y aparecen `idle` o `active` según el proceso real. Todavía no analizan, transcriben ni crean recuerdos.

La voz del avatar se evaluará posteriormente mediante la API de **Fish Audio** que posee Carlos Nuñez. Todavía no se agrega dependencia, adaptador, variable ni clave. La credencial nunca deberá escribirse en este README, el repositorio, React, la memoria o una auditoría.

Más detalles en [el informe inicial de hardware](docs/testing/HARDWARE_INPUT_READINESS_REPORT_2026-08-09.md), [el informe de leases R2](docs/testing/R2_SENSOR_LEASE_REPORT_2026-08-09.md) y [ADR-P-043](docs/decisions/ADR-P-043-aprendizaje-sensorial-gobernado.md).

### Prueba manual DualSense

Windows detectó el mando conectado por Bluetooth como `DualSense Wireless Controller`, con interfaz de juego HID Sony `VID 054C / PID 0CE6`, estado `OK`, código de problema 0 y controladores Microsoft firmados. La pestaña **Avatar** ofrece una prueba explícita de control humano: stick izquierdo desplaza el VRM en su orientación local, stick derecho lo gira, X salta y L2/R2 elevan brazos. Doce clips privados de Mixamo proporcionan reposo, arranque, marcha, carrera, retroceso, laterales, giros, salto, reposo sentado y transición de pie mediante retargeting al humanoide VRM. El botón **Ensayar marcha** reproduce una secuencia local determinista y los controles **Sentar/Levantar a Alice** comprueban las posturas sin depender del mando.

La entrada se lee sólo mediante Gamepad API mientras la prueba está activada. Existe zona muerta, suavizado, desplazamiento máximo y parada que restablece postura y posición. Una máquina de siete estados ejecuta `Start Walking` antes de la marcha frontal, mantiene `Sitting Idle` y reutiliza `Standing Up` en reversa para sentarse; cualquier movimiento desde sentado exige levantarse primero. La temporización de cada clip se calibró con la longitud de zancada medida en sus FBX; el visor expone estado, velocidad, animación, pie de apoyo, corrección horizontal, ajuste vertical y error IK. Un solver posicional de dos huesos orienta muslo y pantorrilla hacia el apoyo, preserva la orientación animada del zapato y renueva objetivos que superan 7,5 cm. En el ciclo Tauri aceptado el error observado quedó entre 0,0 y 1,9 cm. Todavía no resuelve muebles, terreno irregular, pendientes o colisiones. El acabado local distingue chaqueta, interior, arnés, prenda base, botas y corbata mediante materiales MToon, sombras suaves y contraste techwear; el detalle superficial mejora filtrado, mipmaps y relieve existente sin cambiar colores ni reescribir `Alice.vrm`. Cada transición manual o diagnóstica deja un evento R3 mínimo, enciende solamente `Motor manual` y nunca se presenta como decisión de Alice. El ensayo se detiene automáticamente a los diez segundos. No se transmiten vibración, luces, audio ni micrófono; no se guardan entradas y no se conectan a memoria, R5 o decisiones cognitivas. Esto no habilita `output.avatar.body` ni sustituye el futuro solver R9. Consulta [ADR-P-056](docs/decisions/ADR-P-056-prueba-manual-dualsense-avatar.md), [ADR-P-058](docs/decisions/ADR-P-058-locomocion-retargeteada-con-activos-compatibles.md), [ADR-P-059](docs/decisions/ADR-P-059-maquina-estados-corporal-local.md), [ADR-P-060](docs/decisions/ADR-P-060-telemetria-motora-y-detalle-superficial.md), [el informe del mando](docs/testing/DUALSENSE_MANUAL_AVATAR_REPORT_2026-08-11.md), [el informe de locomoción y acabado](docs/testing/AVATAR_LOCOMOTION_APPEARANCE_REPORT_2026-08-11.md), [el informe de la máquina corporal](docs/testing/AVATAR_BODY_STATE_MACHINE_REPORT_2026-08-11.md), [el informe de telemetría y superficie](docs/testing/AVATAR_MOTOR_R3_SURFACE_REPORT_2026-08-11.md) y [el análisis de referencias externas](docs/testing/AVATAR_REFERENCE_ANALYSIS_2026-08-11.md).

## Control de contexto de conversación

El panel lateral de Conversación es la última revisión antes de una solicitud de nube:

- historial, recuerdos y ventana comienzan desmarcados;
- observar una ventana localmente no implica enviarla;
- cámara, micrófono, fotogramas y audio no son fuentes elegibles;
- `Recordar localmente` empieza desactivado y no controla qué sale a Internet;
- proveedor y modelo se muestran como destino de solo lectura y solo se cambian en Configuración;
- el botón de ventana abre el Gateway R2: no activa ni detiene directamente.

El informe completo del alcance inicial está en [R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md](docs/testing/R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md).

## Auditoría unificada R3

Los cinco incrementos de R3 incorporan un sobre nativo v1 cerrado, conectan Gateway R2, memoria y nube como productores correlacionados, añaden `[09] PASSIVE DIAGNOSTIC` y derivan la actividad efímera del Núcleo. Solicitud, autorización, ejecución, detención, revocación, bloqueo, error y vencimiento comparten un `operationId`; no existen propiedades para mensajes, recuerdos, imágenes, audio, parámetros o claves.

La auditoría vive en `data/audit/events-v1.jsonl`, limita el archivo actual a 5 MiB y conserva una sola rotación anterior. Guardar, exportar, restaurar o migrar memoria registra una solicitud antes del efecto y un resultado con la misma correlación. Una solicitud de nube no sale si R3 no puede registrar su inicio; el resultado conserva únicamente una huella de integridad. Las auditorías heredadas de memoria y nube continúan en escritura dual durante esta fase de compatibilidad.

El diagnóstico clasifica cada comprobación como saludable, configuración pendiente, no disponible o error. Lee rutas y versiones, comprueba presencia de configuración sin revelar valores, importa el runtime sensorial sin abrir dispositivos y valida el Gateway sin vencer ni modificar solicitudes. No envía red, solicita permisos, crea carpetas, rota auditorías ni corrige archivos.

El comando `core_activity_snapshot` evalúa los eventos R3 visibles dentro de una ventana de cinco minutos. `r3-recency-motor-v2` pondera recencia, etapa y resultado, y produce siete regiones y cinco enlaces con conteos verificables. La séptima región recibe únicamente estados motores manuales o diagnósticos y permanece aislada de contexto y salida. La interfaz lo marca siempre como heurística técnica. Los eventos sólo controlan brillo temporal; la memoria local sigue siendo la única fuente de densidad persistente y los diez canales afectivos permanecen en `0.00`.

Consulta el [contrato R3](docs/architecture/UNIFIED_AUDIT_R3.md), [ADR-P-045](docs/decisions/ADR-P-045-auditoria-unificada-local.md), [ADR-P-047](docs/decisions/ADR-P-047-actividad-efimera-del-nucleo-desde-r3.md), el [plan incremental](docs/plans/R3-unified-audit.md), [el informe de la base](docs/testing/R3_AUDIT_FOUNDATION_REPORT_2026-08-09.md), [el informe del Gateway correlacionado](docs/testing/R3_PERMISSION_AUDIT_REPORT_2026-08-09.md), [el informe de memoria y nube](docs/testing/R3_MEMORY_CLOUD_AUDIT_REPORT_2026-08-09.md), [el informe del diagnóstico](docs/testing/R3_PASSIVE_DIAGNOSTIC_REPORT_2026-08-09.md) y [el cierre de actividad del Núcleo](docs/testing/R3_CORE_ACTIVITY_REPORT_2026-08-09.md).

## Matriz cognitivo-afectiva

El volumen neuronal distingue estructura aprendida de actividad actual: solo aparecen los nodos respaldados por recuerdos o señales comprobables, mientras que el brillo y el pulso quedan reservados para actividad temporal. Con pocos recuerdos la red permanece pequeña; la nube densa es una meta de crecimiento para cientos o miles de registros y asociaciones auditables.

La paleta futura incluye Alegría amarilla, Tristeza azul, Ira roja, Temor violeta, Desagrado verde, Ansiedad naranja, Envidia turquesa, Aburrimiento índigo, Vergüenza rosa y Nostalgia gris rosado. Los diez valores siguen en `0.00` y `planned`; todavía no existe simulación emocional. Consulta el [diseño afectivo](docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md), [ADR-P-046](docs/decisions/ADR-P-046-paleta-afectiva-y-volumen-cognitivo.md) y el [informe visual](docs/testing/AFFECTIVE_VOLUME_VISUAL_REPORT_2026-08-09.md).

## Taller de habilidades R4

R4 define habilidades como manifiestos JSON cerrados, no como scripts o prompts ejecutables. Cada borrador declara propósito, procedencia, pasos visibles, entradas, resultados, precondiciones, comprobaciones, riesgo y las capacidades/operaciones exactas que necesitaría. Rust y TypeScript contrastan el manifiesto con el Registro R1 y rechazan privilegios sobrantes.

Toda habilidad nueva comienza `draft`, versión 1 y desactivada. R4.2 añade listado, lectura y guardado nativos bajo `data/skills`: usa rutas derivadas, reemplazo sincronizado, conflicto por revisión esperada y SHA-256 para el borrador y su respaldo anterior. Consultar no crea la carpeta.

R4.3 incorpora `simulate_skill_plan`, un análisis estático contra el Registro R1 vigente. El resultado muestra pasos, capacidades, permisos, efectos, alcances, requisitos y bloqueos sin recibir valores sensibles. Siempre declara ejecución deshabilitada, cero adaptadores y cero efectos. La prueba viva construyó las 24 capacidades desde los datos canónicos y confirmó que `data/` permaneció idéntico.

R4.4 añade revisión, aprobación, desactivación, restauración y retiro como transiciones nativas. Cada decisión exige confirmación del propietario local ligada a la revisión y su SHA-256; cada estado crea un archivo inmutable y deja un par de eventos R3 correlacionados sin copiar pasos, motivos ni contenido. Una revisión aprobada nunca se sobrescribe.

R4.5 completa la fase con la pestaña **Taller**, ubicada en `GOVERNANCE CORE` porque es una herramienta del propietario y no una función cognitiva de Alice. Preparar una plantilla no escribe archivos; guardar es una acción visible. La primera habilidad `local.revisar-proveedores-ia` usa únicamente `cloud.providers.inspect/cloud_status`: revela presencia de configuración y modelos públicos, pero no claves, mensajes ni red. La prueba E2E escribió borrador y revisiones en un directorio temporal real, simuló el plan, lo llevó a revisión y aprobación, lo reabrió por SHA-256 y confirmó cero adaptadores, cero efectos y ejecución deshabilitada.

La política fija `simulationOnly` mantiene red, procesos y escritura en `false`; `approved` todavía no significa ejecutable. R4 queda cerrada y el siguiente trabajo corresponde a R5: propuestas de procedimientos sustentadas en evidencia auditada. Consulta el [contrato R4](docs/architecture/SKILL_MANIFEST_R4.md), [ADR-P-048](docs/decisions/ADR-P-048-manifiesto-local-de-habilidades.md), [ADR-P-049](docs/decisions/ADR-P-049-almacen-local-borradores.md), [ADR-P-050](docs/decisions/ADR-P-050-simulacion-estatica-de-habilidades.md), [ADR-P-051](docs/decisions/ADR-P-051-ciclo-de-vida-inmutable-de-habilidades.md), el [plan](docs/plans/R4-skill-workshop.md), [el informe R4.1](docs/testing/R4_SKILL_MANIFEST_REPORT_2026-08-09.md), [el informe R4.2](docs/testing/R4_SKILL_DRAFT_STORE_REPORT_2026-08-09.md), [el informe R4.3](docs/testing/R4_SKILL_SIMULATION_REPORT_2026-08-10.md), [el informe R4.4](docs/testing/R4_LIFECYCLE_AUDIT_REPORT_2026-08-10.md) y [el cierre R4.5](docs/testing/R4_VISIBLE_WORKSHOP_REPORT_2026-08-10.md).

## Aprendizaje gobernado R5.1–R5.5

El primer incremento de R5 define qué evidencia sería suficiente para proponer un procedimiento sin afirmar que Alice ya aprendió uno. Un candidato requiere al menos tres operaciones correlacionadas distintas, dos pasos y una evidencia R3 de ejecución exitosa por paso. Capacidad, operación y riesgo se contrastan con R1; eventos de permisos, simulaciones R4, bloqueos o errores no califican.

El contrato no contiene parámetros, mensajes, imágenes ni audio. Las únicas diferencias admitidas inicialmente son duración y huella SHA-256, recalculadas desde R3. La política es inmutable: sólo propuesta, sin autoactivación, ejecución ni memoria duradera.

R5.2 incorpora `procedure_detection_status`, una lectura efímera de la ventana visible R3. Excluye sistema, permisos, simulaciones, errores, pasos únicos, capacidades planificadas y operaciones cuyo orden no pueda demostrarse a nivel de milisegundo. Agrupa secuencias exactas, exige tres UUID de operación y devuelve huellas y referencias, pero mantiene persistencia, creación de candidato y ejecución en `false`. La sonda canónica real examinó 22 eventos, calificó 0 ejecuciones y devolvió 0 patrones sin alterar ninguno de los 10 archivos de datos.

R5.3 añade `procedure_candidate_store_status` y `record_procedure_pattern_decision`. El almacén vive bajo `data/procedures`, separado de memoria y habilidades; consultar no lo crea. Cada huella sólo admite una decisión inmutable del propietario. `retain` reconstruye y valida el candidato contra R1/R3 y conserva su SHA-256; `dismiss` no guarda metadatos del candidato. El motivo nunca se guarda en claro. La nueva pestaña **Procedimientos** está en Governance, no en el Taller. En ambos casos ejecución y creación de borradores R4 siguen en `false`.

La sonda canónica posterior leyó 200 eventos y confirmó 0 patrones, 0 decisiones y almacén inexistente sin modificar datos. Las pruebas controladas sí escribieron archivos JSON/JSONL reales en directorios temporales para demostrar persistencia, SHA-256 e inmutabilidad sin sembrar recuerdos ficticios en Alice.

R5.4 incorpora un puente de uso único desde `retain` hacia un borrador R4 nuevo. El propietario revisa identidad, título, descripción y propósito; el manifiesto conserva decisión, candidato, fingerprint y SHA-256 de origen. Descartes, digests incorrectos, identidades ocupadas y segundos intentos fallan sin sobrescribir. El borrador mantiene `simulationOnly`, aprobación falsa y ejecución falsa incluso al recorrer revisión, aprobación, desactivación y restauración. Los eventos administrativos R5 se auditan, pero ya no elevan la señal global del Núcleo.

R5.5 cierra la fase clasificando cada decisión como evidencia vigente, obsoleta, descartada, convertida o bloqueada. Una auditoría no saludable bloquea la evaluación en lugar de fingir obsolescencia. La pestaña muestra ocurrencias, eventos correlacionados, pasos y diferencias de duración o huella. El backend vuelve a resolver R1/R3 antes de convertir: una huella obsoleta no cruza a R4 aunque la interfaz fuese eludida. Pruebas con archivos temporales y eventos R3 generados por los constructores reales verifican los cinco estados y que el rechazo no crea `skills/` ni modifica hashes existentes.

Consulta el [contrato R5](docs/architecture/GOVERNED_PROCEDURE_CANDIDATE_R5.md), [ADR-P-055](docs/decisions/ADR-P-055-candidatos-procedimientos-auditados.md), [ADR-P-057](docs/decisions/ADR-P-057-detector-conservador-procedimientos.md), [ADR-P-061](docs/decisions/ADR-P-061-almacen-decisiones-procedimientos.md), [ADR-P-062](docs/decisions/ADR-P-062-conversion-procedimiento-borrador.md), [ADR-P-065](docs/decisions/ADR-P-065-cierre-r5-vigencia-evidencia.md), el [plan R5](docs/plans/R5-governed-procedure-learning.md), [el informe R5.1](docs/testing/R5_PROCEDURE_CANDIDATE_REPORT_2026-08-11.md), [el informe R5.2](docs/testing/R5_PROCEDURE_DETECTOR_REPORT_2026-08-11.md), [el informe R5.3](docs/testing/R5_PROCEDURE_DECISION_STORE_REPORT_2026-08-11.md), [el informe R5.4](docs/testing/R5_PROCEDURE_DRAFT_CONVERSION_REPORT_2026-08-11.md) y [el cierre R5.5](docs/testing/R5_CLOSEOUT_REPORT_2026-08-13.md).

## Iniciar Alice

Hacer doble clic en [`Iniciar Alice.cmd`](Iniciar%20Alice.cmd). La terminal debe permanecer abierta mientras se usa la aplicación.

Inicio equivalente desde PowerShell:

```powershell
npm run tauri dev
```

Primera instalación:

```powershell
npm install
npm run tauri dev
```

La carpeta local canónica es `E:\Alice Cognitive Core`. `E:\Proyecto P` sigue siendo un respaldo temporal y no debe borrarse hasta completar su copia al disco externo.

## Proveedores de conversación

La selección de proveedor y modelo vive en **Configuración**, no en la portada de Conversación.

| Proveedor | Variable requerida | Modelo opcional |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| Google | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| xAI | `XAI_API_KEY` | `XAI_MODEL` |
| Compatible con Chat Completions | `ALICE_COMPATIBLE_API_KEY` y `ALICE_COMPATIBLE_BASE_URL` | `ALICE_COMPATIBLE_MODEL` |

Las variables se configuran en el perfil de Windows y requieren reiniciar Alice. La URL compatible debe usar HTTPS. Las llamadas no habilitan herramientas y limitan la salida a 1200 tokens; las políticas del proveedor siguen siendo aplicables.

## Datos locales

`Iniciar Alice.cmd` establece `ALICE_DATA_DIR` en `E:\Alice Cognitive Core\data`. El contenido está excluido de Git.

```text
data/
├── audit/
│   ├── events-v1.jsonl
│   └── events-v1.previous.jsonl
├── cloud/cloud-audit.jsonl
└── memory/
    ├── manifest.json
    ├── records.json
    ├── audit/
    ├── backups/
    ├── exports/
    ├── attachments/
    └── indexes/
```

La memoria es visible, editable, exportable y respaldable. Las auditorías conservan metadatos y huellas SHA-256, no claves ni el texto completo de las conversaciones. El diseño está en [MEMORY_SYSTEM.md](docs/architecture/MEMORY_SYSTEM.md).

## Arquitectura

```text
src/
├── Page/                 pantallas React
├── components/           paneles, iconos y visualizaciones
└── core/                 contratos R1/R2 y lógica TypeScript comprobable

src-tauri/src/
├── audit.rs              esquema, persistencia acotada y lectura R3
├── capabilities.rs       registro R1 y sondas pasivas
├── cloud.rs              proveedores y solicitudes autorizadas
├── core_activity.rs      señal efímera del Núcleo derivada de eventos R3
├── diagnostics.rs        inspección R3 pasiva y tipada sin efectos laterales
├── memory.rs             persistencia, respaldo y auditoría
├── observation.rs        metadatos autorizados de ventana
├── procedure_learning.rs contrato y detector R5.2 de secuencias auditadas sin efectos
├── procedure_store.rs    decisiones R5.3 separadas, inmutables y verificables por SHA-256
├── avatar.rs             validación pasiva del VRM
├── permissions.rs        tipos, validaciones y digest del Gateway R2
├── permissions/
│   └── gateway.rs        almacén efímero y máquina de estados R2
├── sensory.rs            leases CAM/MIC y adaptador local de señal efímera
├── skills.rs             manifiestos R4 y almacén local verificable de borradores
│   ├── lifecycle.rs      revisiones inmutables y transiciones auditadas
│   ├── simulation.rs     simulación estática sin adaptadores ni efectos
│   └── templates.rs      primera habilidad nativa de sólo lectura
├── util.rs               rutas y utilidades compartidas
└── lib.rs                estado y registro de comandos Tauri
```

Los contratos vigentes son [CAPABILITY_REGISTRY_R1.md](docs/architecture/CAPABILITY_REGISTRY_R1.md), [PERMISSION_GATEWAY_R2.md](docs/architecture/PERMISSION_GATEWAY_R2.md), [UNIFIED_AUDIT_R3.md](docs/architecture/UNIFIED_AUDIT_R3.md), [SKILL_MANIFEST_R4.md](docs/architecture/SKILL_MANIFEST_R4.md) y [GOVERNED_PROCEDURE_CANDIDATE_R5.md](docs/architecture/GOVERNED_PROCEDURE_CANDIDATE_R5.md). El [Roadmap](Roadmap.md) gobierna el orden R1–R10 y el [documento maestro](docs/alice_documento_maestro.html) conserva la especificación completa.

### Arquitectura políglota controlada

Alice utiliza varios lenguajes porque cada uno tiene una responsabilidad distinta, no para aumentar el *stack* sin necesidad:

| Tecnología | Responsabilidad actual | Límite de autoridad |
|---|---|---|
| TypeScript + React | Interfaz, visualizaciones, contratos defensivos y estado visible | No concede permisos nativos ni conserva credenciales |
| Rust + Tauri | Fuente de verdad local para permisos, auditoría, memoria, rutas y acceso gobernado al sistema | No delega decisiones de seguridad a la interfaz |
| Python | Proceso auxiliar local para señal efímera de cámara y micrófono; futuro lugar natural para visión, audio y evaluación de modelos | Se inicia desde Rust, no decide permisos y no persiste contenido crudo |
| HTML + CSS + SVG/WebGL | Presentación adaptable, iconografía y volumen neuronal interactivo | No contiene lógica de autoridad |

Python ya participa en `sensory.rs`: OpenCV comprueba señal real de cámara y `sounddevice`/NumPy comprueban señal real del micrófono. Su siguiente ampliación útil será percepción local comprobable; la UI, las credenciales y las decisiones finales de permiso seguirán fuera de Python.

## Pruebas

```powershell
npm test
npm run build
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
```

Las pruebas del registro verifican serialización, esquema, IDs únicos, estados planificados, salud, idempotencia y rechazo de datos mal formados. Las pruebas operativas deben usar dispositivos y archivos reales cuando corresponda, sin fabricar métricas en la interfaz y sin conservar contenido sensorial crudo por defecto.

## Repositorio y continuidad

- Repositorio canónico privado: `enri312/alice-cognitive-core`.
- Rama vigente: `master`.
- El avatar privado y `data/` no se versionan.
- No se deben publicar claves, recuerdos, grabaciones ni capturas privadas.
- El checkpoint de R1 y de la interfaz acumulada fue creado después de revisar secretos, archivos privados y resultados de prueba.

La regla operativa continúa siendo: **mostrar qué se desea observar o hacer, obtener autorización específica y revocable, y solo entonces ejecutar**.
