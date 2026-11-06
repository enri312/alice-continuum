# Manual de uso de Alice Continuum

**Actualización de interfaz y conversación:** 4 de noviembre de 2026; los apartados históricos conservan sus alcances documentados.  
**Dirigido a:** Carlos Nuñez, propietario y operador de Alice  
**Carpeta canónica:** `E:\Alice Cognitive Core`

Este manual explica **qué hace cada parte visible**, cuándo conviene usarla y qué
consecuencias tiene cada acción. No hace falta conocer TypeScript, Rust ni los
códigos internos R1–R6 para operar Alice.

> **Regla principal:** iniciar una sesión de voz autoriza sus turnos y respuestas
> Fish hasta detenerla. Los recuerdos nuevos y las acciones conservan sus
> operaciones específicas. Las pantallas
> técnicas muestran actividad o preparan decisiones; no son prueba de conciencia.

### Aprender conversando

El aprendizaje automático está activado para las nuevas conversaciones con Gemma.
Después de responder, Alice decide si tu mensaje contiene algo útil para conservar.
No guarda cada saludo ni necesita que confirmes cada recuerdo. El indicador del
chat muestra si está evaluando y cuántos recuerdos automáticos conserva.

En **Memoria → Lo que Alice decide conservar** podés leer la cita original,
corregir el contenido, **Retirar del contexto** o **Volver a usar**. Retirar impide
su recuperación sin destruirlo. La casilla **Aprendizaje automático** pausa o
reanuda nuevas selecciones. **Recuerdos activos** en Conversación controla la
lectura RAG por separado y comienza activada.

El Volumen muestra los recuerdos nuevos como nodos orgánicos. El contorno cerebral
es ilustrativo. Verde significa que dos recuerdos provienen del mismo intercambio;
violeta identifica asociaciones confirmadas. Seleccionar un nodo abre su contenido
y procedencia. Guardar información no entrena los pesos de Gemma.

## 1. Inicio rápido

1. Abrí `E:\Alice Cognitive Core`.
2. Hacé doble clic en **Iniciar Alice Continuum.cmd**.
3. Dejá abierta la terminal negra mientras uses Alice.
4. Esperá a que se abra la ventana de la aplicación.
5. Entrá en **Configuración** para comprobar el proveedor de conversación.
6. Volvé a **Conversación** para conversar.

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
con **Configuración**, **Conversación**, **Memoria** cuando haya algo que
revisar y **Actividad** si querés comprobar qué ocurrió.

## 3. Conversación escrita con revisión

Para conversar hablando sin confirmar cada turno, usá **Iniciar conversación por
voz**, explicado en el apartado siguiente.

1. En **Configuración**, elegí el proveedor y el modelo.
2. En **Conversación**, escribí el mensaje.
3. Pulsá **Revisar mensaje** si usás Ollama o **Ver qué se enviará** si algún
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

La vista previa corresponde al modo escrito/manual. En una sesión de voz,
el inicio autoriza el ciclo y **Detener conversación** lo termina.

### Proveedor recomendado actualmente

- **Gemma 4 local:** modelo principal de conversación y visión. **Iniciar escucha de Alice** prepara el motor antes de solicitar el micrófono.
- **Whisper base local:** transcribe la voz en español por CPU. Gemma conserva la ruta de transcripción anterior si Whisper no está instalado. **Último mensaje atendido** permite revisar el texto reconocido y las demoras; si Fish falla, la respuesta queda en texto y Alice vuelve a escuchar.
- **Ollama local:** ruta alternativa existente; no cargar otro modelo mientras Gemma esté activo.
- **OpenRouter:** permanece desactivado por decisión del propietario.
- **RAG:** aporta recuerdos relevantes al modelo local; no reemplaza la memoria ni
  convierte automáticamente cada conversación en un recuerdo permanente.

Las claves privadas nunca deben escribirse en Conversación, Memoria, archivos del
repositorio ni capturas compartidas.

## 4. Cognitive Core, página por página

### Conversación

Es el espacio principal para leer el historial, escribir y hablar. El historial
aparece arriba y el cuadro de mensaje debajo. El estado indica qué operación
está ocurriendo: micrófono apagado, captura, transcripción, preparación de la
respuesta o reproducción de voz. Abrir el panel de voz no abre el micrófono.

Para hablar sin revisar cada turno, pulsá **Iniciar escucha de Alice**.
Alice prepara Gemma y queda **En espera · di Alice para hablarme**. Detecta una
pausa de un segundo, transcribe localmente y atiende sólo frases dirigidas a ella.
Las otras frases se descartan. Una frase atendida usa Gemma y su respuesta se
envía a Fish; después vuelve a esperar. **Apagar micrófono** termina la escucha.
También termina al salir de la pantalla, cerrar Alice o llegar a dos horas.
El micrófono se apaga mientras transcribe, procesa o habla.

