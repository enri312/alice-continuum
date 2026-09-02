# ADR-P-087 — Conversación temporal sin consolidación automática

Fecha: 2026-09-02  
Estado: aceptada; sustituye la promoción automática descrita en ADR-P-074

## Contexto

La conversación guardaba por defecto cada intercambio como episodio confirmado y usaba la respuesta del modelo como resumen durable. Aunque acreditaba que el intercambio ocurrió, una respuesta incorrecta, incompleta o fuera de contexto podía entrar en `records.json` sin revisión humana.

## Decisión

Los intercambios de conversación permanecen únicamente en la memoria de trabajo R6.2. La respuesta de un modelo nunca se convierte automáticamente en recuerdo durable ni en hecho confirmado.

El panel distingue una fuente seleccionada de una fuente con datos disponibles. El botón del observador abre el Gateway R2 para configurar permisos; no promete activar o detener directamente. Una futura promoción de conversación a episodio deberá ser explícita, revisable y conservar procedencia sin afirmar como verdad el texto generado.

## Consecuencias

- Conversar alimenta contexto temporal y actividad R3 real sin contaminar la memoria durable.
- Reiniciar o vencer la memoria de trabajo elimina el intercambio temporal.
- `memory/records.json` no cambia como efecto secundario de una respuesta.
- La extracción o consolidación futura queda fuera de este cambio.

## Alternativas rechazadas

- Mantener la casilla activada por defecto: el consentimiento visual no corrige la promoción indiscriminada.
- Marcar todas las respuestas como episodios de baja fuerza: baja fuerza sigue siendo persistencia durable.
- Declarar el texto del modelo como confirmado porque la conversación ocurrió: confunde procedencia del evento con verdad del contenido.
