# Cierre R4.5 — Taller visible y primera habilidad de solo lectura

Fecha: 2026-08-10  
Estado: aprobado localmente  
Alcance: interfaz del Taller, plantilla nativa, lectura de revisiones y prueba E2E aislada

## Resultado

La pestaña **Taller** completa el alcance de R4. Permite preparar una plantilla, editar sus textos visibles, guardar un borrador, simular el plan y gestionar `draft → inReview → approved → disabled/approved → retired`. Toda transición exige una confirmación visible, motivo, revisión esperada y SHA-256 exacto.

Preparar la plantilla no crea `data/skills`. La primera escritura canónica solo puede comenzar al pulsar **Guardar borrador**. La vista web no inventa manifiestos ni registros: el Taller requiere el backend Tauri.

## Primera habilidad

Identidad: `local.revisar-proveedores-ia`  
Capacidad: `cloud.providers.inspect`  
Operación: `cloud_status`  
Riesgo declarado: `low`

La capacidad está implementada en R1 y únicamente resume presencia de configuración y modelos públicos. No devuelve credenciales, no envía red, no inicia procesos y no escribe datos. El manifiesto declara exactamente una capacidad y una operación utilizada.

Aunque una revisión alcance `approved`, su política sigue siendo:

- `mode: simulationOnly`;
- `enabled: false`;
- `allowNetwork: false`;
- `allowProcessLaunch: false`;
- `allowLocalWrite: false`.

## Prueba E2E real y aislada

La prueba Rust `first_read_only_skill_completes_real_file_simulation_and_approval_flow` creó un directorio temporal único y utilizó archivos JSON reales. La secuencia comprobada fue:

1. generar y validar la plantilla contra las 24 capacidades R1;
2. guardar un borrador con SHA-256;
3. simular el plan y comprobar cero adaptadores y cero efectos;
4. registrar `submitReview` con revisión y SHA exactos;
5. registrar `approve` sobre la revisión inmutable resultante;
6. reabrir la revisión vigente desde el índice real;
7. confirmar estado `approved` y ejecución deshabilitada.

El fixture elimina únicamente su propio directorio temporal UUID al terminar. No usa ni modifica recuerdos, claves, avatar o archivos canónicos del usuario.

## Validación completa

- TypeScript/Vitest: 97/97 aprobadas.
- Rust/Cargo: 131/131 aprobadas; 6 sondas vivas ignoradas por defecto.
- Sondas canónicas R4: 2/2 aprobadas explícitamente contra `data/` real y sin mutación.
- Build web: aprobado.
- `cargo clippy --all-targets --all-features -- -D warnings`: aprobado.
- Build Tauri release: aprobado.

La consulta de estado del Taller es pasiva: si `data/skills` no existe, devuelve un almacén vacío sin crearlo. Durante esta implementación no se generó ninguna habilidad canónica de manera silenciosa.
