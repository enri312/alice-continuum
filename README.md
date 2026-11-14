# Alice Continuum

[![Rust 1.99.1](https://img.shields.io/badge/Rust-1.99.1-DEA584?logo=rust&logoColor=black)](rust-toolchain.toml)
[![TypeScript 7.0.2](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript&logoColor=white)](package-lock.json)
[![React 19.3.1](https://img.shields.io/badge/React-19.3.1-149ECA?logo=react&logoColor=white)](package-lock.json)
[![Dioxus 0.7.0](https://img.shields.io/badge/Dioxus-0.7.0-25A7D7?logo=rust&logoColor=white)](crates/state-controls/Cargo.toml)
[![Tauri 2.11.5](https://img.shields.io/badge/Tauri-2.11.5-FFC131?logo=tauri&logoColor=black)](Backend/src-tauri/Cargo.lock)
[![Node.js 26.13.0](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![npm 11.20.0](https://img.shields.io/badge/npm-11.20.0-CB3837?logo=npm&logoColor=white)](package.json)
[![Vite 8.3.5](https://img.shields.io/badge/Vite-8.3.5-646CFF?logo=vite&logoColor=white)](package-lock.json)
[![Vitest 4.1.12](https://img.shields.io/badge/Vitest-4.1.12-6E9F18?logo=vitest&logoColor=white)](package-lock.json)

**Asistente personal de escritorio con conversación, memoria local y percepción por turnos.**
El currículo de autoestudio incluye pensamiento crítico y ética, además de las
materias anteriores, con fuentes y ejercicios.
Alice es la identidad conversacional; Alice Continuum es la plataforma que la sostiene.

**Estado al 13 de noviembre de 2026:** el propietario confirmó que Alice respondió en la nueva prueba de voz, aunque tardó. El watchdog del filtro pasó 840 pruebas frontend, compilación y una sonda sintética con el pipeline real. El último turno auditado dedicó aproximadamente 7,0 s a transcribir, 1,7 s a responder y 2,4 s a preparar la voz; sigue la revisión de latencia y de cinco turnos cotidianos. La causa física del episodio anterior permanece sin confirmar. R9 sigue abierta, con los controles indispensables y el diagnóstico plegado.
La versión del producto es **0.1.0** y el documento maestro **0.65**.
El repositorio se llama **`enri312/alice-continuum`** y conserva el historial del
proyecto anterior Alice Cognitive Core.

[Manual de uso](docs/MANUAL_DE_USO.md) · [Documento maestro HTML](docs/especificacion_alice_continuum.html) · [Roadmap](Roadmap.md) · [Documentación](docs/README.md)

Próximo paso: evaluar la latencia por etapas y comprobar
cinco turnos reales breves —reproducir, pausar, reanudar, conversar y apagar el micrófono—,
comprobando lo entendido y el resultado. Después,
retomar el núcleo ya implementado: autoestudio limitado y proyección en Obsidian.
No se añaden funciones a Conversación durante esta aceptación.

**Voz y personalidad:** Alice incorpora un estilo inspirado en Akali: directo,
seguro e informal, con criterio propio y humor seco ocasional. Conserva empatía,
humildad, veracidad y los controles de autorización. Texto, voz y visión comparten
el mismo bloque de personalidad. La voz Fish se selecciona mediante un perfil
privado y mantiene `s2.1-pro-free`. La síntesis de una frase de prueba funcionó
en Tauri; la valoración audible del propietario sigue pendiente. Este cambio
no corrige la transcripción.
[Configuración y alcance](docs/runbooks/03-conversacion-y-voz.md#voz-privada-y-personalidad) ·
[Resultados y pendientes](docs/testing/ALICE_VOICE_PERSONALITY_REPORT_2026-11-12.md).

**Voz baja:** Conversación inicia con el perfil **Voz baja y pausada**, con
ganancia local 2× y cierre tras 2 s de silencio. **Audio de entrada** permite
volver a Normal. Este perfil conserva la salida de RNNoise sin la atenuación
adicional por probabilidad de voz; Normal mantiene su filtrado anterior.
La ganancia se redujo desde 4× tras observar muestras recortadas en una toma
manual. Eso no demuestra que el recorte explique por sí solo el error ASR;
las pruebas y compilación del ajuste pasaron. El acierto comunicado después es
puntual: no demuestra que el ritmo de habla o la ganancia expliquen la causa,
ni sustituye la aceptación de varios turnos.
La precisión continúa en evaluación:
[resultado de small y diagnóstico pendiente](docs/testing/WHISPER_SMALL_REPORT_2026-11-12.md).
[Preservación de la señal de voz baja](docs/testing/SOFT_VOICE_SIGNAL_REPORT_2026-11-12.md).
[Perfil y repetición personal](docs/testing/SOFT_VOICE_REPORT_2026-11-12.md).

Para aislar el cierre de una frase muy pausada, usar el acceso visible
**Dictar con botón → Empezar a grabar** y terminar con **Terminé de
hablar y transcribir**. Ese modo conserva pausas y deja el texto en revisión
antes de enviarlo. El botón «Terminé de hablar» de la sesión automática sigue
permitiendo también el cierre por silencio; ambos modos tienen comportamientos
distintos. Los datos del turno identifican modelo y duración de la toma.
Abrir el panel no enciende el micrófono. Si la escucha automática está activa,
el acceso manual sigue visible y pide apagarla para evitar dos capturas a la vez.
Para revisar el sonido, **Parar y revisar audio** deja escuchar la toma filtrada
localmente antes de **Transcribir localmente**. Los datos del turno muestran
niveles y cobertura parcial; **Última transcripción** separa el resultado ASR
del borrador acumulado y de las correcciones escritas.
[Diagnóstico y límites](docs/testing/VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).
La escucha activa se identifica como **Escuchando · di Alice y tu frase**.
El detalle **Resultado de entrada no atendido**, dentro del desplegable existente
**Audio de entrada**, distingue captura sin voz detectada, ASR sin palabras y
frase no reconocida como dirigida a Alice. Permanece plegado de inicio; la escucha
sólo añade un indicador breve cuando hay un descarte. Ese detalle es efímero y
no se envía al chat ni genera acciones o voz Fish. Los fragmentos musicales
ambiguos cubiertos por la validación local piden aclaración sin adivinar una
orden. Esto no mejora ni acredita la precisión del reconocedor.
[Feedback, resultados y pendientes](docs/testing/VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md).
Los fallos de preparación, decodificación o ejecución de Whisper se distinguen
de una toma sin palabras. El proceso mantiene salidas técnicas acotadas en RAM,
sin publicar stderr o rutas en la auditoría; los mensajes usan el aviso de error
existente. No se cambia el modelo, la captura o la ganancia, ni se añade un
reintento o fallback ante un fallo del reconocedor instalado.
[Proceso Whisper: resultados y límites](docs/testing/WHISPER_PROCESS_FAILURE_REPORT_2026-11-13.md).
El watchdog del filtro cuenta desde que se conecta el grafo de audio, con
`performance.now()` y el mismo umbral de 1500 ms. Las métricas válidas de
silencio también renuevan ese plazo. Si dejan de llegar, se descarta la toma
y la sesión automática admite un único rearme compartido con los fallos de
cola ya existentes; un segundo fallo detiene la sesión. No se envía audio
parcial al ASR ni se cambia a audio crudo.
[Watchdog: resultados y límites](docs/testing/NOISE_WATCHDOG_REPORT_2026-11-13.md).
La [revisión de herramientas y persistencia](docs/research/HERRAMIENTAS_Y_PERSISTENCIA_REVIEW_2026-11-13.md)
prioriza comparar ASR con mediciones equivalentes. Evalúa faster-whisper,
activación acústica y Open Interpreter, y señala incompatibilidades del SQL
propuesto; no activa herramientas o una migración.
Los pilotos locales de `experiments/` comparan ASR y reproducen **Estado y
controles** con Dioxus-Web y datos sintéticos. Esa carpeta es privada y queda
completamente fuera de Git; sus herramientas y salidas no forman parte del arranque.
**Sólo se considerará incorporarlos después de validar su funcionamiento**:
las pruebas sintéticas no cierran la aceptación de R9 ni la integración nativa.
La sección «Persistencia y Grafos: Evolución futura de R6 y R8» queda aplazada
hasta revisar el proyecto y sus contratos en profundidad; no se migra la memoria.
[Resultados y límites de los pilotos](docs/testing/ISOLATED_PILOTS_REPORT_2026-11-13.md).
En tres frases sintéticas, las medianas por proceso fueron 6,177 s con el CLI y
5,404 s con faster-whisper; ambos perdieron la orden de pausa. Se mantiene el
motor actual. Dioxus compiló a WASM, pasó ocho pruebas propias y permitió revisar
estados, inspector y teclado; su aceptación visual completa sigue pendiente.
El ajuste del piloto presenta los controles de comportamiento como deslizadores
bloqueados y una fila de memoria `EPISODIC` de ejemplo, sin activar capacidades
ni registrar recuerdos reales. Compilación WASM, cuatro pruebas de modelo y
revisión de escritorio aprobadas; la integración nativa sigue pendiente.
La [exportación de Google AI Studio](docs/testing/DIOXUS_MIGRATION_REVIEW_2026-11-14.md)
se utiliza como material para revisar y pulir por partes. La primera incorporación
es **Estado y controles**, renderizada con Dioxus en el principal, con el CSS,
la lógica de conversación y el backend existentes. El resto de las páginas sigue
en React. [Alcance y validación de la migración](docs/testing/STATE_CONTROLS_DIOXUS_REPORT_2026-11-14.md).
En la aplicación principal ya está disponible **Estado y controles**:
ocho deslizadores, con Creatividad y Estilo empático conectados a la conversación
Gemma/Ollama, y memoria recuperada con categoría y procedencia reales. Son ajustes
de sesión para el próximo envío. Se comprobaron contratos, compilación y la
pantalla Tauri; la valoración del tono y la revisión completa a otros anchos
siguen pendientes. El rótulo técnico y «Modelo interno» se conservan sin solaparse.
La fila usa etiquetas en español, como **EPISÓDICA · USUARIO: … → Alice**,
y conserva el contenido y la puntuación reales de la recuperación.
Su presentación compacta muestra categoría, texto y puntuación; al pulsarla,
el inspector abre estado, procedencia y detalles. Se comprobó en Tauri con
coincidencias reales y pasó 20 pruebas dirigidas y la compilación.
La vista Dioxus carga su WASM al abrir esta página, valida cada acción contra el
estado actual y conserva un panel React de respaldo ante fallo. Pasaron 863 pruebas
frontend, 15 de Obsidian, 20 de respaldos, dos del contrato Rust y Clippy para WASM.
El icono representa dos ajustes de sesión, seis controles bloqueados y memoria recuperada.
El marco R3, la selección, el inspector, la presentación de memoria y la
preparación y validación de controles se ejecutan en Rust/Dioxus. Se retiró
`StateControlsPage.tsx`: un puente React pequeño conecta los datos y ajustes
compartidos con Conversación y conserva una vista de recuperación si falla WASM.
En Tauri con datos aislados se comprobaron el marco R3, el inspector y los dos
ajustes por teclado, incluida su conservación al cambiar de pantalla. La prueba
no utilizó los recuerdos personales ni generó una respuesta real.
[Alcance y comprobaciones](docs/testing/STATE_CONTROLS_REPORT_2026-11-13.md).
[Estructura, comprobaciones y pendientes](docs/testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).
El [Roadmap actualizado al 13 de noviembre](Roadmap.md#próximo-paso-autorizado)
ordena la aceptación del aprendizaje, la estructura del núcleo y el avance conjunto de R9.

Los lanzadores ahora crean [respaldos integrales](docs/runbooks/07-respaldo-integral.md)
al iniciar, cada 15 minutos y al cerrar normalmente. Destino actual:
`D:\Alice Backups\Alice Continuum`; no se usa C:. Se verifica cada copia y se
restaura en una carpeta nueva. La copia en otra unidad física sigue pendiente.

## Qué funciona actualmente

| Área | Implementación y evidencia |
|---|---|
| Conversación | Gemma 4 E2B local mediante llama.cpp, con diálogo reciente y recuerdos recuperables. Los referentes ambiguos siguen en evaluación. |
| Voz por turnos | RNNoise reduce ruido, Whisper local CPU transcribe español, Gemma responde y Fish Audio sintetiza. Small se prefiere si está instalado; base sigue disponible. Una acción inicia la sesión; no se confirma cada turno. |
| Espera y continuidad | Las frases dirigidas a Alice se atienden tras la transcripción local. «Detén la conversación, Alice» vuelve a espera; «Apaga el micrófono, Alice» cierra la sesión. Rechazo de respuestas tardías y recuperación en texto si falla la voz. |
| Memoria y RAG | Memoria confirmada y selección automática de citas útiles en almacenes separados. Se puede pausar, corregir y retirar del contexto; no se entrenan pesos por conversar. |
| Navegación de Memoria | Cuatro secciones: Aprendizaje, Recuerdos, En sesión y Mantenimiento. El autoestudio aparece primero; perfil, revisión, capas, consolidación y respaldo conservan sus controles. Los nombres de la barra compacta se muestran completos y Memoria tiene un nuevo icono de conocimiento con fuentes conectadas. |
| Autoestudio al arrancar | Currículo cerrado de matemáticas, historia bíblica católica, psicología e inteligencia emocional, empatía, solidaridad y humildad. Gemma estudia y resuelve ejercicios; las lecciones aprobadas se recuperan con su fuente y se muestran en Obsidian. [Funcionamiento y límites](docs/runbooks/06-autoestudio-al-arrancar.md). |
| Cámara y escritorio | Fuentes seleccionables en Conversación, procesadas por Gemma mientras están activas. Fotogramas efímeros; no identifica personas ni abre archivos cerrados. |
| Spotify y PC | Abrir Spotify, reproducir Tus me gusta, pausar y continuar en Windows y Ubuntu. Windows admite además la playlist configurada por nombre, con comprobación de su contexto. [Configuración privada](docs/runbooks/08-spotify-playlist-privada.md). D:/E: sólo Windows. YouTube en Ubuntu queda limitado a la playlist del propietario con regreso del último al primer video comprobado en su lista privada. |
| Núcleo observable | Volumen bilateral que cambia con los registros de aprendizaje y seguimiento de incorporaciones desde la apertura. El mapa de módulos permanece en Flujo cognitivo. Conserva importancia, asociaciones emocionales revisadas, fuentes, estados y controles. Distingue actividad R3 y demostración, y mantiene visibles estudios pendientes sin habilitarlos para RAG. [Diseño y límites](docs/decisions/ADR-P-115-volumen-cognitivo-y-evolucion-visible.md). |
| Gobierno y diagnóstico | Registro de capacidades, permisos delimitados, auditoría local, tareas y habilidades separadas del diálogo. No hay control general del PC. |

El ciclo nativo de voz pasó **tres frases españolas, dos respuestas reproducidas y
parada directa**, usando audio sintético y datos aislados. Otra prueba rechazó una
respuesta posterior a detener la sesión sin agregar historial. La segunda voz
empezó a los **7,3 segundos del fin de grabación**; Fish ocupó unos 4,5 segundos.
Estos resultados no sustituyen la prueba con la voz de Carlos y música real.

Evidencia: [sesión y cancelación](docs/testing/CONVERSATION_SESSION_REPORT_2026-11-04.md),
[reducción de ruido](docs/testing/VOICE_NOISE_VITE_REPORT_2026-11-04.md),
[memoria automática](docs/testing/AUTOMATIC_MEMORY_VOLUME_REPORT_2026-11-03.md),
[visión](docs/testing/CONVERSATION_VISION_REPORT_2026-11-03.md) y
[música](docs/testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

## Conversar con Alice

1. Abrir **Iniciar Alice Continuum.cmd** y entrar en **Conversación**.
2. Elegir el micrófono en **Audio de entrada** y pulsar **Iniciar escucha de Alice**.
3. Esperar **Escuchando · di Alice y tu frase**. Incluir «Alice» en cada frase que se quiera atender y dejar la pausa de cierre del perfil: 2 s en Voz baja y pausada o 1 s en Normal. Alice procesa el turno, responde y vuelve a escuchar.
4. Si entendió algo mal, revisar **Último mensaje atendido**. Si no respondió, abrir **Audio de entrada** y comprobar **Resultado de entrada no atendido**, cuando exista un descarte.
5. Decir **«Detén la conversación, Alice»** para volver a espera. **«Apaga el micrófono, Alice»** o el botón **Apagar micrófono** cierran la escucha.

El micrófono está apagado durante procesamiento y reproducción. Todavía no hay
interrupción hablando mientras Alice responde ni activación dedicada por nombre.
La dirección a Alice se exige por defecto después de transcribir; no verifica
la identidad del hablante. El dictado manual con revisión sigue disponible.

[Procedimiento completo de voz y conversación](docs/runbooks/03-conversacion-y-voz.md).

## Consultar el aprendizaje y la memoria

Abrir **Memoria** en la barra del núcleo cognitivo:

| Sección | Contenido |
|---|---|
| **Aprendizaje** | Progreso del autoestudio, ejercicios, fuentes y recuerdos seleccionados al conversar. |
| **Recuerdos** | Registros conservados y perfil confirmado del propietario. |
| **En sesión** | Contexto temporal de la conversación en RAM. |
| **Mantenimiento** | Revisión y ciclo, capas, consolidación y respaldo. |

Los paneles reciben los avisos nativos de actualización de memoria y autoestudio.
La ventana local principal tiene los permisos de escucha y cierre de suscripciones
de Tauri. Obsidian muestra una proyección de los datos guardados por Alice.
[Controles de memoria](docs/MANUAL_DE_USO.md#5-memoria-qué-significa-cada-pestaña) ·
[Autoestudio](docs/runbooks/06-autoestudio-al-arrancar.md) ·
[Bóveda de Obsidian](docs/runbooks/05-memoria-obsidian.md).

## Instalar y arrancar

Entorno verificado en Windows con WebView2 y herramientas de compilación para Tauri:
los badges muestran las versiones comprobadas y fijadas en el proyecto, no la
última versión disponible de cada tecnología.

| Componente | Versión verificada |
|---|---|
| Node.js / npm | 26.13.0 LTS / 11.20.0 |
| Rust / Cargo | 1.99.1, fijada en `rust-toolchain.toml` |
| Vite / Vitest | 8.3.5 / 4.1.12 |
| React / React DOM | 19.3.1; tipos 19.3.0 |
| TypeScript | 7.0.2 |
| Tauri | Backend Rust 2.11.5; API JavaScript 2.11.1; CLI 2.11.4 |
| Three.js | 0.185.1 |

Desde la raíz del proyecto:

```powershell
npm ci
& '.\Iniciar Alice Continuum.cmd' --check
& '.\Iniciar Alice Continuum.cmd'
```

El lanzador valida el entorno, evita instancias duplicadas y usa el puerto fijo
5173. Mantiene los datos en `data/` mediante `ALICE_DATA_DIR` y comparte el caché
Rust `.cargo-target`. La instalación actual está en `D:\Alice Continuum`.
Un clon nuevo requiere configurar las rutas de sus recursos locales.

La [validación Windows de la recuperación](docs/testing/WINDOWS_RECOVERY_READINESS_REPORT_2026-11-09.md)
registra el checkpoint remoto y la copia privada de datos y recursos en otro disco.
Los datos personales, claves, modelos y activos privados quedan fuera de Git;
el commit y su copia remota respaldan el código y la documentación.

Gemma y su proyector multimodal se instalan fuera de Git. La configuración de
esta notebook usa llama.cpp y modelos bajo `D:\Alice-model-evaluation`; no se
incluyen los pesos ni se descargan automáticamente al abrir Alice.

Para instalar Whisper small multilingüe en la ruta prevista:

```powershell
& '.\scripts\testing\install-whisper-local.ps1' -Model small
```

El instalador usa Node, fija fuentes oficiales y verifica hashes. `-Model base`
instala la alternativa anterior sin borrar small. Alice prefiere small cuando
está presente; `ALICE_WHISPER_MODEL` permite elegir una ruta absoluta explícita,
incluida base. El diagnóstico muestra el modelo seleccionado para cada toma.
Whisper se ejecuta en CPU con cuatro hilos y procesa audio por tuberías en RAM.
Si no hay motor ni modelo predeterminados, permanece la transcripción Gemma
anterior. Una instalación incompleta, una configuración explícita inválida o un
fallo de Whisper se informan sin reenviar esa toma a Gemma. FFmpeg se requiere
para convertir la toma local.

Fish Audio usa `FISH_API_KEY` en el entorno del proceso nativo y el perfil privado
`data/voice-profile.json` (esquema 1). El archivo válido prevalece sobre
`ALICE_FISH_REFERENCE_ID`; el entorno sólo selecciona voz cuando falta ese archivo.
Las respuestas autorizadas salen al proveedor para obtener su voz; se conserva
`s2.1-pro-free`. Las claves y el identificador real no se incluyen en Git ni se
entregan a React; el respaldo privado conserva la configuración para recuperación.
Ver [formato y prioridad](docs/runbooks/03-conversacion-y-voz.md#voz-privada-y-personalidad).
Los proveedores alternativos se documentan
en el manual; OpenRouter permanece pausado por decisión del propietario.

[Arranque y recuperación](docs/runbooks/01-arranque-local.md) · [Identidad y compatibilidad](docs/architecture/CONTINUUM_IDENTITY.md)

El 5 de noviembre se añade una resolución local de preguntas sobre posesivos en
citas con destinatario explícito. Su respuesta identifica la procedencia; no
representa comprensión general ni una modificación de Gemma.
[Alcance y pruebas](docs/testing/CONVERSATION_REFERENCES_REPORT_2026-11-05.md).

## Ubuntu y recursos locales

Las carpetas privadas se agrupan en `local/`: `assets`, `reference-adapters`,
`drafts`, `artifacts` y `venv`. `src`, `Backend/src-tauri`, `.cargo`, `.git`,
`node_modules` y `dist` conservan los nombres esperados por sus herramientas.
La memoria sigue en `data/`; los motores actuales permanecen en D:.

Ubuntu dispone de lanzador Bash, dependencias nativas delimitadas y rutas
configurables para Gemma, Whisper y Python. El 6 de noviembre se instalaron y
verificaron en Ubuntu 26.04.1 los motores Linux, Gemma con Vulkan, Whisper y el
arranque nativo. Python y el caché Rust Linux se separan de Windows. Se confirmó
un turno real con micrófono, Gemma y voz Fish. Ubuntu incorpora Spotify Tus me
gusta y el control de la playlist de YouTube mediante un perfil Chrome propio.
Las capturas nativas de escritorio y las unidades D:/E: siguen siendo de Windows.

[Preparación Ubuntu para R9 y resultados](docs/testing/UBUNTU_R9_SETUP_REPORT_2026-11-06.md).

[Latencia de Gemma y música en Ubuntu](docs/testing/UBUNTU_LATENCY_MEDIA_REPORT_2026-11-06.md).

[Instalación Ubuntu y matriz de compatibilidad](docs/runbooks/04-ubuntu.md) ·
[Organización y verificación](docs/testing/ORGANIZATION_UBUNTU_REPORT_2026-11-04.md)

## Verificación

**Watchdog frontend, 13 de noviembre de 2026:**

- **840 pruebas aprobadas**, 2 omitidas; 76 archivos aprobados y 2 omitidos. Las 19 del pipeline y 80 de captura/bucle están incluidas.
- Compilación TypeScript/Vite aprobada, con el aviso habitual de chunks mayores de 500 kB; no se atribuye una mejora de rendimiento.
- Sonda real de Chrome con silencio sintético, Worker/WASM/Worklet y MediaRecorder: preparación retrasada y métricas iniciales retenidas, sin fallo del filtro. No usó micrófono, altavoces, ASR ni archivos de audio.
- Ventana Alice actualizada revisada con micrófono inactivo. Después, el propietario confirmó una respuesta por voz con demora; el último turno R3 completó transcripción, respuesta y síntesis. Un acierto no acepta una sesión prolongada.

[Reporte, primer sondeo y límites](docs/testing/NOISE_WATCHDOG_REPORT_2026-11-13.md).

**Backend, validación anterior del 13 de noviembre, sin repetir para el watchdog:**

- **408 pruebas Rust aprobadas**, 32 sondas omitidas por defecto. Dos sondas del CLI instalado se seleccionaron y aprobaron aparte; quedan 30 opcionales sin ejecutar.
- Pruebas CLI positiva sintética y negativa con modelo inválido: **5,13 s en total**. Positiva con Alice/Gemma activos: **8,01 s**; no prueban voz real.
- Cargo check, formato, Clippy para todos los targets con `-D warnings` y compilación nativa aprobados.
- Apertura normal de Alice actualizada y revisión de lectura de Conversación, Volumen, Memoria y Gobierno. Micrófono apagado; sin provocar el aviso de error ni realizar una nueva prueba acústica.

[Reporte completo y límites](docs/testing/WHISPER_PROCESS_FAILURE_REPORT_2026-11-13.md).

**Resultados conservados del 12 de noviembre:**

Las 824 pruebas frontend y la compilación TypeScript/Vite de ese día siguieron
al cambio de ganancia a 2×; la nueva ejecución frontend de 840 figura arriba.
Obsidian y respaldo conservan la ejecución del día 12, sin repetir para el watchdog.
La aceptación acústica permanece
[pendiente](docs/testing/VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md#ajuste-posterior-ganancia-de-voz-baja-4-a-2).

- **824 pruebas frontend aprobadas**, 2 sondas opcionales omitidas.
- **15 pruebas de sincronización de Obsidian** y **20 de respaldo y restauración** aprobadas con datos aislados.
- Compilación TypeScript/Vite aprobada en ese alcance anterior.
- Navegación de Memoria, sus cuatro herramientas de mantenimiento y ocho enlaces directos comprobados en una vista aislada a **1440, 1000 y 420 píxeles**; sin desbordes horizontales ni recorte de los nombres compactos.
- Volumen cognitivo: **26 comprobaciones de interfaz aislada** aprobadas en esos tres anchos, incluida evolución, inspector, pausa, demostración, errores de lectura, guía y colores/contornos del canvas. Las fuentes se recuperan mediante consultas periódicas; la fase registrada queda visible. [Resultados y límites](docs/testing/COGNITIVE_VOLUME_COLOURS_REPORT_2026-11-11.md).
- Núcleo: un fallo de consulta no se califica como respuesta incorrecta ni retira una lección aprobada; la conversación reserva prioridad antes de la cola de inferencia. [Cambios y validación](docs/testing/COGNITIVE_CORE_RELIABILITY_REPORT_2026-11-11.md).
- Continuación del núcleo y R9: reanudación rápida protegida, icono bilateral actualizado y orden escrita de reproducir la playlist configurada comprobada desde Alice hasta Spotify real, con ID de contexto coincidente y recibo local. [Alcance de la prueba](docs/testing/COGNITIVE_R9_CONTINUATION_REPORT_2026-11-11.md).
- Orden hablada: el propietario confirmó música y voz de Alice; el detalle mostró 26,2 s hasta iniciar la voz. Un fallo posterior del filtro motivó recuperación de captura limitada a una vez por sesión. La estabilidad prolongada sigue pendiente. [Evidencia y límites](docs/testing/VOICE_PLAYLIST_ACCEPTANCE_REPORT_2026-11-11.md).
- Órdenes cortas: «Alice pausa Spotify» perdió la acción en la transcripción. Se retiró el texto inicial fijo del reconocedor y «Alice, Spotify» recibe una aclaración neutral sin ejecutar acciones. La mejora acústica necesita repetición real. [Decisión](docs/decisions/ADR-P-122-transcripcion-sin-texto-prefijado.md).
- Motor local: una sonda real de arranque, respuesta, exclusividad y cierre aprobada sin escribir recuerdos personales. Alice se reabrió con el backend compilado y el estado de autoestudio disponible en Tauri.

El Volumen actualizado también se revisó en la aplicación Tauri real: guía,
fuentes, cambios observados y actualización de lectura. El acceso mediante la
conexión compatible resolvió el fallo de automatización anterior.
[Colores y alcance nativo](docs/testing/COGNITIVE_VOLUME_COLOURS_REPORT_2026-11-11.md).
La aceptación personal completa de Memoria, aprendizaje y voz conserva sus pendientes.
Las compilaciones nativas y Clippy de la revisión estructural anterior
se documentan en su [informe](docs/testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).

```powershell
npm test
npm run build
cargo fmt --manifest-path Backend/src-tauri/Cargo.toml -- --check
cargo test --manifest-path Backend/src-tauri/Cargo.toml --lib
cargo clippy --manifest-path Backend/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo build --manifest-path Backend/src-tauri/Cargo.toml
```

El workflow [Ubuntu](.github/workflows/ubuntu.yml) verifica además Linux con
datos aislados. Los resultados de cada plataforma figuran en el informe. Vite conserva
un aviso de tamaño de paquetes de más de 500 kB. Las pruebas de hardware, servicios
y voz real se ejecutan por separado y no se dan por aprobadas por las unitarias.

## Estructura del proyecto

Monolito de escritorio parcialmente modularizado, con capas técnicas y áreas
funcionales. Los contratos de conversación están separados de las pantallas React
y los sondeos de estado evitan consultas superpuestas. Este primer incremento
mantiene las funciones existentes y no constituye una migración completa a
Clean Architecture o Vertical Slice. [Decisión y verificación](docs/decisions/ADR-P-107-contratos-conversacion-y-sondeos.md).

El backend de memoria conserva una fachada breve y 28 comandos estables;
sus contratos, validaciones, consultas, persistencia, casos de uso y pruebas
viven en `Backend/src-tauri/src/memory/`. El almacenamiento básico se prueba por rutas,
conservando respaldos, auditoría y formatos. [Modularización y React 19.3.1](docs/decisions/ADR-P-108-memoria-modular-react-19-3.md).

```text
src/pages/             pantallas de conversación, memoria, núcleo y gobierno
src/components/        componentes, controles de voz y visualizaciones
src/core/              contratos, recuperación y procesamiento de audio
Backend/src-tauri/     aplicación nativa Rust/Tauri, memoria y permisos
Backend/adapters/      adaptadores Python nativos y sus pruebas
local/                 activos privados, entorno Python, borradores y evidencias
data/                  conversación, memoria y auditorías privadas
.cargo-target/         caché Rust compartido (no se publica)
icons/                 recursos SVG editables
public/licenses/       avisos de RNNoise y Whisper
scripts/testing/       pilotos y evaluación reproducible
docs/                  manual, arquitectura, decisiones e informes
```

[Mapa de módulos](docs/architecture/PROJECT_STRUCTURE.md) · [Decisiones ADR](docs/decisions/README.md) · [Contexto recuperado](docs/CONTEXTO_RECUPERADO_2026-11-03.md)

La [revisión de organización](docs/architecture/REORGANIZACION_2026-11-14.md)
explica qué se movió, qué iconos se usan y qué herramientas aún requieren revisión.

## Datos, límites y próximos pasos

Los recuerdos, auditorías, grabaciones de prueba, capturas, claves, modelos y
activos privados del avatar permanecen fuera de Git. `data/README.md` explica el
almacenamiento; las pruebas utilizan raíces separadas de los datos personales.
Las licencias de terceros se conservan en `public/licenses/`.

R9 sigue abierta: falta aceptación de conversación con la voz del propietario y
música de notebook y otros equipos, menor demora de síntesis, mejores referentes
ambiguos, activación por nombre e interrupción con control de eco. La memoria no
es una simulación biológica ni representa conciencia. Los hallazgos de seguridad
pendientes se conservan en los informes; no se anuncia una distribución endurecida.

Después de consolidar el núcleo, autoestudio y Obsidian, R9 vuelve a centrarse en
conversación y acciones de PC acotadas. **Domótica queda fuera de este tramo y el
avatar va al final**. El cierre del alcance actual de R9 se
evalúa por la fiabilidad de la asistente; el cuerpo será una salida posterior
para expresiones y movimiento y queda fuera de su cálculo de avance. Atlas y Nerumi son referencias para
ordenar esa evolución, no funciones ya verificadas de Alice.

Repositorio: [enri312/alice-continuum](https://github.com/enri312/alice-continuum) · Rama principal: `master`.
