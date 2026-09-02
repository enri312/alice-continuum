# Roadmap de Alice

Autor y propietario: Carlos Nuñez  
Última revisión: 2026-08-15  
Estado: vigente

## Propósito

Esta hoja de ruta ordena la evolución de Alice desde el prototipo actual hacia una asistente personal con memoria, habilidades y capacidades locales gobernadas. Cada fase debe terminar con evidencia verificable antes de comenzar la siguiente.

Alice no se integrará al kernel de Windows. La integración con el equipo se realizará en el nivel de aplicación mediante comandos Tauri, APIs documentadas, adaptadores locales y permisos explícitos.

## Principios que no se negocian

- **Local-first:** memoria, configuración, permisos y auditorías pertenecen a Carlos Nuñez y permanecen en el equipo salvo autorización visible.
- **Denegación predeterminada:** una capacidad nueva comienza desactivada y sin acceso implícito a archivos, pantalla, red o procesos.
- **Datos reales:** el tablero muestra estados y eventos comprobables; no inventa actividad para que Alice parezca autónoma.
- **Previsualización antes de actuar:** toda operación con efecto externo debe explicar qué hará, sobre qué recurso y con qué alcance.
- **Aprendizaje gobernado:** Alice puede proponer recuerdos o habilidades, pero no declararlos verdaderos ni activarlos por sí sola.
- **Trazabilidad:** una decisión, recuerdo, asociación o habilidad debe indicar su origen y poder inspeccionarse.
- **Reversibilidad:** permisos, recuerdos y habilidades pueden corregirse, desactivarse o restaurarse.
- **Compatibilidad:** las migraciones preservan los datos existentes, crean respaldo y nunca usan los recuerdos personales como datos de prueba.
- **Una fase por vez:** no se inicia la fase siguiente hasta cumplir los criterios de aceptación de la fase activa.
- **Fronteras visibles:** mente, cuerpo, entorno y gobierno del propietario no comparten identidad ni pantallas; toda señal que cruce una frontera usa capacidades, permisos y auditoría.

## Línea base existente

| Bloque | Estado | Evidencia actual |
|---|---|---|
| Contrato y límites | Completo | Documento maestro, decisiones y diagramas de ingeniería. |
| Núcleo observable | Base completa | Volumen compacto con anclas de memoria, pulso R3 separado y afecto apagado sin señal; flujo, estado, planificador y actividad por pestañas. |
| Conversación de nube | Funcional | Proveedores intercambiables, previsualización y autorización expresa. |
| Memoria enseñable v1 | Funcional en evolución | Registros locales, respaldo, exportación, recuperación lexical y edición. |
| Consolidación v1 | Funcional en evolución | Repaso manual y refuerzo por recuperación autorizada. |
| Avatar VRM | Visor funcional | Carga privada, DualSense, 12 clips retargeteados, IK y máquina de siete estados; voz, aprendizaje, decisiones corporales y Ragdoll siguen desconectados. |
| Ejecución de acciones | Bloqueada | El modelo no ejecuta comandos ni modifica Windows. |

## Secuencia de materialización

Las fases `R1` a `R10` forman el nuevo ciclo de capacidades gobernadas. El prefijo `R` evita confundirlas con las fases históricas 0 a 4 del documento maestro. El resumen de fases futuras del documento maestro deberá sincronizarse con esta secuencia al formalizar el contrato de R1.

### Fase R1 — Registro de capacidades

**Estado:** completada el 2026-08-09 · evidencia real y checkpoint Git aprobados  
**Objetivo:** crear una fuente de verdad sobre lo que Alice realmente puede observar o hacer.

Cada capacidad tendrá como mínimo:

- identificador estable y versión;
- nombre y descripción comprensible;
- tipo: observación, consulta, propuesta o acción;
- adaptador responsable;
- estado real: no configurada, disponible, desactivada, activa o con error;
- nivel de riesgo;
- requisitos y permisos necesarios;
- contrato de entrada y salida;
- comprobación de salud;
- fecha y resultado de la última ejecución real.

**Primer alcance:** registrar capacidades que ya existen, como conversación de nube, memoria local, observación autorizada de ventana y visor VRM. Los futuros puentes de voz, rostro, cuerpo o archivos y las entradas sensoriales definidas en ADR-P-043 aparecerán como planificadas y no disponibles, sin abrir dispositivos ni producir telemetría simulada.

**No incluye:** ejecutar comandos, modificar archivos, navegar automáticamente ni instalar habilidades.

**Criterios de aceptación:**

- [x] Existe un contrato tipado y versionado para describir capacidades.
- [x] El backend produce el estado; React no lo inventa ni duplica.
- [x] La pestaña Puentes consume el registro y distingue disponibilidad de activación.
- [x] Una capacidad desconocida o mal formada queda rechazada.
- [x] Hay pruebas de serialización, estados y compatibilidad.
- [x] El documento maestro y una ADR describen el contrato adoptado.

### Fase R2 — Gateway de permisos

**Estado:** completada en su alcance inicial · ventana, cámara, micrófono y autorización facial protegidos  
**Dependencia:** Fase R1  
**Objetivo:** convertir el registro en una frontera única que autorice o rechace cada uso.

Niveles iniciales de autorización:

1. **Observar:** consultar un estado sin modificar recursos.
2. **Proponer:** preparar una acción sin ejecutarla.
3. **Ejecutar con aprobación:** realizar una acción una sola vez después de confirmar su previsualización.
4. **Automatización limitada:** reservado para una fase posterior; comienza deshabilitado.

