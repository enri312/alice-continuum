# Manual de uso de Alice Continuum

**Actualización de identidad y rutas:** 16 de septiembre de 2026; contenido funcional basado en el manual del 25 de agosto y sus incrementos posteriores.  
**Dirigido a:** Carlos Nuñez, propietario y operador de Alice  
**Carpeta canónica:** `E:\Alice Cognitive Core`

Este manual explica **qué hace cada parte visible**, cuándo conviene usarla y qué
consecuencias tiene cada acción. No hace falta conocer TypeScript, Rust ni los
códigos internos R1–R6 para operar Alice.

> **Regla principal:** Alice no aprende, envía información, modifica recuerdos ni
> ejecuta acciones físicas sin una operación visible y autorizada. Las pantallas
> técnicas muestran actividad o preparan decisiones; no son prueba de conciencia.

## 1. Inicio rápido

1. Abrí `E:\Alice Cognitive Core`.
2. Hacé doble clic en **Iniciar Alice Continuum.cmd**.
3. Dejá abierta la terminal negra mientras uses Alice.
4. Esperá a que se abra la ventana de la aplicación.
5. Entrá en **Configuración** para comprobar el proveedor de conversación.
6. Volvé a **Entrada e identificación** para conversar.

Para revisar el entorno sin abrir la aplicación:

```powershell
& 'E:\Alice Cognitive Core\Iniciar Alice Continuum.cmd' --check
```

Si Alice ya está abierta, no vuelvas a iniciar otra instancia. El lanzador protege
el puerto local `5173` e impide duplicados del mismo proyecto.

## 2. Cómo está organizada Alice

La interfaz se divide en tres núcleos. Pensalos como tres áreas con responsabilidades
diferentes:

| Núcleo | Para qué sirve | Qué no hace por sí solo |
|---|---|---|
| **Cognitive Core** | Conversación, memoria, estado y actividad cognitiva observable. | No mueve el avatar ni cambia permisos. |
| **Embodiment Core** | Rostro, cuerpo y avatar. | No decide qué recordar ni autoriza capacidades. |
| **Governance Core** | Permisos, auditoría, diagnóstico, habilidades, procedimientos y configuración. | No forma parte de la personalidad o memoria de Alice. Es control del propietario. |

No es necesario visitar todas las páginas en cada sesión. Para un uso normal basta
con **Configuración**, **Entrada e identificación**, **Memoria** cuando haya algo que
revisar y **Actividad** si querés comprobar qué ocurrió.

## 3. Recorrido recomendado para una conversación

1. En **Configuración**, elegí el proveedor y el modelo.
2. En **Entrada e identificación**, escribí el mensaje.
3. Pulsá **Revisar contexto local** si usás Ollama o **Ver qué se enviará** si algún
   día volvés a habilitar un proveedor en la nube.
4. Leé la vista previa. Ahí se muestra qué recuerdos o contexto participarán.
5. Recién entonces pulsá **Autorizar y procesar localmente** o **Autorizar y enviar
   a la nube**, según corresponda.
6. Leé la respuesta de Alice.
7. El intercambio exitoso queda en el historial local y reaparece al reiniciar.
8. Si aparece **¿ESTE RECUERDO AYUDÓ?**, marcá **Sí, fue útil** o **No ayudó**. Esa
   evaluación real sirve para ajustar la recuperación futura.
9. Si tu mensaje contiene un dato que querés conservar, debajo de la respuesta más
   reciente usá **Proponer recuerdo de este intercambio**. Gemma local recibe sólo
   tu mensaje, propone evidencia literal y no guarda nada todavía. Revisá cada
   propuesta y pulsá **Confirmar y guardar** únicamente si describe un dato real.
   Antes de confirmar, elegí **Importancia del recuerdo** (1–5; valor inicial 3).
   Este valor determina el tamaño del nodo. La confianza de extracción del modelo
   ya no se convierte en importancia; los recuerdos existentes conservan su valor.
   Si el mensaje declara una emoción, también puede aparecer una interpretación
   con color, intensidad y cita literal. Revisala: confirmar guarda esa asociación
   junto al recuerdo. Si no aparece, queda sin evaluación emocional. Esto no es
   todavía el estado emocional actual de Alice.

La vista previa es obligatoria a propósito: evita que una acción invisible decida
qué información sale de tu equipo.

### Proveedor recomendado actualmente

