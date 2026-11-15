# Flujo completo en Dioxus y aceptación nativa Windows

Fecha: 2026-11-15. Alcance: página de Flujo y su sondeo R3. No cambia el backend
ni migra datos personales o almacenes a otra tecnología.

## Implementación

- `flow_page_ui.rs` presenta la sección completa y reutiliza el grafo y la sesión
  de asociaciones en un único montaje. Conserva CSS, encabezados, inspector,
  relaciones, textos y nota de procedencia.
- `flow_page_model.rs` mantiene selección, snapshot y una lectura pendiente.
  `core_activity_model.rs` valida el contrato cerrado R3: esquema, método,
  cobertura, topología, conteos, campos nulos obligatorios y señales coherentes.
  Proyecta sólo la actividad de regiones y enlaces con evidencia. Los eventos
  de procedimientos sin señal permanecen en reposo.
- Un temporizador Rust consulta cada cinco segundos. Esperar una lectura bloquea
  la siguiente; desmontar cancela el temporizador. Los datos inválidos retiran
  la señal anterior y las respuestas atrasadas no actualizan otra sesión.
- El host React sólo monta y aporta el snapshot base que prepara la aplicación.
  El transporte TypeScript no tiene timers ni proyecta R3. La página anterior,
  sus adaptadores y el sondeo compartido quedan para recuperación y otras pantallas.

## Resultado de las pruebas

- **Rust/WASM:** 25 pruebas aprobadas, Rustfmt y Clippy con `-D warnings`;
  compilación release WASM y verificación de hashes de fuentes/artefactos aprobadas.
- **Frontend:** 887 pruebas Vitest aprobadas, dos omitidas; 15 Obsidian, 20
  respaldos y dos privacidad aprobadas. `npm run build` aprobado; se conserva
  el aviso existente de chunks mayores de 500 kB.
- **Edge aislado con IPC simulado:** página y controlador Dioxus activos,
  11 nodos, clic/teclado, navegación, anchos 1440/1000 px y recuperación ante
  descarga WASM fallida. La sonda mantiene una lectura R3 suspendida durante
  dos intervalos: no aparece otra. Comprueba señales derivadas, auditoría
  degradada, rechazo de datos inválidos, recuperación y ausencia de consultas
  después de desmontar. Una respuesta activa anterior no cambia el reposo de
  una sesión nueva. También pasa la secuencia completa de relaciones.
- **Tauri/WebView2 nativo con IPC real:** `npm run test:dioxus:native` aprobado.
  Se creó una ventana real con un proceso del ejecutable del proyecto y handle
  de ventana no nulo. Abrió Conversación, navegó a Estado/Flujo, seleccionó el
  inspector y validó el snapshot R3 del backend. Seleccionó dos episodios
  sintéticos, revisó citas y confirmó una relación con los comandos reales.
  Cancelar la retirada la conservó; la relación siguió presente después de
  recargar la ventana. El SHA-256 del archivo de fuentes no cambió.
- **Lanzador habitual:** también se ejecutó `scripts/setup/launch-windows.ps1`
  desde el checkout principal. Verificó el respaldo, inició Vite/Tauri y creó
  la ventana normal de Alice. Se dejó abierta. Esta comprobación acredita el
  arranque habitual; las interacciones anteriores se hicieron sobre fixtures.

La primera ejecución nativa detectó un error del incremento anterior: el modelo
y el transporte esperaban 64 dígitos sin prefijo, mientras el backend entrega
`sha256:` seguido de esos dígitos. Se corrigieron ambos y los fixtures; una
regresión verifica el formato nativo y rechaza hashes sin prefijo o corruptos.
La prueba nativa completa pasó después de regenerar el módulo y el frontend.

Evidencia privada revisada: `runtime/artifacts/dioxus/native/dioxus-native-0R1fVL/result.json` y
`flow-native.png`; capturas de navegador en `runtime/artifacts/dioxus/browser/dioxus-browser-5eqFEJ/`.
El ensayo nativo usa datos/perfil/temporales nuevos en D:, excluye claves del
entorno, pausa el aprendizaje en sus fixtures y cierra sólo su propia instancia.
No usa mocks de Tauri. La automatización de ventanas no estaba disponible;
la comprobación funcional utilizó el diagnóstico de la WebView del proceso real.

## Criterio de cierre y límites

Por indicación del propietario, cada migración debe abrir y comprobar Alice
además de compilar. Los comandos repetibles y sus requisitos están en la
[guía del módulo](../../Frontend/crates/state-controls/README.md). El arranque nativo con
fixtures no acredita voz, motores externos ni todas las pantallas. No se probó
una conversación con un modelo ni se utilizaron recuerdos personales.

La aplicación general y sus snapshots base siguen usando React/TypeScript;
permanecen el host, el transporte IPC y las vistas de recuperación. No se declara
retirado React del proyecto. Este incremento migra el contenido y el sondeo de
la ruta normal de Flujo; no obliga a borrar funciones compartidas aún utilizadas.

Respaldo previo creado y verificado en
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-15T05-48-15-087Z-530a97ce-afdf-4c9d-9d0b-d5ab09ba0ce2`.
Obsidian, experimentos y evidencias privadas quedan fuera de Git. El documento
personal `docs/herramientas-y-persistencia-alice.md` se conserva sin cambios.
