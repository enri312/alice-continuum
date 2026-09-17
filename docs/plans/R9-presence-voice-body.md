# R9 — Presencia, voz y cuerpo mediante puentes

Inicio de diseño: 2026-09-12  
Estado: R9.1 definido; no hay adaptadores nuevos activos.

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
