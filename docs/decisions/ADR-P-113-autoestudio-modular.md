# ADR-P-113 — Autoestudio separado por responsabilidades

Fecha: 2026-11-10. Estado: implementado; validación local en el informe enlazado.

## Contexto

El propietario prioriza la estructura del núcleo cognitivo antes de retomar R9
y prevé revisar el proyecto con colaboradores. La implementación recibida de
autoestudio añadía currículo, contratos, reglas, archivos, peticiones Gemma y
coordinación Tauri en `self_study.rs`, con 600 líneas.

La base recibida se conserva en el checkpoint `ae75dce`, junto con la proyección
de memoria a Obsidian. Este incremento separa responsabilidades dentro de esa
implementación; no cambia el currículo ni el mecanismo de aprendizaje.

## Decisión

Mantener una aplicación Tauri con módulos por capacidad. Autoestudio queda así:

| Archivo en `src-tauri/src/` | Responsabilidad |
|---|---|
| `self_study.rs` | Comandos Tauri, eventos, ciclo de arranque y prioridad frente a voz/conversación |
| `self_study/model.rs` | Lecciones, progreso y contratos serializados |
| `self_study/domain.rs` | Validación del currículo y del progreso, planificación y aplicación del resultado |
| `self_study/storage.rs` | Lectura, bloqueo de escritura y persistencia atómica |
| `self_study/prompts.rs` | Petición de ejercicio a Gemma y validación de su respuesta |
| `self_study/tests.rs` | Pruebas de comportamiento existentes |

El modelo de datos y las reglas no importan Tauri ni realizan operaciones de
archivos o peticiones HTTP. La validación de URL usa el parser de `reqwest` sin
red. La fachada coordina los adaptadores y conserva la comprobación de pausa y
generación bajo el bloqueo de persistencia.

Los módulos internos comparten sólo la visibilidad necesaria dentro de
autoestudio. Los dos comandos Tauri, sus campos Serde y
`data/memory/self-study-v1.json` conservan el contrato existente. El currículo
sigue incluido en el binario desde `resources/self-study-curriculum.json`.

## Alcance y continuación

Esto conserva el monolito de escritorio parcialmente modularizado. La separación
es un incremento; aún hay dependencias concretas de Tauri en la coordinación y
de la persistencia de memoria en el adaptador de archivos.

Las siguientes fronteras a revisar son la coordinación de `App.tsx` y las
responsabilidades de transporte, proceso y arbitraje en `local_inference.rs`.
Cada incremento debe conservar los formatos de datos y demostrar las reglas que
afecta antes de reorganizar otra área.

Las comprobaciones de esta sesión no equivalen a aceptación visual, voz real ni
a una nueva ejecución del ejercicio vivo con Gemma.

[Resultados y límites](../testing/COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).