- **Ollama local:** procesa en la notebook y es la opción activa recomendada.
- **OpenRouter:** permanece desactivado por decisión del propietario.
- **RAG:** aporta recuerdos relevantes al modelo local; no reemplaza la memoria ni
  convierte automáticamente cada conversación en un recuerdo permanente.

Las claves privadas nunca deben escribirse en Conversación, Memoria, archivos del
repositorio ni capturas compartidas.

## 4. Cognitive Core, página por página

### Entrada e identificación

Es el punto de entrada para conversar y observar cómo se interpreta el mensaje.
Incluye el panel **[00] CONVERSATION / PERCEPTION INPUT**.

- El cuadro grande contiene la entrada o percepción activa.
- Los tokens muestran cómo se segmentó el texto.
- El vector de percepción presenta fuente, hablante, intención y confianza cuando
  esos datos existen.
- Los controles **LIVE**, **STEP**, **PAUSE**, **AUTO_REND**, **OBSERVE**,
  **CONVERSE**, **INSPECT** y **REPLAY** son indicadores o funciones en desarrollo;
  no supongas que todos ejecutan una operación real si aparecen deshabilitados.

#### Control de contexto de la conversación

Las casillas de la columna derecha autorizan qué contexto puede recibir el modelo.
Una casilla marcada significa **seleccionada**, no necesariamente que ya existan
datos:

- **Historial reciente** utiliza como máximo los diez mensajes locales más nuevos.
  Con `0 mensajes`, no adjunta contenido.
- **RAG local de recuerdos** espera el mensaje actual para buscar coincidencias. La
  vista previa muestra cuántas encontró antes de procesar.
- **Ventana actual** permanece deshabilitada hasta que el Gateway autorice el
  observador y existan metadatos. El botón abre esa configuración; no concede el
  permiso directamente.
- Sólo son elegibles el nombre del proceso y el título de la ventana. Cámara,
  micrófono, fotogramas y audio no se adjuntan desde este panel.

Después de una respuesta, el intercambio se conserva en
`data/conversation/history-v1.json` y también entra en **memoria de trabajo RAM**.
El historial permite continuar el diálogo después de reiniciar, pero no participa
entero en cada consulta: sólo los mensajes revisados y autorizados se adjuntan. El
texto del modelo no se declara un hecho confirmado. Cualquier promoción a recuerdo
R6 deberá ser explícita y revisable.

### Volumen cognitivo

Representa en 3D señales y relaciones derivadas de la actividad disponible.

- Pocos nodos significan que hay poca evidencia o actividad registrada.
- Más nodos no significa automáticamente más inteligencia.
- Los colores ayudan a distinguir rutas, memoria y estado afectivo.
- Girar, mover o acercar la vista sólo modifica la cámara visual; no cambia a Alice.

El volumen no es un cerebro biológico ni una prueba de conciencia. Es una
visualización auditable de datos reales que el sistema conoce.

### Flujo cognitivo

Muestra cómo una señal pasa por entrada, lenguaje, memoria, estado, inhibición,
espacio de trabajo y posibles salidas. Sirve para responder: **¿por dónde pasó esta
información?**

### Estado y controles

Presenta memoria, afecto, impulsos y controles de comportamiento. Los valores son
estado computacional observable; no deben interpretarse como emociones humanas
auténticas. Usalo para detectar cambios y anomalías, no para forzar una personalidad
sin evidencia.

### Planificador

Expone intención, emoción, utilidad, riesgo, novedad y una respuesta o acción
seleccionada cuando existe. Actualmente es principalmente descriptivo:

- no concede permisos;
- no ejecuta una acción por sí solo;
- no reemplaza la autorización del propietario.

Debajo aparece **R7 · Recordatorios e intenciones temporales**, un bloque separado de
control del propietario. Para preparar un recordatorio único:

1. escribí un título concreto y elegí la fecha y hora local;
2. pulsá **Preparar vista previa**; esto todavía no guarda nada;
3. releé operación, título, hora, identidad, alcance, respaldo y que la ejecución
   figure **APAGADA**;
4. marcá la casilla de revisión y recién entonces pulsá **Confirmar programación**.

El registro inferior muestra sólo tareas reales. **Preparar cancelación** tampoco
cambia nada hasta completar la misma revisión y confirmación.

**Sentido temporal R7.3-A** puede comparar el reloj con esas tareas. Empieza
**APAGADO** cada vez que se abre Alice. **Activar reloj interno** inicia sólo la
evaluación local; muestra futuras, vencidas, excluidas, próximo vencimiento y último
pulso. **Detener evaluación** la apaga por completo. Esta función no notifica, no
marca tareas como completadas, no registra intentos y no ejecuta acciones.

