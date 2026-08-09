# Informe de validación R1 — Registro de capacidades

Fecha: 2026-08-09  
Estado: aprobado; solamente se acepta evidencia producida por la aplicación y los recursos reales

## Alcance

Se validó el Registro de Capacidades R1 ejecutando la aplicación Tauri real desde `E:\Alice Cognitive Core`. La revisión no activó cámara, micrófono, captura de pantalla, automatización de escritorio ni puentes de salida.

## Resultado nativo observado

| Evidencia | Resultado real |
|---|---|
| Proceso | `alice-cognitive-core.exe`, PID 20436 durante la revisión |
| Comando | `capability_registry_status` respondió desde el backend Rust |
| Esquema | versión 1 |
| Inventario | 24 capacidades |
| Madurez | 12 implementadas o parciales; 12 planificadas |
| Estado disponible observado | 12 capacidades `idle` o `active` en el snapshot final |
| Salud degradada o error | 0 en el snapshot final |
| Ejecución R1 | `lastExecution` permaneció en `null` |

El número de capacidades disponibles depende del estado real de configuración, memoria, observación y avatar; no es una constante visual.

## Entradas sensoriales

La interfaz y el snapshot real mostraron estas capacidades como `planned` y `unavailable`:

- `perception.screen.observe`;
- `perception.camera.observe`;
- `perception.microphone.observe`;
- `perception.media.inspect`;
- `perception.desktop.observe`;
- `perception.gesture.derive`.

La inspección de `perception.camera.observe` informó adaptador `none`, riesgo `high`, efecto `none`, salud `unavailable` y ausencia de permiso aplicable. No se abrió ningún dispositivo.

## Idempotencia y preservación de datos reales

Se consultó el registro tres veces mediante navegación real de la aplicación. Antes y después se compararon tamaño, fecha de modificación y SHA-256.

| Recurso | Resultado |
|---|---|
| Nueve archivos bajo `data/` | Sin cambios |
| `Assets/Alice.vrm` | Sin cambios |
| SHA-256 final del avatar | `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B` |
| Tamaño del avatar | 18.631.596 bytes |

## Pruebas automatizadas

| Verificación | Resultado |
|---|---|
| TypeScript / Vitest | 45 aprobadas |
| Rust | 36 aprobadas |
| `cargo fmt --check` | Aprobada |
| `cargo clippy -- -D warnings` | Aprobada |
| `cargo build` | Aprobada después de cerrar el ejecutable inspeccionado |
| `npm run build` | Aprobada |
| Aplicación Tauri real | Arranque y consulta nativa aprobados |

La compilación completa se repitió después de cerrar la aplicación para permitir que Windows reemplazara el ejecutable. Finalizó correctamente en el perfil de desarrollo.

Las pruebas automatizadas verifican contratos, serialización, IDs repetidos, versión desconocida, invariantes de estados planificados e idempotencia. La evidencia operativa anterior procede del proceso y archivos reales, no de valores simulados en la interfaz.

## Revisión visual real

- El encabezado mostró `Registro de capacidades` y origen nativo.
- Las métricas se derivaron del snapshot, no de un arreglo React.
- Los dominios Nube, Contexto, Percepción, Memoria, Avatar y Salidas aparecieron agrupados.
- El inspector mostró ID, madurez, adaptador, operaciones, riesgo, permiso, efectos y salud reales.
- La telemetría de ejecución continuó vacía y reservada para R3.
- No se contabiliza ninguna inyección artificial de fallos como evidencia.

## Límites preservados

- R2 no fue iniciado.
- No se concedieron permisos nuevos.
- No se ejecutaron herramientas ni comandos externos desde Alice.
- No se activaron fuentes sensoriales.
- No se modificaron memoria, avatar ni recursos fuera del código y la documentación del proyecto.
