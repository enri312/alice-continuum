# R9 Ubuntu: latencia y música

Fecha: 2026-11-06. Equipo real: Ubuntu 26.04.1, RTX 3050 de 4 GB, Gemma 4 E2B
Q4_K_M con llama.cpp b10809/Vulkan. El alcance es mejorar la espera y conectar
Spotify/YouTube sin modificar los motores, entornos ni valores de Windows.

## Inferencia

Se compararon procesos aislados, uno a la vez, con el mismo contexto de voz
sintético, 870 tokens de entrada y 35 de salida. Temperatura 0, semilla 42 y
`cache_prompt=false`. Las tres respuestas fueron iguales. Es una medición por
perfil, no una distribución de percentiles ni una prueba de voz completa.

| Capas GPU | Proyector | Tiempo HTTP | VRAM ocupada al medir |
|---|---|---|---|
| 24 | GPU | 1,650 s | 2503 MiB |
| 35 | GPU | 1,103 s | 2794 MiB |
| Todas (`99`) | GPU | 0,963 s | 2873 MiB |

La configuración privada Ubuntu utiliza `ALICE_GPU_LAYERS=99`. La mejora de esta
comparación es aproximadamente 42 %. El proyector en CPU resultó más lento y se
descartó. Windows conserva 24 capas; Ubuntu sin configuración explícita conserva
su valor predeterminado de CPU. No se prescribe este perfil a otros equipos.

El turno físico anterior tardó 38,809 s en Gemma, más Whisper y Fish (unos 43 s
de preparación). Ese retraso inicial no se reprodujo en estas pruebas: su causa
no se considera resuelta ni se promete una respuesta oral en un segundo. Falta
medir cinco turnos reales con el perfil final y los reproductores abiertos.

La prueba nativa de arranque/inferencia/parada del motor propio pasó con el
perfil final; verificó que los 45 archivos canónicos de datos no cambiaron.
No se mantuvo un motor de benchmark junto al motor cotidiano.

## Música y alcance autorizado

Spotify utiliza su aplicación Snap real con sesión iniciada, MPRIS y sus controles
accesibles AT-SPI. `OpenUri` y `Play` por sí solos no iniciaban la colección; se
activa el botón específico **Reproducir Tus me gusta** y después se verifica el
estado real. Una segunda orden de reproducción no pulsa Pausar por accidente.
Pausa y reanudación usan el transporte propio. Si hay un anuncio, el recibo lo
indica; no se eluden anuncios ni restricciones de Spotify Free y no se fuerza un
orden de canciones. La búsqueda de otras colecciones de Spotify no está incluida.

Chrome usa un perfil propio de Alice y accesibilidad nativa, sin depuración
remota, inyección de teclas ni acceso al perfil habitual. Se comprueban propietario,
ejecutable y argumento exacto de perfil del proceso antes de leer sus páginas.
Las acciones sólo recorren documentos de YouTube permitidos. El cierre de Alice
revoca futuras acciones del ayudante sin cerrar los reproductores externos.

Tras la aclaración del propietario, **YouTube sólo admite su playlist configurada**
en `ALICE_YOUTUBE_PLAYLIST_URL`, guardada en `local/ubuntu.env` privado. No se
guardan su ID, enlaces personales ni credenciales en las pruebas publicadas.
La búsqueda general por nombres se retiró del adaptador Ubuntu. Otras canciones,
otras listas y referencias de una reproducción anterior ajena se rechazan antes
de abrir búsquedas o enviar controles.

Para confirmar reproducción se exige el panel de la playlist solicitada y el
botón de pausa del reproductor. Se configura repetición de la lista completa,
se corrige el modo de repetición de un solo video y se desactiva el aleatorio.
El botón actual de YouTube tiene tres estados sin `aria-pressed`: su nombre
indica la siguiente acción («Repetir playlist», «Repetir video indefinidamente» o
«Desactivar la repetición indefinida»). La interpretación se contrasta con el
final real del último video; ni el texto de un botón ni la simulación de UI
por sí solos acreditan la repetición. El propietario también confirmó un ensayo
que repetía sólo el último video antes de corregir la configuración.