Cuando un recordatorio figura como **VENCIDO**, el flujo de aviso sigue siendo
manual y tiene dos pasos deliberados:

1. pulsá **Reservar despacho** y aceptá la confirmación para crear una reserva
   durable; reservar todavía no muestra una notificación;
2. en esa reserva pulsá **Entregar aviso local**, releé la advertencia y confirmá.

**ACEPTADO POR WINDOWS** significa que el sistema operativo recibió el aviso, no que
la persona necesariamente lo leyó. **FALLO TERMINAL** no se reintenta solo. Si aparece
**ENTREGA INCIERTA**, Alice se cerró después de iniciar la operación y bloqueó otra
entrega para no duplicarla. El reloj no despacha avisos automáticamente y reinicia
apagado.

### Memoria

Administra el ciclo de vida de los recuerdos. Debido a su importancia, está
explicada completa en la sección 5.

### Actividad

Reúne las vistas técnicas de seguimiento:

- **[06] Cognitive Timeline:** orden temporal de eventos cognitivos.
- **[07] Event Stream / Command Console:** registro técnico de señales y comandos.
- **[08] Native Audit R3:** evidencia de operaciones sensibles sin copiar contenido
  privado ni secretos.
- **[09] Passive Diagnostic:** diagnóstico de solo lectura.

Consultá Actividad cuando un botón parezca no responder, una vista no se actualice
o quieras comprobar qué operación ocurrió realmente.

## 5. Memoria: qué significa cada pestaña

La memoria de Alice no es un formulario para llenar datos. Es un sistema de ciclo de
vida: una experiencia puede permanecer activa, perder accesibilidad, entrar en
conflicto, corregirse, archivarse o eliminarse bajo control.

### 5.1 Recuerdos

Lista el contenido que existe en la memoria canónica y su estado.

- Un recuerdo **confirmado** se considera vigente.
- Un recuerdo **en conflicto** necesita revisión y queda fuera del RAG para no
  contaminar respuestas.
- Un fragmento **legacy**, sin evaluación o sin estado durable puede mostrar
  **Descartar**. Esa acción lo quita con respaldo porque nunca completó el gobierno
  de memoria.
- Un recuerdo durable y versionado no se borra directamente: debe seguir archivo,
  espera de seguridad y confirmación final.

### 5.2 Trabajo RAM

Contiene información temporal de la sesión. Sirve para sostener una conversación
sin convertir cada frase en recuerdo permanente.

- Puede caducar o limpiarse.
- Limpiar RAM no elimina recuerdos durables.
- RAM no significa memoria física del equipo reservada permanentemente; es el
  espacio de trabajo temporal de Alice.
- Limpiar RAM ya no elimina el historial local de conversación.

### 5.3 Perfil

Muestra hechos del propietario importados desde fuentes verificadas, como los
perfiles preparados con Gemini y Claude.

- Es información privada.
- Que una afirmación haya sido redactada por otro modelo no la vuelve falsa si vos
  confirmás que describe hechos reales.
- La procedencia debe conservarse para distinguir tu confirmación del redactor del
  documento.

### 5.4 Capas R6

Construye una vista derivada para recuperar recuerdos sin copiar el contenido en un
segundo almacén. Es un índice, no otra memoria.

Estados habituales:

| Estado | Significado | Qué hacer |
|---|---|---|
| **Lista / ready** | La vista previa se pudo construir. | Revisarla antes de activar. |
| **Activa / active** | Esa revisión es la que usa la recuperación. | No hace falta actuar. |
| **Fuente modificada / sourceChanged** | Cambió `records.json` después de crear la revisión. | Actualizar la vista previa y revisar la nueva versión. |
| **Revertida / rolledBack** | Se volvió a una revisión anterior autorizada. | Comprobar la revisión activa. |
| **Bloqueada / blocked** | Una validación de seguridad impidió continuar. | Leer el mensaje y revisar Actividad. |
| **No disponible / unavailable** | El backend o la función no está accesible. | Verificar que usás la app de escritorio y no sólo el navegador. |

**Actualizar vista previa** sólo calcula y muestra el resultado. **Activar** cambia
la revisión derivada que consulta Alice, pero no reescribe el contenido de
`records.json`.

### 5.5 Ciclo

Sirve para decidir qué ocurre con cada recuerdo a lo largo del tiempo.

