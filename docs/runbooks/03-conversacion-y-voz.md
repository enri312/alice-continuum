# Operar y evaluar conversación y voz

Actualizado: 2026-11-12. Espera dirigida con reducción local de ruido; calidad conversacional y
aceptación con la voz del propietario todavía en validación.

## Preparación

1. Seguir [arranque local](01-arranque-local.md). Tras cambios nativos, cerrar y
   volver a abrir la aplicación para usar el código recompilado.
2. En Configuración, comprobar el proveedor y modelo seleccionados. Iniciar Gemma
   explícitamente si corresponde; no iniciar otro modelo conversacional a la vez.
3. Si un puerto pertenece a otro proceso, identificarlo antes de actuar. No matar
   procesos ajenos ni adoptar sesiones por coincidencia de puerto.
4. Para Fish se requieren `FISH_API_KEY` y `ALICE_FISH_REFERENCE_ID` en el entorno
   del proceso nativo. No copiar valores a documentación, capturas, pruebas o Git.

## Vista del historial

En **Configuración → Historial visible**, activar o desactivar **Mostrar todo el
historial en el chat**. Desactivado muestra los últimos 12 mensajes. La selección
se mantiene al cambiar de pantalla, pero se reinicia al cerrar la aplicación.
No borra conversaciones, no cambia recuerdos y no amplía el contexto autorizado.
El modo escrito/manual conserva la revisión por envío; la sesión de voz se
autoriza al iniciar.

## Conversación automática por voz (recomendada)

1. Abrir Alice con el lanzador actualizado (Node 26 LTS).
2. En Conversación, pulsar **Iniciar escucha de Alice**. El aviso visible
   explica el procesamiento local y las respuestas enviadas a Fish. Si Windows
   solicita permiso de micrófono, concederlo para poder conversar.
3. Esperar **En espera · di Alice para hablarme**. Incluir «Alice» en cada frase
   dirigida a ella: «Alice, abre Spotify» o «¿Me escuchas, Alice?». Pronunciar el
   nombre y la petición en una sola frase, sin esperar una respuesta tras el nombre.
   El silencio termina el turno: 2 segundos en Voz baja y pausada, o 1 en Normal. También se puede
   pulsar **Terminé de hablar**. El audio se transcribe con Whisper local (Gemma
   como respaldo si no está instalado) y el mensaje se
   procesa sin otras confirmaciones sólo si contiene una llamada directa.
   Las otras frases se descartan, sin chat, herramientas ni Fish. Las respuestas se guardan en el historial
   habitual; no se crean recuerdos confirmados automáticamente.
4. Alice responde con Fish y vuelve a escuchar después de reproducir. El micrófono
   está apagado durante procesamiento y reproducción.
5. Pulsar **Apagar micrófono** para terminar. Salir de la pantalla o cerrar
   Alice también detiene la sesión. Duración máxima: dos horas.

También se puede decir **«Detén la conversación, Alice»** mientras esté en espera.
Al transcribir la orden vuelve a esperar otra llamada, manteniendo la sesión;
reconoce la grafía «Detend» observada en la prueba del propietario. Para cerrar
la captura y revocar la sesión, decir **«Apaga el micrófono, Alice»** o
**«Deja de escuchar, Alice»**. No se generan respuestas ni envíos a Fish para
esas órdenes y no se guardan como mensajes del chat. Una cita como
«¿qué pasa si digo detén la conversación Alice?» no es una orden de parada.
Mientras Alice procesa o habla, usar el botón: todavía no escucha interrupciones.

No se confirma cada turno. El diálogo de la sesión mantiene el hilo; las opciones
de historial anterior y recuerdos se eligen antes de iniciar. Las respuestas de
Alice vuelven como diálogo no factual; la recuperación de recuerdos sigue
separada. Las vistas y acciones delegadas tienen los controles descritos más
abajo. El silencio se rearma sin llamar al modelo. Las frases se limitan a veinte
segundos. La detección combina energía y probabilidad de voz de RNNoise; no usa
sólo volumen. Otras voces o música cantada todavía pueden activar una toma.

La demora de transcripción, generación y Fish sigue existiendo. Esta versión no
implementa streaming de voz ni interrupción hablando mientras Alice reproduce.
Si falla la transcripción o la respuesta, la sesión se detiene. Si falla Fish o
la reproducción, aparece un aviso, se conserva la respuesta en texto y vuelve a
escuchar. No hay reintentos externos automáticos.

