# ADR-P-111: recuperación de memoria y control de Gemma

Fecha: 2026-11-05. Estado: aceptada.

Se conserva el monolito de escritorio React/Tauri/Rust y los motores actuales.
La revisión sobre `aa6a749` detectó dos defectos concretos: guardar/restaurar podía
devolver error después de cambiar `records.json`, y una inferencia retenía el
bloqueo del proceso que necesitan consultar estado y detener Gemma.

## Memoria básica

Guardar y restaurar reutilizan el reemplazo atómico existente: temporal exclusivo
en el mismo directorio, escritura sincronizada, reemplazo nativo y comprobación
de contenido. Los respaldos también utilizan esa primitiva y conservan los bytes
anteriores, incluyendo su formato. No se cambian esquemas, validaciones ni permisos.

Si falla el reemplazo o la auditoría interna, se comprueba la fuente y se recupera
el contenido anterior cuando haga falta. Si antes no existía, se elimina el
archivo creado por la operación fallida. Si también falla la recuperación, el
error comunica ambos fallos y la ubicación del respaldo; requiere revisión antes
de reintentar. La fachada mantiene su exclusión de escritura durante todo el caso.

Esto proporciona recuperación ante errores de E/S comunicados. No constituye una
transacción entre varios archivos frente a una pérdida de energía: un cierre
abrupto entre reemplazo y auditoría o un registro parcialmente escrito todavía
requieren inspección. No se modifica la semántica de exportaciones ni de otras
operaciones avanzadas de memoria.

## Motor local

La exclusión entre inferencias se separa del bloqueo que protege el proceso hijo.
Las esperas HTTP ya no conservan este último. Una generación identifica el ciclo
del motor: detener invalida peticiones activas y en espera; iniciar un nuevo
proceso establece otra generación. Las peticiones anteriores se rechazan y no
se reutilizan automáticamente después del reinicio.

Durante una petición pendiente se consulta la cancelación cada 25 ms. Se aborta
y espera la tarea HTTP antes de liberar la exclusión de inferencia. Es un intervalo
de comprobación, no una garantía de latencia total del sistema. Detener conserva
el cierre exclusivo del hijo propio y la liberación del permiso de arbitraje.
No adopta ni cierra motores ajenos; se conserva la comprobación de Ollama.

El arranque sigue serializado y conserva su plazo de preparación de 60 segundos;
esta decisión elimina la espera de una respuesta de chat, no todas las esperas
del ciclo de vida. Tampoco incorpora interrupción acústica durante el habla,
activación por nombre ni cambios de Gemma o Fish.

Las regresiones usan memoria ficticia, un servidor HTTP de puerto efímero y
procesos hijos del ejecutable de tests. La integración con Gemma instalado se
comprueba por separado. Véase el [informe de validación](../testing/RELIABILITY_REPORT_2026-11-05.md).
