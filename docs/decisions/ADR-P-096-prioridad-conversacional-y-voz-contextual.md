# ADR-P-096 — Comprensión conversacional antes de presencia visual

Fecha: 2026-09-20  
Estado: rumbo aceptado por el propietario; implementación parcial, calidad pendiente de validación conversacional.

## Contexto

Las pruebas manuales mostraron respuestas genéricas y cambios de una charla
cotidiana hacia proyectos sin petición del usuario. Un selector manual de tono
no satisface el objetivo de una conversación expresiva y contextual.

## Decisión

1. Priorizar comprensión del mensaje, continuidad temática y pertinencia de la
   memoria. La integración conversacional con el VRM queda pospuesta; no se
   elimina ni se modifica el visor existente.
2. Mantener Gemma como modelo conversacional principal y Fish como salida de
   voz. GPT-Live 1 es una referencia de experiencia, no una dependencia adoptada
   ni una promesa de equivalencia técnica.
3. El mensaje actual manda sobre recuerdos de proyectos o preferencias de
   trabajo. Una vivencia personal no debe convertirse automáticamente en tarea.
4. La memoria confirmada puede aportar contexto; no modifica los pesos del modelo.
   No hay entrenamiento automático ni promoción de toda charla a recuerdo.
5. La base vocal es cálida y conversacional. Se retira el selector de tono del chat.
   La implementación actual antepone una indicación general a Fish para seguir el
   significado del texto; no constituye un plan expresivo por frase generado por
   Gemma ni una evaluación emocional del usuario.
6. Conservar revisión del texto exacto y autorización antes de enviar a Fish,
   credenciales sólo en el entorno nativo y audio temporal. No enviar el historial
   completo para obtener expresividad.
7. Los controles de visualización del historial pertenecen a Configuración. La
   vista abreviada no borra datos ni cambia las fuentes autorizadas para inferencia.

## Estado comprobable

- Flujo actual: captura manual → transcripción local → borrador revisable →
  respuesta textual → síntesis autorizada. No es dúplex completo.
- No se analiza la entonación del usuario, ni hay manejo conversacional de
  interrupciones o sincronización con el VRM en este flujo.
- Se ajustaron instrucciones de continuidad y se retiraron el selector vocal y
  el recuadro de expansión del historial del chat.
- Configuración permite mostrar todos los mensajes o los últimos 12. La selección
  dura esta sesión de la aplicación; no persiste tras reiniciar.
- Las pruebas automatizadas verifican contratos y presencia de instrucciones,
  no la comprensión real de Gemma ni la interpretación acústica de Fish.
- Las últimas respuestas reportadas por el propietario no cumplieron sus
  expectativas. Los cambios posteriores requieren nuevas pruebas; no se declara
  cerrada la etapa de conversación ni R9.

Seguimiento 2026-09-20: a petición del propietario se retiró el historial activo
con respaldo privado verificado, sin modificar memoria confirmada. Esta operación
no implica mejora del modelo ni cierre de la validación; permite retomar pruebas
con el chat limpio. El procedimiento queda en el runbook asociado.

## Criterio para avanzar

### Prioridad reafirmada por el propietario — 2026-11-03

El avatar queda para el final. La prioridad actual es conseguir que la aplicación
funcione de forma fiable, empezando por conversación, continuidad y memoria.
Tras revisar alternativas, el propietario decidió mantener Gemma 4. LFM3-1.7B y
Granite 4.0 H Tiny quedan para una evaluación futura. El siguiente paso aceptado
es escuchar y responder por voz en R9, según [ADR-P-097](ADR-P-097-conversacion-por-turnos-de-voz.md).

### Revisión local del 2026-09-20

Se inspeccionaron `cloud.rs` y `cloud-payload.ts`. Las instrucciones acumuladas
ocupaban 4440 caracteres; Gemma recibe temperatura 0,2 y máximo 900 tokens de
salida. El payload coloca el mensaje actual después de las fuentes autorizadas;
el historial omite respuestas anteriores del asistente. Esto limita continuidad,
pero no demuestra la causa del fallo de una respuesta aislada. No se conservó el
payload histórico exacto del incidente y no se afirma haberlo reconstruido.

Se realizaron seis generaciones directas por loopback, con ejemplos ficticios,
sin persistencia en el historial de Alice ni llamadas a Fish. Una comparación con
semilla 42 y temperatura 0,2 redujo los tokens de entrada de 939 a 531 usando un
prompt compacto, pero ambas respuestas siguieron siendo genéricas. Cuatro pruebas
exploratorias con ejemplos de estilo mantuvieron el tema cotidiano y contestaron
una consulta técnica; persistieron preguntas innecesarias y una invitación a
probar interacciones no implementadas. No constituye una evaluación estadística.

Se adopta la organización compacta con ejemplos ficticios y una frontera explícita
para el avatar no integrado; se conserva temperatura 0,2. La última precisión
sobre el avatar requiere una nueva prueba de comportamiento.
La repetición final se intentó, pero el motor local dejó de aceptar conexiones;
no se inició otro proceso ni se obtuvo una séptima respuesta.
No se modifican recuerdos ni la política de exclusión del historial del asistente. Incorporar
respuestas anteriores como diálogo no factual requiere un diseño y pruebas propios.
Este ajuste reemplaza la acumulación incremental de reglas, no declara solucionado
el problema ni entrenado el modelo.

Evaluar varios turnos con cambios de tema, relatos personales, consultas técnicas
y correcciones. Registrar fallos de contenido por separado de fallos acústicos.
No seguir ampliando el prompt sin contrastar resultados. Entrenamiento adicional,
nuevos motores o transmisión continua requieren una evaluación y decisión propias.

## Referencias

- [ADR-P-094: puentes independientes](ADR-P-094-puentes-de-presencia-voz-y-cuerpo.md)
- [Operar y evaluar conversación y voz](../runbooks/03-conversacion-y-voz.md)
- [GPT-Live 1, referencia oficial](https://developers.openai.com/api/docs/models/gpt-live-1)
- [Fish: indicaciones expresivas](https://fish.audio/es/blog/fish-audio-s2-fine-grained-ai-voice-control-at-the-word-level/)
