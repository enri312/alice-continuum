# Orden de Spotify con micrófono y recuperación de captura

Fecha local: 2026-11-11. Entorno: Alice Tauri en Windows.

## Prueba con el propietario

El propietario inició la escucha y pronunció la orden de abrir Spotify y
reproducir la playlist configurada. La vista **Último mensaje atendido** mostró
la transcripción correcta, incluido su punto final. Se guardó un nuevo recibo
de reproducción confirmada y la sesión volvió a espera. El propietario confirmó
que escuchó tanto la música como la voz de Alice.

Medición de ese único turno, desde el final de la grabación:

| Etapa | Tiempo observado |
|---|---:|
| Transcripción | 2,6 s |
| Respuesta y control multimedia | 20,1 s |
| Preparación de voz | 3,5 s |
| Hasta iniciar la voz | 26,2 s |

La duración hablada y la pausa que cierra la toma quedan fuera. La etapa de
respuesta incluye el recorrido de la orden y su recibo; no es una medición
aislada de inferencia de Gemma ni un promedio de latencia.

Después apareció **La sesión se detuvo** con el aviso **El filtro de audio no
pudo mantener el ritmo de captura**. La orden y la salida audible están
comprobadas; la estabilidad prolongada de la escucha todavía no lo está.

## Cambio posterior a la prueba

Se añadieron causas internas diferenciadas y un único intento de recuperación
de captura por sesión (ADR-P-121). Se descarta la toma afectada antes de rearmar;
el aviso pide repetir la frase al volver a espera. No cambia RNNoise, los límites
de cola ni la política de autorización. Tampoco reintenta acciones musicales o Fish.

Una segunda interrupción o una causa desconocida sigue siendo fatal. El error
genérico observado con la versión anterior no permite decidir retrospectivamente
si se llenó la entrada o la salida, ni atribuirlo a carga, ocultación o un proceso
concreto. La corrección no se presenta como una solución de raíz del DSP.

## Repetición con la versión actualizada

La segunda sesión permanecía en espera al revisarla. El propietario informó
que alguna orden no se reconoció. El último turno atendido mostraba «Alice,
Spotify.»; el propietario aclaró que había dicho «Alice, pausa Spotify».
Alice pidió aclaración y no emitió un recibo de pausa. Se apagó el micrófono
para aislar esa pérdida de transcripción con el audio de fondo en pausa.

Esta observación no acredita las tres órdenes de la secuencia ni determina
si llegó a ejercitarse la recuperación del filtro. El reconocimiento de la
orden corta con música conserva su aceptación pendiente.

## Validación y conservación

- **724 pruebas frontend aprobadas; 2 sondas opcionales omitidas**.
- **15 pruebas de Obsidian** y **20 de respaldo/restauración** aprobadas.
- Compilación TypeScript/Vite aprobada; conserva el aviso de tamaño de chunks.
- El backend Rust no cambió en este incremento; su validación previa de
  376 pruebas y 30 sondas omitidas pertenece al commit `3390174`.

Las regresiones comprueban los tres códigos, descarte de audio parcial, limpieza
antes del callback, stream filtrado, único presupuesto, segundo fallo fatal,
cancelación, eventos tardíos y conservación del límite de dos horas. La prueba
de desborde de salida es controlada; no reproduce la causa acústica observada.

Antes de editar se cerró Alice normalmente y se verificó el respaldo privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T02-35-50-692Z-6288fca0-c17e-44b2-8be6-6595572a223c`.
La fecha del nombre está en UTC. El código previo se archivó en
`local/backups/voice-recovery-20261111/source-before.zip` y se tomaron huellas
privadas antes de las pruebas aisladas. Los 134 archivos privados mantuvieron
sus huellas hasta reabrir Alice; no se añadieron archivos de datos durante
esas pruebas. No se publica audio, historial personal,
cuenta ni URL de la playlist.

## Aceptación que continúa pendiente

Repetir una sesión con la versión nueva: pausa, reproducción, vuelta a espera
y apagado por voz. Separar una recuperación de captura observada de una sesión
en la que simplemente no se produjo el fallo. Mantener pendientes los cinco
turnos cotidianos, música de notebook y otro equipo, latencia e interrupción
hablada durante TTS.

Tras esta orden, el siguiente paso del núcleo es comprobar recuperación de una
lección aprobada con su fuente, frente al conjunto completo de memorias, y su
proyección en Obsidian. Una lectura o prueba de ranking no sustituye una
respuesta real de Alice.
