# ADR-P-099 — Sesión de voz automática y Node 26 LTS

Fecha: 2026-11-03. Estado: implementado; evaluación acústica y de latencia con el propietario pendiente.

## Cambio autorizado

El propietario solicita conversar sin confirmar cada turno y mejorar la forma
de hablar. Esta instrucción reemplaza el requisito anterior de confirmar cada
mensaje hablado y cada síntesis Fish. Se conserva el modo manual como opción.
También autoriza actualizar Node en el equipo, el proyecto y su documentación.

## Sesión de voz

**Iniciar conversación por voz** informa que el audio se transcribe con Gemma
local y que Fish recibe las respuestas para sintetizarlas. Esa acción prepara
Gemma y crea una sesión efímera nativa. Durante la sesión se captura una frase,
se transcribe, se responde, se reproduce y se vuelve a escuchar automáticamente.
No aparecen autorizaciones por turno. La primera concesión del micrófono por
Windows/WebView2 puede requerir interacción con el sistema.

La sesión sólo admite conversación Gemma y voz Fish. No autoriza herramientas,
escritura de recuerdos confirmados, cámara, observación de ventana ni cambio de
proveedor. Los controles existentes de historial y recuerdos se mantienen.
El diálogo generado durante la sesión vuelve como contexto no factual para
mantener el hilo. El historial anterior depende de su casilla, igual que los
recuerdos. Las respuestas de Alice no se incorporan como evidencia RAG. El modo
escrito/manual conserva su política.

Un detector local de energía segmenta la toma después de un segundo de pausa.
Exige más de una muestra de voz y rearma períodos silenciosos sin inferencia.
No es un reconocedor semántico: ruido persistente o una televisión pueden
confundirse con voz. Las tomas automáticas se limitan a 20 segundos y 8 MiB.
El botón **Terminé de hablar** permite cerrar una frase manualmente.

El micrófono se apaga durante transcripción, respuesta y reproducción. Se trata
de turnos automáticos, no dúplex con escucha simultánea ni interrupción por voz.
**Detener conversación**, salir de la pantalla, cerrar Alice o llegar a dos horas
termina la sesión. El backend verifica su identificador antes de aceptar etapas
nuevas; los resultados tardíos se descartan. No se garantiza cancelar trabajo
que ya esté procesando el modelo o el proveedor. Un error detiene la sesión y
no repite automáticamente solicitudes externas.

La salida oral solicita respuestas normalmente de una a tres frases y limita
su generación a 240 tokens. Fish recibe una indicación breve de interpretación,
con `latency=balanced` y velocidad 1.0. Esto reduce pasos y longitud potencial;
no demuestra por sí solo mejor calidad audible ni respuesta instantánea.

## Node

Se adopta Node **26.13.0 LTS Lithium**, con npm **11.20.0**, publicado oficialmente
el 28 de octubre de 2026. El instalador de Windows se verifica por SHA-256 y firma
OpenJS antes de actualizar la instalación de `C:\Program Files\nodejs`.

`package.json` y el lock declaran la rama 26 (mínimo 26.13); `.node-version` fija
26.13.0. El lanzador comprueba esa rama y puede usar la copia verificada local en
`%LOCALAPPDATA%\Programs\AliceNode`. No se cambian versiones de dependencias ni
pesos/motores de IA como parte de esta actualización.

Node es parte de las herramientas de desarrollo. Su actualización no implica
que Gemma ni Fish generen más deprisa.

## Referencias

- [Node 26.13.0 LTS](https://nodejs.org/en/blog/release/v26.13.0).
- [API Fish y parámetros de latencia](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).
- [Indicaciones expresivas Fish S2](https://docs.fish.audio/developer-guide/best-practices/emotion-control).
- [Informe de esta entrega](../testing/R9_HANDS_FREE_NODE26_REPORT_2026-11-03.md).
