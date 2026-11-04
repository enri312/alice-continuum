# R9 — Referentes, estilo, parada por voz y Rust

Fecha: 2026-11-03. Contrato: [ADR-P-100](../decisions/ADR-P-100-referentes-parada-de-voz-rust.md).

## Cambios

- El mensaje identifica explícitamente **Carlos Nuñez → Alice**. Se mantiene
  intacto el texto del propietario y su selección de contexto. Los presupuestos
  de caracteres y bytes se calculan con la misma cadena enviada.
- Las instrucciones de conversación se separan en
  `src-tauri/src/prompts/conversation.txt`: participantes, pronombres, citas,
  correcciones y ejemplos ficticios equilibrados entre Alice, Carlos y terceros.
- Por petición posterior del propietario, el saludo oral puede ser cálido y
  animado y confirmar «sí, te escucho». La indicación de saludo adicional se
  agrega sólo ante un «Hola» directo en el mensaje actual. No se afirma que
  todos los módulos estén activos ni se instalan respuestas prefabricadas.
- Una orden directa completa **Detén la conversación, Alice** se intercepta
  después de transcribir y antes de enviar un turno a Gemma/Fish. Revoca la
  sesión, detiene la reproducción y muestra un aviso. No crea un intercambio.
- El equipo y el proyecto usan Rust/Cargo **1.99.1 estable**. El canal global
  `stable` se actualizó y `rust-toolchain.toml` fija la versión exacta, con
  `clippy` y `rustfmt`. No se actualizaron dependencias Cargo, Node ni modelos.

## Evaluación local real de Gemma

Se ejecutaron comparaciones exploratorias con el mismo Gemma 4 E2B Q4, contexto
4096, GPU 24 capas, 8 hilos, semilla 42, temperatura 0.2 y salida máxima 240
tokens. Se probaron varias revisiones: añadir reglas o cambiar su orden produjo
regresiones, por lo que no se aceptó cada revisión por el solo hecho de compilar.
Las ejecuciones anteriores y la final quedan bajo `artifacts/`.

El evaluador usa el compositor real de payload y las instrucciones extraídas del
código. Inicia y termina sólo su motor aislado; rechaza un puerto Gemma ocupado
o modelos Ollama cargados. No llama a Fish ni a los escritores de conversación,
auditoría o memoria. Los casos son ficticios, excepto el ejemplo aportado por el
propietario para explicar el fallo. No se reconstruyó como exacto el payload de
su conversación original, porque no se disponía de ese envío autorizado completo.

Ante «Hola, Alice, ¿me escuchas? Quiero saber para poder seguir avanzando con tu
mejora», la ejecución final produjo:

> ¡Hola, Carlos! Sí, te escucho. Dime qué tienes en mente para seguir avanzando con mi mejora.

Resultados de revisión humana de esta muestra limitada:

| Caso | Observación final |
|---|---|
| Mejora dirigida a Alice, ejemplo original | Mantiene **mi mejora** y saludo natural |
| Paráfrasis sobre sus respuestas | Habla de sus propias respuestas |
| Carlos mejora su programación | Mantiene las funciones y el desarrollo de Carlos |
| Ana mejora su forma de explicar | Conserva a Ana como tercera persona |
| Seguimiento sobre Marta | Conserva el antecedente Marta |
| Corrección explícita «me refiero a ti» | Retoma la propia conversación de Alice |
| Saludo sobre clases de la hermana | Saluda y mantiene el tema de la hermana |
| Petición de evitar preguntas en cada respuesta | Acepta sin añadir otra pregunta en esa ejecución |
| Cita del hermano a Carlos | **Falla**: confunde hablante y destinatario de la cita |
| «Ella» con Ana y Marta como antecedentes | **Falla**: las trata como plural en lugar de aclarar |

Esto no es una medición general de precisión ni garantiza otras semillas,
historias, transcripciones o formulaciones. La confusión original mejora en el
caso probado, pero la comprensión de citas y referencias ambiguas permanece
incompleta. El estilo aún puede repetir fórmulas en otros turnos. Gemma se conserva
según la decisión del propietario; no se afirma que el problema esté resuelto
para cualquier conversación.

## Pruebas de código y entorno

| Verificación | Resultado |
|---|---|
| Frontend | 520 pruebas aprobadas, 2 omitidas |
| Rust 1.99.1, biblioteca | 295 aprobadas, 23 sondas ignoradas |
| Compilación TypeScript/Vite | Aprobada |
| Compilación nativa con Rust 1.99.1 | Aprobada |
| Clippy de biblioteca con `-D warnings` | Aprobado |
| Rustfmt en módulos Rust modificados | Aprobado |
| Lanzador `--check` | Listo con Node 26.13.0 y Cargo 1.99.1 |
| `git diff --check` | Aprobado |

El primer Clippy detectó la firma existente de ocho argumentos del adaptador de
auditoría de voz. Se documentó la misma excepción acotada que usa el productor
de auditoría central; no cambió su contenido ni su comportamiento.

Las pruebas de parada verifican mayúsculas, tildes, puntuación y variantes
directas. Negaciones, citas, historias y explicaciones de la orden no detienen la
sesión. La prueba integrada del ciclo verifica revocación, ausencia de respuesta,
TTS y nueva escucha después de la orden. Una mención explicativa sí continúa
como conversación. Las pruebas de saludo excluyen citas, relatos y palabras
como «Holanda».

## Límites y datos

La orden vocal funciona **durante escucha** y sólo tras obtener la transcripción.
No interrumpe hablando mientras Alice procesa o reproduce: el micrófono está
apagado en esas etapas. El botón Detener funciona en cualquier etapa. No hubo
una nueva prueba de micrófono humano ni de Fish en esta entrega; no se atribuye
a los tests una validación acústica.

Los **43 archivos canónicos de `data/` mantuvieron su SHA-256** durante esta
entrega. No se alteraron recuerdos, historial, auditoría ni el avatar. Las
instancias Gemma del evaluador quedaron terminadas. Persiste el aviso de Vite
por paquetes grandes. No se declara cierre de R9 ni distribución pública.

Los logs, las salidas exploratorias y las comprobaciones se guardan en
`artifacts/r9-reference-stop-rust-2026-11-03/`, fuera de Git. La versión anterior
de Rust permanece instalada; el proyecto y el canal global usan la nueva.

Fuente de la versión: [anuncio oficial de Rust 1.99.1](https://blog.rust-lang.org/2026/10/15/Rust-1.99.1/).