Ante una interrupción de planificación del filtro local se descarta la toma
afectada y se prepara otra captura una sola vez por sesión. El aviso pide repetir
la frase cuando vuelva **En espera**. No se repite una orden de música ni se
reenvía la toma parcial a Whisper, Gemma o Fish. Un segundo fallo, un formato
incompatible u otra causa detienen la sesión. Apagar el micrófono cancela también
ese rearme y el límite de dos horas no se renueva.

Abrir **Último mensaje atendido** para comprobar lo que Alice entendió y cuánto
tardó cada etapa. Los tiempos empiezan al terminar la grabación: excluyen tu voz
y la pausa de cierre. El detalle sólo permanece en esta pantalla; las frases
ignoradas por no dirigirse a Alice no se muestran ahí. Este filtro opera sobre
la transcripción; no es un detector acústico dedicado ni verifica quién habla.

Whisper small se evalúa en este equipo junto a base. Para reproducir la instalación,
ejecutar `scripts/testing/install-whisper-local.ps1 -Model small` desde PowerShell. Descarga
únicamente fuentes oficiales y verifica los hashes; no cambia Gemma, Fish, PATH
ni servicios. Si Whisper instalado falla, revisar el error y volver a iniciar;
Alice no cambia silenciosamente de reconocedor. Small instalado tiene prioridad
por defecto; `ALICE_WHISPER_MODEL` selecciona una ruta absoluta explícita y permite
volver a base. El detalle del turno muestra el modelo elegido antes de decodificar
esa toma y la duración de la grabación. Si el habla muy pausada se interpreta
de forma incompleta, usar **Dictado con revisión manual → Hablar con Alice →
Empezar a hablar** y pulsar **Terminé de hablar y transcribir** al terminar.
Ese modo no cierra por silencio y deja el borrador para revisar; no enviarlo
al chat durante el diagnóstico. El botón de la sesión automática conserva el
cierre por silencio, así que no equivale a este dictado manual.
Ver [evaluación de small](../testing/WHISPER_SMALL_REPORT_2026-11-12.md) y
[la validación y los límites](../testing/CONVERSATION_SESSION_REPORT_2026-11-04.md).

## Música y ruido de fondo

**Voz baja y pausada** es el perfil inicial de la página: amplifica localmente
la entrada y da 2 s de silencio antes de cerrar un turno automático. **Normal**
conserva el nivel anterior y 1 s. Elegir el perfil en Audio de entrada con el
micrófono apagado. La selección vale para la página actual; el estado de la
última toma indica qué perfil se preparó. Si el ambiente activa tomas o la voz
satura, volver a Normal. El dictado manual conserva su finalización por botón.

1. Abrir **Audio de entrada**, actualizar la lista y elegir el micrófono cercano
   a la boca. No cambiar dispositivos mientras la captura está activa.
2. Iniciar la escucha y esperar **En espera · di Alice**. El filtro se aplica antes de
   grabar tanto aquí como en el dictado manual. Su estado confirma la preparación
   de la última toma, sin afirmar que el micrófono siga encendido.
3. Probar primero sin música; después con Spotify/YouTube en la notebook y luego
   con música externa al mismo volumen habitual. Probar una frase corta, una
   larga, una pausa breve y la orden de detener. Comprobar palabras y latencia.
4. La dirección explícita se exige por defecto, también en las frases siguientes.
   No verifica identidad: otra voz que se dirija a Alice puede activarla.
5. Si falla el filtro, detener, revisar dispositivo y volver a iniciar. No se
   conmuta a audio crudo de forma silenciosa.

La cancelación de toda la música del sistema sólo se anuncia si WebView2 confirma
ese modo. El filtro no garantiza separación de cantantes o personas. La prueba
de laboratorio no sustituye estos pasos con Carlos. Ver
[ADR-P-105](../decisions/ADR-P-105-supresion-local-ruido-vite.md).

## Aprendizaje automático y RAG

Con Gemma, el backend evalúa nuevos mensajes después de responder y puede guardar
hasta dos citas útiles por turno. La lectura de recuerdos comienza activada. En
Memoria se distinguen las selecciones automáticas de los datos confirmados.
No se usa la respuesta de Alice como evidencia ni se entrenan pesos.

