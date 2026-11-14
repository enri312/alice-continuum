# Primera página Dioxus: Estado y controles

Fecha local: 14 de noviembre de 2026. Alcance autorizado: sólo esta página,
funciones, diseño e icono; experimentos de AI Studio tratados como material a pulir.

## Integración

### Avance posterior: lógica propia en Rust

La selección activa, la resolución del inspector, la presentación del recuerdo
y la validación de los dos controles se calculan ahora en Rust. El adaptador
React refleja la selección para el respaldo, prepara los ajustes compartidos con
Conversación y valida de nuevo las acciones que cruzan la frontera de WASM. Las
pruebas cubren controles bloqueados, valores inválidos, puntuación real y contexto
limitado. La navegación y los servicios comunes siguen en el contenedor React.
Este avance necesita una nueva revisión visual y funcional en Tauri antes de dar
la migración completa de la página por aceptada.

`crates/state-controls/src/ui.rs` renderiza el panel y el inspector con Dioxus
0.7.0 / dioxus-web 0.7.10. Se conservan las clases del CSS existente, el rótulo
técnico, «Modelo interno», las ocho señales, la fila compacta de memoria y los
ocho deslizadores. No se copió la exportación completa, su configuración de red,
sus otras páginas ni sus módulos nativos. El backend de Tauri, la conversación,
la voz y los almacenes mantienen sus contratos.

`StateControlsPage.tsx` permanece como adaptador: recibe el snapshot actual,
lee la actividad con el sondeo ya existente y conecta acciones con el estado de
sesión. No es un requisito permanente de Dioxus; existe porque la aplicación
contenedora y esos servicios siguen en React. El renderer Rust recibe datos y
emite acciones; no invoca Tauri ni accede a red, archivos, claves o modelos.

El módulo se importa y su WASM se inicializa al abrir la página. No añade un
sondeo nuevo ni carga WASM en Conversación. Su instancia se desmonta al navegar.
El host espera la confirmación de montaje y conserva un panel React de respaldo
si falla la carga, el montaje vence o una actualización falla. La selección y
los ajustes pertenecen al contenedor, para no perderlos al usar ese respaldo.

El WASM, bindings y snippets generados se incluyen en el código operativo,
separados de `experiments/`. Un manifiesto registra hashes de todas las salidas,
fuentes y Cargo.lock. `npm run dev` y `npm run build` verifican esa correspondencia
sin instalar herramientas ni compilar Rust. La regeneración manual está descrita
en [el módulo](../../crates/state-controls/README.md).

## Funciones y datos

- Creatividad y Estilo empático mantienen sus conexiones con la próxima
  generación local de Gemma/Ollama. Los otros seis controles siguen bloqueados.
  Los proveedores no compatibles y los envíos en curso mantienen sus restricciones.
- Cada acción del renderer se valida de nuevo contra el estado actual:
  identificador, campos, tipo, valor finito, intervalo y disponibilidad. Un evento
  atrasado no puede modificar un control que acaba de bloquearse.
- La fila utiliza categoría, título, puntuación/rango, fuente y fase de recuperación
  reales. No rellena el vacío con el test de personalidad ni con 0,503. Mantiene
  la distinción entre preparación y contexto proporcionado, y oculta atribuciones
  completas para un recibo limitado, un fallo o un registro retirado.
- Se separó `retrieved-memory` de `state-memory`: seleccionar la señal Actividad
  de memoria abre su métrica; seleccionar la fila abre el recuerdo y su fuente.
- Se repararon las declaraciones `const` que impedían compilar `brain.ts`.
  Se conservaron las señales técnicas derivadas del incremento local, retirando
  el valor fijo de confianza sin recuperación y evitando tratar un rango como
  puntuación. Estos índices siguen siendo heurísticas, sin calibración psicológica
  ni demostración de emoción, autonomía o conciencia.

El icono conserva el acabado industrial e incorpora dos faders de sesión
destacados, seis controles bloqueados y la franja de memoria. Su generador SVG
y el catálogo semántico se actualizaron juntos. El rediseño se renderizó y revisó
en una vista PNG aislada, guardada en `local/dioxus-build/icon-preview/state.png`.

## Validación

| Comprobación | Resultado |
|---|---|
| Suite frontend completa | 863 aprobadas, 2 omitidas |
| Sincronización Obsidian | 15 aprobadas |
| Respaldo y restauración | 20 aprobadas, incluida recuperación de fuentes experimentales ignoradas por Git |
| Contrato Rust del renderer | 2 aprobadas |
| Rustfmt y Clippy del renderer para WASM | Compilación y Clippy con `-D warnings` aprobados |
| Compilación TypeScript/Vite | Aprobada; permanece el aviso conocido de chunks grandes |
| Contratos de iconos tras actualizar Estado | 172 aprobadas |
| Exclusión de contenido privado del índice y archivos futuros | 2 aprobadas |

Los logs privados se guardan en `local/dioxus-build/`. La compilación usa herramientas
ya disponibles en D:, sin instalaciones globales ni descarga de modelos.

En Tauri se observó el renderer Dioxus, conservando paneles y contenido. Se
comprobaron los ocho rangos, dos editables y seis bloqueados, un cambio por teclado,
la actualización de ambos ajustes y sus descripciones, y la restauración de los
valores iniciales de la sesión (0,20 y 0,50). También se comprobaron los inspectores
separados y la navegación de ida y vuelta sin duplicar controles.

Una consulta temporal de matemáticas recuperó tres coincidencias reales y las
mostró en el renderer Rust con categoría semántica y score léxico sin normalizar.
El inspector mostró su fase de preparación y procedencia. Se restauró el borrador
vacío, sin enviarlo al modelo, encender el micrófono ni guardar un recuerdo de prueba.

Esta revisión no repite la aceptación acústica de R9, no certifica un nuevo turno
de generación ni valida todas las ventanas y resoluciones. Las otras páginas y
la persistencia/grafos de R6/R8 siguen fuera de este incremento.
El incremento posterior trasladó a Rust la selección, el inspector, la presentación
de recuerdos y la validación de controles. La comprobación visual y funcional en
Tauri sigue pendiente; el puente de estado compartido permanece en React.

## Git y recuperación

En `origin/master` no había archivos de la bóveda `data/obsidian/`; lo publicado
eran scripts y documentación de la integración. Ahora de esa carpeta sólo se
versiona `.gitkeep`. Notas, recuerdos, proyección y configuración local de Obsidian
siguen ignorados. El código de sincronización permanece publicable.

Se retiraron del índice las 23 fuentes de `experiments/` y se ignora la carpeta
completa. Los archivos locales se conservaron. Los respaldos privados incluyen
sus fuentes sin los entornos, cachés, salidas de compilación o grabaciones excluidos.
Los enlaces públicos se ajustaron para no apuntar a documentación privada.
Esta retirada de la versión actual no reescribe commits publicados anteriormente.

Respaldo previo creado y verificado en D:
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-14T05-45-44-002Z-d749d19c-50d3-40cb-910f-9f64ee0522c0`.
Los datos privados y el documento original del propietario no se incluyen en Git.
