# Informe real — Catálogo de expresiones del VRM de Alice

Fecha: 2026-08-16  
Alcance: lectura local del activo VRM privado y visualización de nombres; sin cámara, audio o animación.

## Lectura directa del activo

Se abrió `Assets/Alice.vrm` en modo de solo lectura y se leyó su bloque JSON GLB. El archivo mide
18.631.596 bytes. La extensión `VRMC_vrm` declara 14 expresiones preset y 0 expresiones personalizadas:

`happy`, `angry`, `sad`, `relaxed`, `surprised`, `aa`, `ih`, `ou`, `ee`, `oh`, `blink`, `blinkLeft`,
`blinkRight`, `neutral`.

## Cambio verificable

La pestaña Avatar ahora presenta esa lista desde `VRMExpressionManager` después de cargar el mismo
archivo local. El catálogo conserva únicamente nombres declarados, sin crear presets ni pesos.

La prueba TypeScript cubre orden, deduplicación y rechazo de valores de control. La compilación de
producción fue aprobada con 250 pruebas TypeScript. La regresión nativa también aprobó 178 pruebas
Rust (13 sondas vivas quedaron correctamente omitidas por no abrir dispositivos ni datos canónicos),
`cargo clippy -- -D warnings` y el build Rust de producción. No se modificó `Alice.vrm`, no se abrió
ningún sensor y no se aplicó ninguna expresión al avatar.

## Límite

Este catálogo no es retarget facial. La futura tabla que traduzca blendshapes a estas expresiones
requerirá un adaptador R9, un grant facial R2 vigente, indicador, parada y auditoría R3.
