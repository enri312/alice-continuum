# Comparación ASR aislada

Piloto manual de **whisper.cpp small CPU4** frente a **faster-whisper small multilingüe CPU4 INT8**. No importa código de Alice ni se inicia con el proyecto. No modifica su runtime, launcher, variables de entorno, memoria, modelos activos ni dependencias raíz.

El corpus es **voz española sintética de eSpeak NG**, no el micrófono del propietario. Esta prueba permite comprobar integración, límites y latencia de ese corpus; **no demuestra precisión con voz humana, voz baja, nervios, música o RNNoise**. No se usa Fish, API de inferencia ni credenciales.

## Separación de archivos

- Este directorio: código, requisitos versionados e instrucciones publicables.
- `local/experiments/asr-comparison/`: venv propio, cachés, temporales, descargas, modelos, WAV sintéticos y evidencia privada, todo en D: e ignorado por Git.
- Los binarios Python existentes en C: se ejecutan sin instalar ni registrar nada allí. Windows conserva sus voces sin cambios.
- El motor/modelo actuales de whisper.cpp se leen de D: y nunca se sobrescriben. Se pueden indicar otras rutas con `--cpp-bin` y `--cpp-model`.

## Preparación explícita

Desde la raíz, en PowerShell:

```powershell
$basePython = (Get-Command python.exe -All | Where-Object Source -Match '\\Python314\\python\.exe$' | Select-Object -First 1).Source
& .\experiments\asr-comparison\setup.ps1 -Python $basePython
$pilotPython = Join-Path (Get-Location) 'local\experiments\asr-comparison\venv\Scripts\python.exe'
& $pilotPython -B experiments/asr-comparison/pilot.py prepare-tts
& $pilotPython -B experiments/asr-comparison/pilot.py corpus
& $pilotPython -B experiments/asr-comparison/pilot.py prepare-model
& $pilotPython -B experiments/asr-comparison/pilot.py preflight --limit 3
```

Se usa Python 3.14.8 x64 existente y sólo wheels de PyPI. `-Python` es obligatorio; si no se detecta Python 3.14, indica una ruta compatible existente. `requirements.txt` fija dependencias directas; `requirements.lock.txt` fija también las transitivas evaluadas. `setup.ps1` deriva su directorio privado del checkout y lanza hijos con un entorno reducido propio; no cambia ninguna variable del PowerShell llamador, incluso al fallar. Cada hijo recibe cachés/temp/perfil privados en D:, sin tokens de API ni proxies heredados. Preparación e instalación quedan fuera de la medición.

El modelo se descarga desde **Systran/faster-whisper-small**, revisión fija `536b0662742c02347bc0e980a01041f333bce120`. Los hashes LFS se comprueban cuando están disponibles; se registran SHA-256 y tamaños de cada archivo en la evidencia privada. La inferencia usa una ruta local y modo offline, sin descargas implícitas. Descargas HTTPS con certificados normales mediante curl IPv4/HTTP1.1, sin tokens ni reintentos automáticos. Un archivo `.part` exige inspección antes de volver a descargarlo.

Ese modelo exige **cuatro activos locales**: `config.json`, `model.bin`, `tokenizer.json` y `vocabulary.txt`. Se rechaza una preparación incompleta antes de lanzar los motores. Se fija **PyAV 18.0.0**, cuyo wheel Windows `cp311-abi3` admite Python 3.14: PyAV 19.0.2 eliminó `metadata_errors`, todavía utilizado por faster-whisper 1.2.1. `preflight` comprueba la decodificación real de los tres WAV con `decode_audio`, sin cargar un modelo ASR, antes de medir.

Para TTS se descarga el ZIP portable oficial **Piper 2023.11.14-2** y se utiliza únicamente su biblioteca eSpeak NG y datos españoles incluidos, sin modelo neural TTS. Piper es MIT; eSpeak NG es GPL-3.0-or-later. El repositorio original de Piper está archivado: este binario se limita a generar fixtures del experimento, sin integrarlo en Alice. No se redistribuyen sus binarios. Se registra SHA-256 del ZIP obtenido por HTTPS; no se afirma una firma del fabricante ni un checksum publicado cuando no existe.

## Verificación y medición

```powershell
& $pilotPython -B -m unittest discover -s experiments/asr-comparison -p 'test_*.py' -v
# Ejecutar cuando no haya compilaciones ni otras cargas de evaluación:
& $pilotPython -B experiments/asr-comparison/pilot.py compare --limit 3 --pause 2
& $pilotPython -B experiments/asr-comparison/pilot.py warm --limit 3
```

`compare` abre un proceso y carga el modelo nuevamente para cada WAV/motor, secuencialmente. Mismos bytes SHA-256, idioma `es`, cuatro hilos CPU, sin hints de acciones, sin VAD adicional ni GPU. El CLI conserva exactamente sus argumentos actuales. Se informa tiempo total observado; faster-whisper separa importación, carga e inferencia. No se fuerza vaciado de cachés del sistema, por lo que “cold” significa **proceso/modelo nuevo**, no disco frío.

`warm` conserva una instancia de faster-whisper durante dos pasadas. La segunda es la medición con modelo cargado. **No existe aquí un CLI de whisper.cpp persistente equivalente**: esa cifra no debe compararse directamente con su tiempo completo por proceso ni atribuirse automáticamente a Alice.

El resultado privado incluye texto esperado y obtenido, tiempos y errores de palabras normalizados (minúsculas, sin acentos/puntuación). Esa métrica de tres frases no es una evaluación de precisión general. La memoria física y de compromiso disponibles se comprueba antes de cada proceso; con menos de 1 GiB se evita lanzarlo. No se cierran otras aplicaciones.

