# R9 — Presencia, voz y cuerpo mediante puentes

Inicio de diseño: 2026-09-12  
Actualización: 2026-11-04. Sesión automática de voz implementada: una acción de
inicio, detección de pausas, transcripción Whisper local y respuesta Fish sin confirmar
cada turno. El micrófono vuelve a escuchar al terminar la reproducción. Se
mantiene el modo manual y queda pendiente aceptación acústica y de latencia con
el propietario. Gemma 4 se mantiene; el avatar queda al final. Node 26.13.0 LTS
y npm 11.20.0 verificados. Ver [ADR-P-099](../decisions/ADR-P-099-sesion-de-voz-y-node-26.md).

Incremento posterior: orden directa **Detén la conversación, Alice** durante
escucha, interpretación de referentes y Rust 1.99.1. Ver
[ADR-P-100](../decisions/ADR-P-100-referentes-parada-de-voz-rust.md).

Incremento vigente — [ADR-P-106](../decisions/ADR-P-106-estabilizacion-oral-y-rumbo-nerumi.md):
Whisper base CPU reconoce el español y Gemma mantiene el diálogo. Se comprueba
el ciclo nativo de dos respuestas y parada con audio sintético; se rechazan
respuestas tardías después de detener y se conserva el texto si falla Fish.
El detalle **Último mensaje atendido** muestra transcripción y tiempos reales.
Aceptación con Carlos y música real pendiente. La activación dedicada por nombre
y la interrupción durante reproducción requieren trabajo posterior. La prioridad
es conversación y acciones de PC ya delegadas, sin domótica; Nerumi queda como
referencia futura y el avatar sigue al final. Ver
[el informe](../testing/CONVERSATION_SESSION_REPORT_2026-11-04.md).

> El contrato inicial que sigue se conserva como antecedente. En la sesión de
> voz vigente, iniciar autoriza el ciclo hasta detener, salir o vencer a las dos
> horas. La confirmación de cada texto sólo corresponde al modo manual. El
> diálogo de la sesión mantiene el hilo; el historial anterior y los recuerdos
> dependen de sus casillas. No se habilitan herramientas ni memoria confirmada.

Incremento 2026-11-05: preguntas sobre «tu explicación/voz…» en una cita con
destinatario explícito disponen de una resolución local acotada, con procedencia
visible y sin inferencia adicional. Los casos sin cobertura continúan en Gemma.
Persisten errores con pronombres ambiguos y continuidad; no se da por aceptada
la conversación real. [ADR-P-110](../decisions/ADR-P-110-referencias-explicitas-en-citas.md).

## Alcance activo: Alice antes de conectar un cuerpo

Aclaración del propietario, 2026-11-04: el avatar es un cuerpo de salida para
manifestar expresiones y movimiento. Su integración se hará después de que la
asistente funcione correctamente. El avance y el cierre del alcance activo de
R9 se evaluarán por conversación, escucha, voz, percepción y acciones delegadas;
la ausencia de cuerpo no reduce ese avance ni bloquea su aceptación.

Criterios pendientes para este alcance:

- [ ] Mantener cinco turnos reales con Carlos, incluida una corrección de referente
  entre Alice, Carlos y terceros, sin perder el tema.
- [ ] Aceptar la escucha sin música, con música de la notebook y de otro equipo;
  revisar transcripción y errores reales en cada condición.
- [ ] Medir y mejorar la espera hasta responder y la naturalidad de la salida oral.
- [ ] Incorporar y comprobar activación dedicada por nombre e interrupción de la
  respuesta hablada con control de eco y parada efectiva.
- [ ] Aceptar las acciones ya delegadas, incluida reproducción real de YouTube,
  sin anunciar ejecución o éxito cuando no se haya comprobado.
- [ ] Aceptar cámara y escritorio por turno en uso real, con parada e indicadores
  coherentes y continuidad del diálogo cuando una fuente no esté disponible.

La base de estos componentes ya existe; una casilla pendiente indica que todavía
falta completar o aceptar su comportamiento cotidiano. La integración del cuerpo
(expresiones, sincronización labial, mirada y movimiento) se conserva como trabajo
posterior. Los porcentajes anteriores que mezclaban ambos alcances no sirven
para medir esta entrega. La compatibilidad con Ubuntu 26.04.1 se verifica aparte.

## Propósito

R9 conecta formas de presencia de Alice sin convertir el avatar en una fuente de
decisión, ni una señal de entrada en un recuerdo. La conversación y la memoria
continúan siendo sistemas locales y utilizables aunque ningún puente de R9 esté
disponible.

