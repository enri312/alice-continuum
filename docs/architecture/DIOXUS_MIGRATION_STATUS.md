# Migración Dioxus: componentes y retirada de React

**Objetivo confirmado el 15 de noviembre de 2026:** retirar React por completo
del producto, avanzando por componentes y pantallas. Los hosts y las vistas de
recuperación actuales son transitorios. Tener un renderer Dioxus no basta para
declarar terminada una página ni para dejar React de forma permanente.

La migración continúa por componentes en Windows. Cada sustitución conserva
contenido, clases CSS, datos y permisos. Eliminar un archivo requiere comprobar
sus importadores y cubrir su función con una ruta probada de funcionamiento y
recuperación. No se deduce que un archivo sobra sólo porque ya haya un renderer Rust.

| Área | Dioxus operativo | Dependencias React actuales |
|---|---|---|
| Navegación general | Ruta activa, encabezado, acceso al Dashboard, selector de núcleos, pestañas, iconos y contadores. | El puente monta Dioxus y proyecta la ruta elegida a `App.tsx`, que coloca el contenido en el marco con un portal. |
| Dashboard | Pantalla de inicio, estado de Alice, accesos y panel del equipo renderizados en Dioxus. | Host para montaje, recuperación, consulta IPC y conexión a la navegación y a los contadores de `App.tsx`. |
| Actividad | Página, filtros, línea temporal y sesión compartida con un máximo de 200 eventos secuenciales. | Hosts de montaje y proyección de la sesión WASM. `App.tsx` publica eventos al ejecutar operaciones. |
| Auditoría y diagnóstico | Pestañas, consultas, estado de carga y errores, filtro por capacidad y diagnóstico pasivo. | Host temporal de montaje y puente hacia las lecturas Tauri validadas. |
| Conversación | Compositor, historial, contexto, revisión del envío, recuerdos, dictado, escucha y reproducción, cámara y escritorio, documentos y diagnóstico de entrada. La sesión Rust comparte proveedor, modelo, borrador, historial visible, comportamiento y respuesta en curso. | Host temporal. `App.tsx` conecta envío, visión y recuperación de recuerdos; delega la memoria de trabajo a su sesión. Los controladores TypeScript enlazan Tauri y las API de archivos, audio y vídeo del WebView. |
| Memoria | Sesión compartida para la proyección de recuerdos persistidos, estado del archivo y generación de memoria de trabajo. | La pantalla y sus flujos de revisión siguen en React. El adaptador TypeScript coordina las operaciones IPC existentes. |
| Aprendizaje | Sesión compartida del autoestudio y la memoria automática conversacional, con la última lectura válida, su estado y la fase recibida. | Los paneles aún se montan en React. El adaptador TypeScript abre y cierra las suscripciones, ordena las escrituras y valida las respuestas de Tauri. |
| Línea temporal cognitiva | Panel reutilizado directamente dentro de Actividad: ventana de 24 eventos, selección, geometría, contadores, duración, inspector y leyenda. | Formato Date/Intl sin React en la frontera de datos. Se retiran el host React y el montaje WASM independientes. |
| Estado y controles | Panel, selección, recuerdo, inspector, preparación de controles y sesión R3: sondeo, validación y proyección de métricas. | Montaje, snapshot base, transporte cerrado y conexión a los ajustes compartidos de Conversación; recuperación diferida ante fallo. |
| Flujo cognitivo | Página completa, encabezado R3, grafo, conexiones, selección, inspector, sondeo/proyección R3 y panel/controlador de asociaciones en un solo montaje. | Host de montaje, snapshot base desde la aplicación, transporte IPC y página anterior para recuperación. |
| Lista de relaciones guardadas | Títulos, estado, botones, bloqueos y selección de revisión. | Adaptador y lista sólo para recuperación. |
| Formulario de fuentes | Selectores, entradas, citas, borrador, evidencia derivada y solicitud de revisión. | Adaptador y formulario sólo para recuperación. |
| Confirmaciones de relaciones | Revisión pendiente, confirmación de creación, retirada/restauración, cancelación y bloqueo de doble clic. | Adaptador y confirmación sólo para recuperación. |
| Controlador de asociaciones | Sesión, borrador, revisiones, bloqueo de operaciones, actualización, errores y panel completo. | Host de montaje y carga diferida del controlador anterior ante fallo; transporte TypeScript limitado a comandos existentes. |

