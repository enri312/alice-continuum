# Pilotos aislados de ASR y Dioxus

Fecha: 2026-11-13. Alcance: experimentos, no adopción en Alice.

El propietario autorizó probar ambas alternativas por separado y condicionó su
incorporación al proyecto principal a una validación satisfactoria. Aplazó la
sección «Persistencia y Grafos: Evolución futura de R6 y R8» hasta una revisión
profunda del proyecto. No se cambia la memoria canónica, su esquema ni su índice.

## Preservación

- Respaldo integral verificado antes de preparar los pilotos:
  `D:\Alice Backups\Alice Continuum\snapshot-2026-11-13T17-08-24-037Z-ca8956e8-47e5-4164-a088-c67e22be4678`.
- Baseline privado: `local/experiments/baseline-20261113.json`, HEAD `836b8b5`.
- Revisión posterior: **364/364 archivos de producción idénticos**, sin archivos
  añadidos o eliminados en ese alcance. SHA-256 agregado:
  `521d00fd55e1cb178cb517308ab3cc1a373d0c7244c69ae9d6e396104b03f83d`.
- Documento original del propietario conservado, sin incluirlo en este commit.
  Datos vivos tratados por separado; no se exige que permanezcan inmóviles
  mientras Alice funciona ni se usan como fixtures.
- Código de pilotos en `experiments/` (privado desde el 14 de noviembre); modelos,
  binarios descargados, corpus, entornos, cachés, temporales y resultados privados
  bajo `local/experiments/` en D:, fuera de Git.
- Sin cambios a `src/`, `src-tauri/`, manifiestos raíz, dependencias operativas,
  launcher, configuración del micrófono o proveedores. Sin instalaciones globales.

No se repiten las suites operativas de Alice por estos experimentos: la
preservación se comprueba por huellas y cada piloto tiene sus propias pruebas.
El respaldo en el mismo disco conserva el límite de protección ya documentado.

## Dioxus-Web: Estado y controles

`experiments/dioxus-state/` (carpeta local privada) contiene
un crate con workspace y lock propios. Dioxus facade **0.7.0**, componentes
internos compatibles **0.7.10**, wasm-bindgen crate/CLI **0.2.105**, Rust
**1.99.1** en toolchain privado D:. No requiere dx, Trunk ni npm.

- Build release real a WASM y empaquetado: **aprobados**, salida 0, 2 min 33 s.
- **4 pruebas Rust** de fixtures y **4 pruebas Python** del servidor aprobadas.
- Conserva ocho métricas, ocho controles informativos bloqueados, memoria
  recuperada, inspector, etiquetas y procedencia. Cinco escenarios: actividad,
  inactividad, carga, lectura no disponible y auditoría degradada.
- Sin IPC, polling, micrófono, backend de Alice, recuerdos o archivos privados.
  El servidor sólo sirve su distribución en loopback. La CSP permite compilación
  WASM, sin habilitar `eval` de JavaScript.
- Arranque observado en Chrome mediante Computer Use. Se detectó y corrigió el
  aviso de preparación que permanecía sobre la interfaz: el estado de arranque
  queda fuera del contenedor Dioxus y se elimina después de montar. También se
  captura el fallo de importación del módulo; no hizo falta recompilar Rust.
- En navegador se comprobaron los cinco escenarios, el inspector de Inhibición
  (0.620 con actividad), los controles de Creatividad y Estilo empático, y
  Tab/Enter con foco visible. Seleccionar un control bloqueado sólo cambia su
  descripción. El aviso de preparación desaparece tras la recarga corregida.
- Tras la observación del propietario sobre la pérdida del diseño, se ajustó
  sólo el CSS del piloto para recuperar la paleta de Alice, paneles angulares,
  filas compactas, estados turquesa/gris/ámbar y foco visible. Se observó la vista
  final de escritorio y el encabezado/inspector con viewport emulado de 420 × 800.
  La revisión estrecha fue parcial; no se afirma aceptación móvil exhaustiva ni
  comparación visual exacta con React a 1000/1440 px. La página quedó en vista
  normal y las herramientas de desarrollo cerradas.

