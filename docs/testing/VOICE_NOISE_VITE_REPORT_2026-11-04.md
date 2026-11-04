# Reducción de ruido y Vite — 2026-11-04

Se incorpora RNNoise local antes de WebM/Opus tanto en la sesión de voz como en
el dictado manual. Gemma 4 continúa como modelo de transcripción y conversación.
Contrato: [ADR-P-105](../decisions/ADR-P-105-supresion-local-ruido-vite.md).

## Puertas automáticas

| Comprobación | Resultado |
|---|---|
| `npm test` | 553 aprobadas, dos sondas omitidas, 66 archivos |
| `npm run build` | TypeScript y Vite 8.3.5 aprobados |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet` | 317 aprobadas, 27 sondas omitidas |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Aprobado |
| `npm audit` | Cero vulnerabilidades tras Vitest 4.1.12 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprobado tras aplicar formato al código previo |
| Documento HTML | 23 identificadores únicos; 88 enlaces/recursos revisados sin destinos ausentes |

Se conserva el aviso previo de tamaño de chunks de la aplicación y avatar. El
Worker de ruido es un recurso separado de unos 4,82 MB que contiene WASM/modelo;
se inicia al preparar una toma, sin un CDN. Los avisos Apache 2.0 y BSD quedan
en `public/licenses/` y se copian con el frontend.

Las regresiones verifican: grabación de la señal filtrada, cancelación durante
permiso y preparación del filtro, aborto de recursos, fallos sin audio crudo de
respaldo, ausencia de ASR ante ruido sin voz, palabras breves sostenidas, pausas,
dirección opcional y parada de voz. Dos pruebas del enlace AudioWorklet simulan
320 ms de demora y un Worker que no responde: el primer caso conserva salida,
el segundo termina la captura con una cola acotada a cincuenta tramas.

## Procesamiento real de audio sintético

El piloto `scripts/testing/voice-noise-pilot/` se compila con Vite y se sirve
localmente. Usa los mismos módulos de procesamiento y MediaRecorder que Alice,
con una CSP que permite únicamente scripts/Workers propios y compilación WASM.
No abre el micrófono, no conecta altavoces y no llama a Gemma ni Fish.

La señal hablada proviene de SAPI con una voz inglesa del equipo pronunciando
texto español. Se mezcla con ruido pseudoaleatorio determinista y un tono de
150 Hz. Casos: cinco segundos de ruido, habla limpia y habla mezclada con ruido.
Se comprueba que el ruido no se acepte como turno, que ambas señales habladas
conserven evidencia de voz y que MediaRecorder entregue audio procesado.
Esto no mide inteligibilidad española, WER, separación de cantantes ni latencia
total del diálogo. Las mediciones RMS del piloto no representan cancelación
garantizada de música real.

Una ejecución intermedia sufrió una interrupción; se conserva como
`synthetic-results-interrupted.json` en los artefactos. La causa exacta no se
identificó con esa salida, que ocultaba el primer error tras la pérdida posterior
de señal. El piloto ahora conserva ese primer error por caso. Se amplió el
margen de planificación del enlace de 160 a 500 ms y se añadieron las regresiones
anteriores. La validación final se registra en `synthetic-results.json`.

## Interfaz, datos y aceptación pendiente

Los controles aparecen en la aplicación nativa. **Audio de entrada** empieza
cerrado, permite seleccionar micrófono y distingue cancelación de todo el sonido
del sistema confirmada por el dispositivo de una solicitud del navegador. No
abre hardware al enumerar dispositivos. **Sólo si digo Alice** comienza apagado
y no añade aprobaciones por turno. Los estados de preparación y escucha están
separados.

Después del reinicio se comprobó una toma manual dentro de WebView2: alcanzó
al menos 38 segundos en estado **GRABANDO**, con el filtro listo y sin fallos.
Se pulsó **Descartar toma** y se verificó **Micrófono apagado**. No se transcribió,
no entró al chat, no se envió a Fish y no se exportó audio. Esto valida captura
y liberación de recursos en la aplicación, no inteligibilidad ni calidad acústica.
El dispositivo Intel Microphone Array del equipo no confirmó el modo de eco
`all`; la interfaz muestra ese límite sin anunciar cancelación total de Spotify.
Evidencia visual: `audio-controls-native.png`.

El HTML pasa a v0.55 dentro de sus capítulos y mantiene la portada como primer
contenido y el seguimiento histórico cerrado. Las capturas y resultados están
en `artifacts/voice-noise-2026-11-04/`; no son datos para memoria o RAG.

La ejecución final del piloto aprobó los tres casos sin errores. El arranque
del filtro midió aproximadamente 471 ms en frío y 155–175 ms en las otras tomas;
no son tiempos de transcripción ni del diálogo completo. El ruido acumuló sólo
20 ms de probabilidad alta y no se aceptó como turno; las señales habladas
conservaron unos 6,4 segundos de evidencia de voz.

Se reinició el lanzador normal con `data/` como raíz canónica. El registro de
arranque confirma Vite 8.3.5 y compilación nativa correcta. Los cuatro archivos
de recuerdos, perfil, aprendizaje automático e historial conservaron sus hashes
SHA-256 respecto del inicio de este trabajo; no se añadieron conversaciones QA.

Falta aceptación con Carlos hablando, con música de la notebook y después de
otro equipo. RNNoise no reconoce al propietario ni garantiza separar voz de
otra persona o cantante. El modo opcional de dirección reduce respuestas a
otras voces, pero también exige que Carlos empiece sus frases con Alice. El
procedimiento está en [el runbook](../runbooks/03-conversacion-y-voz.md#música-y-ruido-de-fondo).

## Reproducir el piloto

Generar `artifacts/voice-noise-2026-11-04/synthetic-speech.wav` con SAPI u otra
voz sintética mono, sin conversaciones reales. Después:

```powershell
npx vite build scripts/testing/voice-noise-pilot --outDir ../../../artifacts/voice-noise-2026-11-04/pilot-dist --base ./
python -m http.server 5186 --bind 127.0.0.1 --directory artifacts/voice-noise-2026-11-04/pilot-dist
```

Abrir el piloto local y pulsar **Ejecutar prueba de audio sintético**. El JSON
visible debe indicar `passed: true` y ningún `runtimeError` por caso. Cerrar el
servidor temporal al terminar.