## Camino hasta retirar React por completo

| Bloque pendiente | Trabajo que falta |
|---|---|
| Conexión de Actividad con la aplicación | Retirar los hosts de proyección al sustituir el montaje raíz. Mover los productores al trasladar cada operación de `App.tsx`. |
| Planificador | Presentación e inspector; después el registro R7 con sus revisiones y confirmaciones. |
| Volumen cognitivo | Página, escena, selección, inspector y paneles de aprendizaje. |
| Memoria | Navegación, registros, perfil, autoestudio, memoria automática, sesión y mantenimiento. Se conservan los almacenes Rust y sus contratos. |
| Habilidades y procedimientos | Registro, taller, formularios, revisiones y controles gobernados. |
| Configuración | Migrar la pantalla. El proveedor, el modelo y la vista del historial ya usan la sesión Rust; Tauri conserva el almacenamiento seguro. |
| Puentes, rostro, cuerpo y avatar | Controles, permisos y ciclos de vida; el visor 3D y los dispositivos se prueban por separado. |
| Aplicación y recuperación | Estado compartido de `App.tsx`, entrada, hosts y vistas anteriores de respaldo. |

Después de migrar las pantallas se sustituirá el contenedor raíz y el arranque.
Los errores de carga deben permitir reintentar y recuperar datos sin necesitar
la interfaz React anterior. Los archivos retirados seguirán disponibles en Git.

Las rutas de Conversación y Auditoría y diagnóstico montan Dioxus desde el
19 de noviembre. Cuando falla la carga ofrecen reintentar el mismo renderer.
Las implementaciones React desactivadas y sus pruebas se conservan en
[`Frontend/src/Legacy/`](../../Frontend/src/Legacy/). Allí están Conversación,
Auditoría y diagnóstico, el marco anterior y sus componentes exclusivos. El
piloto de sesión conserva su importación desde Legacy. Los componentes de
recuperación de Flujo, Estado y relaciones siguen accesibles cuando falla su
renderer. El código React inactivo se conserva hasta migrar las pantallas y
la lógica compartida. Las pruebas con dispositivos físicos y proveedores
reales se registran por separado de las pruebas con datos simulados.

## Evaluación de App.tsx

El contenedor puede migrar a Dioxus por etapas. La navegación ya decide la ruta
en Rust. El puente actual entrega esa ruta a `App.tsx`, que monta el contenido
mediante un portal. `main.tsx` todavía arranca con `createRoot` de React.

1. Extraer la lógica compartida detrás de un contrato de estado y acciones.
   Actividad, Conversación, Memoria y Aprendizaje ya tienen sesiones Rust.
   A continuación, trasladar el perfil confirmado y la proyección de recuerdos
   hacia Conversación y Volumen cognitivo. Reutilizar las
   operaciones Tauri y los controladores que ya existen en `core/`.
2. Conservar un solo dueño de cada efecto durante el traslado. Verificar la
   cola de guardado de recuerdos, las generaciones de memoria de trabajo,
   las suscripciones a fuentes de aprendizaje y la vigencia del permiso de observación.
   Comprobar que el borrador, el historial y las claves de preferencias
   sobrevivan al cambio de pantalla y al arranque.
3. Cuando el estado compartido tenga ese contrato, montar la raíz desde el
   componente `App` de Dioxus en `app.rs` y conectar cada pantalla. Para retirar `createRoot`
   también deben quedar migrados Planificador, Volumen, Memoria,
   Configuración, permisos, habilidades, procedimientos y las vistas
   corporales, además de las recuperaciones que siguen activas.

