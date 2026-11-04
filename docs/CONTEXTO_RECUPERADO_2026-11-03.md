# Contexto recuperado de Alice Continuum

Revisión: 3 de noviembre de 2026, America/Asuncion.
Base: rama `master`, commit `e8158c8`, más los cambios locales existentes.

Este documento permite retomar el proyecto tras perder las conversaciones de
desarrollo. Reconstruye el contexto desde código, Git, decisiones y pruebas;
no es una transcripción recuperada de aquellas conversaciones. La consulta de
chats activos y archivados disponibles no recuperó el historial sustantivo de
desarrollo: sólo apareció una breve conversación archivada titulada
«Revisión de Alice Cognitive Core», sin decisiones técnicas útiles.

## Qué estamos construyendo

Alice Continuum es una aplicación personal de escritorio para Windows con
conversación, memoria local, capacidades autorizadas y representación mediante
un avatar. Alice es el personaje; Continuum es la plataforma que lo sostiene.
El propietario identificado por el proyecto es Carlos Nuñez.

El nombre anterior era Alice Cognitive Core; antes existió Proyecto P. La
identidad vigente se adoptó el 16 de septiembre de 2026. La carpeta de trabajo,
el identificador Tauri y las claves de almacenamiento antiguas se conservan
deliberadamente para mantener compatibilidad. No deben renombrarse de forma
automática para hacerlos coincidir con el nombre comercial.

La aplicación combina React 19 y TypeScript con Tauri 2/Rust, Three.js y VRM.
Python sirve al lector documental local. Gemma mediante llama.cpp es la ruta
conversacional priorizada; también existen Ollama y adaptadores de proveedores
externos. Fish Audio está integrado como salida de voz autorizada. La presencia
de un adaptador en el código no demuestra que su proveedor esté operativo hoy.

Los principios conservados son memoria local, permisos explícitos, aprendizaje
revisado, trazabilidad y separación entre conversación, recuerdos y control del
equipo. El grafo y el volumen representan registros y actividad del programa;
no demuestran entrenamiento de los pesos del modelo ni conciencia. El modelo
conversacional no dispone de ejecución libre de comandos.

## Dónde quedó el trabajo

La decisión más reciente localizada es
[ADR-P-096](decisions/ADR-P-096-prioridad-conversacional-y-voz-contextual.md),
fechada el 20 de septiembre de 2026:

- Priorizar comprensión, continuidad temática y pertinencia de los recuerdos.
- Mantener Gemma como modelo principal y Fish como salida de voz.
- Posponer la integración conversacional del VRM.
- Evitar que una charla personal derive automáticamente hacia proyectos o tareas.
- Conservar revisión y autorización del texto exacto enviado a Fish.
- Evaluar conversaciones de varios turnos; los tests de instrucciones no prueban
  la calidad real de las respuestas ni de la voz.

Los cambios locales ajustan el prompt, añaden una indicación vocal contextual,
retiran el selector de tono del chat, trasladan el control del historial visible
a Configuración y agrupan los permisos/contexto en un panel desplegable. La vista
normal muestra los últimos 12 mensajes; ampliar la vista no cambia el contexto
autorizado y la preferencia sólo dura la sesión.

La ADR registra que las últimas respuestas no habían satisfecho al propietario.
Las pruebas exploratorias de septiembre no cerraron esta etapa. Su última
repetición quedó sin respuesta porque el motor local dejó de aceptar conexiones.
Esta revisión no volvió a ejecutar generaciones ni llamadas a Fish.

Un punto concreto para investigar es que
[`cloud-payload.ts`](../src/core/conversation/cloud-payload.ts) excluye las
respuestas anteriores de Alice del contexto enviado al modelo. Es una decisión
para evitar reutilizarlas como evidencia factual. Puede limitar la continuidad
del diálogo, pero no se ha demostrado que sea la causa única de las respuestas
genéricas. Incorporarlas como diálogo no factual exige diseño y pruebas propios.

