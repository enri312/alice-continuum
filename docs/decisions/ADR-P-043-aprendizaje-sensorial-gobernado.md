# ADR-P-043 — Aprendizaje sensorial gobernado

Fecha: 2026-08-09  
Estado: aceptada; hardware comprobado e implementación bloqueada por R2

## Contexto

Alice deberá poder aprender de información visible en una pantalla seleccionada, la cámara y el micrófono de la notebook, reproductores multimedia, acciones accesibles del escritorio y gestos. Estas fuentes contienen datos privados y no deben confundirse con memoria confirmada ni habilitar vigilancia continua.

El equipo comprobado es un Acer Nitro AN515-58 con Intel Core i5-12450H, 24 GB de RAM, NVIDIA RTX 3050 Laptop de 4 GB, cámara `ACER HD User Facing` y arreglo de micrófonos Intel Smart Sound. Es suficiente para análisis local ligero y modelos cuantizados, pero no para mantener un modelo multimodal grande en ejecución permanente.

## Decisión

- Separar **señal sensorial**, **observación derivada**, **candidato de aprendizaje** y **recuerdo confirmado**.
- No persistir video, capturas o audio crudo por defecto. Los búferes se descartan después del análisis local.
- Toda captura requiere sesión con fuente, propósito, duración, indicador visible y revocación.
- Ningún candidato se convierte automáticamente en recuerdo; Carlos puede guardarlo, corregirlo o descartarlo.
- Adoptar los siguientes adaptadores de forma incremental:
  - pantalla: Windows Graphics Capture con selector seguro del sistema;
  - cámara: Windows MediaCapture;
  - gestos, landmarks faciales y pose: MediaPipe Tasks con modelos locales;
  - micrófono: WASAPI, detección de actividad de voz y Whisper local;
  - sonidos: clasificación local ligera, inicialmente MediaPipe Audio Classifier/YAMNet;
  - reproductores: Windows Global System Media Transport Controls antes de considerar loopback;
  - audio del sistema sin metadatos: WASAPI loopback solamente mediante autorización específica;
  - acciones de interfaz: eventos estructurados de UI Automation, sin keylogger ni lectura de campos protegidos.
- Preferir metadatos a contenido crudo: para una canción se conserva título, artista, reproductor y estado cuando estén disponibles, no una copia del audio.
- Registrar cada adaptador primero en R1 y exigir el Gateway de permisos de R2 antes de activarlo.

## Alternativas descartadas

- Grabar cámara, pantalla o micrófono continuamente: exceso de riesgo, almacenamiento y ruido.
- Guardar automáticamente todo lo detectado: mezcla inferencias con hechos confirmados.
- Depender de un modelo multimodal grande residente: no corresponde al hardware ni al objetivo local-first.
- Usar captura de teclado global para aprender acciones: puede recoger contraseñas y datos privados.

## Consecuencias

- Memoria incorpora una bandeja de candidatos sensoriales, inicialmente vacía y bloqueada.
- R1 amplió el inventario con seis capacidades sensoriales declarativas, planificadas y sin actividad inventada.
- R2 deberá autorizar sesiones efímeras y revocables antes de que exista captura real.
- R3 deberá auditar inicio, parada, fuente, derivaciones y decisión sobre cada candidato sin copiar la señal privada.
- R6 consolidará candidatos confirmados en la capa de memoria apropiada.
- R9 podrá reutilizar landmarks de rostro, manos y cuerpo para BODY SOLVER sin mezclarlos con decisiones cognitivas.

## Autorización y evidencia de hardware — 2026-08-09

Carlos Nuñez autorizó comenzar las pruebas reales con la cámara y el micrófono integrados. Una comprobación efímera recibió 12 fotogramas de 640×480 desde `ACER HD User Facing` y 77.175 muestras a 44.100 Hz desde el arreglo de micrófonos Intel. No se guardó contenido crudo.

Esta autorización habilita el diseño y las pruebas del adaptador, pero no elimina la obligación de consentimiento visible y revocable por sesión dentro de Alice. Fish Audio queda fuera de este incremento: se evaluará posteriormente para la voz del avatar y su clave no se almacenará en Git, React, memoria ni auditorías.

## Referencias técnicas

- [Windows Graphics Capture](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture)
- [Windows MediaCapture](https://learn.microsoft.com/en-us/windows/apps/develop/camera/basic-photo-capture)
- [WASAPI loopback](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)
- [Windows Media Control](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession)
- [MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [MediaPipe Audio Classifier](https://developers.google.com/edge/mediapipe/solutions/audio/audio_classifier/web_js)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
