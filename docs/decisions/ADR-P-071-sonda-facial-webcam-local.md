# ADR-P-071 — Sonda facial local mediante webcam

Fecha: 2026-08-15  
Estado: aceptada como diagnóstico; integración productiva aplazada a R9

## Contexto

El seguimiento facial dedicado de un visor como Meta Quest Pro no está disponible actualmente. La
notebook sí posee la cámara `ACER HD User Facing`, y el runtime local ya incluye Python 3.14.6,
OpenCV 5.0.0, NumPy 2.3.5 y MediaPipe 1.0.0. Era necesario comprobar con señal real cuánto puede
aportar esa cámara antes de diseñar el puente facial de Alice.

El panel **Rostro** es todavía una representación desconectada. La capacidad
`perception.face.landmarks` continúa planificada y no disponible; el lease R2 existente autoriza
observar señal de cámara, no derivar ni conservar geometría facial.

## Decisión

- Incorporar `scripts/probe-face-landmarker.py` como sonda diagnóstica explícita, separada del runtime.
- Exigir `--live` para cualquier apertura de cámara y limitar cada ejecución a entre 3 y 30 segundos.
- Abrir solamente el nombre exacto `ACER HD User Facing` mediante DirectShow.
- Usar MediaPipe Face Landmarker float16 v1 desde almacenamiento local privado.
- Rechazar la ejecución si el modelo no coincide con SHA-256
  `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`.
- Emitir únicamente métricas agregadas: presencia, cantidades, rendimiento, latencia y máximos de
  canales seleccionados.
- No escribir fotogramas, video, landmarks, matrices faciales, identidad ni datos biométricos.
- Mantener el binario del modelo en `Assets/Models/private/`, excluido de Git. El repositorio sólo
  conserva su fuente oficial, nombre, tamaño y huella.
- No conectar los resultados con memoria, estado afectivo, decisiones, Rostro, Avatar ni BODY SOLVER.

## Resultado comprobado

La ejecución canónica del 15 de agosto de 2026 analizó 53 de 107 fotogramas durante 10,59 segundos a
640×480. Detectó un rostro en 53/53 análisis, 478 landmarks y 52 blendshapes. La inferencia promedió
20,71 ms, con p95 de 22,17 ms. El recuento de archivos multimedia permaneció en 117 antes y después.

La webcam es suficiente para prototipar parpadeo, apertura de mandíbula, sonrisa, cejas y una
aproximación de mirada. No sustituye la precisión, el ángulo estable ni la disponibilidad continua de
sensores dedicados montados en el rostro.

## Frontera para la integración futura

### Inventario R1 — 2026-08-16

El registro sustituyó la entrada amplia `perception.gesture.derive` por
`perception.face.landmarks` con la operación `deriveAuthorizedFaceLandmarks` y el alcance
`facialLandmarksEphemeral`. Así, rostro ya no comparte identidad ni futura autorización con manos o
pose. La nueva capacidad sigue en `planned` + `unavailable`, sin efecto ejecutable y con el
enforcer `none`.

El Gateway R2 conserva un cierre intencional: sólo prepara cámara y micrófono, por lo que rechaza
esa capacidad facial sin crear una solicitud, grant, proceso o lease. La migración posterior deberá
ampliar R2 de manera explícita y no reutilizar implícitamente el grant de observación de cámara.

### Diagnóstico pasivo visible — 2026-08-16

La pestaña Rostro puede consultar `face_readiness_status`, un comando local que calcula la huella del
modelo privado y comprueba dependencias Python. El contrato fuerza `sensorOpened=false`; el comando
no enumera ni abre una cámara, no carga el modelo en MediaPipe y no produce landmarks. La UI muestra
la malla sólo como referencia, presenta canales reservados con valores vacíos y diferencia
preparación de tracking.

Antes de usar esta señal dentro de Alice se deberá:

1. registrar una capacidad facial específica en R1 en lugar de ampliar implícitamente el permiso de cámara;
2. implementar solicitud, vencimiento, revocación y parada visible en R2;
3. auditar en R3 sólo metadatos y estado del adaptador;
4. calibrar rango neutral y extremos por usuario;
5. añadir suavizado, zona muerta y detección de pérdida de rostro;
6. mapear derivación facial a canales VRM mediante un puente R9 independiente;
7. demostrar por prueba que cerrar o revocar destruye buffers y pone los canales en neutral.

## Consecuencias

Existe evidencia reproducible de que el hardware actual puede iniciar el trabajo facial sin comprar un
visor. A la vez, la interfaz no puede presentar todavía `CAM`, `MDL`, `PTS`, `BLS` u `OUT` como activos:
hacerlo confundiría preparación técnica con una capacidad gobernada y operativa.

## Referencias

- [Face Landmarker para Python](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python)
- [Opciones de Face Landmarker](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/FaceLandmarkerOptions)
- [Resultado de Face Landmarker](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/FaceLandmarkerResult)
- [Modelo oficial float16 v1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)