Cada solicitud deberá tener alcance, recurso objetivo, vencimiento, motivo, riesgo e identificador idempotente para evitar ejecuciones duplicadas.

**No incluye:** acceso administrativo, PowerShell libre, escritura fuera de rutas autorizadas ni permisos permanentes creados por el modelo.

**Criterios de aceptación:**

- [x] La política predeterminada es denegar.
- [x] Las previsualizaciones son inmutables entre aprobación y ejecución.
- [x] Los permisos son específicos, revocables y tienen vencimiento cuando corresponde.
- [x] Cancelar o cerrar la solicitud no produce efectos secundarios.
- [x] Las pruebas cubren autorización, rechazo, expiración, revocación y duplicados.

**Extensión facial sin ejecución:** `perception.face.landmarks` dispone de un perfil R2 `critical`
independiente, limitado a 60 segundos y al alcance `facialLandmarksEphemeral`. Rostro permite
preparar, aprobar, denegar, cancelar y revocar; aprobar todavía no abre la cámara ni inicia MediaPipe.
El ejecutor sensorial genérico rechaza el grant facial y la capacidad R1 continúa planificada hasta
incorporar un adaptador dedicado con indicador, parada y auditoría operacional.

### Fase R3 — Auditoría unificada y diagnóstico

**Estado:** completada · cinco incrementos implementados y validados  
**Dependencia:** Fase R2  
**Objetivo:** demostrar qué solicitó Alice, qué política se aplicó y cuál fue el resultado.

Se unificará un sobre de eventos para memoria, nube, capacidades y permisos. Registrará metadatos mínimos: identificador, fecha, origen, capacidad, decisión, resultado, duración y huellas cuando sean necesarias. No guardará claves ni copiará automáticamente contenido privado.

La pestaña Actividad será una lectura comprensible de eventos reales; los archivos JSONL locales seguirán siendo la evidencia persistente. Un diagnóstico verificará proveedores, rutas, versiones de datos, adaptadores y permisos sin alterar su estado.

**Criterios de aceptación:**

- [x] Existe un esquema versionado de eventos.
- [x] Actividad diferencia solicitud, autorización, ejecución, bloqueo y error.
- [x] Los eventos correlacionados comparten un identificador de operación.
- [x] Memoria y nube producen eventos mínimos sin copiar contenido privado.
- [x] El diagnóstico es de solo lectura y no expone secretos.
- [x] La rotación o crecimiento de auditorías tiene una política documentada.
- [x] El Núcleo deriva regiones, enlaces e intensidad de eventos R3 recientes y etiqueta la heurística.

### Línea transversal — Simulación afectiva explicable

**Estado:** contrato visual implementado; motor pendiente  
**Dependencia:** R3 para evidencia; R6 para memoria por capas; R9 para expresión

Alice tendrá diez canales funcionales: Alegría, Tristeza, Ira, Temor, Desagrado, Ansiedad, Envidia, Aburrimiento, Vergüenza y Nostalgia. Los colores identifican circuitos y el brillo representa actividad; actualmente todos los canales permanecen en `0.00`, sin emoción dominante.

El futuro motor deberá explicar qué señal modificó cada canal, aplicar decaimiento, separar estado efímero de memoria y permitir desactivar su influencia sobre comportamiento y avatar. No se presentará como conciencia, sentimiento biológico ni diagnóstico del usuario. El diseño completo está en `docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md`.

### Fase R4 — Taller de habilidades

**Estado:** completada el 2026-08-10 · cinco incrementos implementados y validados  
**Dependencia:** Fase R3  
**Objetivo:** permitir que Carlos enseñe procedimientos reutilizables sin dar autonomía irrestricta al modelo.

Una habilidad será un manifiesto local versionado que declare:

- propósito, autor y procedencia;
- pasos visibles;
- capacidades requeridas;
- entradas, resultados y condiciones previas;
- nivel de riesgo y permisos;
- pruebas o comprobaciones de éxito;
- estado: borrador, en revisión, aprobada, desactivada o retirada.

La primera versión permitirá crear, editar, validar y simular habilidades. Toda habilidad comenzará como borrador desactivado.

**No incluye:** descargar habilidades de terceros, generar ejecutables, modificar su propio validador ni activar una habilidad automáticamente.

**Criterios de aceptación:**

- [x] El esquema rechaza pasos, operaciones o capacidades no registradas.
- [x] La simulación muestra el plan sin ejecutar efectos.
- [x] Aprobar, desactivar, restaurar, retirar y versionar queda auditado.
- [x] Una habilidad conserva el principio de menor privilegio.
- [x] Hay al menos una habilidad local de solo lectura validada de extremo a extremo.

### Fase R5 — Aprendizaje gobernado de procedimientos

**Estado:** completada el 2026-08-13 · cinco incrementos implementados y validados  
**Dependencia:** Fase R4  
**Objetivo:** permitir que Alice detecte procedimientos repetidos y proponga convertirlos en habilidades.

Alice podrá generar un candidato únicamente a partir de ejecuciones exitosas y auditadas. La propuesta mostrará los pasos observados, repeticiones, diferencias, capacidades necesarias y evidencia de origen. Carlos decidirá si la corrige, prueba, aprueba o descarta.