- **Vigencia:** confirmado o en conflicto.
- **Accesibilidad:** accesible o dormido.
- **Supresión:** reversible; reduce acceso sin borrar.
- **Archivo:** reversible; retira el recuerdo del uso normal.
- **Reconsolidación:** crea una corrección trazable sin fingir que el dato anterior
  nunca existió.

Estas dimensiones son independientes. Por ejemplo, un recuerdo puede ser verdadero
pero estar dormido, o ser accesible pero estar en conflicto y por eso bloqueado para
RAG.

### 5.6 Consolidar

Busca duplicados exactos y pares que merecen revisión. La vista previa no fusiona
nada automáticamente. Mientras la interfaz indique **FUSIÓN NO DISPONIBLE**, no se
debe interpretar el análisis como autorización para cambiar la memoria canónica.

### 5.7 Respaldo

Permite abrir la carpeta de memoria, exportar o restaurar datos. Antes de una
operación importante, conservá un respaldo fuera del disco principal.

No edites manualmente los JSON mientras Alice esté abierta. Si la recuperación
requiere intervención, cerrá la aplicación y seguí el runbook de memoria enlazado al
final de este manual.

## 6. Cómo decidir qué hacer con un recuerdo

Usá esta guía antes de pulsar una acción:

| Situación real | Acción adecuada |
|---|---|
| La información es verdadera y sigue vigente. | **Confirmar** o mantener confirmada. |
| Es verdadera pero está incompleta o necesita corrección. | Marcar **conflicto** y luego **reconsolidar** con evidencia. |
| No es útil ahora, pero puede serlo después. | Poner **dormida** o aplicar **supresión** reversible. |
| Ya no debe participar normalmente. | **Archivar**. |
| Es un fragmento inconcluso creado antes del gobierno durable. | **Descartar fragmento**, si la interfaz ofrece esa opción. |
| Es un recuerdo durable que querés eliminar definitivamente. | Archivar, esperar 7 días, revisar la vista previa y confirmar la eliminación exacta. |
| El modelo local propuso evidencia que no aparece literalmente. | No confirmar automáticamente; revisá el recuerdo y aportá tu confirmación humana. |

### Por qué existe una espera de 7 días

La eliminación durable es difícil de deshacer. El período de espera evita que un
clic accidental, un error de modelo o una decisión momentánea destruya información
que después resulte necesaria. El descarte de fragmentos legacy es distinto porque
esos fragmentos nunca ingresaron al ciclo durable completo.

## 7. Embodiment Core

### Rostro

Agrupa señales y diagnósticos destinados a expresiones faciales. Las Meta Quest Pro
no son obligatorias para seguir desarrollando Alice; cámara, estimación facial por
software y futuras alternativas pueden aportar señales limitadas.

### Cuerpo

Muestra el puente corporal, animaciones y estados de movimiento. Las transiciones de
la máquina corporal —reposo, caminar, sentarse, levantarse y otras animaciones
incorporadas— son habilidades motoras, no decisiones autónomas.

### Avatar

Carga el VRM privado de Alice y permite comprobar animaciones y mando.

- El test técnico de 10 segundos prueba el movimiento disponible.
- El gamepad puede dirigir el avatar cuando el enlace está activo.
- Voz, cámara, emociones, mocap y órdenes cognitivas sólo deben considerarse activas
  cuando la interfaz y la auditoría lo confirmen.

El archivo del avatar es privado y está excluido de Git.

## 8. Governance Core

### Capacidades y permisos

Es el registro de lo que Alice puede, no puede o todavía planea hacer. También separa
los puentes de cara y cuerpo. Que una capacidad aparezca en la lista no significa
que esté habilitada.

### Auditoría y diagnóstico

Permite comprobar operaciones sensibles y problemas técnicos. La auditoría guarda
metadatos y huellas, no el contenido de las conversaciones ni claves secretas. El
diagnóstico es de solo lectura.

### Taller

Prepara borradores de habilidades bajo el contrato R4. Un borrador puede simularse,
revisarse y aprobarse, pero **aprobar no equivale a ejecutar**.

### Procedimientos

Reúne patrones observados bajo el contrato R5. Podés conservarlos o descartarlos y
convertir evidencia retenida en un borrador de habilidad. Nunca ejecuta el patrón
automáticamente.

### Configuración

Centraliza proveedor, modelo, privacidad y hardware. Los enlaces de cámara,
micrófono u otros dispositivos deben permanecer apagados de forma segura cuando no
existen, no están autorizados o no se están usando.

## 9. Problemas frecuentes

### Pulsé un botón y no veo nada