Límites del runner de inferencia: `--timeout` (90 s por hijo), `--stdout-limit`, `--stderr-limit` (64 KiB cada uno), entrada máxima 2 MB. Timeout, exceso de salida y Ctrl+C terminan **sólo el proceso hijo creado por el runner**, descartan el resultado y no dejan procesos propios abiertos. No se capturan otros PIDs ni se modifica el sistema. Las descargas tienen su propio límite de 310 s y de tamaño; `setup.ps1` usa un plazo de 5 minutos por hijo y recoge ese hijo antes de cerrar sus recursos, también al fallar. La salida de instalación de pip no tiene la cota del runner y queda fuera de la medición. Los informes JSON están en `local/experiments/asr-comparison/evidence/`.

## Resultado del 13 de noviembre de 2026

**El piloto funciona como experimento; no se adopta en Alice.** Las 13 pruebas del runner y sus contratos pasaron, el preflight decodificó los tres WAV y la comparación final y las dos pasadas del proceso persistente terminaron con salida 0. La precisión de estas frases sintéticas sigue siendo insuficiente para controlar acciones.

Una muestra por frase y motor, con otras aplicaciones abiertas y sin controlar la caché del sistema:

| Frase sintética | Audio | CLI, proceso nuevo | faster-whisper, proceso nuevo | Errores CLI / referencia | Errores faster / referencia |
| --- | ---: | ---: | ---: | ---: | ---: |
| «Alice pausa Spotify» | 1,250 s | 5,905 s | 5,242 s | 7 / 3 | 7 / 3 |
| «Alice reproduce la playlist Mis favoritos en Spotify» | 2,950 s | 6,214 s | 5,404 s | 3 / 8 | 2 / 8 |
| «Alice, dime qué hora es y cómo estás» | 3,101 s | 6,177 s | 5,629 s | 1 / 8 | 1 / 8 |

Medianas de tiempo total por proceso: **6,177 s CLI** y **5,404 s faster-whisper**. WER agregado por las 19 palabras de referencia: **11/19 = 57,9 %** y **10/19 = 52,6 %**, respectivamente. Las inserciones pueden producir WER superior al 100 % en una frase corta. Ninguno conservó «pausa Spotify»; faster-whisper sí conservó «reproduce» en la segunda frase y el CLI lo cambió por «reconoce». Ambos alteraron el nombre «Alice» en los tres casos. No se añadieron hints para forzar estas palabras.

faster-whisper pidió `int8`; CTranslate2 informó **`int8_float32`** como tipo efectivo en CPU. Sus tiempos de importación fueron 0,725/0,741/0,843 s; carga 1,294/1,185/1,569 s; inferencia 2,750/2,895/2,747 s. El CLI conserva su configuración actual; no se afirma equivalencia entre sus opciones de decodificación y `beam_size=5` de faster-whisper.

La instancia persistente de faster-whisper importó en 1,016 s y cargó el modelo en 1,425 s. Primera pasada: 2,819/3,170/2,735 s de inferencia; segunda: 2,861/3,188/2,674 s, mediana **2,861 s**. Conservó las mismas transcripciones equivocadas. Ese tiempo excluye importación y carga; no hay medición equivalente con whisper.cpp persistente ni aceptación de voz real.

Se conservaron dos intentos fallidos de preparación: el primero omitía `vocabulary.txt` y el segundo reveló la incompatibilidad de PyAV 19. Ambos se corrigieron antes de la comparación válida; sus tiempos de fallo no se incluyen en los resultados anteriores. También se corrigió que el ID interno `stdin` del worker sustituyera el ID del corpus: la copia revisada enlaza el informe original por SHA-256 y sólo normaliza los IDs según el SHA-256 de cada WAV, sin cambiar tiempos ni texto. Una regresión verifica que el worker no pueda reemplazar identidad ni resultado del proceso.

Evidencia privada bajo `local/experiments/asr-comparison/evidence/`: `comparison-20261113-195010.json` (original), `comparison-reviewed-20261113-195010.json` (IDs normalizados), `warm-20261113-195053.json`, `summary-20261113.json`, `unit-tests-20261113.log` y los informes de preflight y de preparación fallida. No se publican audios, pesos ni evidencia generada en Git. R9 y cualquier cambio de motor siguen sujetos a validación con el propietario antes de incorporarlos al proyecto principal.

## Fuentes primarias

- [faster-whisper y parámetros](https://github.com/SYSTRAN/faster-whisper), [paquete PyPI](https://pypi.org/project/faster-whisper/1.2.1/).
- [CTranslate2: CPU e hilos](https://opennmt.net/CTranslate2/parallel.html), [cuantización](https://opennmt.net/CTranslate2/quantization.html), [PyPI 4.9.0](https://pypi.org/project/ctranslate2/4.9.0/).
- [Modelo oficial convertido](https://huggingface.co/Systran/faster-whisper-small/tree/536b0662742c02347bc0e980a01041f333bce120).
- [PyAV 18.0.0 en PyPI](https://pypi.org/project/av/18.0.0/), [firma oficial de `open` compatible con `metadata_errors`](https://github.com/PyAV-Org/PyAV/blob/v18.0.0/av/container/core.py#L458).
- [ZIP portable oficial Piper](https://github.com/rhasspy/piper/releases/tag/2023.11.14-2), [licencia Piper](https://github.com/rhasspy/piper/blob/2023.11.14-2/LICENSE.md), [eSpeak NG](https://github.com/espeak-ng/espeak-ng).