**No incluye:** autoactivación, reescritura silenciosa de habilidades aprobadas ni considerar una respuesta del proveedor como instrucción confiable.

**Criterios de aceptación:**

- [x] Una propuesta contiene evidencia suficiente para reconstruir su origen.
- [x] La detección evita proponer tareas triviales o de una sola aparición.
- [x] Aprobar crea una nueva revisión; no sobrescribe la anterior.
- [x] Rechazar no modifica capacidades ni memoria duradera.
- [x] Existe restauración de una versión anterior mediante el ciclo R4 del borrador derivado.

**Incremento R5.1:** contrato cerrado de candidatos sustentados en R1 y R3. Exige al menos tres ocurrencias, dos pasos, riesgo no reducido y diferencias recalculables; mantiene sólo propuesta, sin comandos, persistencia, memoria duradera, autoactivación ni ejecución.

**Incremento R5.2:** detector efímero y de sólo lectura sobre la ventana visible R3. Excluye eventos no productores, capacidades planificadas, pasos únicos y secuencias con orden temporal ambiguo. La prueba canónica examinó 22 eventos y devolvió 0 ejecuciones calificadas y 0 patrones sin modificar ninguno de los 10 archivos de datos.

**Incremento R5.3:** almacén separado de decisiones bajo `data/procedures`, con una decisión inmutable `retain` o `dismiss` por huella y confirmación explícita del propietario. Conservar guarda un candidato validado y su SHA-256; descartar no guarda metadatos del candidato y el motivo se reduce a digest. La pestaña **Procedimientos** vive en Governance, separada del Taller R4. La sonda canónica real examinó 200 eventos, encontró 0 patrones y 0 decisiones y no creó el almacén; ejecución y borrador R4 continúan deshabilitados.

**Incremento R5.4:** conversión explícita y de uso único desde un candidato `retain` a un borrador R4 nuevo. El manifiesto conserva `decisionId`, `candidateId`, fingerprint y SHA-256 como procedencia inmutable; R4 vuelve a validar capacidades, operaciones, riesgo y política `simulationOnly`. Un descarte, digest distinto, huella ya usada o identidad ocupada no escribe ni sobrescribe. La procedencia sobrevivió revisión, aprobación, desactivación y restauración en pruebas físicas temporales. La sonda canónica real devolvió 0 conversiones y no modificó datos.

**Incremento R5.5:** cierre de vigencia y evidencia. Cada decisión se clasifica como vigente, obsoleta, descartada, convertida o bloqueada. La auditoría no saludable produce bloqueo, no una falsa obsolescencia. La pantalla expone ocurrencias, eventos, pasos, variaciones, riesgo y límites. El backend vuelve a resolver R1/R3 antes de convertir y rechaza una huella obsoleta. Pruebas físicas temporales generaron eventos R3 mediante código real, escribieron un `retain`, recorrieron los cinco estados y verificaron por SHA-256 que el rechazo obsoleto no creó `skills/` ni modificó archivos existentes.

### Fase R6 — Memoria por capas y consolidación v2

**Estado:** completada el 2026-09-01 · ciclo canónico activado y verificado  
**Dependencia:** Fase R3; se integra con Fase R5  
**Objetivo:** separar lo que Alice está usando ahora de lo que recuerda de manera duradera.

Capas previstas:

- perfil y preferencias estables;
- memoria episódica de experiencias;
- memoria semántica de hechos enseñados;
- memoria procedimental vinculada a habilidades;
- memoria temporal con vencimiento;
- memoria de trabajo de la sesión actual.

La consolidación detectará duplicados, contradicciones, datos posiblemente obsoletos y candidatos a promoción. En su primera entrega será iniciada y confirmada manualmente. La frecuencia de recuperación, importancia, confianza, procedencia y recencia serán métricas independientes.

**Incremento R6.1:** `records.json` continúa como fuente histórica y una proyección separada `layer-index-v2.json` conserva sólo IDs, clasificación, revisiones y SHA-256. La vista previa no escribe; activar exige coincidencia de huella confirmada y releída por Rust; revertir desactiva sin borrar. La clasificación explícita envía conversaciones a episodios, enseñanzas semánticas a hechos enseñados y conserva procedimientos o preferencias como no clasificados. La sonda canónica leyó 10 recuerdos: 9 episodios, 0 hechos enseñados, 1 procedimiento pendiente y 0 memoria de trabajo; los 10 archivos mantuvieron sus SHA-256.

**Incremento R6.2-A:** memoria de trabajo nativa dentro del proceso: tres intercambios reales, seis mensajes, 48.000 caracteres y TTL de 30 minutos. Sólo una respuesta recibida del proveedor entra en RAM; vencer, vaciar o cerrar Alice elimina el contenido sin tocar memoria duradera. R3 recibe digests, no texto. La conversación deja de ser una pantalla duplicada y se integra en `[00] CONVERSATION / PERCEPTION INPUT`; el control visual de vaciado queda para R6.2-B.

**Incremento R6.2-B:** `Memoria → Trabajo RAM` muestra estado, mensajes, intercambios, caracteres, porcentaje, TTL, generación y procedencia desde el snapshot nativo. No repite texto conversacional. Vaciar exige confirmación visible y la generación exacta; una generación obsoleta se bloquea. El navegador declara `SIN BACKEND` y no simula métricas.

