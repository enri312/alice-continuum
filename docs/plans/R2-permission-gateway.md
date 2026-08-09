# Plan de implementación R2 — Gateway de permisos

Estado: implementación en curso; pasos 1 a 5 completados  
Fecha: 2026-08-09

## Objetivo

Implementar `docs/architecture/PERMISSION_GATEWAY_R2.md` sin abrir cámara, micrófono ni herramientas antes de que la frontera nativa esté probada.

## Paso 1 — Tipos y validación Rust ✅

- Crear `src-tauri/src/permissions.rs`.
- Definir solicitud preparada, recurso, decisión, grant, modo, estado y límites.
- Validar IDs, capacidad, operación, propósito, duración, riesgo, efectos y fechas.
- Canonicalizar la previsualización y calcular SHA-256 en Rust.

**Puerta:** tests de serialización, campos desconocidos, duración, digest e invariantes; `fmt` y `clippy` limpios. No registrar comandos todavía.

**Resultado 2026-08-09:** completado en `src-tauri/src/permissions.rs` con 12 pruebas específicas y 48 pruebas Rust totales. El módulo no registra comandos, no crea grants reales y no abre dispositivos.

## Paso 2 — Almacén efímero y máquina de estados ✅

- Mantener solicitudes, planes privados y grants en `State<PermissionGateway>`.
- Usar IDs aleatorios opacos.
- Aplicar transiciones cerradas y expiración nativa.
- Resolver idempotencia y conflicto de claves.
- Revocar todo al terminar el proceso.

**Puerta:** pruebas de aprobación, rechazo, cancelación, vencimiento, revocación, doble consumo y concurrencia.

**Resultado 2026-08-09:** completado en `src-tauri/src/permissions/gateway.rs`. El almacén vive en `State<PermissionGateway>`, retiene el plan JSON congelado, usa UUID v4, resuelve idempotencia bajo `Mutex` y elimina todo al terminar el proceso. Doce pruebas nuevas cubren transiciones, integridad, 12 reintentos concurrentes y un lote real de 1.000 IDs sin repeticiones; la batería Rust alcanza 60 pruebas. No hay comandos R2 registrados.

## Paso 3 — Consulta y preparación ✅

- Registrar `permission_gateway_status`.
- Registrar `prepare_permission_request` sin capacidad de ejecutar.
- Exponer solo la previsualización segura; conservar parámetros ejecutables en Rust.
- Crear fallback web vacío y marcado como desarrollo.

**Puerta:** llamadas repetidas no escriben `data/`, no abren dispositivos y no crean grants.

**Resultado 2026-08-09:** `permission_gateway_status` y `prepare_permission_request` registrados. La preparación solo acepta el perfil nativo de `context.foreground.control`; cualquier capacidad no migrada se rechaza antes del almacén. El estado omite parámetros privados y declara ejecución deshabilitada. Ocho pruebas Rust nuevas y ocho TypeScript elevan las baterías a 68 y 53 respectivamente; no se crean grants ni archivos.

## Paso 4 — Decisión y revocación ✅

- Registrar decisión, cancelación y revocación.
- Implementar diálogo accesible con Aprobar, Rechazar y cierre equivalente a cancelar.
- Mostrar vencimiento, recurso, datos, efectos, riesgo y propósito.
- No ofrecer “recordar permiso”.

**Puerta:** interacción real de teclado y ratón, expiración visible y ausencia de aprobación implícita.

**Resultado 2026-08-09:** `decide_permission_request`, `cancel_permission_request` y `revoke_permission_grant` quedaron registrados junto con un diálogo nativo accesible en Puentes. La previsualización muestra propósito, recurso, datos, efectos, riesgo, vencimiento y digest; Escape cancela y el foco inicial recae en Rechazar, nunca en Aprobar. Las pruebas comprueban contra el `ObservationStore` real que aprobar crea un grant sin activar la observación, y que cancelar o revocar son terminales sin ejecución. La batería alcanza 71 pruebas Rust y 56 TypeScript; el build web aprueba. No existe un comando R2 para consumir grants o iniciar sesiones.

## Paso 5 — Primera migración real ✅

- Migrar `context.foreground.control` al Gateway.
- Rechazar el comando protegido sin grant válido.
- Consumir o mantener el grant según la operación aprobada.
- Actualizar R1 para declarar `enforcedBy: native` solamente después de probar el rechazo del bypass.

**Puerta:** activar y detener observación desde la aplicación real; cerrar o revocar elimina el contexto y no modifica memoria.

**Resultado 2026-08-09:** `set_context_observation_enabled` fue retirado del handler Tauri y sustituido por `execute_context_observation_grant`. Rust extrae `enabled` exclusivamente del plan privado congelado, rechaza IDs sin grant, inicia una sesión ligada al grant y consume una autorización `oneShot` para detenerla. Revocar un grant activo apaga el `ObservationStore`; el hilo nativo reconcilia vencimientos y descarta el contexto. R1 declara ahora `context.foreground.control` y su lectura como `enforcedBy: native`. Pruebas de integración con el almacén y observador reales cubren bypass, inicio idempotente, detención, revocación, limpieza y dos inicios concurrentes; la batería alcanza 76 Rust y 58 TypeScript. Una prueba viva opcional confirmó además que Win32 devuelve metadatos reales de la ventana en primer plano sin imprimirlos ni persistirlos. Cámara, micrófono y archivos multimedia no fueron abiertos ni creados.

## Paso 6 — Preparación de sesiones sensoriales

- Añadir leases separados para cámara y micrófono.
- Mostrar dispositivo real, duración máxima e indicador persistente.
- Implementar Detener antes de conectar análisis o memoria.
- Abrir cada dispositivo únicamente después de un grant de sesión vigente.
- Descartar señal cruda y verificar que no se crean archivos multimedia.

**Puerta:** pruebas con `ACER HD User Facing` y el arreglo de micrófonos Intel, autorizadas por Carlos Nuñez. No usar imágenes o audios pregrabados como sustituto de señal viva.

## Paso 7 — Cierre

- Actualizar documento maestro, Roadmap, README y matriz de trazabilidad.
- Crear informe `docs/testing/R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md`.
- Ejecutar toda la batería Rust, TypeScript y builds.
- Comparar SHA-256 y fechas de memoria y avatar.
- Crear commit acotado y publicar solo después de revisar secretos y archivos privados.

## Fuera de alcance

- R3 y auditoría persistente;
- Fish Audio o cualquier TTS;
- almacenamiento sensorial;
- permisos permanentes;
- ejecución libre de comandos;
- automatización en segundo plano.

## Condición para R3

R3 no comienza hasta que al menos una capacidad real esté protegida por el Gateway, las rutas directas sin grant sean rechazadas y la revocación haya sido comprobada en la aplicación real.
