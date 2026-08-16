# ADR-P-072 — Permiso facial R2 separado de la observación de cámara

**Estado:** aceptada  
**Fecha:** 2026-08-16  
**Ámbito:** Gateway R2, pestaña Rostro y futura derivación facial local.

## Contexto

`perception.camera.observe` autoriza observar fotogramas efímeros de una cámara. Ese permiso no debe
autorizar por extensión la derivación de landmarks o blendshapes faciales. La geometría facial tiene
un propósito, riesgo y salida diferentes, aunque use la misma cámara física como fuente futura.

La preparación local del modelo ya es verificable y la sonda diagnóstica demostró que el hardware
puede producir señal. Todavía no existe un adaptador facial gobernado dentro del runtime de Alice.

## Decisión

R2 incorpora un perfil cerrado para:

- capacidad `perception.face.landmarks`;
- operación `deriveAuthorizedFaceLandmarks`;
- recurso `facePipeline`;
- alcance único `facialLandmarksEphemeral`;
- efecto único `facialLandmarksDerive`;
- riesgo `critical`;
- sesión de 1 a 60 segundos y decisión válida durante un máximo de 60 segundos.

La solicitud declara además que identidad, persistencia cruda y activación están deshabilitadas. El
plan privado queda congelado por SHA-256 junto con la previsualización R2.

Preparar no abre hardware. Aprobar crea un grant efímero en estado `approved`, pero no inicia cámara,
MediaPipe ni un lease. El ejecutor existente de cámara/micrófono rechaza expresamente el grant facial
antes de llamar a `start_session`. Cancelar, denegar, vencer o revocar mantienen el sensor cerrado.

La pestaña Rostro permite preparar, aprobar, denegar, cancelar y revocar. No presenta un botón de
activación y muestra de forma permanente `ACTIVACIÓN BLOQUEADA · APROBAR NO ABRE LA CÁMARA`.

## Invariantes

1. Un grant de cámara nunca sustituye al grant facial.
2. Un perfil facial parcial o combinado con `cameraFrames`/`cameraObserve` es inválido.
3. R2 no autoriza identificación, reconocimiento de personas ni memoria biométrica.
4. La UI no puede convertir un grant `approved` en tracking sin un nuevo comando nativo revisado.
5. Revocar cierra la autorización aunque todavía no exista un adaptador activo.
6. La capacidad R1 continúa `planned` + `unavailable`; disponer de permiso no equivale a disponer de ejecución.

## Consecuencias

El ciclo de consentimiento facial queda diseñado y comprobable antes de incorporar el adaptador. El
siguiente incremento podrá implementar activación/parada real sobre este perfil, con indicador
visible, descarte inmediato, auditoría R3 y cierre por vencimiento. Ese incremento sí requerirá una
prueba diurna explícita con la cámara autorizada.

