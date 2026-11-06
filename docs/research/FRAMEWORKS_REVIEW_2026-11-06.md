# Revisión del informe de frameworks para Alice

Fecha: 2026-11-06. Informe aportado: `docs/evaluacion_frameworks_ia_asistente.md`,
fechado 2026-11-05. Se conserva su contenido original. Base de código: `fc07b69`;
la espera de voz y la protección de Vite se incorporan en `794bb92`, con ajustes
de regresión y gramática hasta `18f03fb`.

## Conclusión

El mapa de responsabilidades del informe es útil, pero sus cuatro propuestas
son opciones para necesidades distintas, no cuatro instalaciones obligatorias
para que Alice funcione. La prioridad sigue siendo R9 sin avatar: atención a
frases dirigidas a Alice, control de escucha, continuidad y calidad oral real.
Se conserva Rust/Tauri, Gemma, Whisper y Fish. No se instalan frameworks
agénticos, bases vectoriales, otro TTS ni un runtime ONNX en esta revisión.

Gemma sigue siendo el modelo conversacional. Whisper ya desempeña una función
especializada de transcripción; un futuro detector de nombre sería otra función
pequeña, no un segundo LLM para dialogar. Un runtime común tampoco aporta un único
modelo que resuelva palabra clave, VAD y síntesis: cada tarea necesita pesos,
preprocesamiento, compatibilidad y validación propios.

## Contraste con la implementación

| Punto del informe | Evaluación y efecto práctico |
|---|---|
| Tauri/Rust/React como base | Coherente con el producto existente. No hay un benchmark del proyecto frente a Electron para afirmar cuánto ahorra RAM ni una comparación de seguridad que justifique «óptimo». |
| Gemma/llama.cpp y adaptadores propios | Corresponde al código. Las respuestas completas preceden a Fish; la integración local no resuelve por sí sola referentes ni conversación natural. |
| Orquestador propio y tool calling | Adecuados para los destinos acotados actuales. MCP no es requisito para esperar el nombre, conversar ni reproducir música con los adaptadores existentes. |
| JSON, búsqueda léxica y reranking | La descripción básica coincide. Un índice vectorial derivado puede mejorar candidatos por sinónimos; hay que medir recuperaciones omitidas antes de elegir SQLite/vec o LanceDB. Los recuerdos canónicos no se sustituyen por el índice. |
| Wake-word y VAD neuronal | Son líneas razonables de evaluación. El detector actual usa energía y probabilidad de RNNoise; el nuevo filtro opera después de ASR. Un modelo de palabra clave requiere muestras y evaluación para «Alice» en español. |
| Falta de AEC | Requiere precisión: `noise-pipeline.ts` ya solicita `echoCancellation:true` e intenta el modo del sistema cuando está disponible. Falta comprobar su eficacia y controlar eco/interrupción con captura simultánea, no añadir simplemente una bandera. |
| TTS local y streaming | Pueden reducir la espera o dar una alternativa sin red. No se puede prometer síntesis «en milisegundos» ni una reducción concreta de latencia oral sin medir equipo, voz, primer audio, reproducción y cancelación. Fish continúa como salida actual. |
| Avatar «bien cubierto» al cierre R9 | Describe prototipos, no aceptación del cuerpo. El propietario pospuso su integración; no es un requisito del alcance activo. |
| Seguridad «muy superior al promedio» | No está sustentado por una auditoría comparativa. La revisión focal anterior declaró expresamente su cobertura parcial. Las garantías deben demostrarse por control y pruebas, no por el lenguaje elegido. |

## Correcciones a las recomendaciones

**Un framework Python no obliga a tener un servidor permanente.** La documentación
de LangChain muestra su uso como biblioteca con creación e invocación de agentes.
El coste depende del despliegue y de las dependencias elegidas. Tampoco se midieron
«varios gigabytes» para una configuración concreta. No incorporarlo ahora evita
duplicar el orquestador existente; esa es la justificación aplicable a Alice.
[Documentación de LangChain](https://docs.langchain.com/oss/python/langchain/overview).

**ONNX no aporta automáticamente una activación fiable por «Alice».** El proyecto
openWakeWord documenta modelos preentrenados en inglés y entrenamiento de nuevas
palabras. Elegir un runtime es sólo una parte: faltan un modelo adecuado, licencia,
audio de referencia, umbrales y medición de activaciones falsas con música, voces
de fondo y la propia salida de Alice. No se afirma que el filtro ASR implementado
en esta revisión sustituya ese detector.
[Modelos e idiomas de openWakeWord](https://github.com/dscripka/openWakeWord#language-support).

**La seguridad exige revisar el código y su entorno.** Como comprobación puntual,
Vite respondió HTTP 200 a un archivo ficticio colocado en `data/`. No se descargó
memoria personal. Se añadieron exclusiones de los directorios privados del
proyecto, conservando las reglas predeterminadas para credenciales. La verificación
HTTP de regresión usa archivos descartables; esto no convierte la pasada en una
auditoría completa ni demuestra aislamiento frente a otro proceso con permisos
de disco. Los archivos de `public/` no están cubiertos por `server.fs.deny` y deben
seguir siendo recursos publicables.
[Restricciones de archivos de Vite](https://vite.dev/config/server-options#server-fs-deny).

## Orden propuesto para continuar

1. Aceptar la espera y los controles implementados: ambiente descartado, llamada
   directa atendida, parada a espera y apagado total. Comprobar frases reales.
2. Evaluar un detector acústico para «Alice» en español y captura con contexto
   previo a la activación. Medir consumo en CPU, errores y pérdida del inicio de frase.
3. Medir eco e interrupción antes de conectar escucha simultánea; después,
   estudiar streaming por frases con cancelación de generación y reproducción.
4. Incorporar búsqueda vectorial si una evaluación de recuerdos/documentos
   demuestra que los candidatos léxicos son insuficientes.
5. Evaluar MCP cuando una nueva integración lo justifique, manteniendo R2/R3.

El [informe de espera y pruebas](../testing/VOICE_STANDBY_REPORT_2026-11-06.md)
separa lo implementado de la aceptación acústica pendiente.
