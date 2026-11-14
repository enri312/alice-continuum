# Backend de Alice Continuum

- `src-tauri/`: aplicación Rust/Tauri, comandos nativos, memoria, permisos,
  configuración, recursos y manifiestos Cargo. Tauri sigue descubriendo este proyecto
  al iniciarse desde la raíz.
- `adapters/`: lectores de documentos y puente de medios Linux en Python, con sus
  pruebas y requisitos. Rust incluye los dos scripts usados por la aplicación.

Los datos privados no están aquí: se mantienen en `data/`, y los modelos, entornos
y recursos locales en `local/` o en las rutas configuradas por el propietario.
La interfaz Dioxus de Estado y controles sigue en `crates/state-controls/`, porque
es una vista de la aplicación, no un servicio del backend.

Desde la raíz, `npm test`, `npm run build` y los lanzadores mantienen sus usos.
Para las pruebas nativas se usa `cargo test --locked --manifest-path Backend/src-tauri/Cargo.toml`.
