# Plan de implementación R3 — Auditoría unificada y diagnóstico

Estado: completado; incrementos 1 a 5 implementados  
Fecha: 2026-08-09

## Objetivo

Crear una fuente persistente, privada y correlacionada para la actividad real de Alice antes de aumentar la complejidad del volumen neuronal o habilitar aprendizaje sensorial.

## Incremento 1 — Contrato, almacenamiento y lectura ✅

- Esquema nativo v1 con campos cerrados y validación defensiva.
- JSONL local con 5 MiB actuales y una rotación anterior.
- Evento real de inicio del proceso.
- Snapshot nativo de solo lectura y vista `[08] NATIVE AUDIT R3`.
- Parser TypeScript defensivo y estados vacíos honestos.

## Incremento 2 — Gateway R2 ✅

- Emitir solicitud, autorización, ejecución, detención, revocación, bloqueo y error.
- Compartir un `operationId` por flujo completo.
- No guardar propósito, parámetros, nombres de ventana ni señal sensorial.
- Definir rollback o fail-closed cuando la evidencia de una acción sensible no pueda escribirse.

Implementado con UUID v4 interno estable por solicitud, digest de previsualización y política diferenciada: iniciar acceso falla de forma cerrada; detener, revocar o vencer nunca se revierte aunque falle la telemetría.

## Incremento 3 — Memoria y nube ✅

- Sustituir gradualmente auditorías aisladas por eventos R3 o mantener compatibilidad explícita.
- Correlacionar previsualización y resultado sin texto completo.
- Mantener huellas solo cuando aporten integridad verificable.

Implementado mediante escritura dual compatible: `memory-events.jsonl` y `cloud-audit.jsonl` permanecen vigentes, mientras cada operación nueva emite también un flujo R3 mínimo. Guardar, exportar, restaurar y migrar memoria comparten un UUID v4 entre solicitud y resultado. Nube registra el digest del contexto aceptado antes de la red y el digest de la respuesta al finalizar; no registra proveedor, modelo, identificador externo, texto ni credencial. Si el evento inicial no puede escribirse, la mutación o solicitud no comienza.

## Incremento 4 — Diagnóstico pasivo ✅

- Revisar rutas, versiones de datos, proveedores configurados, adaptadores y permisos.
- No abrir dispositivos, no enviar red y no corregir automáticamente.
- Mostrar diferencia entre indisponibilidad, configuración pendiente y fallo real.

Implementado con un snapshot nativo v1 y la vista `[09] PASSIVE DIAGNOSTIC`. Clasifica 19 comprobaciones potenciales en rutas, versiones, proveedores, adaptadores y permisos. La ruta sensorial importa Python y sus dependencias con bytecode deshabilitado, sin abrir hardware. El Gateway usa una sonda nueva que no vence ni modifica solicitudes. Una prueba viva comparó SHA-256 de todos los archivos canónicos antes y después y confirmó cero cambios.

## Incremento 5 — Actividad del núcleo ✅

- Derivar intensidad, regiones y enlaces del volumen desde eventos R3 y estado real.
- Mantener señal efímera separada de memoria persistente.
- Etiquetar cualquier inferencia o heurística; nunca presentarla como observación directa.

Implementado mediante el snapshot nativo cerrado `core_activity_snapshot`, ampliado de forma compatible en frontend al método `r3-recency-motor-v2`. Solo considera los 200 eventos visibles del archivo actual y da señal a los eventos ocurridos en los últimos cinco minutos. La recencia, etapa y resultado determinan una intensidad acotada; siete regiones y cinco enlaces declaran su cantidad de evidencia. `Motor manual` no posee enlace cognitivo. El frontend vuelve a validar topología, conteos y ausencia de campos desconocidos antes de iluminar el volumen o el flujo.

La densidad persistente continúa dependiendo exclusivamente de recuerdos locales. Los eventos R3 solo producen señal efímera y nunca modifican memoria, auditoría, permisos o canales afectivos. Un archivo vacío, un evento antiguo o un snapshot no disponible mantienen la actividad en cero.

## Puertas obligatorias

- Pruebas Rust y TypeScript completas.
- `fmt`, `clippy`, build web y build Tauri.
- Prueba real del ejecutable que produzca y lea un evento de inicio.
- Verificación de cero contenido privado, secretos y medios nuevos en Git.
- Memoria y avatar preservados.
