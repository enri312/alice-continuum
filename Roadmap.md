# Roadmap de Nyxia

Autor y propietario: Carlos Nuñez  
Última actualización: **2026-11-20**.  
Producto: **0.1.0** · documento maestro: **0.65**.  
Estado: R1 a R8 cerradas en sus alcances documentados; **R9 en progreso**; R10 futura.

**Identidad vigente.** Nyxia (Ník-sia) adopta el nombre visible y conversacional.
La instalación usa los identificadores y las rutas existentes de Alice Continuum
para abrir el mismo historial, preferencias y recuerdos.

**Dirección acordada:** Nyxia será una asistente y compañía capaz de realizar
acciones autorizadas, con objetivo Windows, Linux y macOS. Se prioriza reproducir
los fallos comunicados en instalaciones limpias de Windows y Linux; aún no se
conoce el error exacto. La migración progresiva a Dioxus conservará diseño,
contenido y backend, con pruebas aisladas antes de cada incorporación. Ver el
[plan de portabilidad y Dioxus](docs/architecture/PLAN_PORTABILIDAD_DIOXUS.md)
para fases, criterios y estado por plataforma. La aceptación de voz y el núcleo
siguen pendientes; el plan no da por resuelto R9 ni R10.

La [guía por tareas](docs/README.md) reúne instalación, uso, aprendizaje y recuperación.

**Verificación posterior a la migración Dioxus.** El lanzador de Windows
pasó `--check`. Pasaron la compilación, `npm test`, 478 pruebas Rust
(421 del backend y 57 de Dioxus) y 29 pruebas de los adaptadores Python.
Edge comprobó las 15 pantallas y los reintentos con WebAssembly bloqueado.
Tauri abrió con datos aislados y completó navegación, Memoria, permisos y
recuperación de consolidación. La siguiente prueba es la aceptación real de
R9, con un turno de texto y cinco turnos por voz en Windows. [Criterios de R9](docs/plans/R9-presence-voice-body.md).

