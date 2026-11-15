# Reparto futuro entre Node.js, Python y Rust

Fecha: 2026-11-15. Estado: **propuesta posterior a la migración a Dioxus**.
Este documento no cambia comandos, procesos ni el arranque actual.

La intención es transferir una parte del trabajo auxiliar de Node.js a Python.
El reparto se decide por responsabilidad, equivalencia funcional y coste medido;
cambiar de lenguaje no constituye una mejora de rendimiento demostrada.

## Lo que hace cada uno actualmente

| Componente | Responsabilidad verificada |
|---|---|
| Node.js/npm | Vite/TypeScript, pruebas frontend, CLI Tauri, herramientas Dioxus, generación de iconos, respaldos y proyección Obsidian. |
| Python | Extracción y fragmentación de documentos (`document_reader.py`); puente multimedia Linux (`linux_media_bridge.py`); algunos instaladores y ensayos. |
| Rust/Tauri | Núcleo nativo, permisos, auditoría, memoria operativa, control de procesos/modelos e invocación de adaptadores. Dioxus incorpora progresivamente la interfaz y sus modelos. |

El JavaScript que usa la WebView para audio, cámara o servicios del navegador
tiene un lugar de ejecución diferente de los scripts Node. La migración a
Dioxus y el reparto de tareas auxiliares con Python se verifican por separado.

## Candidatas a transferir

| Tarea actual | Propuesta | Prioridad |
|---|---|---|
| Construcción de notas Markdown en `scripts/obsidian/sync.mjs` | Probar en Python la transformación de registros ya validados a notas. Mantener inicialmente lecturas, vigilancia y escritura protegida en el módulo actual. | Primera prueba acotada. |
| Cálculos y generación de informes en evaluaciones de `scripts/testing/` | Mover análisis por lotes e informes a Python después de identificar qué ensayos siguen vigentes. Conservar en TS las pruebas que ejercitan contratos TypeScript y evitar duplicar lógica productiva. | Segunda revisión. |
| Respaldos integrales en `scripts/backups/` | Conservar su implementación actual. Una eventual sustitución exigiría paridad de inventario, hashes, permisos, enlaces, bloqueo y restauración aislada. | Revisión independiente posterior. |
| Compilación, CLI Tauri y herramientas del frontend | Mantener Node donde las herramientas actuales lo requieren. La salida de React no implica por sí misma retirar Vite o npm. | Sin transferencia propuesta ahora. |
| Generadores SVG de iconos | Mantenerlos: incorporan las escenas del diseño existente y no participan en el uso cotidiano de la aplicación. | Sin beneficio medido que justifique portarlos. |

Python puede recibir más trabajo de análisis documental o evaluación de audio
aprovechando los adaptadores existentes. Eso debe distinguirse de trasladar una
tarea que hoy haga Node: la transcripción productiva actual ya la controla Rust
mediante el ejecutable Whisper configurado.

## Primer ensayo propuesto: una nota Obsidian, sin escritura

1. Prototipar sólo el formateo equivalente a `recordNote` y sus bloques de texto,
   con entradas ficticias en un laboratorio privado de `experiments/`.
2. Dar al prototipo un JSON acotado y obtener la nota como resultado. Python
   dispone de [serialización JSON estándar](https://docs.python.org/3/library/json.html).
   El prototipo no abre la bóveda, modifica los originales ni llama a modelos.
3. Comparar bytes con la implementación actual: Unicode, saltos de línea,
   cercas Markdown, procedencia, estados retirados y campos opcionales.
4. Medir duración total, memoria y coste de iniciar el proceso, tanto para una
   nota como para un lote. Si se integra, ejecutar por lote y bajo demanda;
   no crear un proceso por nota ni un servidor permanente por defecto.
5. Integrar sólo después de demostrar equivalencia y un coste aceptable.
   Mantener los permisos, detección de notas editadas, hashes y escritura atómica
   existentes. `records.json` y los demás almacenes de Alice siguen siendo canónicos.

La integración puede seguir el patrón de proceso con entrada/salida acotadas
que ya usa `Backend/src-tauri/src/documents.rs`: duración limitada, cancelación y
errores visibles. Para herramientas Python que lancen otros procesos, la
[documentación de subprocess](https://docs.python.org/3/library/subprocess.html)
describe entrada/salida por tuberías y tiempos de espera; estos límites también
deben aplicarse desde el supervisor que invoque el adaptador.

Después de cada incorporación: pruebas del contrato, prueba de fallo del
adaptador, arranque y función afectada en Alice, README/Roadmap y commit. El
trabajo de persistencia y grafos se revisará por separado, como se acordó.
