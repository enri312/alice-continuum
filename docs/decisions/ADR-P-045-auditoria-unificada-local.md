# ADR-P-045 — Auditoría unificada local, mínima y acotada

Fecha: 2026-08-09  
Estado: aceptada para R3

## Contexto

Alice posee auditorías separadas para memoria y nube y eventos temporales en React. El Gateway R2 ya persistía su secuencia correlacionada; el incremento 3 incorporó memoria y nube sin borrar el historial ni romper compatibilidad. Sin esta fuente sería fácil confundir animación con evidencia real.

## Decisión

- Adoptar un sobre JSONL versionado y cerrado para los nuevos eventos R3.
- Usar UUID v4 de evento y operación para correlacionar etapas sin copiar parámetros privados.
- Registrar solo metadatos tipados, duraciones y huellas SHA-256 cuando sean necesarias.
- Rechazar campos desconocidos y combinaciones incoherentes de etapa y resultado.
- Limitar el archivo actual a 5 MiB y conservar una sola rotación anterior.
- Mantener la vista Actividad como lectora: no podrá editar ni borrar la evidencia persistente.
- Registrar primero el inicio real del proceso y migrar los demás productores uno por uno.
- Mantener escritura dual para memoria y nube durante R3; no transformar ni eliminar auditorías históricas.
- Exigir el evento inicial antes de una mutación de memoria o solicitud de red. Un fallo posterior de telemetría no repite ni revierte automáticamente un efecto ya completado.
- Alimentar las visualizaciones cognitivas únicamente con eventos verificables.

## Consecuencias positivas

- La actividad visible puede rastrearse hasta un archivo local concreto.
- Solicitud, autorización, ejecución, bloqueo y error tendrán semántica común.
- La telemetría no necesita mensajes, audio, imágenes, claves o planes privados.
- El crecimiento queda limitado y documentado desde el primer incremento.

## Costos y límites

- `process.startup`, el Gateway R2, memoria y nube producen eventos R3; diagnóstico continúa pendiente.
- Las auditorías históricas de memoria y nube no se reescriben ni migran automáticamente.
- Una sola rotación prioriza el uso acotado de disco sobre retención indefinida.
- La actividad observable no prueba conciencia ni reemplaza las pruebas funcionales.

## Alternativas descartadas

### Animar el volumen neuronal con valores aleatorios

Se descarta porque aparentaría actividad no producida por el sistema.

### Guardar payloads completos para facilitar depuración

Se descarta porque mezclaría recuerdos, conversaciones o parámetros privados con telemetría.

### Mantener auditorías sin límite

Se descarta por el espacio reducido de los discos internos y porque no existe una necesidad aprobada de retención indefinida.
