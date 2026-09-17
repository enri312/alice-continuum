# Gemma E2B con llama.cpp: evaluación aislada

Fecha de inferencias: 2026-09-05. La ejecución final terminó y guardó los siete
resultados antes de la interrupción por créditos. Se verificó su integridad al retomar.

## Decisión

**Gemma 4 E2B Q4_K_M con llama.cpp es el candidato para una prueba piloto de Alice.**
No se sustituyó el modelo de producción. El resultado no demuestra superioridad
general sobre Qwen ni completa la validación para un asistente permanente.

La combinación probada comprende un único modelo con su componente multimedia,
no dos modelos generativos ni un enrutador de especialistas. El componente `mmproj`
procesa las entradas multimedia para ese mismo modelo. No se utiliza EmbeddingGemma.
La respuesta sigue siendo texto: esto no reemplaza Fish Audio ni produce voz propia.

## Lo que cambió desde la prueba de Ollama

| Configuración | Lectura visual | Tiempo primera consulta visual |
|---|---|---|
| Ollama 0.32.13 + Gemma E2B instalado | Falló por API nativa y compatible | Véase informe previo |
| llama.cpp + GGUF de Unsloth, detalle predeterminado, componente visual en CPU | Leyó código/estado; confundió nombre y una figura | 4.83 s |
| Mismo GGUF, 1120 tokens de imagen, componente visual en CPU | Correcta en esta imagen | 36.11 s |
| Mismo GGUF, 1120 tokens de imagen, componente visual en GPU | Correcta en esta imagen | **4.49 s** |

Se cambiaron tanto motor como paquete/conversión del modelo respecto de Ollama:
**no se ha aislado una causa raíz exclusiva en Ollama**. La comparación de detalle
predeterminado frente a 1120 tokens utilizó el mismo GGUF dentro de llama.cpp.

## Resultados finales: 1120 tokens y componente visual en GPU

| Caso | Resultado observado | Tiempo |
|---|---|---|
| Imagen, pregunta inglesa | Faro, PAUSADO, 7319, cuadrado rojo y círculo azul correctos | 4.49 s |
| Misma imagen, pregunta española | Datos y figuras correctos, respuesta en español | 2.36 s |
| Frase acústica inglesa | Transcripción correcta, incluido el número 47 | 0.81 s |
| Silencio de igual duración | `NO_SPEECH` | 0.48 s |
| Petición sin audio | `NO_SPEECH` | 0.27 s |
| Fuentes contradictorias | No inventó la ciudad; omitió la referencia E3 solicitada | 1.25 s |
| Corrección de acuerdos | Azul, presupuesto 27, jueves, sin autorización para borrar | 1.32 s |

La segunda pregunta visual reutilizó **1167 tokens de caché**: sus 2.36 s no equivalen
a analizar una imagen nueva. Primera consulta con caché vacía: 4.49 s, modelo ya
cargado. Generación observada en la batería final: aproximadamente 37–40 tokens/s.

Son 21 inferencias en llama.cpp, siete por configuración, sobre fixtures controladas.
No son 21 problemas independientes ni una tasa de éxito general. No se probó el
micrófono humano en español: el audio fue sintetizado localmente con Windows Zira.
Los prompts no contenían la frase acústica esperada ni los datos que había que leer
en la imagen. Se revisaron respuestas completas, no solamente los checks de subcadenas.

## Archivos y configuración reproducible

- Motor: `llama.cpp b10809`, commit `5266f24da`, distribución CUDA 12.4 Windows x64.
- Descarga oficial: <https://github.com/ggml-org/llama.cpp/releases/tag/b10809>.
- Paquete: <https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF>.
- Revisión fijada: `0314792d7f1f7e229411f620751375812bb9faf2`.
- `gemma-4-E2B-it-Q4_K_M.gguf`: 3,106,738,272 bytes.
- `mmproj-F16.gguf`: 985,654,080 bytes.
- Ubicación: `D:\Alice-model-evaluation\models\gemma4-e2b`.
- Motor portátil: `D:\Alice-model-evaluation\runtimes\llama-b10809\bin`.
- Contexto: 4096; una ranura; 24 capas en GPU; 8 hilos CPU.
- Componente multimedia en GPU; mínimo y máximo de imagen: 1120 tokens.
- Thinking desactivado; temperatura 0.2; seed 42; máximo 220 tokens de salida.
- Servidor: `127.0.0.1:18089`, sin agente, sin herramientas y CORS limitado al origen local.

Los dos ZIP del motor se verificaron mediante SHA256 publicado en la versión
oficial. `hf cache verify` comprobó los dos archivos GGUF descargados. Sus avisos
de archivos faltantes corresponden a cuantizaciones deliberadamente no descargadas;
los extras son metadatos locales. La guía hf-cli se utilizó para fijar revisión,
previsualizar el tamaño y verificar las descargas sin modificar el Python global.

Los componentes del motor se extrajeron localmente: no se instaló un controlador
CUDA, servicio, tarea programada ni modificación de PATH. El disco de 2 TB es D:;
no se confundió su espacio disponible con la RAM/VRAM del equipo.

Comprobación con los archivos de prueba existentes, desde la raíz del proyecto:

```powershell
powershell -NoProfile -File scripts/testing/start-llama-evaluation.ps1
# Esperar a que http://127.0.0.1:18089/health indique status: ok.
node scripts/testing/llama-multimodal-evaluation.mjs image1120-gpu
```

El inicio informa el PID del proceso de evaluación. Al terminar hay que detener
ese proceso, verificando su ruta; el script de inicio por sí solo no gestiona el cierre.
No ejecutar mientras Alice esté utilizando otro modelo.

Artefactos locales, excluidos de Git:

- `artifacts/gemma-evaluation/llama-results.json`: primera prueba, detalle predeterminado.
- `artifacts/gemma-evaluation/llama-results-image1120.json`: componente multimedia en CPU.
- `artifacts/gemma-evaluation/llama-results-image1120-gpu.json`: configuración final.

## Pendientes antes de una sustitución

1. Conversación humana sostenida en español y recuperación de recuerdos reales,
   manteniendo la distinción entre evidencia, opiniones y respuestas del modelo.
2. Voz humana española con consentimiento actual, ruido y controles sin voz.
3. Capturas nuevas con interfaces reales y letra pequeña; no sólo esta imagen.
4. Medición de RAM/VRAM máxima y latencia con el avatar y las aplicaciones del usuario.
5. Integración explícita del motor en Alice; el backend actual continúa sin cambios.

Phi-4 no se descargó: la conversión GGUF investigada carece de audio; la ruta ONNX
oficial hallada requiere evaluación adicional y no se declaró imposible. Ministral
no se descargó en esta ejecución porque no cubre entrada acústica por sí mismo.

Al retomar se comprobó que no quedaba servidor de evaluación en el puerto 18089 y
que Ollama no tenía modelos cargados. Los modelos instalados permanecen en disco;
no se borró nada ni se guardaron resultados como recuerdos de Alice.
