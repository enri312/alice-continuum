# Revisión de la exportación Dioxus de Google AI Studio

Fecha local: 14 de noviembre de 2026. Alcance: revisión y selección de una primera
pantalla; no integración del código exportado en la aplicación principal.

## Fuente y aislamiento

Se revisó la carpeta `Descargas/alice-continuum` indicada por el propietario.
Sus 818 archivos coinciden, por SHA-256, con la copia extraída del ZIP recibido.
El ZIP tiene 917 entradas, incluidos directorios, y su SHA-256 es
`ad81317d21c4f9fc3597f1a5dc5d48758c777caeb6c36a15ac8eafbb509d7bbb`.

La copia de revisión permanece en
`local/experiments/ai-studio-20261113/source/`, fuera de Git, en D:.
Se validaron las rutas del archivo antes de extraerlo. No se instaló software,
no se ejecutaron sus scripts de arranque, no se copiaron datos privados del
principal a la exportación y no se inició otra aplicación Tauri.

## Diseño: se puede conservar

Los estilos `base.css` e `industrial-theme.css` coinciden con el principal.
También coincide `conversation-vision.css` al normalizar finales de línea.
De los 12 archivos de estilos compartidos, 11 coinciden en contenido normalizado;
el cambio real se concentra en `interaction-affordance.css`. Los 29 archivos
compartidos comprobados de `icons/` y `public/` son idénticos por SHA-256.

Esto permite conservar la paleta, las superficies y los iconos existentes.
No demuestra equivalencia visual: cambiar el árbol de componentes, las clases,
los márgenes o el montaje puede modificar la presentación aun usando el mismo CSS.
La exportación adapta el bloque de Estado con `.alice-state-console`, dos columnas,
una fila compacta de memoria y deslizadores. Debe trasladarse por componente,
manteniendo los estilos del principal como referencia.

## Hallazgos que impiden reemplazar el proyecto completo

Las rutas siguientes son relativas a la exportación.

| Hallazgo | Evidencia | Consecuencia para la primera migración |
|---|---|---|
| Los deslizadores cambian un estado local, pero Estado no recibe sus acciones en React. | `src/pages/cognitive/StateControlsPage.tsx:13` monta `DioxusPageHost` sin `onAction`; `crates/dioxus-state-page/src/state_controls.rs:332-346` cambia `control_overrides` y emite `setBehaviorControl`. | Conectar únicamente Creatividad y Estilo empático al estado de sesión existente. Mover el control debe producir el mismo próximo envío que la pantalla actual. |
| Se presentan todos los controles como disponibles. | `src/core/cognitive/dioxus-state-bridge.ts:231` asigna `locked: false`; el rango de Rust no aplica `disabled` según disponibilidad. | Conservar los bloqueos y permisos actuales. Un deslizador de Autonomía editable en la vista no demuestra que R2 haya concedido una capacidad. |
| La memoria incorpora un ejemplo fijo y una puntuación que no proviene de recuperación. | `dioxus-state-bridge.ts:43-46,235-245` fuerza EPISÓDICA, utiliza el título del test al faltar datos y toma el score de la métrica de actividad de memoria. | Consumir `RetrievedMemoryView`, con categoría, origen, puntuación/rango y fase reales. Un cero válido no debe reemplazarse por un valor de muestra. |
| Varias señales sustituyen el cero por un preset. | `dioxus-state-bridge.ts:203-218` usa el valor real sólo cuando es mayor que cero y marca las señales como `ready`. | Conservar cero, disponibilidad y significado de cada señal; no convertir parámetros visuales en evidencia de una capacidad. |
| El montaje no ofrece una recuperación de la pantalla actual por defecto. | `src/dioxus/DioxusPageHost.tsx:67,104` marca el montaje tras llamar a WASM; el contenido alternativo es opcional y Estado no lo proporciona. | Mantener la pantalla React disponible ante errores de carga o montaje y comprobar navegación repetida, actualizaciones y desmontaje. |
| El arranque del paquete no coincide con Tauri. | `vite.config.ts:39-41` sirve en `0.0.0.0:3000` y acepta cualquier host; `src-tauri/tauri.conf.json:8` espera `localhost:5173`. | Conservar la configuración local y el lanzador del principal. No copiar la configuración de AI Studio como configuración de escritorio. |

