# Auditoría estática de prototipos externos en `adapters/`

Fecha: 2026-09-04  
Alcance: doce archivos Python aislados aportados externamente.  
Resultado: ninguno está listo para conectarse a Alice.

## Método y evidencia

- Se enumeraron los archivos y se congeló su SHA-256.
- `ast.parse` aceptó los doce archivos; esto demuestra sintaxis, no funcionamiento.
- Se inspeccionaron importaciones, URLs, variables de entorno, escrituras y procesos.
- Se consultó la disponibilidad de módulos sin importar ni ejecutar los adaptadores.
- No se abrió cámara o micrófono, no se llamó a Ollama o Internet y no se modificó
  memoria, hardware ni archivos de trabajo.

Dependencias halladas en el Python activo: `requests`, `numpy`, `cv2`, `mediapipe`,
`httpx` y `torch`. No estaban disponibles `pymupdf`, `winrtocr`, `faster_whisper`,
`lightrag`, `whisper`, `trafilatura`, `duckduckgo_search`, `pycaw`,
`screen_brightness_control` ni `comtypes`.

## Clasificación

| Prototipo | Valor recuperable | Bloqueo concreto | Decisión |
|---|---|---|---|
| `probe-face-landmarker.py` | sonda facial local ya probada | abre cámara y usa `ffmpeg`/DirectShow | conservar como referencia privada; es idéntico al blob validado previamente |
| `document-reader.py` | extracción y fragmentación PDF | no limita ruta/tamaño; permite solapamientos sin progreso; consulta `len(doc)` tras cerrarlo y expone ruta absoluta | reescribir primero como lectura local gobernada |
| `stt.py` | transcripción local por archivo | descarga/carga modelos fuera de un contrato explícito; no limita audio, duración o salida | candidato R9 después de estabilizar percepción |
| `windows-ocr.py` | OCR de una imagen local | dependencia ausente/no validada; no limita ruta, formato o tamaño y expone ruta absoluta | evaluar junto con observación visual R9 |
| `vision-analyzer.py` | análisis visual mediante Ollama | `--ollama-host` acepta destinos arbitrarios y puede exfiltrar la imagen; no valida loopback, tamaño ni modelo | rescatar sólo tras fijar loopback y contrato de privacidad |
| `knowledge-graph.py` | experimento de entidades y relaciones | acepta un host y directorio arbitrarios y depende del almacenamiento interno de LightRAG | no conectar el script actual; evaluar LightRAG como motor bajo el contrato R8 |
| `tts.py` | futura voz Fish Audio | red externa, archivo sobrescribible y contrato HTTP no validado; el texto viaja como argumento de proceso | reservar para R9 y rehacer tras verificar la API oficial |
| `video-analyzer.py` | ideas de frames y transcripción | descarga URLs, inicia procesos y escribe libremente; exige `yt-dlp` incluso para archivos; `showinfo` queda oculto por `loglevel error`, por lo que los tiempos pueden quedar en cero | alto riesgo; no integrar |
| `web-searcher.py` | resultados web básicos | red sin vista previa, procedencia fuerte, allowlist ni control de volumen | futuro con capacidad R1/R2/R3 propia |
| `web-scraper.py` | extracción de contenido principal | URL arbitraria sin defensa SSRF, tamaño máximo ni política de tipos | alto riesgo; no integrar |
| `weather-sensor.py` | clima puntual | usa red y, sin ubicación, deriva ubicación aproximada desde IP pública | mantener desconectado hasta consentimiento y auditoría |
| `system-actuator.py` | lectura/control de audio y brillo | muta el equipo sin plan, confirmación, lease ni compensación; exige todas las dependencias incluso para una lectura | mantener bloqueado; no es prioridad cognitiva |

## Orden de rescate recomendado

1. No integrar todavía ningún archivo de esta carpeta.
2. Para R8, diseñar primero el contrato de conocimiento semántico y sus evidencias;
   no adoptar LightRAG antes de saber qué debe persistir y qué debe olvidarse.
3. Reimplementar después un lector PDF mínimo en Rust o en un proceso Python
   estrictamente gobernado: raíz permitida, límite de bytes/páginas, salida sin rutas
   privadas, hash de fuente y cero escritura.
4. Llevar cámara, OCR, STT y visión a R9 con una sesión R2 visible, duración acotada,
   almacenamiento opt-in y auditoría R3 sin contenido sensible.
5. Mantener TTS, web, video y actuadores fuera del runtime hasta disponer de contratos
   de red/proceso/mutación y pruebas reales separadas.

## Aclaración al comenzar R8

La evaluación del script no descarta LightRAG. La documentación oficial describe
extracción de entidades/relaciones, búsquedas por grafos y vectores, citas y eliminación
documental. Son funciones aprovechables. Alice necesita enlazarlas con la identidad,
versión, vigencia, supresión y evidencia de sus recuerdos antes de adoptarlas.

El prototipo recibe un archivo completo como texto: no filtra estados R6 ni distingue
afirmaciones del propietario de respuestas históricas del modelo. Tampoco conserva
en su salida el ID y la versión de cada recuerdo que respalda una relación. Permite
cambiar el modelo de embeddings mientras fija su dimensión en 768, y no declara una
política de reconstrucción al cambiar modelo o fuente. Estos son problemas del
adaptador; no prueban que LightRAG sea incapaz de soportar una integración correcta.

Referencia: [documentación oficial de LightRAG](https://github.com/HKUDS/LightRAG),
consultada el 2026-09-04. Decisión: [contrato R8](../architecture/KNOWLEDGE_GRAPH_R8.md).

"Efectos externos" incluye operaciones observables fuera del cálculo: enviar texto
a Fish Audio, consultar una web, descargar video, crear audio o cambiar volumen y
brillo. Aislar estos prototipos significa que Alice aún no los invoca. No significa
que se hayan descartado o que toda acción deba pedir permiso repetidamente: se
integrarán con el alcance y la autorización vigentes, tratamiento de errores,
indicadores y cancelación cuando la operación lo permita.

## Hashes congelados

```text
6F8A6D016B57D83E4BEE26076E511D6E07E804AE3C820B28ADD863F4BBA3C1F3  document-reader.py
EC941517BA2A1F4528DA9A4F8F336C14EE3D77C996625B99735A5176225EC256  knowledge-graph.py
D9B39E04DBD7D0A701B1BF9BB498DDF4B4AF402FBFC0FD4E9B8C790FEEF2D830  probe-face-landmarker.py
EE392941451A204F63C230D6D3F884AE9D537893D9D98579A3A138B7D774F0D7  stt.py
895BF467DD01F719FBAD8E8975452CE04D4475EC1EF683EF9BEFA6E2DEB380D9  system-actuator.py
A9B6FBFADD585E3148A9CABF9648C1E2DEA380388F5BF6ED2C02134664F3DC1B  tts.py
7F5598309AD0E577B1AD9F584592D803E7F964F01FF820475DB7CEAF66F6A64F  video-analyzer.py
AD5405DA74E3DE2E22EA0CA8DF73C8D7DCC7353F782A935C3B8C2740585B2837  vision-analyzer.py
BE59E45C707C3050F820D629E8FB12A95F2C013CF874C0841F0DC4D2AEE44704  weather-sensor.py
80F62B59BFCAC053C7A2FC43B33622E84D89D486503576C67671425ABB4A5F73  web-scraper.py
6B0156BADBBD26D17CAD670AC9D2291E02B1484151DBD025A35A8678A465922F  web-searcher.py
FC7485FCD18ACA87DE654221E9709A941524364EEC7B0A20D6BF929F7CFDA08C  windows-ocr.py
```
