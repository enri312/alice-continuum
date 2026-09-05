# Cuarentena de adaptadores externos

Estado: auditoría estática completada · 2026-09-04

La carpeta raíz `adapters/` contiene prototipos aportados externamente. Ninguno está
registrado como capacidad, comando Tauri, habilidad o procedimiento de Alice. No se
ejecutaron durante esta revisión.

| Grupo | Archivos | Riesgo observado | Estado |
|---|---|---|---|
| Lectura local | `document-reader.py`, `windows-ocr.py` | leen archivos indicados y devuelven rutas absolutas; carecen de raíz autorizada y límites completos | rescatar el contrato, no integrar el script |
| Percepción local | `stt.py`, `probe-face-landmarker.py` | audio/cámara y modelos locales; requieren consentimiento y leases R2 | la sonda facial es copia exacta de la ya validada; STT queda para R9 |
| Inferencia local | `vision-analyzer.py`, `knowledge-graph.py` | aceptan cualquier host y podrían enviar imagen o recuerdos fuera de loopback; el grafo escribe libremente | no ejecutar; rediseñar para R8/R9 |
| Red externa | `tts.py`, `weather-sensor.py`, `web-searcher.py`, `web-scraper.py` | envían texto, ubicación, consulta o URL; TTS usa `FISH_API_KEY` desde el entorno | no conectar sin capacidad, vista previa y auditoría |
| Procesos/descargas | `video-analyzer.py` | inicia FFmpeg y yt-dlp, descarga URLs y crea archivos | alto riesgo; requiere allowlist y sandbox de trabajo |
| Mutación del equipo | `system-actuator.py` | cambia volumen, mute y brillo de Windows | bloqueado hasta disponer de R2/R3 y confirmación por acción |

La inspección no encontró claves incrustadas, `shell=True`, autoarranque ni llamadas
desde el código vigente. Los doce archivos pasan análisis sintáctico mediante `ast`,
pero sólo seis de las dependencias consultadas estaban disponibles en el Python
activo; no se importó ni ejecutó ningún adaptador. La carpeta completa está excluida
de Git para impedir su incorporación accidental.

La evaluación detallada, hashes y orden de rescate están en
[`ADAPTER_STATIC_AUDIT_2026-09-04.md`](../research/ADAPTER_STATIC_AUDIT_2026-09-04.md).
Ningún prototipo se convierte en capacidad por aparecer en esa lista: antes debe
reescribirse dentro de un contrato R1, pasar por R2/R3 cuando corresponda, limitar
red/rutas/procesos y superar pruebas propias con datos reales deliberadamente elegidos.