La salida de React exige cero importaciones productivas de `react`, `react-dom`
y `react/jsx-runtime`; retirar las pruebas que requieran esas vistas después de
cubrir sus comportamientos con Rust y aceptación de interfaz. Se eliminan las
dependencias directas, sus tipos, el plugin Vite React y la configuración JSX
correspondiente. El bundle final y una instalación limpia deben abrir y funcionar
sin React. Vite, Node y los adaptadores JavaScript independientes se evalúan por
su función de construcción o acceso al navegador, separada del framework de UI.

Cada incremento conserva diseño, datos, permisos, teclado y navegación; termina
con build, pruebas pertinentes, aceptación nativa, README/Roadmap y commit. La
retirada completa permanece pendiente mientras cualquiera de estos bloques
siga dependiendo de React.

## Sesión de Conversación (2026-11-19)

`conversation_session.rs` administra la selección de proveedor y modelo, el
borrador, el historial mostrado, los dos controles de comportamiento local y
el bloqueo de respuestas simultáneas. `conversation-session.ts` carga y guarda
la selección con su clave existente y transporta el historial validado de Tauri.
Una lectura inicial tardía respeta los turnos que ya finalizaron. Borrador,
vista de historial y controles de comportamiento duran lo que dura la aplicación.
`App.tsx` consume el estado y coordina el envío autorizado y sus efectos. La
implementación React anterior de la sesión está en `Frontend/src/Legacy/`.

## Sesión de Memoria (2026-11-19)

`memory_session.rs` mantiene la proyección de recuerdos guardados y memoria de
trabajo. Acepta las generaciones vigentes de RAM y descarta lecturas anteriores
a una respuesta o a un vaciado. `memory-session.ts` serializa las lecturas y
escrituras del archivo, publica las ediciones tras el guardado confirmado y
mantiene accesible la memoria si el WASM aún se está cargando. Tauri sigue
validando y guardando los datos en los mismos almacenes. La coordinación React
anterior está en `Frontend/src/Legacy/`. Esta etapa usa Dioxus 0.7.10.

## Sesión de Aprendizaje (2026-11-19)

`learning_session.rs` conserva la última lectura validada de cada fuente, la
fecha de recepción, los avisos de conexión y la fase del aprendizaje
conversacional. `learning-session.ts` publica el estado para los paneles y
reutiliza `learning-source.ts` para el sondeo, las notificaciones, el descarte
de lecturas desplazadas y las escrituras en orden. Si tarda el WASM, el
adaptador ofrece las lecturas provisionales y las traspasa al conectar. El
hook anterior está desactivado en `Legacy`. Los comandos y las decisiones
de estudio, pausa y revisión siguen bajo el backend de Tauri.

## Página y sesión de Actividad (2026-11-19)

`activity_page_model.rs` mantiene vista, filtros y línea temporal sobre la misma
fuente temporal. `activity_page_ui.rs` presenta el encabezado, pestañas y consola
y reutiliza el panel de `timeline_ui.rs` sin otro renderer montado. Conserva
contenido y clases CSS, orden inverso de consola, contadores de fuente y horas
locales preparadas con Date/Intl. La búsqueda admite hasta 8192 unidades UTF-16;
los textos de los eventos no se recortan. Cambiar de vista conserva filtros y
selección, y actualizar la fuente no sustituye las preferencias de UI.

`ActivityHost.tsx` sólo monta, actualiza, reintenta y conecta el vaciado del buffer.
Valida los callbacks cerrados y conserva una referencia de recuperación sin
reimplementar filtros ni presentación. Una carga o actualización inválida retira
el montaje y ofrece reintento; la fuente sigue en la sesión. Se retiraron
`ActivityPage.tsx`, `CognitiveTimelineHost.tsx`, su callback de selección anterior
y las funciones WASM independientes de Timeline. Auditoría y diagnóstico se
separó en `GovernancePage.tsx`, con su contenido y lecturas anteriores en React.

