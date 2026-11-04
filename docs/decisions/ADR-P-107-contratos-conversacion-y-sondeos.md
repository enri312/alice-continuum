# ADR-P-107 — Contratos de conversación y sondeos serializados

Fecha: 2026-11-04. Estado: implementada y verificada.

## Contexto

La inspección del propietario identifica un monolito de escritorio parcialmente
modularizado, organizado por capas técnicas y áreas funcionales. La dirección de
dependencias no corresponde todavía a Clean Architecture estricta ni predomina
Vertical Slice. Se mejora por incrementos, conservando una aplicación Tauri.

`App.tsx` y Configuración importaban contratos de conversación desde una pantalla
React. Además, los intervalos de ventana y memoria de trabajo podían iniciar otra
consulta mientras la anterior seguía pendiente. El sondeo de ventana podía
aplicar un resultado después de finalizar su efecto React.

## Decisión

1. Mover los ocho tipos compartidos de conversación a
   `src/core/conversation/conversation-contracts.ts`. Pantallas y coordinación
   dependen de ese contrato; sus campos, nombres y formatos se conservan.
2. Introducir `src/core/shared/polling.ts`, independiente de React y Tauri. Cada
   suscripción consulta al iniciar y mantiene su intervalo, omitiendo ticks si
   una lectura sigue pendiente. Descartar la suscripción ignora resultados y
   errores tardíos y elimina el temporizador.
3. Usarlo para ventana autorizada (dos segundos) y memoria de trabajo (cinco
   segundos). Una lectura fallida puede recuperarse en el siguiente intervalo;
   el manejo de errores visible conserva las reglas existentes.
4. Descartar snapshots del sondeo de memoria cuya generación sea anterior a la
   ya aceptada por la interfaz, para que una lectura iniciada antes de un vaciado
   confirmado o de una respuesta no restaure su vista antigua.

La cancelación de la suscripción no aborta una llamada nativa ya iniciada. No se
inicia observación por defecto ni se cambian permisos, persistencia o modelos.
Este incremento no reduce el tiempo propio de generación Gemma o síntesis Fish.

## Verificación y continuación

Seis pruebas cubren cadencia, lectura lenta, cierre con respuesta/error pendiente,
recuperación y reemplazo de suscripción. Con una lectura pendiente diez segundos
y un intervalo de dos, se inicia una sola consulta durante ese periodo. La suite
completa pasa 563 pruebas, con dos sondas omitidas; TypeScript y Vite compilan.
El backend no cambia; la última validación Rust permanece en 321 aprobadas.

Se mantiene el monolito y la estructura funcional actual. La separación de casos
de uso y persistencia de `memory.rs`, y la extracción gradual de coordinación de
`App.tsx`, requieren incrementos posteriores con pruebas de sus propias reglas.
No se presenta esta extracción como una migración completa de arquitectura.
