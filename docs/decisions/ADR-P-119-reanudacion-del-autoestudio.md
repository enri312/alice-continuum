# ADR-P-119 — Reanudación del autoestudio

Fecha: 2026-11-11. Estado: implementado.

Un único booleano impedía ejecutar dos ciclos simultáneos, pero perdía una
reanudación recibida antes de terminar el anterior. La pausa también podía
deshacerse antes de recibir una respuesta y permitir guardarla como vigente.

`self_study/coordinator.rs` conserva un ciclo activo y un reinicio pendiente
coalescido. Pausa incrementa la generación y cancela el pendiente; reanudar
encola la generación vigente. La liberación del worker, incluida su salida
temprana, entrega el pendiente bajo el mismo mutex que recibe las solicitudes.
No programa reintentos automáticos ante errores ordinarios.

Los controles se persisten bajo el bloqueo de escritura antes de publicar el
cambio de generación. Respuestas y fases comprueban esa generación dentro del
mismo bloqueo antes de escribir. Una activación redundante conserva la fase y
los bytes existentes. El arranque pausado no reserva un worker.

Se conservan el currículo cerrado, los contratos IPC, el formato del almacén,
la prioridad de conversación y la separación entre conocimiento y pesos.

[Validación y límites](../testing/COGNITIVE_R9_CONTINUATION_REPORT_2026-11-11.md).
