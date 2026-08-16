# ADR-P-073 — Catálogo de expresiones VRM antes del puente facial

**Estado:** aceptada  
**Fecha:** 2026-08-16  
**Ámbito:** visor Avatar, preparación R9 y futuro puente facial.

## Contexto

El VRM privado de Alice ya declara expresiones propias, pero no era visible cuáles son ni si existe un
destino compatible para los 52 blendshapes que eventualmente entregue el detector facial. Inventar
una lista de expresiones, pesos o mapeos habría presentado una capacidad inexistente.

## Decisión

El visor obtiene los nombres directamente de `vrm.expressionManager.expressions` una vez que carga el
archivo local y los muestra como un catálogo de solo lectura. La normalización conserva el orden del
VRM, elimina duplicados y rechaza nombres vacíos, de control o excesivamente largos.

El catálogo no asigna pesos, no aplica expresiones, no toca huesos, no escribe el VRM y no recibe
landmarks de cámara. Es evidencia del destino disponible, no un puente de salida ni un retargeter.

## Consecuencias

El futuro adaptador facial deberá proponerse contra estos nombres reales, con una tabla de mapeo
visible y confirmada. Si el avatar cambia, el catálogo se vuelve a leer desde el archivo cargado; no
se conserva una copia en memoria duradera ni en Git.

