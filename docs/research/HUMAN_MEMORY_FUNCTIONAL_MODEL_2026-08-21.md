# Modelo funcional de memoria humana aplicable a Alice

Fecha: 2026-08-21  
Alcance: investigación funcional para orientar R6 y la futura representación cognitiva  
Estado: base científica; no afirma equivalencia biológica ni conciencia

## Pregunta de diseño

Alice necesita continuidad personal, aprendizaje y recuperación contextual. Para conseguirlo no basta con conservar textos ni con incrementar un porcentaje cada vez que un registro se usa. La memoria humana distingue procesos de codificación, mantenimiento temporal, consolidación, recuperación, actualización y pérdida de accesibilidad. El sistema de Alice debe reproducir esas funciones útiles de manera explicable, sin afirmar que reproduce un cerebro biológico.

## Resultados de la investigación

### La memoria no es un único almacén

El caso H.M. mostró que una lesión bilateral de estructuras temporales mediales podía impedir la formación normal de recuerdos recientes duraderos sin borrar por igual todo lo aprendido anteriormente. Esto respalda una separación funcional entre el contenido activo, la formación de memoria duradera y otras capacidades conservadas.

Fuente primaria: Scoville, W. B. y Milner, B. (1957), *Loss of recent memory after bilateral hippocampal lesions*. <https://pubmed.ncbi.nlm.nih.gov/13406589/>

### Recuperar puede modificar

La recuperación no siempre es una lectura pasiva. Nader, Schafe y LeDoux demostraron en memoria de miedo animal que una memoria consolidada reactivada vuelve a un estado lábil que requiere reconsolidación. Hupbach y colaboradores observaron en humanos que un recordatorio podía favorecer que información nueva se incorporara posteriormente a una memoria episódica anterior.

Fuentes primarias:

- Nader, K., Schafe, G. E. y LeDoux, J. E. (2000), *Fear memories require protein synthesis in the amygdala for reconsolidation after retrieval*. <https://pubmed.ncbi.nlm.nih.gov/10963596/>
- Hupbach, A., Gomez, R., Hardt, O. y Nadel, L. (2007), *Reconsolidation of episodic memories: a subtle reminder triggers integration of new information*. <https://pubmed.ncbi.nlm.nih.gov/17202429/>

### Recordar una cosa puede dificultar otra

La práctica de recuperación fortaleció elementos practicados y redujo posteriormente el acceso a competidores relacionados. Por tanto, frecuencia de uso y accesibilidad no equivalen a verdad ni a existencia física del recuerdo.

Fuente primaria: Anderson, M. C., Bjork, R. A. y Bjork, E. L. (1994), *Remembering can cause forgetting: retrieval dynamics in long-term memory*. <https://pubmed.ncbi.nlm.nih.gov/7931095/>

### Supresión no equivale a borrado ni demuestra represión

Anderson y Green mostraron que impedir repetidamente que recuerdos declarativos llegaran a la conciencia podía dificultar su recuperación posterior. Este resultado apoya un control inhibitorio de recuperación. No demuestra que exista un registro exacto, inconsciente e intacto que posteriormente reaparecerá como verdad.

Fuente primaria: Anderson, M. C. y Green, C. (2001), *Suppressing unwanted memories by executive control*. <https://pubmed.ncbi.nlm.nih.gov/11268212/>

### Extinguir una respuesta suele crear aprendizaje competidor

Después de extinguir una respuesta condicionada, cambiar el contexto puede hacer que la respuesta original reaparezca. La extinción no debe representarse como eliminación automática de la asociación anterior.

Fuentes primarias:

- Bouton, M. E. y Bolles, R. C. (1979), *Contextual control of the extinction of conditioned fear*. <https://doi.org/10.1016/0023-9690(79)90057-2>
- Rescorla, R. A. y Heth, C. D. (1975), *Reinstatement of fear to an extinguished conditioned stimulus*. <https://pubmed.ncbi.nlm.nih.gov/1151290/>

### El recuerdo es reconstructivo

