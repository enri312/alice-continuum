# ADR-P-112: espera dirigida y apagado explícito del micrófono

Fecha: 2026-11-06. Estado: aceptada.

El propietario probó «Hola, Alice, ¿me escuchas? Quiero seguir mejorándote» y la
respuesta atribuyó correctamente la mejora a Alice. La orden siguiente quedó
transcrita como «Detend la conversación, Alice» y recibió una respuesta de Gemma.
No se da por aceptada una conversación de cinco turnos con ese único resultado.

## Comportamiento

Iniciar la escucha autoriza la misma sesión temporal existente, con máximo de dos
horas. El micrófono empieza en **espera**. Cada frase se transcribe localmente y
se comprueba su dirección antes de enviarla al diálogo, historial, herramientas
o Fish. Las frases sin llamada directa se descartan. Se admite «Alice…», saludos
directos y determinadas preguntas/órdenes con vocativo final, como «¿Me escuchas,
Alice?». Una simple referencia a Alice en una narración no se toma como llamada.

«Detén la conversación, Alice» vuelve a espera sin respuesta de Gemma/Fish ni
revocación de la escucha. Se reconoce también la grafía ASR observada «Detend»,
sólo dentro de esa orden completa. «Apaga el micrófono, Alice», «Deja de escuchar,
Alice», el botón Apagar micrófono, salir o vencer la sesión cierran la captura y
revocan la autorización. Las pausas no renuevan el plazo de dos horas.

Las órdenes de control se evalúan antes del diálogo. Se rechazan citas,
negaciones y menciones explicativas como órdenes ejecutables. Las frases
descartadas no aparecen en Último mensaje atendido ni en el historial; la
transcripción mantiene sus metadatos de auditoría existentes, sin guardar audio.

## Límites

Es un filtro de texto ASR, no un detector acústico dedicado, identificación de
Carlos ni comprensión general de intención. En este incremento se requiere
«Alice» en cada frase que se quiera atender, también después de una respuesta.
Otra voz que formule una llamada admitida puede activarlo. Se conservan pausas
de captura mientras transcribe, procesa o habla; no se incorpora barge-in.

La espera no escucha al arrancar el programa: el propietario la inicia. No se
activan cámara ni escritorio y no se aprende de las conversaciones descartadas.
Gemma, Whisper, Fish y sus claves/voz se conservan. El siguiente paso acústico
requiere evaluación en español, no instalar un framework como prueba de aceptación.

## Protección del servidor de desarrollo

Una sonda HTTP ficticia confirmó que Vite servía archivos de `data/`. Se bloquean
los directorios privados bajo la raíz concreta del proyecto, además de conservar
los patrones predeterminados de credenciales. El alcance de la raíz evita bloquear
accidentalmente todo AppData/Local en Windows. No se cambian ACL del equipo.

Los pilotos toman únicamente fixtures sintéticas preparadas explícitamente en
`scripts/testing/.fixtures/`, ignorado en Git. No se habilita el acceso HTTP a
`local/`, recuerdos, modelos ni activos privados para ejecutar QA.

[Pruebas y aceptación pendiente](../testing/VOICE_STANDBY_REPORT_2026-11-06.md).
