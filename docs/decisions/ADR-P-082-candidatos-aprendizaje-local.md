# ADR-P-082 — Candidatos de aprendizaje local desde recuerdos

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.4-A permite conservar una conversación real como episodio, pero no autoriza convertir lo dicho por un modelo o una observación aislada en verdad. Alice necesita extraer conocimiento útil sin aparentar aprendizaje, inventar evidencia ni escribir silenciosamente en su memoria.

## Decisión

- Registrar `memory.learning.propose` como capacidad R1 parcial e independiente.
- Analizar únicamente un recuerdo local elegido visiblemente por Carlos.
- Usar el endpoint fijo `127.0.0.1:11434` y rechazar modelos Ollama cloud.
- Tratar el recuerdo como datos no ejecutables; desactivar herramientas, streaming y razonamiento visible.
- Limitar la fuente a 12.000 caracteres, la salida a cuatro candidatos y el contexto a 4096 tokens.
- Admitir sólo `fact`, `preference`, `habit` y `experience`, ligados a las cuatro clases de memoria existentes.
- Exigir una cita literal presente en el recuerdo. Una evidencia inventada invalida toda la respuesta.
- No inferir hábitos estables desde una observación: `habit` sólo es válido si el recuerdo declara repetición y se clasifica como memoria procedimental.
- Mostrar título, contenido, clase e importancia editables antes de guardar.
- La vista previa declara `persisted=false`; guardar reutiliza la confirmación y el almacén validado de Memoria.
- Conservar en la procedencia modelo, ID del recuerdo e ID determinista del candidato; la huella exacta de la fuente queda en el recibo y la auditoría nativa.

## Consecuencias

Alice puede proponer aprendizaje a partir de experiencia real sin convertir cada respuesta en conocimiento. El modelo puede devolver cero candidatos, lo cual es un resultado válido. R6.4-C reemplazó el guardado general desde React por el comando transaccional documentado en ADR-P-083.

Fish Audio no forma parte de este incremento. Su clave no se lee desde documentos ni se copia al repositorio; R9 deberá cargarla desde una variable de entorno y definir licencia, costo, privacidad y confirmación de salida.

## Referencias

- [Ollama — Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama — Chat API](https://docs.ollama.com/api/chat)
