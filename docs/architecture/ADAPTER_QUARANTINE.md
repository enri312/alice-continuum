# Cuarentena de adaptadores externos

Estado: inspección estática inicial · 2026-09-04

La carpeta raíz `adapters/` contiene prototipos aportados externamente. Ninguno está
registrado como capacidad, comando Tauri, habilidad o procedimiento de Alice. No se
ejecutaron durante esta revisión.

| Grupo | Archivos | Riesgo observado | Estado |
|---|---|---|---|
| Lectura local | `document-reader.py`, `windows-ocr.py` | leen archivos indicados; dependen de paquetes Python externos | cuarentena; candidato a R1 con rutas acotadas |
| Percepción local | `stt.py`, `probe-face-landmarker.py` | audio/cámara y modelos locales; requieren consentimiento y leases R2 | cuarentena; evaluar por separado |
| Inferencia local | `vision-analyzer.py`, `knowledge-graph.py` | llaman a un host Ollama configurable y el grafo escribe un directorio de trabajo | cuarentena; fijar loopback y directorio antes de probar |
| Red externa | `tts.py`, `weather-sensor.py`, `web-searcher.py`, `web-scraper.py` | envían texto, ubicación, consulta o URL; TTS usa `FISH_API_KEY` desde el entorno | no conectar sin capacidad, vista previa y auditoría |
| Procesos/descargas | `video-analyzer.py` | inicia FFmpeg y yt-dlp, descarga URLs y crea archivos | alto riesgo; requiere allowlist y sandbox de trabajo |
| Mutación del equipo | `system-actuator.py` | cambia volumen, mute y brillo de Windows | bloqueado hasta disponer de R2/R3 y confirmación por acción |

La inspección no encontró claves incrustadas, `shell=True`, autoarranque ni llamadas
desde el código vigente. Esto no demuestra que los adaptadores sean correctos o
seguros: antes de integrar uno se debe congelar su SHA-256, revisar dependencias,
definir entradas/salidas cerradas, limitar red/rutas/procesos y crear pruebas propias.
