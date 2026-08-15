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

**Estado:** completada en su alcance inicial · ventana, cámara y micrófono protegidos  
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

**Estado:** en curso · R6.1, R6.2-C y R6.3-B validados el 2026-08-15  
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

Las futuras fuentes sensoriales —pantalla seleccionada, cámara, micrófono, reproductores, acciones accesibles y gestos— producirán primero observaciones efímeras y candidatos revisables. La señal cruda no se convertirá en memoria ni se conservará por defecto. Este alcance sigue dependiendo del registro de R1, el Gateway de R2 y la auditoría de R3, según ADR-P-043.

El tamaño visual de un nodo podrá representar fuerza o uso, pero nunca será prueba de verdad. Toda métrica deberá ser explicable desde registros reales.

**Criterios de aceptación:**

- [ ] Cada recuerdo tiene capa, origen, estado y reglas de vigencia.
- [x] Los conflictos no se resuelven silenciosamente.
- [ ] La consolidación ofrece vista previa y respaldo.
- [x] La memoria de trabajo puede descartarse sin borrar memoria duradera.
- [x] Los índices derivados pueden reconstruirse desde la fuente de verdad.

R6.1 satisface capa, procedencia y reconstrucción; R6.2 separa RAM y salida; R6.3-B permite mantener pares separados con respaldo y auditoría. La fusión manual continúa bloqueada hasta definir selección de registro superviviente y restauración verificable.

### Fase R7 — Tareas programadas e intenciones

**Estado:** pendiente  
**Dependencia:** Fases R2, R3 y R6  
**Objetivo:** diferenciar recuerdos, recordatorios temporales y acciones condicionadas.

La primera versión permitirá recordatorios locales y comprobaciones de solo lectura. Las tareas con efectos externos quedarán en modo propuesta hasta que exista una política específica y pruebas suficientes.

**Criterios de aceptación:**

- [ ] Cada tarea muestra próxima ejecución, alcance, estado y opción de cancelación.
- [ ] Reiniciar Alice no duplica ejecuciones.
- [ ] Una tarea vencida o revocada no puede actuar.
- [ ] El historial diferencia programación, intento, omisión y resultado.
- [ ] El modo en segundo plano puede desactivarse completamente.

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

**Base facial local ya comprobada:** una sonda diagnóstica explícita procesó video real de `ACER HD User Facing` con MediaPipe Face Landmarker y el modelo float16 v1 verificado por SHA-256. Detectó 478 landmarks y 52 blendshapes sin persistir fotogramas ni coordenadas. La sonda no forma parte del runtime, no identifica personas, no activa `perception.gesture.derive` y no controla el avatar. La integración futura deberá separar captura, derivación facial y salida VRM; requerirá un grant R2 específico, indicador y parada visibles, calibración por usuario, filtrado temporal y auditoría R3 sin biometría cruda.

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

Las **Fases R1 a R5** están completadas y **R6 está en curso**. R6.1 separa memoria duradera, R6.2 gobierna RAM y salida, y R6.3-B registra de forma real la decisión humana de mantener dos recuerdos separados. El siguiente microincremento será **R6.3-C — diseño y vista previa de fusión manual de duplicados exactos**, sin ejecutarla hasta cerrar selección del registro superviviente, restauración y auditoría. Extracción automática, “dreaming”, análisis de proyectos, transcripción y ejecución de habilidades continúan fuera de alcance. La prueba manual DualSense no alimenta cognición ni convierte `output.avatar.body` en capacidad disponible.

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
