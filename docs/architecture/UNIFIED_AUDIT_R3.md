# Auditoría unificada y diagnóstico R3

Versión del contrato: 1  
Estado: primer incremento implementado  
Fecha: 2026-08-09

## Objetivo

R3 aporta evidencia local para responder qué operación ocurrió, de dónde provino, qué capacidad involucró, qué etapa alcanzó y cuál fue su resultado. La auditoría no representa conciencia ni actividad neuronal biológica: es telemetría técnica verificable para alimentar Actividad y, posteriormente, el volumen neuronal.

## Sobre de evento v1

Cada línea de `data/audit/events-v1.jsonl` es un objeto JSON independiente con estos campos cerrados:

| Campo | Regla |
|---|---|
| `schemaVersion` | entero fijo `1` |
| `eventId` | UUID v4 canónico y único |
| `operationId` | UUID v4 compartido por eventos correlacionados |
| `timestampMs` | tiempo Unix positivo en milisegundos |
| `source` | `system`, `permission`, `capability`, `memory` o `cloud` |
| `capabilityId` | identificador canónico opcional del registro R1 |
| `operation` | identificador ASCII de la operación, máximo 96 caracteres |
| `stage` | `request`, `authorization`, `execution`, `stop`, `revocation`, `block` o `error` |
| `decision` | `allow`, `deny`, `cancel` o `null` |
| `outcome` | `pending`, `success`, `blocked` o `error` |
| `durationMs` | duración opcional, limitada a 24 horas |
| `subjectDigest` | SHA-256 opcional; nunca el contenido original |
| `reasonCode` | código cerrado en mayúsculas, máximo 64 caracteres |

La deserialización rechaza campos desconocidos. Por diseño no existen propiedades libres como `message`, `payload`, `parameters`, `prompt`, `image`, `audio`, `secret` o `apiKey`.

## Persistencia y crecimiento

- El archivo actual tiene un límite de 5 MiB.
- Al excederlo, el archivo actual pasa a `events-v1.previous.jsonl`.
- Solo se conserva una rotación anterior; el máximo nominal es aproximadamente 10 MiB.
- Actividad lee como máximo los 200 eventos válidos más recientes del archivo actual.
- La lectura no crea carpetas ni archivos cuando todavía no existe auditoría.
- La rotación nunca incluye señal cruda; descarta únicamente telemetría técnica antigua según esta política documentada.

## Primer productor real

Al iniciar el proceso nativo, Alice registra `process.startup` como etapa `execution`, resultado `success` y razón `PROCESS_STARTED`. Si el disco no permite escribir, Alice continúa arrancando y deja el fallo en stderr; los productores sensibles posteriores definirán explícitamente si deben fallar de forma cerrada.

## Interfaz

Actividad incorpora `[08] NATIVE AUDIT R3`. La vista es de solo lectura, muestra integridad, tamaño, rotación, líneas inválidas, origen, etapa, resultado y prefijo del identificador de correlación. Limpiar los eventos temporales de React no elimina la auditoría nativa.

## Próximos productores

1. Solicitud, decisión, ejecución, detención y revocación del Gateway R2.
2. Escrituras, respaldos, restauraciones y exportaciones de memoria.
3. Previsualización y resultado de nube sin texto ni credenciales.
4. Diagnóstico pasivo de rutas, versiones, proveedores y adaptadores.

El volumen neuronal solo aumentará su actividad cuando estos productores entreguen eventos reales. No se fabricarán nodos, pulsos o porcentajes para aparentar vida.
