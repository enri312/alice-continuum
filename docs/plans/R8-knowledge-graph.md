# Implementación R8 — Grafo y recuperación semántica

Inicio: 2026-09-04 · R7 cerrado según su plan y validación viva.

## R8.1 — Referencias nativas de fuentes

- [x] Contrato versionado, lectura acotada y registro en R1.
- [x] Reutilizar clasificación y política de memoria R6.
- [x] Distinguir episodios de contenido enseñado y procedimientos.
- [x] Reconstrucción determinista sin copiar contenido ni persistir índices.
- [x] Prueba canónica de sólo lectura con huellas antes/después.

Validación canónica: 15 referencias, 6 bloqueadas, 8 sólo episódicas, 1
procedimental; 0 aristas y 36 archivos preservados. Informe:
[R8_1_SOURCE_GRAPH_REPORT_2026-09-04.md](../testing/R8_1_SOURCE_GRAPH_REPORT_2026-09-04.md).

## R8.2 — Asociaciones con evidencia

- [x] Contrato de aristas y propuestas con fuentes y versiones verificables para `relatedExperience`.
- [x] Invalidación por corrección, archivo, supresión y eliminación.
- [x] Persistencia revisable y reversible sin sustituir `records.json`.

Avance: `preview_knowledge_graph_association` valida dos citas exactas de entradas
episódicas distintas contra ID, versión y SHA-256 vigentes. Devuelve localizadores
en bytes del campo `intention`, sin duplicar citas ni usar respuestas del modelo.
Fuentes cambiadas, eliminadas o no recuperables se rechazan. La coincidencia de
las citas no certifica la relación: `relationVerified=false`, `requiresOwnerReview=true`.
Actualización 2026-09-05: Flujo cognitivo permite revisar y confirmar la relación,
retirarla y restaurarla. El historial `memory/associations-v1/` conserva revisiones
inmutables encadenadas; comprueba concurrencia y no modifica `records.json`.
El snapshot del grafo devuelve sólo aristas confirmadas y con evidencia vigente.
La confirmación expresa criterio del propietario, no una relación semántica probada.
Las demás clases de relación y su generación automática no forman parte de este
incremento. La representación del volumen sigue pendiente en R8.4.
Prueba nativa real con copia temporal de recuerdos: guardado, retirada, restauración,
recarga e invalidación aprobados; 36 archivos canónicos preservados.

## R8.3 — Recuperación híbrida

- [x] Evaluar el único modelo local adoptado en modo embeddings sobre datos autorizados.
- [x] Comparar calidad y coste con recuperación léxica y justificar cada resultado.
- [x] No persistir un índice vectorial con Gemma: sus dos modos de embeddings fueron rechazados; cualquier índice futuro exigirá otra evaluación explícita.
- [x] Evaluar ChromaDB: no se adopta como memoria ni índice actual porque requiere
  embeddings todavía no aprobados y duplicaría el almacenamiento gobernado. Sólo
  queda como candidato futuro para un índice documental derivado y reconstruible.
- [x] Elegir `multilingual-e5-small` como primer candidato secundario de búsqueda;
  no será agente ni generará respuestas. BGE-M3 queda aplazado.
- [ ] Comparar E5 contra recuperación léxica con corpus autorizado, sin Chroma ni
  persistencia de vectores, después de estabilizar el canal de voz.
- [x] Rechazar `mean` y `last` de Gemma causal por calidad inferior, sin persistir vectores.
- [x] Evaluar Gemma como reranqueador secuencial: 100% Top-3, 22.2% Top-1 y 1.68 s/consulta sobre 9 registros reales del perfil.
- [x] Incorporar una previsualización híbrida explícita y cancelable; no usar el reranqueador mientras se escribe ni guardar su salida como recuerdo.
- [x] Validar la previsualización integrada desde Alice con Gemma iniciada manualmente y un mensaje real del propietario: 18 candidatos accesibles, tres resultados revisables, auditoría íntegra y cero archivos derivados.

## R8.4 — Volumen y cierre

- [x] Leer asociaciones locales activas desde el snapshot nativo y dibujar una arista violeta sólo entre dos nodos de memoria cuyas fuentes sigan vigentes y cuya relación haya sido confirmada por el propietario. Una respuesta malformada, una relación retirada o la falta de una segunda fuente deja el volumen sin arista persistente.
- [x] Conectar referencias/aristas al volumen y abrir su evidencia real desde el inspector: cada relación muestra las dos citas vigentes, sus versiones y posiciones UTF-8, sin copiar respuestas del modelo ni persistir otra proyección.
- [x] Estados vacío, normal, fuente cambiada y error visibles.
- [x] Verificación completa de privacidad, reconstrucción y ciclo R6.

Cierre 2026-09-11: el observatorio distingue los cuatro estados sin ocultar ni
reescribir recuerdos. La sonda canónica reconstruyó 3 referencias desde el conjunto
real vigente, preservó las huellas de 42 archivos y no creó aristas ni índices. Ver
[informe de cierre R8.4](../testing/R8_4_VOLUME_CLOSEOUT_2026-09-11.md).

Se conserva la navegación existente. R8.1 y R8.2 preparan el backend y la evidencia
revisable; no declaran completada la búsqueda semántica, el aprendizaje automático
ni la integración visual del grafo.
