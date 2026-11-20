# Migración Dioxus de Alice Continuum

El arranque, las pantallas y la recuperación de la interfaz funcionan sin
React. La primera entrada es `Frontend/src/main.ts` y la raíz Rust está en
`Frontend/crates/dioxus-ui/src/app.rs`. La raíz muestra la navegación y
selecciona el destino. Los adaptadores TypeScript enlazan las pantallas con
IPC, almacenamiento, audio, vídeo, Canvas y WebGL.

| Área | Dioxus operativo | Integración con Tauri y el WebView |
|---|---|---|
| Navegación general | Ruta activa, encabezado, acceso al Dashboard, selector de núcleos, pestañas, iconos y contadores. `app.rs` coordina solicitudes de navegación y selección del filtro de Auditoría. | Los adaptadores montan y desmontan la vista activa en el destino de la raíz Dioxus. |
| Dashboard | Pantalla de inicio, estado de Alice, accesos y panel del equipo renderizados en Dioxus. | Sondeo del equipo al abrir el Dashboard y cuando la ventana está visible. |
| Actividad | Página, filtros, línea temporal y sesión compartida con un máximo de 200 eventos secuenciales. | Proyección de la sesión WASM y recuperación de filtros al reintentar. |
| Auditoría y diagnóstico | Pestañas, consultas, estado de carga y errores, filtro por capacidad y diagnóstico pasivo. | Puente hacia las lecturas Tauri validadas. |
| Conversación | Compositor, historial, contexto, revisión del envío, recuerdos, dictado, escucha y reproducción, cámara y escritorio, documentos y diagnóstico de entrada. La sesión Rust comparte proveedor, modelo, borrador, historial visible, comportamiento y evidencia de recuperación del turno. | El controlador enlaza Tauri y las API de archivos, audio y vídeo del WebView. |
| Memoria | Navegación, registros, edición versionada, perfil, memoria de trabajo, capas, respaldo, Revisión y ciclo y Consolidación. | El adaptador conserva los planes exactos de Tauri hasta su confirmación. |
| Aprendizaje | Memoria muestra autoestudio y aprendizaje conversacional, con corrección, retiro y restauración de recuerdos automáticos. Volumen muestra las fuentes y cambios en Dioxus. | El adaptador TypeScript abre y cierra las suscripciones, ordena las escrituras y valida las respuestas de Tauri. |
| Perfil y catálogo de recuerdos | Perfil verificado por Tauri, selección de registros finalizados y de lecciones activas con el último ejercicio aprobado. | El adaptador reúne las fuentes y conserva las etiquetas. |
| Volumen cognitivo | Escena, ficha de recuerdos y procesos, evidencias R8, leyendas, consola de señales y seguimiento de cambios. | Host de montaje. El adaptador Canvas independiente dibuja la escena, traduce los eventos de puntero y teclado y consulta Tauri. |
| Observación de ventana | Sesión compartida que liga el contexto visible al identificador y vencimiento del permiso R2 confirmado. | El adaptador consulta Tauri y traslada las transiciones validadas a las vistas Dioxus. |
| Capacidades y permisos | Inventario agrupado, inspector, enlace filtrado a Auditoría, política R2, solicitudes, diálogo de revisión y permisos temporales. | Host de montaje y transporte validado a los comandos nativos existentes. |
| Procedimientos y Taller de habilidades | Evidencia R3, decisiones R5 y conversión a borrador R4. Edición, simulación estática y revisión por SHA-256 en el Taller. | Host de montaje y transporte hacia los almacenes y validadores nativos. |
| Configuración | Vista de proveedores, modelo, historial, motor local, política y dispositivos. | El host monta Dioxus. El adaptador usa la sesión de Conversación y ordena las respuestas de inicio y apagado de Gemma. |
| Rostro, Cuerpo y Avatar | Diagnóstico facial pasivo y permisos R2, esquemas corporales y controles, cámara virtual y telemetría del visor VRM. | Host de montaje. El adaptador consulta Tauri y monta el motor Three.js independiente. |
| Planificador | Inspector, actividad R3, formulario y revisión R7, reloj, listas, comprobaciones y recibos. | El puente valida los resultados de Tauri y convierte horas locales. Presenta la confirmación del WebView para reservar o entregar un aviso. |
| Línea temporal cognitiva | Panel reutilizado directamente dentro de Actividad: ventana de 24 eventos, selección, geometría, contadores, duración, inspector y leyenda. | Formato local de fechas mediante Date/Intl. |
| Estado y controles | Panel, selección, recuerdo, inspector, preparación de controles y sesión R3: sondeo, validación y proyección de métricas. | Montaje, snapshot base, transporte cerrado y conexión a los ajustes compartidos de Conversación; recuperación diferida ante fallo. |
| Flujo cognitivo | Página completa, encabezado R3, grafo, conexiones, selección, inspector, sondeo/proyección R3 y panel/controlador de asociaciones en un solo montaje. | Host de montaje, snapshot base desde la aplicación, transporte IPC y respaldo DOM con selección de nodos. |
| Lista de relaciones guardadas | Títulos, estado, botones, bloqueos y selección de revisión. | Adaptador y lista sólo para recuperación. |
| Formulario de fuentes | Selectores, entradas, citas, borrador, evidencia derivada y solicitud de revisión. | Adaptador y formulario sólo para recuperación. |
| Confirmaciones de relaciones | Revisión pendiente, confirmación de creación, retirada/restauración, cancelación y bloqueo de doble clic. | Adaptador y confirmación sólo para recuperación. |
| Controlador de asociaciones | Sesión, borrador, revisiones, bloqueo de operaciones, actualización, errores y panel completo. | Respaldo DOM diferido y transporte TypeScript limitado a comandos existentes. |

