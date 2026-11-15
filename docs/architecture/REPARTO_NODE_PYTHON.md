# Reparto futuro entre Node.js, Python y Rust

Fecha: 2026-11-15. Estado: **primer módulo manual implementado y probado**.
El propietario pidió iniciar este reparto. La migración a Dioxus conserva su
objetivo; el resto de transferencias descritas aquí permanece como propuesta.

`npm run obsidian:sync:python` permite generar las notas con Python y conservar
la validación y escritura Node. La vigilancia de dos segundos y el arranque
habitual mantienen Node. El ensayo produjo notas idénticas, pero el coste de
iniciar Python fue mayor: se incorpora bajo demanda, sin activar un proceso
por revisión automática. [Pruebas y mediciones](../testing/NODE_PYTHON_OBSIDIAN_REPORT_2026-11-15.md).

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
| Construcción de notas Markdown en `scripts/obsidian/sync.mjs` | Implementada como opción manual por lotes. Node prepara campos y JSON técnico; Python construye Markdown y cercas; Node conserva validaciones y escritura protegida. | Primer incremento terminado; automatización Python no activada. |
| Cálculos y generación de informes en evaluaciones de `scripts/testing/` | Mover análisis por lotes e informes a Python después de identificar qué ensayos siguen vigentes. Conservar en TS las pruebas que ejercitan contratos TypeScript y evitar duplicar lógica productiva. | Segunda revisión. |
| Respaldos integrales en `scripts/backups/` | Conservar su implementación actual. Una eventual sustitución exigiría paridad de inventario, hashes, permisos, enlaces, bloqueo y restauración aislada. | Revisión independiente posterior. |
| Compilación, CLI Tauri y herramientas del frontend | Mantener Node donde las herramientas actuales lo requieren. La salida de React no implica por sí misma retirar Vite o npm. | Sin transferencia propuesta ahora. |
| Generadores SVG de iconos | Mantenerlos: incorporan las escenas del diseño existente y no participan en el uso cotidiano de la aplicación. | Sin beneficio medido que justifique portarlos. |

Python puede recibir más trabajo de análisis documental o evaluación de audio
aprovechando los adaptadores existentes. Eso debe distinguirse de trasladar una
tarea que hoy haga Node: la transcripción productiva actual ya la controla Rust
mediante el ejecutable Whisper configurado.

## Primer ensayo y posterior incorporación

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

El ensayo inicial se realizó en `experiments/node-python-obsidian/`, excluido
de Git. La versión utilizable está en `Backend/adapters/obsidian_note_formatter.py`
y `scripts/obsidian/python-renderer.mjs`. Se comprobó la equivalencia del resultado
y se aceptó el coste para un comando manual. Las pruebas de integración escriben
únicamente bóvedas ficticias; no se ejecutó ese comando sobre los datos personales.

La integración puede seguir el patrón de proceso con entrada/salida acotadas
que ya usa `Backend/src-tauri/src/documents.rs`: duración limitada, cancelación y
errores visibles. Para herramientas Python que lancen otros procesos, la
[documentación de subprocess](https://docs.python.org/3/library/subprocess.html)
describe entrada/salida por tuberías y tiempos de espera; estos límites también
deben aplicarse desde el supervisor que invoque el adaptador.

Después de cada incorporación: pruebas del contrato, prueba de fallo del
adaptador, arranque y función afectada en Alice, README/Roadmap y commit. El
trabajo de persistencia y grafos se revisará por separado, como se acordó.
