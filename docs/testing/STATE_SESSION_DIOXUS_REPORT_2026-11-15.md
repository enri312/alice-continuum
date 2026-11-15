# Sesión de Estado y controles en Dioxus, 2026-11-15

Después de renombrar los recursos privados a `runtime/` y comprobar el arranque,
se migró la sesión R3 de Estado y controles. La página conserva sus contenidos,
rótulos, métricas, fila de memoria, inspector, deslizadores y clases CSS.
No se modificaron hojas de estilo ni iconos en este incremento.

## Responsabilidad de cada parte

- `state_page_model.rs`: snapshot base, una lectura pendiente, correlación de
  respuestas, validación R3 compartida y proyección de métricas. Conserva las
  fórmulas anteriores y los bloqueos de controles. Una respuesta inválida retira
  la señal anterior; actualizar el snapshot base no repite la lectura pendiente.
- `ui.rs`: presentación existente, selección y tarea Dioxus con intervalo de
  cinco segundos. Desmontar cancela la tarea. El contrato de montaje de Estado
  recibe configuración y respuestas tipadas; los demás renderers conservan sus
  contratos. Se regeneraron WASM, bindings y manifiesto de hashes.
- `StateControlsHost.tsx` y `StateControlsView.tsx`: montaje, snapshot base,
  referencia de selección para recuperar y conexión con los ajustes compartidos
  de Conversación. La selección operativa, el sondeo y la proyección de R3 ya no
  dependen del estado React del host normal.
- `transport.ts`: única lectura permitida, `core_activity_snapshot`, y acciones
  de selección/ajuste revalidadas contra la disponibilidad actual. No guarda
  recuerdos ni concede permisos. Una solicitud de configuración nueva espera a
  que termine la lectura anterior; desmontar descarta respuestas y esa espera.
- `StateControlsRecovery.tsx`: sesión React anterior, cargada sólo si falla
  WASM. Conserva funciones, selección y ajustes; se desmonta al reintentar.

Los valores compartidos de creatividad y empatía permanecen en la aplicación
porque también los consume Conversación. React sigue sosteniendo la navegación,
el snapshot base y la recuperación. Este incremento no elimina React del proyecto
ni declara migradas las demás páginas.

## Verificación

- Compilación TypeScript/Vite y comprobación de artefactos aprobadas.
- 28 pruebas Rust aprobadas. Las nuevas verifican lectura única, correlación de
  respuestas, invalidación de señal, proyección y conservación de bloqueos.
  Rustfmt y Clippy para `wasm32-unknown-unknown`, sin advertencias.
- 898 pruebas frontend aprobadas; dos opcionales omitidas. El transporte cubre
  solicitudes cerradas, errores, correlación, espera sin solapar lecturas,
  bloqueo actual y descarte tras desmontar. Además: 15 Obsidian, 20 de respaldos
  y dos de privacidad aprobadas.
- Edge sobre el build de producción con IPC ficticio: una lectura de Estado se
  suspendió durante dos intervalos sin duplicarla. Se comprobaron valores R3,
  auditoría degradada, dos ajustes habilitados, creatividad por teclado,
  conservación del ajuste al navegar, señal inválida, cancelación del sondeo,
  respuesta tardía y recuperación ante bloqueo de WASM conservando la selección.
  También pasaron los ensayos anteriores de Flujo y asociaciones. Evidencia:
  `runtime/artifacts/dioxus/browser/dioxus-browser-udRMHu/`.
- Tauri/WebView2 real: Estado montado en Dioxus, lectura R3 real validada por
  Rust, un encabezado y una banda de procedencia; navegación y flujo de revisión,
  confirmación, cancelación y persistencia de relaciones sintéticas al recargar.
  Evidencia: `runtime/artifacts/dioxus/native/dioxus-native-uWg6zD/`.
  Capturas de Estado en navegador y Tauri revisadas visualmente.

Las pruebas nativas usan backend real con datos aislados y no sustituyen la
aceptación de micrófono, modelos o proveedores reales. No se usaron recuerdos
personales ni se modificó el backend en este segundo incremento.
