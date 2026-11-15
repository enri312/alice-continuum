# Página de Actividad en Dioxus — 2026-11-15

## Resultado y límites

Actividad usa un único renderer Dioxus para encabezado, estado, pestañas,
línea temporal y Event Stream. Se conservan contenido, rótulos, clases CSS y
colores; no se editaron hojas de estilo ni iconos. La búsqueda y el filtro por
módulo, el cambio de vista, orden inverso de consola y selección pertenecen a
Rust. Los filtros y la selección se conservan entre vistas y al llegar eventos.

`App.tsx` conserva por ahora el buffer de hasta 200 eventos, sus productores,
secuencia y navegación. `ActivityHost.tsx` sólo conecta esa fuente y el montaje,
reintento y vaciado, con callbacks cerrados. Sigue siendo una dependencia React
temporal; este incremento no retira React de toda la aplicación. El formato
Date/Intl de horas locales y milisegundos queda en un módulo independiente.

La línea conserva su ventana de 24 eventos, geometría, duración, inspector,
leyenda y teclado. Reutiliza `timeline_ui::panel` dentro de Actividad sin otro
montaje, controlador ni buffer. Los relojes de consola deben coincidir en número
con la fuente validada. IDs ambiguos, valores fuera del contrato y campos
adicionales se rechazan antes de actualizar. La búsqueda admite 8192 unidades
UTF-16; no se recorta el contenido de los eventos.

Limpiar sólo emite una solicitud para vaciar la vista temporal. El buffer cambia
cuando la aplicación recibe esa solicitud; no hay comandos Tauri ni escrituras
de auditoría o recuerdos desde esta página. Una carga o actualización fallida
libera el renderer, conserva la fuente y ofrece reintento; no se monta una segunda
implementación React de la consola. Vista, filtros y selección se guardan en una
referencia de recuperación para ese reintento.

## Archivos retirados y separación de responsabilidades

- Se retiran `ActivityPage.tsx`, su presentación React de Actividad y
  `CognitiveTimelineHost.tsx`.
- Se retiran las funciones WASM y el cargador del montaje independiente de
  Timeline. Las pruebas ejercitan ahora el panel a través de Actividad.
- `GovernancePage.tsx` conserva las lecturas y el contenido React de Auditoría
  y diagnóstico que antes compartían archivo con Actividad. No se migran sus
  contratos, comandos ni lógica en este incremento.
- `activity_page_model.rs` y `activity_page_ui.rs` se incorporan al mismo WASM
  compartido. Se regeneran bindings y el manifiesto de fuentes/artefactos.

Las versiones anteriores permanecen en Git. No se cambiaron backend, almacenes,
adaptadores Python, permisos ni políticas de aprendizaje.

## Verificación

Las pruebas se ejecutan con fuentes y perfiles aislados en `runtime/`, en D:.
No usan los recuerdos personales, micrófono ni proveedores/modelos reales.

- Rust: 35 pruebas de modelo aprobadas; tres nuevas cubren filtros Unicode y
  combinados, orden, texto literal, actualización, selección, vacío, recuperación
  y rechazo de contratos inválidos. Rustfmt y Clippy WASM aprobados.
- Compilación WASM, TypeScript/Vite y comprobación de artefactos aprobadas.
  Se conserva la advertencia previa sobre el tamaño de un chunk.
- `npm test`: 907 pruebas JS/TS aprobadas y dos opcionales omitidas; 19 de
  Obsidian, 20 de respaldos y dos de privacidad aprobadas. Se retira la prueba
  del callback independiente obsoleto, cubierta ahora por el contrato de Actividad.
- El transporte TypeScript prueba ambos relojes, preservación de fuente,
  recuperación, límite UTF-16 y callbacks que no permiten otros comandos.
- Navegador: página única, consola completa, orden inverso, milisegundos,
  filtros combinados, búsqueda Unicode, HTML como texto, selección por clic y
  Enter, actualización sin perder filtros, vaciado, desmontaje y reintento tras
  bloquear WASM. Capturas de consola a 1440 y 390 px revisadas; el ancho de la
  página se conserva y la tabla desplaza internamente sus columnas.
- Tauri/WebView2: abre Actividad con eventos de sesión, busca y restaura la lista,
  vacía el buffer y muestra la línea vacía. Un par ficticio independiente comprueba
  el teclado dentro del renderer de página. También pasan Estado/Flujo, R3,
  navegación, auditoría separada, revisión/confirmación y persistencia de relaciones
  tras recarga; el archivo fuente conserva su SHA-256. Capturas nativas revisadas.

Evidencia privada: `runtime/artifacts/activity-dioxus-2026-11-15/`,
`runtime/artifacts/dioxus/browser/dioxus-browser-M5ZvnC/` y
`runtime/artifacts/dioxus/native/dioxus-native-nDUhaU/`. Estas pruebas validan el
alcance descrito; los servicios reales conservan su aceptación independiente.
