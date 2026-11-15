# Segundo reparto Node/Python: informe de reranqueo R8

## Selección del módulo

Se revisaron referencias en documentación, comandos npm, CI e importaciones:

| Grupo | Estado y decisión en esta revisión |
|---|---|
| `r8-gemma-rerank-eval.test.ts` | Evaluador manual optativo de un contrato vigente. Usa la recuperación TypeScript del producto; se traslada sólo el análisis numérico y el informe. |
| `r8-gemma-embedding-eval.test.ts` | Evaluación optativa de una alternativa rechazada en su informe. No se porta ni se reactiva como recuperación del producto. |
| `conversation-reference-eval.mjs`, `llama-memory-pilot.mjs` | Herramientas manuales con contratos TS y lectura de prompts Rust. Su lector fue actualizado en la reorganización anterior; las rutas de motor siguen siendo locales. No seleccionadas en este incremento. |
| `gemma-evaluation.mjs`, `gemma-audio-evaluation.mjs`, `gemma-vision-control.mjs`, `llama-multimodal-evaluation.mjs` | Pilotos históricos, varios con rutas personales o dependientes de fixtures/motores externos. Se conserva su evidencia; no se portan por aparecer en la carpeta. |
| `dioxus-native-smoke.mjs`, `dioxus-browser-smoke.mjs` | Aceptación vigente de Tauri/DOM y contratos de interfaz; se mantienen en Node. |

El catálogo del 6 de noviembre es histórico: por ejemplo, su diagnóstico del
lector de prompts ya fue corregido. Esta revisión no declara inútiles todos los
scripts que no tengan una llamada npm ni certifica que funcionen con servicios
reales. Tampoco borra pilotos ni traslada los respaldos.

## Reparto incorporado

- Python (`Backend/adapters/r8_rerank_report.py`): conteos Top-1/Top-3, proporciones,
  media de latencia y construcción del JSON con los nombres anteriores.
- TypeScript: selección del perfil, recuperación léxica productiva, rotación de
  candidatos, inferencia, comprobación de IDs y SHA-256 del archivo original.
- Supervisor Node (`scripts/testing/r8-report.mjs`): localiza Python, impone tiempo
  y tamaño, valida el resultado y comunica fallos sin imprimir la entrada.

Hay un solo proceso por informe, bajo demanda. No se añadió un proceso al arranque
ni se cambió la interfaz, el diseño, el núcleo Rust o la transcripción.

## Uso offline

Guardar una entrada numérica de prueba en una carpeta privada, por ejemplo
`runtime/artifacts/r8-rankings.json`:

```json
{
  "schemaVersion": 1,
  "rankings": [
    { "lexical": [0], "reranked": [0, 1, 2] },
    { "lexical": [], "reranked": [1, 2, 0] },
    { "lexical": [2], "reranked": [1, 0, 2] }
  ],
  "totalRerankLatencyMs": 1501,
  "sourcePreserved": false
}
```

```powershell
npm run eval:r8:report -- --input runtime/artifacts/r8-rankings.json
```

La fila `i` espera recuperar al candidato `i`. Los números son posiciones
efímeras de la misma lista original, aunque la inferencia haya visto candidatos
rotados; no son IDs de memoria. Se admiten de una a 10.000 filas. Cada ranking
léxico puede contener de cero a tres candidatos; el reranqueado contiene
`min(3, número de filas)`. No se admiten repetidos, posiciones ajenas, campos
adicionales ni claves JSON duplicadas. La latencia total es un entero de cero
a 86.400.000 ms; la media mantiene el redondeo no negativo de `Math.round`.

El comando sólo imprime el resultado y conserva el archivo elegido. No busca
archivos en `data/`. El campo heredado `realConfirmedProfileRecords` contiene el
número de filas: su nombre no transforma datos ficticios en registros reales.
`sourcePreserved` es una declaración del llamador; Python no comprueba archivos.
El evaluador real lo envía después de verificar SHA-256. `indexPersisted: false`
describe este flujo, que no escribe índices; no inspecciona otros procesos.

Se usa `runtime/venv/Scripts/python.exe` en Windows o
`runtime/venv-linux/bin/python` en Linux; `ALICE_PYTHON_BIN` permite una ruta
absoluta alternativa. Sólo requiere biblioteca estándar. Límites: 1 MiB de
entrada, 16 KiB de salida y diez segundos. Un fallo devuelve error sin informe
parcial ni sustitución silenciosa por el cálculo anterior.

## Validación y límites de la evidencia

El ensayo privado `experiments/node-python-r8-report/pilot.mjs` extrajo del commit
`a9b0513` el cálculo anterior sin ejecutar el evaluador, modelos ni acceso a datos.
Los 25 lotes ficticios (3, 4, 9, 37 y 128 casos) dieron los mismos campos y valores
JSON. Incluyen coincidencias, fallos, rankings léxicos vacíos y orden variable.
Las pruebas permanentes cubren fracciones conocidas, redondeo de `.5`, una
preservación declarada falsa, límites, posiciones inválidas, claves duplicadas,
ausencia de Python, fallo del ejecutable, tiempo límite y CLI sin escrituras.

La latencia de inferencia del informe sigue midiendo el tramo anterior al
formateo; no incluye el inicio de Python. El ensayo mide por separado ese coste
completo. No se afirma que el traspaso acelere la aplicación ni que mejore la
calidad semántica. Evidencia privada en
`runtime/artifacts/node-python-r8-report-2026-11-15/`.

En la última muestra de cinco repeticiones por tamaño, el cálculo Node ya
cargado tuvo medianas de 0,016 ms para nueve filas y 0,048 ms para 128; el
supervisor más Python tardó aproximadamente 160 y 166 ms. Son mediciones
orientativas de este Windows, sin aislar toda la carga del equipo. El coste de
proceso refuerza su uso como herramienta manual; no se sustituye por Python
ningún bucle interactivo de la aplicación.

Verificaciones del incremento:

- `npm test`: 906 pruebas frontend aprobadas, dos opcionales omitidas; 19 de
  Obsidian, 20 de respaldos y dos de privacidad aprobadas.
- Adaptadores Python: 30 pruebas, 29 aprobadas y una sonda anterior omitida.
- Compilación TypeScript/Vite y verificación de artefactos Dioxus aprobadas.
- CLI npm con un archivo ficticio: genera el resumen esperado; se comprueba
  que el archivo de entrada no cambia y que no se crea otro archivo.
- Tauri/WebView2 con backend real y datos ficticios: ventana, Conversación,
  Estado/Flujo, Actividad, R3, teclado, confirmación y persistencia tras recarga
  aprobados. Evidencia: `runtime/artifacts/dioxus/native/dioxus-native-NSe3ms/`.

La evaluación real sigue desactivada por defecto con
`ALICE_R8_REAL_RERANK_EVAL`; no se ejecutó en este incremento ni se leyeron sus
fuentes personales. Los resultados anteriores con Gemma siguen siendo evidencia
histórica. La prueba offline comprueba el análisis, no la inferencia ni el micrófono.
