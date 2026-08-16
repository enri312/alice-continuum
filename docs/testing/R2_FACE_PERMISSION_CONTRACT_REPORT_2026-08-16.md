# Informe real — Contrato de permiso facial R2

Fecha: 2026-08-16  
Alcance: solicitud, decisión y revocación nativas; sin abrir cámara, micrófono o modelo facial.

## Resultado

El Gateway R2 acepta ahora un único perfil facial cerrado y separado de
`perception.camera.observe`. La pestaña Rostro consume los comandos nativos generales de R2 para
preparar, decidir, cancelar y revocar. No existe comando de activación facial en este incremento.

## Evidencia ejecutada

Las pruebas Rust utilizaron el Gateway real en memoria y comprobaron que:

- preparar crea una solicitud `critical` de 60 segundos y cero grants;
- aprobar crea un grant `approved` sin lease sensorial;
- pasar ese grant al ejecutor real de cámara/micrófono falla antes de activar la sesión;
- el grant conserva estado `approved` después del intento bloqueado;
- revocar lo lleva a `revoked` y el almacén sensorial permanece vacío;
- ampliar el perfil con `cameraFrames` o `cameraObserve` queda rechazado.

Las pruebas TypeScript comprobaron el constructor canónico y el parser cerrado. La compilación web
verificó la integración de los controles en Rostro.

Regresión final ejecutada:

| Verificación | Resultado |
|---|---|
| TypeScript | 248 aprobadas en 30 archivos |
| Rust | 178 aprobadas; 13 sondas vivas omitidas explícitamente |
| `cargo clippy --all-targets --all-features -- -D warnings` | Aprobado |
| Build web | Aprobado; advertencia no bloqueante por chunks mayores a 500 kB |
| Build Rust release | Aprobado |

## Privacidad observada

No se abrió ningún sensor y no se ejecutó MediaPipe. No se generaron fotogramas, landmarks,
blendshapes, identidad, archivos multimedia ni memoria. `scratch/` y el modelo privado permanecen
fuera de Git.

## Límite pendiente

El grant facial todavía no es ejecutable. La activación real necesitará un adaptador dedicado,
indicador visible, parada inmediata, vencimiento operativo y auditoría R3; no reutilizará el lease
genérico de cámara.