La revisión por código confirma el contrato; el build no demuestra una mejora
de rendimiento. Integración Tauri, adaptador de lectura real, paridad de datos y
medición comparable de recursos siguen fuera de este incremento.

### Ajuste de deslizadores y memoria de ejemplo

El propietario confirmó que `experiments/` es el laboratorio previo a una posible
incorporación al principal. Dentro del piloto Dioxus se ajusta la presentación de
los ocho controles de comportamiento a deslizadores nativos con pista y tirador,
manteniendo `disabled` y sus valores informativos. Un botón separado conserva la
selección del inspector; no se anidan controles interactivos dentro de botones.
Las barras de señales internas siguen siendo indicadores.

La fila de memoria recuperada usa la categoría **EPISODIC** y el texto solicitado
**«USER: TEST de Personalidad Múltiple y Libre Albedrío → Alice»** como fixture
identificado como sintético. Los escenarios sin recuperación mantienen el estado
vacío. No se genera un recuerdo real ni se implementa libre albedrío o control de
personalidad. La memoria canónica y la aplicación principal quedan fuera del cambio.

**Validación del ajuste:** compilación release WASM y empaquetado aprobados,
salida 0 (14,83 s iniciales; 1,18 s en el build final tras ajustar accesibilidad).
Las cuatro pruebas de modelo existentes pasaron nuevamente. No se repitieron
las pruebas del servidor, cuyo código no cambió. Logs privados:
`local/experiments/dioxus-state/slider-build-20261113.log` y
`slider-model-tests-20261113.log`.

En Chrome se observaron las ocho pistas/tiradores; accesibilidad los expone como
sliders deshabilitados con nombre y valor. La fila anuncia `EPISODIC`, texto
completo y actividad 0,460. Seleccionar el nombre de Inhibición abrió el inspector
con 0,620; arrastrar el tirador no modificó ese valor. La vista quedó abierta en
una ventana de revisión separada. La revisión actual es de escritorio; no se
afirma nueva aceptación completa a otros anchos o dentro de Tauri.

La revisión por código corrigió la cascada de columnas a 481–1120 px y la fila
de etiquetas en móvil; la etiqueta accesible de memoria incluye su categoría.
Los 364 archivos protegidos de producción siguen idénticos al baseline. Las
ocho pruebas y observaciones del apartado anterior conservan su alcance histórico.

## ASR: método

`experiments/asr-comparison/` (carpeta local privada)
compara el CLI whisper.cpp instalado con faster-whisper **1.2.1**, CTranslate2
**4.9.0**, small multilingüe, CPU de cuatro hilos e INT8 para faster-whisper.
El tipo efectivo informado por CTranslate2 fue **int8_float32**. Venv propio
Python **3.14.8** y PyAV **18.0.0**. Modelo oficial Systran fijado a la revisión
`536b0662742c02347bc0e980a01041f333bce120`, comprobado localmente y usado offline.

Los dos motores reciben los mismos tres WAV españoles sintéticos, generados
localmente con eSpeak NG del portable Piper. No se instala una voz de Windows
ni se usa Fish, una API de inferencia, micrófono o grabación personal. Las
descargas oficiales usan HTTPS con verificación TLS normal, sin credenciales.

La comparación por proceso incluye inicio/carga. Una segunda prueba conserva
faster-whisper cargado; esa inferencia caliente no equivale al tiempo completo
del CLI. No se vacían cachés del sistema ni se cierran aplicaciones del usuario.
No incluye captura, RNNoise, FFmpeg, respuesta de Gemma o síntesis/reproducción TTS.

El runner limita entrada y salidas, tiempo y procesos propios, y suministra un
entorno reducido explícito también a curl. Las pruebas cubren límites, timeout,
cancelación, fallo al iniciar hilos, limpieza y diagnóstico fatal con exit 0
antes de puntuar transcripciones. Ningún fallo debe contarse como silencio válido.
**13 pruebas unitarias del piloto aprobadas**, más preflight real de los tres WAV,
comparación por proceso y dos pasadas persistentes con salida 0. No son nuevas
pruebas de micrófono ni las suites de producción de Alice.

## ASR: resultados y defectos encontrados

