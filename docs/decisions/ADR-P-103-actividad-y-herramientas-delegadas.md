# ADR-P-103 — Actividad desde el arranque y aperturas delegadas

Estado: implementado, 2026-11-03. El propietario pidió ordenar el volumen,
mostrar actividad al iniciar y autorizar sólo abrir Spotify y los discos E: y D:.
Después pidió revisar e incorporar tool calling donde resulte útil.

Ampliación posterior: [ADR-P-104](ADR-P-104-musica-spotify-youtube-chrome.md)
autoriza reproducción de Tus me gusta y música de YouTube en Chrome. La
restricción musical descrita aquí corresponde al alcance inicial de esta decisión.

## Actividad observable

Los procesos abandonan las coordenadas del diseño anterior: quedan dentro del
contorno junto a los recuerdos. Se reduce la curvatura de conexiones y se encuadra
el volumen con margen para la leyenda. Los IDs, recuerdos y relaciones no cambian.
El evento real `process.startup`/`PROCESS_STARTED` ilumina Contexto durante la
ventana R3. Otros eventos de sistema no generan rutas cognitivas ficticias.

Un nodo separado «Núcleo en ejecución» pulsa mientras la consulta IPC de actividad
responde correctamente. Indica presencia técnica, no razonamiento ni aprendizaje.
No añade recuerdos, eventos R3 ni aristas. Se retira si la consulta falla. El resto
de señales continúa dependiendo de operaciones reales, con su decaimiento normal.

## Delegación cerrada

Una orden actual puede abrir exactamente Spotify instalado en el perfil del
usuario, o las raíces D: y E: mediante Explorador. No hay parámetros de comando,
rutas libres, borrado, reproducción musical, acceso a otras unidades ni una consola.
Se conserva el modo manual de conversación y la sesión de voz ya autorizada,
sin pedir un permiso adicional por apertura. La delegación aparece en Conversación.

Las órdenes simples completas, como «Alice, abre Spotify» o «abre el disco E»,
tienen una ruta directa para reducir latencia. Las peticiones naturales elegibles,
como «me abres la aplicación Spotify en mi equipo», utilizan el mismo Gemma con
una función `open_desktop_destination(target)` y enum `spotify|drive_d|drive_e`.
Una guarda local exige intención directa y destino explícito en el mensaje actual;
no se pasan historial, RAG, imágenes ni respuestas anteriores a este selector.
Citas, negaciones, condiciones, combinaciones y destinos desconocidos no activan
la herramienta. Las variantes no reconocidas permanecen como conversación.

El backend acepta una sola llamada, nombre exacto, JSON válido sin campos extra y
un destino que coincida con el autorizado por la petición. Tras inferir se vuelve
a validar la sesión de voz/vista antes de actuar. El nombre de función del modelo
no se convierte en comandos ni búsquedas dinámicas de código. Se conserva
`--no-agent`: las herramientas integradas de shell y archivos de llama.cpp no se
habilitan. La aplicación proporciona sólo su función de apertura.

El resultado final usa el recibo real de Windows, con una frase que confirma la
solicitud de apertura, sin inventar que la ventana ya está visible. Esto evita una
segunda inferencia para narrar un resultado simple. El intercambio se conserva en
el historial y puede leerse mediante Fish; no se promueve como conocimiento ni
se clasifica para aprendizaje automático. La auditoría R3 registra la acción y los
fallos. La excepción de productor Capability está cerrada al par
`desktop.approved.open`/`desktop.open`; otras capacidades no adquieren ese acceso.
Las aperturas directas se distinguen de la inferencia para no simular actividad de
lenguaje cuando Gemma no se utilizó.

## Fuentes y verificación

Google documenta [function calling con Gemma 4](https://ai.google.dev/gemma/docs/capabilities/text/function-calling-gemma4),
incluido E2B, como selección de funciones que la aplicación valida y ejecuta.
[llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
documenta la interfaz compatible con `tools` y Jinja. Se comprobó también la ayuda
del ejecutable instalado: `--agent` habilitaría herramientas integradas; no hace
falta para las funciones definidas por Alice.

Ver [informe de actividad y herramientas](../testing/ACTIVITY_DESKTOP_TOOLS_REPORT_2026-11-03.md).
