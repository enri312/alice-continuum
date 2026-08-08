# ADR-P-031 — Cámara interactiva del volumen neuronal

Fecha: 2026-08-07  
Estado: aceptada

## Contexto

El volumen neuronal es una representación tridimensional y densa. Una vista automática fija no permite inspeccionar zonas ocultas, separar grupos visuales ni acercarse a los nodos en un monitor convencional.

## Decisión

La vista mantiene una cámara local independiente de los datos cognitivos. Permite:

- girar mediante arrastre;
- mover mediante modo explícito, `Shift` + arrastre o botón central;
- acercar y alejar con rueda, botones o teclas `+` y `-`;
- restablecer con botón, doble clic o tecla `0`;
- usar flechas para girar y `Shift` + flechas para mover.

El zoom se limita entre 55% y 300%, la inclinación y el desplazamiento también se limitan, y los controles tienen nombres accesibles y tooltips. Con `prefers-reduced-motion: reduce`, se detienen autorrotación y pulsos, pero la manipulación directa continúa disponible.

## Consecuencias

- La cámara solo modifica la presentación; no altera recuerdos, densidad, consolidación ni asociaciones.
- El volumen no contiene un núcleo, foco o rótulo central artificial; los hemisferios se conectan directamente mediante aristas neuronales.
- Los puntos forman dos volúmenes orgánicos compactos. Las conexiones internas priorizan vecinos cercanos y las conexiones entre hemisferios se concentran en la zona de unión; se evitan las mallas rectangulares y los trazos largos arbitrarios.
- La vista de volumen no repite los módulos como una fila de filtros; su inspección detallada corresponde a la vista Flujo cognitivo.
- Los SVG de cámara permanecen como fuentes versionadas dentro de `icons/`.
- Restablecer siempre devuelve zoom 100%, giro e inclinación neutros y desplazamiento cero.
