# Línea temporal en Dioxus y salida completa de React, 2026-11-15

Actualización posterior del mismo día: la línea temporal se integra directamente
en la página de Actividad Dioxus; se retiran el host y el montaje independiente
descritos aquí. Se conserva este informe como evidencia del primer incremento.
Ver [estado y aceptación de Actividad](ACTIVITY_PAGE_DIOXUS_REPORT_2026-11-15.md).

Se confirma como objetivo retirar React por completo del producto, de forma
gradual. El [inventario de migración](../architecture/DIOXUS_MIGRATION_STATUS.md)
incluye pantallas, estado global, navegación, entrada y recuperaciones, además
de los criterios para retirar dependencias, tipos y configuración React/JSX.
Los hosts actuales son transitorios; este incremento no completa la aplicación.

## Cambio implementado

La presentación de `CognitiveTimeline.tsx` se sustituyó por `timeline_model.rs`
y `timeline_ui.rs`. Se retiró ese archivo anterior y se actualizó su importador
en Actividad. El renderer Rust mantiene los últimos 24 eventos del buffer de
sesión, selección, posiciones, carriles, módulos, duración, inspector y leyenda.
Conserva rótulos, contenido y clases CSS; no se editaron estilos ni iconos.

`CognitiveTimelineHost.tsx` sólo monta el módulo, entrega los eventos y conserva
una referencia de selección para reintentar. `timeline-bridge.ts` prepara la hora
local mediante Date/Intl y valida el callback de selección, sin depender de React.
La geometría, los contadores y la selección operativa pertenecen a Rust.
El contrato rechaza IDs ambiguos, fechas/valores inválidos y campos adicionales;
admite el límite de 200 eventos que actualmente conserva la aplicación.

Los eventos siguen siendo temporales. El componente no solicita comandos Tauri,
guarda datos ni cambia el registro R3. Un fallo de carga muestra un aviso con
reintento y mantiene la fuente en la sesión; no monta un segundo gráfico React.
El flujo de eventos y el contenedor de Actividad todavía usan React.

Se añade un octavo renderer al WASM compartido y se regeneran bindings y
manifiesto de hashes. Se conservan los contratos de los otros siete renderers.

## Verificación

- Compilación TypeScript/Vite y comprobación de artefactos aprobadas. Permanece
  la advertencia existente sobre el tamaño de un chunk.
- 32 pruebas Rust aprobadas, cuatro nuevas para límites de ventana, selección
  vigente/evictada, vaciado, geometría, fechas/IDs inválidos y formato de duración.
  Rustfmt y Clippy WASM aprobados sin advertencias.
- 900 pruebas frontend aprobadas, dos opcionales omitidas. Las dos nuevas cubren
  el transporte de todos los eventos, fechas locales y callbacks cerrados.
  También pasaron 15 de Obsidian, 20 de respaldos y dos de privacidad.
- Navegador: vacío, 30/31 eventos con ventana de 24, posiciones, selección por
  clic y teclado, conservación al actualizar, contenido HTML dibujado como texto,
  rechazo de IDs ambiguos, vaciado, desmontaje y reintento tras bloquear WASM.
  Capturas del componente a 1440 y 390 px revisadas, sin desbordamiento horizontal
  medido. Los ensayos previos de Estado, Flujo y asociaciones también pasaron.
  Evidencia privada: `runtime/artifacts/dioxus/browser/dioxus-browser-MXCLVG/`.
- Tauri/WebView2 real: Actividad montó la línea temporal con eventos de la sesión;
  vaciar la vista temporal se reflejó en Dioxus. Un par sintético independiente
  comprobó que Enter cambiaba el inspector entre dos eventos distintos. También
  pasaron navegación, R3, revisión/confirmación y persistencia de asociaciones.
  Los registros fuente conservaron su SHA-256. Captura nativa revisada.
  Evidencia: `runtime/artifacts/dioxus/native/dioxus-native-hYpovl/`.

Las pruebas nativas usan backend real y datos aislados. No se utilizaron recuerdos
personales, micrófono, modelos ni proveedores reales; esos servicios conservan
su aceptación pendiente. El backend y los almacenes no cambiaron.
