# ADR-P-078 — Estado nativo y restauración gobernada

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

R6.3-E puede recuperar una consolidación interrumpida usando únicamente el recibo durable, pero sus funciones permanecían internas. Un reinicio real necesitaba una forma visible de distinguir ausencia, recuperación pendiente, cierre correcto y bloqueo sin ejecutar automáticamente ninguna escritura.

## Decisión

R6.3-F registra `consolidation_recovery_status` como consulta Tauri de sólo lectura. El contrato cerrado devuelve `idle`, `recoveryRequired`, `restored` o `blocked`, la relación de la fuente con el recibo y banderas explícitas que niegan recuperación automática y ejecución de fusión.

También registra `restore_consolidation_transaction`. El comando sólo acepta el ID de una transacción existente, las huellas original y proyectada observadas y `confirmed: true`. Las rutas se derivan internamente. Una auditoría R3 de solicitud debe persistirse antes de restaurar y el recibo cambia a `restored` únicamente después de persistir la auditoría de éxito y verificar la fuente original.

`prepare_interrupted_consolidation_at` sigue siendo interno. No existe comando para crear el recibo, proyectar recuerdos o fusionarlos.

## Consecuencias

- Alice puede mostrar un estado real después de reiniciar sin inventar actividad;
- un recibo corrupto, una fuente ausente o una tercera huella bloquean sin escritura;
- una auditoría de solicitud fallida impide tocar `records.json`;
- una restauración ya cerrada es idempotente y no vuelve a auditar;
- React recarga la memoria desde disco después de una restauración aprobada;
- completar esta vía de seguridad no autoriza una fusión canónica.