La exportación usa React como aplicación contenedora y Dioxus-Web/WASM para
renderizar páginas; mantiene puentes TypeScript hacia Tauri. No es una sustitución
completa de React ni requiere migrar el almacenamiento para probar una pantalla.
Su crate declara Dioxus 0.6, mientras el piloto local utiliza 0.7.0. La primera
integración deberá fijar una sola combinación compatible de dependencias y
herramientas y comprobar el WASM generado desde sus fuentes.

En los archivos nativos compartidos hay 126 coincidencias y 13 diferencias,
incluidos `cloud.rs`, `lib.rs`, voz y módulos de memoria. La propuesta visual
no justifica reemplazar esos módulos ni perder contratos recientes. Esta revisión
no certifica todas las acciones de Memoria, Gobierno, voz o R9 de la exportación.

## Primera página recomendada

**Estado y controles**, limitada a su renderizado. Ya existe una referencia visual
y un contrato funcional en el principal, y fue la pantalla elegida para el piloto.

1. Mantener el CSS, los iconos, la navegación y el backend actuales. Preparar el
   renderer Dioxus de esta página con un puente tipado; no incorporar las demás
   pantallas, los scripts de arranque ni una migración de datos.
2. Enviar el snapshot actual a Dioxus y devolver acciones validadas para los dos
   ajustes implementados. El estado autorizado sigue perteneciendo a la aplicación;
   los rangos bloqueados, los proveedores no compatibles y los envíos en curso
   mantienen sus restricciones.
3. Conservar la fila compacta de categoría, contenido y puntuación. Mantener sus
   detalles en el inspector y distinguir coincidencia preparada, contexto enviado,
   respuesta, contexto limitado, fallo y ausencia de recuperación.
4. Comparar ambas vistas con los mismos datos y anchos: escritorio, ventana
   estrecha, títulos largos, vacío y error. Comprobar teclado, foco, bloqueo,
   navegación repetida y una conversación real antes de ampliar a otra página.

Las pantallas de Memoria y Gobierno quedan para después: tienen acciones sobre
datos, permisos y ciclos de revisión que requieren una comprobación propia.
La propuesta de persistencia y grafos R6/R8 sigue aplazada.

## Comprobaciones y estado del principal

La comprobación de TypeScript de la exportación pasó con `--noEmit` e
`--incremental false`, usando las herramientas ya instaladas del proyecto.
No se recompiló Rust/WASM ni se hizo aceptación visual o nativa de esa exportación.
La presencia de un binario WASM en el paquete no sustituye esas comprobaciones.
Log privado: `local/experiments/ai-studio-20261113/export-typecheck.log`.

Durante la revisión aparecieron cambios locales en cinco archivos del principal,
que se conservaron sin modificarlos ni incluirlos en el commit de documentación.
La comprobación de TypeScript actual detectó errores de sintaxis en
`src/core/cognitive/brain.ts:145-151`: hay declaraciones `const` dentro del objeto
retornado. Este bloqueo debe resolverse antes de usar la compilación del principal
como referencia para migrar. Log privado: `main-typecheck.log` en la misma carpeta.

Los cambios locales de `RetrievedMemory.tsx` también incorporan una fila de
ejemplo como fallback. Al conectar la recuperación se debe distinguir esa muestra
de los recuerdos reales elegidos previamente por el propietario. Esta revisión
no revierte esos cambios ni los atribuye a la migración todavía no integrada.

El ajuste compacto anterior de la fila y su inspector quedó guardado y publicado
en `47f56d2`, con README, roadmap, 20 pruebas dirigidas y revisión Tauri. Su respaldo
posterior se creó y verificó en D:; los cambios locales descritos son posteriores
a ese cierre y requieren su propia validación.
