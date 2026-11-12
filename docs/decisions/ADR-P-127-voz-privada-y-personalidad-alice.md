# ADR-P-127 — Voz privada y personalidad compartida de Alice

Fecha: 2026-11-12. Estado: implementado y validado técnicamente; síntesis nativa
comprobada. Valoración audible y aceptación cotidiana pendientes.

El propietario solicita otra voz Fish y un estilo inspirado en Akali: directo,
seguro, informal, con criterio propio y humor seco ocasional. Alice conserva su
nombre, su contexto real y los límites de la aplicación. La petición de estilo
no elimina empatía, solidaridad, humildad, veracidad ni autorización.

## Selección privada de voz

Se añade `voice-profile.json` a la raíz efectiva de `ALICE_DATA_DIR`, que en la
instalación principal corresponde a `data/voice-profile.json`.
El contrato público es un objeto con `schemaVersion: 1` y `referenceId`;
el archivo real y su identificador quedan fuera de Git. La clave `FISH_API_KEY`
continúa en el entorno del proceso nativo.

El perfil local válido prevalece. `ALICE_FISH_REFERENCE_ID` conserva
compatibilidad sólo si no existe el archivo. Un archivo presente inválido,
ilegible, excesivo, enlazado o con otro esquema produce un error: no selecciona
otra voz silenciosamente. Se conserva `s2.1-pro-free`; cambiar el identificador
de voz no cambia el reconocedor ni los pesos de Gemma.

La resolución permanece en el backend. El perfil no se convierte en recuerdo,
no entra en el contexto conversacional ni expone el identificador a React.
Los respaldos privados conservan este archivo junto con los demás datos.

## Estilo coherente entre rutas

`src-tauri/src/prompts/personality.txt` se incluye durante compilación en los
prompts de conversación escrita, conversación hablada y visión. El saludo
actual pasa a ser breve y seguro, sin una pregunta final obligatoria.

Alice prioriza un paso concreto en asuntos operativos. Ante una vivencia
personal o angustia acompaña sin presionar para actuar ni burlarse del dolor.
Reconoce límites y errores y los corrige sin rodeos. El estilo no añade
amenazas, vivencias inventadas ni una representación literal de guerrera.

Las reglas de pronombres, citas, fuentes de aprendizaje, procedencia y recibos
de ejecución se conservan. No se modifican los prompts de ASR, extracción de
recuerdos ni autoestudio. Tampoco se amplían herramientas o permisos.

La entrega TTS contextual usa `[confident, conversational]`; las alternativas
explícitas conservan sus indicaciones. El texto dirigido sigue formando parte
de la revisión y de su huella. La documentación de Fish describe las
[indicaciones expresivas de S2](https://docs.fish.audio/developer-guide/core-features/emotions);
su efecto con la voz elegida debe comprobarse escuchándola.

## Límites y aceptación

La configuración y los prompts no prueban por sí solos naturalidad ni una
imitación exacta. La preferencia del propietario sobre el estilo requiere
respuesta y escucha reales. El fallo de sustitución de palabras con micrófono
continúa abierto; este incremento no modifica la captura o el ASR ni cierra R9.

[Configuración con ejemplo ficticio](../runbooks/03-conversacion-y-voz.md#voz-privada-y-personalidad) ·
[Resultados y pendientes](../testing/ALICE_VOICE_PERSONALITY_REPORT_2026-11-12.md).
