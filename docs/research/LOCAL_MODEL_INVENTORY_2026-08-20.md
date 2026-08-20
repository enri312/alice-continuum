# Inventario de modelos locales — 2026-08-20

## Resultado

Los siete modelos instalados tienen referencias verificables. Ninguno se considera huérfano y no se autoriza borrar, mover ni podar blobs.

`C:\Users\enri3\.ollama\models` no es una segunda copia: es una unión de directorio cuyo destino es `E:\Ollama\models`. El tamaño físico conjunto de los manifiestos instalados es aproximadamente 27,85 GiB.

| Modelo | Tamaño aproximado | Evidencia de uso o pertenencia | Clasificación |
|---|---:|---|---|
| `qwen3.5:0.8b` | 0,96 GiB | sintetizador auxiliar documentado por Cyrcetech | conservar |
| `qwen3.5:2b-q4_K_M` | 1,81 GiB | candidato GPU y comparación documentada por Cyrcetech | conservar |
| `granite4.1:3b` | 1,96 GiB | modelo predeterminado del backend y servicio AI de Cyrcetech | conservar |
| `qwen3.5:4b` | 3,16 GiB | cliente de escritorio de Cyrcetech, Azyreth y conversaciones previas de Ollama | conservar; candidato principal de Alice |
| `Azyreth-Universal:latest` | 4,34 GiB | prototipo histórico de Azyreth y conversaciones reales registradas por Ollama | conservar |
| `gemma4:e2b` | 6,67 GiB | alternativa de evaluación de Azyreth y referencia histórica de Cyrcetech | conservar; no usar siempre activo en Alice |
| `gemma4:e4b` | 8,95 GiB | comparativa pesada y proveedor seleccionable de Azyreth | conservar; no usar en la RTX 3050 para Alice |

El historial local también menciona modelos ya ausentes (`phi4-mini`, `qwen3.5:9b`, `dieumbra` y `deepseek-r1:8b`). Una mención histórica no demuestra que sus blobs sigan presentes.

## Alternativas externas sin descargar

| Candidato | Descarga publicada | Interés para Alice | Decisión actual |
|---|---:|---|---|
| `phi4-mini:3.8b-q4_K_M` | 2,5 GB | razonamiento, multilingüe y llamadas a funciones | candidato de benchmark |
| `llama3.2:3b` | 2,0 GB | español oficialmente soportado, diálogo y herramientas | candidato de benchmark |
| `qwen3:4b` | 2,5 GB | herramientas y razonamiento con menor tamaño que Qwen 3.5 4B | solapa con el modelo ya instalado |
| `ministral-3:3b` | 3,0 GB | español, visión, JSON y funciones para futuro sensorial | candidato futuro; requiere medir competencia con el avatar por VRAM |
| `gemma3:4b` | 3,3 GB | visión y más de 140 idiomas | no prioritario por solapamiento y presión de memoria |

Fuentes primarias: [Qwen 3.5](https://ollama.com/library/qwen3.5), [Phi-4 Mini](https://ollama.com/library/phi4-mini), [Llama 3.2](https://ollama.com/library/llama3.2), [Qwen 3](https://ollama.com/library/qwen3), [Ministral 3](https://ollama.com/library/ministral-3), [Gemma 3](https://ollama.com/library/gemma3) y [Granite 4.1](https://ollama.com/library/granite4.1).

## Política antes de liberar espacio

1. Repetir el rastreo de referencias.
2. Confirmar el proyecto propietario.
3. Exportar o documentar el manifiesto si el modelo deja de usarse.
4. Solicitar confirmación explícita de Carlos.
5. Borrar únicamente mediante Ollama; nunca eliminar blobs manualmente.
