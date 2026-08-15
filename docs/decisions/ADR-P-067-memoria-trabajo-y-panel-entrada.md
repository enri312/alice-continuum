# ADR-P-067 — Memoria de trabajo efímera y panel de entrada único

Fecha: 2026-08-14  
Estado: aceptada

## Contexto

La interfaz tenía una pantalla Conversación y un panel `[00] CONVERSATION / PERCEPTION INPUT` separado. Ambos representaban la misma entrada y alejaban el diagnóstico cognitivo de la referencia funcional. Al mismo tiempo, R6 necesitaba contexto reciente real sin convertir cada respuesta en memoria duradera.

## Decisión

La conversación se integra dentro de `[00]` y se elimina de las rutas cognitivas. Rust conserva como máximo tres intercambios reales en RAM, con presupuesto de 48.000 caracteres y vencimiento de 30 minutos. No hay precarga ficticia, persistencia, resumen automático ni promoción a recuerdo. R3 audita únicamente digests.

El panel `[05] FACE + BODY OUTPUT BRIDGE` pertenece a `Body Solver`. Los nodos `Face` y `Body` permanecen en el grafo cognitivo como destinos de decisiones, no como ejecutores mentales.

## Consecuencias

- Cognitive Core conserva una sola entrada visible.
- Cerrar Alice descarta la memoria de trabajo.
- Memoria duradera y RAM tienen fuentes, ciclos y controles distintos.
- El vaciado usa confirmación y control de concurrencia por generación.
- El siguiente incremento debe exponer estado y vaciado en Memoria sin convertirlo en una octava pantalla del cerebro.
