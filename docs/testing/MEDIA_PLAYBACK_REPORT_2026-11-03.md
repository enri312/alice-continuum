# Prueba de música delegada — 2026-11-03

Contrato: [ADR-P-104](../decisions/ADR-P-104-musica-spotify-youtube-chrome.md).
Seguimiento: el propietario encontró un fallo posterior con órdenes habladas
compuestas. Esta prueba inicial cubrió cuatro frases concretas; no garantizaba
la comprensión de las variantes transcritas. Ver
[regresión y corrección](MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).
Entorno: Windows, Node 26.13, Rust 1.99.1, Gemma 4 E2B local, Spotify instalado
y Google Chrome instalado. Evidencia privada en
`artifacts/media-playback-2026-11-03/` (excluida de Git).

## Resultado nativo

Alice se inició mediante el lanzador normal con `ALICE_DATA_DIR` apuntando a
`artifacts/media-playback-2026-11-03/native-data`, sin reutilizar el historial ni
los recuerdos reales. Se enviaron cuatro órdenes por la interfaz de Conversación:

| Orden | Respuesta de Alice | Comprobación |
|---|---|---|
| Reproduce mis me gusta en Spotify | Spotify está reproduciendo Tus me gusta. | Spotify mostraba su colección y el botón «Pausar Tus me gusta». |
| Pausa Spotify | Spotify quedó en pausa. | El adaptador comprobó el estado de transporte. |
| Continúa Spotify | Spotify está reproduciendo de nuevo. | El adaptador comprobó Playing. |
| Pausa Spotify | Spotify quedó en pausa. | La interfaz final de Spotify mostraba «Reproducir Tus me gusta». |

Spotify quedó **pausado**. No se cambiaron canciones guardadas, volumen,
repetición ni orden aleatorio. La captura `spotify-pause-proof.png` muestra el
recibo final en Alice; sus cero recuerdos corresponden al almacén de prueba.
La aplicación de prueba se cerró al terminar. No se activaron cámara, micrófono
ni Fish para estas comprobaciones.

No se reprodujo ninguna canción de YouTube: el propietario indicó que la pedirá
él mismo. Su búsqueda en Chrome, selección y verificación de reproducción están
implementadas, con cobertura local, pero no se presentan como aceptación viva.

## Pruebas automáticas

- Rust: **314 aprobadas, 27 ignoradas**, cero fallos (`rust-tests-final.log`).
- Frontend: **533 aprobadas, 2 omitidas** (`frontend-tests.log`).
- Compilación TypeScript/Vite aprobada; conserva el aviso existente de tamaño de
  paquetes (`frontend-build.log`).
- Clippy con advertencias como errores y compilación nativa aprobados: registros
  `clippy-final.log` y `native-build-final.log`.
- Sonda real Gemma: una prueba ignorada ejecutada explícitamente, dos selecciones
  de `control_media` válidas para Spotify y un título ficticio de YouTube
  (`live-tools-final.log`). No abrió reproductores ni ejecutó la búsqueda.

La cobertura local incluye gramática de órdenes, títulos con signos y apóstrofes,
alias de Tus me gusta, citas y negaciones, argumentos de herramienta divergentes,
URLs y enlaces no autorizados, coincidencia de títulos y cancelación antes de
interactuar con Windows. Las comprobaciones nativas no dependen del modelo para
declarar que el reproductor está reproduciendo o pausado.

Durante el desarrollo fallaron una búsqueda HTTP anónima de YouTube y la versión
del esquema con campos nulos. Esa búsqueda se retiró a favor de la página de
Chrome, y el contrato se cambió a cadenas con validación de alias. Los resultados
anteriores se conservan como historial de diagnóstico, no como pruebas aprobadas.

## Datos y límites

El registro de memoria confirmada y el perfil del propietario se contrastan por
SHA-256 con `confirmed-before.json`; la comprobación final se guarda en
`confirmed-data-check.json`. Los comandos de música se excluyen del aprendizaje
automático. El servicio y vídeo recientes sólo viven en RAM.

La comprobación final confirmó ambas huellas intactas. Tras cerrar la copia de
prueba se recompiló el ejecutable y se inició Alice mediante su lanzador normal
con `E:\Alice Cognitive Core\data`. El registro de arranque y el proceso nativo
confirman que quedó ejecutándose con la raíz habitual; no se trasladaron datos
de prueba a esa carpeta (`canonical-launch*.log`).

La integración depende de las interfaces accesibles actuales de Spotify/Chrome
y de sus sesiones abiertas. Los estados ambiguos o no verificables devuelven
fallo. Las cuentas, anuncios y diálogos de YouTube no se omiten automáticamente.
La prueba escrita no valida ASR, calidad de voz ni interrupción durante TTS.
