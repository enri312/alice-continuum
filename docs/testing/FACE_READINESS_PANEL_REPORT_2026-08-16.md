# Informe real — Diagnóstico pasivo del panel Rostro

Fecha: 2026-08-16  
Alcance: comprobación local de modelo y runtime; sin cámara, micrófono, avatar ni red.

## Objetivo

Sustituir los textos estáticos del panel Rostro por estado local verificable, sin presentar la
preparación del modelo como tracking facial activo.

## Contrato nativo

El comando `face_readiness_status` devuelve solamente:

- la existencia, tamaño y SHA-256 del modelo privado esperado;
- la disponibilidad local de Python, OpenCV, MediaPipe y NumPy;
- el identificador planificado `perception.face.landmarks`;
- `sensorOpened: false` obligatorio.

No acepta parámetros, no enumera dispositivos, no inicia MediaPipe Face Landmarker, no abre cámara y
no devuelve landmarks, blendshapes, imágenes, matrices ni identidad.

## Sonda real ejecutada

La prueba ignorada de manera explícita `live_private_readiness_checks_runtime_without_opening_a_sensor`
se ejecutó manualmente sobre el equipo local:

```powershell
cargo test live_private_readiness_checks_runtime_without_opening_a_sensor --all-features -- --ignored
```

Resultado: aprobada. Confirmó el SHA-256
`64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`, runtime Python disponible y
`sensorOpened=false`. La cámara y el micrófono no se abrieron.

## Validación de contratos

| Verificación | Resultado |
|---|---|
| Pruebas TypeScript | 246 aprobadas; parser rechaza sensor abierto, SHA inválido y campos desconocidos |
| Pruebas Rust | 177 aprobadas; 13 sondas vivas omitidas de forma explícita |
| Pruebas Rust de unidad | Modelo ausente, huella válida y huella incorrecta verificados |
| Sonda privada explícita | Aprobada sin usar sensor |
| UI | Obtiene el estado por IPC nativo y mantiene los 8 canales como reservados |

## Resultado

Rostro ya puede indicar de forma honesta si el modelo y runtime están listos. No cambia la madurez
de `perception.face.landmarks`: la capacidad continúa planificada y el siguiente paso sigue siendo
el permiso facial R2 específico, no una activación automática.
