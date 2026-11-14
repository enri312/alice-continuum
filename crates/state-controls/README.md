# Estado y controles en Dioxus

Renderer de la página principal, con Dioxus 0.7.0 y dioxus-web 0.7.10 fijados
en `Cargo.lock`. El contenido conserva las clases CSS del panel React.
No accede a Tauri, archivos, credenciales, red, modelos ni memoria persistente.
Recibe el snapshot autorizado del contenedor y emite acciones de selección o
cambio de un control. El contenedor valida cada acción contra el estado actual.

- `src/ui.rs`: paneles, métricas, deslizadores, recuerdo e inspector.
- `src/model.rs`: contrato de datos cerrado y validación de valores.
- `src/lib.rs`: montaje, actualización y desmontaje del módulo WASM.
- `src/components/cognitive/state-controls/` en la raíz: adaptador React,
  ciclo de vida y validación de acciones.

El WASM y sus bindings generados se incluyen en
`src/dioxus/state-controls/pkg/`, junto con sus hashes y el hash de las fuentes.
`npm run dioxus:check` comprueba su correspondencia sin compilar Rust.
`npm run dev` y `npm run build` realizan esta comprobación. El módulo se carga
al abrir Estado y controles. Una carga, montaje o actualización fallida conserva
la vista React con los mismos datos y funciones.

Para regenerar, usar un Rust con `wasm32-unknown-unknown` y wasm-bindgen CLI
0.2.105 ya instalados. Los argumentos permiten seleccionar herramientas y caché
privadas, sin instalaciones globales:

```powershell
npm run dioxus:build -- --rust-root 'D:\ruta\rust' --cargo-home 'D:\ruta\cargo-cache' --bindgen 'D:\ruta\wasm-bindgen.exe'
```

El comando trabaja sin red por defecto. `--online` permite a Cargo obtener las
dependencias fijadas; no instala toolchains. Las salidas de compilación y los
temporales están en `local/dioxus-build/`, fuera de Git.
La compilación normal del frontend utiliza los artefactos incluidos y no necesita
esas herramientas. Las pruebas del contrato pueden ejecutarse con
`cargo test --locked --manifest-path crates/state-controls/Cargo.toml`.
