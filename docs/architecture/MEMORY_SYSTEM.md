# Sistema de memoria de Alice

Estado: almacenamiento v1 vigente; ciclo R6.5-J; proyección por capas R6.6-A  
Fecha: 2026-08-24

## Propósito

La memoria de Alice conserva experiencias, conocimiento confirmado, procedimientos y contexto local para recuperarlos cuando corresponda. No es una carpeta de textos ni un entrenamiento oculto del modelo: implementa un ciclo explícito de codificación, candidatura, consolidación, recuperación, revisión y olvido funcional. No modifica los pesos del proveedor y no convierte automáticamente una salida de un modelo en conocimiento propio.

El fundamento funcional y sus límites científicos están documentados en [Modelo funcional de memoria humana aplicable a Alice](../research/HUMAN_MEMORY_FUNCTIONAL_MODEL_2026-08-21.md). La decisión de arquitectura vigente es [ADR-P-084](../decisions/ADR-P-084-memoria-funcional-y-volumen-trazable.md).

## Aprendizaje automático vigente — 2026-11-03

Por delegación del propietario, Alice selecciona citas útiles de nuevas conversaciones
Gemma y las conserva sin confirmación por recuerdo. Viven en `memory/automatic-v1.json`,
con respaldo anterior, procedencia y estado reversible. Conversación y volumen combinan
ese almacén con los recuerdos confirmados, distinguiendo la selección automática.
**Memoria → Lo que Alice decide conservar** permite pausar, corregir y retirar.
Los contratos R6 siguientes siguen aplicándose a los archivos confirmados originales.
Ver [ADR-P-101](../decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

## Directorio de datos

El iniciador define `ALICE_DATA_DIR=E:\Alice Cognitive Core\data`. Dentro de ese directorio Alice crea `memory/`, conserva el historial de diálogo en `conversation/` y la auditoría de proveedores en `cloud/`:

```text
conversation/
`-- history-v1.json              # Diálogo local durable; no es memoria R6 confirmada
memory/
|-- manifest.json                 # Versión y contrato del almacenamiento
|-- records.json                  # Recuerdos y enseñanzas vigentes
|-- layer-index-v2.json           # Revisiones históricas R6.1, preservadas
|-- layer-index-v3.json           # Revisiones R6.6-A con capa procedimental
|-- lifecycle-index-v1.json       # Índice lateral opcional activado por el propietario
|-- revisions/
|   `-- reconsolidation-v1-*.json # Versiones desplazadas, privadas e inmutables
|-- backups/
|   |-- records.backup.json       # Respaldo automático anterior
|   |-- records.pre-restore.json  # Estado protegido antes de restaurar
|   `-- *-source-<sha>.json       # Fuente exacta previa a una transición gobernada
|-- exports/
|   `-- alice-memory-*.json       # Exportaciones solicitadas por Carlos Nuñez
|-- audit/
|   `-- memory-events.jsonl       # Eventos append-only con huella SHA-256
|-- attachments/                  # Reservado para adjuntos autorizados
`-- indexes/                      # Reservado para índices derivados y regenerables
```

`conversation/history-v1.json` conserva hasta 1.000 intercambios reales y se
recupera al iniciar. Su escritura es atómica y R3 registra sólo SHA-256, nunca el
texto. El historial no se incorpora automáticamente a `records.json`, a las capas
R6 ni al RAG. La memoria de trabajo mantiene únicamente la ventana inmediata en
RAM y puede vaciarse sin borrar el historial.

La pantalla Memoria debe mostrar la ruta real y ofrecer un botón para abrirla. `data/*` está excluido de Git, salvo su README explicativo, de modo que los recuerdos no se publican al compartir el código.

Si `ALICE_DATA_DIR` no está definida, Tauri conserva como fallback su directorio por usuario en Windows. En esta máquina existió la ruta histórica `C:\Users\enri3\AppData\Roaming\com.enrique.proyectop`. La migración vigente copia y verifica los datos en `E:\Alice Cognitive Core\data`; las fuentes anteriores no se borran hasta comprobar la nueva ubicación.

## Formatos

| Formato | Uso | Motivo |
|---|---|---|
| JSON | `manifest.json`, `records.json` y exportaciones | Legible, portable, editable y adecuado para el volumen inicial |
| JSONL | Auditoría | Permite agregar un evento por línea sin reescribir el historial |
| Archivos originales | Adjuntos futuros | Evita insertar binarios dentro de JSON |
| SQLite | Migración futura | Se adoptará cuando asociaciones, consultas e historial requieran transacciones e índices a mayor escala |

## Compatibilidad

Si existe `memory/sessions.json` y todavía no existe `records.json`, Alice copia el contenido al formato vigente y conserva el archivo anterior. La migración no borra la fuente histórica.

## Registro v1

Campos principales: identificador, clase de registro, intención o título, contenido, fecha, tipo de memoria, fuente, importancia, fuerza de almacenamiento, estado, recuperaciones conversacionales, repasos manuales, correcciones y sus fechas.

La fuerza de almacenamiento no es una certeza científica ni una probabilidad de verdad. Es una métrica de ingeniería explicable para visualizar estabilidad y programar revisiones. Accesibilidad, confianza factual, importancia, procedencia, frecuencia de recuperación y estado deben permanecer como dimensiones independientes.

## Proyección por capas R6.1 y R6.6-A

`records.json` continúa siendo la fuente editable. La pestaña **Capas R6** genera una vista previa de sólo lectura y clasifica únicamente referencias explícitas:

- conversaciones y experiencias declaradas como episodios;
- enseñanzas semánticas como hechos enseñados;
- procedimientos en una capa propia con enlace R5 explícitamente pendiente;
- preferencias u otros tipos sin contrato como elementos todavía sin clasificar;
- memoria de trabajo vacía y no persistente.

R6.6-A no modifica el `layer-index-v2.json` activo: crea una vista v3 paralela y sólo escribe `layer-index-v3.json` después de confirmar su SHA-256. Rust relee la fuente; si cambió, rechaza la operación. El índice conserva revisiones inmutables y no copia títulos, resúmenes, fuentes o conversaciones. Un procedimiento `pendingR5` tiene capa, pero no se presenta como habilidad ni puede ejecutarse.

El contrato detallado está en [LAYERED_MEMORY_R6.md](LAYERED_MEMORY_R6.md) y la decisión en [ADR-P-066](../decisions/ADR-P-066-proyeccion-memoria-por-capas.md).

## Vista previa del ciclo R6.5-B

`memory_lifecycle_preview` relee y valida la fuente canónica sin crear archivos. Para cada registro devuelve su ID, una huella SHA-256 individual, vigencia explícita y la política de recuperación que el sistema aplica actualmente. Un registro v1 sin `memoryStatus` permanece `notAssessed` y conserva la elegibilidad heredada; no se convierte silenciosamente en vigente.

## Índice reversible del ciclo R6.5-C

`lifecycle-index-v1.json` conserva revisiones laterales inmutables compuestas sólo por referencias, huellas, vigencia y política de recuperación. Activar exige confirmación y coincidencia con el SHA-256 mostrado por la vista previa. Si `records.json` cambia, el índice pasa a `sourceChanged` hasta que se revise y active otra proyección.

Antes de reemplazar un índice existente se crea un respaldo ligado a su propia huella. El documento se relee y valida después del reemplazo; si falla la auditoría local, se restaura el índice anterior o se retira el nuevo si antes no existía. Revertir conserva todas las revisiones y elimina únicamente el puntero activo. `records.json` no forma parte de estas escrituras.

`storageStrength` no activa reconsolidación, accesibilidad, supresión ni archivo. R6.5-F añade una evaluación funcional derivada de resultados explícitos, pero no persiste debilitamiento como estado ni ejecuta una transición. R6.5-G incorpora la supresión sólo como una decisión voluntaria separada, R6.5-H incorpora la actualización del contenido únicamente como una operación versionada y R6.5-I incorpora el archivo como un eje reversible independiente.

## Evaluación explícita de vigencia R6.5-D

`assess_memory_validity` acepta únicamente recuerdos cuyo estado sea todavía `notAssessed`. La interfaz presenta el registro real y dos decisiones humanas: **Confirmar vigente** o **Necesita corrección**. Si el recuerdo no posee `source`, R6.6-A exige declarar una procedencia de 1 a 300 caracteres dentro de la misma operación. Ningún modelo, antigüedad, frecuencia o valor de fuerza puede tomar esas decisiones.

La solicitud queda ligada tanto a la huella completa mostrada de `records.json` como a la huella individual del recuerdo. Rust vuelve a leer ambas antes de actuar, crea `backups/validity-source-<sha>.json`, reemplaza `records.json` atómicamente y valida el archivo resultante. Si la relectura o la auditoría fallan, restaura exactamente los bytes originales.

Confirmar vigencia establece `memoryStatus=confirmed`, incrementa `successfulReviews` y registra `lastReviewedAt`. Marcar conflicto establece `memoryStatus=conflict`, incrementa `correctionCount` y registra la misma evidencia temporal. Ambas operaciones preservan texto, importancia y `storageStrength`; sólo pueden completar una fuente ausente y nunca sustituir una existente. Si había una revisión activa de `lifecycle-index-v1.json`, no se reescribe: pasa a `sourceChanged` y requiere revisión explícita sobre la nueva huella.

## Accesibilidad y reposo R6.5-E

La accesibilidad responde si un recuerdo vigente puede participar en una recuperación espontánea. No indica si es verdadero, importante, reciente, fuerte o existente. `accessibilityStatus=accessible` permite la recuperación normal; `accessibilityStatus=dormant` conserva el recuerdo pero lo excluye del RAG. La fecha `accessibilityUpdatedAt` demuestra cuándo se tomó la decisión.

`assess_memory_accessibility` acepta solamente recuerdos con `memoryStatus=confirmed` y exige confirmación, SHA-256 de `records.json` y SHA-256 del registro. Cada transición crea `backups/accessibility-source-<sha>.json`, reemplaza la fuente atómicamente, relee el resultado y registra auditoría. Ante cualquier fallo posterior restaura los bytes originales. Repetir el estado actual se rechaza sin escritura; volver de `dormant` a `accessible` conserva la reversibilidad y el historial de auditoría.

La recuperación léxica de Conversación excluye físicamente los registros `dormant` antes de puntuar coincidencias. El volumen mantiene su nodo persistente, lo atenúa y evita crear una arista de recuperación. Por lo tanto reposo no equivale a eliminación ni a desaparición visual. Los recuerdos históricos sin evaluación de accesibilidad conservan el comportamiento anterior; R6.5-E no los duerme automáticamente.

## Resultados de recuperación y debilitamiento funcional R6.5-F

Una respuesta técnica del proveedor ya no cuenta como recuperación exitosa. Cuando una consulta real incluyó recuerdos mediante RAG y la respuesta terminó, Conversación presenta cada recuerdo utilizado y solicita a Carlos Nuñez marcar **Sí, fue útil** o **No ayudó**. La decisión se guarda en `successfulRecalls` o `failedRecalls`, actualiza `lastRecalledAt` y establece `retrievalEvidenceVersion=1`; no cambia `storageStrength`, vigencia ni accesibilidad.

Los contadores anteriores que no poseen `retrievalEvidenceVersion=1` se consideran evidencia heredada no verificada y la vista del ciclo los ignora. La primera evaluación explícita inicia ambos contadores desde cero para no mezclar una respuesta técnica antigua con utilidad confirmada.

`memory_lifecycle_preview` produce una evaluación por registro sin escribir archivos. Cero resultados queda `notAssessed`; uno o dos quedan `insufficientEvidence`. Con al menos tres resultados, dos tercios o más marcados **No ayudó** producen `reviewRequired`; el resto queda `noWeakeningSignal`. El umbral es una regla conservadora de ingeniería para solicitar revisión, no una afirmación neurocientífica ni una decisión de olvido. En todos los casos `automaticAction=false`: la señal no duerme, debilita, suprime, archiva ni elimina el recuerdo.

## Supresión voluntaria reversible R6.5-G

La supresión representa la decisión explícita del propietario de impedir que un recuerdo participe en recuperación espontánea sin borrarlo, archivarlo, declararlo falso ni alterar su fuerza. `assess_memory_suppression` admite solamente las acciones cerradas `suppress` y `release`, con uno de tres motivos declarados: `ownerChoice`, `sensitiveContext` o `temporaryBoundary`. No existe un disparador automático desde antigüedad, frecuencia, `storageStrength`, resultados R6.5-F o una salida de modelo.

Cada solicitud exige confirmación visible y las huellas SHA-256 vigentes de `records.json` y del registro individual. Al suprimir se guardan `suppressionStatus=suppressed`, el motivo y `suppressionUpdatedAt`; al liberar se eliminan esos tres campos. La operación no modifica contenido, importancia, vigencia, accesibilidad, contadores ni fuerza. Un recuerdo dormido puede además estar suprimido: son decisiones independientes y liberar la supresión no reactiva su accesibilidad.

Antes de escribir se crea `backups/suppression-source-<sha>.json` con los bytes exactos de la fuente. Rust reemplaza `records.json` atómicamente, relee y valida el resultado, comprueba la proyección del ciclo y registra una auditoría local con acción y motivo cerrados, sin texto privado. Si falla cualquier comprobación o la auditoría, restaura exactamente la fuente anterior. Repetir el mismo estado se rechaza sin escribir.

El RAG excluye los recuerdos suprimidos antes de puntuarlos. El volumen cognitivo conserva su nodo real atenuado, lo identifica como `suprimido` y evita dibujar una arista de recuperación. Así, supresión significa inaccesibilidad voluntaria y reversible, no desaparición del recuerdo.

## Reconsolidación versionada R6.5-H

Recuperar un recuerdo, usarlo en una respuesta o recibir información nueva no modifica su contenido. Para actualizar un recuerdo vigente o en conflicto, la interfaz exige una nota del propietario, uno de los motivos cerrados `ownerCorrection`, `newContext` o `clarification`, y campos propuestos explícitos. `preview_memory_reconsolidation` vuelve a verificar las huellas de `records.json` y del registro, calcula la versión sucesora y un `planId`, pero declara `recordsModified=false`, `versionWritten=false` y `automaticAction=false`.

La segunda acción, `confirm_memory_reconsolidation`, sólo acepta exactamente ese plan. Antes de sustituir la fuente crea `backups/reconsolidation-source-<sha>.json` y guarda la versión desplazada completa en `memory/revisions/reconsolidation-v1-<revisionId>.json`. El registro vigente conserva `memoryVersion`, `reconsolidatedAt`, el motivo y la huella de la versión anterior. El ID del recuerdo no cambia y el ciclo deriva `reconsolidationCount=memoryVersion-1`.

Después del reemplazo atómico, Rust relee y valida `records.json`, proyecta nuevamente el ciclo y escribe auditoría local. Si falla la escritura, relectura, validación o auditoría, restaura los bytes originales y retira cualquier archivo de versión creado por el intento. El respaldo exacto puede permanecer como evidencia de seguridad. Una versión existente con contenido diferente bloquea la operación.

El guardado genérico rechaza cambios de título, contenido, próximo paso o fuente sobre recuerdos confirmados o en conflicto, tampoco permite fabricar metadatos de versión, alterar el archivo reversible ni eliminar un registro durable. Los cambios funcionales de contadores que no alteran contenido continúan permitidos. En el volumen sólo aparece el nodo de la versión vigente, rotulado con su número real; las versiones históricas no generan actividad ni nodos ficticios.

## Archivo reversible R6.5-I

El archivo nuevo no reutiliza `memoryStatus=archived`. Ese valor se admite sólo para compatibilidad con registros heredados cuya vigencia anterior es desconocida. R6.5-I conserva `memoryStatus=confirmed` o `memoryStatus=conflict` y añade un eje independiente mediante `archiveStatus=archived`, `archiveReason` y `archiveUpdatedAt`. Así, restaurar no necesita adivinar si el recuerdo era vigente o estaba en conflicto, y tampoco modifica reposo, supresión, fuerza, contenido, versión o evidencia de recuperación.

`preview_memory_archive` exige las huellas actuales de `records.json` y del registro, una nota de 1 a 500 caracteres y una acción cerrada. Archivar admite `ownerChoice`, `superseded` o `noLongerRelevant`; restaurar exige `relevantAgain`. La nota privada no se persiste: sólo participa mediante SHA-256 en el `planId`. La vista previa no crea archivos ni modifica memoria y declara `automaticAction=false`.

`confirm_memory_archive` es una segunda autorización sobre el mismo plan y la misma fecha. Antes de escribir crea `backups/archive-source-<sha>.json`, reemplaza `records.json` atómicamente, relee la fuente, valida el ciclo y registra auditoría local. Cualquier fallo posterior restaura exactamente los bytes anteriores. Repetir un estado, cambiar la fuente, alterar el plan o intentar restaurar un `memoryStatus=archived` heredado se rechaza sin inventar información.

El RAG excluye `archiveStatus=archived` antes del puntaje léxico. La consolidación tampoco usa esos registros como candidatos. El volumen mantiene el nodo real, atenuado y rotulado como archivado, sin arista de recuperación. Restaurar retira únicamente los tres metadatos de archivo y devuelve la política resultante de vigencia, accesibilidad y supresión.

## Retención y eliminación gobernada R6.5-J

Archivar no elimina. La eliminación comienza únicamente desde un archivo reversible y se divide en dos contratos independientes. `preview_memory_deletion_schedule` no escribe y fija una espera no configurable de 604.800 segundos. `confirm_memory_deletion_schedule` exige el mismo plan y segunda autorización; añade `deletionStatus=scheduled`, un motivo cerrado, `deletionRequestedAt` y `deletionEligibleAt`. Cancelar durante la espera retira sólo esos metadatos. Restaurar el archivo queda bloqueado hasta cancelar la programación.

Una vez vencida la fecha según el reloj nativo, `preview_memory_deletion` vuelve a comprobar las huellas de la fuente y del registro. `confirm_memory_deletion` repite la comprobación del reloj y del plan, conserva los bytes completos de la fuente en `memory/private-deletion-safeguards`, reemplaza `records.json` sin el registro y escribe una lápida en `memory/deletion-tombstones`. La lápida conserva únicamente huellas, fechas y códigos cerrados; el ID se digesta y no incluye título, resumen, fuente ni nota. Después se valida el ciclo y se audita. Un fallo restaura `records.json` y retira la lápida creada por el intento; el resguardo puede permanecer como protección local.

Esta operación significa retiro de la memoria activa canónica, no borrado criptográfico ni garantía de que el contenido desapareció de copias, respaldos, journal del sistema de archivos o soporte físico. Purgar esos resguardos requeriría otro contrato explícito. No existe eliminación automática.

## Consolidación y repaso v1

La cola de repaso acepta únicamente registros de clase `Enseñanza` que ya poseen una vigencia explícita, porque fueron escritos y confirmados directamente por Carlos Nuñez. Los recuerdos `notAssessed` se resuelven primero mediante R6.5-D y no aparecen simultáneamente en el repaso de estabilidad. Las conversaciones guardadas permanecen consultables, pero no aumentan su fuerza ni se convierten automáticamente en conocimiento propio.

La próxima fecha se deriva de `finishedAt` o `lastReviewedAt`, el balance entre `successfulReviews` y `correctionCount`, y la importancia. Los intervalos base son 1, 3, 7, 14, 30, 60 y 120 días. Marcar **Sigue vigente** refuerza el indicador y extiende el intervalo; **Necesita corrección** reduce la fuerza y cambia el estado a `conflict` hasta guardar una corrección.

El uso durante conversación se registra de manera independiente. Una enseñanza confirmada incluida en una consulta queda pendiente de evaluación sólo después de recibir una respuesta real. Alice modifica los contadores únicamente cuando Carlos confirma si el recuerdo ayudó. Cancelar, desmarcar memoria, recibir un error o simplemente obtener respuesta no produce evidencia ni refuerzo.

No existe un proceso oculto ni una tarea en segundo plano. La cola se reconstruye al mostrar la memoria y todos sus datos continúan en `records.json`.

## Fronteras

- React nunca recibe credenciales de proveedor.
- Guardar una enseñanza no llama a la nube.
- Incluir recuerdos en una consulta requiere selección y previsualización.
- Respaldos, exportaciones y auditorías permanecen locales.
- Los índices futuros serán derivados: deben poder regenerarse desde `records.json`.
- R6.1 no extrae hechos, no persiste memoria de trabajo y no accede a carpetas de proyectos.
- R6.5-E no calcula reposo desde antigüedad, `storageStrength`, frecuencia o una salida de modelo.
- R6.5-F no convierte una respuesta técnica en éxito y no ejecuta olvido desde sus señales funcionales.
- R6.5-G no suprime automáticamente y no confunde supresión con reposo, conflicto, archivo o borrado.
- R6.5-H no reconsolida por recuperación y nunca sobrescribe contenido confirmado sin conservar la versión desplazada.
- R6.5-I no archiva por antigüedad, fuerza o salida de modelo; archivar no es suprimir, dormir, invalidar ni eliminar.
- R6.5-J no programa ni ejecuta eliminación desde métricas o modelos; exige archivo previo, siete días cancelables, dos etapas confirmadas y resguardo exacto.
