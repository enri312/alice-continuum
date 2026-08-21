# Candidatos de aprendizaje R6.4-B

Versión: R6.4-B  
Estado: implementado y validado localmente  
Fecha: 2026-08-20

## Flujo autorizado

1. Carlos abre `Memoria → Aprendizaje` y elige un recuerdo real.
2. Rust relee `data/memory/records.json`, rechaza registros ausentes o archivados y calcula su SHA-256.
3. Sólo el título, contenido y próximo paso del registro seleccionado se envían a Ollama por loopback.
4. Qwen devuelve cero a cuatro candidatos bajo un esquema JSON cerrado.
5. Rust exige tipo conocido, límites, confianza finita y evidencia literal contenida en la fuente.
6. React muestra una vista editable con `0 escrituras`.
7. Sólo `Confirmar aprendizaje` crea una enseñanza mediante el almacén normal de Memoria.

## Contrato de candidato

| Campo | Regla |
|---|---|
| `candidateId` | SHA-256 determinista de fuente, registro y propuesta |
| `candidateKind` | `fact`, `preference`, `habit` o `experience` |
| `memoryType` | `semantic`, `procedural`, `preference` o `episodic` |
| `intention` | 1–100 caracteres |
| `summary` | 1–420 caracteres |
| `evidence` | cita literal de 1–240 caracteres presente en la fuente |
| `confidence` | número finito entre 0 y 1 |

La confianza del modelo ayuda a ordenar la revisión; no demuestra verdad. Un candidato confirmado conserva procedencia, pero continúa siendo editable, repasable y eliminable.

## Límites

- no analiza proyectos, bóvedas completas, pantalla, cámara o micrófono;
- no escribe durante la vista previa;
- no crea hábitos por frecuencia inferida;
- no entrena ni modifica el modelo Ollama;
- no usa Internet, herramientas o ejecución de código;
- no integra Fish Audio.

