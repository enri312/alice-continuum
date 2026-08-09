# Plan de implementación R2 — Gateway de permisos

Estado: implementación en curso; paso 1 completado  
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

## Paso 2 — Almacén efímero y máquina de estados

- Mantener solicitudes, planes privados y grants en `State<PermissionGateway>`.
- Usar IDs aleatorios opacos.
- Aplicar transiciones cerradas y expiración nativa.
- Resolver idempotencia y conflicto de claves.
- Revocar todo al terminar el proceso.

**Puerta:** pruebas de aprobación, rechazo, cancelación, vencimiento, revocación, doble consumo y concurrencia.

## Paso 3 — Consulta y preparación

- Registrar `permission_gateway_status`.
- Registrar `prepare_permission_request` sin capacidad de ejecutar.
- Exponer solo la previsualización segura; conservar parámetros ejecutables en Rust.
- Crear fallback web vacío y marcado como desarrollo.

**Puerta:** llamadas repetidas no escriben `data/`, no abren dispositivos y no crean grants.

## Paso 4 — Decisión y revocación

- Registrar decisión, cancelación y revocación.
- Implementar diálogo accesible con Aprobar, Rechazar y cierre equivalente a cancelar.
- Mostrar vencimiento, recurso, datos, efectos, riesgo y propósito.
- No ofrecer “recordar permiso”.

**Puerta:** interacción real de teclado y ratón, expiración visible y ausencia de aprobación implícita.

## Paso 5 — Primera migración real

- Migrar `context.foreground.control` al Gateway.
- Rechazar el comando protegido sin grant válido.
- Consumir o mantener el grant según la operación aprobada.
- Actualizar R1 para declarar `enforcedBy: native` solamente después de probar el rechazo del bypass.

**Puerta:** activar y detener observación desde la aplicación real; cerrar o revocar elimina el contexto y no modifica memoria.

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