La fase no afirma conciencia, emoción real ni percepción permanente. La actividad
visual, las expresiones y la voz son representaciones trazables de datos y reglas
autorizadas.

## Fronteras aprobadas

| Puente | Dirección | Estado al iniciar R9 | Qué no autoriza |
|---|---|---|---|
| Turno de voz local | micrófono → texto revisable | piloto aislado comprobado | enviar, recordar o ejecutar automáticamente el texto |
| Salida de conversación | respuesta local → interfaz de Alice | existente | enviar la respuesta a otra aplicación o sintetizarla |
| TTS | texto aprobado → proveedor de voz → reproducción local | planificado | abrir micrófono, guardar audio, clonar voz o controlar el avatar |
| Expresión VRM | estado de presentación → pesos del avatar | planificado | inferir emoción, leer cámara o crear recuerdos |
| Mirada/cuerpo | intención aprobada → pose o animación | planificado | decidir objetivos o transformar telemetría en aprendizaje |
| Entrada facial/corporal | sensor autorizado → señal efímera | planificado | identificar personas, almacenar biometría o controlar el avatar sin filtro |

`output.text.external` permanece fuera de R9.1: mostrar una respuesta dentro de
Alice no es entregar texto a otra aplicación. Cualquier destino externo necesita
su propia vista previa, capacidad R1, permiso y auditoría.

## R9.1 — Contrato de voz y presencia

### Regla de separación

Cada intervención posee una sola dirección y un único responsable:

```text
captura local -> transcripción revisable -> mensaje de conversación
respuesta de conversación -> texto visible -> previsualización TTS -> audio local
estado de presentación -> expresión/animación VRM
sensor facial autorizado -> derivación efímera -> propuesta de expresión VRM
```

No se permite atajo entre filas. En especial, la transcripción no inicia TTS, el
audio no genera memoria, el modelo no decide reproducir una respuesta y una
expresión no declara el estado emocional actual de Alice.

### Contrato propuesto para `output.voice.synthesize`

La futura solicitud de voz será un objeto efímero, creado sólo desde una respuesta
que ya esté visible en la conversación. Debe contener como mínimo:

| Campo | Regla |
|---|---|
| `requestId` | UUID por intento; nunca se reutiliza tras cancelar o fallar. |
| `conversationTurnId` | referencia local a la respuesta ya mostrada; no es memoria. |
| `textDigest` | SHA-256 del texto exacto que el propietario verá antes de enviar. |
| `characterCount` | límite validado antes de contactar al proveedor. |
| `provider` | identificador explícito; inicialmente `fish-audio` sólo si se adopta tras su prueba. |
| `voiceProfileId` | identificador opaco elegido por el propietario; no contiene clave ni voz clonada. |
| `consent` | confirmación visible, específica para ese texto y anulable antes del envío. |
| `retention` | por defecto `ephemeral`; el audio se descarta al terminar o cancelar. |
| `audit` | metadatos R3 sin texto, audio, clave ni identificador biométrico. |

Antes de una llamada externa la interfaz debe mostrar proveedor, texto exacto,
cantidad de caracteres, política de descarte y un control **Cancelar**. El botón
de reproducción local no autoriza volver a enviar texto ni guardarlo. La clave se
obtendrá únicamente de una variable de entorno en el proceso nativo; no se leerá
desde documentos, React, memoria, auditoría ni repositorio.

Fish Audio se usa mediante un puente nativo pequeño y aislado. La clave se lee
sólo como presencia y en el momento de la solicitud desde `FISH_API_KEY`; la
identidad elegida se obtiene de `ALICE_FISH_REFERENCE_ID`. Ninguno de los dos
valores se copia a React, memoria, auditoría, documentos ni Git. El endpoint se
invoca únicamente al confirmar una vista previa vigente, con el modelo gratuito
`s2.1-pro-free`; su resultado MP3 vive sólo en memoria del proceso y se descarta
al cerrar el reproductor o iniciar otra vista previa.

La identidad de presentación aprobada para seleccionar la futura voz es femenino,
español latino neutro, joven-adulto, claro, sereno y técnico-cercano. Se evaluará
por escucha comparativa, no por nombre de catálogo. Ver
[identidad de voz de Alice](../architecture/ALICE_VOICE_IDENTITY_R9.md).
La primera terna pública fue investigada sin usar la API. La candidata inicial fue
descartada por Carlos al oírla, por lo que ninguna voz comunitaria queda adoptada.
Voice Design se reserva como alternativa futura porque no está incluido en su plan
gratuito. R9.2 continuará con una búsqueda y audición controlada de voces públicas
sin clonación, franquicias ni suscripción. Ver la
[ruta gratuita de selección](../architecture/ALICE_ORIGINAL_VOICE_DESIGN_R9.md) y
la [terna inicial descartada](../research/ALICE_FISH_VOICE_SHORTLIST_2026-09-12.md).

