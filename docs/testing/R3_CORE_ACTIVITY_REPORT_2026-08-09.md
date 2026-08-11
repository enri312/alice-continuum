# Informe de cierre R3 — Actividad derivada del Núcleo

Fecha: 2026-08-09  
Incremento: R3.5  
Resultado: aprobado; alcance R3 completado

## Alcance

Se añadió el comando nativo `core_activity_snapshot`, el contrato TypeScript cerrado y la integración del Núcleo con eventos R3 reales. La señal temporal ya no se deriva de mensajes, conteos o estados pendientes de React.

El método original `r3-recency-v1` fue ampliado el 2026-08-11 a `r3-recency-motor-v2`. Mantiene la ventana de cinco minutos y la ponderación de recencia, etapa y resultado, y añade una séptima región motora sin enlace hacia la ruta cognitiva. Devuelve:

- seis regiones: percepción, permisos, memoria, lenguaje, contexto y salida;
- cinco enlaces: permisos→percepción, percepción→contexto, memoria→contexto, lenguaje→contexto y contexto→salida;
- conteos de evidencia, último evento e intensidad normalizada;
- `heuristic: true` como parte obligatoria del contrato.

La memoria local continúa siendo la única fuente de densidad estructural. R3 sólo produce brillo efímero. Afecto, intención, utilidad, riesgo, novedad y planificación no se infieren desde telemetría.

## Pruebas del contrato

Rust usa archivos JSONL temporales reales para comprobar:

- archivo ausente sin creación ni actividad inventada;
- evento en el límite de cinco minutos con señal cero;
- ruta de cámara gobernada activando únicamente permisos, percepción y contexto;
- memoria y nube activando regiones y enlaces diferentes;
- lectura byte a byte inmutable del JSONL;
- lectura viva de los datos canónicos sin mutación.

TypeScript rechaza campos desconocidos, topología alterada, regiones o enlaces duplicados, señales fuera de rango y conteos incoherentes. También prueba que un mensaje presente sólo en React no produce pulso si R3 no aporta evidencia.

## Evidencia real

| Puerta | Resultado |
|---|---|
| TypeScript/Vitest | 79/79 aprobadas |
| Rust normal | 100/100 aprobadas; cuatro sondas vivas ignoradas por defecto |
| Sonda viva R3.5 | 1/1 aprobada sobre `E:\Alice Cognitive Core\data` |
| Integridad durante derivación | SHA-256 del JSONL idéntico antes y después: `683EAA0FC7DFDA082B6FBDFF8510C8A26DACD60E6DC1E46AF0F5E91266AA016F` |
| `cargo fmt --check` | aprobado después de formato canónico |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| Build TypeScript/Vite | aprobado |
| Build Tauri `release` | aprobado; ejecutable en `.cargo-target/release/alice-cognitive-core.exe` |

## Sonda del ejecutable

El release se inició con `ALICE_DATA_DIR=E:\Alice Cognitive Core\data` y se cerró después de observar el arranque. La auditoría pasó de 10 a 11 eventos. El último evento real fue:

| Campo | Valor |
|---|---|
| `source` | `system` |
| `operation` | `process.startup` |
| `stage` | `execution` |
| `outcome` | `success` |
| `reasonCode` | `PROCESS_STARTED` |

El sobre conservó 13 campos tipados y cero propiedades `message`, `payload`, `parameters`, `prompt`, `image`, `audio`, `secret` o `apiKey`.

## Privacidad e integridad

- Diez archivos bajo `data` antes y después; sólo cambió el JSONL R3 esperado.
- Los otros nueve archivos canónicos conservaron SHA-256.
- Siete archivos bajo `data/memory` conservaron SHA-256.
- El avatar privado conservó SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`.
- No se abrieron cámara ni micrófono, no se creó señal multimedia y no se envió red.
- `data/`, `Assets/*.vrm` y capturas de validación continúan fuera de Git.

## Revisión visual

Volumen y flujo se revisaron a 1.920×1.000 mediante Edge y Playwright. `scrollWidth` coincidió con los 1.920 píxeles del viewport. La topología renderizó 11 nodos y 13 rutas visuales: cinco pueden recibir evidencia R3 y ocho permanecen apagadas como estructura futura.

La ejecución web mostró correctamente `SNAPSHOT NATIVO NO DISPONIBLE`; no simuló datos de escritorio. En Tauri, el evento real de arranque alimenta la ventana. Las capturas de prueba quedaron fuera del repositorio y no incluyen datos privados.

## Cierre

Los cinco incrementos previstos de R3 están implementados y sus criterios de aceptación quedan satisfechos. El siguiente paso autorizado por el Roadmap es definir el primer incremento de R4 — Taller de habilidades, manteniendo ejecución autónoma desactivada.
