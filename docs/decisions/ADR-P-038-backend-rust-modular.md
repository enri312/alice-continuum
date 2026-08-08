# ADR-P-038 — Backend Rust modular

Fecha: 2026-08-08  
Estado: aceptada e implementada

## Contexto

El backend nativo concentraba proveedores de nube, memoria, auditoría, observación Win32, avatar y arranque de Tauri en un solo `lib.rs` de 1158 líneas. Esto dificultaba revisar límites, localizar pruebas y modificar una capacidad sin aumentar el riesgo sobre las demás.

## Decisión

- Dividir el backend en `avatar.rs`, `cloud.rs`, `memory.rs`, `observation.rs` y `util.rs`.
- Mantener `lib.rs` como único orquestador de Tauri: administra estado, aplica el icono, inicia el worker y registra comandos.
- Usar `pub(crate)` para la frontera entre módulos sin ampliar la API pública de la biblioteca.
- Conservar nombres de comandos, serialización `camelCase`, variables de entorno, rutas y formatos de almacenamiento.
- Alojar cada prueba junto al módulo que verifica.
- Encapsular el estado de observación y probar que comienza apagado y elimina el contexto al desactivarse.
- Validar rutas del avatar sin acceder ni modificar el archivo VRM.

## Consecuencias

- `lib.rs` queda reducido a aproximadamente 45 líneas.
- Los cinco módulos poseen responsabilidades independientes y dependencias explícitas.
- Rust dispone de 14 pruebas: las 10 originales más 4 pruebas nuevas de Avatar y Observación.
- `clippy -D warnings` se convierte en puerta de calidad obligatoria.
- El cambio no migra ni reescribe recuerdos, auditorías o el avatar.

## Evidencia

El procedimiento y los contratos preservados están en `docs/plans/backend-modularization.md`. Los resultados completos se registran en `docs/testing/BACKEND_MODULARIZATION_REPORT_2026-08-08.md`.
