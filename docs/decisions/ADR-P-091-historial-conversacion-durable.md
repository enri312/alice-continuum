# ADR-P-091 — Historial local durable de conversación

Estado: aceptada · 2026-09-04

## Contexto

La memoria de trabajo R6.2 mantiene como máximo seis intercambios en RAM durante dos
horas. Esa ventana sirve para el razonamiento inmediato, pero al cerrar Alice el
diálogo desaparecía y el propietario no podía continuar una conversación real.
Persistir el diálogo directamente como recuerdo R6 también sería incorrecto: una
respuesta de un modelo no es por sí sola un hecho ni una experiencia consolidada.

## Decisión

Alice conserva cada intercambio exitoso en
`data/conversation/history-v1.json`. El documento usa esquema cerrado, UUID v4,
fechas ISO-8601, límite de 8 MiB y hasta 1.000 intercambios. La escritura se realiza
mediante reemplazo atómico y se audita con SHA-256 sin copiar el texto a R3.
El `responseId` del proveedor actúa como clave idempotente: repetir exactamente la
misma respuesta no crea otra entrada y reutilizar el ID con contenido diferente se
bloquea.

El historial se recupera al iniciar y permite seleccionar hasta diez mensajes
recientes para una consulta. Paralelamente, la RAM conserva su límite y TTL. Limpiar
RAM no borra el historial. `automaticMemoryPromotion=false` forma parte del contrato:
crear recuerdos, preferencias o procedimientos exige otro flujo revisable.

## Consecuencias

- Una conversación continúa después de reiniciar Alice.
- El historial completo no se envía automáticamente a ningún modelo.
- Un archivo corrupto bloquea nuevos anexos y se conserva sin reparación silenciosa.
- Alcanzar el límite bloquea la escritura; no se eliminan diálogos antiguos en
  silencio.
- ADR-P-067 conserva su decisión sobre RAM efímera, pero queda reemplazado en su
  afirmación de que no existe persistencia de conversación.
