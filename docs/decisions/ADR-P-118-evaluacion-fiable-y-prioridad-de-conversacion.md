# ADR-P-118 — Evaluación fiable y prioridad de conversación

Fecha: 2026-11-11. Estado: implementado y validado en Windows.

## Problemas

Un fallo de transporte o una respuesta no evaluable de Gemma terminaba convertido
en `passed=false`. Si ocurría al repasar una lección aprobada, aumentaba intentos
y retiraba esa lección de RAG sin haber recibido una respuesta calificable.

La preempción de estudio tampoco representaba una conversación todavía en la
cola del worker: el estudio podía tomar el mutex después del aviso y capturar
el epoch nuevo. Además, una respuesta que llegaba durante `recv_timeout` no
revisaba si entretanto había que ceder el turno.

## Decisión

Sólo una respuesta validada por `checked_answer` puede cambiar el resultado de
una lección. `persist_checked_attempt_at` verifica los controles antes y bajo el
bloqueo de persistencia. Una respuesta válida equivocada conserva la política
anterior: cuenta como ejercicio fallido y deja de ser recuperable.

Ante fallo técnico o respuesta no evaluable, los registros, fechas, intentos,
aprobaciones y disponibilidad permanecen iguales. Se guarda la fase existente
`error` con un mensaje constante, se emite ese estado y termina el ciclo sin
marcarlo completo. Los resultados válidos anteriores del ciclo se conservan;
lo restante queda para otro ciclo. No se reclasifica el historial anterior.

`local_inference/priority.rs` separa la prioridad entre solicitudes del control
del proceso y del transporte. Una intención de primer plano se reserva antes de
`spawn_blocking` y se libera al terminar, fallar o cancelar. El autoestudio cede
si hay alguna conversación pendiente, aunque todavía no haya tomado el mutex.
La generación y la cesión se revisan también al aceptar una respuesta recibida.

El árbitro global Gemma/Ollama continúa protegiendo la exclusividad entre motores;
este coordinador nuevo sólo resuelve prioridad dentro de Gemma. Se conservan
comandos Tauri, formatos, plazos, parámetros del modelo, currículo y permisos.
Transporte y ciclo de vida siguen pendientes de una separación posterior cuando
una revisión concreta la justifique.

## Alcance

Esto mejora la fiabilidad del aprendizaje recuperable y la coordinación del
motor; no entrena pesos ni añade materias. Queda pendiente revisar la reanudación
rápida del autoestudio mientras el ciclo anterior aún termina, para que una
solicitud nueva no se pierda ni muestre una fase inexacta.

[Validación y límites](../testing/COGNITIVE_CORE_RELIABILITY_REPORT_2026-11-11.md) ·
[Autoestudio](../runbooks/06-autoestudio-al-arrancar.md).
