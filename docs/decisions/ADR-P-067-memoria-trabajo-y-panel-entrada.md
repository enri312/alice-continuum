# ADR-P-067 — Memoria de trabajo efímera y panel de entrada único

Fecha: 2026-08-14  
Estado: aceptada

Nota 2026-08-20: ADR-P-080 amplía los límites operativos de RAM y activa historial/RAG por defecto exclusivamente para Ollama. La separación entre RAM y recuerdo duradero establecida aquí permanece vigente.

Nota 2026-09-04: ADR-P-091 conserva la RAM efímera pero añade un historial local
durable separado. Por tanto, la afirmación de que cerrar Alice descarta toda la
conversación ya no está vigente; sigue vigente que el diálogo no se promueve
automáticamente a recuerdo R6.

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
- Memoria expone estado, TTL, presupuesto y vaciado como subpestaña interna; no se convierte en una octava pantalla del cerebro.
- La previsualización muestra el presupuesto exacto por fragmento en caracteres Unicode y bytes UTF-8; no confunde esas magnitudes con tokens del proveedor.