**Navegación general en Dioxus (2026-11-19).** El crate `dioxus-ui` administra
la ruta activa, el regreso al Dashboard, los tres núcleos y sus 15 pestañas.
El marco conserva los iconos SVG y los contadores. En esta etapa intermedia
`App.tsx` montaba el contenido en la ruta seleccionada. Si falla WebAssembly,
la página solicitada conserva su recuperación y el marco permite reintentar.
El marco React anterior queda desactivado hasta completar la migración de
la interfaz y la lógica de la aplicación.
Las implementaciones desactivadas y sus pruebas se organizan en
`Frontend/src/Legacy/`. La evaluación de `App.tsx` empieza por trasladar el
estado compartido por bloques antes de sustituir el arranque React.
[Recuperación del contenedor](docs/architecture/DIOXUS_MIGRATION_STATUS.md#recuperación-de-la-interfaz).

**Primera etapa de App.tsx (2026-11-19).** El buffer temporal de Actividad y la
secuencia de eventos pasan a la sesión Rust del crate Dioxus. La consola, el
contador de pestaña y el Dashboard leen esa sesión. El buffer anterior queda
desactivado en `Legacy`.

**Segunda etapa de App.tsx (2026-11-19).** Rust administra la sesión de
Conversación. Conserva el borrador al cambiar de pantalla, admite una sola
respuesta en curso y comparte el proveedor, el modelo, la vista de historial y
los controles de comportamiento. El historial sigue en el almacén local de
Tauri y el proveedor y el modelo conservan la clave del WebView. El estado React
anterior quedó en `Legacy`.

**Tercera etapa de App.tsx (2026-11-19).** La sesión Rust del crate Dioxus
recibe los recuerdos guardados y el estado de la memoria de trabajo. Las
operaciones de archivo se coordinan en una cola y la vista muestra los cambios
después de que Tauri confirma el guardado. La sesión descarta lecturas antiguas
de RAM después de vaciarla. El código React anterior queda en `Legacy`.
Se fijó Dioxus **0.7.10** y se regeneró el WASM.

**Cuarta etapa de App.tsx (2026-11-19).** La sesión de aprendizaje en Rust
comparte el estado del autoestudio y del aprendizaje conversacional. Cada
fuente conserva su última lectura válida durante un fallo. El adaptador de
Tauri sigue escuchando los eventos, sondea cada cinco segundos y ordena las
escrituras del propietario. El hook React anterior queda en `Legacy`.

**Quinta etapa de App.tsx (2026-11-19).** La sesión de Memoria carga el perfil
confirmado y retira sus hechos del catálogo cuando Tauri invalida una fuente.
Rust selecciona registros finalizados y lecciones elegibles para Conversación.
Volumen cognitivo conserva también las lecciones pendientes o retiradas.
El puente TypeScript reúne las proyecciones con sus etiquetas y procedencia.
La lógica React anterior queda en `Legacy`.

**Sexta etapa de App.tsx (2026-11-19).** La sesión Rust asocia los
metadatos de la ventana activa a un permiso de sesión vigente. Confirma el
permiso con R2 antes de mostrar cada lectura. Al detener, revocar o vencer el
permiso, se borra la proyección y se descartan respuestas pendientes.
La sesión React anterior quedó en `Legacy`.

**Séptima etapa de App.tsx (2026-11-19).** La sesión Rust conserva el
contexto de recuperación revisado y vincula el resultado con la respuesta.
El adaptador de Conversación gestiona el envío, las consultas de memoria y
los comandos nativos de voz. La captura de visión pertenece al montaje de
Conversación. Antes de enviar, el adaptador comprueba de nuevo la revisión
y, cuando se incluyó la ventana, su permiso R2. El código anterior queda en
`Legacy`.

**Undécima etapa de App.tsx (2026-11-19).** Revisión y ciclo y Consolidación
completan la migración de Memoria a Dioxus. El ciclo conserva la procedencia, el
repaso, la vigencia, la accesibilidad, la supresión, el archivo reversible y la
retención con sus confirmaciones. Consolidación muestra el plan de solo lectura,
registra la decisión de mantener recuerdos separados y restaura transacciones
interrumpidas con recibos verificados por Tauri. La página React se conserva
desactivada en `Legacy`.
[Arranque y recuperación](docs/architecture/DIOXUS_MIGRATION_STATUS.md#recuperación-de-la-interfaz).

**Decimotercera etapa de App.tsx (2026-11-19).** Capacidades y permisos,
Procedimientos y Taller de habilidades pasan a Dioxus. El inventario enlaza
Auditoría por capacidad, R2 conserva la confirmación explícita, y un candidato
R5 puede convertirse en un borrador R4 con procedencia verificada. El Taller
conserva la simulación y las decisiones de ciclo de vida. `app.rs` asume
la ruta, las solicitudes de navegación y el filtro de Auditoría.

**Duodécima etapa de App.tsx (2026-11-19).** Rostro, Cuerpo y Avatar pasan a
Dioxus. Rostro conserva la lectura pasiva y las decisiones R2. Cuerpo conserva
los esquemas de referencia. Avatar controla el visor VRM, sus poses y su
telemetría desde Dioxus con el motor Three.js desacoplado de React.

**Décima etapa de App.tsx (2026-11-19).** Memoria incorporó en Dioxus la navegación,
Aprendizaje, Registros, Perfil, En sesión, Capas y Respaldo. La edición de un
recuerdo evaluado conservó la vista previa y la confirmación de la versión.

**Novena etapa de App.tsx (2026-11-19).** Volumen cognitivo monta en Dioxus
la escena, el inspector, las leyendas, el estado del aprendizaje y los cambios
de recuerdos observados desde la apertura. El lienzo conserva la cámara, la
geometría y la proyección de relaciones R8. La demostración mantiene separados
sus pulsos de los conteos de auditoría. Las vistas React pasan a `Legacy`.

**Octava etapa de App.tsx (2026-11-19).** Configuración y Planificador montan
sus pantallas en Dioxus. Configuración comparte el proveedor, el modelo y la
vista de historial con Conversación. El Planificador conserva el inspector
R3 y el registro R7, con vista previa, revisión, confirmación y despacho
manual. Las pantallas React anteriores quedan en `Legacy`.

**Conversación y Auditoría y diagnóstico en Dioxus (2026-11-19).** Las dos
pantallas montan sus vistas Rust y ofrecen reintentar la carga de Dioxus.
Conversación conserva el borrador, la revisión previa y sus herramientas
de voz, visión, diagnóstico de entrada y documentos. Auditoría conserva
el filtro por capacidad y el diagnóstico pasivo. Las implementaciones
React anteriores quedan desactivadas hasta la revisión para eliminarlas.
El crate `Frontend/crates/dioxus-ui` reúne las pantallas ya migradas.

**Dashboard de inicio en Dioxus y tema de consola (2026-11-17).** El inicio
reúne estado de Alice, accesos a herramientas y lecturas del equipo. Texto, voz
y revisión de mensajes se concentran en Conversación. El tema inspirado en
`Frontend/icons` se aplica al Dashboard y a las 15 pantallas existentes, con
marcos comunes y acentos por núcleo. Se conservan sus rutas, iconos y contenido.
El Dashboard muestra CPU, RAM, volumen de datos, red, energía y tiempo
encendido. El indicador circular representa RAM en uso. Se comprobó en
navegador la navegación y alineación de las 15 pantallas y en Tauri el arranque,
las lecturas reales, el borrador de Conversación y la persistencia de relaciones.
[Dirección visual](docs/architecture/DIRECCION_VISUAL_ALICE.md).

**Iconografía y Núcleo de gobernanza (2026-11-17).** Los 21 SVG funcionales
tienen ilustraciones propias, con materiales y piezas comunes. El inventario y
los permisos tienen vistas diferenciadas. El historial de operaciones se consulta
en Auditoría. Procedimientos conserva patrones y el Taller recibe sus borradores.
Cada instrumento incorpora mecanismos relacionados con su función. En Flujo
cognitivo el encabezado y la leyenda ocupan espacio fuera del mapa. Cinco de
las trece rutas pueden mostrar señal derivada de la auditoría local. Las otras
ocho están identificadas como previstas. El inspector de capacidades abre su
historial filtrado y Permisos consulta la vigencia mientras su panel está abierto.
En Tauri para Windows se comprobó con dos episodios de prueba que una asociación
confirmada en Flujo sigue visible en Volumen cognitivo tras recargar la ventana.
El próximo paso del cerebro es seguir un aprendizaje desde su registro hasta su
aparición en Volumen cognitivo y comprobar qué persiste al reiniciar Alice.

**Cierre del arranque Dioxus.** La aplicación abre desde `main.ts` y
`app.rs` en Windows. Las pantallas montan Dioxus y los respaldos interactivos
se ejecutan en el navegador incluso con WebAssembly bloqueado. `App.tsx`,
la entrada anterior y sus hosts quedaron archivados en `Frontend/src/Legacy/`.
Se retiraron el plugin React de Vite y JSX de la compilación activa. Las
dependencias de React se reservan para las pruebas históricas de `Legacy`.
La migración del arranque mantiene separadas las pruebas con servicios y
dispositivos reales. [Inventario de la migración](docs/architecture/DIOXUS_MIGRATION_STATUS.md).

**Propuesta 04 incorporada a Conversación (2026-11-15):** el propietario eligió
el HTML «Mejora del diseño actual» como referencia. La pantalla principal adopta
superficies translúcidas, bordes redondeados, degradado violeta/azul/cian y fuentes
locales, conservando los iconos y las funciones existentes. Revisión obligatoria,
contexto, voz, visión y herramientas plegadas siguen conectados al producto;
no se copiaron respuestas, recuerdos ni alarmas simuladas del HTML. Se probaron
cancelación, edición, confirmación y error con IPC sintético, teclado, carrusel
y anchos 320–1280 px. La aceptación Tauri usa IPC real y datos aislados, sin
enviar una consulta a un modelo ni abrir dispositivos. Esa primera versión de
Conversación todavía usaba React.
Ver [dirección visual](docs/architecture/DIRECCION_VISUAL_ALICE.md) e
[informe y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/CONVERSATION_PROPOSAL04_REPORT_2026-11-15.md).

**Limpieza de elementos añadidos:** por observación del propietario se retiraron
el aro decorativo, las dos flechas y el encabezado técnico repetido que se había
hecho visible. `App.tsx` vuelve a coincidir con la versión previa al rediseño;
en esa revisión los 22 SVG y sus consumidores originales permanecieron intactos. Se conserva el
estilo elegido y el desplazamiento nativo de las pestañas, sin controlador extra.
La alineación de iconos y etiquetas se corrigió separándolos en dos filas fijas:
misma altura, eje central común y texto completo en anchos 320–1280 px, sin
modificar los SVG ni sus componentes.

**Icono de Conversación adaptado:** tras aprobar la alineación, el propietario
solicitó un estilo de IA con más detalle. Sólo este SVG evoluciona a capas de
cristal, circuitos y acentos violeta/azul/cian, conservando mensajes, micrófono,
filtro local, respuesta vocal y visión opcional. La escena es estática y no
indica dispositivos activos. Generación individual reproducible, otros 21 SVG
intactos, 173 comprobaciones de iconos, compilación y aceptación de navegador
correctas. Ver [informe](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/CONVERSATION_ICON_PROPOSAL04_REPORT_2026-11-15.md).

**Reparto Node.js/Python, primer incremento (2026-11-15):** por instrucción del
propietario se inició el formateo de notas Obsidian en Python. El ensayo privado
comparó bytes de 18 casos y midió lotes antes de incorporar el comando manual
`obsidian:sync:python`. Node conserva preparación de campos, JSON técnico,
validaciones, índices y escritura protegida; Python construye el Markdown.
La vigilancia automática sigue con Node por el coste de iniciar otro proceso.
La integración se probó únicamente con bóvedas ficticias, incluidos conflictos
y fallo del adaptador. Respaldos, núcleo, permisos y diseño conservan su función.
El segundo incremento incorpora el análisis del reranqueo R8 descrito debajo;
Dioxus mantiene el objetivo de retirar React. Ver [reparto y estado](docs/architecture/REPARTO_NODE_PYTHON.md)
y [pruebas](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/NODE_PYTHON_OBSIDIAN_REPORT_2026-11-15.md).

**Reparto Node.js/Python, segundo incremento (2026-11-15):** el evaluador manual
`r8-gemma-rerank-eval.test.ts` delega conteos Top-1/Top-3, proporciones, latencia
media y construcción del informe en `Backend/adapters/r8_rerank_report.py`.
TypeScript conserva el contrato de recuperación, inferencia, selección de fuentes
y comprobación SHA-256. El modo offline `eval:r8:report` procesa sólo rankings
numéricos elegidos expresamente, sin modelos ni textos personales. Se compara
con el cálculo anterior usando 25 lotes ficticios; el ensayo con Gemma y perfil
real continúa siendo optativo y no se ejecutó en este incremento. No se portan
los pilotos históricos ni se modifica su evidencia. Ver [auditoría y validación](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/NODE_PYTHON_R8_REPORT_2026-11-15.md).
El contenedor de Actividad avanzó en el incremento Dioxus descrito más abajo.

**Prioridad posterior del propietario:** continuar en Windows y reducir React
mediante la migración a Dioxus antes de retomar Ubuntu. El grafo y el inspector
de Flujo cognitivo pasan a Rust/Dioxus con los mismos estilos y datos. Las
conexiones y sus señales, la geometría y la selección se resuelven en Rust.
En ese primer tramo, el contenedor, el sondeo R3 y las asociaciones de memoria
permanecían en React; el controlador de relaciones avanzó en el incremento del
2026-11-15 descrito más abajo.
El WASM se comparte con Estado y controles y se carga bajo demanda. Ocho pruebas
Rust del módulo, compilación WASM y Clippy aprobadas; 872 pruebas frontend,
15 de Obsidian, 20 de respaldos y dos de privacidad aprobadas. La revisión Edge
del build mostró once nodos y renderer Dioxus. La interacción de Tauri sigue
pendiente: la automatización de ventanas no se conectó. Este incremento no
completa la migración de la pantalla ni del proyecto.

**Siguiente componente sencillo:** el encabezado y la banda de actividad de Flujo
se trasladan a `activity_ui.rs`, compartido con Estado y controles. Sus clases,
rótulos, estados de carga, ausencia de señal y auditoría degradada se conservan.
El adaptador de datos R3 es común y el sondeo existente no se duplica. Un ensayo
Edge aislado sobre el build verificó clic, teclado, navegación de ida y vuelta,
ausencia de duplicados, anchos de 1440/1000 px y estados R3 ficticios. También
bloqueó la descarga de WASM y comprobó el respaldo y el reintento conservando la
selección. La aceptación nativa Tauri sigue pendiente; las asociaciones avanzaron
en los incrementos siguientes.

**Lista de relaciones guardadas:** títulos, estados y botones pasan a Dioxus.
El renderer sólo solicita abrir una revisión; inicialmente los formularios,
confirmaciones y comandos seguían en el controlador React. La frontera valida IDs y
bloqueos. Se retiró el montaje duplicado en favor de una plantilla compartida.
La prueba Edge con IPC ficticio comprobó cancelación, confirmación con revisión,
error y recuperación sin escritura durante selección o reintento; las pruebas
de persistencia del backend usan datos temporales. El
[inventario de dependencias pendientes](docs/architecture/DIOXUS_MIGRATION_STATUS.md)
guía la limpieza después de completar y validar cada sustitución.

**Formulario de fuentes:** selectores, lectura original y citas pasan a Dioxus.
La validación bloquea fuentes repetidas o ausentes, citas vacías, longitud mayor
de 2048 unidades UTF-16 y edición durante una revisión. El adaptador rechaza
eventos que intenten aportar confirmaciones, hashes o revisiones. El controlador
actual conserva el borrador, obtiene la evidencia vigente y solicita la revisión
al backend; editar invalida la revisión anterior. La sonda Edge con IPC ficticio
comprobó edición, bloqueo, confirmación separada, rechazo de cita no literal y
recuperación tras un fallo de WASM manteniendo fuentes y citas. La aceptación
nativa sigue pendiente; las confirmaciones avanzaron en el incremento siguiente.

**Confirmaciones de relaciones:** la revisión de citas y las pantallas de
creación, retirada/restauración y cancelación pasan a Dioxus. El controlador
conserva los comandos y la revisión durable; cada pendiente tiene una identidad
temporal para rechazar eventos atrasados. Una guardia admite una acción por
pendiente, evitando duplicar solicitudes por doble clic. Las pruebas Edge con
IPC ficticio verificaron renderer Dioxus activo, bloqueo durante el guardado,
cancelación, revisión esperada, error y recuperación sin escritura automática.
La aceptación nativa con datos reales sigue pendiente.

**Controlador de relaciones (2026-11-15):** el panel completo y la sesión normal
pasan a Rust/Dioxus: borrador, fuentes/citas, evidencia derivada, revisión,
confirmaciones, bloqueos, actualización y errores. Las tres presentaciones se
reutilizan en un único montaje; el host React sólo monta y conecta un transporte
cerrado con los comandos existentes. El controlador anterior se carga de forma
diferida únicamente si falla Dioxus. El backend conserva confirmación, revisión
durable y validación de fuentes. Verificación: 19 pruebas Rust, Clippy WASM,
build, 883 pruebas frontend (dos omitidas), 15 Obsidian, 20 respaldos y dos
privacidad; Edge con IPC ficticio comprueba también desmontaje y respuesta
tardía sin guardar. Se conservaron clases CSS, rótulos y contenido; no se usaron
recuerdos personales. Siguen pendientes la aceptación nativa Tauri y retirar
las dependencias del contenedor/sondeo de Flujo y sus respaldos.
Ver [informe y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/ASSOCIATIONS_DIOXUS_REPORT_2026-11-15.md).

**Contenedor y sondeo de Flujo (2026-11-15):** el contenedor completo, la selección,
la validación/proyección R3 y el sondeo de cinco segundos pasan a Rust/Dioxus.
La página integra el grafo y la sesión de relaciones en un único montaje.
Conserva los rótulos, CSS, inspector y contenido; no enciende regiones ni enlaces
sin evidencia válida. La lectura pendiente bloquea otra consulta, salir cancela
el temporizador y las respuestas anteriores no se aplican a una sesión nueva.
El host React conserva el montaje y la entrada del snapshot base; la página
anterior y el sondeo compartido quedan para recuperación y otras pantallas.
Build, 25 pruebas Rust, Clippy WASM y 887 pruebas frontend aprobados; Edge
comprobó también una lectura suspendida durante dos intervalos y la retirada de
señal al recibir datos inválidos. La aceptación nativa pasó con una ventana real
de Tauri/WebView2 y backend real sobre fuentes sintéticas: Conversación,
Estado/Flujo, inspector, R3, revisión, confirmación, cancelación y persistencia
al recargar. Esa prueba detectó y permitió corregir el formato de hashes de
evidencia (`sha256:`); los fixtures y una regresión cubren ahora el contrato
nativo. Ver [informe y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/FLOW_PAGE_DIOXUS_REPORT_2026-11-15.md).

**Cierre obligatorio de cada migración:** abrir Alice en Windows desde el código
actual, comprobar la pantalla afectada y la navegación, y distinguir la prueba
nativa de la simulada. No dar por comprobado el arranque sólo por compilar.
El ensayo nativo usa una carpeta temporal privada y el backend real; voz,
proveedores y datos personales requieren su propia aceptación cuando corresponda.

**Organización Frontend (2026-11-15):** fuentes, estilos, iconos, recursos,
configuración de Vite/TypeScript y el crate Dioxus pasan a `Frontend/`.
La raíz coordina un workspace npm con lock único y mantiene los comandos y
lanzadores habituales. Tauri usa `Frontend/dist/`; los generadores, pilotos,
pruebas y CI apuntan a las nuevas rutas. El traslado conservó los hashes de 293
archivos y las versiones de dependencias; no se editaron componentes ni estilos.
Build, 894 pruebas frontend (dos omitidas), 25 Rust, Clippy WASM, Obsidian,
respaldos y privacidad aprobados. Edge y Tauri/WebView2 verificaron navegación,
R3, fuentes, confirmación y persistencia con datos aislados desde la estructura
nueva. Se conserva la separación entre datos privados y código. La revisión
actual de la raíz está en el [mapa de carpetas](docs/architecture/MAPA_CARPETAS_RAIZ.md).
Este incremento ordena las fuentes; no declara migrada otra pantalla a Dioxus.

**Organización de recursos y datos (2026-11-15):** se revisaron `runtime/` y `data/`
y se agruparon 42 elementos de pruebas, caché, revisiones, recuperaciones y
scripts auxiliares. Se comprobaron por SHA-256 16.342 archivos trasladados y
159 archivos protegidos. Las rutas de memoria, historial, perfiles, bóvedas,
modelos, entornos y herramientas activas se conservaron. Dos capturas técnicas
pasaron de `data/visual-checks/` a `runtime/artifacts/visual-checks/`. Las sondas
nuevas usan `runtime/artifacts/dioxus/` y los respaldos cubren también
`runtime/archives/`, `runtime/drafts/` y `runtime/maintenance/`. Compilación, 894 pruebas
frontend (dos omitidas), 15 Obsidian, 20 respaldos y dos privacidad aprobadas.
Edge con IPC ficticio y Tauri/WebView2 con backend real y datos aislados
comprobaron navegación, R3, relaciones y persistencia tras la movida.
El [informe de organización](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/LOCAL_DATA_ORGANIZATION_REPORT_2026-11-15.md)
detalla el alcance. La siguiente migración continúa de una pantalla por vez;
este incremento no modifica componentes ni estilos.

**Nombre de los recursos privados (2026-11-15):** `local/` se renombra a
`runtime/`, con actualización de backend, respaldos, lanzador Linux, CI, pilotos,
configuración y guías. `data/` permanece estable. Se verificó el inventario de
69.831 archivos antes de ajustar rutas de configuración; el respaldo anterior y
los originales de esas configuraciones se conservaron en D:. Build, 894 pruebas
frontend, 421 del backend Rust (32 omitidas), Obsidian, respaldos, privacidad y
19 pruebas Python (una omitida) aprobados. Tauri/WebView2 comprobó navegación,
R3 y persistencia desde la nueva ruta. Linux nativo se comprobará por separado.
Ver [informe del renombrado](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/RUNTIME_RENAME_REPORT_2026-11-15.md).

**Sesión R3 de Estado y controles (2026-11-15):** sondeo serializado de cinco
segundos, validación y proyección de métricas pasan a Rust/Dioxus. El host React
aporta el snapshot base y comunica los ajustes compartidos con Conversación;
la recuperación anterior se carga sólo ante fallo, conservando selección y
ajustes al reintentar. Se conserva el contenido y no se modifican estilos.
Build, 28 pruebas Rust, Clippy WASM y 898 frontend aprobados; también Obsidian,
respaldos y privacidad. Edge verificó lecturas suspendidas durante dos intervalos,
señal inválida, teclado, ajustes, desmontaje y recuperación. Tauri/WebView2 abrió
Estado con R3 real y comprobó navegación y persistencia con datos aislados.
Ver [informe y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/STATE_SESSION_DIOXUS_REPORT_2026-11-15.md).

**Línea temporal cognitiva (2026-11-15):** la ventana de 24 eventos, selección,
geometría, contadores, duración, inspector y leyenda pasan a Rust/Dioxus.
Se retira `CognitiveTimeline.tsx`; su host temporal sólo monta, recibe eventos
y permite reintentar. No se añade otra línea temporal en React para recuperación.
Se conservan los contenidos, clases CSS y eventos de sesión; no hay IPC ni
persistencia en este renderer. En ese incremento, el contenedor de Actividad y
las otras vistas continuaban pendientes. Build, 32 pruebas Rust, Clippy WASM, 900 frontend,
Obsidian, respaldos y privacidad aprobados. Navegador y Tauri comprobaron
selección por teclado, actualización, vaciado, navegación y recuperación.
Ver [informe del incremento](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/TIMELINE_DIOXUS_REPORT_2026-11-15.md).

**Página de Actividad (2026-11-15):** encabezado, pestañas Timeline/Event Stream,
consola, búsqueda, filtro por módulo y estado visible pasan a Rust/Dioxus en un
solo montaje con la línea temporal. Se mantienen textos, contenido, clases CSS,
horas locales con milisegundos y los 200 eventos de sesión; la línea muestra
los últimos 24. Filtros y selección se conservan entre vistas. Limpiar sólo
solicita vaciar el buffer temporal, sin comandos ni escrituras de auditoría.
Se retiran `ActivityPage.tsx`, `CognitiveTimelineHost.tsx` y el montaje WASM
independiente de Timeline. Auditoría/diagnóstico queda separado, con su contenido
React anterior. `ActivityHost.tsx` es una frontera temporal de montaje/reintento;
`App.tsx` todavía produce y conserva el buffer y la navegación. La salida total
de React permanece pendiente. Ver [alcance y aceptación](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/ACTIVITY_PAGE_DIOXUS_REPORT_2026-11-15.md).

**Primer ensayo de instalación limpia Windows:** en un clon aislado sin
dependencias, el lanzador indicó que faltaba Vite y pidió `npm ci`. Después de
instalar las dependencias, `--check` y la compilación frontend pasaron. El ensayo
utilizó Node y Rust ya instalados en este equipo; no incluyó arranque nativo,
modelos, voz ni datos personales. Aún no reproduce el error de la otra persona.
El lanzador aclara que `--check` no valida modelos, micrófono, voz ni proveedores.

**Primer ajuste de rutas:** las instalaciones Windows sin la carpeta histórica
`D:/Alice-model-evaluation` usan `runtime/inference/` como raíz predeterminada.
La carpeta histórica existente conserva prioridad en Windows, para no seleccionar
por accidente los motores Linux compartidos. `ALICE_INFERENCE_HOME` prevalece
cuando está configurada. Sigue pendiente instalar los recursos en equipos nuevos,
validar los ejecutables por plataforma y preparar los instaladores.
Verificación de este incremento en Windows: 421 pruebas Rust aprobadas, 32
sondas omitidas, Rustfmt y Clippy sin advertencias; seis comprobaciones de
identidad/recursos y dos de privacidad aprobadas. No se realizó un turno de voz
ni una aceptación de instalación en Linux o macOS en este incremento.

**Prioridad de R9, pendiente mientras avanza la migración:** estabilizar captura y transcripción con la voz del
propietario y mantener un diagnóstico compacto, sin incorporar más funciones a
Conversación durante la aceptación de R9. Whisper conserva el manejo de proceso
validado en `1120ddc`. Un fallo posterior del filtro local detuvo la captura antes
de alcanzar ASR. El watchdog pasó pruebas, compilación y una sonda sintética;
el propietario confirmó después una respuesta por voz, con demora. La prioridad inmediata es revisar latencia y cinco turnos breves. Se identificó un defecto de inicio
del reloj en el código, sin demostrar la causa única del episodio real ni
un problema físico del micrófono.
Después se retoma la comprobación del núcleo ya implementado: el autoestudio
limitado a las materias autorizadas y su proyección en Obsidian conservan sus
avances. Siguen pendientes la revisión de contratos, la aceptación personal del
ciclo de aprendizaje y los incrementos de estructura que esa revisión justifique.
Ver [estructura y pendientes](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).

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

**Condición para los pilotos:** ASR de R9 y Dioxus se prueban en
`experiments/` (carpeta local privada), separados de la aplicación. Sólo se
considerará su incorporación tras validar funcionamiento, contenido, límites y
reversión; un build o una muestra sintética no bastan. La propuesta
«Persistencia y Grafos: Evolución futura de R6 y R8» queda aplazada para una
revisión profunda del proyecto. No se autoriza una migración de memoria en este tramo.
[Resultados de los pilotos y pendientes](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/ISOLATED_PILOTS_REPORT_2026-11-13.md).
El ajuste visual de Dioxus queda dentro de `experiments/`: deslizadores bloqueados
para comportamiento y fila `EPISODIC` sintética. Compilación, cuatro pruebas de
modelo, inspector y presentación de escritorio comprobados; quedan la revisión
completa a otros anchos y la validación nativa antes de considerar su adopción.

**Incremento implementado en la aplicación principal:** encabezado de
Estado y controles sin superposición, ocho deslizadores y conexión de Creatividad y Estilo
empático con la generación local de Gemma/Ollama. Los demás controles conservan
su bloqueo. La fila de memoria muestra el contexto recuperado real, distinguiendo
preparación, envío, respuesta, ruta sin memoria y fallo. Contratos, compilación y
revisión Tauri de escritorio comprobados; quedan la aceptación del tono y la
revisión completa a otros anchos. El
[incremento React/Tauri](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/STATE_CONTROLS_REPORT_2026-11-13.md) conserva
el rótulo técnico y «Modelo interno», sin migrar la persistencia de R6/R8.
La memoria recuperada adopta una fila compacta de categoría, contenido y puntuación,
con estado y procedencia al seleccionarla en el inspector. Recuperación local real
y selección comprobadas en Tauri; 20 pruebas dirigidas y compilación aprobadas.

**Primera página Dioxus incorporada el 14 de noviembre:** sólo Estado y controles,
con el mismo CSS y contenido, dos ajustes conectados, seis controles bloqueados,
memoria real e inspector. El adaptador React conserva el estado y una vista de
respaldo. Pasaron 863 pruebas frontend, 15 de Obsidian, 20 de respaldos, dos del
contrato Rust, compilación WASM y Clippy. Ver [evidencia y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/STATE_CONTROLS_DIOXUS_REPORT_2026-11-14.md).
`experiments/` queda fuera de Git; de `data/obsidian/` sólo se versiona `.gitkeep`.

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
| Autoestudio al arrancar | Implementado; aceptación personal en curso | 48 lecciones en 16 áreas, ejercicios, avance y repaso; sólo se recuperan lecciones activas con el último ejercicio aprobado. |
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
  [ADR-P-113](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-113-autoestudio-modular.md).
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
  [alice-continuum](https://github.com/enri312/nyxia).

- **Volumen y evolución:** representación del cerebro lógico con nodos vinculados
  a registros y seguimiento de cambios observados al aprender, sin duplicar el
  mapa de módulos de Flujo cognitivo.
  Los intentos de estudio permanecen visibles con su estado, separados de RAG;
  la actividad R3 y el modo Demostración tienen fuentes y significados distintos.
  [ADR-P-115](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-115-volumen-cognitivo-y-evolucion-visible.md).

- **Fuentes de aprendizaje y núcleo:** lecturas serializadas y recuperables,
  eventos con respaldo periódico, mutaciones protegidas frente a respuestas
  antiguas y coordinación extraída de `App.tsx`. El Volumen muestra fase registrada,
  última lectura y errores, con reintento de consulta; la leyenda queda plegada
  fuera del lienzo. [ADR-P-116](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-116-fuentes-de-aprendizaje-observables.md).

- **Colores y revisión nativa del Volumen:** relleno por tipo o asociación
  emocional revisada; estados en contornos y recuperación en anillo blanco,
  con guía y ficha derivadas de las mismas definiciones. Se revisaron la página,
  sus fuentes y la actualización de lecturas en Tauri. El fallo del canal anterior
  de automatización se resolvió usando la conexión compatible.
  [ADR-P-117](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-117-colores-y-marcas-del-volumen.md).

- **Fiabilidad del aprendizaje y prioridad:** una respuesta no evaluable conserva
  el conocimiento anterior y termina el ciclo con un aviso, sin calificaciones
  ficticias. El motor reserva la prioridad de conversación antes de la cola y
  vuelve a comprobar la cesión al recibir una respuesta. La prioridad vive en
  un módulo privado separado del transporte y del proceso.
  [ADR-P-118](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-118-evaluacion-fiable-y-prioridad-de-conversacion.md).

- **Reanudación del estudio y continuación R9:** pausa invalida el ciclo anterior;
  reanudar mientras termina conserva una única solicitud y la libera al cerrar
  el worker. Activar de nuevo un estudio activo conserva su fase. El icono del
  Volumen incorpora crecimiento observado y contornos de estado; Spotify en
  Windows admite la playlist privada configurada, comprobando su identificador
  en el contexto de reproducción.
  [Coordinación](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-119-reanudacion-del-autoestudio.md) ·
  [Spotify](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-120-playlist-spotify-configurada.md).

**Validación conservada del 12 de noviembre:** 824 pruebas frontend aprobadas
(2 sondas omitidas), 393 Rust (30 sondas omitidas), 15 de Obsidian y 20 de respaldo;
compilación frontend, formato Rust y Clippy aprobados. La navegación se comprobó a 1440,
1000 y 420 píxeles en una vista aislada sin backend ni datos personales. El Volumen
también se inspeccionó en Tauri con sus fuentes nativas; esto no acredita por sí
solo voz ni el ciclo completo de aprendizaje y Obsidian.

**Validación del backend, 13 de noviembre:** 408 pruebas Rust aprobadas y 32
sondas omitidas por defecto; dos del runtime instalado se seleccionaron y
aprobaron aparte, y quedan 30 opcionales sin ejecutar. Cargo check, formato,
Clippy de todos los targets con `-D warnings` y compilación nativa aprobaron.
La aplicación actualizada abrió normalmente, con micrófono apagado y lectura
de Conversación, Volumen, Memoria y Gobierno. Frontend, Obsidian y respaldo
conservan los resultados del día 12 y no se repitieron. No hubo error forzado
en la UI ni una nueva prueba de voz real.
La playlist privada de Spotify se comprobó mediante una orden escrita en Alice,
con control de pausa de cabecera, ID de contexto y recibo coincidentes. La orden
hablada también produjo el recibo y el propietario confirmó música y voz. El
filtro falló después; se añadió descarte y único rearme de captura por sesión.
La estabilidad prolongada y los cinco turnos con música siguen pendientes.
La pérdida de «pausa» también se observó al repetir una orden corta. Whisper
deja de recibir una lista fija como texto inicial; una mención de servicio sin
acción pide aclaración antes de Gemma y de cualquier herramienta. La repetición
acústica con este ajuste permanece pendiente.
[ADR-P-122](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-122-transcripcion-sin-texto-prefijado.md).
Por la petición de mayor sensibilidad para voz baja se añadió un perfil de
ganancia 4× y pausa de cierre de 2 s, con opción Normal y sin modificar los
criterios mínimos de voz. En la repetición personal hubo una orden corta de
pausa correcta y otras con palabras sustituidas; la precisión no es estable.
[ADR-P-123](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-123-voz-baja-y-pausada.md).
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
[ADR-P-125](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-125-conservar-voz-baja-filtrada.md) ·
[Pruebas de señal](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/SOFT_VOICE_SIGNAL_REPORT_2026-11-12.md).
La repetición personal siguió cambiando palabras. Se añade diagnóstico local
de entrada/salida y saturación, junto a escucha de la toma filtrada antes de
transcribir y un resultado ASR separado del borrador. Se mantiene la cadena
de audio para medirla antes de decidir otro ajuste. La claridad del sonido y
la precisión de la frase real siguen pendientes.
[ADR-P-126](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-126-diagnostico-local-de-audio.md) ·
[Diagnóstico de entrada](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/VOICE_INPUT_DIAGNOSTICS_REPORT_2026-11-12.md).
Por prioridad del propietario, se incorpora una personalidad compartida para
texto, voz y visión y una selección de voz Fish privada en
`data/voice-profile.json`. El perfil local prevalece; la variable heredada sólo
se consulta si no existe ese archivo. No se cambia el modelo TTS
`s2.1-pro-free`, el reconocedor ni la cadena de captura. La nueva voz tuvo
síntesis exitosa de una frase revisada en Tauri. La valoración audible
y la aceptación cotidiana del estilo quedan pendientes del propietario; no
cierran el fallo de reconocimiento ni R9.
[ADR-P-127](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-127-voz-privada-y-personalidad-alice.md) ·
[Verificación del incremento](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/ALICE_VOICE_PERSONALITY_REPORT_2026-11-12.md).
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
[ADR-P-128](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-128-feedback-de-escucha-y-aclaracion-local.md) ·
[Resultados y pendientes](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/VOICE_TURN_FEEDBACK_REPORT_2026-11-12.md).
Una toma manual posterior mostró recorte de entrada con ganancia 4×. Se reduce
únicamente la ganancia de **Voz baja y pausada** a **2×**, conservando Normal,
filtros, VAD, cierre de 2 s, dispositivo y modelos. No se añaden controles,
dependencias, procesos o timers. Pasaron 824 pruebas frontend y la compilación;
la repetición acústica queda pendiente. La frase de esa toma fue «parar y revisar audio»:
el propietario había pronunciado la etiqueta del botón. Se aclara que debe pulsarlo con el ratón. El dato
de recorte no demuestra la causa única de una transcripción incorrecta.
Los incrementos anteriores conservan sus valores históricos de 4×.

[ADR-P-124](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-124-modelo-whisper-small.md) ·
[Evaluación](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/WHISPER_SMALL_REPORT_2026-11-12.md).
[Prueba con micrófono y recuperación](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/VOICE_PLAYLIST_ACCEPTANCE_REPORT_2026-11-11.md).
[Continuación del núcleo y R9](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/COGNITIVE_R9_CONTINUATION_REPORT_2026-11-11.md).
[Resultados y alcance](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/README.md#verificación).

### Incremento del 13 de noviembre: fallos del proceso Whisper

Se separa la gestión del child en `whisper_input/process.rs`, con fallos
tipados, stdout/stderr acotados en RAM y drenaje hasta EOF. Un error fatal
detectado en stderr es un fallo aunque el proceso termine con código cero;
no se convierte en una toma sin palabras. Cancelación, límite de 90 s y fallos
de preparación conservan cierre, espera y unión de los hilos del CLI directo;
no se administran descendientes arbitrarios. El PCM silencioso puede terminar
como noSpeech sin lanzar el CLI; un error técnico no se trata como silencio.
La auditoría R3 recibe sólo una clase fija y, cuando existe, un código de salida
hexadecimal normalizado con sufijo `_EXIT_{8HEX}`, con longitud acotada;
`FailureKind` y `WhisperFailure` no exponen stderr, rutas ni texto ASR.

No se modifica interfaz, DSP, ganancia 2×, dispositivo o modelos, ni se añade
fallback o reintento ciego. Las dos pruebas seleccionadas del CLI instalado
aprobaron en 5,13 s en total y la positiva sintética con Alice/Gemma activos
en 8,01 s. Son comprobaciones de proceso, no aceptación acústica, que sigue
pendiente. La opinión solicitada sobre el diseño no añade
un proyecto de rediseño ni cambia la prioridad de estabilizar R9.
[ADR-P-129](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-129-fallos-del-proceso-whisper.md) ·
[Resultados y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/WHISPER_PROCESS_FAILURE_REPORT_2026-11-13.md).

### Incremento del 13 de noviembre: watchdog del filtro local

El plazo de ausencia de métricas se iniciaba antes de preparar WASM y conectar
el grafo; esa preparación podía consumir su umbral antes de la primera lectura.
Se usa `performance.now()` desde el grafo conectado y se renueva al recibir
métricas, incluido silencio válido. El umbral permanece en 1500 ms.

`NoiseSignalTimeout` cierra los nodos procesados; VoiceCapture conserva el
motivo `metrics_timeout` y libera la captura original. VoiceLoop permite el
mismo único rearme por sesión que comparten `input_backlog` y `output_overflow`.
La toma parcial se descarta antes de ASR; un segundo fallo es fatal y apagar
invalida los callbacks pendientes. No hay audio crudo, controles, modelos o
servicios nuevos. Aprobaron 840 pruebas frontend (2 omitidas), incluidas 19 del
pipeline y 80 de captura/bucle, y TypeScript/Vite con el aviso habitual de chunks.
La sonda Chrome con Worker/WASM/Worklet y MediaRecorder reales aprobó con
silencio generado y preparación demorada, sin micrófono, altavoces, ASR o
archivos de audio. El primer criterio de cadencia del arnés se corrigió y su
resultado queda documentado. La ventana Alice se revisó con micrófono inactivo
y sin el aviso anterior. Después, el propietario confirmó que recibió respuesta,
con demora. El último turno R3 registró 6998 ms de transcripción, 1721 ms de
respuesta y 2361 ms de síntesis; no incluye captura, pausa de cierre o reproducción.
La causa física anterior y la aceptación prolongada siguen pendientes;
Whisper, Obsidian y respaldo conservan sus validaciones anteriores sin repetirse.
[ADR-P-130](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-130-watchdog-del-filtro-local.md) ·
[Resultados y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/NOISE_WATCHDOG_REPORT_2026-11-13.md).


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

El futuro motor deberá explicar qué señal modificó cada canal, aplicar decaimiento, separar estado efímero de memoria y permitir desactivar su influencia sobre comportamiento y avatar. No se presentará como conciencia, sentimiento biológico ni diagnóstico del usuario. El diseño completo está en [AFFECTIVE_SIMULATION_DESIGN.md](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md).

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
72.000 caracteres y TTL de dos horas, definidos en `Backend/src-tauri/src/working_memory.rs`.
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

**Preauditoría R6 · 2026-08-24:** las sondas Rust de sólo lectura encontraron 20 recuerdos reales y conservaron los SHA-256 de los 21 archivos canónicos. R6.6-A resolvió la brecha estructural de capa, pero quedaron nueve recuerdos `notAssessed` sin procedencia explícita. Esa evidencia histórica y el bloqueo correcto se conservan en [R6_CLOSEOUT_AUDIT_2026-08-24.md](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/R6_CLOSEOUT_AUDIT_2026-08-24.md).

**Cierre final R6 · 2026-09-01:** después de las decisiones explícitas del propietario y la retirada de registros inconclusos, `records.json` contiene 15 recuerdos reales: 13 vigentes y 2 conflictivos, sin recuerdos no evaluados ni procedencia faltante. La proyección `layer-index-v3.json` activa clasifica 14 episodios y 1 procedimiento `pendingR5`, sin elementos no clasificados. El ciclo `lifecycle-index-v1.json` también está activo sobre el mismo SHA-256 vigente. Las dos sondas canónicas de sólo lectura conservaron exactamente los 35 archivos de `data/` y su digest agregado. Los 2 conflictos permanecen visibles y excluidos de recuperación como conocimiento vigente; no bloquean el cierre porque R6 exige preservarlos, no resolverlos silenciosamente. Evidencia completa en [R6_CLOSEOUT_REPORT_2026-09-01.md](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/R6_CLOSEOUT_REPORT_2026-09-01.md).

#### Ampliaciones de memoria autorizadas en noviembre

La selección automática de citas conversacionales del 3 de noviembre conserva
lo declarado por el propietario, su procedencia y los controles de pausa,
corrección y retirada. No reescribe los registros confirmados.
[ADR-P-101](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

El autoestudio incorporado el 10 de noviembre comenzó con 42 lecciones. Ahora
usa **48 lecciones en 16 áreas**, con tres niveles por área. Sus materias son:

- Matemáticas: aritmética, álgebra, geometría, trigonometría, cálculo, álgebra
  lineal, probabilidad, estadística y lógica.
- Historia bíblica con enfoque católico, diferenciando relato, doctrina y
  corroboración histórica.
- Psicología de las emociones e inteligencia emocional.
- Empatía, solidaridad y humildad, cada una como área propia.
- Pensamiento crítico y ética.

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
[Fuentes](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/research/SELF_STUDY_SOURCES_2026-11-10.md) ·
[Prueba de arranque y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/SELF_STUDY_STARTUP_REPORT_2026-11-10.md) ·
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

Cierre y alcance precisos en [el plan R7](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/plans/R7-tasks-intentions.md) y
[la validación viva R7.5](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/R7_5_LIVE_VALIDATION_2026-09-04.md).
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
Plan: [R8-knowledge-graph.md](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/plans/R8-knowledge-graph.md).

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
Gemma 4 se mantiene y el avatar queda al final según [ADR-P-099](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-099-sesion-de-voz-y-node-26.md).  
Se añade parada mediante orden directa durante escucha y evaluación de referentes
Alice/Carlos/terceros con [ADR-P-100](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-100-referentes-parada-de-voz-rust.md).
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
[Resultados de voz y música](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/UBUNTU_LATENCY_MEDIA_REPORT_2026-11-06.md).

Incremento 2026-11-05: preguntas sobre «tu explicación/voz…» en una cita con
destinatario explícito disponen de una resolución local acotada, con procedencia
visible y sin inferencia adicional. Los casos sin cobertura continúan en Gemma.
Persisten errores con pronombres ambiguos y continuidad; no se da por aceptada
la conversación real. [ADR-P-110](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-110-referencias-explicitas-en-citas.md).

Incremento 2026-11-06: espera de frases dirigidas a Alice después de transcribir;
«Detén la conversación, Alice» vuelve a espera y «Apaga el micrófono, Alice»
cierra la sesión. Es un filtro por frase, no activación acústica dedicada ni
interrupción durante la reproducción.
[ADR-P-112](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-112-espera-por-nombre-y-apagado.md).

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
[plan R9](docs/plans/R9-presence-voice-body.md) y [ADR-P-094](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-094-puentes-de-presencia-voz-y-cuerpo.md).

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
cargo fmt --manifest-path Backend/src-tauri\Cargo.toml -- --check
cargo test --manifest-path Backend/src-tauri\Cargo.toml
cargo clippy --manifest-path Backend/src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path Backend/src-tauri\Cargo.toml
npm test
npm run build
```

## Actualización autorizada — aprendizaje conversacional

El 2026-11-03 se implementa la selección y persistencia automática de citas de
nuevos mensajes Gemma, con pausa, corrección y retirada, RAG activo y proyección
orgánica del volumen. El almacén automático conserva procedencia y no reescribe
memoria confirmada. Ver [ADR-P-101](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).
El autoestudio posterior se describe en las ampliaciones de R6. Ambas fuentes
conservan su política y procedencia; el avatar continúa al final.

## Próximo paso autorizado

Organización del proyecto (14 de noviembre): el backend nativo y sus adaptadores
están en `Backend/`. La [revisión de organización](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/architecture/REORGANIZACION_2026-11-14.md)
registra las rutas actualizadas, las comprobaciones y los candidatos de limpieza
que requieren revisión individual antes de retirarlos.

**Piloto de arquitectura (20 de noviembre de 2026).** El módulo
`system_overview` separa el comando del Dashboard, el muestreo y las lecturas
de disco y energía por plataforma. El comando conserva la autorización de la
ventana principal y su respuesta IPC. El ensayo nativo comprueba también los
nombres y la estructura de sus campos. [Módulo piloto](Backend/src-tauri/src/system_overview/).

La migración de la interfaz a Dioxus ya llegó al arranque general. El siguiente
tramo vuelve a la aceptación de Alice en Windows con la voz, el proveedor y
los usos cotidianos del propietario. La prueba con recuerdos personales y una
respuesta real también forma parte de esta aceptación.

Las **Fases R1 a R8** conservan sus cierres documentados. R9 ya tiene
implementación parcial. El trabajo inmediato queda ordenado así:

1. **Revisar latencia y comprobar cinco turnos breves de R9.**
   Usar primero un turno por texto con el mismo proveedor como referencia para
   distinguir la espera del proveedor del tiempo de transcripción y síntesis.
   Inicio, vencimiento y rearme compartido del watchdog pasaron las pruebas
   controladas. El propietario confirmó una respuesta en la nueva prueba real,
   aunque tardó; el último turno auditado concentra más tiempo en ASR.
   Comparar alternativas sólo con mediciones equivalentes y conservar el motor
   operativo hasta decidir. El proceso Whisper conserva sus pruebas.
   La [revisión de herramientas](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/research/HERRAMIENTAS_Y_PERSISTENCIA_REVIEW_2026-11-13.md)
   delimita el piloto ASR aislado, con carga e inferencia separadas; no promete
   velocidad por cambiar de librería o aumentar el modelo. Open Interpreter
   queda como candidato de desarrollo/habilidad. Las propuestas de wake word,
   embeddings y SQLite requieren sus propias pruebas y contratos; no están activadas.
   La persistencia y los grafos de R6/R8 se revisarán posteriormente a fondo.
   Completar además la aceptación de Estado y controles:
   dos ajustes reales de conversación local y trazabilidad de la memoria
   proporcionada al modelo, conservando permisos y controles bloqueados.
   Después, reproducir Spotify, pausar,
   reanudar, atender un turno libre y apagar el micrófono. Verificar la acción
   y el servicio reconocidos, el resultado real, una respuesta pertinente en el
   turno libre y el cierre de escucha al final. El acierto comunicado por el
   propietario no acepta por sí solo estos cinco turnos ni toda R9. Mantener
   sólo lo indispensable en Conversación, con el diagnóstico plegado y los
   ejemplos en Contexto y permisos. La orden hablada para reproducir Spotify
   llegó con palabras distintas y no activó la acción. El diagnóstico permite
   llevar una transcripción al borrador, corregirla y revisarla antes de enviarla.
   En una segunda toma Whisper conservó la orden y transcribió el nombre como
   «A list». La escucha automática recupera esa variante para la orden completa
   de reproducir Spotify y conserva lo transcrito en el diagnóstico.
   Una prueba posterior por voz alteró el nombre de Alice y el de Spotify.
   En seis muestras sintéticas (tres frases limpias y las mismas con atenuación
   y ruido), Whisper Small coincidió en cuatro y Large V3 Turbo Q5 en cinco.
   En CPU, las tomas limpias tardaron cerca de 5 s con Small y de 24 s con
   Turbo. Los ensayos con un contexto de audio reducido aceleraron Turbo y
   volvieron a alterar el nombre de Alice en la orden corta. Con una misma
   toma real, ambos conservaron «pausa Spotify» y transcribieron el nombre de
   modo distinto. Small devolvió «Alista» en 5,1 s y Turbo «Analis» en 23,7 s.
   Small sigue como reconocedor y la escucha acepta «Alista» cuando se lee la
   orden completa de reproducir o pausar Spotify. Falta probar esa corrección
   con la captura automática y su filtro.
   [Whisper Large V3 Turbo Q5](https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-large-v3-turbo-q5_0.bin).
   En Windows, la escucha puede bajar el volumen de las sesiones abiertas de
   Spotify al activarse y recuperarlo al terminar. La opción está en Audio de
   entrada y se aplica por sesión, con prioridad para los cambios manuales de
   volumen. El propietario comprobó que Spotify bajó y recuperó el volumen al
   apagar el micrófono. La auditoría confirmó que Spotify se pausó por voz
   después de varios intentos. La repetibilidad sigue pendiente.
   Se compararon Whisper Small y Parakeet TDT 0.6B v3 INT8 con tres frases
   sintéticas en tres condiciones (limpia, señal baja con ruido y voz de
   fondo simulada), con y sin el filtrado de Alice. Acertaron 12/18 y 14/18,
   respectivamente. Whisper tardó 4,83 s por toma de mediana, con la carga
   incluida. Parakeet cargó en 2,59 s y obtuvo 0,33 s de mediana con el modelo
   cargado. En el piloto de una toma con carga incluida, Parakeet tardó 4,08 s
   y Whisper 4,60 s. Con Whisper, la señal directa acertó 7/9 y la filtrada 5/9. La
   prueba evalúa el filtro RNNoise con ganancia suave en una simulación y
   deja pendiente comprobar su efecto con el micrófono en uso.
   En una toma real con música, Small y Parakeet conservaron la orden de
   pausar Spotify. Small tardó 5,8 s y Parakeet tardó 3,1 s, con la carga
   incluida en ambos casos. Parakeet se puede seleccionar al arrancar con
   `ALICE_PARAKEET_HOME` para probarlo con el filtro y la escucha de Alice.
   En la captura automática, Parakeet completó varias transcripciones de
   aproximadamente 3 s, pero algunas tomas perdieron la acción o el servicio.
   Audio de entrada incorpora una prueba de señal directa para el reconocedor.
   El filtro local sigue midiendo la voz y la pausa que cierra el turno.
   Con el nombre Nyxia, la prueba real con Parakeet y señal directa registró
   «Nixia, pausa Spotify» y pausó el reproductor en el segundo intento. La
   transcripción tardó 3,19 s y la acción del reproductor tardó 0,32 s.
   En la siguiente prueba de pausa, reanudación y pausa, ninguna orden llegó
   a Spotify. La auditoría registró tomas con texto y tomas sin habla. El
   diagnóstico conserva el último descarte con texto durante las tomas vacías
   para poder revisar qué oyó el reconocedor.
   En dictado manual, el propietario oyó la frase completa. Con el mismo audio,
   un recorte de 16,6 s a 3,1 s permitió a Parakeet recuperar «pausa Spotify»,
   aunque confundió el nombre. Whisper Small confundió el verbo con ambas
   duraciones. El preprocesamiento de Parakeet ahora recorta extremos de nivel
   muy bajo cuando detecta señal sostenida, conserva margen y pausas internas y
   deja intacta la toma que se escucha en la interfaz.
   El 21 de noviembre, con el recorte integrado y sensibilidad Normal, la
   escucha automática transcribió «Nixia, pausa Spotify» y pausó al primer
   intento. La auditoría midió 3,94 s de transcripción, 0,32 s de acción y
   2,30 s de síntesis. En este ensayo también cambió la sensibilidad. La
   repetición de pausa y reanudación con esa configuración no logró ejecutar
   ninguna de las cuatro órdenes. En una toma, «Mix reanuda Spotify» conservó
   verbo y servicio. La escucha recupera «Mix» y «Mixia» sólo en órdenes
   completas de reproducir, pausar o reanudar Spotify. Falta repetir tras el ajuste.
   [Modelo de Parakeet](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html).
   Tras el reinicio, el propietario volvió a ver los registros en Memoria.
2. **Aceptar el ciclo personal de autoestudio y Obsidian.** Arrancar Alice, revisar
   ejercicios y fuentes, reiniciar y comprobar que conserva el progreso, continúa
   pendientes/repasos, recupera una lección aprobada con su fuente y actualiza la
   bóveda. Comprobar pausa, errores y prioridad de conversación. La sonda aislada
   de 14 áreas (10 aprobadas y 4 fallidas) no representa avance personal.
3. **Delegar otra parte del trabajo de Node.js a Python.** Después de los cinco
   turnos de R9 y del ciclo de autoestudio, probar que el formateador Python por lotes
   prepare también las etiquetas de estado y procedencia de las notas Obsidian.
   Comparar los bytes del Markdown y medir la duración total antes de integrar.
   [Alcance de la transferencia](docs/architecture/REPARTO_NODE_PYTHON.md#próximo-incremento).
4. **Revisar contratos y continuar la estructura del núcleo.** Revisar con
   colaboradores las sesiones extraídas durante la migración y delimitar las
   responsabilidades de transporte, proceso y arbitraje de `local_inference.rs`
   en incrementos justificados. La prioridad de solicitudes ya se separó
   (ADR-P-118). La reanudación rápida ya conserva el reinicio y rechaza resultados
   del ciclo anterior, sin solapar ciclos (ADR-P-119). La posible primitiva de
   persistencia compartida y las propuestas de almacenamiento/grafos quedan para
   la revisión profunda posterior, sin cambiar ahora formatos ni controles.
5. **Completar la aceptación personal de Memoria.** Verificar las cuatro secciones,
   sus herramientas, avisos de actualización y estados de carga/error en la sesión
   del propietario. El Volumen ya se revisó en Tauri con fuentes y cambios
   observados; quedan las comprobaciones conjuntas de recuperación y Obsidian
   del primer paso. La revisión visual no sustituye esa aceptación completa.
6. **Completar la aceptación funcional de R9.** Mantener cinco turnos reales con
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

### Evaluar Nod de n8n Labs

Nod es una aplicación independiente de automatización personal con navegador,
espacio de trabajo y tareas programadas. n8n Labs la publicó como vista previa
de investigación el 10 de noviembre de 2026 bajo licencia Apache 2.0.
[Anuncio](https://blog.n8n.io/meet-nod/) · [Código](https://github.com/n8n-io/nod).

Nod admite servidores compatibles con OpenAI como Ollama y `llama.cpp`. Su guía
pide llamadas a herramientas y al menos 64.000 tokens de contexto. El servidor
Gemma de Alice inicia con 4.096, así que la compatibilidad para ejecutar tareas
queda pendiente de una prueba con otro perfil de inferencia.
[Requisitos del modelo](https://nod.n8n.io/docs/connect/local-models/).

Tras validar R9, el primer ensayo sería ejecutar Nod por separado con un modelo
local y una tarea sobre datos ficticios. Medir la demora y el uso de recursos,
comprobar el resultado y verificar que la cancelación funcione. Si el ensayo es
satisfactorio, evaluar cómo Alice podría delegar tareas aprobadas y registrar su
resultado. La prueba usaría un espacio de trabajo separado de la memoria,
las credenciales y el control de escritorio de Alice. Las conexiones gestionadas
de Nod pasan por un servicio de n8n y Composio por defecto.
[Flujo de datos](https://nod.n8n.io/docs/trust/security-review/).

## Identidad previa — Alice Continuum

El proyecto se recuperó con el nombre técnico **Alice Continuum** y la marca
visible **Alice**. Desde el 20 de noviembre de 2026 se presenta como **Nyxia**.

La raíz vigente es **`D:\Alice Continuum`**, con rama principal `master`. El
lanzador resuelve su propia carpeta, usa `data/` por defecto, respeta
`ALICE_DATA_DIR` y conserva la identidad persistente de Tauri. Modelos y motores se configuran fuera
de Git. Las rutas anteriores se conservan únicamente como antecedentes en los
informes de recuperación.

El código y la documentación se publican en
[enri312/nyxia](https://github.com/enri312/nyxia). La publicación
no incluye recuerdos, configuración privada, claves, modelos, capturas ni activos
privados; las copias Git y los respaldos integrales tienen alcances diferentes.
[Recuperación y límites](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/WINDOWS_RECOVERY_READINESS_REPORT_2026-11-09.md) ·
[Respaldo integral](docs/runbooks/07-respaldo-integral.md).

## Identidad vigente: Alice Continuum

Desde el 2026-09-16 la plataforma se denomina **Alice Continuum**; Alice mantiene
su nombre como personaje. Esta adopción no modifica el alcance ni el estado de
las fases. Consulta [ADR-P-095](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-095-identidad-alice-continuum.md)
y la [matriz de compatibilidad](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/architecture/CONTINUUM_IDENTITY.md).

## Historial de incrementos de voz y acciones

Las notas siguientes corresponden a sus fechas. El estado vigente de R9 y el
orden de trabajo se encuentran en sus apartados anteriores.

Incremento R9 del 2026-11-03: [música delegada](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-104-musica-spotify-youtube-chrome.md)
con Tus me gusta en Spotify y canciones pedidas en YouTube mediante Chrome.
Spotify pasó la prueba de reproducir, pausar, continuar y pausar desde Alice con
datos separados. La reproducción real de YouTube espera la canción del
propietario. El avatar sigue pospuesto; este incremento no cierra R9.

Seguimiento del mismo día: se corrigen las órdenes habladas compuestas que
recibían promesas sin reproducción, y se amplía la espera de Spotify al arrancar
sin ventana. [Regresión y pruebas](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

Incremento R9 del 2026-11-04: [reducción local de ruido](https://github.com/enri312/nyxia/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/decisions/ADR-P-105-supresion-local-ruido-vite.md) antes de grabar, detector de voz y micrófono seleccionable. Dirección Alice opcional para otras voces. Vite 8.3.5 y Vitest 4.1.12; falta aceptación acústica con la voz del propietario y música de ambos orígenes. El avatar permanece al final.
