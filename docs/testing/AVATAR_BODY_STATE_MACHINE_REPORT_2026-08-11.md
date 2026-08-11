# Informe de máquina de estados corporal — 2026-08-11

Estado: incremento comprobado dentro de Alice Desktop real

## Resultado funcional

- Catálogo nativo ampliado de 9 a 12 clips privados.
- `Start Walking` se ejecuta antes de locomoción frontal desde reposo y elimina desplazamiento horizontal de cadera para no duplicar el controlador de escena.
- `Standing Up` se reproduce en reversa para sentarse y hacia delante para levantarse.
- `Sitting Idle` mantiene el reposo sentado.
- Una orden de movimiento desde sentado obliga a levantarse antes de caminar.
- La interfaz permite `Sentar a Alice` y `Levantar a Alice`, e informa el estado FSM actual.

## Evidencia de activos reales

| Clip | Tamaño | SHA-256 |
|---|---:|---|
| `Start Walking.fbx` | 563.376 bytes | `D40323E5953B78C345F8F9F0213BA2C99B40BD190A1C8EED3EA26B81FE66BD08` |
| `Sitting Idle.fbx` | 533.536 bytes | `0E7DD4B9A82EEB745F82D25443D53959335ADED1316EBC2B04D54DCA8FBCB49B` |
| `Standing Up.fbx` | 754.112 bytes | `DFF9136E31203D4553892E9A5300D351602AA31385466E2AC12A163C14E54E0E` |

Los tres valores coinciden con el inventario privado existente. Ningún FBX ni el VRM fue reescrito.

## Prueba visual real

La aplicación Tauri de desarrollo se recompiló y reinició. En el visor se comprobó:

- `Clips corporales 12 / 12`;
- transición completa hasta reposo sentado y aparición de `Levantar a Alice`;
- retorno completo a la postura de pie;
- telemetría `ESTADO INICIANDO MARCHA · ANIM START-WALKING` antes de la locomoción;
- IK activo durante el arranque, sin aplicarlo al estado sentado.

La aplicación quedó otra vez en reposo al terminar la prueba.

## Puertas automáticas

- 23 archivos de pruebas TypeScript aprobados.
- 140 pruebas TypeScript aprobadas.
- 143 pruebas Rust aprobadas y 7 pruebas vivas ignoradas por requerir contexto explícito.
- build TypeScript/Vite aprobado.
- `cargo clippy --all-targets --all-features -- -D warnings` aprobado.

## Límite

Esto demuestra repertorio y coordinación visual, no aprendizaje. No se escribieron recuerdos motores ni eventos de decisión y `output.avatar.body` continúa desconectado.
