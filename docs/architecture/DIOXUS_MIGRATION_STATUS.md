# Migración Dioxus: componentes y retirada de React

La migración continúa por componentes en Windows. Cada sustitución conserva
contenido, clases CSS, datos y permisos. Eliminar un archivo requiere comprobar
sus importadores y cubrir su función con una ruta probada de funcionamiento y
recuperación. No se deduce que un archivo sobra sólo porque ya haya un renderer Rust.

| Área | Dioxus operativo | Dependencias React actuales |
|---|---|---|
| Estado y controles | Panel, métricas, ajustes, recuerdo, inspector y encabezado R3. | Contenedor de sesión, sondeo, validación de acciones y vista de respaldo. |
| Flujo cognitivo | Encabezado R3, grafo, conexiones, selección e inspector. | Contenedor, sondeo, formulario y confirmaciones de asociaciones, recuperación visual. |
| Lista de relaciones guardadas | Títulos, estado, botones y bloqueos según datos actuales. | Adaptador, validación de solicitud de revisión y lista de respaldo. |

## Incremento de lista de relaciones

`relations_model.rs` y `relations_ui.rs` presentan la lista y emiten únicamente
`reviewRelation` con un ID. El adaptador vuelve a comprobar el ID y los bloqueos
contra el estado actual. El renderer no acepta una confirmación ni elige la
revisión de persistencia. `MemoryAssociations.tsx` conserva la revisión visible,
el botón de confirmación, los comandos Tauri y la actualización posterior.
El backend sigue validando revisión, fuentes, confirmación y bloqueos.

El montaje duplicado de Estado y Flujo se sustituyó por `browser_runtime.rs`.
Las tres vistas reutilizan ese código, con registros de instancias independientes.
El mismo WASM conserva sus comprobaciones de fuentes y artefactos.

## Verificación y límites

- Compilación TypeScript/Vite, diez pruebas del módulo Rust y Clippy para WASM.
- Pruebas de frontera que rechazan solicitudes con confirmación, revisión elegida,
  IDs ausentes y acciones atrasadas cuando cambian los bloqueos.
- Edge aislado verifica navegación, clic, teclado y recuperación de Estado/Flujo.
  Una simulación de IPC aporta cuatro relaciones ficticias: vigente, retirada,
  bloqueada y con fuente no vigente. Comprueba títulos como texto, bloqueos,
  cancelar sin escritura, confirmar con revisión esperada, error de guardado,
  descarga WASM fallida y reintento sin duplicar ni escribir relaciones.
- Las cinco pruebas existentes de asociaciones del backend comprueban persistencia,
  fuentes cambiadas, revisión atrasada, confirmación ausente, corrupción y bloqueo
  entre procesos sobre datos temporales.

Estas pruebas no sustituyen la aceptación de la aplicación nativa con datos reales.
No se utilizaron recuerdos personales. El ensayo opcional está documentado en la
[guía del módulo](../../crates/state-controls/README.md).

## Código que todavía tiene uso

- `CognitiveFlow.tsx` y los componentes de encabezado React presentan el respaldo.
- `MemoryAssociations.tsx` mantiene formulario, confirmaciones, errores y comandos.
- `SavedRelationsFallback` mantiene la lista durante carga, fallo y reintento.
- Los adaptadores de montaje y la navegación principal conectan React con Dioxus.

La retirada de esos elementos queda condicionada a migrar y comprobar sus usos.
Antes de borrar: buscar importadores, actualizar las rutas y pruebas afectadas,
verificar contenido y teclado, fallos de carga, desmontaje y remontaje, y cerrar
con un commit revisado. La retirada final de React requiere que todas las rutas
operativas y de recuperación dejen de depender de él.
