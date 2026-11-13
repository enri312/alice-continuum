# ADR-P-130 — Watchdog del filtro local de audio

Fecha: 2026-11-13. Estado: implementado; pruebas frontend, compilación y sonda
sintética aprobadas. El propietario confirmó una respuesta real con demora;
aceptación prolongada y revisión de latencia pendientes.

Se observó el error genérico «No llega señal del filtro local. La toma se
descartó». Al revisar la interfaz, el micrófono estaba apagado. Este fallo
pertenece a captura/filtrado antes del ASR; no alcanzó la transcripción Whisper.
El manejo de proceso validado en `1120ddc` conserva su alcance anterior.

## Defecto de inicio del plazo

El instante `lastMetric` se establecía con `Date.now()` antes de completar
la inicialización WASM, que admite hasta 10 s, y conectar el grafo de audio.
Una preparación que consumiera más de 1500 ms podía dejar vencido el watchdog
cuando comenzaban las lecturas de captura, realizadas cada 250 ms.
Es un defecto del recorrido de código; no identifica por sí solo la causa
única del episodio real ni prueba una avería física o su corrección.

Se mide con `performance.now()` desde que el grafo está conectado. Cada lote
válido de métricas renueva el instante, aunque describa silencio. Se conserva
el umbral de **1500 ms**: la preparación no consume ese plazo y no se amplía
la tolerancia a una interrupción real. El reloj de intervalos se separa del
calendario según el método
[`performance.now()` de High Resolution Time](https://www.w3.org/TR/hr-time-3/#dom-performance-now).

## Descarte y recuperación acotada

La falta de métricas lanza `NoiseSignalTimeout` y cierra los nodos procesados.
VoiceCapture conserva el motivo `metrics_timeout`, cancela la toma y libera
las pistas originales. Un error real no entrega audio parcial al ASR ni cambia
a una entrada sin filtrar.

En sesión automática, VoiceLoop admite este motivo dentro del **único rearme
ya existente por sesión**, compartido con `input_backlog` y `output_overflow`.
No se añade un presupuesto independiente. Si ese presupuesto ya se consumió,
el siguiente fallo detiene la sesión; otros errores no recuperables conservan
su tratamiento fatal. Detener o revocar invalida una recuperación pendiente.
No se reintentan ASR, Gemma, Fish ni acciones musicales.

El dictado manual conserva su cancelación y revisión habituales; este cambio
no lo convierte en una sesión automática. No se incorporan controles,
modelos, servicios o un fallback a audio crudo.

## Evidencia y límites

La prueba del reloj y la limpieza de recursos debe separarse de la aceptación
con voz real. Recibir métricas no acredita inteligibilidad ni precisión ASR;
su ausencia no identifica por sí sola el dispositivo responsable.
Las comprobaciones de Whisper anteriores no se reutilizan como pruebas de
este watchdog. R9 y los cinco turnos reales conservan sus pendientes.

La suite frontend aprobó 840 pruebas con 2 omitidas. Incluye 19 del pipeline y
80 de captura/bucle. TypeScript/Vite compiló con el aviso de chunks existente.
Una sonda de Chrome con Worker, WASM, Worklet y MediaRecorder reales aprobó
con inicialización retrasada 4 s, primeras métricas retenidas 500 ms y 6,5 s de
silencio generado. No utilizó micrófono, altavoces, ASR o archivos de audio.
El reporte conserva el primer criterio de cadencia fallido del arnés y su
repetición corregida. La ventana de Alice se revisó con micrófono inactivo y
sin el aviso anterior visible; eso no sustituye una prueba con el propietario.
Después, el propietario confirmó que Alice respondió en la repetición por voz,
aunque tardó. Es un acierto puntual; no cierra los cinco turnos de R9 ni
establece la causa física del fallo anterior.

[Reporte del incremento](../testing/NOISE_WATCHDOG_REPORT_2026-11-13.md).