El módulo `activity_session.rs` conserva y numera hasta 200 eventos en memoria
durante la sesión. El Dashboard y las pestañas usan el total de ese mismo
almacén. La línea proyecta los últimos 24. **Limpiar vista** vacía ese almacén
temporal y conserva la numeración para los eventos siguientes. El puente
entrega en orden los eventos que lleguen mientras se carga WebAssembly.
El buffer React de referencia quedó en `Frontend/src/Legacy/`.
Ver [pruebas y evidencia](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/ACTIVITY_PAGE_DIOXUS_REPORT_2026-11-15.md).

## Sesión de Estado: estado vigente (2026-11-15)

`state_page_model.rs` conserva una sola lectura pendiente y valida R3 con el
contrato común. Proyecta las métricas conservando las fórmulas y descripciones
anteriores, separadas de emociones o conciencia. `ui.rs` mantiene selección,
temporizador de cinco segundos, contenido y deslizadores; desmontar cancela la
tarea. Una señal inválida retira la anterior y no desbloquea controles futuros.

`StateControlsHost.tsx` aporta sólo el snapshot base, conserva una referencia de
selección para recuperar y conecta los dos ajustes compartidos con Conversación.
`transport.ts` admite la lectura R3 cerrada y revalida acciones contra el bloqueo
actual. No proyecta R3 ni contiene un intervalo. Una lectura de configuración
nueva espera al terminar la anterior; las respuestas tras desmontar se descartan.

`StateControlsRecovery.tsx` se carga sólo si falla el módulo. Entonces utiliza
el sondeo React anterior y los mismos contenidos; se desmonta antes de recuperar
Dioxus. La aplicación general y ese camino aún requieren React. La migración de
esta sesión no elimina sus dependencias globales ni las de otras páginas.
Build, 28 pruebas Rust, Clippy WASM, 898 frontend, Obsidian, respaldos, privacidad,
Edge y Tauri/WebView2 aprobados. Ver [alcance y evidencia](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/STATE_SESSION_DIOXUS_REPORT_2026-11-15.md).

## Página y sondeo de Flujo: estado vigente (2026-11-15)

`flow_page_ui.rs` presenta la sección completa con el grafo reutilizable y la
sesión de asociaciones integrada. `flow_page_model.rs` mantiene selección,
snapshot R3 y una única lectura pendiente; `core_activity_model.rs` valida el
contrato nativo y proyecta sólo los nodos/enlaces con evidencia. Los eventos de
procedimientos sin señal siguen mostrando actividad en reposo. Un resultado
inválido retira la señal anterior en vez de conservar una actividad no comprobada.

El temporizador de cinco segundos vive en una tarea Dioxus y se cancela al
desmontar. `flow-page-transport.ts` sólo transporta R3, selección para recuperación
y los comandos existentes de asociaciones. No contiene timers ni un segundo
parser de R3. El host `EvidenceFlowPage.tsx` aporta el snapshot base preparado
por la aplicación y monta la página; su selección normal ya no es estado React.

`EvidenceFlowFallback.tsx` conserva el camino anterior sólo ante fallo del
módulo. `useNucleusSnapshot` sigue siendo necesario para ese respaldo y otras
pantallas. No debe borrarse por haber migrado el sondeo de una sola página.
Después de cada migración, el cierre incluye abrir y comprobar la aplicación
nativa además de compilar y ejecutar las pruebas de navegador.

## Controlador de asociaciones: estado vigente (2026-11-15)

`associations_model.rs` mantiene la sesión normal y prepara solicitudes con
evidencia derivada de las fuentes cargadas. Una operación ocupa la sesión hasta
su respuesta; su ID permite ignorar respuestas atrasadas. Editar invalida la
revisión y confirmar exige una identidad pendiente vigente. Tras guardar sólo
se actualizan las lecturas; no se repite una escritura automáticamente.

