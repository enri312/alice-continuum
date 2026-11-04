# Actividad, aperturas y tool calling — validación

Fecha: 2026-11-03. Contrato: [ADR-P-103](../decisions/ADR-P-103-actividad-y-herramientas-delegadas.md).

## Resultado

Los nodos de proceso usan coordenadas dentro del contorno cerebral. Se reduce la
curvatura de aristas y se deja margen para la leyenda, sin cambiar la identidad de
recuerdos o relaciones. El evento real de arranque aparece en Contexto; un nodo
separado de presencia técnica pulsa cuando la consulta IPC nativa responde.
No se fabrican recuerdos, conexiones, eventos ni actividad de razonamiento.

Alice acepta órdenes actuales para abrir sólo Spotify y las raíces D: y E:.
Las órdenes simples utilizan una ruta rápida. Las variantes naturales elegibles
usan Gemma con `tools`, una sola función y argumentos enum. El ejecutor valida
nombre, JSON, campos, destino coincidente e intención actual, y revalida las
sesiones después de la inferencia antes de ejecutar. El resultado se conserva
como intercambio normal y admite la síntesis por voz existente. No se usa como
aprendizaje automático. No hay funciones de shell ni parámetros de ruta libres.

El recibo de ejecución indica que Windows recibió la solicitud; no certifica
que una ventana esté visible. Las aperturas directas usan auditoría de capacidad,
sin simular inferencia lingüística. La excepción de productor R3 está limitada
al identificador y operación de esta capacidad. R1 registra 41 capacidades.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Frontend completo | 533 aprobadas, 2 omitidas |
| Rust, biblioteca | 307 aprobadas, 26 sondas ignoradas |
| Sonda real de herramientas Gemma | 1 aprobada, con tres destinos |
| Clippy de biblioteca, `-D warnings` | Aprobado |
| TypeScript/Vite | Compilación aprobada; aviso previo de tamaño de paquetes |
| Ejecutable Windows final | Compilación aprobada tras liberar el ejecutable anterior |
| Rustfmt de módulos modificados | Aprobado |
| `git diff --check` y vínculos locales nuevos | Aprobados |

La sonda real pidió Spotify, E: y D: mediante tres frases naturales. El mismo
Gemma E2B Q4 instalado produjo llamadas OpenAI-compatible a
`open_desktop_destination` con los argumentos exactos `spotify`, `drive_e` y
`drive_d`. Cada respuesta pasó por el validador nativo. Consumieron 153/153/152
tokens de entrada y 17/19/19 de salida. La prueba no ejecutó esas funciones ni
abrió aplicaciones: valida la selección y el contrato del modelo sin efectos.
No escribió datos canónicos, no usó Fish ni cargó otro modelo. Si inició un
runtime propio, lo cerró; si ya había servidor, no adoptó ni cerró ese proceso.

Las pruebas negativas cubren citas, negaciones, relatos, condicionales, destinos
C:/F:, rutas, comandos combinados, función inventada, campos extra, destino
cambiado y ausencia de llamada. Una prueba detectó que «mañana» no se normalizaba
como la guarda esperaba; se corrigió y la petición diferida queda rechazada por
el selector. Las órdenes desconocidas siguen como diálogo sin apertura automática.

## Revisión visual y aplicación nativa

La página aislada utiliza el componente real con 12 recuerdos y ocho procesos
sintéticos, identificados explícitamente. La captura muestra todas las señales
dentro del contorno y la leyenda libre. No hubo errores de consola.
`artifacts/vision-conversation-2026-11-03/ordered-volume.jpg`.

Una copia nativa con datos separados arrancó, pero el controlador de interfaz
no pudo inspeccionarla por su estado minimizado. Se cerró sólo ese proceso de
prueba, identificado por ruta y PID. No se automatizaron aperturas reales mediante
esa copia ni se afirmó que Spotify o Explorador hubieran abierto sus ventanas.

Los intentos de reemplazar el ejecutable principal mientras seguía bloqueado por
Windows fallaron con acceso denegado. La biblioteca, pruebas y Clippy sí compilaron.
Tras liberar el proceso anterior, la compilación final del ejecutable aprobó en
26,44 segundos y su fecha quedó posterior a todas las fuentes nativas. Se reabrió
el lanzador habitual, con los datos canónicos. Ver el log
`artifacts/vision-conversation-2026-11-03/native-final-build.log`.

## Datos

Las huellas finales conservan 45 archivos y el contenido de la memoria confirmada,
perfil y respaldos anteriores. Historial, auditoría y archivos de memoria automática
cambiaron por la conversación real del propietario durante el trabajo; no se
sobrescribieron esas novedades. La revisión sintética y las sondas no escribieron
allí. Sus materiales están bajo `artifacts/`, ignorado por Git.

Las autorizaciones son específicas de apertura. No incluyen reproducción de
Spotify, automatización general, edición/borrado, otras unidades ni reconocimiento
facial. La precisión general de Gemma o una política para cualquier frase española
no se deducen de tres llamadas aprobadas.

La reapertura habitual terminó correctamente: Vite quedó disponible y Tauri
compiló/ejecutó el binario final. Se verificaron en la ventana principal los
controles de Vista de Alice y la lista «Aperturas autorizadas: Spotify · disco D:
· disco E:». El propietario ya inició la voz en esa instancia; no se cambió de
pantalla ni se interrumpió esa sesión para tomar otra captura. La prueba visual
del volumen permanece identificada como sintética.