**Incremento R6.2-C:** la previsualización obligatoria calcula caracteres Unicode y bytes UTF-8 exactos para mensaje, historial, recuerdos, ventana y separadores usando la misma cadena saliente. Una fuente opcional no autorizada cuenta cero; no se inventan tokens dependientes del proveedor.

**Incremento R6.3-A:** `consolidation_preview` relee `records.json` sin escribir y produce pares ligados al SHA-256 de la fuente. Sólo llama duplicado exacto a tipo, clase, intención, resumen y próximo paso normalizados iguales; una misma intención con contenido diferente queda como revisión requerida, no contradicción automática. La sonda canónica leyó 10 registros y devolvió cero candidatos con 10 archivos intactos. `Memoria → Consolidar` muestra el resultado nativo; fusión, archivado y resolución continúan bloqueados.

**Incremento R6.3-B:** `resolve_consolidation_candidate` acepta exclusivamente `keepSeparate`. La orden exige confirmación, SHA-256 vigente, ID de candidato y los dos IDs ordenados. Antes de persistir crea un respaldo de `records.json` ligado a su huella; luego registra una decisión lateral, inmutable e idempotente, y auditoría sin texto privado. La interfaz conserva el par visible como resuelto. No reescribe recuerdos ni habilita fusión o archivado. La sonda canónica negativa rechazó un candidato inexistente y preservó los 10 archivos.

**Incremento R6.3-C:** `preview_consolidation_merge` acepta únicamente duplicados exactos pendientes y exige que Carlos seleccione uno de los dos registros como superviviente. Rust relee y valida la fuente, confirma el candidato y proyecta conteo, SHA-256, bytes, diferencias originales, respaldo e impacto sobre R6.1. La interfaz no contiene ejecución. En datos controlados se verificaron respaldo ausente y existente, revisión R6.1 activa y cero escrituras; la sonda canónica leyó 17 registros, halló cero candidatos y conservó las huellas de 20 archivos.

**Incremento R6.3-D:** el plan v2 declara ocho pasos obligatorios de recuperación. Un motor Rust deliberadamente desconectado de Tauri creó un respaldo físico, sustituyó una fuente controlada mediante `MoveFileExW`, verificó la proyección, escribió auditoría R3 y restauró los bytes originales. Un fallo de auditoría inducido también terminó restaurado. R6.1 activa bloqueó antes de escribir. La memoria canónica no se sometió al ensayo y sus 20 archivos conservaron sus SHA-256.

**Incremento R6.3-E:** un recibo transaccional durable v1 conserva IDs, huellas, respaldo, fechas y los estados cerrados `prepared`, `projected` y `restored`, sin texto privado. Una recuperación iniciada desde una llamada nueva y sin plan en RAM restauró físicamente una fuente proyectada, dejó pendiente un fallo de auditoría, lo reintentó y cerró de forma idempotente. Un recibo corrupto o una tercera huella bloquearon sin sobrescribir. Preparación y recuperación permanecen desconectadas de IPC y no se ejecutaron sobre memoria canónica.

**Incremento R6.3-F:** `consolidation_recovery_status` expone estado nativo de sólo lectura y `restore_consolidation_transaction` restaura únicamente un recibo pendiente con confirmación, ID y ambas huellas vigentes. La solicitud debe auditarse antes de tocar la fuente y el recibo se cierra sólo después de auditar el éxito. Repetir una restauración cerrada es idempotente. La preparación y la fusión siguen desconectadas de IPC. La sonda canónica devolvió `idle`, 17 recuerdos y 20 archivos intactos.

**Incremento R6.4-A:** una respuesta realmente recibida de un proveedor puede guardarse como episodio local cuando **Aprendizaje episódico local** está activo. El registro conserva proveedor y modelo, comienza con fuerza baja y confirma que la conversación ocurrió, no la verdad factual de la respuesta. La recuperación posterior lo rotula como episodio no verificado. La extracción de hechos, preferencias o hábitos continúa pendiente y requerirá candidatos revisables.

**Incremento R6.4-B:** `memory.learning.propose` relee un recuerdo elegido, lo limita a 12.000 caracteres y solicita a Ollama local hasta cuatro candidatos cerrados. Rust rechaza modelos cloud, tipos desconocidos, límites excedidos y cualquier evidencia que no aparezca literalmente en la fuente. La vista permite corregir título, clase, contenido e importancia, declara cero escrituras y exige confirmación separada para usar el almacén normal de Memoria. Tres pruebas reales devolvieron 0, 0 y 4 candidatos; las cuatro evidencias del caso extenso coincidieron y `records.json` conservó su SHA-256.

**Incremento R6.4-C:** `confirm_learning_candidate` mueve la confirmación completa a Rust. El comando relee la fuente, reconstruye la propuesta, compara su ID y SHA-256, valida la edición y realiza respaldo exacto, reemplazo atómico y auditoría bajo un bloqueo compartido de escritura. Un fallo de auditoría restaura `records.json`; un reintento idéntico es idempotente y uno alterado se rechaza. La sonda real rechazó una huella obsoleta y conservó intactos los 21 archivos canónicos; las escrituras positivas se limitaron a directorios físicos temporales para no insertar recuerdos ficticios.