### Estados visibles comunes

Todo puente de R9 debe exponer uno de estos estados, sin sustituirlos por un
mensaje genérico:

| Estado | Significado visible |
|---|---|
| `idle` | no se está usando el puente. |
| `preview` | hay una acción preparada, pero nada se ejecutó ni salió del equipo. |
| `authorizing` | el propietario está tomando la decisión explícita. |
| `active` | existe una operación real en curso; debe indicar cómo detenerla. |
| `complete` | terminó y se aplicó la política de descarte. |
| `no-signal` | la fuente no produjo señal; no es una inferencia ni un error de Alice. |
| `denied` | permiso o autorización no concedidos. |
| `cancelled` | el propietario o la parada canceló la operación. |
| `error` | falló la operación; debe mostrar una causa segura y no repetirla sola. |
| `unavailable` | falta runtime, configuración o una capacidad aprobada. |

`active` requiere indicador y parada inmediata. Al cerrar, revocar, vencer un
grant, perder el proveedor o fallar una validación, el estado termina en
`cancelled`, `error` o `unavailable`; nunca se reintenta por sí mismo.

## Orden incremental

### R9.2 — Salida de texto y TTS localmente gobernados

Prechequeo técnico completado sin red desde Alice, clave ni audio: la API pública
publica un endpoint REST con Bearer, modelo en encabezado y precio por bytes. Se
mantiene el proveedor como candidato hasta la prueba manual. Ver
[prechequeo Fish Audio](../research/FISH_AUDIO_R9_PRECHECK_2026-09-12.md).

1. [x] Registrar `output.voice.synthesize` como parcial con adaptador, efectos y
   permiso nativo explícito.
2. [x] Construir vista previa, límite de 1.500 caracteres, cancelación antes del
   envío, auditoría SHA-256 sin contenido y descarte de audio temporal.
3. [x] Probar Fish Audio con una frase no sensible y la voz elegida por Carlos,
   sin crear ni clonar modelos.
4. [x] Reproducir sólo el resultado del intento autorizado. Ninguna conversación
   pasa a voz por defecto.
5. [x] Cubrir por contrato credencial ausente, límite excedido y cancelación
   previa. La cancelación no puede retirar una solicitud que el proveedor ya haya
   recibido; R9.2 no muestra control de parada durante la transferencia para no
   prometer una revocación imposible.
6. [x] Mantener despejado el canal: la interfaz muestra 12 mensajes recientes y
   recupera los anteriores en bloques de 10 sin borrar el historial persistente ni
   promoverlo a memoria.
7. [x] Incorporar una sesión de voz visible y detenible: entrada local por turnos,
   transcripción revisable, interrupción del audio de Alice y cierre explícito de
   la sesión. No se habilitará escucha continua implícita.
8. [x] Exponer observaciones del canal sin conservar contenido: duración de la
   toma, latencia de transcripción, latencia de síntesis y estado de reproducción.
   El MP3 se descarta también al terminar o fallar el reproductor.

### Repaso antes de conectar el VRM

El canal de voz se estabiliza antes de controlar boca, expresión o cuerpo. La
próxima prueba manual debe observar, con tres frases breves y no sensibles:

1. si Gemma conserva palabras comunes, nombres y un término técnico;
2. cuánto tarda en transcribir cada toma y cuánto tarda Fish Audio en sintetizar;
3. si detener, descartar y cerrar impiden que una operación atrasada reaparezca;
4. si el chat permanece legible tras varios turnos;
5. si al finalizar la voz el reproductor desaparece y no queda archivo de audio.

Sólo después de esa aceptación se diseñará un modo de conversación por voz. Ese
modo podrá reducir pasos, pero deberá seguir mostrando micrófono, proveedor y una
parada inmediata; no habilitará escucha continua ni recuerdos automáticos. La
sincronización labial del VRM será posterior y consumirá únicamente audio ya
autorizado, sin intervenir en la memoria ni en la decisión cognitiva.

### R9.3 — Presentación VRM desacoplada

1. Partir del catálogo real de 14 presets del VRM; no inventar expresiones.
2. Mapear texto o estados de presentación explícitos a un subconjunto reversible
   de pesos y comprobar cada mapeo visualmente.
3. Mantener expresión, mirada y cuerpo como salidas separadas.
4. Toda lectura facial futura será otra capacidad R2; sólo podrá proponer una
   señal temporal filtrada y jamás operar por acceso implícito a la cámara.

