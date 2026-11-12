# Alice Continuum

[![Rust 1.99.1](https://img.shields.io/badge/Rust-1.99.1-DEA584?logo=rust&logoColor=black)](rust-toolchain.toml)
[![TypeScript 7.0.2](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript&logoColor=white)](package-lock.json)
[![React 19.3.1](https://img.shields.io/badge/React-19.3.1-149ECA?logo=react&logoColor=white)](package-lock.json)
[![Tauri 2.11.5](https://img.shields.io/badge/Tauri-2.11.5-FFC131?logo=tauri&logoColor=black)](src-tauri/Cargo.lock)
[![Node.js 26.13.0](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![npm 11.20.0](https://img.shields.io/badge/npm-11.20.0-CB3837?logo=npm&logoColor=white)](package.json)
[![Vite 8.3.5](https://img.shields.io/badge/Vite-8.3.5-646CFF?logo=vite&logoColor=white)](package-lock.json)
[![Vitest 4.1.12](https://img.shields.io/badge/Vitest-4.1.12-6E9F18?logo=vitest&logoColor=white)](package-lock.json)

**Asistente personal de escritorio con conversación, memoria local y percepción por turnos.**
Alice es la identidad conversacional; Alice Continuum es la plataforma que la sostiene.

**Estado al 12 de noviembre de 2026:** playlist de Spotify comprobada por micrófono con música y respuesta de Alice audibles. La sustitución de palabras al hablar bajo y despacio persiste con Whisper small; la precisión no se considera aceptada. Se prepara una prueba de dictado con cierre por botón para distinguir cierre prematuro de errores del reconocimiento. Núcleo con reanudación de estudio protegida e icono del Volumen renovado. R9 conserva su aceptación prolongada pendiente.
La versión del producto es **0.1.0** y el documento maestro **0.65**.
El repositorio se llama **`enri312/alice-continuum`** y conserva el historial del
proyecto anterior Alice Cognitive Core.

[Manual de uso](docs/MANUAL_DE_USO.md) · [Documento maestro HTML](docs/especificacion_alice_continuum.html) · [Roadmap](Roadmap.md) · [Documentación](docs/README.md)

Prioridad actual: consolidar autoestudio y Obsidian y continuar el núcleo junto
con la aceptación de conversación, voz y música de R9.

**Voz baja:** Conversación inicia con el perfil **Voz baja y pausada**, con
ganancia local 4× y cierre tras 2 s de silencio. **Audio de entrada** permite
volver a Normal. La precisión continúa en evaluación:
[resultado de small y diagnóstico pendiente](docs/testing/WHISPER_SMALL_REPORT_2026-11-12.md).
[Perfil y repetición personal](docs/testing/SOFT_VOICE_REPORT_2026-11-12.md).

Para aislar el cierre de una frase muy pausada, usar **Dictado con revisión
manual → Hablar con Alice → Empezar a hablar** y terminar con **Terminé de
hablar y transcribir**. Ese modo conserva pausas y deja el texto en revisión
antes de enviarlo. El botón «Terminé de hablar» de la sesión automática sigue
permitiendo también el cierre por silencio; ambos modos tienen comportamientos
distintos. Los datos del turno identifican modelo y duración de la toma.
[Estructura, comprobaciones y pendientes](docs/testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).
El [Roadmap actualizado al 12 de noviembre](Roadmap.md#próximo-paso-autorizado)
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
3. Incluir «Alice» en cada frase que se quiera atender y dejar una pausa de un segundo. Alice procesa el turno, responde y vuelve a esperar.
4. Si entendió algo mal, revisar **Último mensaje atendido**, que muestra el texto y las demoras de cada etapa.
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

Fish Audio usa `FISH_API_KEY` y `ALICE_FISH_REFERENCE_ID` en el entorno del proceso
nativo. Las respuestas autorizadas salen al proveedor para obtener su voz; el
perfil existente conserva `s2.1-pro-free`. Los valores de las credenciales no se
incluyen en Git ni se entregan a React; el respaldo privado conserva las variables
seleccionadas para recuperación. Los proveedores alternativos se documentan
en el manual; OpenRouter permanece pausado por decisión del propietario.

[Arranque y recuperación](docs/runbooks/01-arranque-local.md) · [Identidad y compatibilidad](docs/architecture/CONTINUUM_IDENTITY.md)

El 5 de noviembre se añade una resolución local de preguntas sobre posesivos en
citas con destinatario explícito. Su respuesta identifica la procedencia; no
representa comprensión general ni una modificación de Gemma.
[Alcance y pruebas](docs/testing/CONVERSATION_REFERENCES_REPORT_2026-11-05.md).

## Ubuntu y recursos locales

Las carpetas privadas se agrupan en `local/`: `assets`, `reference-adapters`,
`drafts`, `artifacts` y `venv`. `src`, `src-tauri`, `.cargo`, `.git`,
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

Última validación local, **12 de noviembre de 2026**:

- **753 pruebas frontend aprobadas**, 2 sondas opcionales omitidas.
- **15 pruebas de sincronización de Obsidian** y **20 de respaldo y restauración** aprobadas con datos aislados.
- **385 pruebas Rust aprobadas**, 30 sondas opcionales omitidas; incluye prioridad de conversación, reanudación sin ciclos superpuestos, descarte de resultados cancelados, selección restringida de playlist y configuración del reconocedor por toma.
- Compilación frontend y formato Rust aprobados.
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
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo build --manifest-path src-tauri/Cargo.toml
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
viven en `src-tauri/src/memory/`. El almacenamiento básico se prueba por rutas,
conservando respaldos, auditoría y formatos. [Modularización y React 19.3.1](docs/decisions/ADR-P-108-memoria-modular-react-19-3.md).

```text
src/pages/             pantallas de conversación, memoria, núcleo y gobierno
src/components/        componentes, controles de voz y visualizaciones
src/core/              contratos, recuperación y procesamiento de audio
src-tauri/src/         memoria, modelos, permisos y adaptadores nativos
local/                 activos privados, entorno Python, borradores y evidencias
data/                  conversación, memoria y auditorías privadas
.cargo-target/         caché Rust compartido (no se publica)
icons/                 recursos SVG editables
public/licenses/       avisos de RNNoise y Whisper
scripts/testing/       pilotos y evaluación reproducible
docs/                  manual, arquitectura, decisiones e informes
```

[Mapa de módulos](docs/architecture/PROJECT_STRUCTURE.md) · [Decisiones ADR](docs/decisions/README.md) · [Contexto recuperado](docs/CONTEXTO_RECUPERADO_2026-11-03.md)

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
