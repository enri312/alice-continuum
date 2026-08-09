# Roadmap de Alice

Autor y propietario: Carlos Nuñez  
Última revisión: 2026-08-09  
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

## Línea base existente

| Bloque | Estado | Evidencia actual |
|---|---|---|
| Contrato y límites | Completo | Documento maestro, decisiones y diagramas de ingeniería. |
| Núcleo observable | Base completa | Volumen neuronal, flujo, estado, planificador, actividad y puentes por pestañas. |
| Conversación de nube | Funcional | Proveedores intercambiables, previsualización y autorización expresa. |
| Memoria enseñable v1 | Funcional en evolución | Registros locales, respaldo, exportación, recuperación lexical y edición. |
| Consolidación v1 | Funcional en evolución | Repaso manual y refuerzo por recuperación autorizada. |
| Avatar VRM | Visor funcional | Carga local privada e inspección; voz, rostro, cuerpo y Ragdoll siguen desconectados. |
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

**Estado:** en curso · tipos y almacén efímero nativos validados  
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

- [ ] La política predeterminada es denegar.
- [ ] Las previsualizaciones son inmutables entre aprobación y ejecución.
- [ ] Los permisos son específicos, revocables y tienen vencimiento cuando corresponde.
- [ ] Cancelar o cerrar la solicitud no produce efectos secundarios.
- [ ] Las pruebas cubren autorización, rechazo, expiración, revocación y duplicados.

### Fase R3 — Auditoría unificada y diagnóstico

**Estado:** pendiente  
**Dependencia:** Fase R2  
**Objetivo:** demostrar qué solicitó Alice, qué política se aplicó y cuál fue el resultado.

Se unificará un sobre de eventos para memoria, nube, capacidades y permisos. Registrará metadatos mínimos: identificador, fecha, origen, capacidad, decisión, resultado, duración y huellas cuando sean necesarias. No guardará claves ni copiará automáticamente contenido privado.

La pestaña Actividad será una lectura comprensible de eventos reales; los archivos JSONL locales seguirán siendo la evidencia persistente. Un diagnóstico verificará proveedores, rutas, versiones de datos, adaptadores y permisos sin alterar su estado.

**Criterios de aceptación:**

- [ ] Existe un esquema versionado de eventos.
- [ ] Actividad diferencia solicitud, autorización, ejecución, bloqueo y error.
- [ ] Los eventos correlacionados comparten un identificador de operación.
- [ ] El diagnóstico es de solo lectura y no expone secretos.
- [ ] La rotación o crecimiento de auditorías tiene una política documentada.

### Fase R4 — Taller de habilidades

**Estado:** pendiente  
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

- [ ] El esquema rechaza pasos o capacidades no registradas.
- [ ] La simulación muestra el plan sin ejecutar efectos.
- [ ] Activar, desactivar y versionar queda auditado.
- [ ] Una habilidad conserva el principio de menor privilegio.
- [ ] Hay al menos una habilidad local de solo lectura validada de extremo a extremo.

### Fase R5 — Aprendizaje gobernado de procedimientos

**Estado:** pendiente  
**Dependencia:** Fase R4  
**Objetivo:** permitir que Alice detecte procedimientos repetidos y proponga convertirlos en habilidades.

Alice podrá generar un candidato únicamente a partir de ejecuciones exitosas y auditadas. La propuesta mostrará los pasos observados, repeticiones, diferencias, capacidades necesarias y evidencia de origen. Carlos decidirá si la corrige, prueba, aprueba o descarta.

**No incluye:** autoactivación, reescritura silenciosa de habilidades aprobadas ni considerar una respuesta del proveedor como instrucción confiable.

**Criterios de aceptación:**

- [ ] Una propuesta contiene evidencia suficiente para reconstruir su origen.
- [ ] La detección evita proponer tareas triviales o de una sola aparición.
- [ ] Aprobar crea una nueva versión; no sobrescribe la anterior.
- [ ] Rechazar no modifica capacidades ni memoria duradera.
- [ ] Existe restauración de una versión anterior.

### Fase R6 — Memoria por capas y consolidación v2

**Estado:** pendiente  
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

Las futuras fuentes sensoriales —pantalla seleccionada, cámara, micrófono, reproductores, acciones accesibles y gestos— producirán primero observaciones efímeras y candidatos revisables. La señal cruda no se convertirá en memoria ni se conservará por defecto. Este alcance sigue dependiendo del registro de R1, el Gateway de R2 y la auditoría de R3, según ADR-P-043.

El tamaño visual de un nodo podrá representar fuerza o uso, pero nunca será prueba de verdad. Toda métrica deberá ser explicable desde registros reales.

**Criterios de aceptación:**

- [ ] Cada recuerdo tiene capa, origen, estado y reglas de vigencia.
- [ ] Los conflictos no se resuelven silenciosamente.
- [ ] La consolidación ofrece vista previa y respaldo.
- [ ] La memoria de trabajo puede descartarse sin borrar memoria duradera.
- [ ] Los índices derivados pueden reconstruirse desde la fuente de verdad.

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

**Criterios de aceptación:**

- [ ] Desconectar un puente no detiene conversación ni memoria.
- [ ] La interfaz diferencia datos reales, ausencia de señal y error.
- [ ] Cámara y micrófono requieren indicadores y revocación visibles.
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

La **Fase R1 — Registro de capacidades** está completada. R2 ya dispone de tipos, digest SHA-256, planes privados congelados, almacén efímero y máquina de estados nativos, con 24 pruebas específicas. El siguiente incremento permitido es exponer únicamente consulta de estado y preparación mediante comandos Tauri, sin capacidad de aprobar, ejecutar ni abrir dispositivos. Ninguna herramienta de ejecución ni permiso nuevo queda autorizado hasta aprobar esa puerta.

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
