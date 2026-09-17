# Continuidad local: Gemma E2B frente a Qwen 3.5 4B

## Diseño de la prueba

Se amplió el piloto anterior a dieciséis turnos preparados. Se ejecuta primero Gemma E2B Q4_K_M en llama.cpp b10809 y después Qwen 3.5 4B en Ollama, nunca simultáneamente. No se instala ningún motor adicional ni se cambia la configuración de producción.

Ambos reciben las mismas preguntas, el mismo prompt de sistema extraído del código y las funciones reales de búsqueda/composición de Alice. Temperatura 0,2, semilla 42, contexto 4096 y máximo 240 tokens por respuesta, sin razonamiento explícito. Los tokens y la semilla no son equivalentes entre arquitecturas: esta es una comparación operativa, no un experimento que aísle exclusivamente el modelo.

El historial de cada candidato incorpora sus propias respuestas reales. Por ello, después del primer turno los contenidos y tamaños difieren. El modo extendido conserva **todo el historial**, a diferencia de los diez mensajes del piloto anterior: permite examinar continuidad sin confundirla con el recorte del historial. No representa una validación de la UI ni de conversaciones de horas.

Se usan los mismos nueve recuerdos elegibles del piloto, sin escrituras. Las preguntas de evaluación y sus respuestas permanecen fuera de la memoria canónica. Los detalles privados quedan en archivos ignorados por Git.

## Resultado de la ejecución

Ambos completaron 16 turnos, sin agotar tokens de salida. Los 36 archivos canónicos conservaron sus hashes en ambas ejecuciones. Al finalizar, Ollama informó cero modelos y no había servidor escuchando en 18089.

| Aspecto | Gemma E2B / llama.cpp | Qwen 3.5 4B / Ollama |
| --- | --- | --- |
| Corrección de alcance, turnos 7 y 15 | Conservó lenguajes y criterio | Confundió una consulta secundaria con sustitución del objetivo; luego negó el acuerdo |
| Restricción recuperada, turno 4 | Recuperó el contenido | Negó la restricción explícita y seleccionó solo la parte permisiva del recuerdo |
| Cámara/micrófono, turno 13 | No respondió: solo «Entendido» | Reconoció falta de evidencia actual |
| JSON final | Valores correctos, dentro de bloque Markdown | Lenguajes y criterio vacíos, dentro de bloque Markdown |
| Latencia media excluyendo primer turno | 1,48 s | 13,19 s |
| Máximo de tokens de entrada | 1592 | 2926 |

La carga inicial no está medida igual: Gemma espera a que el servidor esté listo antes de cronometrar; la primera petición de Qwen incluye carga (31,65 s). Las medias excluyen esa primera petición, pero siguen teniendo salidas e historiales de distinta longitud. No interpretar el cociente como velocidad intrínseca del modelo.

El fallo de continuidad de Qwen ya aparece con 1774 tokens de entrada, por debajo de 4096. No puede atribuirse aquí a haber llenado esa ventana. La respuesta equivocada entra en el historial y los turnos siguientes repiten el error. Una sola ejecución no establece superioridad universal, pero favorece a Gemma para el siguiente piloto de Alice.

No se ha migrado producción. La prueba de voz humana se documenta en [su informe independiente](GEMMA_HUMAN_AUDIO_2026-09-05.md); la convivencia con el avatar sigue pendiente. Esta prueba tampoco cubre el límite de contexto ni sesiones prolongadas.

## Reproducción

Ejecutar secuencialmente desde la raíz; cada ejecución verifica que Ollama esté sin modelos y que el puerto de evaluación esté libre:

```powershell
node scripts/testing/llama-memory-pilot.mjs gemma --extended
node scripts/testing/llama-memory-pilot.mjs qwen --extended
```

El script cierra el servidor que inició o solicita descargar Qwen de RAM, y compara hashes SHA-256 de los datos canónicos antes y después. Un fallo en esa comparación exige investigar posibles escritores concurrentes, no atribuir automáticamente la modificación al modelo.

Los resultados completos y métricas quedan en `artifacts/gemma-evaluation/memory-pilot-{gemma,qwen}-extended.json`.
