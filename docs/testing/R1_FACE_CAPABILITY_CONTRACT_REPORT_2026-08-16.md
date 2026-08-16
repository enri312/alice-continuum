# Informe R1/R2 — Contrato de capacidad facial

Fecha: 2026-08-16  
Alcance: registro, tipos y rechazo seguro; sin apertura de cámara, micrófono ni avatar.

## Cambio comprobado

El inventario R1 sustituyó `perception.gesture.derive` por la capacidad delimitada
`perception.face.landmarks`. El contrato declara exclusivamente la operación
`deriveAuthorizedFaceLandmarks` y el alcance `facialLandmarksEphemeral`.

La capacidad permanece en `planned` + `unavailable`, con adaptador `none`, efecto `none`, riesgo
`high`, sin ejecución previa y sin enforcer operativo. No declara identidad, reconocimiento de
personas, almacenamiento de coordenadas, memoria ni control del avatar.

## Cierre R2 comprobado

Se preparó un intento con `perception.face.landmarks` y una duración de 60 segundos. El Gateway R2
lo rechazó porque sólo cámara y micrófono están migrados. Después del rechazo se verificó que la
lista de solicitudes permaneció vacía: no se creó request, grant, proceso ni lease.

El constructor TypeScript de perfiles sensoriales también rechaza valores distintos de `camera` y
`microphone`; un valor facial no puede degradarse silenciosamente a un permiso de micrófono.

## Validación ejecutada

| Verificación | Resultado |
|---|---|
| `npm test` | 243/243 aprobadas |
| `npm run build` | TypeScript y Vite aprobados |
| `cargo fmt --all -- --check` | Aprobado |
| `cargo test --all-features` | 175 aprobadas, 12 ignoradas por requerir datos/hardware explícitos |

Las 12 pruebas ignoradas no se activaron por ser de datos canónicos o hardware real. La evidencia
anterior de webcam permanece en
[FACE_LANDMARKER_READINESS_REPORT_2026-08-15](FACE_LANDMARKER_READINESS_REPORT_2026-08-15.md).

## Resultado

El nombre, operación y alcance facial ya son precisos, pero la capacidad sigue cerrada de forma
verificable. El siguiente incremento deberá crear el grant facial R2 específico y su adaptador
efímero antes de intentar una nueva prueba viva.
