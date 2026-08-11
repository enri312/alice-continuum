# Informe de telemetría motora R3 y superficie del avatar — 2026-08-11

Estado: aprobado sobre Alice Desktop y el VRM privado real

## Resultado

- Siete estados corporales y tres procedencias forman un contrato nativo cerrado.
- Cada transición persiste un evento R3 mínimo; no contiene entradas, poses, recuerdos ni contenido del avatar.
- `core_activity_snapshot` v2 activa sólo `Motor manual` para `source=avatar`; los cinco enlaces cognitivos permanecen en cero.
- El ensayo diagnóstico termina automáticamente a los 10 segundos.
- La ropa reutiliza texturas y normales del VRM con anisotropía hasta 12, mipmaps y relieve moderado. No se añaden colores.

## Prueba real

Se abrió una instancia Tauri nueva con el ensayo diagnóstico habilitado. El avatar privado cargó en la pantalla real y regresó a reposo; el botón volvió a `Ensayar marcha`. Después de finalizar, el JSONL canónico tuvo crecimiento `0` durante una observación adicional de cinco segundos. Los eventos aceptados conservaron `source=avatar`, `capabilityId=avatar.vrm.render`, `stage=execution`, `outcome=success` y `reasonCode=LOCAL_DIAGNOSTIC_TRANSITION`.

La captura real muestra la ropa, sus correas, bolsillos, botas y capas con la paleta previa. La prueba unitaria toma cuatro colores del material, aplica la mejora y exige igualdad exacta antes/después. La misma función aplicada dos veces no vuelve a multiplicar el relieve.

## Integridad

- SHA-256 de `Assets/Alice.vrm`: `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`.
- El manifiesto real de memoria conservó su SHA-256 durante la prueba.
- El VRM y los 12 FBX privados permanecen excluidos de Git.

## Puertas automáticas

- 23 archivos y 144 pruebas TypeScript aprobadas.
- 147 pruebas Rust aprobadas y 7 pruebas vivas ignoradas por requerir contexto explícito.
- build TypeScript/Vite aprobado.
- `cargo clippy --all-targets --all-features -- -D warnings` y build Rust aprobados.

## Límite

La actividad motora representa ejecución manual o diagnóstica reciente. No demuestra que Alice haya elegido, aprendido o comprendido el movimiento y no habilita `output.avatar.body`.
