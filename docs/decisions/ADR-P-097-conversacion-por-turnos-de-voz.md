# ADR-P-097 — Conversación por turnos de voz con Gemma 4

Fecha: 2026-11-03.
Estado: implementado el recorrido guiado; aceptación con la voz del propietario pendiente.

> Actualización posterior: [ADR-P-099](ADR-P-099-sesion-de-voz-y-node-26.md)
> reemplaza la confirmación por turno por una sesión automática, a petición del
> propietario. Este recorrido sigue disponible como modo manual opcional.

## Decisión del propietario

Mantener Gemma 4 como modelo principal. LFM3-1.7B y Granite 4.0 H Tiny quedan
como alternativas de evaluación futura, sin descarga ni cambio de motor.
El avatar será lo último. El siguiente incremento de R9 se concentra en escuchar
al propietario y responder mediante voz.

## Recorrido de este incremento

1. Abrir **Hablar con Alice**. Abrir el panel conserva el micrófono apagado.
2. Pulsar **Iniciar Gemma y hablar**. Se inicia o reutiliza exclusivamente el
   runtime propio de Gemma. Sólo después de que esté listo se solicita el micrófono.
   Si el modelo no puede iniciarse, no se abre captura.
3. Pulsar **Terminé de hablar y transcribir**. Se apagan las pistas y se entrega
   la toma a transcripción local. La transcripción se añade al borrador existente.
4. Revisar el borrador, revisar contexto y autorizar el mensaje como hasta ahora.
5. Cuando llega la respuesta, el modo de voz prepara automáticamente la vista
   previa nativa de Fish desde el intercambio persistido correspondiente.
6. Autorizar el texto exacto para generar y reproducir audio temporal. No se
   confirma Fish automáticamente. La reproducción termina o puede detenerse.

Cerrar el modo invalida las operaciones pendientes de captura/transcripción y
descarta audio. No cancela por fuerza una inferencia ya enviada al motor; su
resultado tardío no se añade al borrador. Si se cancela una síntesis ya enviada,
se descarta su resultado al llegar; no se promete cancelar el procesamiento o el
consumo del proveedor.

## Límites y fallos

- Máximo de captura: 60 segundos y 8 MiB. Al alcanzar 60 segundos se conserva la
  toma para transcripción manual; no se infiere consentimiento por vencimiento.
- Se solicita audio mono, reducción de ruido y cancelación de eco al navegador.
  La calidad depende del dispositivo y de WebView2; estas opciones no garantizan
  una medición acústica ni eliminación total del ruido.
- No se graba mientras Alice está reproduciendo su respuesta: al iniciar otra
  toma se detiene y descarta esa reproducción. El envío y los controles de voz
  se bloquean durante operaciones incompatibles.
- Se liberan pistas y temporizadores al cancelar, cerrar, desmontar la vista,
  superar el tamaño, fallar el grabador o desconectarse el micrófono. Una concesión
  de micrófono que llega después de cancelar se cierra inmediatamente.
- Una transcripción fallida puede reintentarse desde la toma en RAM. El borrador
  previo se conserva. No se promueve el audio ni el texto a recuerdo confirmado.
- La voz requiere historial verificable, credenciales nativas de Fish y una
  respuesta dentro del límite de caracteres existente. Si falta alguno, se
  conserva el texto y se informa el problema.

No se implementa escucha continua, detección automática de fin de frase, palabra
de activación, interrupciones de dúplex completo ni expresiones del avatar.
Tampoco se modifica en esta entrega la política de contexto conversacional de
ADR-P-096, ni se declara cerrada R9.

## Validación

Las pruebas del controlador de captura usan dispositivos simulados y cubren
liberación de recursos, cancelación tardía, error, desconexión y límites. La sonda
Rust opcional usa una fixture sintetizada localmente y ejecuta el decodificador,
la construcción de solicitud y una inferencia acústica real con Gemma; no llama
a Fish ni escribe en los almacenes canónicos. No equivale a validar voz humana
en español.

Ver [informe R9](../testing/R9_VOICE_TURNS_REPORT_2026-11-03.md) y
[runbook de voz](../runbooks/03-conversacion-y-voz.md).