## Estado funcional

| Área | Estado reconstruido y límite |
|---|---|
| R1–R3: capacidades, permisos y auditoría | Implementadas en sus alcances documentados. La autorización de nube conserva una excepción en React. |
| R4–R5: habilidades y procedimientos | Borradores, simulación, decisiones y conversión gobernada. No equivalen a ejecución autónoma de habilidades. |
| R6: memoria | Capas, revisión, recuperación, consolidación, supresión, archivo, eliminación y respaldo. Persisten brechas en el guardado genérico. |
| R7: tareas | Registro, reloj apagable, recordatorios locales y comprobaciones de capacidades de solo lectura. No es un ejecutor general de acciones. |
| R8: grafo | Referencias a fuentes, asociaciones reversibles y recuperación híbrida. No hay índice semántico persistente. |
| R9: conversación, voz y presencia | Implementación parcial. Captura manual, transcripción local, texto revisable y síntesis Fish autorizada. Calidad pendiente. |
| Avatar | Visor VRM y control manual con animaciones. La conversación no controla el cuerpo ni las expresiones. |
| Rostro y cuerpo | Preparación y contratos, con sondas históricas. No se revalidó hardware en esta revisión. |
| R10: distribución | Futura. `bundle.active=false` y rutas específicas de esta máquina; no hay instalador distribuible validado. |

R1–R8 están declaradas cerradas en sus alcances por el roadmap y sus informes;
no significa que toda capacidad posible esté implementada o endurecida.
El encabezado del plan R9 y partes del roadmap anteceden a la implementación de
Fish y a ADR-P-096. Para continuar conversación y voz, leer también esa ADR y
el [runbook vigente](runbooks/03-conversacion-y-voz.md).

## Mapa para orientarse

| Ubicación | Responsabilidad |
|---|---|
| `src/App.tsx` | Estado global, navegación, historial, memoria y llamadas nativas. |
| `src/pages/` | 15 destinos de navegación agrupados en cognición, cuerpo y gobierno; conversación se integra en la interfaz. |
| `src/components/` | Paneles y visualizaciones reutilizables. |
| `src/core/` | Contratos y lógica TypeScript de memoria, conversación, permisos, voz y avatar. |
| `src-tauri/src/lib.rs` | Composición del backend y registro de comandos IPC. |
| `src-tauri/src/memory.rs` | Persistencia y ciclo de memoria; concentra una parte grande de la complejidad. |
| `src-tauri/src/cloud.rs` | Prompt, validación de solicitudes y adaptadores conversacionales. |
| `src-tauri/src/conversation_history.rs` | Historial durable de intercambios, separado de recuerdos. |
| `src-tauri/src/local_inference.rs` | Gestión del runtime local y exclusión de inferencias concurrentes. |
| `src-tauri/src/voice_input.rs`, `voice_output.rs` | Transcripción local y síntesis Fish. |
| `scripts/adapters/` | Lector documental revisado y pruebas Python. |
| `docs/decisions/`, `docs/testing/` | Decisiones e informes históricos de validación. |
| `data/`, `Assets/` | Datos y activos privados; no confundirlos con recursos redistribuibles. |

La [guía de estructura](architecture/PROJECT_STRUCTURE.md) explica la
reorganización de septiembre. El
[documento de identidad](architecture/CONTINUUM_IDENTITY.md) explica las rutas y
claves antiguas que deben conservarse.

## Git y trabajo que ya existía

El último commit local es `e8158c8`, del 17 de septiembre de 2026:
`feat: adopt Alice Continuum and publish accumulated platform updates`.
La rama sigue a `origin/master`; no se hizo `fetch`, por lo que esta revisión
no determina si el servidor remoto tiene cambios adicionales.

Al comenzar había 13 archivos versionados modificados y 4 archivos sin seguimiento:

