# ADR-P-104 — Música en Spotify y YouTube con Chrome

Estado: implementado, 2026-11-03. Amplía [ADR-P-103](ADR-P-103-actividad-y-herramientas-delegadas.md)
por petición del propietario: reproducir música después de abrir Spotify y abrir
YouTube en Google Chrome para reproducir la canción solicitada. El propietario
eligió **Tus me gusta** como colección de Spotify; elegirá después las canciones
de YouTube. No se solicita una confirmación adicional por cada acción musical.

## Comportamiento

«Reproduce mis me gusta» abre la colección propia de Spotify y activa su botón de
reproducción. «Pausa Spotify» y «Continúa Spotify» controlan sólo su sesión de
transporte multimedia de Windows. No se elige otra playlist ni se modifican sus
canciones, volumen, orden aleatorio o repetición. No se usa Spotify Web API.

Si Windows no expone una sesión de Spotify o no confirma el cambio, se usa como
respaldo el grupo accesible **Controles del reproductor** de la propia ventana
de Spotify. Sólo se invocan los botones exactos Reproducir/Pausar y se espera
el cambio al botón opuesto antes de confirmar. No se controlan filas de canciones,
la cola ni otros reproductores. Varias ventanas candidatas producen un error.

Corrección de órdenes habladas del mismo día: también se admiten «abre Spotify
y reproduce mi música», «abres Spotify y reproduces mi playlist» y las
repeticiones observadas en la transcripción («abre abre», «mi mi música»).
«Mi música» y «mi playlist» designan Tus me gusta, que eligió el propietario.
No seleccionan una playlist arbitraria. La combinación abrir/reproducir controla
un único servicio explícito. Los títulos de YouTube conservan su texto original.
Si Spotify no tiene ventana disponible, se permite hasta un minuto de arranque
para contemplar carga o actualización del propio programa. Un reproductor ya
abierto conserva el límite de 18 segundos; ambos caminos responden antes si
confirman el estado. Un vencimiento informa que se envió la solicitud sin
asegurar que la colección quedó abierta o reproduciendo.

«Reproduce [canción] de [artista] en YouTube» abre una ventana de Google Chrome,
busca el título con la sesión habitual del navegador, selecciona un enlace de
vídeo que coincida y comprueba el control de reproducción del reproductor. Sólo
se aceptan URLs HTTPS de YouTube y vídeos con ID válido. «Abre YouTube» abre su
inicio sin elegir música. También se admiten pausa y continuación de un vídeo
identificable; ante varias ventanas candidatas se devuelve un error explícito.
El consentimiento de YouTube, anuncios, acceso a cuenta o cambios de interfaz
pueden impedir la comprobación: Alice informa el fallo en vez de afirmar éxito.

Los controles sin servicio explícito resuelven el último servicio que Alice abrió
o controló correctamente durante esta ejecución. Este contexto es efímero y no
proviene del historial ni del RAG. Tras reiniciar conviene nombrar el servicio.

## Selección y ejecución

Las órdenes sencillas siguen una ruta nativa. Las variantes reconocidas con
«puedes» o «podrías» usan el mismo Gemma mediante
`control_media(service, operation, query)`. Todos los argumentos son cadenas:
`spotify|youtube|last`, `open|play|resume|pause` y título o cadena vacía.
El esquema evita campos nulos ambiguos en este modelo pequeño. La aplicación
exige una sola llamada, función exacta, campos conocidos y argumentos que
coincidan con la orden actual. Los alias de Tus me gusta se normalizan a la
misma colección fija. El texto de una canción nunca se ejecuta como comando.

El selector no recibe historial, RAG ni imágenes. Citas, relatos y condiciones
no conceden autoridad. Se conserva `--no-agent` en llama.cpp; Alice no proporciona
una consola ni automatización general. Los ejecutores comprueban cancelación de
voz/vista antes de abrir ventanas o activar controles.

`media_actions.rs` contiene intención, contrato, validación y auditoría;
`media_windows.rs` implementa UI Automation y transporte multimedia de Windows.
Chrome se inicia mediante su ejecutable instalado, sin puertos de depuración ni
cambios de perfil. La búsqueda usa la página del navegador, no extracción HTTP
anónima. La capacidad `desktop.approved.media` eleva el registro R1 a **42**.
La excepción R3 está limitada al par `desktop.approved.media`/`desktop.media`.

Sólo se confirma reproducción después de observar el estado correspondiente.
Los fallos se devuelven como respuesta conversacional legible y audible; no deben
cerrar por sí mismos la sesión de voz. Los intercambios `desktop:` quedan en el
historial y auditoría, pero se excluyen del aprendizaje automático de recuerdos.

Si una petición directa de Spotify/YouTube no se puede interpretar, la aplicación
devuelve una aclaración indicando que no envió una orden. No deriva esa petición
a Gemma para generar una promesa de ejecución. El nombre del servicio aislado
tampoco ejecuta una petición anterior. Las instrucciones conversacionales
refuerzan que únicamente un recibo nativo permite confirmar acciones. Un error
de selección de herramienta, igual que un fallo del reproductor, se comunica
sin cerrar por sí mismo la sesión de voz; las cancelaciones siguen deteniéndola.

## Verificación y fuentes

Se verificaron con Alice nativa reproducción de Tus me gusta, pausa,
continuación y pausa final. La ejecución se hizo con datos separados; Spotify
quedó pausado. Gemma seleccionó las dos herramientas musicales en una sonda sin
ejecutarlas. La reproducción real de YouTube queda pendiente de la canción que
el propietario indique. Ver [informe](../testing/MEDIA_PLAYBACK_REPORT_2026-11-03.md).

El propietario reportó después que sus órdenes habladas no reproducían música.
La revisión encontró frases no reconocidas que recibieron promesas de Gemma,
sin llamada nativa. Ver [corrección y regresión](../testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

Referencias de implementación: [controles multimedia de Windows](https://microsoft.github.io/windows-docs-rs/doc/windows/Media/Control/struct.GlobalSystemMediaTransportControlsSession.html),
[UI Automation de Chrome](https://developer.chrome.com/blog/windows-uia-support-update),
[enlaces en UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-supporthyperlinkcontroltype)
y [controles del reproductor de YouTube](https://support.google.com/youtube/answer/7631406).
