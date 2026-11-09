# Permiso de micrófono WebKitGTK en R9

Fecha: 2026-11-06. El propietario recibió `NotAllowedError` al pulsar
«Iniciar escucha de Alice» en Ubuntu. Las comprobaciones anteriores acreditaban
la presencia de las APIs, no la autorización de una captura en Tauri.

## Causa y corrección

Wry 0.55.1 no instalaba un manejador de `permission-request` para medios en
Linux. WebKitGTK deniega las solicitudes no atendidas. Se configura ahora
`enable-media-stream`/WebRTC en la vista principal y se conecta ese manejador.

Sólo se atienden solicitudes del origen local exacto de Alice: `tauri://localhost`
o, en desarrollo, localhost/127.0.0.1:5173. Una sesión de voz vigente, iniciada
explícitamente con el botón, permite únicamente audio. La captura manual de
micrófono o cámara exige un diálogo GTK, con Cancelar como opción predeterminada.
Captura de pantalla y orígenes ajenos se rechazan; otros permisos conservan su
tratamiento anterior. El manejador y las dependencias GTK son exclusivos de Linux.

El rechazo de micrófono se muestra ahora en español, sin el texto técnico inglés.

## Validación

- 609 pruebas frontend aprobadas; dos sondas opcionales omitidas. Compilación
  TypeScript/Vite aprobada, con el aviso de tamaño de paquetes ya conocido.
- 339 pruebas Rust aprobadas; 29 sondas opcionales omitidas.
- Prueba adicional en WebKitGTK real con dispositivos simulados: sin manejador
  reproduce `NotAllowedError`; con el manejador y sesión vigente graba WebM/Opus
  no vacío y detiene todos los tracks; otro origen de loopback queda rechazado.
  Se incorpora al workflow Ubuntu. No usa el micrófono físico.
- Pruebas de política cubren origen, puerto, credenciales en URL, audio sin
  sesión, cámara, captura mixta y escritorio. La sesión cerrada deja de estar
  activa para autorizar nuevas capturas.
- Alice nativa se recompiló y se reabrió en el escritorio del propietario.

La prueba acústica del propietario sigue siendo necesaria: micrófono real,
RNNoise, transcripción, respuesta, reproducción y apagado. La prueba simulada
no sustituye esa aceptación. Windows no se volvió a ejecutar desde Ubuntu.

Evidencias privadas: `local/artifacts/ubuntu-r9-2026-11-06/linux-media-*`.

## Comprobación posterior de la entrada física

El propietario indicó después que la escucha permanecía en espera. La auditoría
mostraba sesiones iniciadas sin solicitudes de transcripción. PipeWire confirmó
que WebKit capturaba la entrada **Stereo Microphone**, mientras el micrófono
integrado aparecía como **Digital Microphone**.

Una medición simultánea de cinco segundos por entrada, procesada en RAM sin
guardar ni enviar audio, midió RMS 0,000369 / pico 0,00167 en Stereo y RMS
0,137023 / pico 0,97829 en Digital. Se cambió el dispositivo predeterminado de
Ubuntu a Digital Microphone. Reiniciar sólo la escucha no bastó: PipeWire mostró
que el proceso WebKit existente seguía capturando Stereo Microphone. Se reinició
Alice completa para descartar esa selección retenida.

Una vista WebKit nueva confirmó que el dispositivo por defecto ya era Digital
Microphone. La misma función `getMicrophone` y el filtro `processMicrophone`
recibieron señal física y métricas válidas de RNNoise, sin almacenar audio ni
enviarlo a proveedores. Las métricas no acreditan por sí solas una frase
comprensible ni una respuesta; se dejó pendiente esa confirmación del propietario.
No se redujeron los umbrales de detección ni se cambió Windows.
Metadatos de esta comprobación: `physical-mic-probe-final.json` dentro del
directorio privado de evidencias.

## Primer turno físico confirmado

El propietario realizó además una comparación de ocho segundos con su frase
de prueba. Whisper reconoció la llamada a Alice en el audio original y en el
audio procesado por RNNoise. Ambos audios se mantuvieron en RAM, sin archivos
ni envío a servicios externos para transcribir.

La aplicación real pasó después a `VOICE_TURN_TRANSCRIBED`, recibió la respuesta
de Gemma, guardó el intercambio y completó la síntesis Fish. El propietario
confirmó que **escuchó la respuesta con voz**. La captura PipeWire de Alice ya
apuntaba a Digital Microphone.

Ese turno tuvo 1.347 ms de transcripción, 38.809 ms de respuesta y 2.609 ms de
síntesis: aproximadamente 43 segundos de preparación, sin contar el cierre de
la toma. La latencia de Gemma queda como pendiente relevante de R9; esta primera
respuesta no cierra la aceptación de cinco turnos ni las pruebas con música.
Referencia de la API:
[WebKitGTK permission-request](https://webkitgtk.org/reference/webkit2gtk/stable/signal.WebView.permission-request.html).
