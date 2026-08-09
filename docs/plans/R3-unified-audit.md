# Plan de implementación R3 — Auditoría unificada y diagnóstico

Estado: en curso; incrementos 1 y 2 implementados  
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

## Incremento 3 — Memoria y nube

- Sustituir gradualmente auditorías aisladas por eventos R3 o mantener compatibilidad explícita.
- Correlacionar previsualización y resultado sin texto completo.
- Mantener huellas solo cuando aporten integridad verificable.

## Incremento 4 — Diagnóstico pasivo

- Revisar rutas, versiones de datos, proveedores configurados, adaptadores y permisos.
- No abrir dispositivos, no enviar red y no corregir automáticamente.
- Mostrar diferencia entre indisponibilidad, configuración pendiente y fallo real.

## Incremento 5 — Actividad del núcleo

- Derivar intensidad, regiones y enlaces del volumen desde eventos R3 y estado real.
- Mantener señal efímera separada de memoria persistente.
- Etiquetar cualquier inferencia o heurística; nunca presentarla como observación directa.

## Puertas obligatorias

- Pruebas Rust y TypeScript completas.
- `fmt`, `clippy`, build web y build Tauri.
- Prueba real del ejecutable que produzca y lea un evento de inicio.
- Verificación de cero contenido privado, secretos y medios nuevos en Git.
- Memoria y avatar preservados.