Para excluir un turno puede decirse **no guardes esto**. Para pausar nuevas
selecciones, desmarcar **Aprendizaje automático** en Memoria. Corregir preserva la
cita original; Retirar del contexto impide recuperarla sin borrar el registro.
El indicador de conversación muestra evaluación o fallo y acceso a Memoria.
Cerrar Alice antes de terminar puede impedir guardar ese turno; el historial
respondido permanece separado. No se procesa el historial anterior en masa.

## Dictado con revisión manual

Abrir **Dictado con revisión manual → Hablar con Alice → Empezar a hablar**.
Terminar la toma para transcribir, corregir el borrador y revisar el mensaje.
Las revisiones por envío y la confirmación del texto Fish se mantienen en este
modo. Su límite de captura sigue siendo 60 segundos/8 MiB.

## Evaluación y reporte

Antes de cambiar instrucciones, inspeccionar `src-tauri/src/cloud.rs` (prompt y
muestreo) y `src/core/conversation/cloud-payload.ts` (fuentes y orden). No asumir
que el historial visible equivale al contexto recibido: el modo manual excluye las respuestas anteriores de Alice; el automático las
conserva como diálogo no factual autorizado por la sesión. No reconstruir un envío histórico como si
fuera exacto cuando no se dispone de su payload autorizado.

Para comparaciones locales, usar únicamente un motor ya disponible y mensajes
ficticios, sin escribir en los almacenes de conversación o memoria. Mantener la
misma entrada, semilla, temperatura y límite de salida para comparar prompts;
separar esas comparaciones de pruebas exploratorias con entradas distintas.
No elevar la temperatura como remedio supuesto ni usar Fish para evaluar texto.
La revisión del 2026-09-20 mostró que un prompt más corto no garantiza mejor
conversación: persisten respuestas genéricas y preguntas innecesarias. Repetir
varios turnos antes de aceptar la mejora, incluyendo el límite del avatar futuro.

Probar, sin convertir ejemplos ficticios en recuerdos:

- Una vivencia cotidiana: retoma detalles sin derivar a productividad.
- Una consulta técnica: responde al problema sin añadir emoción innecesaria.
- Un cambio de tema: sigue el tema nuevo sin arrastrar recuerdos irrelevantes.
- Una negación, cita o emoción mezclada: evita conclusiones basadas en una palabra.
- Una corrección del usuario: ajusta la respuesta sin afirmar que guardó memoria.
- Referencias a participantes: «tu mejora» dirigida a Alice, «mi mejora» de
  Carlos, terceros nombrados, pronombres con antecedente, citas y correcciones.

La evaluación aislada de referentes se ejecuta con
`node scripts/testing/conversation-reference-eval.mjs --live`. Requiere Gemma
instalado, Ollama sin modelos cargados y el puerto 18089 libre; inicia y detiene
sólo su propio proceso. Usa ejemplos ficticios y escribe resultados en
`local/artifacts/`, sin enviar mensajes a Fish ni modificar memoria o historial.

Registrar por separado: mensaje, respuesta, fallo de contenido, fallo acústico y
resultado esperado. Un reporte acústico sin audio sólo es una observación del
usuario, no una medición. La aceptación requiere pruebas reales de varios turnos;
pasar tests de código no basta.

No adjuntar conversaciones personales ni grabaciones a archivos versionados.
Usar ejemplos ficticios identificados en pruebas de código. Cualquier síntesis
externa pasa por autorización y puede consumir cuota del proveedor.

## Memoria y limpieza

No pulsar Proponer recuerdo para ejemplos ficticios. Para datos reales, revisar y
confirmar según [operación de memoria](02-operar-memoria.md). El historial de chat
y la memoria confirmada son almacenes distintos.

Esta guía no ejecuta ni autoriza borrado masivo: identificar los intercambios de
prueba antes de cualquier limpieza y preservar información real confirmada.
Ocultar mensajes no equivale a eliminarlos.

### Vaciar el chat activo con respaldo

Sólo con solicitud explícita de limpieza del historial completo:

1. Cerrar Alice y verificar que su proceso terminó, para no conservar mensajes en RAM.
2. Resolver la raíz de datos activa y localizar `conversation/history-v1.json`.
3. Mover únicamente ese archivo a `conversation/backups/` con un nombre único,
   sin sobrescribir respaldos previos. Verificar SHA-256 antes y después.
4. Comprobar que `memory/records.json` conserva su huella y que el historial activo
   ya no existe. El backend interpreta su ausencia como cero intercambios; no es
   necesario fabricar un JSON vacío.
5. Reabrir Alice y comprobar el chat vacío. El próximo intercambio crea el historial.

El respaldo contiene datos privados y debe permanecer fuera de Git. Para restaurar,
cerrar Alice, preservar cualquier historial nuevo y recuperar el archivo respaldado
en su ubicación original, únicamente con autorización. No restaurar sobre mensajes
nuevos sin conservarlos primero.

Seguimiento 2026-09-20: limpieza solicitada ejecutada con la aplicación cerrada;
historial activo retirado, respaldo verificado y memoria confirmada sin cambios.
Pendiente comprobación visual tras reabrir. No se borraron respaldos anteriores.

## Comprobaciones de desarrollo

Desde la raíz del proyecto:

```powershell
npx vitest run src/pages/conversation/ConversationPage.test.tsx src/pages/governance/SystemSettingsPage.test.tsx src/core/voice/voice-output.test.ts
npx tsc -b
cargo test --manifest-path src-tauri/Cargo.toml --lib conversational_style --quiet
cargo test --manifest-path src-tauri/Cargo.toml --lib voice_output --quiet
git diff --check
```

Estas comprobaciones no llaman a Fish para validar calidad audible. Mantener el
VRM fuera de esta etapa, según [ADR-P-096](../decisions/ADR-P-096-prioridad-conversacional-y-voz-contextual.md).

## Vista durante la conversación

La sesión de voz admite ahora las fuentes activadas en Vista de Alice. Escoge la
cámara por nombre o comparte el escritorio y pregunta normalmente. El backend
toma imágenes por turno con Gemma local. Detener vistas es independiente de
Detener conversación; salir de la pantalla detiene ambos canales. Revisa los
límites y el procedimiento en [el manual](../MANUAL_DE_USO.md#ver-con-alice-cámara-y-escritorio)
y [ADR-P-102](../decisions/ADR-P-102-vision-conversacional-local.md).

## Música durante la sesión

Con la sesión de voz iniciada puedes pedir «reproduce mis me gusta», «pausa
Spotify» o «continúa Spotify». Para YouTube, indica canción y artista:
«reproduce [canción] de [artista] en YouTube». Alice usa Google Chrome.
Estos controles comparten la delegación autorizada y no piden permiso por turno.
El estado del reproductor se comprueba antes de confirmar la acción. Un fallo de
reproducción se devuelve como respuesta para poder seguir hablando.

Se verificó reproducción, pausa y continuación de Tus me gusta desde el chat
escrito; no sustituye la comprobación audible del reconocimiento y Fish con
música de fondo. La primera canción real de YouTube la elegirá el propietario.
Contrato: [ADR-P-104](../decisions/ADR-P-104-musica-spotify-youtube-chrome.md).

La revisión posterior detectó que «abres Spotify y reproduce mi mi música»
terminaba en una respuesta del modelo sin ejecutar la herramienta. El parser
ahora admite esa variante y la orden «abre Spotify y reproduce mi música».
Para diagnosticar otros casos, contrasta `userText` con el recibo: una acción
multimedia real usa `responseId` con prefijo `desktop:media:`, no `chatcmpl-`.
Una petición incompleta debe devolver aclaración, nunca un éxito inventado.
Ver [regresión de voz y música](../testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

## Citas con destinatario explícito

Puedes comprobar por texto: «Mi hermano me dijo: “Quiero mejorar tu forma de
explicar”. ¿De quién estaba hablando?». La respuesta debe atribuir «tu forma de
explicar» a Carlos, con fuente **Referencia explícita del mensaje**.

También se admite «Luis le dijo a Ana: “Tu explicación necesita ejemplos”.
¿De quién es la explicación?», atribuyéndola a Ana. Es una lectura local limitada
a esas estructuras, no aprendizaje nuevo del modelo. Citas múltiples, referentes
inciertos y frases sin cobertura siguen en la conversación Gemma. La prueba con
voz real y música continúa pendiente.
