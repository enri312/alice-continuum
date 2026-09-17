# Informe de prueba funcional — 2026-08-07

Estado: aprobada con una observación de calidad del modelo  
Entorno: Windows, Tauri de desarrollo, React/TypeScript, backend Rust  
Proveedor probado: OpenRouter mediante `openrouter/free`

## Ampliación pre-avatar

Antes de cargar el archivo VRM se auditó el núcleo funcional y se retiró de Volumen neuronal la fila redundante de ocho módulos. La inspección individual continúa en **Flujo cognitivo**, donde existe relación directa entre cada control y su contenido.

Se corrigieron cuatro defectos:

1. Una observación de ventana sin conversación podía marcar actividad, pero producir densidad neuronal cero.
2. La previsualización de nube podía cambiar si el contexto observado variaba antes de autorizar; ahora se congela una solicitud inmutable.
3. Una respuesta lenta podía anteponer una copia antigua de la memoria y perder enseñanzas creadas durante la espera.
4. Varias escrituras rápidas podían finalizar fuera de orden; ahora se serializan y exportar/restaurar espera la cola.

También se agregó validación de identificadores, tipos, estados, importancia y consolidación antes de cargar, guardar, exportar o restaurar recuerdos. Un registro inválido se rechaza antes de sustituir el archivo vigente.

| Comprobación automatizada | Resultado |
|---|---|
| `npm test` | 15/15 pruebas TypeScript aprobadas |
| `cargo test --manifest-path src-tauri/Cargo.toml --no-default-features` | 10/10 pruebas Rust aprobadas |
| `npm run build` | TypeScript y Vite aprobados; 66 módulos |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Sin diferencias |

Las respuestas de OpenAI/xAI, Anthropic, Google, OpenRouter y un servicio compatible se probaron con fixtures locales; estas pruebas no consumieron claves ni llamaron a proveedores. La recuperación lexical también se verificó con consultas vacías, acentos, ranking, explicaciones y límites. El avatar continúa sin conectarse y Puentes conserva cero adaptadores activos.

## Alcance

- Arranque mediante `Iniciar Alice Continuum.cmd`.
- Almacenamiento activo en el disco E.
- Carga y renderizado de memoria.
- Previsualización y autorización de una conversación real.
- Auditoría local de la llamada.
- Navegación de pantallas y vistas internas.
- Retirada del modo de diagnóstico al finalizar.

## Resultados

| Prueba | Resultado | Evidencia |
|---|---|---|
| Arranque de escritorio | Aprobada | Ventana `Alice — Núcleo observable`, proceso respondiendo |
| Ruta de memoria | Aprobada | `E:\Proyecto P\data\memory\records.json` |
| Carga de memoria | Aprobada | 6 registros, estado `ARCHIVO LOCAL` |
| Privacidad previa al envío | Aprobada | Historial, memoria, ventana y guardado local desactivados |
| Conversación de nube | Aprobada | Respuesta recibida en aproximadamente 4 segundos |
| Modelo real informado | Aprobada | `nvidia/nemotron-nano-9b-v2:free` |
| Uso registrado | Aprobada | 113 tokens de entrada y 86 de salida |
| Memoria no solicitada | Aprobada | Continúan 6 registros; SHA-256 del archivo principal sin cambios |
| Actividad cognitiva | Aprobada | `MEMORY_LOAD`, `CLOUD_PREFLIGHT_APPROVED` y `CLOUD_RESPONSE` |
| Núcleo | Aprobada | Volumen, Flujo, Estado y Planificador seleccionables |
| Puentes | Aprobada | Resumen y Rostro seleccionables; adaptadores desconectados |
| Diagnóstico local | Aprobada | Puerto 9222 cerrado antes de entregar la aplicación |
| Cámara neuronal | Aprobada | Girar, Mover, zoom 100%→118% y restablecimiento a 0 px/100% |

## Conversación probada

Mensaje enviado sin contexto adicional:

```text
Responde con una sola frase breve: confirma que Alice esta conectada e indica el modelo que estas usando.
```

Respuesta:

```text
Alice está conectada y estoy usando el modelo descrito en las instrucciones del usuario.
```

La interfaz identificó correctamente el modelo real como `OpenRouter · nvidia/nemotron-nano-9b-v2:free`.

## Observación

El modelo gratuito respondió, pero no escribió su identificador exacto dentro de la frase aunque se le pidió. No es un fallo del adaptador: Alice recibió y mostró por separado el identificador real retornado por OpenRouter. La calidad y obediencia pueden variar porque `openrouter/free` elige entre modelos disponibles.

## Evidencias visuales

- `artifacts/alice-runtime-e-test.png`
- `artifacts/alice-runtime-cloud-review.png`
- `artifacts/alice-runtime-cloud-response.png`

La instancia entregada al usuario quedó abierta normalmente, sin el puerto de diagnóstico.

## Ampliación: cámara neuronal

Se verificaron cinco controles visibles, cambio entre modos Girar y Mover, desplazamiento de prueba de 76 px por 34 px, zoom por botón y restablecimiento. En modo de movimiento reducido, las capturas del lienzo antes y después de un giro produjeron SHA-256 diferentes, confirmando que cambió la proyección del volumen y no solamente el estado del botón.
