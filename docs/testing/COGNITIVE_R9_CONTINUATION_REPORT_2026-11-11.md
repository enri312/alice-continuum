# Continuación del núcleo, Volumen y Spotify R9

Fecha local: 2026-11-11. Entorno: Windows, `D:\Alice Continuum`.

## Cambios

- Autoestudio: un coordinador separa el ciclo activo del reinicio pendiente.
  Pausa invalida su generación; una respuesta anterior no puede cambiar
  lecciones ni fases después de reanudar. Activación redundante conserva el
  estado y no encola otro ciclo. El arranque pausado no reserva un worker.
- Icono: volumen bilateral más abierto, nodos persistentes, crecimiento
  observado ilustrado mediante un halo, estados de revisión y recuperación
  diferenciados y guía plegada. Conserva el inspector de procedencia, los
  procesos transitorios y el lenguaje visual SVG del proyecto. Sólo se regeneró
  `cognitive-neural-volume.svg`; se comparte entre ambas entradas existentes.
- Spotify Windows: selección por nombre de la única playlist configurada en
  los datos privados. Se conserva «Tus me gusta» y se rechazan nombres o IDs
  ajenos. El recibo comprueba el control de cabecera y el enlace del contexto
  actual dentro de «Vista Estás escuchando». Abrir una URI no basta.

## Conservación

Antes de editar se creó y verificó el respaldo integral privado
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-12T01-36-46-233Z-f6fda5b7-6ba2-4ae7-b441-70018c67c155`.
La fecha del nombre está en UTC. El código anterior se archivó en
`local/backups/cognitive-r9-20261111/source-before.zip`, SHA-256
`481516549751481f5fd3578e23fdc31d0b310659b930bbac2bbcd8f37d2879da`.

Las huellas de los 132 archivos de datos existentes se mantuvieron iguales
durante la edición y las pruebas aisladas, antes de reabrir Alice. Se añadió
únicamente `data/media-playlists.json` con la selección indicada por el
propietario. Este archivo está ignorado por Git y forma parte del respaldo
integral de datos. No se publica el enlace, ID, cuenta ni contenido de la lista.

Al abrir la sesión canónica se ejecutó el autoestudio habitual y se guardó el
intercambio de prueba mediante la ruta normal de conversación. Esos cambios
posteriores son actividad real de la aplicación; no se presentan como una
comparación de datos intactos ni se revierten para fabricar esa comparación.

## Comprobaciones automatizadas

- Frontend: **702 aprobadas, 2 sondas opcionales omitidas**.
- Obsidian: **15 aprobadas**. Respaldo/restauración: **20 aprobadas**.
- Rust: **376 aprobadas, 30 sondas opcionales omitidas**.
- Formato Rust, Clippy de todos los targets con `-D warnings`, compilación
  nativa y compilación TypeScript/Vite aprobados. Vite conserva su aviso de
  tamaño de chunks; no es un fallo nuevo de esta entrega.

Las regresiones nuevas cubren reinicio coalescido antes de liberar el worker,
cancelación del pendiente, petición después de liberar, arranque pausado,
activación redundante sin escrituras y rechazo de respuesta/fase canceladas.
Las pruebas de playlist usan un ID ficticio y almacenes temporales: verifican
nombre, URL, ID de contexto, rechazo de destinos ajenos y que «Mis favoritos»
no se normalice a «Tus me gusta», incluidos punto final y comillas del dictado.

## Comprobación nativa

Se reabrió Alice mediante su lanzador normal. El icono nuevo apareció en la
navegación real de Tauri, manteniendo accesible el Volumen y su contenido.

Con Spotify cerrado se escribió en Alice una orden directa para abrirlo y
reproducir la playlist configurada. Se utilizó la previsualización existente y
el procesamiento local, con micrófono, cámara y escritorio compartido apagados.
Spotify abrió la lista, mostró «Pausar [nombre]» en la cabecera y el enlace de
contexto con su ID exacto dentro de «Vista Estás escuchando». Alice devolvió
el recibo local de reproducción confirmada. La observación anterior de una
sesión manual ya reproduciendo no se contó como prueba de la orden de Alice.

Esta comprobación acredita la ruta escrita y el estado de reproducción del
servicio. No acredita por sí sola sonido audible del dispositivo, reconocimiento
de la frase por Whisper, escucha con música, latencia de voz ni continuidad de
cinco turnos. No se pulsó escucha ni se enviaron voces a Fish para esta prueba.

## Límites y continuación

Las playlists de Spotify con nombre están conectadas sólo al adaptador Windows;
Ubuntu conserva sus funciones previas. No se añadieron permisos de control
general del PC, tokens de Spotify, nuevas materias ni entrenamiento de pesos.

Siguiente aceptación: la misma orden hablada y una conversación de cinco turnos
con música, junto con recuperación de una lección aprobada y actualización de
Obsidian. Los cierres de R1 a R8 y los pendientes restantes de R9 se conservan.