En espera, **«Detén la conversación, Alice»** vuelve a esperar sin responder ni
apagar el micrófono. También reconoce la grafía «Detend» observada en la prueba.
**«Apaga el micrófono, Alice»** o **«Deja de escuchar, Alice»** cierran la sesión.
Durante procesamiento o reproducción, usá el botón: todavía no hay interrupción
por voz. Pausar la conversación no renueva el límite de dos horas.

Para revisar y corregir antes de enviar, abrí **Dictado con revisión manual**.
Ver [el runbook de voz](runbooks/03-conversacion-y-voz.md).

**Audio de entrada · reducción de ruido local** permite elegir el micrófono.
**Actualizar micrófonos** consulta dispositivos sin iniciar una grabación; los
nombres pueden aparecer después de la primera toma. El filtro local funciona
en ambos modos de voz y no requiere otra IA de conversación ni confirmaciones
por turno. Durante su arranque aparece **Preparando micrófono y filtro**.

Incluí «Alice» en cada frase que quieras que atienda, por ejemplo «Alice, abre
Spotify» o «¿Me escuchas, Alice?». Es el comportamiento predeterminado de esta
primera espera dirigida. Las otras frases no entran al chat, herramientas ni Fish.
No identifica quién habla: otra persona que formule una llamada directa puede
activarla. Este filtro posterior a ASR no es un detector acústico de palabra clave.
[Contrato de espera y apagado](decisions/ADR-P-112-espera-por-nombre-y-apagado.md).

El filtro reduce ruido y no identifica tu voz. La eliminación de música de la
notebook depende de la cancelación de eco que confirme el equipo; la música
externa con voces todavía puede interferir. Acercar el micrófono a tu boca o
usar auriculares mejora la relación entre voz y música. Si falla el filtro,
Alice descarta la toma y avisa. [Contrato de audio](decisions/ADR-P-105-supresion-local-ruido-vite.md).

Al pie hay dos accesos opcionales:

- **Diagnóstico de entrada:** muestra palabras, origen y clasificación por reglas
  locales. Capturar o congelar el diagnóstico sólo afecta a esa vista. No pausa
  a Gemma ni detiene el micrófono. Su tiempo de análisis no mide la inferencia.
- **Documentos locales:** abre una vista previa independiente del chat. La lectura
  no adjunta automáticamente el documento al modelo.

#### Control de contexto de la conversación

Las casillas de **Contexto y permisos**, debajo del mensaje, autorizan qué contexto puede recibir el modelo.
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

En **Conversación**, abrí **Documentos locales** para acceder a **Documento local · Vista previa**:

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

Después de iniciar Gemma, seleccioná **Gemma local · llama.cpp**, volvé a Conversación y usá la revisión de contexto habitual. Para volver a Ollama, apagá Gemma primero. El micrófono se activa por separado con Iniciar conversación; los turnos de voz ya están integrados. **Proponer recuerdo de este intercambio** usa Gemma local y analiza solamente el mensaje del propietario; la observación de pantalla y los candidatos heredados siguen usando Ollama y permanecen bloqueados mientras Gemma está activo.

Detalles y límites: [Gemma en Configuración y conversación](testing/GEMMA_SETTINGS_CHAT_2026-09-05.md).

## Ver con Alice: cámara y escritorio

1. Abre **Conversación** usando Gemma local.
2. Pulsa **Activar cámara**. Si Windows pide acceso, concede el permiso para Alice.
   Revisa el selector **Cámara para Alice**: puedes cambiar del celular conectado
   a la cámara integrada de la notebook. **Ver vistas** muestra la imagen.
3. Pulsa **Compartir escritorio** para incluir lo visible en todos tus monitores.
   La miniatura es la captura inicial; cada pregunta toma otra imagen.
4. Escribe o inicia la conversación por voz y pregunta, por ejemplo:
   «Alice, ¿qué objeto tengo frente a la cámara?» o «¿Qué ventana ves en mi pantalla?».
5. Usa **Apagar cámara**, **Dejar de compartir** o **Detener vistas** cuando termines.
   Salir de Conversación también detiene ambas fuentes. No se reactivan al abrir Alice.

La vista se mantiene hasta dos horas y no pide autorización en cada turno. Las
imágenes se procesan localmente con el mismo Gemma; sus respuestas quedan en el
chat normal. El modo de voz conserva el uso autorizado de Fish para leerlas.
No se guardan imágenes como recuerdos. Alice ve capturas, no vídeo continuo:
puede confundirse con detalles pequeños y no puede abrir archivos o ver ventanas
minimizadas. Esta vista todavía no verifica tu identidad ni bloquea a terceros.

