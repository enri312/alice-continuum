# Controlador de relaciones en Rust/Dioxus

Fecha: 2026-11-15. Alcance: Flujo cognitivo en Windows, sin modificar los
comandos de persistencia ni utilizar recuerdos personales como datos de prueba.

Actualización posterior: el [informe de la página completa](FLOW_PAGE_DIOXUS_REPORT_2026-11-15.md)
registra la aceptación nativa con fuentes sintéticas y la corrección del prefijo
`sha256:` que no cubrían los fixtures originales. El presente informe conserva
la evidencia y los límites del incremento inicial.

## Cambio

El panel normal de relaciones pasa a un único montaje Dioxus. El modelo Rust
mantiene selección, citas, revisión pendiente, decisión de retirar/restaurar,
operación ocupada, errores y actualización posterior. Deriva versiones y hashes
de las fuentes cargadas; no los acepta como campos de una acción de usuario.
Confirmar exige una revisión pendiente vigente y el bloqueo de operación se
activa antes de emitir la solicitud. Un resultado se aplica sólo a la operación
que lo espera. Tras guardar se actualizan las tres lecturas existentes.

El transporte TypeScript admite únicamente grafo, memoria, relaciones, revisión,
confirmación y retirada/restauración. Rechaza solicitudes mal formadas,
parámetros adicionales, IDs repetidos y nuevas solicitudes durante una operación.
Desmontar impide ejecutar solicitudes encoladas y descarta resultados tardíos.
No reintenta escrituras automáticamente. El backend conserva las validaciones
de evidencia literal, fuentes vigentes, confirmación y revisión durable.

Se reutilizan los componentes Dioxus de fuentes, lista y confirmaciones en vez
de duplicar su presentación. No se modificaron las hojas CSS. El host React
sólo monta y conecta IPC. Si falla el módulo, carga de forma diferida el
controlador anterior y sus adaptadores; todavía son necesarios para recuperación.

## Verificación ejecutada

- **Rust:** 19 pruebas aprobadas del módulo; las cinco nuevas cubren evidencia
  derivada, edición que invalida, revisión esperada, cancelación, bloqueo de
  doble clic, errores, datos inválidos y respuestas atrasadas. Rustfmt y Clippy
  para WASM aprobados con `-D warnings`; build release WASM regenerado.
- **Frontend:** `npm test` aprobado: 883 pruebas Vitest, dos omitidas; 15 pruebas
  Obsidian, 20 respaldos y dos privacidad aprobadas. Cuatro pruebas nuevas
  verifican transporte cerrado, escritura única, errores y descarte al desmontar.
- **Build:** `npm run build` aprobado, incluida la correspondencia entre fuentes
  y artefactos WASM. Persiste el aviso previo de chunks mayores de 500 kB.
- **Edge aislado:** `scripts/testing/dioxus-browser-smoke.mjs` aprobado sobre
  el build de producción y un preview de loopback. El panel informa controlador
  Dioxus. Se comprobaron cuatro estados de relaciones ficticias, fuentes
  elegibles, citas por teclado, revisión separada, invalidación al editar,
  cancelación, bloqueo mientras se espera, doble clic con una escritura,
  revisión esperada, error de escritura y actualización de lista.
- **Ciclo de vida:** salir durante una revisión y volver descarta la respuesta
  de la sesión anterior y no guarda. Bloquear la descarga WASM activa el
  controlador React anterior; sus reintentos conservan el borrador y no guardan.
  También se conservan las pruebas de navegación Estado/Flujo, 11 nodos,
  teclado, estados R3 ficticios y anchos de 1440/1000 px.
- **Revisión visual:** capturas de fuentes y confirmación revisadas. Se mantiene
  el diseño existente: colores, bordes, dos columnas de fuentes, controles y
  confirmaciones. Las capturas privadas quedan en
  `runtime/artifacts/dioxus/browser/dioxus-browser-FiSgIz/`, fuera de Git.

Las llamadas IPC del navegador son ficticias. No se abrió un almacén personal,
no se ejecutó un modelo ni se probó voz. Los comandos del backend no cambiaron;
sus pruebas de persistencia del incremento anterior no se presentan aquí como
una ejecución nueva.

## Pendiente

La aceptación de la aplicación nativa Tauri con datos reales sigue pendiente.
Flujo todavía usa el contenedor React, el sondeo R3, el montaje, el transporte
TypeScript y las vistas de recuperación. Este incremento migra el controlador
normal de relaciones; no elimina React del proyecto ni autoriza retirar todavía
esos respaldos. Tampoco migra los almacenes a otra tecnología.

Durante este incremento se creó y verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-15T02-57-31-284Z-12c73295-7352-425d-a82f-8ffb31f9ad77`.
El documento personal `docs/herramientas-y-persistencia-alice.md` se conserva
sin cambios y fuera del commit, igual que Obsidian, experimentos y datos privados.
