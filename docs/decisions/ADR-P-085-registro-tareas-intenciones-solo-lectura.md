# ADR-P-085 — Registro de tareas e intenciones de solo lectura

Fecha: 2026-09-01  
Estado: aceptada

## Contexto

R6 cerró la memoria real de Alice. Iniciar R7 directamente con un scheduler permitiría confundir una frase recordada con una orden futura, duplicar efectos después de reiniciar o ejecutar una capacidad sin volver a resolver R1 y R2.

## Decisión

R7 comienza con un contrato cerrado y una sonda nativa de solo lectura. El registro distingue recordatorios locales de comprobaciones de capacidades, exige origen `ownerConfirmed`, identidad UUID, próxima ejecución explícita, alcance y estado cancelable coherente.

La consulta no crea el almacén ausente y siempre declara `automaticExecution=false`. Las comprobaciones sólo pueden conservar un `capabilityId`; no guardan comandos, argumentos ni contenido ejecutable. La capacidad `tasks.registry.inspect` se incorpora al registro R1 como consulta implementada, sin presentar un scheduler inexistente.

## Consecuencias

- Un recuerdo no se convierte en tarea por similitud, importancia o salida de modelo.
- Reiniciar Alice todavía no ejecuta nada; la identidad durable queda definida antes del motor.
- Un archivo corrupto se bloquea y permanece intacto para diagnóstico.
- La interfaz futura podrá mostrar estado, próxima ejecución, alcance y cancelabilidad desde datos nativos.
- Crear, cancelar, vencer, notificar e intentar una comprobación requieren incrementos separados con respaldo y auditoría R3.

## Alternativas rechazadas

- Reutilizar `records.json`: mezclaría memoria con intención operativa.
- Guardar comandos libres: eludiría el registro R1 y el Gateway R2.
- Empezar con tareas recurrentes: multiplica los casos de reloj, reinicio e idempotencia antes de validar el ciclo mínimo.
- Crear un archivo vacío durante la consulta: convertiría una lectura en mutación y fingiría inicialización.