1. Esperá unos segundos si Ollama está procesando.
2. Leé el mensaje situado debajo o junto al botón.
3. Entrá en **Actividad** y revisá Timeline, Event Stream y Diagnóstico.
4. Confirmá que usás la aplicación de escritorio. Algunas funciones nativas no
   existen en una pestaña de navegador aislada.
5. Si el problema continúa, anotá la página, el botón y el texto exacto del error.

### La vista previa de Capas R6 dice que la fuente cambió

No es necesariamente un error. Ocurre después de confirmar, corregir, archivar o
descartar recuerdos. Pulsá **Actualizar vista previa**, revisá el resultado actual y
activá la nueva revisión sólo si coincide con el estado que esperabas.

### Alice pierde rápido el contexto

El historial de conversación, la RAM y la memoria R6 son cosas diferentes. Un
modelo local pequeño puede olvidar partes del diálogo aunque el historial esté
guardado, porque cada consulta recibe un contexto limitado. Revisá:

- qué contexto autorizaste en la vista previa;
- si los recuerdos útiles están confirmados y accesibles;
- si el modelo configurado cabe correctamente en la memoria disponible;
- si marcaste la utilidad de los recuerdos recuperados.

El historial completo se conserva para continuidad y trazabilidad, pero no se
inyecta entero ni se indexa automáticamente como recuerdo. Convertir cada frase en
RAG sí generaría ruido y empeoraría la recuperación.

### El volumen cognitivo tiene poca actividad

Eso es normal mientras hay pocos eventos, recuerdos y rutas reales. No se deben
inventar nodos para que parezca vivo. La actividad crecerá cuando existan
conversaciones, percepciones autorizadas, evaluaciones de memoria, decisiones y
acciones reales registradas.

### El lanzador informa puerto ocupado o instancia existente

Cerrá la ventana anterior de Alice y su terminal. Si no sabés qué proceso sigue
activo, ejecutá primero `Iniciar Alice Continuum.cmd --check` y no finalices procesos al azar.

## 10. Datos, respaldo y privacidad

Los datos operativos están bajo:

```text
E:\Alice Cognitive Core\data
E:\Alice Cognitive Core\data\memory
```

Reglas de seguridad:

1. No borres `E:\Proyecto P` hasta completar y verificar el respaldo externo.
2. No edites la memoria canónica con Alice abierta.
3. No subas el avatar, claves de API, conversaciones privadas ni perfiles del
   propietario a Git.
4. Antes de restaurar, exportar o borrar de forma permanente, verificá la ruta
   completa y conservá un respaldo.
5. Los cambios de interfaz no deben alterar recuerdos por accidente.

## 11. Glosario breve

| Término | Explicación simple |
|---|---|
| **RAG** | Busca recuerdos relevantes y los aporta al modelo para responder. |
| **Ollama** | Servicio local que ejecuta el modelo de lenguaje en la notebook. |
| **R1–R6** | Contratos técnicos internos; identifican etapas y garantías, no modos que debas dominar. |
| **Huella / SHA-256** | Identificador que permite comprobar que un archivo no cambió. |
| **Memoria canónica** | Fuente principal y autorizada de recuerdos. |
| **Vista derivada** | Índice calculado desde la fuente; puede regenerarse y no reemplaza el contenido. |
| **Reconsolidación** | Corrección trazable de un recuerdo existente. |
| **Supresión** | Reducción reversible de acceso a un recuerdo. |
| **Archivo** | Retiro reversible del uso normal. |
| **Auditoría** | Evidencia técnica de qué operación ocurrió y cuándo. |

## 12. Compromiso para futuros cambios

Cuando Codex u otro agente agregue una función visible debe dejar claro:

1. qué problema resuelve;
2. dónde aparece;
3. qué cambia realmente;
4. qué no cambia;
5. si usa red, cámara, micrófono, archivos o memoria;
6. cómo se prueba de forma real;
7. cómo se revierte o recupera;
8. qué sección de este manual se actualizó.

Un código como **R6.3-F** puede aparecer como referencia de auditoría, pero nunca
debe ser la única explicación ofrecida al propietario.

## 13. Leer un documento sin guardarlo como recuerdo

En **Identificación**, buscá **Documento local · Vista previa**:

1. Seleccioná un archivo PDF, MD o TXT de hasta 16 MiB.
2. Pulsá **Autorizar lectura y ver texto**.
3. Abrí los fragmentos para ver el texto y su página. Un PDF escaneado puede no
   contener texto extraíble: este lector todavía no realiza OCR.
