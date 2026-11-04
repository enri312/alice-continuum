# Estabilidad de conversación oral — 4 de noviembre de 2026

Se implementó un incremento de R9 orientado a conversación cotidiana. Gemma 4
continúa como modelo de diálogo; **Whisper base local CPU transcribe el español**
y Fish da voz a las respuestas. Domótica excluida y avatar pospuesto por Carlos.
Contrato: [ADR-P-106](../decisions/ADR-P-106-estabilizacion-oral-y-rumbo-nerumi.md).

## Prueba nativa de sesión

`scripts/testing/conversation-session-pilot/` usa el componente de producción
HandsFreeVoice, RNNoise, MediaRecorder Opus y los comandos Tauri reales. Una
fuente sintética sustituye exclusivamente al micrófono físico. Se emplearon tres
frases españolas generadas con el perfil Fish existente, dos respuestas reales
de Gemma y síntesis/reproducción Fish. No es una prueba con la voz de Carlos ni
con música ambiental.

Datos aislados en `artifacts/conversation-session-2026-11-04/native-data`, sin
copiar memoria personal y con aprendizaje automático desactivado en esa raíz.
Se mantienen las evidencias de los intentos fallidos anteriores.

| Entrada española | Whisper en el ciclo completo | Resultado |
|---|---:|---|
| Hola, Alice. Quiero mejorar tu forma de conversar. | 1664 ms | Respuesta sobre su propia forma de conversar y voz reproducida |
| Me refiero a ti, Alice, a tus respuestas. | 1549 ms | Segunda respuesta y voz; vuelve a escuchar |
| Detén la conversación, Alice. | 1378 ms | «Deten la conversación Alice.»; parada y revocación, sin chat ni Fish |

**Aprobada:** tres transcripciones, dos respuestas, dos reproducciones y sesión
inactiva/revocada al final. Una sola autorización al iniciar. Las respuestas
tardías y duplicadas se cubren además con pruebas de VoiceLoop.

La generación de respuesta tardó **1249–2180 ms** y Fish **4512–4788 ms** en este
recorrido. La interfaz midió **7,3 s hasta iniciar la segunda voz**, desde el fin
de grabación e incluyendo decodificación. No incluye habla ni pausa de cierre;
son muestras puntuales, no una garantía de rendimiento. Fish domina la espera.
No se cambió el plan gratuito, el perfil ni las credenciales.

Otra prueba inició una respuesta local y detuvo la sesión 50 ms después:
el resultado fue rechazado y el historial de prueba conservó su revisión y sus
16 mensajes. No hubo síntesis. Este ensayo comprueba el caso de cancelación
durante la respuesta; no prueba atomicidad entre todos los posibles instantes
de una parada y una escritura.

Evidencia local, excluida de Git:

- `artifacts/conversation-session-2026-11-04/native-whisper-results.json`.
- `native-session-proof.png`: detalle de etapas y resultado aprobado.
- `native-cancellation-results.json`: rechazo y revisión del historial intacta.
- `native-spanish-results.json`: mismo audio con Gemma ASR; falló la parada.
- `native-sapi-results.json`: voz inglesa SAPI leyendo español; no válida como
  muestra representativa del habla del propietario.

## Elección e instalación del reconocedor

Whisper base reconoció las tres muestras directamente por tuberías en
1189, 1340 y 1158 ms antes de la integración. Se eligió el paquete oficial CPU
x64 de whisper.cpp v1.9.2, con hashes verificados de ZIP, ejecutable y modelo.
La versión v1.9.5 consultada no dispone del binario requerido.

Instalación repetible: `scripts/testing/install-whisper-local.ps1`. Modelo base
multilingüe, idioma español, cuatro hilos, GPU desactivada. El paquete y los pesos
viven en `D:\Alice-model-evaluation`, fuera del repositorio. Las licencias MIT
están en `public/licenses/`. La aplicación no descarga modelos al arrancar.

FFmpeg convierte la toma en RAM; Whisper recibe WAV por stdin y entrega texto en
stdout. No se usan opciones de exportación ni archivos temporales de audio.
Una cancelación detiene y recoge su proceso; hay un límite de 90 segundos.
Si Whisper no está instalado, permanece el respaldo previo de Gemma. Si está
instalado y falla, el error se informa y la sesión termina.

## Calidad conversacional

Se redujo el prompt oral y se evitaron instrucciones repetidas. En una comparación
exploratoria de diez casos, la mediana de generación fue de 1256 a 835 ms y la
entrada de 1397 a 849 tokens. En seis formulaciones adicionales, 852 a 686 ms y
1369 a 821 tokens. Son muestras de texto bajo carga variable, no una medición de
la conversación completa ni una prueba estadística de mejora.

Persisten errores con citas, «ella» ambiguo y el hermano de Carlos. También puede
cerrar con preguntas innecesarias o afirmar que está ajustando su comportamiento
sin que exista una modificación autónoma de código. No se declara comprensión
perfecta ni autoentrenamiento. El experimento con historial como roles separados
no se adoptó en producción por resultados mixtos.

Scripts y resultados: `scripts/testing/conversation-reference-eval.mjs` y las
carpetas `paired-results/`, `holdout-results/` bajo la misma raíz de artefactos.

## Verificación automática

- Frontend: **557 aprobadas y 2 sondas omitidas**, 64 archivos aprobados.
- Rust: **321 aprobadas y 27 sondas omitidas**.
- Compilación TypeScript/Vite, enlace nativo, formato y Clippy aprobados. Clippy
  revisó todos los targets con `-D warnings`. Persiste el aviso previo de Vite
  sobre paquetes de más de 500 kB; no impide compilar. Logs en los artefactos.
- Casos nuevos: duplicados/capturas antiguas, detalle privado de tiempos, diez
  turnos con una autorización y parada, recuperación ante fallo de voz,
  revalidación de sesión y reconocimiento por tuberías sin archivos.

Tras cerrar el piloto y su motor, se recompiló y abrió Alice mediante el lanzador
normal, con `ALICE_DATA_DIR=E:\Alice Cognitive Core\data`. Se comprobó la ventana
habitual, el micrófono apagado y HTTP 200. Los cuatro archivos canónicos de
memoria, propietario, aprendizaje automático e historial conservaron sus SHA-256
previos. No queda activo el almacén del piloto. El HTML v0.56 mantiene la portada
primero, sin identificadores duplicados ni enlaces locales ausentes.

## Aceptación pendiente y rumbo

Probar con Carlos, primero sin música y luego con sonido de notebook y de otro
equipo: cinco turnos que mantengan el tema, una corrección de referente y la
parada directa. Revisar **Último mensaje atendido** si algo se entiende mal.
RNNoise reduce ruido; no identifica personas ni garantiza separar voces.

Atlas inspira el siguiente tramo de voz y acciones ya delegadas. La escucha
actual se inicia con un botón y funciona por turnos: mientras procesa o habla,
usar **Detener conversación**. Aún faltan activación por nombre dedicada,
interrupción hablando con control de eco y menor espera de síntesis.

[Nerumi](https://nerumi.ch/) queda como referencia posterior para continuidad de
compañía y presencia de escritorio. Sus funciones anunciadas no se consideran
capacidades verificadas de Alice. Primero conversación y acciones fiables,
después presencia y avatar; no se incorpora domótica en este tramo.
