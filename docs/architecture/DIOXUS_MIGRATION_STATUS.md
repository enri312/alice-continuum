# Migración Dioxus: componentes y retirada de React

La migración continúa por componentes en Windows. Cada sustitución conserva
contenido, clases CSS, datos y permisos. Eliminar un archivo requiere comprobar
sus importadores y cubrir su función con una ruta probada de funcionamiento y
recuperación. No se deduce que un archivo sobra sólo porque ya haya un renderer Rust.

| Área | Dioxus operativo | Dependencias React actuales |
|---|---|---|
| Estado y controles | Panel, métricas, ajustes, recuerdo, inspector y encabezado R3. | Contenedor de sesión, sondeo, validación de acciones y vista de respaldo. |
| Flujo cognitivo | Página completa, encabezado R3, grafo, conexiones, selección, inspector, sondeo/proyección R3 y panel/controlador de asociaciones en un solo montaje. | Host de montaje, snapshot base desde la aplicación, transporte IPC y página anterior para recuperación. |
| Lista de relaciones guardadas | Títulos, estado, botones, bloqueos y selección de revisión. | Adaptador y lista sólo para recuperación. |
| Formulario de fuentes | Selectores, entradas, citas, borrador, evidencia derivada y solicitud de revisión. | Adaptador y formulario sólo para recuperación. |
| Confirmaciones de relaciones | Revisión pendiente, confirmación de creación, retirada/restauración, cancelación y bloqueo de doble clic. | Adaptador y confirmación sólo para recuperación. |
| Controlador de asociaciones | Sesión, borrador, revisiones, bloqueo de operaciones, actualización, errores y panel completo. | Host de montaje y carga diferida del controlador anterior ante fallo; transporte TypeScript limitado a comandos existentes. |

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
Las siete vistas reutilizan ese código, con registros de instancias independientes.
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
  [informe de la página](../testing/FLOW_PAGE_DIOXUS_REPORT_2026-11-15.md).

La prueba nativa usa datos sintéticos y no certifica voz, proveedores ni datos
personales. No se utilizaron recuerdos personales. Los ensayos están documentados en la
[guía del módulo](../../Frontend/crates/state-controls/README.md).

## Código que todavía tiene uso

- `CognitiveFlow.tsx` y los componentes de encabezado React presentan el respaldo.
- `EvidenceFlowFallback.tsx` y `CognitiveFlowDioxus.tsx` conservan el camino anterior.
- `useNucleusSnapshot` permanece para otras pantallas y para ese respaldo.
- `MemoryAssociations.tsx` mantiene montaje, transporte y selección del respaldo.
- `MemoryAssociationsFallback.tsx` mantiene la sesión anterior sólo ante fallo.
- `SavedRelationsFallback` mantiene la lista durante carga, fallo y reintento.
- `SourceFormFallback` mantiene los selectores y citas durante carga o fallo.
- `ConfirmationFallback` conserva las pantallas de confirmación durante carga o fallo.
- Los adaptadores de montaje y la navegación principal conectan React con Dioxus.

La retirada de esos elementos queda condicionada a migrar y comprobar sus usos.
Antes de borrar: buscar importadores, actualizar las rutas y pruebas afectadas,
verificar contenido y teclado, fallos de carga, desmontaje y remontaje, y cerrar
con un commit revisado. La retirada final de React requiere que todas las rutas
operativas y de recuperación dejen de depender de él.