- Backend: `cloud.rs` y `voice_output.rs`.
- Interfaz: `App.tsx`, `main.tsx`, conversación, configuración y estilos de contexto.
- Contratos/pruebas: voz, conversación y configuración.
- Documentación: índice de decisiones y arranque local.
- Sin seguimiento: ADR-P-096, runbook de conversación/voz,
  `docs/analisis_estado_seguridad.md` y `src/styles/memory-records.css`.

Ese trabajo se preservó. Esta revisión sólo añade este documento y su enlace en
el índice documental; no modifica código funcional ni realiza commit o push.
Los logs de comprobación quedan localmente en `artifacts/review-2026-11-03/`,
una carpeta excluida de Git.

## Conversaciones de desarrollo e historial de Alice

Son almacenes distintos. Los chats de desarrollo perdidos no se recuperan al
restaurar el historial de Alice.

En `data/conversation/history-v1.json` hay actualmente 1 intercambio. Se
localizaron tres respaldos JSON con 10, 5 y 4 intercambios respectivamente.
Esos números no implican conversaciones únicas ni respaldos completos de todos
los períodos. Sólo se inspeccionaron estructura y metadatos para este informe;
no se copiaron mensajes personales a documentación.

ADR-P-096 y el runbook registran una limpieza del chat interno solicitada el
20 de septiembre, con respaldo y memoria confirmada preservada. Esto explica
ese reinicio documentado del historial de Alice; no explica la pérdida de los
chats de desarrollo. No se restauró ni mezcló ningún respaldo en esta revisión.

El lanzador usa por defecto `data/` mediante `ALICE_DATA_DIR`. Si se inicia por
otra vía sin esa variable, el backend usa el directorio de datos de Tauri en
AppData. Ante un historial aparentemente vacío, comprobar primero la raíz activa.
La existencia de dos rutas posibles no demuestra que haya ocurrido una pérdida.

Los 43 archivos presentes en `data/` al inicio conservaron tamaño y SHA-256
después de las pruebas. Los datos privados y respaldos permanecen excluidos de Git.

## Problemas que requieren atención

1. **Transiciones de memoria insuficientemente protegidas.**
   `validate_generic_memory_update` y `save_memory` permiten cambiar
   `memoryStatus`, accesibilidad y supresión sin exigir sus operaciones
   específicas. Quitar `confirmed` conservando el contenido elimina esa
   condición de protección para un guardado posterior; los demás metadatos
   durables pueden seguir imponiendo restricciones. También se aceptan nuevas
   entradas con estado confirmado. Conclusión de lectura del código, sin intentar
   alterar recuerdos reales. `source` sí está protegido mientras el estado
   anterior sea `confirmed` o `conflict`, matiz omitido en el informe de octubre.
2. **Autorización de nube en la interfaz.** `send_cloud_message` valida formato,
   tamaño y proveedor, pero no consume una aprobación nativa vinculada al payload
   y su caducidad. Un invocador IPC puede omitir la revisión de React. El puente
   Fish ya tiene un mecanismo nativo de vista previa que sirve como referencia.
3. **Permisos amplios de los datos locales.** `icacls data` confirma permisos
   heredados de modificación para `Authenticated Users` y control total para
   `BUILTIN\Users`. Esto permite acceso a otras cuentas locales; no constituye
   por sí mismo evidencia de exposición por Internet.
4. **Timeout de conversión de audio.** FFmpeg se resuelve por `PATH` y se espera
   con `wait_with_output()` sin límite de tiempo de proceso. El argumento de
   60 segundos limita duración de audio, no cuánto puede bloquearse el proceso.
5. **Documentación y verificaciones pendientes.** La calidad conversacional
   sigue abierta, Rust no cumple todavía `fmt --check`, y la compilación web
   avisa de paquetes grandes. Los resultados históricos no sustituyen estas
   comprobaciones actuales.

