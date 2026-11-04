# ADR-P-102 — Cámara y escritorio en conversación local

Estado: implementado, 2026-11-03. Decisión del propietario: incorporar visión de
la cámara del equipo y del escritorio; actualizar el icono del Volumen Cognitivo.

## Comportamiento

Conversación ofrece **Activar cámara**, **Compartir escritorio**, vistas previas
plegables y **Detener vistas**. Cada fuente empieza apagada y se activa una vez por
sesión. No hay aprobación por fotograma. Un selector permite escoger la cámara
por nombre y se prefiere la integrada reconocible cuando Windows la enumera.
El permiso inicial de cámara pertenece a Windows/WebView2.

Gemma 4 E2B y su proyector instalados reciben una imagen reciente por fuente al
enviar un turno escrito o hablado. No se carga otro modelo ni se hace inferencia
continua. El micrófono conserva su ciclo de voz existente. El escritorio se
captura mediante Windows GDI: todos los monitores del escritorio virtual, sólo
píxeles visibles, hasta 1600 píxeles de lado. No incluye ventanas minimizadas,
archivos cerrados, otros escritorios ni contenido protegido que Windows oculte.
La cámara se reduce a 960 píxeles de lado (640 como segundo intento).

El token nativo vincula las fuentes activadas y vence después de dos horas.
Detener, cambiar de motor, salir de Conversación o cerrar la aplicación termina
la vista; se cierran las pistas de cámara. Las operaciones tardías no reabren
sensores. El backend rechaza imágenes con otro proveedor, fuentes distintas a
las autorizadas, PNG inválidos, dimensiones fuera del límite, base64 mayor de
4 millones de caracteres o cámara de más de 30 segundos al recibir el pedido.

Las imágenes viajan sólo al servidor local Gemma. No se escriben fotogramas en
disco, historial, RAG ni auditoría. Las **respuestas textuales** sí forman parte
del historial normal; al hablar, la respuesta sigue la síntesis Fish ya habilitada.
El aprendizaje automático sigue evaluando sólo las declaraciones del propietario,
no imágenes ni afirmaciones de Alice sobre ellas.

## Contexto y límites

Para dejar espacio a dos imágenes en contexto 4096, la ruta visual usa un prompt
breve, hasta 700 caracteres del final de las referencias autorizadas y el mensaje
actual completo (máximo 1600 caracteres). Su salida tiene límite de 240 tokens por
voz y 360 por texto. La ruta sin imágenes conserva su compositor anterior. El
recorte puede perder parte del historial o RAG: con vista activa conviene nombrar
el objeto o detalle concreto que se quiere revisar. La exactitud visual, el texto
pequeño y los referentes siguen dependiendo del modelo; una captura no equivale
a observación continua ni a autenticación facial del propietario.

El registro R1 añade `perception.conversation.vision`, separado de los antiguos
diagnósticos OpenCV/R2 y de las notas visuales Ollama. Esta sesión explícita
sustituye la aprobación por intento para la visión durante la conversación que
solicitó el propietario. Los adaptadores anteriores conservan sus contratos.
El avatar y los landmarks faciales no se conectan en este incremento.

## Icono

`cognitive-neural-volume.svg` conserva la familia visual del proyecto e incorpora
corteza bilateral ilustrativa, pliegues, dendritas y colores de memoria. El dibujo
es un símbolo de navegación, no evidencia de neuronas biológicas ni actividad viva.

## Verificación

Ver [informe de visión](../testing/CONVERSATION_VISION_REPORT_2026-11-03.md).
