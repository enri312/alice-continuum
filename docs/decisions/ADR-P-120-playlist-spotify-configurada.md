# ADR-P-120 — Playlist de Spotify configurada

Fecha: 2026-11-11. Estado: implementado en Windows.

La orden de reproducir una playlist con nombre se interpretaba como una consulta
distinta de «Tus me gusta» y el adaptador la rechazaba. Abrir Spotify por sí solo
no demostraba que hubiera comenzado esa lista.

La configuración del propietario vive en `ALICE_DATA_DIR/media-playlists.json`,
fuera de Git y dentro del respaldo integral de datos. Rust acepta únicamente
un nombre coincidente o el enlace de esa playlist, valida host HTTPS, ruta e ID
y genera una URI de Spotify. Los aliases previos de «Tus me gusta» conservan su
destino. Una lista desconocida produce un error y no cambia a otra colección.

Windows abre la URI validada y usa los controles de cabecera del área principal
de Spotify. El recibo exige el control «Pausar [nombre]» y el ID exacto del enlace
de contexto dentro de «Vista Estás escuchando». Los enlaces de la biblioteca y
los controles de canciones individuales no acreditan ese contexto. Si falta
evidencia informa el límite; no inventa un recibo de éxito.

Se conservan cancelación de sesión, auditoría sin texto privado, pausa y
reanudación del reproductor. No se añaden tokens, teclas globales, búsquedas
libres de playlists ni cambios en el puente Ubuntu. En Ubuntu las playlists de
Spotify con nombre siguen sin estar disponibles; sus funciones anteriores se
conservan.

[Uso](../runbooks/08-spotify-playlist-privada.md) ·
[Validación](../testing/COGNITIVE_R9_CONTINUATION_REPORT_2026-11-11.md).
