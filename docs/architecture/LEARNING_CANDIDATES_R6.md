# Candidatos de aprendizaje R6.4-C

Versión: R6.4-C  
Estado: implementado y validado localmente  
Fecha: 2026-08-20

## Flujo autorizado

1. Carlos abre `Memoria → Aprendizaje` y elige un recuerdo real.
2. Rust relee `data/memory/records.json`, rechaza registros ausentes o archivados y calcula su SHA-256.
3. Sólo el título, contenido y próximo paso del registro seleccionado se envían a Ollama por loopback.
4. Qwen devuelve cero a cuatro candidatos bajo un esquema JSON cerrado.
5. Rust exige tipo conocido, límites, confianza finita y evidencia literal contenida en la fuente.
6. React muestra una vista editable con `0 escrituras`.
7. `Confirmar aprendizaje` envía la propuesta original, la edición aprobada y la huella revisada a un único comando Rust.
8. Rust reconstruye el candidato desde el recuerdo vigente, comprueba su identidad y vuelve a validar todos los límites.
9. Bajo un bloqueo común de escritura, Rust crea un respaldo exacto, sustituye `records.json` de forma atómica y registra la auditoría de memoria.
10. Si la auditoría falla, Rust restaura el contenido original. Un reintento idéntico es idempotente; uno alterado se rechaza.

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

La confianza del modelo ayuda a ordenar la revisión; no demuestra verdad. Un candidato confirmado conserva en su procedencia el modelo, recuerdo e ID determinista. Luego continúa siendo editable, repasable y eliminable como cualquier enseñanza confirmada.

## Garantías de confirmación R6.4-C

- La vista previa sigue declarando `persisted=false` y no escribe.
- La confirmación exige `confirmed=true` y el SHA-256 exacto de `records.json` revisado.
- La propuesta original no se acepta por confianza de React: Rust la reconstruye contra la evidencia literal vigente.
- El bloqueo de escritura se comparte con guardado y restauraciones de `records.json`.
- El respaldo `records.backup.json` contiene exactamente la fuente anterior.
- El reemplazo se realiza con archivo temporal y renombrado atómico.
- La escritura sólo se considera exitosa después de la auditoría local; ante fallo, se restaura la fuente.
- Repetir exactamente una confirmación devuelve el registro existente. Cambiar el contenido con el mismo candidato se bloquea.

## Límites

- no analiza proyectos, bóvedas completas, pantalla, cámara o micrófono;
- no escribe durante la vista previa;
- no crea hábitos por frecuencia inferida;
- no entrena ni modifica el modelo Ollama;
- no usa Internet, herramientas o ejecución de código;
- no integra Fish Audio.
