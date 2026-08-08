# ADR-P-034 — Refuerzo por recuperación autorizada

Fecha: 2026-08-08  
Estado: aceptada para implementación

## Contexto

Alice puede encontrar hasta tres recuerdos mediante recuperación lexical y Carlos Nuñez decide si se incluyen en la previsualización de una consulta. Hasta ahora, utilizarlos no dejaba ninguna evidencia persistente y la fuerza del recuerdo no distinguía entre una revisión manual y un uso efectivo durante conversación.

OpenClaw demuestra un principio útil: la continuidad del agente procede de memoria escrita en archivos y recuperada como contexto, no de un supuesto entrenamiento oculto del modelo. Alice aplicará ese principio con controles más estrictos: solo una enseñanza directa confirmada puede reforzarse, y únicamente después de una inclusión visible y autorizada.

## Decisión

- Capturar los identificadores exactos de las enseñanzas seleccionadas al construir la previsualización; esa lista queda congelada junto con la solicitud.
- Reforzar una enseñanza solamente si fue incluida, Carlos Nuñez autorizó el envío y el proveedor devolvió una respuesta correcta.
- Registrar por separado el **repaso manual** (`successfulReviews`, `correctionCount`, `lastReviewedAt`) y la **recuperación conversacional** (`successfulRecalls`, `failedRecalls`, `lastRecalledAt`).
- Un uso conversacional correcto incrementa `successfulRecalls`, actualiza `lastRecalledAt` y aumenta moderadamente `storageStrength` sin superar 100 %.
- No reforzar búsquedas meramente mostradas, recuerdos desmarcados, solicitudes canceladas ni llamadas fallidas.
- No consolidar conversaciones guardadas ni respuestas del proveedor como conocimiento. Solo se refuerzan registros de clase `Enseñanza` y estado confirmado.
- Mantener la lista de identificadores dentro de React/Tauri; el proveedor recibe el contenido autorizado, nunca los identificadores internos ni las métricas de consolidación.

## Consecuencias

- Las raíces visuales de Alice pueden crecer a partir de eventos verificables de uso, no de actividad decorativa.
- El mismo proveedor puede cambiar sin perder la memoria local ni su historial de uso.
- Una respuesta correcta del proveedor no certifica que el contenido recordado sea verdadero; la revisión de vigencia continúa bajo control de Carlos Nuñez.
- La búsqueda semántica y la extracción de nuevas enseñanzas siguen siendo fases posteriores.

## Criterios de aceptación

1. Preparar o cancelar una previsualización no modifica `records.json`.
2. Enviar sin marcar recuerdos no modifica métricas de recuperación.
3. Una llamada fallida no refuerza ningún recuerdo.
4. Una llamada correcta refuerza exactamente las enseñanzas autorizadas y ninguna otra.
5. Los identificadores internos no aparecen en el contenido enviado al proveedor.
6. Los registros antiguos continúan cargando con contadores nuevos en cero.

## Referencias

- OpenClaw, *Memory overview*: https://docs.openclaw.ai/concepts/memory
- OpenClaw, *Memory search*: https://docs.openclaw.ai/concepts/memory-search
