# Regresión de órdenes habladas y reproducción — 2026-11-03

Contrato vigente: [ADR-P-104](../decisions/ADR-P-104-musica-spotify-youtube-chrome.md).
Amplía la [prueba inicial](MEDIA_PLAYBACK_REPORT_2026-11-03.md) tras el reporte del
propietario: Alice decía que reproduciría música y no lo hacía.

## Causa comprobada

El historial real mostró estas transcripciones:

- «Alista abre abre el Spotify y reproducir la música.»
- «ah, abres Spotify y reproduces mi playlist.»
- «Abres Spotify y reproduce mi mi música.»

El parser inicial no admitía la combinación abrir/reproducir Spotify, las formas
«abres»/«reproduces», los alias «mi playlist»/«mi música» ni las repeticiones.
Los mensajes pasaban al diálogo con Gemma, que generaba promesas de acción.
Los IDs eran `chatcmpl-`, sin recibo `desktop:media:`. Spotify no estaba abierto
al comenzar esta revisión. La prueba anterior sólo había cubierto órdenes
separadas y no detectó esta regresión de lenguaje hablado.

## Corrección

- Se reconoce abrir y reproducir el mismo servicio como una acción acotada.
  Se aceptan formas naturales, prefijos de voz, «Alista» como transcripción
  observada de Alice y repeticiones de apertura/alias de colección.
- «Mi música» y «mi playlist» resuelven Tus me gusta de Spotify, según la elección
  del propietario. No se habilitan playlists arbitrarias ni otros programas.
- Los títulos de YouTube conservan signos, apóstrofes y palabras originales.
  No se aplica la corrección de repeticiones a nombres de canciones.
- Una petición directa no entendida o el servicio aislado recibe una aclaración
  nativa, sin actuar ni completar órdenes del historial. Las instrucciones del
  modelo también prohíben prometer acciones sin un recibo real.
- Los errores de selección de herramienta se devuelven como respuesta musical
  fallida, igual que los del ejecutor, conservando la sesión de voz. La
  cancelación explícita mantiene su efecto.
- Se admite «abres Spotify» también como apertura independiente. El arranque de
  Spotify sin ventana disponible espera hasta 60 segundos; con el reproductor
  abierto mantiene 18 segundos como máximo. Se termina antes al confirmar el
  estado. El error ya no afirma haber abierto una colección que no observó.
- Se añade respaldo de pausa/reanudación con UI Automation, limitado al grupo
  Controles del reproductor de Spotify, cuando no hay sesión de Windows o no
  confirma la orden. Se verifica el botón opuesto y se rechaza una selección
  ambigua. No se usan teclas multimedia globales.

## Verificación

Los resultados de pruebas, compilación y ejecución nativa de esta revisión se
guardan en `artifacts/media-voice-fix-2026-11-03/`, fuera de Git.
Las pruebas de regresión usan las frases exactas del fallo y comprueban también
citas, negaciones, condiciones, peticiones narradas y títulos con signos.

- Rust: **317 aprobadas, 27 ignoradas** (`rust-tests-final.log`).
- Frontend: **533 aprobadas, 2 omitidas** (`frontend-tests.log`).
- Clippy con `-D warnings`, compilación TypeScript/Vite y compilación nativa
  aprobados (`clippy-final.log`, `frontend-build.log`, registro del lanzador nativo).
- Sonda Gemma real aprobada: tres selecciones de función, incluida
  «¿Puedes abrir Spotify y reproducir mi playlist?». Spotify recibió `play` y
  colección predeterminada. El título ficticio de YouTube se conservó literalmente
  (`live-tools.log`). La sonda no ejecuta herramientas ni abre reproductores.

La aceptación viva se realiza con un almacén de datos separado y mediante la
interfaz de Alice, usando la transcripción que falló. Esto comprueba el camino
desde el texto reconocido hasta el reproductor; no sustituye una nueva prueba
acústica de micrófono/ASR ni una prueba audible de Fish.

La primera ejecución nativa sí abrió Spotify, que lanzó su propio actualizador.
El límite anterior de 18 segundos terminó antes de que el programa expusiera
sus controles; se obtuvo un recibo fallido en vez de una respuesta de Gemma.
Se observó el instalador y posteriormente la colección Tus me gusta disponible.
Este caso motivó el presupuesto de arranque de 60 segundos; no se inició una
instalación manual ni se cambiaron preferencias de Spotify.

Otro intento de pausa devolvió que Windows no tenía una sesión multimedia de
Spotify disponible. Este fallo quedó registrado, sin afirmarse una pausa que
no ocurrió. Se incorporó el respaldo por controles del propio Spotify para no
depender exclusivamente del registro de sesiones de Windows.

No se elige una canción de YouTube para el propietario; su reproducción real
continúa pendiente de la canción que él indique. Los archivos confirmados,
perfil, recuerdos automáticos e historial habituales se contrastan por SHA-256
con `data-before.json`.

## Aceptación reanudada — 2026-11-04

Tras la suspensión de la sesión se retomó la misma corrección y se probó el
ejecutable nativo desde Alice, con datos separados en
`artifacts/media-voice-fix-2026-11-04/native-data`.

| Mensaje enviado desde Alice | Resultado comprobado |
|---|---|
| Abres Spotify y reproduce mi mi música. | Spotify está reproduciendo Tus me gusta. |
| Pausa Spotify | Spotify quedó en pausa. |
| Continúa Spotify | Spotify está reproduciendo de nuevo. |
| Pausa Spotify | Spotify quedó en pausa. |

Los cuatro intercambios tienen recibos nativos `desktop:media:` correctos y
quedan resumidos en `qa-results.json`. Se comprobó también en Spotify el botón
**Reproducir Tus me gusta** al finalizar, que confirma el estado pausado
(`spotify-final-controls.txt`). No se cambió volumen, orden aleatorio, repetición
ni la colección guardada. El almacén de prueba mantuvo cero recuerdos.

La compilación nativa reanudada terminó correctamente (`qa-launch-error.log`).
Se conservan los resultados automáticos de la corrección: 317 pruebas Rust y
533 del frontend aprobadas, Clippy y compilación de interfaz aprobados. No hubo
cambios posteriores en ese código durante la revisión del HTML.

Los cuatro archivos habituales —memoria confirmada, perfil, memoria automática
e historial— conservaron sus SHA-256 (`data-check.json`). Se cerró la copia de
prueba y se reinició Alice con la raíz habitual `E:\Alice Cognitive Core\data`.
La verificación escrita utiliza la transcripción exacta del fallo; no acredita
una nueva toma acústica ni la calidad audible de Fish. YouTube sigue pendiente
de la canción elegida por el propietario.
