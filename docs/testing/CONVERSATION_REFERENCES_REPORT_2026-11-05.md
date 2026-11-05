# Conversación: referencias explícitas

Fecha: 2026-11-05. Base: `8de6e19`.

## Problemas reproducidos

En evaluación de texto ficticio con Gemma real se observaron apropiaciones de
«mi hermano», destinatarios incorrectos en citas y un «ella» singular atribuido
a dos personas. En una secuencia sintética de cinco turnos también persistieron
respuestas genéricas y una pérdida del tema al final.

Se compararon prompts, roles separados, temperatura, JSON, anotaciones y
razonamiento. Ninguna alternativa demostró corregir todo de forma fiable. El
razonamiento sin límite alcanzó una mediana aproximada de 10,1 s frente a 0,8 s
en diez casos de texto. Un límite de 192 tokens añadió varios segundos y todavía
falló una cita en la comprobación nativa con otra semilla. No se adopta esa ruta.
Son ensayos exploratorios, no una medición de conversación completa ni una
estimación estadística de precisión.

## Cambio aceptado

Una resolución gramatical local responde preguntas sobre un posesivo dentro de
una cita con destinatario explícito. Por ejemplo, «tu explicación» pertenece a
Carlos si alguien se lo dijo a él, o a Ana si se lo dijeron a Ana. La respuesta
declara su procedencia y no llama al modelo. Los casos sin cobertura conservan
el diálogo Gemma existente. No se activan nuevos modelos ni captura de audio.

Se comprueban interlocutores explícitos, nombres con acentos, citas rectas y
tipográficas; además, abstención ante múltiples citas, anidación, negaciones,
hipótesis, coordinación de nombres, parentescos y preguntas ajenas al posesivo.
El despachador verifica fuente, cero tokens y continuidad de otros proveedores.

## Verificación

- Rust: 330 pruebas aprobadas, 28 ignoradas.
- Frontend: 563 aprobadas, 2 omitidas; build TypeScript/Vite aprobado.
- Integridad: 62 archivos de datos y activos conservan sus SHA-256.
- Clippy con `-D warnings` y compilación nativa de Windows: aprobados.
- CI Ubuntu 24.04 aprobada en [41964663108](https://github.com/enri312/alice-continuum/actions/runs/41964663108), código `b751981`: 329 pruebas Rust, prueba documental adicional, 563 frontend, cinco Python, Clippy, build y arranque aislado. La prueba específica de Windows explica la diferencia de recuento. Esto no acredita Ubuntu 26.04.1 ni dispositivos reales.
- Permanece el aviso previo de Vite por tamaño de paquetes.

Evidencia privada: `local/artifacts/r9-conversation-context-2026-11-05/`, incluidas
las alternativas rechazadas y sus respuestas completas. El evaluador Node mide
al modelo aislado; las respuestas locales del producto se verifican en Rust.

La sesión QA nativa se abrió con cero recuerdos y fuentes apagadas. Se cargó una
frase ficticia por accesibilidad, pero el controlador de interfaz no dispuso de
geometría para pulsar Enviar. No se declara aprobado ese recorrido visual ni su
persistencia. Se cerraron la sesión y el servidor QA; los datos canónicos no se
usaron. No se activó micrófono, cámara ni reproducción de audio.

## Pendiente

Carlos aún no probó esta entrega con su voz porque era tarde. Quedan aceptación
con música de notebook y otro equipo, continuidad conversacional, ambigüedades,
latencia de síntesis, activación por nombre e interrupción durante reproducción.
R9 no se cierra con este incremento. Avatar, cuerpo y domótica permanecen fuera
del trabajo activo.