`associations_ui.rs` presenta el panel completo y reutiliza `Form`, `List` y
`Confirmation` de los renderers existentes. Conserva clases CSS, rótulos y orden.
`MemoryAssociations.tsx` sólo monta ese panel y conecta el transporte cerrado
`associations-transport.ts`. Éste limita las operaciones a las tres lecturas,
revisión, confirmación y retirada/restauración existentes; no decide fuentes,
citas ni revisiones. Descarta solicitudes repetidas y respuestas tras desmontar.
El backend sigue comprobando evidencia, revisión durable y confirmación.

`MemoryAssociationsFallback.tsx` conserva el controlador anterior, cargado sólo
si falla el módulo. Sus tres adaptadores permiten recuperar sus vistas sin
perder el borrador del respaldo. Reintentar esas vistas no sustituye su sesión
por una nueva ni autoriza escrituras. React sigue siendo necesario para ese
camino de recuperación y para la aplicación que monta la pantalla.

Los incrementos siguientes describen las piezas reutilizadas; el controlador
normal que antes estaba en React queda sustituido por el modelo Rust anterior.

## Incremento de lista de relaciones

`relations_model.rs` y `relations_ui.rs` presentan la lista y emiten únicamente
`reviewRelation` con un ID. El adaptador vuelve a comprobar el ID y los bloqueos
contra el estado actual. El renderer no acepta una confirmación ni elige la
revisión de persistencia. El panel completo combina estas piezas con el
controlador Rust. El adaptador independiente sigue disponible en el respaldo.
El backend sigue validando revisión, fuentes, confirmación y bloqueos.

El montaje duplicado de Estado y Flujo se sustituyó por `browser_runtime.rs`.
Las vistas reutilizan ese código, con registros de instancias independientes.
El mismo WASM conserva sus comprobaciones de fuentes y artefactos.

## Incremento del formulario de fuentes

`source_form_model.rs` y `source_form_ui.rs` presentan sólo los episodios
recuperables, las entradas originales y dos citas de hasta 2048 unidades UTF-16.
Bloquean la revisión con fuentes repetidas, ausentes, citas vacías o una operación
en curso. Dioxus emite selección, edición o solicitud de revisión; el controlador
Rust revalida el evento contra las fuentes y el estado actuales. Versiones,
hashes y revisión esperada se derivan de esas lecturas.
El backend conserva la validación literal y el guardado requiere su confirmación
separada. Editar una fuente o una cita invalida la revisión anterior. El borrador
queda en Rust en la ruta normal y en el controlador anterior durante la
recuperación. El formulario recibe los títulos limitados y el texto completo
únicamente de las fuentes seleccionadas. En la ruta normal, editar no vuelve a
serializar los registros completos entre React y WASM.

## Incremento de confirmaciones

`confirmation_model.rs` y `confirmation_ui.rs` presentan las dos citas revisadas
y la confirmación de creación, o la pregunta para retirar/restaurar con su botón
Cancelar. Conservan los rótulos y el bloqueo durante una operación. El controlador
asigna un token nuevo a cada revisión pendiente: es una identidad temporal de UI,
no una autorización ni una revisión del almacén. El modelo Rust rechaza eventos
atrasados, campos adicionales y acciones ocupadas. El bloqueo síncrono y el
transporte evitan solicitudes duplicadas por doble clic. El adaptador anterior
mantiene sus guardias en el respaldo.

Las versiones, evidencia, IDs y revisión durable siguen en el controlador.
Sólo una acción válida contra la revisión pendiente llama al comando existente.
Montar, actualizar o reintentar el renderer no confirma ninguna operación.
El JSX de confirmación se retiró del camino principal de `MemoryAssociations.tsx`;
una vista React de respaldo permite recuperar la pantalla si falla WASM.

## Verificación y límites

- Compilación TypeScript/Vite, 25 pruebas del módulo Rust y Clippy para WASM.
- 887 pruebas frontend aprobadas (dos omitidas), 15 Obsidian, 20 respaldos y dos
  privacidad. Incluyen transporte cerrado, escritura única, errores y desmontaje.
- Pruebas de frontera que rechazan solicitudes con confirmación, revisión elegida,
  IDs ausentes y acciones atrasadas cuando cambian los bloqueos.
