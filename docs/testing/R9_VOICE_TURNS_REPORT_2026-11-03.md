# R9 — Conversación por turnos de voz

Fecha: 2026-11-03. Decisión: [ADR-P-097](../decisions/ADR-P-097-conversacion-por-turnos-de-voz.md).

## Resultado

Se mantiene Gemma 4 E2B y se completa el recorrido guiado existente: preparación
del modelo desde voz, captura manual, transcripción local al terminar, borrador
revisable, respuesta textual y vista previa Fish preparada automáticamente en
modo de voz. El envío externo continúa requiriendo autorización del texto exacto.
La vista previa y el reproductor reciben foco para quedar visibles.

La captura ahora tiene un controlador propio, probado con dispositivos simulados.
Cancela permisos tardíos, libera pistas y temporizadores, detecta desconexión y
errores, limita 60 segundos/8 MiB y descarta callbacks de tomas canceladas. No se
permite enviar el borrador mientras se captura o transcribe. El texto anterior
se conserva al incorporar una transcripción.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm test` | 485 aprobadas, 2 sondas omitidas; 56 archivos aprobados, 2 omitidos. |
| `npm run build` | Aprobado; persisten avisos por paquetes mayores de 500 kB. |
| `cargo build --offline --locked --manifest-path src-tauri/Cargo.toml` | Ejecutable y biblioteca compilados; avisos informativos del enlazador. |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib --quiet` | 293 aprobadas, 23 sondas ignoradas. |
| Sonda `voice_input::tests::live_synthetic_voice_transcription` | Aprobada con FFmpeg y Gemma reales; reconoció Java y Python en la fixture. |
| Ventana nativa de Alice | Panel de voz inicialmente apagado; Gemma iniciado desde la UI; inferencia local ficticia y preparación de vista previa Fish comprobadas. |
| Fish Audio real | Una síntesis autorizada de frase ficticia breve; R3 registró `VOICE_SYNTHESIS_COMPLETED` en 2.597 ms. |
| Datos canónicos | 43 archivos antes y después, sin diferencias de SHA-256. |

La muestra acústica se generó con Microsoft Zira Desktop en inglés, porque el
equipo no ofreció una voz sintética española mediante System.Speech. Se convirtió
a WebM/Opus y pasó por las mismas funciones de decodificación, solicitud y parseo
que usa el comando de transcripción. El runtime de la sonda fue cerrado al salir.
No se usaron grabaciones personales previas ni se abrió el micrófono físico.

La prueba de interfaz usó `ALICE_DATA_DIR` y perfil WebView2 separados, dentro de
`artifacts/r9-voice-2026-11-03/`. Allí se guardó un intercambio ficticio para probar
la respuesta y su identidad nativa. Se comprobó primero la preparación automática
de Fish tras responder con el modo de voz abierto. Tras ajustar el foco de la
vista previa se repitió la preparación manual y se generó una síntesis real del
texto ficticio mostrado. El audio no apareció como archivo en la raíz de datos
de prueba y el reproductor temporal se retiró; no se observó un error de reproducción.
No se evaluó por escucha la pronunciación, el tono ni el dispositivo de salida.

Las fixtures sintéticas y logs de desarrollo permanecen en `artifacts/`, fuera
de Git. Los controles nuevos no cambian los formatos de memoria, el contexto
autorizado, los permisos R2 existentes ni los adaptadores del avatar.

## Pendiente de aceptación

Probar con el propietario, desde [el runbook](../runbooks/03-conversacion-y-voz.md):

1. Voz humana española, selección del micrófono predeterminado y permiso WebView2.
2. Precisión de nombres y frases con ruido real, silencio y correcciones.
3. Escucha de la voz Fish, volumen, salida de audio y demoras por turno completo.
4. Varios turnos para comprobar calidad y continuidad de las respuestas.

Esta entrega no declara R9 cerrada ni conversación continua. La exclusión de las
respuestas anteriores de Alice del contexto permanece como en ADR-P-096; su
evaluación sigue pendiente. No se ejecutó `clippy` ni un empaquetado distribuible.
Las diferencias previas de `cargo fmt --check` documentadas en la revisión inicial
no se corrigieron en este incremento.

Para reproducir la sonda opcional, generar una fixture sintética con las palabras
Java y Python, configurar `ALICE_VOICE_TEST_WEBM` con su ruta y ejecutar:

```powershell
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib voice_input::tests::live_synthetic_voice_transcription -- --ignored --exact
```

Requiere Ollama disponible sin modelos activos y el puerto 18089 libre. No ejecutar
contra un motor ya utilizado por otra instancia de Alice.
