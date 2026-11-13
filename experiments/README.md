# Pilotos independientes de Alice

Estos proyectos se ejecutan de forma explícita y separada de Alice Continuum.
No forman parte del lanzador, del build TypeScript/Tauri ni de sus dependencias.

| Piloto | Qué evalúa | Guía |
|---|---|---|
| Comparación ASR | Whisper actual frente a faster-whisper, con el mismo corpus sintético local y mediciones separadas. | [asr-comparison](asr-comparison/README.md) |
| Estado y controles | Dioxus-Web/WASM con indicadores e inspector, sobre escenarios sintéticos claramente identificados. | [dioxus-state](dioxus-state/README.md) |

Los entornos, cachés, modelos, audios y resultados privados se guardan en
`local/experiments/`, fuera de Git. Los fuentes y manifiestos de cada piloto
se conservan aquí. Ninguno solicita claves, utiliza conversaciones o inicia
dispositivos de Alice.

Cerrar un piloto mantiene disponible la aplicación principal. Adoptar un motor
o interfaz requiere una decisión posterior, con pruebas del uso real y paridad
de contratos; las mediciones sintéticas no aceptan por sí solas R9.

La propuesta de persistencia y grafos de R6/R8 queda para una revisión profunda
posterior. Estos pilotos no cambian la memoria ni añaden funciones a Conversación.

[Resultados y límites](../docs/testing/ISOLATED_PILOTS_REPORT_2026-11-13.md) ·
[Alcance y criterios](../docs/research/HERRAMIENTAS_Y_PERSISTENCIA_REVIEW_2026-11-13.md).
