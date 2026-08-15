# ADR-P-070 — Volumen neural compacto y evolutivo

Fecha: 2026-08-15  
Estado: aceptada

## Contexto

La nube cognitivo-afectiva de ADR-P-046 distribuía puntos por todo el lienzo y asignaba a cada nodo uno de los diez colores afectivos aunque todos los canales permanecieran planificados y en `0.00`. Con poca estructura real, el resultado parecía una red extensa pero vacía y podía confundir paleta reservada con emoción activa.

## Decisión

- El volumen crece de forma determinista desde el centro hacia dos lóbulos y una zona de asociación.
- Cada recuerdo persistente aporta como máximo un ancla visible, hasta la capacidad gráfica; el contador mostrado conserva el total real.
- La señal R3 reciente forma un racimo temporal y pulsante, pero no crea anclas ni aumenta `persistentNeuralDensity`.
- La envolvente punteada representa el espacio de visualización, no nodos aprendidos.
- Sin afecto activo, la estructura inactiva usa acero; los pulsos técnicos usan cian, turquesa o ámbar según su función.
- Un color de la paleta afectiva sólo puede entrar al volumen cuando el canal está `ready` y su valor es mayor que cero.
- Los controles reales de giro, desplazamiento, zoom y restablecimiento se conservan.

## Consecuencias

- Una Alice con pocos recuerdos se ve como una semilla compacta y no como un cerebro maduro.
- Una actividad reciente puede verse y decaer sin confundirse con aprendizaje.
- Los diez canales afectivos permanecen visibles como contrato, pero apagados y compactos mientras no exista un motor real.
- La geometría, el conteo de anclas y la selección cromática tienen reglas puras cubiertas por pruebas TypeScript.

## Relación con ADR-P-046

Esta decisión conserva la paleta y el principio de actividad honesta de ADR-P-046, pero reemplaza la regla visual “color = circuito”: desde ahora el color afectivo significa exclusivamente una señal afectiva disponible y positiva.
