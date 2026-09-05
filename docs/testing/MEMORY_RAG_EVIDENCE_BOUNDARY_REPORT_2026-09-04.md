# Límite de evidencia en recuperación de memoria

Fecha: 2026-09-04  
Resultado: aprobado con datos locales reales y sin modificar memoria.

## Problema verificado

El almacén contenía episodios de conversación vigentes cuya entrada del propietario
era real, pero cuya respuesta histórica provenía de modelos que podían perder
contexto o afirmar datos incorrectos. El estado `confirmed` acredita la conservación
del episodio; no certifica como verdad el texto generado por el modelo.

La prueba sobre el almacén vigente contó 15 episodios: 2 conflictivos y 4 suprimidos
ya quedaban fuera; 9 resultaban elegibles. Antes del cambio, términos presentes sólo
en una respuesta histórica podían activar el RAG.

## Corrección

- Una conversación se indexa únicamente por la entrada real `intention`.
- Su respuesta histórica (`summary`) y su próximo paso no aportan puntuación RAG.
- Si el episodio es recuperado, el payload muestra lo que Carlos dijo o preguntó y
  declara que la antigua respuesta del modelo no se incorpora como conocimiento.
- Recuerdos no conversacionales mantienen su resumen según su tipo y procedencia.
- Conflicto, reposo, supresión y archivo continúan bloqueando recuperación.

## Verificación real

Se ejecutó el recuperador TypeScript directamente sobre `data/memory/records.json`.
Una consulta formada sólo por una afirmación de una respuesta histórica devolvió
cero coincidencias. Una consulta coincidente con la pregunta real recuperó el
episodio, y el payload resultante no contenía la afirmación histórica.

Las pruebas automatizadas cubren además el rechazo del resumen conversacional y la
composición exacta del payload. Ningún registro, estado, contador o archivo privado
fue escrito durante esta validación.
