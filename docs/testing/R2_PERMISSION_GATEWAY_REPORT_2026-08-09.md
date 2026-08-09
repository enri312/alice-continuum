# Informe de cierre — Gateway de permisos R2

Fecha: 2026-08-09  
Estado: alcance inicial aprobado  
Responsable y autorización de hardware: Carlos Nuñez

## Resultado

R2 establece una frontera nativa de denegación predeterminada para las primeras capacidades migradas. Las solicitudes, planes privados y grants viven únicamente en memoria; aprobar no equivale a ejecutar y no existe una opción para recordar permisos.

Capacidades protegidas de extremo a extremo:

| Capacidad | Operación | Modo | Recurso real |
|---|---|---|---|
| `context.foreground.control` | `setContextObservationEnabled` | `session` para iniciar; `oneShot` para detener | ventana externa actual |
| `perception.camera.observe` | `observeAuthorizedCamera` | `session`, máximo 60 s | `ACER HD User Facing` |
| `perception.microphone.observe` | `observeAuthorizedMicrophone` | `session`, máximo 60 s | arreglo Intel Smart Sound Technology |

## Invariantes comprobadas

- La política nativa es `denyByDefault=true` y los grants no son persistentes.
- La previsualización tiene digest SHA-256 y el plan ejecutable permanece privado en Rust.
- Un ID ausente, vencido, revocado o destinado a otra capacidad no abre el adaptador.
- Aprobar crea un grant, pero la ejecución requiere un segundo control visible.
- Revocar, vencer, detener o cerrar termina la sesión y descarta el contexto o proceso.
- Dos inicios concurrentes no dejan dos observadores para el mismo recurso.
- El antiguo comando directo de observación de ventana no está registrado.
- No existe un comando libre de shell ni una ruta genérica para abrir dispositivos.

## Hardware y persistencia

La prueba viva gobernada abrió en secuencia la cámara ACER y el micrófono Intel, exigió señal positiva y detuvo ambos leases. FFmpeg enumeró la cámara exacta por nombre antes de que OpenCV abriera el índice DirectShow; el micrófono exigió coincidencia con `Microphone Array` y `Smart Sound Technology`.

```text
live_camera_and_microphone_leases_use_real_signal_and_stop_cleanly ... ok
MEDIA_ENTRIES_BEFORE=107
MEDIA_ENTRIES_AFTER=107
MEDIA_DELTA=0
```

No se emplearon medios pregrabados y no se guardaron fotogramas, audio, transcripciones o candidatos de memoria.

## Control de conversación

El panel lateral no es un Gateway alternativo. Es una previsualización de datos de salida:

- historial, recuerdos y ventana comienzan desmarcados;
- la observación local puede seguir activa sin adjuntarse a la nube;
- el botón de ventana navega al Gateway R2 y describe esa acción;
- cámara y micrófono están excluidos del payload;
- guardar el intercambio localmente es una decisión separada, desactivada inicialmente;
- proveedor y modelo son de solo lectura y se modifican en Configuración.

El envío de conversación a la nube continúa declarado `enforcedBy: currentUi`; este cierre no lo presenta falsamente como migrado a Rust.

## Puertas finales

| Puerta | Resultado |
|---|---|
| TypeScript / Vitest | 61/61 |
| Rust normal | 80/80; dos sondas vivas ignoradas por defecto |
| Prueba viva CAM+MIC | aprobada explícitamente |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| Build web | aprobado |
| Build Tauri release | aprobado |
| Secretos detectados | 0 |
| Archivos multimedia privados preparados en Git | 0 |

## Recursos privados preservados

| Recurso | Comprobación |
|---|---|
| `data/` | 9 archivos, 69.374 bytes al cierre e ignorados por Git |
| `Assets/Alice.vrm` | 18.631.596 bytes, SHA-256 de referencia coincidente e ignorado por Git |

Durante la comprobación final, una instancia de desarrollo de Alice que permanecía abierta actualizó `memory/records.json`, su auditoría y el respaldo correspondiente. Se preservaron esos cambios privados: no se inspeccionó su contenido, no se revirtió ningún archivo y ninguno fue preparado para Git.

## Límites posteriores a R2

- No hay análisis visual, VAD, transcripción, gestos ni aprendizaje sensorial.
- Fish Audio no está integrado y no existe una clave en el repositorio.
- Envío de nube y mutaciones de memoria deberán migrarse individualmente antes de declarar `enforcedBy: native`.
- R3 añadirá auditoría unificada de metadatos; no deberá almacenar señal cruda ni secretos.

## Conclusión

El alcance inicial de R2 queda aprobado. R3 puede comenzar con una auditoría unificada que registre quién solicitó una capacidad, qué política se aplicó, qué decisión tomó Carlos Nuñez y cuál fue el resultado, sin conservar contenido privado innecesario.
