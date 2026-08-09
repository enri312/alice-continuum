# Informe de validación — leases sensoriales R2

Fecha: 2026-08-09  
Plataforma: Windows, hardware integrado de la notebook  
Responsable y autorización: Carlos Nuñez

## Resultado

Las capacidades `perception.camera.observe` y `perception.microphone.observe` pasaron de `planned / unavailable` a `partial`, con permisos `sessionOptIn` impuestos por Rust (`enforcedBy: native`). La aplicación no presenta análisis ni memoria sensorial: el incremento solo abre señal viva autorizada, acredita telemetría técnica y descarta el contenido crudo.

## Frontera probada

1. `prepare_permission_request` congela capacidad, dispositivo, propósito y duración.
2. Aprobar crea un grant efímero, pero no abre el dispositivo.
3. `execute_sensor_lease_grant` exige un grant `session` aprobado y vigente.
4. El adaptador es un proceso local fijo; no acepta comandos de shell ni una ruta de archivo proporcionada por React.
5. `stop_sensor_lease`, revocación, vencimiento o cierre terminan el proceso y liberan el dispositivo.
6. El estado público incluye únicamente nombre de dispositivo, adaptador, vencimiento, resolución o frecuencia, y unidades iniciales verificadas. No devuelve fotogramas ni muestras.

## Hardware real

| Lease | Dispositivo congelado | Adaptador | Evidencia exigida |
|---|---|---|---|
| Cámara | `ACER HD User Facing` | OpenCV 5 + DirectShow | al menos un fotograma vivo y resolución positiva |
| Micrófono | `Microphone Array (2- Intel® Smart Sound Technology for Digital Microphones)` | sounddevice/PortAudio + WASAPI | al menos una muestra viva y frecuencia positiva |

La prueba `permissions::tests::live_camera_and_microphone_leases_use_real_signal_and_stop_cleanly` fue ejecutada explícitamente con `--ignored --exact`. Abrió los dispositivos en secuencia, no simultáneamente, comprobó señal mayor que cero, detuvo cada grant y verificó que el almacén terminara vacío.

```text
1 passed; 0 failed
MEDIA_ENTRIES_BEFORE=107
MEDIA_ENTRIES_AFTER=107
MEDIA_DELTA=0
```

No se usaron imágenes, videos o audios pregrabados como sustituto. No se creó un archivo de captura.

## Pruebas y builds

| Puerta | Resultado |
|---|---|
| TypeScript/Vitest | 61/61 aprobadas |
| Rust normal | 80/80 aprobadas; 2 pruebas vivas ignoradas por defecto |
| Lease vivo CAM+MIC | 1/1 aprobada explícitamente |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets --all-features -- -D warnings` | aprobado |
| Build web | aprobado |
| Build Rust/Tauri | aprobado |

## Privacidad y límites

- `rawPersistence` está fijado en `false` y el parser TypeScript rechaza cualquier valor contrario.
- El helper no contiene llamadas de escritura de imagen o audio.
- La interfaz mantiene `0 CANDIDATOS REALES`; no hay transcripción, clasificación, identificación biométrica ni aprendizaje automático.
- Fish Audio no forma parte de este incremento y no se agregó ninguna clave o variable.
- El runtime local actual depende de Python 3.14, OpenCV 5.0, sounddevice 0.5.5, NumPy 2.3.5 y FFmpeg presentes en esta notebook. La cámara se enumera por nombre en DirectShow antes de abrir su índice; el micrófono debe coincidir con Microphone Array y Smart Sound Technology. Sustituirlo por MediaCapture/WASAPI nativo podrá evaluarse sin cambiar el contrato de permisos.

## Conclusión

La puerta del Paso 6 de R2 queda aprobada con hardware real. El siguiente trabajo permitido es el cierre documental y de trazabilidad de R2; conectar análisis o memoria requiere un incremento independiente y una nueva revisión de privacidad.