4. **Descartar vista previa** quita el contenido de esa vista. El original no cambia.

La lectura es local: no llama a Ollama ni a servicios externos, no enseña hechos
a Alice y no adjunta el documento al chat. Su finalidad actual es comprobar la
extracción y procedencia antes de integrar conocimiento. Sólo se registra la huella
del archivo y el resultado en auditoría, no su texto ni su nombre.

Si falta el entorno documental, seguí la [preparación del lector](../scripts/adapters/README.md).
No hace falta cambiar el Python principal. Después de actualizar el backend,
cerrá y volvé a iniciar Alice para cargar los nuevos comandos.

## 14. Relacionar dos experiencias

En el volumen, el tamaño de cada recuerdo depende de su importancia registrada
(1–5). Un recuerdo sin evaluación permanece pequeño. Recuperarlo modifica el
brillo, sin aumentar su tamaño duradero. La perspectiva y el zoom también afectan
el tamaño aparente. Esta importancia todavía no es una evaluación de impacto
emocional: los colores actuales corresponden a categorías de memoria hasta que
se conecte el sistema afectivo. El tamaño no modifica conservación ni eliminación.

El observatorio centra la red al abrir. **Buscar un recuerdo o proceso** despliega
el selector **Explorar un nodo**, para seleccionarlo también con teclado. La ficha
aparece sólo al seleccionar y **Cerrar ficha** devuelve toda la vista a la red.
**Fuente y detalles técnicos** despliega versión, fuente y estado del recuerdo.
Las prolongaciones cortas de las células son parte del dibujo: no representan
asociaciones ni agregan nodos. La órbita
automática comienza pausada y se activa desde su botón. La paleta emocional
identifica los canales. Los recuerdos nuevos con una asociación confirmada usan
su color o una mezcla ponderada; los demás quedan sin evaluación. Las líneas
de asociaciones conservadas no emiten pulsos de actividad por el solo hecho de existir.

En **Flujo cognitivo → Relaciones entre recuerdos**:

1. Elegí dos experiencias distintas. Sólo aparecen episodios recuperables.
2. Abrí **Leer entrada original** y copiá una cita literal de cada entrada.
3. Pulsá **Revisar relación**. Se comprueba que ambas citas existen en sus fuentes actuales.
4. Revisá las citas y pulsá **Confirmar y guardar relación** sólo si, a tu criterio,
   esas experiencias están relacionadas. No afirma causalidad ni una verdad nueva.
5. **Retirar relación** deja de usarla sin borrar recuerdos. **Restaurar relación**
   vuelve a habilitarla si sus fuentes siguen vigentes. Ambas piden confirmación.

**Actualizar relaciones** vuelve a comprobar la vigencia. Si cambiaste una fuente,
la relación puede figurar no vigente; no se enlaza silenciosamente con su nueva
versión. Revisá y proponé una nueva relación si sigue teniendo sentido.

El historial se guarda localmente en `memory/associations-v1/`, separado de los
recuerdos. No se envía a modelos. Una relación activa cuyas dos fuentes sigan
vigentes se dibuja en violeta en el volumen; una relación retirada o inválida no.

## 15. Documentación de apoyo

- [Arranque local](runbooks/01-arranque-local.md)
- [Operación y recuperación de memoria](runbooks/02-operar-memoria.md)
- [README y estado técnico del proyecto](../README.md)

Si la interfaz contradice este manual, detené la operación sensible y registrá la
diferencia. El manual y la pantalla deben corregirse juntos antes de continuar.
# Gemma local: selección manual

En la versión recompilada, Configuración permite iniciar/apagar Gemma. Iniciarlo también lo selecciona como proveedor de conversación; apagarlo vuelve a seleccionar Ollama, sin cargar Qwen. Si Ollama conserva otro modelo, el arranque se rechaza para evitar dos modelos residentes; esperá a que esa sesión termine antes de continuar.

Después de iniciar Gemma, seleccioná **Gemma local · llama.cpp**, volvé a Conversación y usá la revisión de contexto habitual. Para volver a Ollama, apagá Gemma primero. El micrófono no se activa con estos controles; el turno de voz integrado todavía está pendiente. **Proponer recuerdo de este intercambio** usa Gemma local y analiza solamente el mensaje del propietario; la observación de pantalla y los candidatos heredados siguen usando Ollama y permanecen bloqueados mientras Gemma está activo.

Detalles y límites: [Gemma en Configuración y conversación](testing/GEMMA_SETTINGS_CHAT_2026-09-05.md).