Con vistas activas, usa mensajes de hasta 1600 caracteres. Se acorta el contexto
anterior para dejar espacio a las imágenes; si falta un referente, nómbralo en la
pregunta. Si Windows deniega la cámara o otro programa la ocupa, el error aparece
en la tarjeta y la sesión se cierra. Tras recargas de desarrollo debes reactivar
las fuentes. Contrato: [ADR-P-102](decisions/ADR-P-102-vision-conversacional-local.md).

## Abrir Spotify y los discos autorizados

Con Gemma seleccionado, puedes decir en la sesión de voz o escribir:

- «Alice, abre Spotify».
- «Abre el disco E».
- «Abre la unidad D».
- «Alice, me abres la aplicación Spotify en mi equipo» (selección por tool calling).

Pide un destino por vez. Las órdenes simples evitan una inferencia adicional;
las frases naturales reconocidas requieren Gemma iniciado. En texto se conserva
la revisión manual del mensaje; en la sesión de voz la apertura no pide otra
confirmación. Windows recibe la orden de apertura; Alice no confirma que la
ventana esté visible sin observarla. La reproducción musical se amplía en la
sección siguiente; siguen sin habilitarse consola, otras unidades o archivos
arbitrarios.

En Volumen, «Núcleo en ejecución» pulsa mientras responde el proceso nativo. El
arranque real también ilumina Contexto. Ese latido es distinto de las señales de
conversación o aprendizaje: no aumenta la cantidad de recuerdos ni inventa rutas.
Ver [ADR-P-103](decisions/ADR-P-103-actividad-y-herramientas-delegadas.md).

## Música: Tus me gusta y YouTube en Chrome

Puedes escribir o decir durante la sesión de voz:

- «Alice, reproduce mis me gusta»: abre Spotify y reproduce **Tus me gusta**.
- «Abre Spotify y reproduce mi música» o «abres Spotify y reproduces mi playlist»:
  abre y reproduce esa misma colección. También admite repeticiones de voz como
  «abre abre» y «mi mi música».
- «Pausa Spotify» y «Continúa Spotify»: pausa y reanuda su reproducción.
- «Reproduce [canción] de [artista] en YouTube»: busca y reproduce en Google Chrome.
- «Pausa YouTube» y «Continúa YouTube»: controla el vídeo identificable de YouTube.
- «Abre YouTube»: abre su inicio; tú eliges después la canción.

Después de una apertura o reproducción correcta también puedes decir «reproduce»,
«pausa» o «continúa» para el último servicio controlado por Alice. Tras reiniciar
nombra Spotify o YouTube. Spotify utiliza tu colección Tus me gusta; todavía no
admite elegir otras playlists por nombre.

«Mi música» y «mi playlist» significan **Tus me gusta**, según tu elección para
este proyecto. No necesitas memorizar una única frase exacta. Si una orden queda
incompleta, Alice indica que no la ejecutó y muestra ejemplos. Decir sólo
«Spotify» no ejecuta una acción pendiente del historial. Una promesa generada
por el modelo no cuenta como comprobación de reproducción.

Si Spotify estaba cerrado puede tardar en cargar o actualizarse: Alice espera
hasta un minuto para encontrar el reproductor. Con Spotify abierto, el límite
es de 18 segundos; normalmente termina antes. Si aparece un error de espera,
deja que Spotify termine de iniciar y vuelve a pedir la reproducción.

Para pausa y continuación Alice consulta primero el control multimedia de
Windows. Si no está disponible, utiliza los botones del reproductor de Spotify
y comprueba el resultado; puede restaurar su ventana si estaba minimizada.

No se pide otra autorización por cada control musical. Las órdenes sencillas
evitan inferencia; variantes como «¿Puedes reproducir mis me gusta en Spotify?»
usan tool calling de Gemma con validación nativa. Se mantiene la revisión manual
del mensaje escrito y la continuidad de la sesión de voz ya iniciada.

Debes tener Spotify con tu cuenta y Google Chrome disponibles. Si YouTube pide
iniciar sesión, muestra un consentimiento o impide comprobar el reproductor,
Alice comunica el fallo. Tampoco afirma éxito ante ventanas ambiguas. No cambies
de ventana durante la selección del vídeo. La reproducción de Spotify se probó
con Tus me gusta; la primera prueba real de YouTube queda para tu canción.

Contrato y verificación: [ADR-P-104](decisions/ADR-P-104-musica-spotify-youtube-chrome.md)
e [informe de música](testing/MEDIA_PLAYBACK_REPORT_2026-11-03.md).