**Incremento R6.5-A:** ADR-P-084 define la memoria como ciclo funcional de codificación, memoria de trabajo, candidatura, consolidación, recuperación, reconsolidación versionada, debilitamiento funcional, supresión voluntaria, archivo y borrado gobernado. La interfaz **Memoria** deja de comportarse como un formulario separado de enseñanza y vuelve a ser inspección y control del sistema. La primera proyección trazable del volumen usa un círculo por registro real y un rombo únicamente por recuperación actual o proceso R3 con evidencia; una instalación vacía no genera relleno y no se dibujan asociaciones persistentes inexistentes. Este incremento establece contrato y proyección: los estados avanzados del ciclo todavía no se persisten ni ejecutan.

**Incremento R6.5-B:** `memory_lifecycle_preview` valida `records.json` en Rust y genera una referencia trazable por registro con SHA-256, vigencia explícita, política de recuperación vigente y versión base. Los registros sin estado quedan `notAssessed`; no se infieren debilitamiento, supresión ni reconsolidación desde `storageStrength`, antigüedad o frecuencia. La pestaña **Ciclo** integra esta vista con la cola de vigencia. El futuro `lifecycle-index-v1.json` se declara como destino, pero toda escritura y activación permanecen deshabilitadas hasta contar con contrato durable, respaldo, auditoría y reversión.

**Incremento R6.5-C:** `activate_memory_lifecycle` y `rollback_memory_lifecycle` habilitan exclusivamente el índice lateral `lifecycle-index-v1.json`. La activación exige confirmación y SHA-256 vigente, conserva revisiones inmutables y es idempotente para la misma fuente. Un cambio real de `records.json` aparece como `sourceChanged` y requiere una revisión nueva. Cada reemplazo respalda el índice anterior por huella, relee y valida el documento, registra auditoría local y restaura el estado previo si ésta falla. Revertir elimina sólo el puntero activo; nunca reescribe recuerdos. Debilitamiento, supresión y reconsolidación continúan fuera del contrato v1.

**Incremento R6.5-D:** `assess_memory_validity` permite una sola transición inicial sobre recuerdos `notAssessed`: el propietario puede confirmarlos como vigentes o marcarlos en conflicto. La orden exige confirmación, huella exacta de `records.json` y huella individual del registro. Antes de escribir crea un respaldo byte a byte, reemplaza la fuente de forma atómica, relee el resultado y registra auditoría; cualquier fallo posterior restaura la fuente original. La operación modifica únicamente `memoryStatus`, la fecha de revisión y el contador compatible con la decisión. No altera contenido, importancia ni `storageStrength`, y una revisión activa del índice queda visiblemente `sourceChanged` hasta una nueva activación.

**Incremento R6.5-E:** `assess_memory_accessibility` separa disponibilidad de recuperación y vigencia. Sólo un recuerdo confirmado puede declararse `accessible` o `dormant`; ponerlo en reposo lo excluye realmente del RAG léxico y de las rutas activas del volumen, pero conserva su nodo, contenido, fuerza e historial. La operación exige confirmación y ambas huellas, crea un respaldo exacto independiente, reemplaza `records.json` atómicamente y restaura ante fallo de validación o auditoría. Reactivar es una nueva decisión explícita y reversible. El volumen muestra el nodo dormido atenuado, sin presentarlo como recuperado.

**Incremento R6.5-F:** una respuesta real que utilizó RAG deja los recuerdos en espera de evaluación; responder técnicamente ya no incrementa recuperaciones exitosas ni fuerza. Carlos confirma por recuerdo si fue útil o no ayudó. Sólo esos resultados llevan `retrievalEvidenceVersion=1`; contadores heredados sin esa marca se excluyen. La vista nativa exige tres resultados antes de evaluar y señala revisión cuando al menos dos tercios no ayudaron. Es sólo evidencia funcional: `automaticAction=false` y ningún umbral duerme, debilita, suprime, archiva o elimina recuerdos.

**Incremento R6.5-G:** `assess_memory_suppression` permite al propietario suprimir o liberar un recuerdo mediante confirmación explícita, huellas vigentes y uno de tres motivos cerrados: decisión propia, contexto sensible o límite temporal. La supresión bloquea físicamente el RAG y atenúa el nodo real del volumen sin modificar contenido, fuerza, vigencia, accesibilidad ni contadores. Cada transición crea un respaldo exacto, reemplaza `records.json` atómicamente, relee la proyección y audita la decisión; un fallo restaura los bytes originales. Liberar es reversible incluso si después cambió la vigencia. Ninguna señal de debilitamiento ni salida de modelo puede activar esta operación.

**Incremento R6.5-H:** editar un recuerdo confirmado o en conflicto deja de usar la sobrescritura genérica. `preview_memory_reconsolidation` prepara una única versión sucesora, muestra campos y huellas y no escribe; `confirm_memory_reconsolidation` exige el mismo plan, una segunda confirmación y un motivo cerrado. La versión desplazada completa se guarda en `memory/revisions`, la fuente anterior se respalda y `records.json` conserva la versión vigente con su cadena SHA-256. Relectura, ciclo y auditoría son obligatorios; cualquier fallo restaura la fuente y retira la revisión incompleta. Recuperar, conversar o usar un modelo nunca activa reconsolidación. El guardado genérico tampoco puede eliminar registros durables ni fabricar estados gobernados. El volumen muestra sólo el nodo vigente y su número real de versión.