## Recuperación de la interfaz

Si falla el marco, la entrada conserva accesible la pantalla solicitada y
permite reintentar la navegación. Reintentar una pantalla es independiente de
volver a montar el marco. Flujo y Estado y controles conservan su inspección y
selección con un respaldo DOM. Relaciones mantiene borradores y revisiones al
reintentar individualmente la lista, el formulario o la confirmación. Las
escrituras siguen sujetas a la confirmación local y a la revisión vigente.

`App.tsx`, la entrada React, el portal, los hosts y las vistas de respaldo
anteriores están en [Legacy](../../Frontend/src/Legacy/), junto con sus
pruebas históricas. React y React DOM se reservan para esas pruebas. Vite y la
compilación principal usan la entrada TypeScript y WASM.

La compilación, los ensayos de navegador con WebAssembly bloqueado y el
arranque nativo de Tauri en Windows comprueban esta etapa. La validación con
proveedores y dispositivos físicos conserva su propio alcance en el
[Roadmap](../../Roadmap.md).

## Registro histórico por pantalla

## Memoria y edición versionada (2026-11-19)

Dioxus administra las secciones, la búsqueda, los formularios de recuerdos y
aprendizaje y la vista de respaldo. El adaptador conserva el plan de versión
devuelto por Tauri y, después de la segunda confirmación, envía la misma
entrada verificada. Un cambio en el borrador invalida la vista previa.
Capas consulta la huella vigente y ofrece activar o revertir la revisión por
los comandos existentes. En sesión vincula el vaciado a la generación visible.

## Revisión y ciclo y Consolidación (2026-11-19)

Dioxus presenta el ciclo, sus evidencias, el repaso y la comparación de
recuerdos. El puente invalida los planes cuando cambia la fuente o el
formulario y conserva la entrada exacta para la segunda confirmación. Tauri
verifica las huellas, el plazo de retención, el respaldo y la auditoría.
Consolidación ofrece vista previa de solo lectura, mantener separados y
restaurar un recibo existente con confirmación. La navegación de Memoria
monta todas las vistas Dioxus y la página anterior queda en `Legacy`.

## Volumen cognitivo (2026-11-19)

Dioxus administra la selección, la ficha, los controles y la vista de
aprendizaje. El historial visual empieza en la primera lectura válida de
cada apertura. Detecta incorporaciones, modificaciones y salidas de la
proyección mediante las huellas visuales de los registros.
`volume-canvas.ts` conserva el dibujo 3D, la cámara, los pulsos y la detección
de nodos bajo el puntero. Se carga al abrir la vista.
`volume-transport.ts` valida las lecturas R3 y R8 con los contratos existentes.
Un cambio de fuentes descarta la lectura R8 anterior y sus citas. Demostración
y pausa afectan la vista y conservan los contadores de auditoría. Los orígenes,
los colores y las marcas del inspector proceden del mismo catálogo que el lienzo.
Las pantallas y componentes React anteriores quedaron en `Legacy`.

