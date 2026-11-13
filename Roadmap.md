# Roadmap de Alice Continuum

Autor y propietario: Carlos Nuñez  
Última actualización: **2026-11-12**. Identidad adoptada: 2026-09-16.  
Producto: **0.1.0** · documento maestro: **0.65**.  
Estado: R1 a R8 cerradas en sus alcances documentados; **R9 en progreso**; R10 futura.

**Prioridad vigente:** estabilizar captura y transcripción con la voz del
propietario y mantener un diagnóstico compacto, sin incorporar más funciones a
Conversación antes de la aceptación de R9. El núcleo cognitivo, el autoestudio
limitado a las materias autorizadas y su proyección en Obsidian conservan sus
avances. Siguen pendientes la revisión de contratos, la aceptación personal del
ciclo de aprendizaje y los incrementos de estructura que esa revisión justifique.
Ver [estructura y pendientes](docs/testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).

En paralelo continúa la aceptación de conversación, escucha, voz, percepción y
acciones de PC ya delegadas de R9. Gemma local mantiene el diálogo; Whisper local
CPU transcribe español y Fish da voz. Small se evalúa junto a base. Las pruebas sintéticas no cierran la
aceptación con Carlos y música real. **Domótica queda fuera de este tramo y el
avatar va al final**. Atlas y Nerumi son referencias, no capacidades incorporadas.
La actualización de voz y personalidad mantiene a Alice con un estilo inspirado
en Akali: directo, seguro, informal y con humor seco ocasional, conservando
empatía, humildad, veracidad y autorización. Su aceptación queda separada del
reconocimiento por micrófono, que sigue sin resolverse.
El [próximo paso autorizado](#próximo-paso-autorizado) fija el orden y sus criterios.

## Propósito

Esta hoja de ruta ordena la evolución de Alice desde el prototipo actual hacia una asistente personal con memoria, habilidades y capacidades locales gobernadas. Cada fase debe terminar con evidencia verificable antes de comenzar la siguiente.

Alice no se integrará al kernel de Windows. La integración con el equipo se realizará en el nivel de aplicación mediante comandos Tauri, APIs documentadas, adaptadores locales y permisos explícitos.

## Principios que no se negocian

- **Local-first:** memoria, configuración, permisos y auditorías pertenecen a Carlos Nuñez y permanecen en el equipo salvo autorización visible.
- **Denegación predeterminada:** una capacidad nueva comienza desactivada y sin acceso implícito a archivos, pantalla, red o procesos.
- **Datos reales:** el tablero muestra estados y eventos comprobables; no inventa actividad para que Alice parezca autónoma.
- **Autorización con alcance visible:** las operaciones con efecto externo usan una previsualización y confirmación o una delegación limitada ya concedida por el propietario. El modelo no amplía recursos, permisos ni duración por su cuenta.
- **Aprendizaje gobernado:** selección de citas conversacionales, autoestudio con currículo cerrado y propuestas de habilidades tienen políticas distintas. Una salida del modelo no se convierte por sí sola en un hecho confirmado del propietario ni en un permiso de ejecución.
- **Trazabilidad:** una decisión, recuerdo, asociación o habilidad debe indicar su origen y poder inspeccionarse.
- **Reversibilidad:** permisos, recuerdos y habilidades pueden corregirse, desactivarse o restaurarse.
- **Compatibilidad:** las migraciones preservan los datos existentes, crean respaldo y nunca usan los recuerdos personales como datos de prueba.
- **Una fase por vez:** no se inicia la fase siguiente hasta cumplir los criterios de aceptación de la fase activa.
- **Fronteras visibles:** mente, cuerpo, entorno y gobierno del propietario no comparten identidad ni pantallas; toda señal que cruce una frontera usa capacidades, permisos y auditoría.

## Línea base existente

| Bloque | Estado | Evidencia actual |
|---|---|---|
| Contrato y límites | Completo | Documento maestro, decisiones y diagramas de ingeniería. |
| Núcleo observable | Base completa; evolución visual ampliada | Volumen bilateral con registros reales, crecimiento visual acotado e incorporación de aprendizajes. El mapa de módulos permanece en Flujo cognitivo. Importancia, color afectivo confirmado, aristas R8 y controles conservados; señales R3 separadas de la demostración. |
| Conversación y voz | Implementadas; aceptación cotidiana pendiente | Gemma local, proveedores alternativos, Whisper CPU con selección small/base, Fish y sesión de escucha con parada. |
| Memoria y recuperación | Funcionales | Registros confirmados, perfil, selección automática de citas y autoestudio en almacenes separados; recuperación con procedencia y controles propios. |
| Ciclo y consolidación | Funcionales en sus alcances | Vigencia, accesibilidad, revisión, edición versionada y respaldo. La fusión canónica sigue bloqueada. |
| Autoestudio al arrancar | Implementado; aceptación personal en curso | 42 lecciones en 14 áreas, ejercicios, avance y repaso; sólo se recuperan lecciones activas con el último ejercicio aprobado. |
| Obsidian | Proyección implementada | Sincronización Alice → Obsidian de datos guardados; editar notas generadas no enseña contenido a Alice. |
| Respaldo integral | Implementado | Inicio, cada 15 minutos y cierre normal; copia verificada y restauración en otra carpeta. Copia en otra unidad física pendiente. |
| Avatar VRM | Visor funcional | Carga privada, DualSense, 12 clips retargeteados, IK y máquina de siete estados; voz, aprendizaje, decisiones corporales y Ragdoll siguen desconectados. |
| Acciones de PC delegadas | Alcance cerrado implementado | Spotify, YouTube y apertura de D:/E: según plataforma y delegación vigente; no hay shell libre ni control general del PC. |

## Avances incorporados el 10 y 11 de noviembre de 2026

- **Autoestudio y Obsidian:** currículo local con fuentes, progreso persistido en
  `data/memory/self-study-v1.json` y proyección de lecciones y ejercicios.
  [Funcionamiento y límites](docs/runbooks/06-autoestudio-al-arrancar.md).
- **Estructura del núcleo:** autoestudio separado en contratos, reglas,
  persistencia, adaptación a Gemma y coordinación nativa. La aplicación sigue
  siendo un monolito parcialmente modularizado.
  [ADR-P-113](docs/decisions/ADR-P-113-autoestudio-modular.md).
- **Memoria:** cuatro accesos —Aprendizaje, Recuerdos, En sesión y Mantenimiento—;
  autoestudio primero, icono de conocimiento con fuentes conectadas y nombres
  completos en la barra compacta. Escucha y cierre de eventos autorizados sólo
  para la ventana local principal.
  [Uso de Memoria](docs/MANUAL_DE_USO.md#5-memoria-qué-significa-cada-pestaña).
- **Respaldo y arranque:** copias integrales verificadas; el lanzador Windows
  coordina las comprobaciones en una sesión PowerShell, evita arranques simultáneos
  y conserva `--check` sin abrir Alice ni iniciar modelos o respaldos.
  [Arranque](docs/runbooks/01-arranque-local.md) ·
  [Respaldo y restauración](docs/runbooks/07-respaldo-integral.md).
- **Documentación y publicación:** README con tecnologías y versiones verificadas;
  cambios integrados en la rama principal `master` de
  [alice-continuum](https://github.com/enri312/alice-continuum).

- **Volumen y evolución:** representación del cerebro lógico con nodos vinculados
  a registros y seguimiento de cambios observados al aprender, sin duplicar el
  mapa de módulos de Flujo cognitivo.
  Los intentos de estudio permanecen visibles con su estado, separados de RAG;
  la actividad R3 y el modo Demostración tienen fuentes y significados distintos.
  [ADR-P-115](docs/decisions/ADR-P-115-volumen-cognitivo-y-evolucion-visible.md).

- **Fuentes de aprendizaje y núcleo:** lecturas serializadas y recuperables,
  eventos con respaldo periódico, mutaciones protegidas frente a respuestas
  antiguas y coordinación extraída de `App.tsx`. El Volumen muestra fase registrada,
  última lectura y errores, con reintento de consulta; la leyenda queda plegada
  fuera del lienzo. [ADR-P-116](docs/decisions/ADR-P-116-fuentes-de-aprendizaje-observables.md).

- **Colores y revisión nativa del Volumen:** relleno por tipo o asociación
  emocional revisada; estados en contornos y recuperación en anillo blanco,
  con guía y ficha derivadas de las mismas definiciones. Se revisaron la página,
  sus fuentes y la actualización de lecturas en Tauri. El fallo del canal anterior
  de automatización se resolvió usando la conexión compatible.
  [ADR-P-117](docs/decisions/ADR-P-117-colores-y-marcas-del-volumen.md).

- **Fiabilidad del aprendizaje y prioridad:** una respuesta no evaluable conserva
  el conocimiento anterior y termina el ciclo con un aviso, sin calificaciones
  ficticias. El motor reserva la prioridad de conversación antes de la cola y
  vuelve a comprobar la cesión al recibir una respuesta. La prioridad vive en
  un módulo privado separado del transporte y del proceso.
  [ADR-P-118](docs/decisions/ADR-P-118-evaluacion-fiable-y-prioridad-de-conversacion.md).

- **Reanudación del estudio y continuación R9:** pausa invalida el ciclo anterior;
  reanudar mientras termina conserva una única solicitud y la libera al cerrar
  el worker. Activar de nuevo un estudio activo conserva su fase. El icono del
  Volumen incorpora crecimiento observado y contornos de estado; Spotify en
  Windows admite la playlist privada configurada, comprobando su identificador
  en el contexto de reproducción.
  [Coordinación](docs/decisions/ADR-P-119-reanudacion-del-autoestudio.md) ·
  [Spotify](docs/decisions/ADR-P-120-playlist-spotify-configurada.md).

**Última validación registrada, 12 de noviembre:** 824 pruebas frontend aprobadas
(2 sondas omitidas), 393 Rust (30 sondas omitidas), 15 de Obsidian y 20 de respaldo;
compilación frontend, formato Rust y Clippy aprobados. La navegación se comprobó a 1440,
1000 y 420 píxeles en una vista aislada sin backend ni datos personales. El Volumen
también se inspeccionó en Tauri con sus fuentes nativas; esto no acredita por sí
solo voz ni el ciclo completo de aprendizaje y Obsidian.
La playlist privada de Spotify se comprobó mediante una orden escrita en Alice,
con control de pausa de cabecera, ID de contexto y recibo coincidentes. La orden
hablada también produjo el recibo y el propietario confirmó música y voz. El
filtro falló después; se añadió descarte y único rearme de captura por sesión.
La estabilidad prolongada y los cinco turnos con música siguen pendientes.
La pérdida de «pausa» también se observó al repetir una orden corta. Whisper
deja de recibir una lista fija como texto inicial; una mención de servicio sin
acción pide aclaración antes de Gemma y de cualquier herramienta. La repetición
acústica con este ajuste permanece pendiente.
[ADR-P-122](docs/decisions/ADR-P-122-transcripcion-sin-texto-prefijado.md).
Por la petición de mayor sensibilidad para voz baja se añadió un perfil de
ganancia 4× y pausa de cierre de 2 s, con opción Normal y sin modificar los
criterios mínimos de voz. En la repetición personal hubo una orden corta de
pausa correcta y otras con palabras sustituidas; la precisión no es estable.
[ADR-P-123](docs/decisions/ADR-P-123-voz-baja-y-pausada.md).
Se instaló small multilingüe junto a base, sin cambiar la captura.
La configuración se fija una vez por toma y el resultado identifica ese modelo;
la selección explícita por entorno conserva prioridad. La aceptación acústica
y la precisión de small con la voz del propietario no están aceptadas: la
prueba posterior volvió a sustituir palabras. No se pudo observar si la toma
terminó mientras aún hablaba. El siguiente diagnóstico usa dictado manual con
cierre por botón y texto en revisión; no ejecuta la transcripción dudosa.
El detalle incorpora modelo ASR y duración de la toma, antes descartados por
la interfaz. Se mantienen los filtros para aislar el problema.
El acceso detrás de dos controles se sustituye por **Dictar con botón**,
visible desde el inicio. Abrirlo no activa el micrófono y la escucha automática
bloquea la captura manual con una indicación visible. Tras ese cambio se observó
una toma manual terminada en revisión; el propietario confirmó que dijo
«Alice pausa Spotify» y la transcripción volvió a sustituir palabras. La revisión
continúa sobre la entrada de audio y el reconocimiento; el cierre automático
por silencio no explica por sí solo esta toma manual.
Se retira sólo en Voz baja y pausada la atenuación adicional posterior a RNNoise,
que reducía la señal estimada como poco probable voz hasta el 8 %. Se conservan
RNNoise, supresión del navegador, ganancia 4×, modelo y detector de fin de frase.
La prueba de señal controlada no acredita por sí sola que conserve todas las
palabras del propietario; la repetición acústica sigue pendiente.
[ADR-P-125](docs/decisions/ADR-P-125-conservar-voz-baja-filtrada.md) ·
[Pruebas de señal](docs/testing/SOFT_VOICE_SIGNAL_REPORT_2026-11-12.md).
La repetición personal siguió cambiando palabras. Se añade diagnóstico local
de entrada/salida y saturación, junto a escucha de la toma filtrada antes de
transcribir y un resultado ASR separado del borrador. Se mantiene la cadena
de audio para medirla antes de decidir otro ajuste. La claridad del sonido y
la precisión de la frase real siguen pendientes.
[ADR-P-126](docs/decisions/ADR-P-126-diagnostico-local-de-audio.md) ·
[Diagnóstico de entrada](docs/testing/VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).
Por prioridad del propietario, se incorpora una personalidad compartida para
texto, voz y visión y una selección de voz Fish privada en
`data/voice-profile.json`. El perfil local prevalece; la variable heredada sólo
se consulta si no existe ese archivo. No se cambia el modelo TTS
`s2.1-pro-free`, el reconocedor ni la cadena de captura. La nueva voz tuvo
síntesis exitosa de una frase revisada en Tauri. La valoración audible
y la aceptación cotidiana del estilo quedan pendientes del propietario; no
cierran el fallo de reconocimiento ni R9.
[ADR-P-127](docs/decisions/ADR-P-127-voz-privada-y-personalidad-alice.md) ·
[Verificación del incremento](docs/testing/ALICE_VOICE_PERSONALITY_REPORT_2026-11-12.md).
El propietario confirmó que dijo «Alice reproduce Spotify»; el reconocedor
cambió el verbo y el modelo respondió con una formulación que no correspondía
a una ejecución real. Se añade un único resultado efímero de entrada no atendida
dentro del desplegable existente **Audio de entrada**, cerrado inicialmente.
La escucha sólo muestra un indicador breve; se distingue **Escuchando** de
transcribir, responder y reproducir. La validación de medios pide aclaración
para el fragmento ambiguo cubierto sin convertirlo en otra orden.
No se cambia DSP, modelo ASR, voz privada ni personalidad; la precisión sigue
pendiente. Pasaron 393 tests Rust y 824 frontend, con 30 y 2 sondas omitidas,
respectivamente, y la compilación TypeScript/Vite. La variación de assets es
2.366 bytes (0,031 %), con cinco assets; no mide CPU o arranque nativo.
Clippy y formato también aprobaron. En Tauri se comprobó la aclaración por
texto y el detalle de descartes; la aceptación acústica continúa pendiente.
[ADR-P-128](docs/decisions/ADR-P-128-feedback-de-escucha-y-aclaracion-local.md) ·
[Resultados y pendientes](docs/testing/VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md).
Una toma manual posterior mostró recorte de entrada con ganancia 4×. Se reduce
únicamente la ganancia de **Voz baja y pausada** a **2×**, conservando Normal,
filtros, VAD, cierre de 2 s, dispositivo y modelos. No se añaden controles,
dependencias, procesos o timers. Pasaron 824 pruebas frontend y la compilación;
la repetición acústica queda pendiente. La frase de esa toma fue «parar y revisar audio»:
el propietario había pronunciado la etiqueta del botón. Se aclara que debe pulsarlo con el ratón. El dato
de recorte no demuestra la causa única de una transcripción incorrecta.
Los incrementos anteriores conservan sus valores históricos de 4×.
[ADR-P-124](docs/decisions/ADR-P-124-modelo-whisper-small.md) ·
[Evaluación](docs/testing/WHISPER_SMALL_REPORT_2026-11-12.md).
[Prueba con micrófono y recuperación](docs/testing/VOICE_PLAYLIST_ACCEPTANCE_REPORT_2026-11-11.md).
[Continuación del núcleo y R9](docs/testing/COGNITIVE_R9_CONTINUATION_REPORT_2026-11-11.md).
[Resultados y alcance](README.md#verificación).

El propietario confirmó que puede ver el progreso del autoestudio. Aún deben
comprobarse de forma conjunta la continuidad tras reinicio, la recuperación con
fuente y la actualización de Obsidian en su instalación.

## Secuencia de materialización

Las fases `R1` a `R10` organizan las capacidades gobernadas. El prefijo `R` evita
confundirlas con las fases históricas 0 a 4 del documento maestro. Los incrementos
fechados conservan su evidencia y límites de entonces; el estado y la prioridad
vigentes son los del inicio de este documento. Cerrar R1 a R8 no declara terminadas
la aceptación de R9 ni la distribución de R10.

### Fase R1 — Registro de capacidades

**Estado:** completada el 2026-08-09 · evidencia real y checkpoint Git aprobados  
**Objetivo:** crear una fuente de verdad sobre lo que Alice realmente puede observar o hacer.

Cada capacidad tendrá como mínimo:

- identificador estable y versión;
- nombre y descripción comprensible;
- tipo: observación, consulta, propuesta o acción;
- adaptador responsable;
- estado real: no configurada, disponible, desactivada, activa o con error;
- nivel de riesgo;
- requisitos y permisos necesarios;
- contrato de entrada y salida;
- comprobación de salud;
- fecha y resultado de la última ejecución real.

**Primer alcance:** registrar capacidades que ya existen, como conversación de nube, memoria local, observación autorizada de ventana y visor VRM. Los futuros puentes de voz, rostro, cuerpo o archivos y las entradas sensoriales definidas en ADR-P-043 aparecerán como planificadas y no disponibles, sin abrir dispositivos ni producir telemetría simulada.

**No incluye:** ejecutar comandos, modificar archivos, navegar automáticamente ni instalar habilidades.

**Criterios de aceptación:**

- [x] Existe un contrato tipado y versionado para describir capacidades.
- [x] El backend produce el estado; React no lo inventa ni duplica.
- [x] La pestaña Puentes consume el registro y distingue disponibilidad de activación.
- [x] Una capacidad desconocida o mal formada queda rechazada.
- [x] Hay pruebas de serialización, estados y compatibilidad.
- [x] El documento maestro y una ADR describen el contrato adoptado.

### Fase R2 — Gateway de permisos

**Estado:** completada en su alcance inicial · ventana, cámara, micrófono y autorización facial protegidos  
**Dependencia:** Fase R1  
**Objetivo:** convertir el registro en una frontera única que autorice o rechace cada uso.

Niveles iniciales de autorización:

1. **Observar:** consultar un estado sin modificar recursos.
2. **Proponer:** preparar una acción sin ejecutarla.
3. **Ejecutar con aprobación:** realizar una acción una sola vez después de confirmar su previsualización.
4. **Automatización limitada:** reservado para una fase posterior; comienza deshabilitado.

Cada solicitud deberá tener alcance, recurso objetivo, vencimiento, motivo, riesgo e identificador idempotente para evitar ejecuciones duplicadas.

**No incluye:** acceso administrativo, PowerShell libre, escritura fuera de rutas autorizadas ni permisos permanentes creados por el modelo.

**Criterios de aceptación:**

- [x] La política predeterminada es denegar.
- [x] Las previsualizaciones son inmutables entre aprobación y ejecución.
- [x] Los permisos son específicos, revocables y tienen vencimiento cuando corresponde.
- [x] Cancelar o cerrar la solicitud no produce efectos secundarios.
- [x] Las pruebas cubren autorización, rechazo, expiración, revocación y duplicados.

**Extensión facial sin ejecución:** `perception.face.landmarks` dispone de un perfil R2 `critical`
independiente, limitado a 60 segundos y al alcance `facialLandmarksEphemeral`. Rostro permite
preparar, aprobar, denegar, cancelar y revocar; aprobar todavía no abre la cámara ni inicia MediaPipe.
El ejecutor sensorial genérico rechaza el grant facial y la capacidad R1 continúa planificada hasta
incorporar un adaptador dedicado con indicador, parada y auditoría operacional.

### Fase R3 — Auditoría unificada y diagnóstico

**Estado:** completada · cinco incrementos implementados y validados  
**Dependencia:** Fase R2  
**Objetivo:** demostrar qué solicitó Alice, qué política se aplicó y cuál fue el resultado.

Se unificará un sobre de eventos para memoria, nube, capacidades y permisos. Registrará metadatos mínimos: identificador, fecha, origen, capacidad, decisión, resultado, duración y huellas cuando sean necesarias. No guardará claves ni copiará automáticamente contenido privado.

La pestaña Actividad será una lectura comprensible de eventos reales; los archivos JSONL locales seguirán siendo la evidencia persistente. Un diagnóstico verificará proveedores, rutas, versiones de datos, adaptadores y permisos sin alterar su estado.

**Criterios de aceptación:**

- [x] Existe un esquema versionado de eventos.
- [x] Actividad diferencia solicitud, autorización, ejecución, bloqueo y error.
- [x] Los eventos correlacionados comparten un identificador de operación.
- [x] Memoria y nube producen eventos mínimos sin copiar contenido privado.
- [x] El diagnóstico es de solo lectura y no expone secretos.
- [x] La rotación o crecimiento de auditorías tiene una política documentada.
- [x] El Núcleo deriva regiones, enlaces e intensidad de eventos R3 recientes y etiqueta la heurística.

### Línea transversal — Simulación afectiva explicable

**Estado:** asociación afectiva de recuerdos implementada; motor temporal pendiente  
**Dependencia:** R3 para evidencia; R6 para memoria por capas; R9 para expresión

Alice tiene diez canales definidos: Alegría, Tristeza, Ira, Temor, Desagrado, Ansiedad, Envidia, Aburrimiento, Vergüenza y Nostalgia. Un recuerdo conversacional nuevo puede conservar hasta tres emociones explícitas, cada una con intensidad y cita literal revisada por Carlos. El volumen mezcla esos colores; tamaño e intensidad siguen siendo magnitudes separadas. El estado afectivo efímero de Alice permanece apagado, sin emoción dominante.

El futuro motor deberá explicar qué señal modificó cada canal, aplicar decaimiento, separar estado efímero de memoria y permitir desactivar su influencia sobre comportamiento y avatar. No se presentará como conciencia, sentimiento biológico ni diagnóstico del usuario. El diseño completo está en `docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md`.

### Fase R4 — Taller de habilidades

**Estado:** completada el 2026-08-10 · cinco incrementos implementados y validados  
**Dependencia:** Fase R3  
**Objetivo:** permitir que Carlos enseñe procedimientos reutilizables sin dar autonomía irrestricta al modelo.

Una habilidad será un manifiesto local versionado que declare:

- propósito, autor y procedencia;
- pasos visibles;
- capacidades requeridas;
- entradas, resultados y condiciones previas;
- nivel de riesgo y permisos;
- pruebas o comprobaciones de éxito;
- estado: borrador, en revisión, aprobada, desactivada o retirada.

La primera versión permitirá crear, editar, validar y simular habilidades. Toda habilidad comenzará como borrador desactivado.

**No incluye:** descargar habilidades de terceros, generar ejecutables, modificar su propio validador ni activar una habilidad automáticamente.

**Criterios de aceptación:**

- [x] El esquema rechaza pasos, operaciones o capacidades no registradas.
- [x] La simulación muestra el plan sin ejecutar efectos.
- [x] Aprobar, desactivar, restaurar, retirar y versionar queda auditado.
- [x] Una habilidad conserva el principio de menor privilegio.
- [x] Hay al menos una habilidad local de solo lectura validada de extremo a extremo.

### Fase R5 — Aprendizaje gobernado de procedimientos

**Estado:** completada el 2026-08-13 · cinco incrementos implementados y validados  
**Dependencia:** Fase R4  
**Objetivo:** permitir que Alice detecte procedimientos repetidos y proponga convertirlos en habilidades.

Alice podrá generar un candidato únicamente a partir de ejecuciones exitosas y auditadas. La propuesta mostrará los pasos observados, repeticiones, diferencias, capacidades necesarias y evidencia de origen. Carlos decidirá si la corrige, prueba, aprueba o descarta.

**No incluye:** autoactivación, reescritura silenciosa de habilidades aprobadas ni considerar una respuesta del proveedor como instrucción confiable.

**Criterios de aceptación:**

- [x] Una propuesta contiene evidencia suficiente para reconstruir su origen.
- [x] La detección evita proponer tareas triviales o de una sola aparición.
- [x] Aprobar crea una nueva revisión; no sobrescribe la anterior.
- [x] Rechazar no modifica capacidades ni memoria duradera.
- [x] Existe restauración de una versión anterior mediante el ciclo R4 del borrador derivado.

**Incremento R5.1:** contrato cerrado de candidatos sustentados en R1 y R3. Exige al menos tres ocurrencias, dos pasos, riesgo no reducido y diferencias recalculables; mantiene sólo propuesta, sin comandos, persistencia, memoria duradera, autoactivación ni ejecución.

**Incremento R5.2:** detector efímero y de sólo lectura sobre la ventana visible R3. Excluye eventos no productores, capacidades planificadas, pasos únicos y secuencias con orden temporal ambiguo. La prueba canónica examinó 22 eventos y devolvió 0 ejecuciones calificadas y 0 patrones sin modificar ninguno de los 10 archivos de datos.

**Incremento R5.3:** almacén separado de decisiones bajo `data/procedures`, con una decisión inmutable `retain` o `dismiss` por huella y confirmación explícita del propietario. Conservar guarda un candidato validado y su SHA-256; descartar no guarda metadatos del candidato y el motivo se reduce a digest. La pestaña **Procedimientos** vive en Governance, separada del Taller R4. La sonda canónica real examinó 200 eventos, encontró 0 patrones y 0 decisiones y no creó el almacén; ejecución y borrador R4 continúan deshabilitados.

**Incremento R5.4:** conversión explícita y de uso único desde un candidato `retain` a un borrador R4 nuevo. El manifiesto conserva `decisionId`, `candidateId`, fingerprint y SHA-256 como procedencia inmutable; R4 vuelve a validar capacidades, operaciones, riesgo y política `simulationOnly`. Un descarte, digest distinto, huella ya usada o identidad ocupada no escribe ni sobrescribe. La procedencia sobrevivió revisión, aprobación, desactivación y restauración en pruebas físicas temporales. La sonda canónica real devolvió 0 conversiones y no modificó datos.

**Incremento R5.5:** cierre de vigencia y evidencia. Cada decisión se clasifica como vigente, obsoleta, descartada, convertida o bloqueada. La auditoría no saludable produce bloqueo, no una falsa obsolescencia. La pantalla expone ocurrencias, eventos, pasos, variaciones, riesgo y límites. El backend vuelve a resolver R1/R3 antes de convertir y rechaza una huella obsoleta. Pruebas físicas temporales generaron eventos R3 mediante código real, escribieron un `retain`, recorrieron los cinco estados y verificaron por SHA-256 que el rechazo obsoleto no creó `skills/` ni modificó archivos existentes.

### Fase R6 — Memoria por capas y consolidación v2

**Estado:** completada el 2026-09-01 · ciclo canónico activado y verificado  
**Dependencia:** Fase R3; se integra con Fase R5  
**Objetivo:** separar lo que Alice está usando ahora de lo que recuerda de manera duradera.

Capas previstas:

- perfil y preferencias estables;
- memoria episódica de experiencias;
- memoria semántica de hechos enseñados;
- memoria procedimental vinculada a habilidades;
- memoria temporal con vencimiento;
- memoria de trabajo de la sesión actual.

La consolidación detectará duplicados, contradicciones, datos posiblemente obsoletos y candidatos a promoción. En su primera entrega será iniciada y confirmada manualmente. La frecuencia de recuperación, importancia, confianza, procedencia y recencia serán métricas independientes.

**Incremento R6.1:** `records.json` continúa como fuente histórica y una proyección separada `layer-index-v2.json` conserva sólo IDs, clasificación, revisiones y SHA-256. La vista previa no escribe; activar exige coincidencia de huella confirmada y releída por Rust; revertir desactiva sin borrar. La clasificación explícita envía conversaciones a episodios, enseñanzas semánticas a hechos enseñados y conserva procedimientos o preferencias como no clasificados. La sonda canónica leyó 10 recuerdos: 9 episodios, 0 hechos enseñados, 1 procedimiento pendiente y 0 memoria de trabajo; los 10 archivos mantuvieron sus SHA-256.

**Incremento R6.2-A (histórico):** introdujo memoria de trabajo nativa dentro del proceso con tres intercambios, seis mensajes, 48.000 caracteres y TTL de 30 minutos. Sólo una respuesta recibida del proveedor entra en RAM; vencer, vaciar o cerrar Alice elimina el contenido sin tocar memoria duradera. R3 recibe digests, no texto. El vaciado visible se incorporó en R6.2-B.

**Límites vigentes de RAM:** seis intercambios completos, doce mensajes,
72.000 caracteres y TTL de dos horas, definidos en `src-tauri/src/working_memory.rs`.
Estos valores sustituyen los del incremento inicial.
[Contrato actual](docs/architecture/WORKING_MEMORY_R6.md).

**Incremento R6.2-B:** la vista actual `Memoria → En sesión` muestra estado, mensajes, intercambios, caracteres, porcentaje, TTL, generación y procedencia desde el snapshot nativo. No repite texto conversacional. Vaciar exige confirmación visible y la generación exacta; una generación obsoleta se bloquea. El navegador declara `SIN BACKEND` y no simula métricas.

**Incremento R6.2-C:** la previsualización obligatoria calcula caracteres Unicode y bytes UTF-8 exactos para mensaje, historial, recuerdos, ventana y separadores usando la misma cadena saliente. Una fuente opcional no autorizada cuenta cero; no se inventan tokens dependientes del proveedor.

**Incremento R6.3-A (histórico):** `consolidation_preview` relee `records.json` sin escribir y produce pares ligados al SHA-256 de la fuente. Sólo llama duplicado exacto a tipo, clase, intención, resumen y próximo paso normalizados iguales; una misma intención con contenido diferente queda como revisión requerida, no contradicción automática. La sonda canónica leyó 10 registros y devolvió cero candidatos con 10 archivos intactos. La vista actual `Memoria → Mantenimiento → Consolidación` muestra el resultado nativo. En este incremento inicial, fusión, archivado y resolución permanecían bloqueados; los apartados siguientes describen las autorizaciones añadidas después.

**Incremento R6.3-B:** `resolve_consolidation_candidate` acepta exclusivamente `keepSeparate`. La orden exige confirmación, SHA-256 vigente, ID de candidato y los dos IDs ordenados. Antes de persistir crea un respaldo de `records.json` ligado a su huella; luego registra una decisión lateral, inmutable e idempotente, y auditoría sin texto privado. La interfaz conserva el par visible como resuelto. No reescribe recuerdos ni habilita fusión o archivado. La sonda canónica negativa rechazó un candidato inexistente y preservó los 10 archivos.

**Incremento R6.3-C:** `preview_consolidation_merge` acepta únicamente duplicados exactos pendientes y exige que Carlos seleccione uno de los dos registros como superviviente. Rust relee y valida la fuente, confirma el candidato y proyecta conteo, SHA-256, bytes, diferencias originales, respaldo e impacto sobre R6.1. La interfaz no contiene ejecución. En datos controlados se verificaron respaldo ausente y existente, revisión R6.1 activa y cero escrituras; la sonda canónica leyó 17 registros, halló cero candidatos y conservó las huellas de 20 archivos.

**Incremento R6.3-D:** el plan v2 declara ocho pasos obligatorios de recuperación. Un motor Rust deliberadamente desconectado de Tauri creó un respaldo físico, sustituyó una fuente controlada mediante `MoveFileExW`, verificó la proyección, escribió auditoría R3 y restauró los bytes originales. Un fallo de auditoría inducido también terminó restaurado. R6.1 activa bloqueó antes de escribir. La memoria canónica no se sometió al ensayo y sus 20 archivos conservaron sus SHA-256.

**Incremento R6.3-E:** un recibo transaccional durable v1 conserva IDs, huellas, respaldo, fechas y los estados cerrados `prepared`, `projected` y `restored`, sin texto privado. Una recuperación iniciada desde una llamada nueva y sin plan en RAM restauró físicamente una fuente proyectada, dejó pendiente un fallo de auditoría, lo reintentó y cerró de forma idempotente. Un recibo corrupto o una tercera huella bloquearon sin sobrescribir. Preparación y recuperación permanecen desconectadas de IPC y no se ejecutaron sobre memoria canónica.

**Incremento R6.3-F:** `consolidation_recovery_status` expone estado nativo de sólo lectura y `restore_consolidation_transaction` restaura únicamente un recibo pendiente con confirmación, ID y ambas huellas vigentes. La solicitud debe auditarse antes de tocar la fuente y el recibo se cierra sólo después de auditar el éxito. Repetir una restauración cerrada es idempotente. La preparación y la fusión siguen desconectadas de IPC. La sonda canónica devolvió `idle`, 17 recuerdos y 20 archivos intactos.

**Incremento R6.4-A:** una respuesta realmente recibida de un proveedor puede guardarse como episodio local cuando **Aprendizaje episódico local** está activo. El registro conserva proveedor y modelo, comienza con fuerza baja y confirma que la conversación ocurrió, no la verdad factual de la respuesta. La recuperación posterior lo rotula como episodio no verificado. La extracción de hechos, preferencias o hábitos continúa pendiente y requerirá candidatos revisables.

**Incremento R6.4-B:** `memory.learning.propose` relee un recuerdo elegido, lo limita a 12.000 caracteres y solicita a Ollama local hasta cuatro candidatos cerrados. Rust rechaza modelos cloud, tipos desconocidos, límites excedidos y cualquier evidencia que no aparezca literalmente en la fuente. La vista permite corregir título, clase, contenido e importancia, declara cero escrituras y exige confirmación separada para usar el almacén normal de Memoria. Tres pruebas reales devolvieron 0, 0 y 4 candidatos; las cuatro evidencias del caso extenso coincidieron y `records.json` conservó su SHA-256.

**Incremento R6.4-C:** `confirm_learning_candidate` mueve la confirmación completa a Rust. El comando relee la fuente, reconstruye la propuesta, compara su ID y SHA-256, valida la edición y realiza respaldo exacto, reemplazo atómico y auditoría bajo un bloqueo compartido de escritura. Un fallo de auditoría restaura `records.json`; un reintento idéntico es idempotente y uno alterado se rechaza. La sonda real rechazó una huella obsoleta y conservó intactos los 21 archivos canónicos; las escrituras positivas se limitaron a directorios físicos temporales para no insertar recuerdos ficticios.

**Incremento R6.5-A:** ADR-P-084 define la memoria como ciclo funcional de codificación, memoria de trabajo, candidatura, consolidación, recuperación, reconsolidación versionada, debilitamiento funcional, supresión voluntaria, archivo y borrado gobernado. La interfaz **Memoria** deja de comportarse como un formulario separado de enseñanza y vuelve a ser inspección y control del sistema. La primera proyección trazable del volumen usa un círculo por registro real y un rombo únicamente por recuperación actual o proceso R3 con evidencia; una instalación vacía no genera relleno y no se dibujan asociaciones persistentes inexistentes. Este incremento establece contrato y proyección: los estados avanzados del ciclo todavía no se persisten ni ejecutan.

**Incremento R6.5-B:** `memory_lifecycle_preview` valida `records.json` en Rust y genera una referencia trazable por registro con SHA-256, vigencia explícita, política de recuperación vigente y versión base. Los registros sin estado quedan `notAssessed`; no se infieren debilitamiento, supresión ni reconsolidación desde `storageStrength`, antigüedad o frecuencia. La pestaña **Ciclo** integra esta vista con la cola de vigencia. El futuro `lifecycle-index-v1.json` se declara como destino, pero toda escritura y activación permanecen deshabilitadas hasta contar con contrato durable, respaldo, auditoría y reversión.

**Incremento R6.5-C:** `activate_memory_lifecycle` y `rollback_memory_lifecycle` habilitan exclusivamente el índice lateral `lifecycle-index-v1.json`. La activación exige confirmación y SHA-256 vigente, conserva revisiones inmutables y es idempotente para la misma fuente. Un cambio real de `records.json` aparece como `sourceChanged` y requiere una revisión nueva. Cada reemplazo respalda el índice anterior por huella, relee y valida el documento, registra auditoría local y restaura el estado previo si ésta falla. Revertir elimina sólo el puntero activo; nunca reescribe recuerdos. Debilitamiento, supresión y reconsolidación continúan fuera del contrato v1.

**Incremento R6.5-D:** `assess_memory_validity` permite una sola transición inicial sobre recuerdos `notAssessed`: el propietario puede confirmarlos como vigentes o marcarlos en conflicto. La orden exige confirmación, huella exacta de `records.json` y huella individual del registro. Antes de escribir crea un respaldo byte a byte, reemplaza la fuente de forma atómica, relee el resultado y registra auditoría; cualquier fallo posterior restaura la fuente original. La operación modifica únicamente `memoryStatus`, la fecha de revisión y el contador compatible con la decisión. No altera contenido, importancia ni `storageStrength`, y una revisión activa del índice queda visiblemente `sourceChanged` hasta una nueva activación.

**Incremento R6.5-E:** `assess_memory_accessibility` separa disponibilidad de recuperación y vigencia. Sólo un recuerdo confirmado puede declararse `accessible` o `dormant`; ponerlo en reposo lo excluye realmente del RAG léxico y de las rutas activas del volumen, pero conserva su nodo, contenido, fuerza e historial. La operación exige confirmación y ambas huellas, crea un respaldo exacto independiente, reemplaza `records.json` atómicamente y restaura ante fallo de validación o auditoría. Reactivar es una nueva decisión explícita y reversible. El volumen muestra el nodo dormido atenuado, sin presentarlo como recuperado.

**Incremento R6.5-F:** una respuesta real que utilizó RAG deja los recuerdos en espera de evaluación; responder técnicamente ya no incrementa recuperaciones exitosas ni fuerza. Carlos confirma por recuerdo si fue útil o no ayudó. Sólo esos resultados llevan `retrievalEvidenceVersion=1`; contadores heredados sin esa marca se excluyen. La vista nativa exige tres resultados antes de evaluar y señala revisión cuando al menos dos tercios no ayudaron. Es sólo evidencia funcional: `automaticAction=false` y ningún umbral duerme, debilita, suprime, archiva o elimina recuerdos.

**Incremento R6.5-G:** `assess_memory_suppression` permite al propietario suprimir o liberar un recuerdo mediante confirmación explícita, huellas vigentes y uno de tres motivos cerrados: decisión propia, contexto sensible o límite temporal. La supresión bloquea físicamente el RAG y atenúa el nodo real del volumen sin modificar contenido, fuerza, vigencia, accesibilidad ni contadores. Cada transición crea un respaldo exacto, reemplaza `records.json` atómicamente, relee la proyección y audita la decisión; un fallo restaura los bytes originales. Liberar es reversible incluso si después cambió la vigencia. Ninguna señal de debilitamiento ni salida de modelo puede activar esta operación.

**Incremento R6.5-H:** editar un recuerdo confirmado o en conflicto deja de usar la sobrescritura genérica. `preview_memory_reconsolidation` prepara una única versión sucesora, muestra campos y huellas y no escribe; `confirm_memory_reconsolidation` exige el mismo plan, una segunda confirmación y un motivo cerrado. La versión desplazada completa se guarda en `memory/revisions`, la fuente anterior se respalda y `records.json` conserva la versión vigente con su cadena SHA-256. Relectura, ciclo y auditoría son obligatorios; cualquier fallo restaura la fuente y retira la revisión incompleta. Recuperar, conversar o usar un modelo nunca activa reconsolidación. El guardado genérico tampoco puede eliminar registros durables ni fabricar estados gobernados. El volumen muestra sólo el nodo vigente y su número real de versión.

**Incremento R6.5-I:** el archivo nuevo se separa de vigencia, conflicto, reposo, supresión y eliminación. `preview_memory_archive` prepara sin escribir una transición `archive` o `restore`, ligada a ambas huellas, nota digestada y motivo cerrado; `confirm_memory_archive` exige el mismo plan y una segunda confirmación. El estado independiente `archiveStatus=archived` bloquea físicamente RAG y consolidación, pero conserva `memoryStatus`, contenido, fuerza, accesibilidad, supresión y versión. Cada transición crea respaldo exacto, reemplaza la fuente atómicamente, relee el ciclo y audita; cualquier fallo restaura los bytes anteriores. Restaurar elimina sólo los metadatos de archivo y recupera la política determinada por los demás ejes. Los `memoryStatus=archived` heredados siguen legibles, pero no se restauran fingiendo una vigencia previa desconocida.

**Incremento R6.5-J:** la eliminación durable queda separada del archivo reversible y nunca se deduce de antigüedad, fuerza, utilidad ni una salida de modelo. Sólo un recuerdo archivado por R6.5-I puede programarse mediante vista previa y segunda confirmación. La programación escribe un motivo cerrado, solicitud y fecha de elegibilidad exactamente siete días posterior; durante la espera el recuerdo permanece íntegro, archivado y la operación puede cancelarse. Vencido el plazo, `preview_memory_deletion` vuelve a verificar fuente, registro y reloj sin escribir; `confirm_memory_deletion` exige el mismo plan y otra confirmación, crea y relee un resguardo privado exacto, retira el registro de `records.json`, escribe una lápida digestada sin contenido y audita. Cualquier fallo restaura la fuente y retira la lápida incompleta. El resguardo no se presenta como borrado seguro del soporte físico.

**Incremento R6.6-A:** `layer-index-v3.json` amplía la proyección sin reinterpretar ni sobrescribir el v2 activo. Un registro que ya declara `memoryType=procedural` entra en una capa procedimental con `linkState=pendingR5`; esto reconoce su clase sin inventar una habilidad ni habilitar ejecución. La decisión inicial de vigencia exige ahora una procedencia de 1 a 300 caracteres cuando el registro carece de ella y la persiste dentro del mismo respaldo, reemplazo atómico y auditoría; una procedencia existente no puede sustituirse por esta ruta. La interfaz reutiliza **Capas R6** y **Ciclo**, sin crear otra página. La sonda canónica de sólo lectura proyectó 19 episodios, 1 procedimiento pendiente de R5 y 0 sin clasificar; los 21 archivos conservaron sus SHA-256 y no se creó v3.

Las futuras fuentes sensoriales —pantalla seleccionada, cámara, micrófono, reproductores, acciones accesibles y gestos— producirán primero observaciones efímeras y candidatos revisables. La señal cruda no se convertirá en memoria ni se conservará por defecto. Este alcance sigue dependiendo del registro de R1, el Gateway de R2 y la auditoría de R3, según ADR-P-043.

El tamaño visual de un nodo podrá representar fuerza o uso, pero nunca será prueba de verdad. Toda métrica deberá ser explicable desde registros reales.

**Criterios de aceptación:**

- [x] Cada recuerdo tiene capa, origen, estado y reglas de vigencia.
- [x] Los conflictos no se resuelven silenciosamente.
- [x] La consolidación ofrece vista previa y respaldo.
- [x] La memoria de trabajo puede descartarse sin borrar memoria duradera.
- [x] Los índices derivados pueden reconstruirse desde la fuente de verdad.

R6.1 satisface capa, procedencia y reconstrucción; R6.2 separa RAM y salida; R6.3-B permite mantener pares separados; R6.3-C proyecta una fusión; R6.3-D demuestra reemplazo atómico y restauración controlada; R6.3-E persiste el recibo y R6.3-F expone estado y restauración gobernada. Crear o ejecutar una fusión canónica continúa bloqueado y requerirá una decisión independiente.

**Preauditoría R6 · 2026-08-24:** las sondas Rust de sólo lectura encontraron 20 recuerdos reales y conservaron los SHA-256 de los 21 archivos canónicos. R6.6-A resolvió la brecha estructural de capa, pero quedaron nueve recuerdos `notAssessed` sin procedencia explícita. Esa evidencia histórica y el bloqueo correcto se conservan en `docs/testing/R6_CLOSEOUT_AUDIT_2026-08-24.md`.

**Cierre final R6 · 2026-09-01:** después de las decisiones explícitas del propietario y la retirada de registros inconclusos, `records.json` contiene 15 recuerdos reales: 13 vigentes y 2 conflictivos, sin recuerdos no evaluados ni procedencia faltante. La proyección `layer-index-v3.json` activa clasifica 14 episodios y 1 procedimiento `pendingR5`, sin elementos no clasificados. El ciclo `lifecycle-index-v1.json` también está activo sobre el mismo SHA-256 vigente. Las dos sondas canónicas de sólo lectura conservaron exactamente los 35 archivos de `data/` y su digest agregado. Los 2 conflictos permanecen visibles y excluidos de recuperación como conocimiento vigente; no bloquean el cierre porque R6 exige preservarlos, no resolverlos silenciosamente. Evidencia completa en `docs/testing/R6_CLOSEOUT_REPORT_2026-09-01.md`.

#### Ampliaciones de memoria autorizadas en noviembre

La selección automática de citas conversacionales del 3 de noviembre conserva
lo declarado por el propietario, su procedencia y los controles de pausa,
corrección y retirada. No reescribe los registros confirmados.
[ADR-P-101](docs/decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

El autoestudio incorporado el 10 de noviembre usa **42 lecciones iniciales en
14 áreas**, con tres niveles por área. Sus únicas materias son:

- Matemáticas: aritmética, álgebra, geometría, trigonometría, cálculo, álgebra
  lineal, probabilidad, estadística y lógica.
- Historia bíblica con enfoque católico, diferenciando relato, doctrina y
  corroboración histórica.
- Psicología de las emociones e inteligencia emocional.
- Empatía, solidaridad y humildad, cada una como área propia.

Con autoestudio habilitado, cada arranque nativo programa un ciclo que intenta
una lección por área; se avanza por las pendientes y se repasan las anteriores.
El ciclo usa Gemma local, respeta pausa y prioridad
de conversación/voz, y registra ejercicios aprobados o fallidos. El contenido
recuperable procede de la lección curada y su fuente; sólo se ofrecen lecciones
activas cuyo último ejercicio fue aprobado. El currículo inicial no cubre todas
las materias en profundidad ni modifica los pesos del modelo.

El progreso vive en `data/memory/self-study-v1.json`, separado de recuerdos
personales y perfil. Obsidian lo proyecta junto con las otras fuentes mediante
sincronización **Alice → Obsidian**; las notas generadas no amplían el currículo.
[Fuentes](docs/research/SELF_STUDY_SOURCES_2026-11-10.md) ·
[Prueba de arranque y límites](docs/testing/SELF_STUDY_STARTUP_REPORT_2026-11-10.md) ·
[Proyección en Obsidian](docs/runbooks/05-memoria-obsidian.md).

### Fase R7 — Tareas programadas e intenciones

**Estado:** completada · R7.5 validado el 2026-09-04  
**Dependencia:** Fases R2, R3 y R6  
**Objetivo:** diferenciar recuerdos, recordatorios temporales y acciones condicionadas.

La primera versión permitirá recordatorios locales y comprobaciones de solo lectura. Las tareas con efectos externos quedarán en modo propuesta hasta que exista una política específica y pruebas suficientes.

**Criterios de aceptación:**

- [x] Cada tarea muestra próxima ejecución, alcance, estado y opción de cancelación.
- [x] Reiniciar Alice no duplica ejecuciones.
- [x] Una tarea cancelada o terminal no puede volver a actuar.
- [x] El historial diferencia programación, intento, omisión y resultado.
- [x] El modo en segundo plano puede desactivarse completamente.

Cierre y alcance precisos en [el plan R7](docs/plans/R7-tasks-intentions.md) y
[la validación viva R7.5](docs/testing/R7_5_LIVE_VALIDATION_2026-09-04.md).
El reloj detecta vencimientos; las salidas requieren una decisión explícita y
mantienen reservas durables para evitar duplicados.

**Incremento R7.1:** `tasks-v1.json` queda reservado como un registro separado de `records.json`. El contrato cerrado distingue `localReminder` de `readOnlyCheck`, exige UUID, origen confirmado por el propietario, próxima ejecución, alcance, estado y cancelabilidad coherentes, y no admite comandos ni parámetros ejecutables. `task_registry_status` relee sin crear carpetas, bloquea archivos corruptos sin repararlos y siempre devuelve `automaticExecution=false`. R1 incorpora `tasks.registry.inspect` como consulta local implementada. Las pruebas físicas preservaron los bytes de fixtures válidos y corruptos; la sonda canónica confirmó la ausencia honesta del registro sin modificar `data/`.

**Incremento R7.2-A:** `preview_task_mutation` prepara sin escribir un recordatorio único o su cancelación y liga identidad, hora, alcance, fuente y revisión por SHA-256. `confirm_task_mutation` exige el plan íntegro y confirmación explícita, vuelve a leer la fuente, crea respaldo y revisión durable, actualiza el índice y registra auditoría sin título privado. La cancelación es idempotente. La capacidad `tasks.registry.write` eleva el inventario R1 a 28 capacidades. La interfaz visible y la primera tarea canónica quedan pendientes; no existe scheduler ni notificación.

**Incremento R7.2-B:** Planificador incorpora un bloque visual separado de control del propietario. Permite consultar el registro real, preparar sin escribir un recordatorio único, releer UUID, título, hora local, alcance, respaldo y ejecución apagada, confirmar mediante una casilla explícita y preparar cancelaciones con el mismo protocolo. Los contratos TypeScript rechazan respuestas abiertas o ejecución automática. La prueba viva preparó una vista previa y confirmó que `data/tasks/tasks-v1.json` continuó ausente: 0 tareas fabricadas, sin scheduler, notificación ni red.

### Fase R8 — Grafo de conocimiento y recuperación semántica

**Estado:** completada el 2026-09-11 · grafo, recuperación e integración visual verificadas  
**Dependencia:** Fase R6  
**Objetivo:** convertir el volumen neuronal en una vista fiel de recuerdos y asociaciones persistentes.

Las aristas tendrán tipo, fuerza, procedencia y evidencia. La búsqueda híbrida combinará coincidencia exacta y significado semántico. Los embeddings y demás índices serán derivados y regenerables; no reemplazarán los registros originales.

SQLite se adoptará solamente cuando las relaciones, transacciones o el volumen demuestren que JSON dejó de ser suficiente, mediante migración respaldada y reversible.

R8.1 reconstruye referencias desde `records.json` con identidad, huella, versión y
política R6. Distingue episodios, enseñanzas confirmadas por el propietario y
procedimientos. No extrae asociaciones ni duplica contenidos. El perfil separado,
las notas y la búsqueda semántica se integrarán en los siguientes incrementos.
R8.2 agrega relaciones `relatedExperience` revisables, reversibles y respaldadas
por citas exactas; no infiere asociaciones automáticamente ni alimenta todavía el
volumen. R8.3 comparó recuperación léxica, embeddings y reranqueo con datos reales.
Los embeddings de Gemma fueron rechazados; su reranqueo Top-3 quedó disponible
únicamente mediante el botón manual `Ampliar con Gemma` en Conversación, sin
persistir su salida ni presentarla como verdad. El recorrido integrado se validó con
18 candidatos accesibles y tres resultados visibles; no se creó un índice derivado.
R8.4 conecta las referencias y su evidencia al volumen cognitivo. Una línea violeta
aparece únicamente para una relación confirmada y vigente; su ficha abre las dos citas
reales. El observatorio distingue estado vacío, normal, fuente cambiada y error. La
sonda final reconstruyó 3 nodos desde la memoria canónica actual y preservó 42 archivos
sin escrituras ni índices persistentes.
Contrato: [KNOWLEDGE_GRAPH_R8.md](docs/architecture/KNOWLEDGE_GRAPH_R8.md).
Plan: [R8-knowledge-graph.md](docs/plans/R8-knowledge-graph.md).

**Criterios de aceptación:**

- [x] Cada nodo abre su registro real y cada arista explica su evidencia.
- [x] Una instalación sin recuerdos muestra un grafo vacío.
- [x] Corregir o eliminar un recuerdo actualiza sus relaciones.
- [x] La búsqueda indica por qué recuperó cada resultado.
- [x] Reconstruir índices no modifica la fuente original.

### Fase R9 — Presencia, voz y cuerpo mediante puentes

**Alcance activo confirmado:** hacer fiable a Alice como asistente antes de
conectar un cuerpo. El avatar expresará mediante gestos y movimiento las salidas
del sistema en una etapa posterior. Su integración queda fuera del cálculo de
avance y del cierre de la entrega actual. Los criterios de conversación, escucha,
percepción y acciones están en el [plan R9](docs/plans/R9-presence-voice-body.md).

**Orden vigente al 11 de noviembre:** consolidar la estructura del núcleo y el
ciclo autoestudio/Obsidian junto con las acciones musicales y la aceptación de
conversación de R9. R9 conserva sus componentes y pendientes;
no vuelve a una fase de diseño inicial ni se considera aceptada por los cambios
de Memoria o respaldo.

**Estado:** parcial — sesión automática de voz implementada, con estabilización
del 2026-11-04: detección de pausas, Whisper base CPU para español, diálogo Gemma,
respuesta Fish y nueva escucha sin confirmación por turno. Dos respuestas y
parada comprobadas con audio sintético; aceptación con Carlos y música real
pendiente. Node 26.13.0 LTS actualizado.
Gemma 4 se mantiene y el avatar queda al final según [ADR-P-099](docs/decisions/ADR-P-099-sesion-de-voz-y-node-26.md).  
Se añade parada mediante orden directa durante escucha y evaluación de referentes
Alice/Carlos/terceros con [ADR-P-100](docs/decisions/ADR-P-100-referentes-parada-de-voz-rust.md).
El compilador del proyecto queda actualizado a Rust 1.99.1 estable.
**Pendiente prioritario para uso cotidiano:** aceptación de cinco turnos con la
voz del propietario y música de notebook/otro equipo; corregir referentes y
continuidad temática; reducir espera de respuesta y síntesis; activación dedicada
por nombre; interrupción hablando con control de eco; aceptación de reproducción
real de YouTube en Chrome. La cámara y el escritorio por turno ya están conectados,
pero no equivalen a percepción continua. Avatar y cuerpo quedan pospuestos.
La CI utiliza **Ubuntu 26.04** para verificar el requisito WebM/Opus de WebKit y
GStreamer. La ejecución y captura simuladas siguen separadas de la aceptación del
hardware del propietario. En su instalación Ubuntu 26.04.1 ya se documentaron
un turno real de voz y controles nativos de Spotify y de su playlist de YouTube;
siguen pendientes las órdenes habladas, la escucha con música y la latencia del
turno completo.
[Base Ubuntu](docs/runbooks/04-ubuntu.md) ·
[Resultados de voz y música](docs/testing/UBUNTU_LATENCY_MEDIA_REPORT_2026-11-06.md).

Incremento 2026-11-05: preguntas sobre «tu explicación/voz…» en una cita con
destinatario explícito disponen de una resolución local acotada, con procedencia
visible y sin inferencia adicional. Los casos sin cobertura continúan en Gemma.
Persisten errores con pronombres ambiguos y continuidad; no se da por aceptada
la conversación real. [ADR-P-110](docs/decisions/ADR-P-110-referencias-explicitas-en-citas.md).

Incremento 2026-11-06: espera de frases dirigidas a Alice después de transcribir;
«Detén la conversación, Alice» vuelve a espera y «Apaga el micrófono, Alice»
cierra la sesión. Es un filtro por frase, no activación acústica dedicada ni
interrupción durante la reproducción.
[ADR-P-112](docs/decisions/ADR-P-112-espera-por-nombre-y-apagado.md).

**Dependencia:** Fases R1 a R3  
**Objetivo vigente:** lograr conversación, escucha, voz, percepción y acciones
delegadas fiables. El objetivo corporal original se conserva para una entrega
posterior, con presentación visual separada de la decisión cognitiva.

Texto y salida de voz Fish ya están integrados bajo la autorización vigente;
su aceptación cotidiana sigue pendiente. La etapa corporal posterior conserva
el orden expresiones VRM, mirada, animaciones, entrada facial o corporal y
finalmente Active Ragdoll. Cada adaptador mantiene su alcance independiente y
debe cumplir sus condiciones de licencia, privacidad y coste.

El contrato inicial R9.1 separó la transcripción manual local, la salida TTS
entonces planificada, las expresiones VRM y los sensores en puentes unidireccionales
separados. Ninguno escribe recuerdos, decide por Alice o se activa al iniciar. La
voz externa recibe una respuesta ya persistida. En la sesión automática, iniciar
autoriza sus turnos hasta detener, salir o vencer; en modo manual se mantiene la
vista previa por intento. Se conservan límites y descarte. Consulta el
[plan R9](docs/plans/R9-presence-voice-body.md) y [ADR-P-094](docs/decisions/ADR-P-094-puentes-de-presencia-voz-y-cuerpo.md).

**Base corporal local ya comprobada:** el visor manual dispone de doce clips privados, mezcla locomotora, IK de apoyo y una FSM de siete estados para reposo, arranque, locomoción, salto, sentarse y levantarse. Sus transiciones generan telemetría R3 mínima con procedencia humana o diagnóstica; alimentan una región `Motor manual` aislada y no activan el puente cognitivo. El aprendizaje motor futuro deberá correlacionar intención, acción, telemetría y resultado en R3, exigir repeticiones válidas y proponer memoria procedural bajo confirmación; nunca inferir aprendizaje por la sola existencia o reproducción de un clip.

**Base facial local ya comprobada:** una sonda diagnóstica explícita procesó video real de `ACER HD User Facing` con MediaPipe Face Landmarker y el modelo float16 v1 verificado por SHA-256. Detectó 478 landmarks y 52 blendshapes sin persistir fotogramas ni coordenadas. La sonda no forma parte del runtime, no identifica personas, no activa `perception.face.landmarks` y no controla el avatar. La integración futura deberá separar captura, derivación facial y salida VRM; requerirá un grant R2 específico, indicador y parada visibles, calibración por usuario, filtrado temporal y auditoría R3 sin biometría cruda.

**Destino facial real inventariado:** el VRM privado declara 14 expresiones preset (`happy`, `angry`,
`sad`, `relaxed`, `surprised`, vocales y parpadeos) y ninguna personalizada. Avatar las expone como
catálogo de solo lectura; no crea pesos, animación ni un mapeo desde la cámara. La futura tabla de
retarget deberá partir de este catálogo y conservar la frontera R2/R3/R9.

**Preparación visible sin sensor:** la pestaña Rostro consulta un estado nativo pasivo del modelo y runtime local. Esta comprobación vuelve a calcular la huella, confirma dependencias y declara `sensorOpened=false`; no puede convertirse en lectura facial, permiso, memoria, actividad cognitiva ni salida VRM.

#### Subfase futura — Sala de observación y maduración

Después de conectar de forma segura el cuerpo, Alice podrá entrar en una sala virtual delimitada para observar cómo responde a objetos, estímulos, memoria y consecuencias. La sala será un entorno separado de `COGNITIVE CORE`, `BODY SOLVER` y `GOVERNANCE`; no equivaldrá a acceso libre al escritorio o a Internet.

Cada sesión tendrá línea base, objetivos observables, inicio y fin explícitos, parada inmediata, telemetría real y posibilidad de reinicio. La maduración deberá poder atribuirse a recuerdos, habilidades, parámetros o experiencias concretas y reversibles. No se presentará mayor actividad visual como prueba de conciencia o desarrollo si no existe evidencia persistente que la explique.

**Criterios iniciales:**

- [ ] La sala puede restablecerse sin borrar la memoria durable aprobada.
- [ ] Cada estímulo y respuesta queda correlacionado por R3.
- [ ] El cuerpo puede detenerse aunque el núcleo o el entorno fallen.
- [ ] Las diferencias entre sesiones se explican desde cambios versionados.
- [ ] Ningún aprendizaje de la sala se consolida sin la política vigente de memoria y habilidades.

**Criterios de aceptación de la etapa corporal posterior:**

- [ ] Desconectar un puente no detiene conversación ni memoria.
- [ ] La interfaz diferencia datos reales, ausencia de señal y error.
- [x] Cámara y micrófono requieren indicadores y revocación visibles.
- [ ] El avatar acredita a Carlos Nuñez y su creación con VRoid Studio.
- [ ] Ragdoll no controla decisiones; solamente transforma movimiento aprobado en respuesta física.

### Fase R10 — Distribución segura

**Estado:** futura  
**Dependencia:** estabilidad de las fases anteriores  
**Objetivo:** preparar una versión compartible que comience vacía y permita a cada persona aportar sus propios datos y credenciales.

**Criterios de aceptación:**

- [ ] El paquete no contiene recuerdos, auditorías, claves ni el avatar privado sin permiso de distribución.
- [ ] La instalación crea una raíz de datos nueva y vacía.
- [ ] Existe asistente de configuración, migración y desinstalación.
- [ ] Licencias, créditos, límites y modelo de amenazas están documentados.
- [ ] Una auditoría desde una máquina limpia reproduce el arranque y las pruebas esenciales.

## Puerta de calidad obligatoria

Antes de cerrar cualquier fase se debe:

1. actualizar el documento maestro y crear o modificar la ADR correspondiente;
2. definir contrato y migración antes de cambiar datos persistentes;
3. respaldar y verificar cualquier migración con datos sintéticos separados;
4. ejecutar pruebas unitarias, integración y compilación de Rust y frontend;
5. comprobar visualmente estados vacío, normal, bloqueado y error;
6. comprobar que las pruebas no alteraron los datos canónicos, activos privados ni motores; cualquier migración autorizada debe conservar respaldo e integridad de la fuente;
7. escribir un informe breve con resultados y limitaciones;
8. realizar un commit acotado con la evidencia y sus límites, publicarlo en la rama acordada y comprobar la referencia remota.

Comandos mínimos vigentes:

```powershell
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
npm test
npm run build
```

## Actualización autorizada — aprendizaje conversacional

El 2026-11-03 se implementa la selección y persistencia automática de citas de
nuevos mensajes Gemma, con pausa, corrección y retirada, RAG activo y proyección
orgánica del volumen. El almacén automático conserva procedencia y no reescribe
memoria confirmada. Ver [ADR-P-101](docs/decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).
El autoestudio posterior se describe en las ampliaciones de R6. Ambas fuentes
conservan su política y procedencia; el avatar continúa al final.

## Próximo paso autorizado

Las **Fases R1 a R8** conservan sus cierres documentados. R9 ya tiene
implementación parcial. El trabajo inmediato queda ordenado así:

1. **Estabilizar captura y transcripción de R9.** Repetir la frase confirmada,
   contrastar la toma filtrada y el texto del reconocedor y comprobar el motivo
   visible de los descartes. Mantener el diagnóstico dentro de Audio de entrada,
   sin sobrecargar Conversación ni añadirle funciones antes de aceptar este
   recorrido con el propietario. No atribuir precisión ASR a los tests ni
   optimización de CPU o arranque a una comparación de assets.
2. **Aceptar el ciclo personal de autoestudio y Obsidian.** Arrancar Alice, revisar
   ejercicios y fuentes, reiniciar y comprobar que conserva el progreso, continúa
   pendientes/repasos, recupera una lección aprobada con su fuente y actualiza la
   bóveda. Comprobar pausa, errores y prioridad de conversación. La sonda aislada
   de 14 áreas (10 aprobadas y 4 fallidas) no representa avance personal.
3. **Revisar contratos y continuar la estructura del núcleo.** Revisar con
   colaboradores lo implementado; continuar separando coordinación de `App.tsx`
   después de extraer las fuentes de aprendizaje (ADR-P-116), y delimitar las
   responsabilidades de transporte, proceso y arbitraje de `local_inference.rs`
   en incrementos justificados. La prioridad de solicitudes ya se separó
   (ADR-P-118). La reanudación rápida ya conserva el reinicio y rechaza resultados
   del ciclo anterior, sin solapar ciclos (ADR-P-119). Evaluar una primitiva de persistencia compartida
   sin cambiar formatos ni debilitar los controles existentes.
4. **Completar la aceptación personal de Memoria.** Verificar las cuatro secciones,
   sus herramientas, avisos de actualización y estados de carga/error en la sesión
   del propietario. El Volumen ya se revisó en Tauri con fuentes y cambios
   observados; quedan las comprobaciones conjuntas de recuperación y Obsidian
   del primer paso. La revisión visual no sustituye esa aceptación completa.
5. **Completar la aceptación funcional de R9.** Mantener cinco turnos reales con
   corrección de referentes; probar escucha sin música, con música de la notebook
   y de otro equipo; medir la demora completa y la naturalidad; aceptar acciones,
   cámara y escritorio con parada e indicadores coherentes. Después completar y
   comprobar activación dedicada por nombre e interrupción con control de eco.
   Valorar la nueva voz Fish y el estilo de Alice en texto, voz y visión,
   conservando empatía, humildad y procedencia. Retomar el diagnóstico de entrada
   con la misma toma filtrada; una preferencia de voz no acredita precisión ASR.

**Pendiente transversal de protección:** completar una copia integral verificada
en otra unidad física. El respaldo actual en `D:\Alice Backups\Alice Continuum`
comparte disco con el proyecto y no cubre por sí solo la pérdida de ese soporte.

Los prototipos externos, el avatar y la sala de observación conservan su lugar
posterior. No se amplían las materias del autoestudio ni se activa ninguna
capacidad por la sola actualización de esta hoja de ruta.

## Identidad adoptada — Alice Continuum

Carlos Nuñez aprobó **Alice Continuum** como identidad técnica. La marca visible
de la asistente continúa siendo **Alice**. La adopción del nombre y la recuperación
del checkout ya se realizaron; no son una migración futura.

La raíz vigente es **`D:\Alice Continuum`**, con rama principal `master`. El
lanzador resuelve su propia carpeta, usa `data/` por defecto, respeta
`ALICE_DATA_DIR` y conserva la identidad persistente de Tauri. Modelos y motores se configuran fuera
de Git. Las rutas anteriores se conservan únicamente como antecedentes en los
informes de recuperación.

El código y la documentación se publican en
[enri312/alice-continuum](https://github.com/enri312/alice-continuum). La publicación
no incluye recuerdos, configuración privada, claves, modelos, capturas ni activos
privados; las copias Git y los respaldos integrales tienen alcances diferentes.
[Recuperación y límites](docs/testing/WINDOWS_RECOVERY_READINESS_REPORT_2026-11-09.md) ·
[Respaldo integral](docs/runbooks/07-respaldo-integral.md).

## Identidad vigente: Alice Continuum

Desde el 2026-09-16 la plataforma se denomina **Alice Continuum**; Alice mantiene
su nombre como personaje. Esta adopción no modifica el alcance ni el estado de
las fases. Consulta [ADR-P-095](docs/decisions/ADR-P-095-identidad-alice-continuum.md)
y la [matriz de compatibilidad](docs/architecture/CONTINUUM_IDENTITY.md).

## Historial de incrementos de voz y acciones

Las notas siguientes corresponden a sus fechas. El estado vigente de R9 y el
orden de trabajo se encuentran en sus apartados anteriores.

Incremento R9 del 2026-11-03: [música delegada](docs/decisions/ADR-P-104-musica-spotify-youtube-chrome.md)
con Tus me gusta en Spotify y canciones pedidas en YouTube mediante Chrome.
Spotify pasó la prueba de reproducir, pausar, continuar y pausar desde Alice con
datos separados. La reproducción real de YouTube espera la canción del
propietario. El avatar sigue pospuesto; este incremento no cierra R9.

Seguimiento del mismo día: se corrigen las órdenes habladas compuestas que
recibían promesas sin reproducción, y se amplía la espera de Spotify al arrancar
sin ventana. [Regresión y pruebas](docs/testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

Incremento R9 del 2026-11-04: [reducción local de ruido](docs/decisions/ADR-P-105-supresion-local-ruido-vite.md) antes de grabar, detector de voz y micrófono seleccionable. Dirección Alice opcional para otras voces. Vite 8.3.5 y Vitest 4.1.12; falta aceptación acústica con la voz del propietario y música de ambos orígenes. El avatar permanece al final.