### R9.4 — Cuerpo y entorno controlado

1. Conservar la FSM manual, IK y clips privados como base aislada.
2. Correlacionar intención aprobada, acción, telemetría y resultado antes de
   proponer memoria procedural.
3. Evaluar Active Ragdoll únicamente como respuesta física de una acción ya
   autorizada; no como planificador o decisión cognitiva.
4. La futura sala de observación se inicia/detiene explícitamente y se puede
   reiniciar sin tocar recuerdos aprobados.

## Criterios de R9.1

- [x] Se distingue el piloto de entrada de voz de la futura salida TTS.
- [x] Fish Audio queda sin clave, adaptador activo, llamada de red ni dato privado
  en Git.
- [x] Se define previsualización, autorización, descarte y parada para voz.
- [x] Se separan presentación VRM, sensores y decisión cognitiva.
- [x] Se define un vocabulario visible para ausencia de señal, cancelación y error.
- [x] Se implementa la salida TTS temporal y su contrato de revisión; corresponde
  a R9.2.
- [x] Carlos comprobó manualmente Fish Audio con la identidad elegida y la voz
  quedó operativa sin persistir la clave ni el audio.

## No incluido

- escucha continua, activación por palabra o transcripción en segundo plano;
- envío de texto a aplicaciones externas;
- clonación de voz, perfiles biométricos o persistencia de audio;
- sincronización labial, mirada automática, retarget facial o mocap;
- Active Ragdoll, VRChat, control del sistema o aprendizaje corporal automático.

## Prueba de aceptación de la siguiente entrega

La primera implementación de R9.2 sólo se considerará válida si una respuesta
puede seguir leyéndose cuando TTS no está configurado, y si cancelar la
previsualización o una solicitud no cambia la conversación, la memoria, el VRM ni
el historial de tareas. La auditoría debe permitir reconstruir el intento sin
revelar texto, audio ni secreto.


Incremento 2026-11-03: [ADR-P-101](../decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md)
autoriza memoria automática independiente para nuevos mensajes Gemma. La selección
no necesita aprobación por recuerdo; la configuración global y las correcciones
permanecen en Memoria. El Volumen incorpora formas orgánicas y sólo nodos reales.
Los contratos manuales anteriores siguen siendo antecedentes de sus adaptadores.

Incremento 2026-11-03 — [ADR-P-102](../decisions/ADR-P-102-vision-conversacional-local.md):
visión de cámara y escritorio por turno conectada a conversación Gemma, controles
visibles y dispositivo seleccionable. No cierra R9: la percepción continua, la
identificación del propietario y el avatar siguen fuera de este incremento.

Incremento 2026-11-03 — [ADR-P-103](../decisions/ADR-P-103-actividad-y-herramientas-delegadas.md):
latido técnico desde arranque, coordenadas de procesos dentro del contorno y
aperturas limitadas a Spotify y D:/E:, con función Gemma para variantes naturales.
No incluye ejecución general, control musical o autenticación facial.

Incremento posterior 2026-11-03 — [ADR-P-104](../decisions/ADR-P-104-musica-spotify-youtube-chrome.md):
el propietario amplía la delegación a reproducir Tus me gusta, pausar/reanudar
Spotify y reproducir canciones pedidas en YouTube con Google Chrome. Se verificó
Spotify desde Alice con datos separados y se dejó pausado. YouTube queda
pendiente de aceptación con la canción que el propietario indique. No cierra R9.

Corrección posterior: las órdenes habladas compuestas y sus repeticiones
transcritas deben activar el control nativo. Se evita que una petición musical
incompleta termine en una promesa sin ejecución y se conserva la sesión ante
errores de selección. Ver [regresión](../testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

Aceptación reanudada el 2026-11-04: desde Alice nativa, la transcripción que
fallaba reprodujo Tus me gusta; pausa, continuación y pausa final se completaron
con recibos correctos y datos separados. El HTML v0.54 recupera la portada y
agrupa las notas de avances en su historial. YouTube mantiene pendiente su
canción de aceptación y el avatar continúa pospuesto.

Incremento 2026-11-04 — [ADR-P-105](../decisions/ADR-P-105-supresion-local-ruido-vite.md):
RNNoise local antes de ambas grabaciones, detección de voz en lugar de sólo
volumen, selección de micrófono y filtro opcional de dirección «Alice». Vite
8.3.5 y Vitest 4.1.12. Aceptación con música real de ambos orígenes y separación
de la voz del propietario siguen pendientes; R9 permanece en progreso.