## Configuración y Planificador (2026-11-19)

Configuración usa la selección y las preferencias de Conversación. El
adaptador de Gemma descarta una respuesta de inicio anterior a un apagado.
En Planificador, Dioxus mantiene la selección del inspector y la revisión
R7. Editar descarta la vista previa y confirmar exige marcar la revisión. El
puente conserva el plan validado por Tauri y envía ese mismo plan al confirmar.
El registro, las reservas y la entrega manual siguen a cargo de Tauri.
Auditoría muestra los eventos de tareas R7 con su operación y motivo. Las
vistas React anteriores se conservan en `Legacy` y la opción de reintento
recupera el montaje Dioxus ante un error de carga.

## Sesión de Conversación (2026-11-19)

`conversation_session.rs` administra la selección de proveedor y modelo, el
borrador, el historial mostrado, los dos controles de comportamiento local y
el bloqueo de respuestas simultáneas. `conversation-session.ts` carga y guarda
la selección con su clave existente y transporta el historial validado de Tauri.
Una lectura inicial tardía respeta los turnos que ya finalizaron. Borrador,
vista de historial y controles de comportamiento duran lo que dura la aplicación.
`App.tsx` consume el estado compartido. La implementación React anterior
de la sesión está en `Frontend/src/Legacy/`.

## Envío y recuperación de Conversación (2026-11-19)

`retrieval_session.rs` conserva la evidencia efímera del turno en la sesión
Rust. La preparación sigue usando los datos locales y la respuesta confirma si
se usaron recuerdos completos, un contexto limitado o ninguno. Cambiar el
borrador durante el envío conserva la evidencia del turno vigente. El
adaptador `conversation-transport.ts` consulta Tauri, integra historial y
memoria de trabajo y conecta los comandos nativos de voz. La captura de visión
se toma desde el montaje de Conversación. Antes de invocar el envío se
comprueba nuevamente la revisión y el permiso R2 cuando se incluyó la ventana.
La coordinación React anterior permanece desactivada en `Legacy`.

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

## Perfil y catálogo de recuerdos (2026-11-19)

La sesión de Memoria guarda el perfil que Tauri valida con las huellas de sus
fuentes. Si una comprobación posterior falla, se retiran sus hechos de las
vistas y de la recuperación conversacional. La lectura manual se inicia desde
Volumen cognitivo. El WASM devuelve índices de registros finalizados y de
lecciones elegibles. El adaptador usa los formateadores existentes y conserva
las lecciones pendientes de repaso y retiradas en la proyección de Volumen.
La recuperación en Conversación sigue bajo la revisión de contexto habitual.

## Observación de ventana (2026-11-19)

La sesión en `observation_session.rs` guarda los metadatos en memoria mientras
está vigente el permiso de sesión. El adaptador consulta R2 después de leer la
ventana y entrega el resultado junto con el identificador del permiso y la
revisión de la sesión. Una revocación, detención o vencimiento limpia el contexto
de Conversación y del núcleo cognitivo. Una respuesta pendiente de la revisión
anterior se descarta. Tauri ejecuta las decisiones que confirma el usuario y
controla el acceso nativo. La coordinación React anterior está en `Legacy`.

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

## Código activo de recuperación

- `core/navigation/app-shell.ts` monta la raíz, conecta el destino y conserva la pantalla si falla el marco.
- `core/navigation/view-mount.ts` administra el ciclo de vida de cada vista y sus reintentos.
- `core/navigation/nucleus-recovery.ts` mantiene el sondeo R3 de los respaldos de Flujo y Estado.
- `components/memory/associations-recovery.ts` conserva la revisión de relaciones cuando falla WebAssembly.

Estas rutas se encuentran en `Frontend/src/`. La retirada futura de las pruebas históricas se gestiona separadamente del producto.
