# ADR-P-037 — Iconos de Actividad y Núcleo

Fecha: 2026-08-08  
Estado: aceptada e implementada

## Contexto

Los iconos de navegación deben resumir la responsabilidad real de cada pantalla y conservar una silueta reconocible en los 52 píxeles disponibles. El icono anterior de Actividad parecía un monitor de auditoría genérico; el de Núcleo mostraba un centro abstracto, pero no explicaba bien la arquitectura actual de Alice.

## Decisión

- **Actividad** se representa como una línea temporal vertical con cinco etapas: entrada, memoria, llamada autorizada, salida y control. El reloj expresa secuencia temporal y el escudo identifica los límites de seguridad.
- **Núcleo** se representa mediante dos hemisferios conectados: cian para entrada y memoria local, ámbar para procesamiento y salida, y violeta para el centro de identidad de Alice.
- Ambos iconos mantienen marco HUD industrial, alto contraste, detalles vectoriales y animación moderada compatible con `prefers-reduced-motion`.
- Los textos pequeños son detalles secundarios; la línea temporal, el cerebro bipartito y el núcleo deben seguir siendo distinguibles sin ellos.
- Los SVG continúan empaquetados como texto confiable por Vite y conservan las etiquetas y tooltips accesibles de la navegación.

## Criterios de aceptación

1. Actividad no se confunde con una pantalla o ventana genérica.
2. Núcleo muestra dos hemisferios y un centro de identidad claramente diferenciados.
3. Ambos se reconocen a 52 × 52 píxeles.
4. Ningún icono afirma conciencia, emoción real o actividad inexistente.
5. La compilación frontend integra los SVG sin solicitudes externas.
