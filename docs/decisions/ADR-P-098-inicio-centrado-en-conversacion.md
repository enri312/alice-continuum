# ADR-P-098 — Inicio centrado en conversación

Fecha: 2026-11-03. Estado: implementado.

## Decisión

La antigua pantalla «Entrada e identificación» pasa a presentarse como
**Conversación**, el espacio cotidiano para escribir y hablar con Alice.
El propietario autorizó simplificar su contenido y actualizar el icono según
su nueva función.

El historial aparece antes del cuadro de mensaje. Se muestran estados del turno
derivados de las operaciones existentes: micrófono apagado, preparación,
grabación, transcripción, respuesta, síntesis y reproducción. La presencia de un
modelo configurado no se presenta como prueba de que esté cargado.

El diagnóstico se abre mediante un acceso secundario, cerrado inicialmente.
Se monta sólo al abrirlo, con controles diferenciados para capturar o congelar
su propia vista. Se explica que el tiempo del análisis local no es la latencia
de Gemma y que las palabras segmentadas no son el tokenizador del modelo.
Se retiran los controles duplicados y el acceso deshabilitado a un replay futuro.

Los documentos conservan su vista previa independiente, en un segundo acceso
cerrado. Abrir el diagnóstico o los documentos no sustituye el chat, no envía
el borrador y no activa observación, micrófono ni inferencia.

Se compacta la navegación sólo al estar en Conversación y se omite visualmente
el encabezado técnico repetido. Las demás pantallas mantienen sus dimensiones.
El icono usa el sistema SVG existente: mensajes de texto, respuesta vocal y
micrófono por turnos, con autorización explícita. El generador produce
`cognitive-conversation-channel.svg`; se retiran el SVG y la escena anteriores.

## Compatibilidad

Se conserva la ruta interna `identificacion`, el export `Identificacion`, la
organización de los tres espacios y los formatos de datos. No hay migración de
memoria o historial, ni cambios en permisos, proveedores, prompt o contratos IPC.
La voz conserva las autorizaciones de [ADR-P-097](ADR-P-097-conversacion-por-turnos-de-voz.md).

Ver [informe de interfaz](../testing/CONVERSATION_HOME_REPORT_2026-11-03.md).

## Actualización del icono — 2026-11-04

Tras incorporar voz por sesión, reducción local de ruido y contexto visual,
el propietario solicita que Conversación refleje esas funciones en su icono.
La escena conserva el chasis, los mensajes y la paleta cian/violeta. Un micrófono
central identifica la escucha; un módulo inferior representa el filtrado antes
de transcribir y un monitor con lente representa las vistas opcionales. La
respuesta vocal sigue representada por la onda en el segundo mensaje.

Se retira el interruptor de revisión por turno, que no describe la conversación
automática vigente. El icono representa funciones disponibles; no indica que
micrófono o cámara estén activos. Los indicadores reales permanecen en la página.
Se conservan ruta, nombre accesible, permisos y comportamiento de las sesiones.

El generador admite nombres de archivo para regenerar únicamente los iconos
solicitados: `npm run icons:generate -- cognitive-conversation-channel.svg`.
Sin argumentos mantiene la generación completa. Ver
[verificación visual](../testing/CONVERSATION_ICON_REPORT_2026-11-04.md).
