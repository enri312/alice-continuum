# Grafo de conocimiento y recuperación semántica R8

Estado: R8 completada · actualizado 2026-09-11.

## Fuente y significado

R6 conserva los registros originales y sus decisiones. R8 deriva referencias e índices
que se pueden reconstruir. Confirmar que una conversación ocurrió no certifica las
afirmaciones de su respuesta. La similitud semántica tampoco acredita verdad.

R8.1 consulta únicamente `memory/records.json` en la raíz de datos configurada. El
perfil separado se incorpora a la recuperación de Conversación mediante su snapshot
validado, confirmación del propietario y huellas de fuente; no forma parte del snapshot
de nodos R8.1. Las notas Markdown y el historial completo requerirán contratos de
procedencia propios y no se mezclan silenciosamente con este inventario.

## Proyección v1

`knowledge_graph_snapshot` es una consulta nativa sin argumentos de ruta:

- `schemaVersion=1`, `state=missing|empty|ready`, `sourceFile=memory/records.json`;
- `sourceSha256`: SHA-256 de los bytes exactos, nulo sólo si falta la fuente;
- `nodes`: referencias ordenadas por ID con `nodeId`, `recordVersion`, `lifecycle` R6 completo,
  `layer`, `hasDeclaredSource`, `evidenceUse`;
- `edges=[]`: R8.1 aún no admite asociaciones persistentes;
- `recordsModified=false`, `indexPersisted=false`, `inferencePerformed=false`.

Cada referencia incluye el ID del registro y su huella a través de `lifecycle` y
su versión vigente en `recordVersion`; `baseVersion` de R6 permanece en 1 y el
contador de reconsolidaciones conserva el historial. No duplica títulos, respuestas, procedencia textual, coordenadas ni
contenidos. La identidad `record:<id>` permanece estable al corregir; las huellas
cambian. El consumidor debe verificar la huella vigente antes de resolver una
referencia contra el contenido. Una nueva consulta reconstruye todo desde la fuente.

Se reutilizan validación, clasificación y política de ciclo de R6. `layer` distingue
`episodic`, `taughtFact`, `procedural` y `unclassified`. `evidenceUse` distingue:

| Valor | Interpretación |
|---|---|
| `blocked` | R6 bloquea recuperación por conflicto, archivo, reposo o supresión |
| `episodeOnly` | episodio real; no promover la respuesta del modelo a conocimiento |
| `ownerConfirmedContent` | enseñanza semántica vigente con procedencia declarada; confirmación del propietario, no verificación externa |
| `procedureReferenceOnly` | clase procedimental; no acredita una habilidad ni autoriza ejecutarla |
| `reviewRequired` | falta confirmación, procedencia o clasificación suficiente |

El archivo está limitado a 8 MiB y 10.000 registros en esta primera consulta. Un
exceso, lectura fallida, UTF-8 inválido, JSON corrupto o registro inválido devuelve un
error; nunca un grafo vacío aparentemente sano. Un archivo ausente no crea carpetas.

## Asociaciones e índices posteriores

R8.2 definirá una arista con identidad, extremos versionados, tipo, origen y evidencia
localizable. Una inferencia de modelo se conservará como propuesta hasta su revisión.
La fuerza de asociación, similitud y vigencia serán valores distintos. Los estados
R6 deberán excluir fuentes bloqueadas tanto de búsqueda como de generación de nuevas
asociaciones. Una corrección invalidará evidencia antigua; una eliminación retirará
sus referencias del índice. No se publicarán textos privados en auditoría.

R8.3 evaluó embeddings locales con corpus autorizado, comparación contra búsqueda
léxica, latencia y calidad de recuperación. Los embeddings de Gemma se rechazaron y
no se creó un índice. El mismo modelo sólo amplía tres candidatos mediante una acción
manual y visible en Conversación. Su salida declara que no está persistida ni verifica
la verdad y requiere revisión del propietario. Un futuro índice deberá declarar modelo,
dimensión, versión y huellas de fuente; cambiar estos datos exigirá reconstruirlo.
R8.4 conecta las referencias y aristas vigentes al volumen existente sin inventar
actividad. El inspector resuelve las posiciones UTF-8 contra el campo `intention`
actual y abre las citas de cada relación confirmada. Los estados `empty`, normal,
fuente cambiada y error se muestran por separado; una relación cuya fuente dejó de
coincidir desaparece del volumen y queda señalada para revisión.

El volumen consume las aristas activas del snapshot nativo y conserva todos los
campos de evidencia validados: registro, versión, huella, campo y posiciones UTF-8.
Al seleccionar uno de los dos nodos, el inspector permite abrir ambas citas desde
el contenido vigente ya cargado. Una posición inválida, una codificación cortada o
una arista incompleta se rechaza en el cliente y no produce conexión ni cita visual.

## Dependencias intercambiables

### Avance del contrato de propuestas

`preview_knowledge_graph_association` acepta exactamente dos evidencias de episodios
distintos: ID, versión, SHA-256 y cita literal (máximo 2048 bytes). Lee la fuente
vigente y aplica R6 antes de buscar la cita en `intention`, nunca en la respuesta
histórica de un modelo. Fuentes alteradas o no recuperables se rechazan.

Devuelve `relatedExperience` como propuesta, posiciones UTF-8 en bytes y huellas de
cita; no copia textos ni escribe archivos durante la vista previa. `relationVerified=false` y
`requiresOwnerReview=true` impiden confundir integridad de citas con una relación
semántica demostrada.

Desde R8.2, `confirm_knowledge_graph_association` conserva la decisión explícita
en revisiones inmutables bajo `memory/associations-v1/`. Retirar/restaurar exige
confirmación y revisión esperada; restaurar exige además evidencia vigente.
`knowledge_graph_associations` muestra el estado actual. El snapshot sólo
incluye aristas confirmadas y aún recuperables, con `ownerConfirmed=true` (no prueba
semántica). Ver [contrato y pruebas del historial](../testing/R8_2_ASSOCIATIONS_REPORT_2026-09-05.md).
Otras clases de relaciones y su generación automática siguen fuera del alcance de R8.

### Motores opcionales

LightRAG puede evaluarse como motor de indexación/recuperación detrás de este contrato.
No determina la identidad, vigencia, supresión o confirmación de los recuerdos de
Alice. Su documentación ofrece extracción de grafos, citas y eliminación documental;
el prototipo local no conecta estas funciones con los estados de R6.

Referencia primaria consultada: [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG).
La evaluación del prototipo concreto está en
[la auditoría de adaptadores](../research/ADAPTER_STATIC_AUDIT_2026-09-04.md).