Se corrigieron dos fallos de preparación antes de obtener una comparación válida:
faltaba `vocabulary.txt` en la lista de activos del modelo, y PyAV 19.0.2 ya no
admitía `metadata_errors`, usado por faster-whisper 1.2.1. Se fijó PyAV 18.0.0,
con wheel oficial compatible, y se añadió un preflight que decodifica los tres
WAV sin cargar el reconocedor. Las dos ejecuciones fallidas se conservan
separadas; sus tiempos no se contabilizan como inferencia válida de faster-whisper.

Una ejecución válida por frase y motor, en orden CLI seguido de faster-whisper,
sin compilaciones concurrentes. Otras aplicaciones del propietario permanecieron
abiertas: no fue una máquina dedicada y no hay intervalo de confianza.

| Fixture español sintético | Audio | CLI: proceso completo | faster-whisper: proceso completo | Errores/palabras CLI | Errores/palabras faster |
|---|---:|---:|---:|---:|---:|
| Pausa Spotify | 1.250 s | 5.905 s | 5.242 s | 7/3 | 7/3 |
| Reproducir playlist | 2.950 s | 6.214 s | 5.404 s | 3/8 | 2/8 |
| Pregunta pausada | 3.101 s | 6.177 s | 5.629 s | 1/8 | 1/8 |
| Mediana de tiempo / total de errores | — | **6.177 s** | **5.404 s** | **11/19** | **10/19** |

WER normalizado global: 57.9% CLI y 52.6% faster-whisper. Las inserciones permiten
que el WER de una frase supere el 100%; 7 errores sobre 3 palabras equivalen a
233.3%. No se interpreta esta muestra como precisión general ni de voz humana.
Ambos motores perdieron la orden «pausa Spotify». Faster-whisper conservó
«reproduce» en la playlist; el CLI lo cambió. El nombre «Alice» se alteró en las
tres frases de ambos motores. **Ninguno justifica una adopción por exactitud.**

En los tres procesos nuevos de faster-whisper, importación: 0.725–0.843 s;
carga: 1.185–1.569 s; inferencia: 2.747–2.895 s. El tiempo total también incluye
arranque, preparación y cierre; no equivale sólo a sumar esas tres mediciones.
El CLI mantuvo sus flags operativos, sin instrumentar carga/inferencia separadas;
no se afirma equivalencia de todos los parámetros internos de decodificación.

La prueba persistente de faster-whisper importó en 1.016 s y cargó en 1.425 s.
Segunda pasada de inferencia: 2.861, 3.188 y 2.674 s; mediana **2.861 s**. No hay
CLI persistente equivalente en este piloto; esa cifra no es una comparación
directa con los 6.177 s completos ni demuestra la latencia futura de Alice.

Los informes privados están en `local/experiments/asr-comparison/evidence/`:
`comparison-20261113-195010.json` y `warm-20261113-195053.json`. El primer informe
válido conservó el ID `stdin` del worker en tres filas; la copia revisada enlaza
cada una mediante el SHA-256 del WAV, sin cambiar tiempos o transcripciones.
El original se conserva y el código ya evita sobrescribir el ID del corpus.

Resultado: el candidato funciona en laboratorio, con una diferencia temporal
limitada y exactitud insuficiente en este corpus. El motor operativo de Alice
permanece intacto. No se extienden las garantías de límites del runner al volumen
de salida del instalador PowerShell; la instalación queda fuera de la medición.

## Condiciones para una posible adopción

R9 sigue abierta. Un resultado sintético no acredita precisión con voz baja,
rápida, pausada, música o eco. Antes de cambiar el motor activo se necesitan
comparaciones equivalentes con tomas reales autorizadas, acciones sin verbos
inventados, latencia completa y los cinco turnos cotidianos pendientes.

Dioxus requiere aceptación de contenido e interacción, varios anchos y teclado,
medidas comparables y una integración nativa reversible. Mantener un único
responsable de lectura y conservar los contratos y permisos actuales.

La persistencia y los grafos R6/R8 quedan expresamente aplazados; no se amplían
las materias del autoestudio ni se añaden funciones a Conversación.