- Edge aislado verifica navegación, clic, teclado y recuperación de Estado/Flujo.
  Una simulación de IPC aporta cuatro relaciones ficticias: vigente, retirada,
  bloqueada y con fuente no vigente. Comprueba títulos como texto, bloqueos,
  cancelar sin escritura, confirmar con revisión esperada, error de guardado,
  descarga WASM fallida y reintento sin duplicar ni escribir relaciones.
- El mismo ensayo comprueba fuentes elegibles, selección duplicada, lectura de
  entradas, citas por teclado, bloqueo durante la revisión, hashes/versiones
  derivados por el controlador, invalidación al editar, rechazo de citas no
  literales por el servicio ficticio y recuperación del formulario con su borrador.
- Las confirmaciones se verifican con renderer Dioxus activo: cancelar sin escribir,
  doble clic con una sola solicitud, confirmar/cancelar bloqueados mientras se
  espera al servicio ficticio, errores de escritura y reintento sin confirmación
  automática. Se comprueba que el comando conserve la revisión esperada.
- Las cinco pruebas existentes de asociaciones del backend comprueban persistencia,
  fuentes cambiadas, revisión atrasada, confirmación ausente, corrupción y bloqueo
  entre procesos sobre datos temporales.
  No se modificaron esos comandos; su ejecución registrada corresponde al
  incremento anterior, no a una nueva aceptación nativa.
- El ensayo del controlador exige el panel completo en Dioxus, sale durante una
  revisión y vuelve: la respuesta anterior no crea una revisión ni guarda en la
  sesión nueva. Bloquear WASM activa por separado el controlador React anterior.
- El ensayo de la página mantiene una lectura R3 suspendida durante dos intervalos:
  no hay solapamiento. Comprueba señal derivada, auditoría degradada, rechazo de
  datos inválidos, recuperación y cancelación del sondeo al navegar.
- La aceptación Tauri/WebView2 abre una ventana real, verifica Conversación y
  navegación Estado/Flujo, inspector, R3 del backend y confirmación/cancelación
  de relaciones sintéticas. La relación guardada sobrevive a recargar la ventana
  y las fuentes no cambian. Detectó el prefijo nativo `sha256:`, corregido en
  modelo, transporte y fixtures con regresión. Ver el
  [informe de la página](https://github.com/enri312/alice-continuum/blob/99e67bf0b26136962f1b298b6449460dcdf7e4d8/docs/testing/FLOW_PAGE_DIOXUS_REPORT_2026-11-15.md).

La prueba nativa usa datos sintéticos y no certifica voz, proveedores ni datos
personales. No se utilizaron recuerdos personales. Los ensayos están documentados en la
[guía del módulo](../../Frontend/crates/dioxus-ui/README.md).

## Código que todavía tiene uso

- `CognitiveFlow.tsx` y los componentes de encabezado React presentan el respaldo.
- `EvidenceFlowFallback.tsx` y `CognitiveFlowDioxus.tsx` conservan el camino anterior.
- `useNucleusSnapshot` permanece para otras pantallas y para ese respaldo.
- `MemoryAssociations.tsx` mantiene montaje, transporte y selección del respaldo.
- `MemoryAssociationsFallback.tsx` mantiene la sesión anterior sólo ante fallo.
- `SavedRelationsFallback` mantiene la lista durante carga, fallo y reintento.
- `SourceFormFallback` mantiene los selectores y citas durante carga o fallo.
- `ConfirmationFallback` conserva las pantallas de confirmación durante carga o fallo.
- Los adaptadores de montaje conectan las pantallas con el estado de `App.tsx`.

La retirada de esos elementos queda condicionada a migrar y comprobar sus usos.
Antes de borrar: buscar importadores, actualizar las rutas y pruebas afectadas,
verificar contenido y teclado, fallos de carga, desmontaje y remontaje, y cerrar
con un commit revisado. La retirada final de React requiere que todas las rutas
operativas y de recuperación dejen de depender de él.