**Incremento R6.5-I:** el archivo nuevo se separa de vigencia, conflicto, reposo, supresión y eliminación. `preview_memory_archive` prepara sin escribir una transición `archive` o `restore`, ligada a ambas huellas, nota digestada y motivo cerrado; `confirm_memory_archive` exige el mismo plan y una segunda confirmación. El estado independiente `archiveStatus=archived` bloquea físicamente RAG y consolidación, pero conserva `memoryStatus`, contenido, fuerza, accesibilidad, supresión y versión. Cada transición crea respaldo exacto, reemplaza la fuente atómicamente, relee el ciclo y audita; cualquier fallo restaura los bytes anteriores. Restaurar elimina sólo los metadatos de archivo y recupera la política determinada por los demás ejes. Los `memoryStatus=archived` heredados siguen legibles, pero no se restauran fingiendo una vigencia previa desconocida.

**Incremento R6.5-J:** la eliminación durable queda separada del archivo reversible y nunca se deduce de antigüedad, fuerza, utilidad ni una salida de modelo. Sólo un recuerdo archivado por R6.5-I puede programarse mediante vista previa y segunda confirmación. La programación escribe un motivo cerrado, solicitud y fecha de elegibilidad exactamente siete días posterior; durante la espera el recuerdo permanece íntegro, archivado y la operación puede cancelarse. Vencido el plazo, `preview_memory_deletion` vuelve a verificar fuente, registro y reloj sin escribir; `confirm_memory_deletion` exige el mismo plan y otra confirmación, crea y relee un resguardo privado exacto, retira el registro de `records.json`, escribe una lápida digestada sin contenido y audita. Cualquier fallo restaura la fuente y retira la lápida incompleta. El resguardo no se presenta como borrado seguro del soporte físico.

**Incremento R6.6-A:** `layer-index-v3.json` amplía la proyección sin reinterpretar ni sobrescribir el v2 activo. Un registro que ya declara `memoryType=procedural` entra en una capa procedimental con `linkState=pendingR5`; esto reconoce su clase sin inventar una habilidad ni habilitar ejecución. La decisión inicial de vigencia exige ahora una procedencia de 1 a 300 caracteres cuando el registro carece de ella y la persiste dentro del mismo respaldo, reemplazo atómico y auditoría; una procedencia existente no puede sustituirse por esta ruta. La interfaz reutiliza **Capas R6** y **Ciclo**, sin crear otra página. La sonda canónica de sólo lectura proyectó 19 episodios, 1 procedimiento pendiente de R5 y 0 sin clasificar; los 21 archivos conservaron sus SHA-256 y no se creó v3.

Las futuras fuentes sensoriales —pantalla seleccionada, cámara, micrófono, reproductores, acciones accesibles y gestos— producirán primero observaciones efímeras y candidatos revisables. La señal cruda no se convertirá en memoria ni se conservará por defecto. Este alcance sigue dependiendo del registro de R1, el Gateway de R2 y la auditoría de R3, según ADR-P-043.

El tamaño visual de un nodo podrá representar fuerza o uso, pero nunca será prueba de verdad. Toda métrica deberá ser explicable desde registros reales.

**Criterios de aceptación:**

- [x] Cada recuerdo tiene capa, origen, estado y reglas de vigencia.
- [x] Los conflictos no se resuelven silenciosamente.
- [x] La consolidación ofrece vista previa y respaldo.
- [x] La memoria de trabajo puede descartarse sin borrar memoria duradera.
- [x] Los índices derivados pueden reconstruirse desde la fuente de verdad.

R6.1 satisface capa, procedencia y reconstrucción; R6.2 separa RAM y salida; R6.3-B permite mantener pares separados; R6.3-C proyecta una fusión; R6.3-D demuestra reemplazo atómico y restauración controlada; R6.3-E persiste el recibo y R6.3-F expone estado y restauración gobernada. Crear o ejecutar una fusión canónica continúa bloqueado y requerirá una decisión independiente.

**Preauditoría R6 · 2026-08-24:** las sondas Rust de sólo lectura encontraron 20 recuerdos reales y conservaron los SHA-256 de los 21 archivos canónicos. R6.6-A resolvió la brecha estructural de capa, pero quedaron nueve recuerdos `notAssessed` sin procedencia explícita. Esa evidencia histórica y el bloqueo correcto se conservan en `docs/testing/R6_CLOSEOUT_AUDIT_2026-08-24.md`.

**Cierre final R6 · 2026-09-01:** después de las decisiones explícitas del propietario y la retirada de registros inconclusos, `records.json` contiene 15 recuerdos reales: 13 vigentes y 2 conflictivos, sin recuerdos no evaluados ni procedencia faltante. La proyección `layer-index-v3.json` activa clasifica 14 episodios y 1 procedimiento `pendingR5`, sin elementos no clasificados. El ciclo `lifecycle-index-v1.json` también está activo sobre el mismo SHA-256 vigente. Las dos sondas canónicas de sólo lectura conservaron exactamente los 35 archivos de `data/` y su digest agregado. Los 2 conflictos permanecen visibles y excluidos de recuperación como conocimiento vigente; no bloquean el cierre porque R6 exige preservarlos, no resolverlos silenciosamente. Evidencia completa en `docs/testing/R6_CLOSEOUT_REPORT_2026-09-01.md`.

### Fase R7 — Tareas programadas e intenciones

**Estado:** R7.2 completado · persistencia e interfaz gobernadas; sin scheduler  
**Dependencia:** Fases R2, R3 y R6  
**Objetivo:** diferenciar recuerdos, recordatorios temporales y acciones condicionadas.

