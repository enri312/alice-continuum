# Informe R4.1 — Contrato de habilidades

Fecha: 2026-08-09  
Resultado: aprobado

## Resultado

Se implementaron tipos y validaciones en Rust y TypeScript para manifiestos de habilidades locales. No se añadieron comandos Tauri, carpetas persistentes, ejecución, red, escritura, instalación ni activación.

## Evidencia comprobada

- El fixture nativo se valida contra el snapshot real de 24 capacidades producido por `capability_registry_from_probes`.
- Un JSON temporal se escribe, lee, deserializa y elimina mediante el sistema de archivos real.
- Capacidad desconocida y operación ajena a R1 quedan rechazadas.
- Riesgo subdeclarado y privilegios sin uso quedan rechazados.
- Una ruta sin `sensitive: true` queda rechazada.
- `enabled`, red, procesos o escritura no pueden activarse en R4.1.
- Campos desconocidos como `script` no deserializan.
- Una habilidad nueva sólo valida como `draft`, versión 1 y sin padre.

Los conteos finales y las puertas completas se registran en el README raíz. Los datos canónicos no se usan como fixture y permanecen sin cambios.
