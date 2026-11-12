# Colores coherentes y revisión nativa del Volumen

Fecha: 2026-11-11. Proyecto: `D:\Alice Continuum`.

## Corrección

El color por tipo de la guía coincidía con su paleta, pero el renderer lo
reemplazaba al recuperar, archivar o dejar pendiente un recuerdo. El mismo
ámbar podía significar procedimiento o ejercicio sin aprobar; el blanco ocultaba
el tipo al recuperar. La guía no explicaba esas sustituciones.

El relleno ahora conserva el tipo o la asociación emocional confirmada y vigente.
Los estados usan contornos y trazos; recuperación, selección y puntero añaden un
anillo blanco separado. La atenuación de archivos, supresiones y reposo se conserva.
La ficha explica el tono, la mezcla y los estados que coexisten. Una evaluación
conservada pero no aplicable se identifica sin ocultar su evidencia.

`memoryLayerLegend`, `memoryVisualStates` y `resolveCognitiveMemoryAppearance`
alimentan canvas, guía y ficha. La guía plegable explica seis tipos, diez afectos,
ocho estados y el anillo de recuperación. No ocupa el lienzo. Se preservan la
paleta afectiva y la mezcla ponderada existentes; no se asignan emociones nuevas.

## Acceso a la aplicación nativa: pendiente resuelto

La API anterior de automatización siguió devolviendo
`Computer Use native pipe is unavailable` (`os error 2`), incluso tras reintentar
y reiniciar su sesión. El fallo ocurre antes de seleccionar Alice: no pertenece
a sus permisos de eventos, fuentes de aprendizaje ni código de Tauri.

La API compatible `cua_repl` sí permitió obtener el inventario de Windows. Alice
estaba cerrada; se inició mediante **Iniciar Alice Continuum.cmd** y se seleccionó
la ventana devuelta de `.cargo-target/debug/alice-continuum.exe`. Su acción
**Raise** permitió mostrar el contenido y continuar la inspección.

Se comprobaron en Tauri real:

- La página del Volumen, los conocimientos guardados y los cambios observados
  desde su lectura inicial, incluida una incorporación y actualizaciones del
  ciclo normal de autoestudio.
- El estado de las fuentes nativas, la fase registrada y las fechas de lectura.
- La guía actualizada, sus colores emocionales, tipos, contornos y recuperación.
- **Actualizar lectura**: las fechas avanzaron y los contadores de conocimiento
  permanecieron iguales durante esa acción de consulta.

No se enviaron mensajes artificiales, no se editaron recuerdos ni se atribuyeron
emociones para producir ejemplos. Las capturas y los textos personales de la
ventana no se añadieron al repositorio. El lanzamiento ejecutó el ciclo normal
ya autorizado; no se inició otro ciclo desde un control del Volumen.

Queda cerrado el pendiente de acceso a la ventana y revisión visual del Volumen.
Esto no sustituye la aceptación personal completa de Memoria, recuperación
conversacional, continuidad y proyección de Obsidian tras otro reinicio, ni voz.

## Validación automatizada

| Comprobación | Resultado |
|---|---|
| Vitest completo | 700 aprobadas; 2 sondas opcionales omitidas |
| Obsidian y respaldos | 15 y 20 aprobadas con datos aislados |
| TypeScript y compilación frontend | Aprobados; aviso conocido de paquetes grandes |
| Interfaz aislada | 26 comprobaciones aprobadas; 0 errores de página o consola |
| Ventanas | 1440, 1000 y 420 px |

Las nuevas regresiones verifican el color semántico de estudios pendientes, el
relleno conservado al recuperar, alegría, mezcla emocional, conflicto separado
de ira y retirada de una evaluación al versionar el recuerdo. Las comprobaciones
de interfaz comparan también las definiciones de la guía y los colores que usa
el canvas, sin modificar datos ni código de la aplicación personal.
La guía usa dos columnas a 1440 y 1000 px, y una a 420 px, sin desborde.
El navegador de prueba, servidor y caché temporal se cerraron al finalizar.

Artefactos sintéticos y runner: `local/artifacts/volume-colours-20261111/` y
`scripts/testing/.fixtures/volume-colours-20261111/`, ignorados por Git. No se
repitió Rust porque no cambió el backend.

Antes de editar se archivó el código versionado en
`local/backups/volume-colours-20261111/source-before.zip`, SHA-256
`C4321DF749D236B2E6D444CDB0CCE876F0CEDC6337D1E9B588477CEEC76F4E18`.
Es un respaldo del código anterior, no una copia de modelos o recuerdos privados.

[Decisión](../decisions/ADR-P-117-colores-y-marcas-del-volumen.md) ·
[Guía](../MANUAL_DE_USO.md#volumen-cognitivo).
