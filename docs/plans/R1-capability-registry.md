# Plan de implementación R1 — Registro de capacidades

Estado: completado y validado con aplicación y archivos reales  
Fecha: 2026-08-09

## Objetivo

Materializar el contrato de `docs/architecture/CAPABILITY_REGISTRY_R1.md` sin añadir permisos, herramientas ni efectos nuevos.

## Precondiciones cumplidas

- Se inventariaron los diez comandos Tauri vigentes.
- Se separaron capacidades implementadas, parciales y planificadas.
- Se identificaron los controles que hoy dependen de React.
- Se documentó que `load_memory` no es una lectura pura.
- ADR-P-041 fue aceptada para implementación.

## Migración incremental

### Paso 1 — Tipos y validación en Rust

- Crear `src-tauri/src/capabilities.rs`.
- Definir snapshot, descriptor, permiso, salud y enumeraciones serializables.
- Añadir validación de identificadores únicos e invariantes.
- Probar serialización `camelCase` y valores de enumeración.

**Puerta:** `cargo fmt`, tests del módulo y `clippy` deben aprobar sin registrar todavía el comando.

### Paso 2 — Sondas pasivas por adaptador

- Nube: resumir presencia de proveedores configurados sin leer ni devolver claves.
- Observación: consultar si el estado está encendido sin capturar una ventana nueva.
- Memoria: inspeccionar existencia y estructura sin crear carpetas, manifiestos o migraciones.
- Avatar: reutilizar validación de ruta y metadatos sin cargar Three.js ni modificar el VRM.
- Salidas futuras: producir descriptores `planned` y `unavailable` sin métricas.
- Entradas sensoriales futuras: producir descriptores `planned` y `unavailable` sin abrir pantalla, cámara, micrófono ni modelos.

**Puerta:** una prueba con raíz temporal inexistente confirma que la sonda de memoria no crea ningún archivo.

### Paso 3 — Comando único de consulta

- Añadir `capability_registry_status`.
- Registrarlo en `lib.rs` sin modificar nombres ni firmas existentes.
- Confirmar que llamadas repetidas son idempotentes y no escriben auditoría.

**Puerta:** tests Rust, compilación y comparación del conjunto anterior de comandos.

### Paso 4 — Contrato TypeScript

- Crear tipos en `src/core/governance/capabilities.ts`.
- Validar de forma defensiva el snapshot recibido.
- Definir un fallback de navegador marcado como entorno de desarrollo, no como backend real.

**Puerta:** pruebas de snapshot válido, versión desconocida, ID repetido y estado planificado inválido.

### Paso 5 — Migración de Puentes

- Sustituir la autoridad del arreglo estático por el snapshot nativo.
- Conservar las pestañas y estilo actuales.
- Agrupar capacidades por dominio para pantallas convencionales.
- Mostrar madurez, estado, riesgo, permiso vigente, efectos y salud.
- Mantener latencia, paquetes y última ejecución vacíos hasta R3.
- Diferenciar visualmente `unavailable`, `disabled`, `idle`, `active`, `degraded` y `error`.

**Puerta:** pruebas de interfaz y revisión visual de estados representativos.

### Paso 6 — Documentación y cierre

- Actualizar documento maestro y matriz de trazabilidad con la evidencia real.
- Cambiar R1 a completada solo después de las puertas técnicas.
- Crear `docs/testing/R1_CAPABILITY_REGISTRY_REPORT_2026-08-08.md`.
- Registrar el cambio en un commit acotado.

## Archivos previstos

| Archivo | Cambio esperado |
|---|---|
| `src-tauri/src/capabilities.rs` | Nuevo módulo y tests del registro. |
| `src-tauri/src/lib.rs` | Declaración del módulo y registro de un comando. |
| `src-tauri/src/cloud.rs` | Sonda o helper no sensible de configuración. |
| `src-tauri/src/observation.rs` | Lectura del estado vigente sin activar captura. |
| `src-tauri/src/memory.rs` | Sonda estrictamente pasiva de ruta y existencia. |
| `src-tauri/src/avatar.rs` | Helper pasivo de disponibilidad. |
| `src/core/governance/capabilities.ts` | Tipos y validación defensiva. |
| `src/pages/governance/CapabilityRegistryPage.tsx` | Consumo y presentación del snapshot. |

La lista es una previsión, no autorización para ampliar responsabilidades de esos módulos.

## Compatibilidad y datos

- No cambia `records.json`, su manifiesto ni el formato de auditoría.
- No migra datos personales.
- No modifica `Assets/Alice.vrm` ni ningún archivo dentro de `E:\Alice`.
- No cambia variables de entorno ni proveedores.
- No añade dependencias externas.
- No publica el repositorio ni configura un remoto.

## Matriz mínima de pruebas

| Caso | Resultado esperado |
|---|---|
| Sin API keys | Inspección de proveedores disponible; envío `unavailable`. |
| Con un proveedor configurado | Envío `idle`, nunca `active` sin solicitud real. |
| Observación apagada | Control y lectura `disabled`. |
| Observación encendida | Control `active`; lectura no inventa un título. |
| Raíz de memoria inexistente | Estado informado sin crear directorios. |
| Memoria existente válida | Lectura y escritura descritas como disponibles. |
| Sin respaldo | Restauración `unavailable`. |
| VRM inexistente | Inspección y render `unavailable`. |
| VRM válido | Inspección y render `idle` hasta abrir o cargar. |
| Puente futuro | `planned`, `unavailable`, sin latencia ni ejecución. |
| ID duplicado | Snapshot rechazado por validación. |
| Versión desconocida en React | Error controlado, no interpretación optimista. |

## Comandos de verificación

```powershell
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
npm test
npm run build
```

## Condición para iniciar R2

R2 no comienza porque el registro aparezca visualmente terminado. Primero R1 debe demostrar que su snapshot es correcto, pasivo, trazable y resistente a estados incompletos. Solo entonces se diseñará la puerta nativa de permisos.