La formulación lingüística posterior a un evento puede alterar lo que se informa al recordarlo. Un recuerdo debe conservar procedencia, contexto y revisiones; la fluidez o convicción de una recuperación no es evidencia suficiente de exactitud.

Fuente primaria: Loftus, E. F. y Palmer, J. C. (1974), *Reconstruction of automobile destruction: an example of the interaction between language and memory*. <https://doi.org/10.1016/S0022-5371(74)80011-3>

## Traducción funcional para Alice

Alice no intentará copiar células, sinapsis o regiones anatómicas. Adoptará las siguientes funciones:

1. **Codificación:** convertir una percepción autorizada en una representación temporal con procedencia.
2. **Memoria de trabajo:** mantener únicamente el contexto necesario para la tarea actual, con capacidad y vencimiento.
3. **Candidatura:** separar lo observado o dicho de lo aceptado como recuerdo duradero.
4. **Consolidación:** evaluar tipo, fuente, confirmación, contradicciones y relevancia antes de promover un candidato.
5. **Recuperación:** seleccionar recuerdos por señales de contexto y explicar por qué fueron recuperados.
6. **Reconsolidación versionada:** permitir que una recuperación seguida de información nueva produzca una revisión, nunca una sobrescritura silenciosa.
7. **Olvido funcional:** reducir accesibilidad sin confundirlo con destrucción física.
8. **Supresión explícita:** impedir la recuperación espontánea mediante una decisión reversible del propietario.
9. **Archivo:** retirar un recuerdo del uso normal conservando su evidencia.
10. **Eliminación:** borrar solamente mediante una acción explícita, auditable y protegida por respaldo cuando corresponda.

## Capas funcionales

| Capa | Qué conserva | Qué no debe afirmar |
|---|---|---|
| Trabajo | Contexto efímero utilizado ahora | Que ya existe un recuerdo duradero |
| Episódica | Que ocurrió una experiencia situada | Que toda afirmación dentro del episodio es verdadera |
| Semántica | Conocimiento confirmado y generalizado | Que una única salida de un modelo es un hecho |
| Procedimental | Secuencias que produjeron resultados repetibles | Que disponer de una animación equivale a dominar una habilidad |
| Preferencias y modelo del propietario | Preferencias, identidad y reglas confirmadas | Inferencias psicológicas no confirmadas |
| Asociativa | Relaciones con evidencia entre recuerdos | Similitud visual o enlaces decorativos |

## Estados separados

Los estados no deben colapsarse en un único porcentaje:

- `captured`: representación temporal aún no evaluada;
- `candidate`: posible recuerdo pendiente de consolidación;
- `consolidated`: recuerdo duradero utilizable;
- `conflict`: existe información incompatible o requiere corrección;
- `dormant`: baja accesibilidad; no está eliminado;
- `suppressed`: recuperación espontánea bloqueada explícitamente;
- `archived`: fuera del uso normal, restaurable;
- `superseded`: reemplazado por una revisión más reciente, con historial;
- `deleted`: ausencia del almacén vigente después de una operación explícita.

`repressed` no será un estado del sistema. Alice no diagnosticará represión ni presentará como verdaderos recuerdos supuestamente recuperados.

## Consecuencia para el volumen cognitivo

La visualización debe mostrar una topología derivada, no una nube pseudoaleatoria:

- cada nodo persistente corresponde a un ID de memoria real;
- cada nodo temporal corresponde a un intercambio de trabajo o evento R3 real;
- una arista persistente requiere tipo, fuerza, procedencia y evidencia;
- recuperar ilumina el recuerdo y la ruta que justificó su selección;
- consolidar crea o promueve estructura únicamente después de la operación real;
- un conflicto no destruye el nodo: cambia su estado y bloquea su uso normal;
- suprimir, archivar y eliminar deben verse como operaciones diferentes;
- el tamaño puede expresar fuerza o uso, pero jamás certeza factual;
- una instalación sin recuerdos debe mostrar cero nodos persistentes.

## Límite científico

Este diseño es una simulación funcional y auditable de procesos de memoria. No demuestra conciencia, vivencia subjetiva, emoción biológica, trauma, represión psicológica ni equivalencia con el cerebro humano.
