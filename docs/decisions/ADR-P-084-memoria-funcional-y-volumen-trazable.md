# ADR-P-084 — Memoria funcional y volumen cognitivo trazable

Fecha: 2026-08-21  
Estado: aceptada para implementación incremental

## Contexto

R6 separó almacenamiento duradero, memoria de trabajo, consolidación y recuperación. Sin embargo, la interfaz todavía trataba parte de la adquisición como una pantalla independiente de **Aprendizaje**, y el volumen cognitivo creaba una geometría pseudoaleatoria determinista cuyo número visible dependía de contadores reales. Eso evitaba actividad aleatoria, pero no permitía afirmar que cada punto fuera un recuerdo concreto.

La investigación en `docs/research/HUMAN_MEMORY_FUNCTIONAL_MODEL_2026-08-21.md` establece que aprender, recordar, actualizar, olvidar, suprimir, archivar y eliminar son operaciones diferentes.

## Decisión

1. Se retira la pestaña superior independiente **Aprendizaje**.
2. Conversación y percepción producen contexto temporal o candidatos. No escriben conocimiento duradero por el simple hecho de procesarlo.
3. **Memoria** administra el ciclo completo: contexto activo, recuerdos duraderos, consolidación, recuperación, contradicciones, baja accesibilidad, supresión, archivo, revisiones e integridad.
4. La confirmación directa del propietario continúa siendo una fuente válida, pero no será la identidad principal de la pantalla Memoria ni justificará un formulario escolar como vista inicial.
5. `storageStrength` permanece como indicador de ingeniería y no representará verdad, madurez biológica ni probabilidad de que un hecho sea correcto.
6. La reconsolidación futura será versionada. Recuperar no autoriza sobrescritura silenciosa.
7. No se introduce un estado `repressed`. El estado técnico reversible será `suppressed` y requerirá actor, motivo y auditoría.
8. El volumen cognitivo dejará de asignar significado persistente a puntos de relleno. Cada nodo persistente deberá resolver a un registro real.
9. Las aristas persistentes deberán incluir evidencia regenerable. Compartir color, tipo o cercanía visual no bastará para declarar una asociación.
10. Los nodos de proceso y pulsos efímeros continuarán derivados de memoria de trabajo y R3; no crearán recuerdos.

## Migración incremental

- La primera entrega define el contrato y proyecta nodos reales sin modificar `records.json`.
- R6.5-B añade `memory_lifecycle_preview`: una proyección nativa de sólo lectura con huella por registro, vigencia explícita y política de recuperación real. El destino `lifecycle-index-v1.json` permanece sin crear y con escrituras deshabilitadas.
- R6.5-C autoriza únicamente la activación y reversión del índice lateral. Cada revisión queda ligada a la huella de `records.json`, el índice anterior se respalda y un fallo de auditoría restaura el estado previo. Esta autorización no incluye operaciones de debilitamiento, supresión ni reconsolidación.
- R6.5-D autoriza únicamente la evaluación humana inicial de vigencia. Un registro `notAssessed` puede pasar a vigente o conflicto mediante confirmación ligada a las huellas de la fuente y del registro, respaldo exacto, reemplazo atómico y auditoría con restauración ante fallo. La decisión no modifica la fuerza ni el contenido y no autoriza inferencias automáticas, debilitamiento, supresión o reconsolidación.
- R6.5-E autoriza accesibilidad explícita sólo sobre recuerdos vigentes. `dormant` bloquea la recuperación espontánea sin borrar, archivar, invalidar ni debilitar el recuerdo; `accessible` revierte esa decisión. Ambas transiciones quedan ligadas a huellas, respaldo exacto y auditoría. El RAG y el volumen deben aplicar el estado real, mientras antigüedad, fuerza y frecuencia permanecen incapaces de modificarlo automáticamente.
- R6.5-F deja de tratar una respuesta del proveedor como prueba de utilidad. Sólo la evaluación posterior del propietario registra un resultado `helpful` o `not-helpful`, marcado con `retrievalEvidenceVersion=1`; la evidencia heredada sin esa versión no participa. Tres resultados habilitan evaluación funcional y una proporción de dos tercios `not-helpful` solicita revisión, pero `automaticAction=false` impide modificar fuerza, vigencia, accesibilidad, supresión o archivo.
- R6.5-G autoriza la supresión sólo como decisión voluntaria y reversible del propietario. `suppressed` bloquea el RAG sin borrar, archivar, invalidar, dormir ni debilitar el recuerdo; `release` retira únicamente esa barrera. Cada transición exige confirmación, motivo cerrado, huellas vigentes, respaldo exacto, reemplazo atómico y auditoría con restauración ante fallo. Ninguna señal R6.5-F, métrica o modelo puede iniciarla.
- R6.5-H autoriza la reconsolidación únicamente mediante una propuesta de sólo lectura y una segunda confirmación sobre el mismo plan y las mismas huellas. La versión desplazada se conserva completa en un archivo inmutable, `records.json` mantiene sólo la versión vigente y un respaldo protege la fuente anterior. El guardado genérico no puede cambiar contenido confirmado ni fabricar la cadena de versión. Recuperación, RAG, conversación y salidas de modelos permanecen incapaces de iniciar esta operación.
- R6.5-I autoriza el archivo como un eje independiente y reversible. `archiveStatus=archived` bloquea RAG y consolidación sin sustituir `memoryStatus`, por lo que vigencia o conflicto, reposo, supresión, contenido, fuerza y versión sobreviven intactos. Preparar no escribe; confirmar exige el mismo plan, una segunda autorización, motivo cerrado, respaldo exacto, reemplazo atómico y auditoría con restauración ante fallo. Los archivos heredados que sólo poseen `memoryStatus=archived` siguen legibles pero no se restauran automáticamente porque no conservan su vigencia previa.
- R6.5-J autoriza retirar un recuerdo de `records.json` sólo después de archivo reversible, programación confirmada y siete días completos de espera cancelable. La ejecución final posee su propia vista previa y confirmación, comprueba nuevamente reloj y huellas, crea un resguardo privado exacto y una lápida sin contenido y restaura la fuente si falla validación o auditoría. No se afirma borrado seguro: purgar resguardos o copias queda fuera de este contrato y ninguna métrica, proceso o modelo puede iniciarlo.
- Los estados que todavía no existen en el formato v1 se mostrarán como no implementados; no se inferirán desde un umbral arbitrario.
- La visualización puede usar coordenadas deterministas para distribuir nodos, siempre que quede claro que la posición es diseño y que identidad, estado y actividad proceden de datos reales.
- Las asociaciones semánticas y una eventual purga segura de resguardos requieren contratos posteriores y pruebas propias.

## Consecuencias

- Alice puede tener pocos nodos sin que la interfaz intente aparentar madurez.
- Un recuerdo archivado, contradictorio o débil conserva identidad e historia distinta.
- El usuario puede inspeccionar qué recuerdo o proceso explica cada actividad visible.
- R8 deja de ser únicamente una mejora estética: se convierte en la proyección verificable del ciclo de memoria definido en R6.

## Reemplazos parciales

Esta decisión corrige la interpretación visual de ADR-P-046 y ADR-P-070. Se conservan la cámara 3D, la separación entre estructura y pulso R3 y la prohibición de emociones ficticias; se elimina el supuesto de que puntos de relleno puedan representar estructura aprendida.