El [análisis del 4 de octubre](analisis_estado_seguridad.md) enumera más puntos,
incluida una posible lectura de `data/` mediante Vite. Esa hipótesis no se probó
por HTTP aquí. Tampoco se repitió una auditoría de dependencias: su antiguo
resultado de cero vulnerabilidades no se presenta como vigente. Sus porcentajes
de avance son estimaciones, no una medida comprobada de preparación o seguridad.
Hay 68 archivos ADR presentes, con numeración hasta ADR-P-096; el número final
de la serie no es el número de documentos disponibles.

## Verificación realizada el 3 de noviembre

| Comprobación | Resultado |
|---|---|
| `npm test` | 477 pruebas aprobadas, 2 sondas omitidas; 55 archivos aprobados y 2 omitidos. |
| `npm run build` | TypeScript y Vite aprobados; avisos por paquetes de aproximadamente 876 kB y 1.597 kB minificados. |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib --quiet` | 293 aprobadas, 22 sondas ignoradas; sin fallos. Aviso informativo del enlazador. |
| Python: `unittest discover -s scripts/adapters -p 'test_*.py' -v` | 5 aprobadas con `.venv-adapters`; avisos de deprecación de SWIG. |
| `Iniciar Alice Continuum.cmd --check` | Entorno listo según el prechequeo; Node 24.21.0 y Cargo 1.98.0. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Falla por diferencias de formato en `capabilities.rs`, `learning_candidates.rs`, `observation.rs`, `visual_learning.rs` y `voice_output.rs`. |
| `git diff --check` | Sin errores. |
| Integridad de `data/` | 43 archivos antes/después; cero diferencias de tamaño o SHA-256. |

Se comprobó que existen las rutas configuradas del motor llama.cpp, Gemma, su
proyector y el avatar privado. No se verificaron sus hashes ni se cargaron.
No se inició Alice, ningún modelo ni hardware; tampoco se hizo validación visual,
síntesis externa, `clippy` o empaquetado Tauri. Compilar las pruebas Rust no
equivale a verificar el ejecutable completo ni la calidad conversacional.

## Punto de reanudación recomendado

Actualización del propietario en este chat, 2026-11-03: **el avatar será lo último**.
Primero debe funcionar la aplicación. Tras comparar alternativas, el propietario
decidió mantener Gemma 4 y avanzar en R9 con escucha y respuesta por turnos de
voz. LFM3-1.7B y Granite 4.0 H Tiny quedan para una evaluación futura. El recorrido
implementado y sus límites están en [ADR-P-097](decisions/ADR-P-097-conversacion-por-turnos-de-voz.md)
y la evidencia actual en [el informe R9](testing/R9_VOICE_TURNS_REPORT_2026-11-03.md).

Retomar ADR-P-096 y el [runbook de conversación y voz](runbooks/03-conversacion-y-voz.md).
La prioridad funcional ya acordada es obtener respuestas pertinentes y mantener
continuidad antes de conectar el avatar. Preparar casos ficticios de varios
turnos, conservar entradas y criterios de evaluación, y distinguir fallos del
contenido de fallos de voz. Separar contexto de diálogo de evidencia factual
quedó implementado posteriormente para la sesión automática de voz (ADR-P-099);
el modo escrito/manual mantiene la política anterior.

Antes de ampliar capacidades o distribuir, corregir las transiciones de memoria,
la autorización nativa de nube y los permisos de datos mediante cambios acotados
y comprobables. Conservar el trabajo pendiente y tratar por separado cualquier
restauración de historial. Actualizar este contexto y registrar las nuevas
decisiones para que la continuidad del proyecto no dependa del chat.

Actualización posterior de interfaz: la entrada se presenta como **Conversación**,
con diagnóstico y documentos plegados e icono de diálogo y voz. Se conserva la
ruta interna `identificacion`. Ver [ADR-P-098](decisions/ADR-P-098-inicio-centrado-en-conversacion.md).

Actualización posterior: el propietario pidió eliminar las confirmaciones por
turno de voz. Se implementa una sesión automática revocable, con detección de
pausas, Gemma y Fish; el modo manual queda opcional. Se actualizó el equipo y
el proyecto a Node 26.13.0 LTS / npm 11.20.0. Ver [ADR-P-099](decisions/ADR-P-099-sesion-de-voz-y-node-26.md).

Actualización posterior: el propietario reportó una confusión de «tu mejora»
dirigida a Alice con desarrollo personal de Carlos. Se añaden instrucciones y
evaluación local de referentes, citas y correcciones. **Detén la conversación,
Alice** se intercepta tras transcribir durante escucha, sin enviar el control a
conversación/Fish. No hay interrupción por voz mientras el micrófono está apagado.
Rust/Cargo global y del proyecto se actualizan a 1.99.1 estable. Ver
[ADR-P-100](decisions/ADR-P-100-referentes-parada-de-voz-rust.md).


Última delegación del propietario: Alice debe decidir qué vale la pena guardar de
las nuevas conversaciones y modernizar el volumen con formas inspiradas en el
cerebro. Se implementó evaluación Gemma en segundo plano, citas literales,
almacén independiente `automatic-v1.json`, RAG activo y nodos orgánicos reales.
No se exige confirmación por recuerdo. Memoria permite pausar, corregir y retirar;
no se reescriben los archivos confirmados anteriores ni se procesan retrospectivamente
los meses de historial. Esta decisión sustituye el requisito manual anterior para
el almacén automático. Ver [ADR-P-101](decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

## Visión de conversación e icono — ADR-P-102

Por solicitud del propietario se integraron cámara WebView2 seleccionable y
escritorio virtual Windows GDI con el mismo Gemma multimodal, en voz y texto.
Sesiones visibles por fuente, token nativo revocable y TTL de dos horas; imágenes
efímeras por turno. La ruta visual reduce referencias a 700 caracteres y limita
el mensaje actual a 1600 para contexto4096. No hay identidad facial ni avatar.
El icono de Volumen incorpora corteza y dendritas ilustrativas. Adaptadores
OpenCV/Ollama anteriores separados; R1 registra perception.conversation.vision.
Ver [contrato](decisions/ADR-P-102-vision-conversacional-local.md) e
[informe](testing/CONVERSATION_VISION_REPORT_2026-11-03.md).

## Actividad y herramientas delegadas — ADR-P-103

El propietario autorizó abrir sólo Spotify y raíces D:/E: y pidió revisar tool
calling. Hay ruta directa para órdenes simples y función Gemma
open_desktop_destination para variantes naturales elegibles. Validación nativa
de intención actual, nombre, enum y destino coincidente; sin shell ni rutas
libres. Recibos reales de Windows, auditoría y continuidad por voz; estos comandos
no pasan por aprendizaje automático. R1 tiene 41 capacidades. El volumen incluye
latido técnico desde la respuesta IPC, arranque R3 en Contexto y procesos dentro
del contorno. Ver [ADR-P-103](decisions/ADR-P-103-actividad-y-herramientas-delegadas.md).

## Música delegada — ADR-P-104

El propietario amplió la autorización: reproducir Spotify y canciones pedidas en
YouTube usando Google Chrome. Eligió **Tus me gusta** como colección Spotify y
dijo que él pedirá después la canción de YouTube. No elegir una canción para él.
Hay ruta nativa sencilla, función Gemma `control_media` para variantes naturales,
validación cerrada y auditoría R3. R1 pasa a **42 capacidades**. Las órdenes no se
aprenden como recuerdos y el contexto del reproductor sólo vive en RAM.

Prueba real desde Alice con datos separados: reproducir Tus me gusta, pausar,
continuar y pausar funcionaron. Spotify se dejó pausado. No se activaron voz ni
cámara. YouTube está implementado; su reproducción real sigue pendiente de la
canción del propietario. Ver [ADR-P-104](decisions/ADR-P-104-musica-spotify-youtube-chrome.md)
y [pruebas](testing/MEDIA_PLAYBACK_REPORT_2026-11-03.md).

Seguimiento del mismo día: el propietario no consiguió reproducir con frases
habladas. Su historial mostró «Alista abre abre el Spotify y reproducir la
música», «ah, abres Spotify y reproduces mi playlist» y «Abres Spotify y
reproduce mi mi música». Las respuestas eran `chatcmpl-` de Gemma y prometían
acciones; no había ejecución musical. Se amplía la gramática acotada para esas
variantes, abrir/reproducir un mismo servicio y alias personales de Tus me gusta.
Las peticiones musicales incompletas reciben aclaración nativa; se refuerzan las
instrucciones para no inventar recibos. Los errores del selector musical también
se devuelven como respuesta sin terminar la sesión. Ver
[regresión](testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

Durante la verificación Spotify lanzó su actualizador y agotó la espera inicial.
El arranque sin ventana tiene ahora un presupuesto de 60 segundos (18 con
reproductor abierto). También se observó un fallo de sesión multimedia de Windows;
pausa/reanudación cuenta con respaldo de botones UIA en el grupo del reproductor
Spotify. No se usan teclas globales ni se modifican preferencias del servicio.

Reanudación 2026-11-04: la frase exacta «Abres Spotify y reproduce mi mi música»
activó la reproducción de Tus me gusta desde Alice nativa. Se comprobaron pausa,
continuación y pausa final con recibos reales, usando datos separados. Spotify
quedó pausado. El HTML v0.54 vuelve a abrir con la portada: las siete notas de
avances están agrupadas en Historia de cambios, y el resumen refleja R9.
Ver [presentación](testing/DOCUMENT_PRESENTATION_REPORT_2026-11-04.md) y
[aceptación musical](testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md#aceptación-reanudada--2026-11-04).

Incremento 2026-11-04: el ruido y la música proceden de notebook y equipos
externos. Se incorpora RNNoise local antes de las dos entradas de voz, VAD con
probabilidad de habla, micrófono seleccionable y dirección «Alice» opcional.
Se mantiene Gemma 4 y no se exige autorización por turno. Vite pasa a 8.3.5 y
Vitest a 4.1.12. El filtro no identifica a Carlos ni garantiza eliminar otras
voces; la aceptación acústica real sigue pendiente. Ver
[ADR-P-105](decisions/ADR-P-105-supresion-local-ruido-vite.md) y
[pruebas](testing/VOICE_NOISE_VITE_REPORT_2026-11-04.md).

## Reanudación de sesión oral — 2026-11-04

Carlos prioriza la experiencia oral de Atlas, excluye domótica y toma Nerumi como
meta posterior; avatar al final. Se detectó un fallo de Gemma ASR con la parada
en español. **Whisper base CPU** reconoce las mismas tres muestras y quedó
integrado; Gemma 4 sigue a cargo de diálogo y visión, Fish conserva su perfil y
`s2.1-pro-free`. Instalador explícito con hashes y licencias MIT incluidos.

La prueba nativa aislada pasó dos respuestas habladas y la parada directa; una
cancelación rechazó la respuesta tardía sin agregar historial. La segunda voz
inició a los 7,3 s del fin de grabación: Fish ocupó 4,5 s. No es una prueba con
la voz de Carlos ni con música real. Pronombres/citas ambiguos siguen fallando
en parte de la evaluación. No hay wake word dedicado ni interrupción mientras
habla. El detalle Último mensaje atendido permite revisar texto y etapas; un
fallo de Fish conserva el texto y rearma la escucha. HTML v0.56 integra estos
avances en los capítulos existentes, manteniendo la portada primero.

Continuar con aceptación de cinco turnos humanos y música; después trabajar
activación por nombre, eco e interrupción y menor demora de voz. No ampliar
acciones fuera de Spotify, YouTube/Chrome y aperturas D:/E: ya delegadas.
Ver [ADR-P-106](decisions/ADR-P-106-estabilizacion-oral-y-rumbo-nerumi.md) e
[informe](testing/CONVERSATION_SESSION_REPORT_2026-11-04.md).
