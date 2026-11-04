# Visión conversacional e icono — validación

Fecha: 2026-11-03. Contrato: [ADR-P-102](../decisions/ADR-P-102-vision-conversacional-local.md).

## Resultado

Conversación incorpora activación independiente de cámara y escritorio, selector
por nombre de cámara, vistas previas plegables y Detener vistas. El envío común
conecta las imágenes con preguntas escritas y turnos automáticos de voz. Gemma 4
E2B y su proyector son los mismos; no se añade un modelo de visión independiente.

El backend captura el escritorio virtual Windows con GDI, hasta 1600 píxeles de
lado y reducción adicional a 1280/960 si el PNG supera el límite. La cámara usa
getUserMedia sin audio y toma PNG nuevos por turno. El micrófono existente sigue
independiente. Las sesiones nativas validan fuentes, proveedor, vencimiento y
revocación; los resultados tardíos no se incorporan después de detener la vista.

La ruta visual conserva el mensaje actual y recorta las referencias para dejar
espacio a las imágenes. La revisión manual explica este ajuste y distingue su
presupuesto de texto de las imágenes que se capturan al enviar. El registro R1
incluye una capacidad de visión conversacional, separada de los diagnósticos
anteriores. El icono del Volumen representa corteza, pliegues y dendritas ilustrativos.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Frontend completo | 532 aprobadas, 2 omitidas |
| Revisión final focalizada de conversación, sesión visual e iconos | 183 aprobadas |
| Rust, biblioteca | 303 aprobadas, 25 sondas ignoradas |
| Sonda real con Gemma, dos imágenes sintéticas | 1 aprobada; 2550 tokens de entrada |
| TypeScript/Vite | Compilación aprobada |
| Clippy de biblioteca, `-D warnings` | Aprobado |
| Rustfmt de los módulos modificados | Aprobado |
| `git diff --check` | Aprobado |

Las pruebas de sesión cubren inicio apagado, imagen nueva por turno, permisos de
cámara tardíos, inicio nativo tardío, parada durante cierre de la sesión previa,
descarte de captura tardía y liberación de pistas ante error. Rust comprueba
revocación, sustitución segura de sesiones, TTL, fuentes no autorizadas, proveedor
externo rechazado, base64/PNG/tamaños/antigüedad y contexto opcional acotado.

La sonda multimodal envió al servidor local dos PNG sintéticos de 512×512:
cuadrado rojo etiquetado cámara y círculo azul etiquetado escritorio. Gemma
respondió correctamente ambas fuentes y figuras en 17 tokens, sin truncamiento.
No usó cámara, escritorio personal, Fish ni almacenes de conversación/memoria.
La primera ejecución encontró el servidor apagado tras la recarga de desarrollo;
la sonda se ajustó para iniciar y cerrar únicamente su propio runtime cuando no
hay otro escuchando. La ejecución final aprobó. Si ya existe servidor, realiza
una sola petición ordinaria sin adoptar ni cerrar su proceso.

## Interfaz y hardware

La inspección de la aplicación nativa mostró Vista activa con cámara y turnos
visuales reales de la sesión del propietario. No se transcriben sus mensajes o
imágenes aquí. La selección de dispositivo permite corregir que Windows elija
la cámara conectada del teléfono. No se automatizaron permisos del sistema ni
se certificó la exactitud de una escena personal o autenticación facial.

La captura real del escritorio y el cambio físico entre cámaras requieren la
comprobación del propietario desde sus controles; la sonda de dos fuentes usa
imágenes sintéticas y no demuestra acceso a todos los monitores del equipo.
La integración GDI está compilada en el ejecutable nativo de Windows.

Se revisaron los componentes reales en una página de desarrollo aislada, sin
sensores y sin errores de consola. Captura:
`artifacts/vision-conversation-2026-11-03/vision-preview.jpg`. La lámina identifica
explícitamente que los botones están deshabilitados en el navegador de revisión.

## Datos conservados

Se registraron huellas SHA-256 antes y después: 45 archivos locales en ambos
momentos, sin archivos añadidos o eliminados por esta tarea. Los registros
confirmados, perfil y respaldos anteriores conservan sus huellas. Durante la
prueba real del propietario cambiaron historial, auditorías y los dos archivos de
memoria automática, como corresponde a la conversación activa. No se restauraron
ni sobrescribieron esos cambios. Las pruebas sintéticas no escribieron allí.

La imagen no se guarda en historial/RAG; el texto de la respuesta visual sí se
conserva como respuesta normal. La exactitud visual, lectura de texto pequeño,
latencia y resolución de referentes siguen limitadas por el modelo. Vista activa
no es vídeo continuo, reconocimiento facial ni acceso a archivos sin abrir.

Seguimiento de la misma sesión: el ejecutable final con visión, actividad y
herramientas se compiló correctamente tras liberar el archivo de Windows; ver
[validación final](ACTIVITY_DESKTOP_TOOLS_REPORT_2026-11-03.md).
