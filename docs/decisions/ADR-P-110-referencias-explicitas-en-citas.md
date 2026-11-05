# ADR-P-110: referentes explícitos en citas

Fecha: 2026-11-05. Estado: aceptada para un alcance acotado.

Gemma confundió el destinatario y la perspectiva en citas como «mi hermano me
dijo: quiero mejorar tu forma de explicar». Los cambios de prompt, formato y
razonamiento ensayados no resolvieron todos los casos; algunos añadieron varios
segundos. Esos experimentos se conservan como evidencia privada y no se activan.

Se añade `conversation_reference.rs`: una lectura gramatical local del mensaje
actual, para preguntas explícitas sobre un posesivo de una única cita. Reconoce
un destinatario Carlos en «me dijo/comentó…» o un nombre explícito en «le dijo a
Ana…». Sólo admite determinadas cualidades, como explicación, voz o forma de
hablar; no infiere antecedentes de un historial ni identidad desde una imagen.

El lector se abstiene ante citas múltiples o anidadas, nombres coordinados,
negaciones, hipótesis, posesivos sin cobertura, preguntas sobre otro sujeto y
mensajes largos. La conversación normal continúa por Gemma cuando se abstiene.
La ruta no concede herramientas, no accede a recursos externos y no solicita
permisos adicionales. Se limita a la conversación Gemma sin imágenes adjuntas.

La respuesta identifica su procedencia como «Referencia explícita del mensaje»,
con cero tokens de inferencia. Usa el ciclo existente de historial, sesión y voz.
No se presenta como una mejora de los pesos ni como comprensión general del LLM.
La configuración del modelo, Fish y los formatos de memoria se conservan.

La aceptación con voz real y música queda pendiente: el propietario indicó que
era demasiado tarde para probarla. Los pronombres ambiguos y la continuidad de
cinco turnos siguen abiertos en R9. El cuerpo continúa pospuesto.

[Informe](../testing/CONVERSATION_REFERENCES_REPORT_2026-11-05.md).
