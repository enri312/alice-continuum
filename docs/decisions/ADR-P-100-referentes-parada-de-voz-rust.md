# ADR-P-100 — Referentes del diálogo, parada por voz y Rust 1.99.1

Fecha: 2026-11-03. Estado: implementado; comprensión general y acústica sujetas
a evaluación continua con el propietario.

## Problema y decisión

Carlos comunicó que Alice interpretó «tu mejora» como desarrollo personal de
Carlos, aunque se dirigía a ella. También solicitó terminar una sesión diciendo
«detén la conversación Alice» y actualizar Rust a la versión estable vigente.

El prompt compartido incorpora participantes y cambio de perspectiva: Carlos es
el hablante y Alice la destinataria; `yo/mi` y `tú/tu` dependen de quien habla.
Los pronombres de una cita conservan los participantes de la cita. Una tercera
persona nombrada no se sustituye por Alice. Ante antecedentes ambiguos se pide
aclaración. Las correcciones explícitas del propietario prevalecen en el diálogo.
Carlos está desarrollando a Alice; una mejora de sus respuestas corresponde a
esta asistente y no se convierte en desarrollo personal del propietario.

El mensaje actual identifica explícitamente **Carlos Nuñez → Alice**; el texto
original se conserva. Las instrucciones legibles viven en
`src-tauri/src/prompts/conversation.txt`. No se reemplazan respuestas con plantillas.
Son instrucciones de interpretación para Gemma y los adaptadores existentes;
no garantizan comprensión perfecta.

El propietario pide después un estilo más cálido, animado y propio de Alice.
Se admite un saludo natural y «sí, te escucho» como respuesta conversacional al
mensaje recibido por voz. Los ejemplos de mejoras dirigidas a Alice usan «mi
sistema», «mis respuestas» o «para mí». Son orientación de estilo, no una frase
fija en cada turno. No se afirma que todos los módulos están activos: herramientas,
sensores y avatar siguen limitados por las capacidades realmente integradas.
La indicación adicional de saludo oral sólo se agrega cuando el mensaje actual
empieza con «Hola», sin tomar saludos del historial o de una cita como señal para
saludar otra vez.

## Parada por voz

Una orden directa completa, como **Detén la conversación, Alice**, se reconoce
localmente tras transcribir. Se normalizan mayúsculas, tildes, puntuación y
espacios, y se aceptan variantes acotadas con «por favor», «para», «termina» o
«finaliza». No se buscan palabras sueltas dentro de cualquier oración.

La orden revoca la sesión, apaga captura y reproducción y deja un aviso visible.
No se envía a conversación, no crea un intercambio y no llama a Fish para
despedirse. Negaciones, citas y explicaciones de la orden continúan por el flujo
de conversación. La ausencia de habla sigue rearmando la escucha.

Esta orden está disponible **cuando Alice está escuchando** y sólo actúa cuando
se obtiene su transcripción. El modo actual apaga el micrófono durante inferencia
y reproducción: no implementa interrupción hablando encima de Alice. El botón
**Detener conversación** continúa disponible en cualquier etapa. El permiso de
sesión de ADR-P-099 y sus límites se conservan.

## Rust

Se adopta [Rust 1.99.1 estable](https://blog.rust-lang.org/2026/10/15/Rust-1.99.1/),
publicado el 15 de octubre de 2026. El canal global `stable` y el canal exacto del
proyecto se actualizan mediante rustup. `rust-toolchain.toml` fija `1.99.1`,
`clippy`, `rustfmt` y perfil mínimo para que los próximos arranques usen la misma
versión. No se actualizan dependencias Cargo ni los modelos de IA.

El cambio de compilador obliga a recompilar dependencias. No representa una
mejora demostrada de comprensión de Gemma ni de latencia de Fish.

La evaluación y sus limitaciones quedan en
[el informe de esta entrega](../testing/R9_REFERENCES_VOICE_STOP_RUST_REPORT_2026-11-03.md).
