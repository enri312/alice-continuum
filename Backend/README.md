# Backend de Alice Continuum

- `src-tauri/`: aplicación Rust/Tauri, comandos nativos, memoria, permisos,
  configuración, recursos y manifiestos Cargo. Tauri sigue descubriendo este proyecto
  al iniciarse desde la raíz.
- `adapters/`: lectores de documentos y puente de medios Linux en Python, con sus
  pruebas y requisitos. Rust incluye los dos scripts usados por la aplicación.
  El formateador Obsidian se invoca desde el comando Node manual y usa sólo la
  biblioteca estándar de Python; no participa en el arranque automático.
  `r8_rerank_report.py` calcula métricas de evaluación bajo demanda desde Node;
  tampoco se inicia con la aplicación ni forma parte del núcleo de memoria.

Los datos privados no están aquí: se mantienen en `data/`, y los modelos, entornos
y recursos locales en `runtime/` o en las rutas configuradas por el propietario.
La interfaz Dioxus está en `Frontend/crates/dioxus-ui/`, porque
es una vista de la aplicación, no un servicio del backend.
El resto de la interfaz y sus recursos están en [Frontend](../Frontend/README.md).

Desde la raíz, `npm test`, `npm run build` y los lanzadores mantienen sus usos.
Para las pruebas nativas se usa `cargo test --locked --manifest-path Backend/src-tauri/Cargo.toml`.
