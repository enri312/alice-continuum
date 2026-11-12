# ADR-P-117 — Colores y marcas del Volumen

Fecha: 2026-11-11. Estado: implementado y revisado en Tauri.

## Problema

El relleno de un nodo cambiaba por tipo, estado, recuperación o asociación
emocional. Un estudio semántico pendiente podía parecer procedimental por ser
ámbar; recuperar un recuerdo lo volvía blanco. La leyenda sólo explicaba tipos.

## Decisión

El relleno representa una asociación emocional confirmada y vigente, o el tipo
de memoria cuando no existe esa evaluación. Se conservan la paleta de diez
emociones y la mezcla ponderada de sus intensidades. La ficha identifica la
mezcla; una versión nueva sin evaluación vigente vuelve al color de su tipo.

Los estados se representan mediante contorno, trazo y atenuación. La prioridad
es conflicto, eliminación programada, archivo, supresión, retirada del contexto,
ejercicio pendiente, reposo y registro histórico. La ficha muestra todos los
estados que coexisten. Recuperación, selección y puntero añaden un anillo blanco
exterior sin sustituir el relleno.

`resolveCognitiveMemoryAppearance` resuelve el aspecto de cada recuerdo.
`memoryLayerLegend` y `memoryVisualStates` son las definiciones compartidas por
canvas, guía y ficha. Los procesos conservan sus rombos y codificación anterior.
La guía permanece plegable y fuera del lienzo.

No se asignan emociones automáticamente, no cambia la importancia registrada,
la recuperación, los estados persistidos, las asociaciones ni los filtros RAG.

## Revisión nativa

El canal de automatización anterior siguió fallando antes de seleccionar una
ventana. La conexión compatible de Computer Use sí permitió abrir Alice desde
el lanzador normal, seleccionar su ventana Tauri y revisar el Volumen actualizado.
La guía y la actualización de lecturas se comprobaron en la aplicación real.
Esto cierra el pendiente de acceso a la ventana y esa revisión visual; no acredita
por sí solo voz, recuperación conversacional o sincronización tras otro reinicio.

[Resultados y alcance](../testing/COGNITIVE_VOLUME_COLOURS_REPORT_2026-11-11.md) ·
[Guía](../MANUAL_DE_USO.md#volumen-cognitivo).