Los nombres y estados de los controles se consultan directamente en D-Bus
AT-SPI, porque la caché de libatspi conservaba nombres anteriores. Las relaciones
de hijos de Chrome se vuelven a consultar al navegar, para no activar controles
pertenecientes al árbol anterior. Se exige el
estado estable en dos observaciones y se reconocen el atajo nativo `k`, el botón
de reinicio de un video terminado y las etiquetas localizadas. Primero se inicia
el reproductor y después se configura la repetición, ya que reiniciarlo puede
recrear su estado. Se activa únicamente una pestaña de YouTube del perfil propio;
si no se puede elegir una pestaña sin ambigüedad, se pide seleccionarla.

Se desactiva la reproducción automática externa si su control está presente.
La vuelta al inicio depende del control nativo de repetición de YouTube;
[YouTube documenta ese control](https://support.google.com/youtube/answer/10788593?hl=es).
No se sustituye una lista inaccesible por un video suelto o por recomendaciones.

## Validación y límite de aceptación

- Frontend: 609 pruebas aprobadas, dos sondas opcionales omitidas; compilación
  TypeScript/Vite aprobada, con el aviso conocido del tamaño de los paquetes.
- Rust: 342 pruebas aprobadas, 31 sondas opcionales omitidas; formato y Clippy
  de todos los targets con advertencias como errores aprobados.
- Python: 19 pruebas aprobadas. Incluyen política de lista única, URLs engañosas
  y parámetros duplicados, salida del padre, no confirmar reproducción sólo por
  URL, lista privada y reproductor accesible con tres modos de repetición.
  El ensayo con reproductor simulado comprueba los controles observados en el
  escritorio, reinicio de estado al comenzar a reproducir, repetición completa,
  aleatorio apagado, autoplay apagado, idempotencia, pausa y reanudación.
- La prueba nativa ignorada `live_linux_owned_music_acceptance` usa el mismo
  ejecutor Rust que la voz, una ventana Tauri oculta y datos temporales. Sus tres
  pasos de Spotify (Tus me gusta, repetición de la orden y pausa) pasaron con la
  cuenta real antes de iniciar sesión en YouTube. Ese fallo previo se conserva
  en `media-native-before-private-signin.log`.
  El ensayo final completo **pasó**: dos órdenes de Tus me gusta, pausa de Spotify,
  reproducción de la lista privada de YouTube, pausa y reanudación. Se comprobó
  desde el ejecutor nativo Rust en unos 11 segundos, con datos aislados.

El enlace recibido carga el video **Upside Down** sin sesión, pero la página
canónica de la lista muestra **«La playlist no existe»**. El propietario confirmó
que la lista es privada e inició sesión por sí mismo en la ventana de Alice.
La lista completa ya carga con esa sesión; no se copiaron credenciales ni cookies.
La apertura/reproducción de ese video se había tomado inicialmente como evidencia
de lista; se corrigió la condición. No acredita la playlist ni su repetición.

La prueba opcional `scripts/testing/linux-media-repeat-acceptance.py` selecciona
el último video disponible, configura la repetición después de esa navegación y
observa su final real. No toma una orden de avance aceptada por accesibilidad como
prueba de que el video haya terminado. Su registro conserva las identidades del
último y del primero para comprobar que no se cambió de playlist.

**Aprobada:** el último video de 73 segundos terminó de forma natural y volvió
al primero, reproduciendo dentro de la misma lista y conservando repetición
completa. El ensayo duró aproximadamente 91 segundos. Una lectura independiente
del nombre nativo de la pestaña activa confirmó el primer video. La prueba no
utilizó la orden de avance, que había sido aceptada sin producir el salto pedido.

**Pendiente:** aceptar órdenes habladas con música, cinco turnos y la nueva
latencia completa. R9 sigue abierto. Windows conserva sus adaptadores anteriores;
esta preferencia de lista única y repetición deberá verificarse allí al migrar.

Evidencias privadas: `local/artifacts/ubuntu-r9-2026-11-06/`, en particular
`latency-context-benchmarks.json`, `latency-native-gemma.log`,
`media-native-acceptance.log`, `media-linux-rust-tests.log`,
`media-linux-clippy.log`, `media-python-tests.log`, `youtube-repeat-acceptance.log`
y `media-frontend-*.log`.
