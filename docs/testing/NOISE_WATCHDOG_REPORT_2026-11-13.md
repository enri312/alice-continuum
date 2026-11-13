# Watchdog y timeout del filtro local

Fecha: 2026-11-13. Entorno: captura local de Alice Tauri en Windows.

## Problema observado

El propietario informó el error genérico «No llega señal del filtro local.
La toma se descartó». La revisión de la interfaz confirmó el aviso visible y
el micrófono apagado en ese momento. No se incorpora aquí historial privado
ni se reconstruye la frase que se intentaba pronunciar.

El error se produce en la captura filtrada, antes de entregar una toma al ASR.
Por eso no contradice los tests del proceso Whisper de `1120ddc` ni demuestra
que aquel incremento resolviera esta ruta anterior. La causa física del
episodio original no está confirmada y no se anuncia una corrección de voz.

## Defecto identificable en el código

`lastMetric` comenzaba con `Date.now()` antes de preparar WASM y conectar el
grafo. La inicialización puede esperar hasta 10 s, mientras el umbral de falta
de métricas es 1500 ms. La primera lectura de captura podía heredar un plazo
ya consumido por la preparación. El intervalo de lectura de 250 ms no reinicia
por sí solo ese reloj.

El reloj se cambia a `performance.now()` y se inicia después de conectar el
grafo. Cada lote válido renueva la referencia, también si las muestras son
silencio. El umbral sigue en 1500 ms; no se amplía para ocultar interrupciones.
La elección del reloj para medir intervalos sigue
[High Resolution Time](https://www.w3.org/TR/hr-time-3/#dom-performance-now).

Este defecto permite construir un caso de regresión reproducible. La
reproducción de código no demuestra que haya sido la única causa del aviso
real ni diagnostica el micrófono físico.

## Alcance de la recuperación

- El timeout lanza `NoiseSignalTimeout`, cierra nodos procesados y llega a
  VoiceCapture con el motivo `metrics_timeout`.
- VoiceCapture cancela la toma y libera sus pistas originales. Una toma parcial
  no llega a ASR ni activa una conversación, acción o petición a Fish.
- VoiceLoop permite un rearme automático sólo si queda disponible el presupuesto
  único de la sesión, que ya comparten backlog y overflow. No hay un contador
  nuevo exclusivo de timeout.
- Un segundo fallo o un error no recuperable detiene la sesión. Apagar o revocar
  invalida los callbacks y la recuperación pendientes.
- No se reintenta una transcripción, respuesta o acción musical. El modo manual
  conserva su recorrido de cancelación y revisión.

No hay fallback a audio crudo, nuevos controles, modelos o servicios. El manejo
del CLI Whisper y sus resultados anteriores se conservan. No se amplían las
funciones de Conversación ni se implementa un rediseño.

## Resultados del incremento

La suite frontend aprobó **840 pruebas y omitió 2**, con **76 archivos de
prueba aprobados y 2 omitidos**. Las 19 pruebas específicas del pipeline y
las 80 de captura/bucle ya están incluidas en esas 840; no se suman otra vez.

| Comprobación | Estado | Resultado y alcance |
|---|---|---|
| Inicio después de WASM y conexión | Aprobado | Pruebas del pipeline y sonda real de Chrome con inicialización retrasada sin heredar el plazo previo. |
| Reloj de intervalos y métricas silenciosas | Aprobado | Renovación por métricas válidas sin exigir voz; sonda con silencio sintético. |
| Umbral de 1500 ms sin métricas | Aprobado | Pruebas conservan el umbral y propagan `NoiseSignalTimeout`/`metrics_timeout` al detectar su vencimiento. |
| Cierre y descarte | Aprobado | Pruebas de cierre del grafo y pistas originales, sin enviar la toma parcial al ASR. |
| Único rearme compartido | Aprobado | Pruebas de presupuesto compartido con backlog/overflow y segundo fallo fatal. |
| Cancelación y callbacks tardíos | Aprobado | Pruebas de parada/revocación sin reinicio de una captura anterior. |
| Suite frontend | Aprobado | 840 aprobadas/2 omitidas; 76 archivos aprobados/2 omitidos. |
| Compilación TypeScript/Vite | Aprobado | Build completado con el aviso habitual de chunks mayores de 500 kB; no mide una mejora de rendimiento. |
| Revisión de la ventana nativa | Comprobada en el recorrido observado | Alice actualizada, Iniciar escucha disponible, micrófono inactivo y aviso anterior ya no visible. No se activó el micrófono para esta comprobación. |
| Repetición con voz del propietario | Acierto puntual confirmado | El propietario informó que Alice respondió, aunque tardó. No acredita cinco turnos ni estabilidad prolongada. |

Rust **408 aprobadas/32 omitidas por defecto**, las **dos sondas instaladas
seleccionadas**, Obsidian **15** y respaldo **20** son validaciones anteriores.
No se repitieron para este incremento frontend ni sustituyen sus pruebas.

## Sonda sintética con Worker, WASM y Worklet reales

La prueba completada en Chrome usó el pipeline real y MediaRecorder con
**6,5 s de silencio generado en RAM**. Se introdujo una demora de **4 s** en
la inicialización y se retuvieron las primeras métricas durante **500 ms**.
No se usaron micrófono, altavoces, ASR ni almacenamiento de audio.

| Dato de la repetición aprobada | Valor |
|---|---|
| Resultado | `passed: true`, sin fallo del filtro |
| Preparación medida | 4318,1 ms, incluida la demora artificial |
| Lecturas observadas | 26 ticks |
| Muestras de entrada y salida | 312.064 en cada lado |
| RMS | 0, silencio medido |
| MediaRecorder | 2009 bytes efímeros en RAM |
| Estado al medir | AudioContext `running` |

El primer sondeo ya entregó señal sin fallo del filtro, pero su arnés esperaba
24 ticks y observó 20; ese criterio de cadencia falló. Se corrigió para exigir
al menos 6 s de muestras y 4 lecturas, sin requerir un número exacto de
callbacks. Se repitió una vez y aprobó con los valores de la tabla. No se
oculta el primer resultado ni se interpreta como una avería acústica.

El control de pestañas del host de automatización no estaba disponible. La
sonda se completó con control nativo de Chrome y se cerró únicamente su pestaña
de prueba; no queda pendiente por esa limitación. La página/fixture local de
esta sonda está ignorada y no se incorpora a Git.

Las pruebas de reloj, evidencia y callbacks pueden usar fixtures controlados;
no representan una nueva prueba de micrófono ni aceptación acústica.
No se interpreta silencio válido como falta de métricas ni se concluye que
una métrica recibida demuestre claridad del audio.

## Preservación y siguiente paso

Tras la actualización, el propietario confirmó una respuesta real con demora.
Una lectura de metadatos R3 del último turno completo registró **6998 ms de
transcripción, 1721 ms de respuesta y 2361 ms de síntesis**. Son unos 11,1 s al
sumar esas operaciones; no incluyen captura, pausa de cierre ni el comienzo o
duración de reproducción. No se publica texto, audio, hashes ni IDs de sesión.
La transcripción concentró el mayor tiempo de esa muestra; no es un benchmark
comparativo de motores ni una medición de estabilidad.

El código anterior y el respaldo integral se preservaron y verificaron antes
de este incremento. Este reporte conserva sólo el error genérico y el alcance
técnico; no contiene conversaciones personales, audio, claves ni IDs de voz.

Con el watchdog comprobado y un acierto real comunicado, sigue revisar la
latencia por etapas. Permanecen sin confirmar la causa física del episodio
anterior y la aceptación prolongada con voz del propietario. Siguen los
cinco turnos breves pendientes —reproducir, pausar, reanudar, conversar y apagar
el micrófono— antes de retomar el núcleo ya autorizado, autoestudio con fuentes
y Obsidian. No se amplían materias y el avatar permanece al final.

[ADR-P-130](../decisions/ADR-P-130-watchdog-del-filtro-local.md) ·
[Proceso Whisper ya validado](WHISPER_PROCESS_FAILURE_REPORT_2026-11-13.md) ·
[Roadmap](../../Roadmap.md#próximo-paso-autorizado).