La primera versión permitirá recordatorios locales y comprobaciones de solo lectura. Las tareas con efectos externos quedarán en modo propuesta hasta que exista una política específica y pruebas suficientes.

**Criterios de aceptación:**

- [ ] Cada tarea muestra próxima ejecución, alcance, estado y opción de cancelación.
- [ ] Reiniciar Alice no duplica ejecuciones.
- [ ] Una tarea vencida o revocada no puede actuar.
- [ ] El historial diferencia programación, intento, omisión y resultado.
- [ ] El modo en segundo plano puede desactivarse completamente.

**Incremento R7.1:** `tasks-v1.json` queda reservado como un registro separado de `records.json`. El contrato cerrado distingue `localReminder` de `readOnlyCheck`, exige UUID, origen confirmado por el propietario, próxima ejecución, alcance, estado y cancelabilidad coherentes, y no admite comandos ni parámetros ejecutables. `task_registry_status` relee sin crear carpetas, bloquea archivos corruptos sin repararlos y siempre devuelve `automaticExecution=false`. R1 incorpora `tasks.registry.inspect` como consulta local implementada. Las pruebas físicas preservaron los bytes de fixtures válidos y corruptos; la sonda canónica confirmó la ausencia honesta del registro sin modificar `data/`.

**Incremento R7.2-A:** `preview_task_mutation` prepara sin escribir un recordatorio único o su cancelación y liga identidad, hora, alcance, fuente y revisión por SHA-256. `confirm_task_mutation` exige el plan íntegro y confirmación explícita, vuelve a leer la fuente, crea respaldo y revisión durable, actualiza el índice y registra auditoría sin título privado. La cancelación es idempotente. La capacidad `tasks.registry.write` eleva el inventario R1 a 28 capacidades. La interfaz visible y la primera tarea canónica quedan pendientes; no existe scheduler ni notificación.

**Incremento R7.2-B:** Planificador incorpora un bloque visual separado de control del propietario. Permite consultar el registro real, preparar sin escribir un recordatorio único, releer UUID, título, hora local, alcance, respaldo y ejecución apagada, confirmar mediante una casilla explícita y preparar cancelaciones con el mismo protocolo. Los contratos TypeScript rechazan respuestas abiertas o ejecución automática. La prueba viva preparó una vista previa y confirmó que `data/tasks/tasks-v1.json` continuó ausente: 0 tareas fabricadas, sin scheduler, notificación ni red.

### Fase R8 — Grafo de conocimiento y recuperación semántica

**Estado:** pendiente  
**Dependencia:** Fase R6  
**Objetivo:** convertir el volumen neuronal en una vista fiel de recuerdos y asociaciones persistentes.

Las aristas tendrán tipo, fuerza, procedencia y evidencia. La búsqueda híbrida combinará coincidencia exacta y significado semántico. Los embeddings y demás índices serán derivados y regenerables; no reemplazarán los registros originales.

SQLite se adoptará solamente cuando las relaciones, transacciones o el volumen demuestren que JSON dejó de ser suficiente, mediante migración respaldada y reversible.

**Criterios de aceptación:**

- [ ] Cada nodo abre su registro real y cada arista explica su evidencia.
- [ ] Una instalación sin recuerdos muestra un grafo vacío.
- [ ] Corregir o eliminar un recuerdo actualiza sus relaciones.
- [ ] La búsqueda indica por qué recuperó cada resultado.
- [ ] Reconstruir índices no modifica la fuente original.

### Fase R9 — Presencia, voz y cuerpo mediante puentes

**Estado:** futura  
**Dependencia:** Fases R1 a R3  
**Objetivo:** conectar el avatar sin mezclar representación visual con decisión cognitiva.

Orden previsto: salida de texto, voz autorizada, expresiones del VRM, mirada, animaciones, entrada facial o corporal y finalmente Active Ragdoll. Fish Audio continúa como candidato de voz sujeto a licencia, privacidad, costo y pruebas. Cada adaptador deberá registrarse como una capacidad independiente.

**Base corporal local ya comprobada:** el visor manual dispone de doce clips privados, mezcla locomotora, IK de apoyo y una FSM de siete estados para reposo, arranque, locomoción, salto, sentarse y levantarse. Sus transiciones generan telemetría R3 mínima con procedencia humana o diagnóstica; alimentan una región `Motor manual` aislada y no activan el puente cognitivo. El aprendizaje motor futuro deberá correlacionar intención, acción, telemetría y resultado en R3, exigir repeticiones válidas y proponer memoria procedural bajo confirmación; nunca inferir aprendizaje por la sola existencia o reproducción de un clip.

**Base facial local ya comprobada:** una sonda diagnóstica explícita procesó video real de `ACER HD User Facing` con MediaPipe Face Landmarker y el modelo float16 v1 verificado por SHA-256. Detectó 478 landmarks y 52 blendshapes sin persistir fotogramas ni coordenadas. La sonda no forma parte del runtime, no identifica personas, no activa `perception.face.landmarks` y no controla el avatar. La integración futura deberá separar captura, derivación facial y salida VRM; requerirá un grant R2 específico, indicador y parada visibles, calibración por usuario, filtrado temporal y auditoría R3 sin biometría cruda.

