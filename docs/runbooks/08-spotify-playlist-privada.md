# Playlist privada de Spotify en Windows

En conversación local de Alice puedes pedir «abre Spotify y reproduce la
playlist [nombre]», «pausa Spotify» y «reanuda Spotify». «Mis favoritos» sin
servicio se reconoce como petición de Spotify; otros nombres deben indicar el
servicio. La ruta escrita y la ruta de voz usan el mismo backend; la aceptación
con micrófono se comprueba por separado.

La configuración se guarda en `ALICE_DATA_DIR/media-playlists.json`. Con el
lanzador Windows del proyecto corresponde a `D:\Alice Continuum\data\media-playlists.json`.
El propietario ya configuró su lista localmente. El archivo se mantiene fuera
del repositorio público y se incluye en el respaldo de la carpeta de datos.

Formato de referencia con un ID ficticio:

```json
{
  "schemaVersion": 1,
  "spotify": {
    "name": "Mi lista de ejemplo",
    "url": "https://open.spotify.com/playlist/0123456789ABCDEFGHIJKL"
  }
}
```

El nombre debe coincidir con el de Spotify. Sólo se admite una lista configurada;
pedir otra no abre una búsqueda ni sustituye la selección por «Tus me gusta».
Esta colección anterior sigue disponible mediante sus aliases habituales.

Spotify debe tener una sesión abierta y canciones reproducibles. Para acreditar
la lista seleccionada, Alice comprueba el contexto en «Vista Estás escuchando»;
si está cerrada intenta abrirla con su propio botón. Si Spotify cambia la
accesibilidad, no muestra el contexto o requiere autenticación, Alice informa
que no pudo confirmar la reproducción. El control no modifica la cuenta ni
añade canciones a la biblioteca.

Las playlists de Spotify con nombre están implementadas en Windows. Ubuntu
conserva «Tus me gusta», pausa y reanudación; esta ampliación todavía no está
conectada al puente MPRIS/AT-SPI.
