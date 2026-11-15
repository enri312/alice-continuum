# Estado y controles en Dioxus

Este paquete también incorpora el grafo y el inspector de Flujo cognitivo:
`flow_model.rs` valida nodos, geometría, selección y señales R3; `flow_ui.rs`
los dibuja con las clases CSS existentes. Los siete renderers comparten un único
WASM y tienen ciclos de montaje independientes. La página completa de Flujo
integra el grafo y las asociaciones en un solo montaje y mantiene en Rust su
selección, validación/proyección R3 y sondeo serializado de cinco segundos.
La aplicación React aporta el snapshot base y la navegación; la página anterior
y el sondeo compartido siguen disponibles para recuperación y otras pantallas.

Renderer de la página principal, con Dioxus 0.7.0 y dioxus-web 0.7.10 fijados
en `Cargo.lock`. El contenido conserva las clases CSS del panel React.
No accede directamente a Tauri, archivos, credenciales, red ni modelos.
Estado/Flujo reciben snapshots del contenedor. El controlador de asociaciones
recibe las lecturas autorizadas de grafo, registros y relaciones mediante un
transporte limitado a seis comandos existentes. Mantiene la sesión en memoria;
la validación de evidencia y toda persistencia siguen en el backend.

- `src/ui.rs`: marco R3, paneles, selección local, métricas, deslizadores, recuerdo e inspector.
- `src/model.rs`: contrato cerrado, presentación de R3 y recuerdos, preparación y validación de controles.
- `src/activity_ui.rs`: encabezado y banda R3 compartidos por Estado y Flujo.
- `src/relations_model.rs`, `src/relations_ui.rs`: lista de relaciones guardadas
  y solicitud de revisión; sin confirmación ni escritura.
- `src/source_form_model.rs`, `src/source_form_ui.rs`: fuentes y citas; las
  versiones y hashes se obtienen en el controlador y se validan en el backend.
- `src/confirmation_model.rs`, `src/confirmation_ui.rs`: presentación de revisiones
  y decisiones; se reutiliza tanto dentro del panel como en el respaldo.
- `src/associations_model.rs`, `src/associations_ui.rs`: controlador y panel completo
  de relaciones; deriva evidencia desde las fuentes cargadas y rechaza acciones
  ocupadas, confirmaciones atrasadas y respuestas de operaciones anteriores.
- `src/core_activity_model.rs`: contrato R3 cerrado y validación de cobertura,
  topología, conteos y señales; conserva el caso de procedimientos sin señal.
- `src/flow_page_model.rs`, `src/flow_page_ui.rs`: página completa, selección,
  proyección R3, una lectura pendiente y canal independiente de asociaciones.
- `src/browser_timer.rs`: temporizador propio de la tarea Dioxus, cancelado al
  desmontar. El transporte TypeScript no contiene un intervalo ni proyecta R3.
- `src/browser_runtime.rs`: plantilla común de montaje, actualización y cierre,
  con instancias separadas para cada renderer.
- `src/lib.rs`: montaje, actualización y desmontaje del módulo WASM.
- `Frontend/src/components/memory/associations-transport.ts` en la raíz: transporte cerrado,
  sin selección de fuentes ni estado de confirmación. Descarta solicitudes repetidas
  y respuestas tras desmontar. `MemoryAssociationsFallback.tsx` sólo se carga ante
  un fallo del módulo; conserva la recuperación React y sus tres adaptadores.
- `Frontend/src/components/cognitive/state-controls/` en la raíz: puente con la sesión React,
  ciclo de vida, validación de acciones y una vista de recuperación. La antigua
  `StateControlsPage.tsx` ya no es necesaria.

El WASM y sus bindings generados se incluyen en
`Frontend/src/dioxus/state-controls/pkg/`, junto con sus hashes y el hash de las fuentes.
`npm run dioxus:check` comprueba su correspondencia sin compilar Rust.
`npm run dev` y `npm run build` realizan esta comprobación. El módulo se carga
al abrir Estado y controles o Flujo. Una carga, montaje o actualización fallida conserva
la vista React con los mismos datos y funciones.

Para regenerar, usar un Rust con `wasm32-unknown-unknown` y wasm-bindgen CLI
0.2.105 ya instalados. Los argumentos permiten seleccionar herramientas y caché
privadas, sin instalaciones globales:

```powershell
npm run dioxus:build -- --rust-root 'D:\ruta\rust' --cargo-home 'D:\ruta\cargo-cache' --bindgen 'D:\ruta\wasm-bindgen.exe'
```

El comando trabaja sin red por defecto. `--online` permite a Cargo obtener las
dependencias fijadas; no instala toolchains. Las salidas de compilación y los
temporales están en `runtime/dioxus-build/`, fuera de Git.
La compilación normal del frontend utiliza los artefactos incluidos y no necesita
esas herramientas. Las pruebas del contrato pueden ejecutarse con
`cargo test --locked --manifest-path Frontend/crates/state-controls/Cargo.toml`.

## Ensayo opcional en Edge/Chromium

Desde la raíz, ejecutar `npm run build` y mantener un preview local en otra
terminal: `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`.
Después, indicar la ruta absoluta del navegador instalado y lanzar la sonda:

```powershell
$env:ALICE_BROWSER_BIN = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/testing/dioxus-browser-smoke.mjs
```

La sonda abre un perfil nuevo sin ventana y escribe capturas en
`runtime/artifacts/dioxus/browser/dioxus-browser-*`.
Comprueba selección por clic/teclado, navegación entre Flujo y Estado, ausencia
de duplicados y anchos de 1440/1000 px. Inyecta estados R3 ficticios sólo en
una instancia de prueba de WASM y verifica el rechazo de una señal inválida.
Bloquea la descarga de WASM para comprobar el respaldo y el reintento conservando
la selección. `ALICE_PREVIEW_URL` admite otro preview HTTP de loopback.
Requiere un build actual del proyecto; no valida Tauri, voz ni memoria personal.
También simula IPC con cuatro relaciones ficticias y comprueba sus estados,
bloqueos y títulos como texto. Seleccionar y cancelar no escriben; confirmar
envía la revisión esperada al servicio ficticio. Se ensayan un error de guardado
y la recuperación de la lista tras un fallo de WASM. Nunca conecta esa simulación
con los almacenes del propietario.
El ensayo del formulario usa únicamente fuentes ficticias: prueba selectores,
entradas originales, citas por teclado, revisión separada de confirmación,
invalidación al editar, error de cita no literal y reintento conservando el borrador.
Las confirmaciones se comprueban en Dioxus, incluido el doble clic con una sola
solicitud, bloqueo durante la espera del servicio ficticio y recuperación del
renderer sin confirmar. Las pruebas del adaptador rechazan identidades antiguas
y parámetros de persistencia aportados por eventos.
El ensayo exige además que el controlador completo esté en Dioxus. Salir durante
una revisión y volver no entrega su respuesta a la sesión nueva ni guarda una
relación. Al bloquear WASM se comprueba por separado la recuperación React.
También exige la página completa en Dioxus. Una lectura R3 queda suspendida
durante dos intervalos: no se superpone otra. Un snapshot inválido retira la
señal anterior. Salir cancela el sondeo y una respuesta anterior no altera el
estado de la sesión nueva.

## Aceptación nativa Windows después de cada migración

Con Alice cerrada y el build actual servido por el preview de loopback anterior:

```powershell
npm run test:dioxus:native
```

El ensayo compila y abre una ventana real de Tauri/WebView2 con el frontend de
producción. Usa una carpeta nueva en `runtime/artifacts/dioxus/native/dioxus-native-*` para datos, perfil
WebView, configuración, temporales y evidencia. No copia la memoria personal y
excluye claves/proveedores del entorno. Desactiva aprendizaje en el fixture;
no ejecuta modelos ni requiere voz.

Comprueba la ventana, apertura de Conversación, navegación Estado/Flujo,
inspector, lectura R3 del backend real y una relación entre dos episodios
sintéticos: revisión, confirmación, cancelación de retirada y conservación al
recargar. Verifica que las fuentes no cambien. No sustituye Tauri IPC por mocks.
Cierra sólo la instancia que creó. Si Alice ya estaba abierta, se niega a iniciar.

Utiliza diagnóstico de WebView2, habilitado sólo en el proceso de prueba mediante
las [opciones oficiales de WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.3967.48).
La configuración habitual de Alice no recibe un puerto de depuración. Esta prueba
comprueba arranque e interacción nativa con datos sintéticos; las pruebas con
voz, motores externos y datos personales tienen un alcance separado.