**Destino facial real inventariado:** el VRM privado declara 14 expresiones preset (`happy`, `angry`,
`sad`, `relaxed`, `surprised`, vocales y parpadeos) y ninguna personalizada. Avatar las expone como
catálogo de solo lectura; no crea pesos, animación ni un mapeo desde la cámara. La futura tabla de
retarget deberá partir de este catálogo y conservar la frontera R2/R3/R9.

**Preparación visible sin sensor:** la pestaña Rostro consulta un estado nativo pasivo del modelo y runtime local. Esta comprobación vuelve a calcular la huella, confirma dependencias y declara `sensorOpened=false`; no puede convertirse en lectura facial, permiso, memoria, actividad cognitiva ni salida VRM.

#### Subfase futura — Sala de observación y maduración

Después de conectar de forma segura el cuerpo, Alice podrá entrar en una sala virtual delimitada para observar cómo responde a objetos, estímulos, memoria y consecuencias. La sala será un entorno separado de `COGNITIVE CORE`, `BODY SOLVER` y `GOVERNANCE`; no equivaldrá a acceso libre al escritorio o a Internet.

Cada sesión tendrá línea base, objetivos observables, inicio y fin explícitos, parada inmediata, telemetría real y posibilidad de reinicio. La maduración deberá poder atribuirse a recuerdos, habilidades, parámetros o experiencias concretas y reversibles. No se presentará mayor actividad visual como prueba de conciencia o desarrollo si no existe evidencia persistente que la explique.

**Criterios iniciales:**

- [ ] La sala puede restablecerse sin borrar la memoria durable aprobada.
- [ ] Cada estímulo y respuesta queda correlacionado por R3.
- [ ] El cuerpo puede detenerse aunque el núcleo o el entorno fallen.
- [ ] Las diferencias entre sesiones se explican desde cambios versionados.
- [ ] Ningún aprendizaje de la sala se consolida sin la política vigente de memoria y habilidades.

**Criterios de aceptación:**

- [ ] Desconectar un puente no detiene conversación ni memoria.
- [ ] La interfaz diferencia datos reales, ausencia de señal y error.
- [x] Cámara y micrófono requieren indicadores y revocación visibles.
- [ ] El avatar acredita a Carlos Nuñez y su creación con VRoid Studio.
- [ ] Ragdoll no controla decisiones; solamente transforma movimiento aprobado en respuesta física.

### Fase R10 — Distribución segura

**Estado:** futura  
**Dependencia:** estabilidad de las fases anteriores  
**Objetivo:** preparar una versión compartible que comience vacía y permita a cada persona aportar sus propios datos y credenciales.

**Criterios de aceptación:**

- [ ] El paquete no contiene recuerdos, auditorías, claves ni el avatar privado sin permiso de distribución.
- [ ] La instalación crea una raíz de datos nueva y vacía.
- [ ] Existe asistente de configuración, migración y desinstalación.
- [ ] Licencias, créditos, límites y modelo de amenazas están documentados.
- [ ] Una auditoría desde una máquina limpia reproduce el arranque y las pruebas esenciales.

## Puerta de calidad obligatoria

Antes de cerrar cualquier fase se debe:

1. actualizar el documento maestro y crear o modificar la ADR correspondiente;
2. definir contrato y migración antes de cambiar datos persistentes;
3. respaldar y verificar cualquier migración con datos sintéticos separados;
4. ejecutar pruebas unitarias, integración y compilación de Rust y frontend;
5. comprobar visualmente estados vacío, normal, bloqueado y error;
6. confirmar que no se modificaron `data/`, el avatar privado ni `E:\Alice`;
7. escribir un informe breve con resultados y limitaciones;
8. realizar un commit acotado solamente cuando toda la evidencia apruebe.

Comandos mínimos vigentes:

```powershell
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
npm test
npm run build
```

## Próximo paso autorizado

Las **Fases R1 a R6** están completadas y **R7.2** aporta la transacción nativa y su interfaz gobernada sin scheduler. El próximo incremento es **R7.3 — motor local de vencimiento**, con resolución idempotente del reloj y apagado completo del modo en segundo plano; no incluirá aún notificaciones. Los 2 conflictos de memoria no se convierten en tareas ni conocimiento vigente. “Dreaming”, análisis general de proyectos, transcripción y ejecución de habilidades continúan fuera de alcance. Fish Audio permanece reservado para R9 y no se configura desde archivos de notas.

## Identidad adoptada — Alice Cognitive Core

Carlos Nuñez aprobó **Alice Cognitive Core** como identidad técnica. La marca visible de la asistente continúa siendo **Alice**.

La migración del nombre deberá revisar de forma explícita:

- carpeta raíz del proyecto;
- `package.json`, configuración de Tauri e identificador de la aplicación;
- `Iniciar Alice.cmd` y la variable `ALICE_DATA_DIR`;
- rutas del avatar y otros activos privados;
- enlaces absolutos o ejemplos dentro de la documentación;
- nombre del ejecutable, ventana, iconos e instalador;
- estrategia de copia y verificación de `data/` sin borrar la ubicación anterior;
- repositorio de GitHub `alice-cognitive-core`, que deberá mantenerse **privado**.

La migración fue verificada en `E:\Alice Cognitive Core`: código, historial, memoria y avatar coinciden con el origen. El repositorio `enri312/alice-cognitive-core` está publicado con visibilidad privada y la rama local sigue `origin/master`. `E:\Proyecto P` se conserva temporalmente como respaldo y no se borrará durante esta fase.
