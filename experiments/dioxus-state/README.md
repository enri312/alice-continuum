# Estado y controles · piloto Dioxus-Web

Vista paralela de Alice construida con **Dioxus 0.7.0 y WebAssembly**, sin IPC,
sondeo, micrófono, proveedores o acceso a recuerdos reales. No participa en el
arranque, build, dependencias o navegación de la aplicación principal.

Conserva las ocho señales internas, ocho controles informativos, memoria
recuperada, inspector, etiquetas y procedencia de la vista existente. Todos los
valores son fixtures sintéticos, identificados como demostración. Los escenarios
incluyen actividad, vacío, carga, lectura no disponible y auditoría degradada.
Seleccionar un control sólo cambia el inspector: no hay controles editables.

## Compilar

Requisitos: toolchain Rust con `wasm32-unknown-unknown` y wasm-bindgen CLI
**0.2.105**, con sus archivos y cachés en D:. No se necesita dx, Trunk, npm ni
modificar la instalación Rust global. El Cargo.lock pertenece sólo al piloto.

```powershell
$pilotTools = Join-Path (Get-Location) 'local/experiments/toolchains'
.\experiments\dioxus-state\build.ps1 `
  -RustToolchainRoot (Join-Path $pilotTools 'rustup/toolchains/1.99.1-x86_64-pc-windows-msvc') `
  -CargoHome (Join-Path $pilotTools 'cargo') `
  -WasmBindgen (Join-Path $pilotTools 'wasm-bindgen/wasm-bindgen-0.2.105-x86_64-pc-windows-msvc/wasm-bindgen.exe')
```

El script comprueba herramientas y versión, limita las escrituras a la unidad
del proyecto y restaura sus variables de entorno al terminar. Compila con
`--locked` y `--target-dir` explícitos. La salida y temporales se guardan bajo
`local/experiments/dioxus-state/`, ignorado por Git. No borra carpetas ni mueve
archivos del proyecto principal.

La primera compilación puede descargar dependencias de crates.io según el lock,
en el CargoHome explícito de D:, y lo anuncia antes de compilar. Después puede
añadirse `-Offline` si esas dependencias ya están disponibles. El script no
descarga toolchains, modelos ni el CLI wasm-bindgen y limita Cargo a dos trabajos.
Antes de ejecutar herramientas retira del entorno hijo las variables de
credenciales/proveedores y proxies por su nombre, sin registrar valores, y las
restaura al volver. El piloto sólo necesita descargar crates públicos.

## Abrir

```powershell
python .\experiments\dioxus-state\serve.py --port 5178
```

Abre `http://127.0.0.1:5178/`. El servidor sólo sirve archivos de la distribución,
se liga a loopback y no expone la raíz del repositorio, directorios o datos.
Cierra el servidor con Ctrl+C. Cerrar esta página devuelve a la interfaz React
normal; no hay configuración que revertir en Alice.

## Comprobar

- Cambiar los cinco escenarios y seleccionar señales, memoria y controles.
- Comprobar etiqueta de demostración, valores, inspector, bloqueo y procedencia.
- Usar Tab/Enter/Espacio y foco visible, y revisar anchos de 1440, 1000 y 420 px.
- En carga/error no mostrar actividad o auditoría saludable inventadas.
- Las pruebas de modelo son nativas y no leen archivos privados. Deben ejecutarse
  con CARGO_HOME, TEMP, TMP y `--target-dir` aislados, igual que la compilación.

Comprobaciones realizadas en esta implementación: compilación release WASM y
empaquetado con wasm-bindgen aprobados; cuatro pruebas de fixtures Rust y cuatro
del servidor Python aprobadas. La revisión visual se registra por separado.
Se comprobó el arranque, los cinco escenarios, el inspector y Tab/Enter en
Chrome. El CSS del piloto recupera la paleta, los paneles angulares y las filas
compactas de Alice después de revisar la primera presentación. La vista estrecha
de 420 × 800 se observó parcialmente; faltan la aceptación visual completa y la
comparación con React a los demás anchos.
[Evidencia y límites](../../docs/testing/ISOLATED_PILOTS_REPORT_2026-11-13.md).
El crate público `dioxus` se fija a 0.7.0; Cargo.lock resuelve sus componentes
internos compatibles en 0.7.10. El crate y CLI wasm-bindgen son ambos 0.2.105.

La paridad visual y funcional de este piloto no demuestra una mejora de
rendimiento ni aceptación nativa dentro de Tauri. Un enlace futuro con datos
reales requerirá un adaptador de lectura y validación independiente.

Fuentes: [Dioxus-Web](https://dioxuslabs.com/learn/0.7/guides/platforms/web/),
[features mínimas 0.7.0](https://github.com/DioxusLabs/dioxus/blob/v0.7.0/packages/dioxus/Cargo.toml),
[wasm-bindgen sin bundler](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html#without-a-bundler).
