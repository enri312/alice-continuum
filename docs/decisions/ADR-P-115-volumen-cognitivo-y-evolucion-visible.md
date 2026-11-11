# ADR-P-115 — Volumen cognitivo y evolución visible del aprendizaje

Fecha: 2026-11-11. Estado: implementado; aceptación personal pendiente.

## Contexto

El propietario define el Volumen como la representación del cerebro lógico de
Alice: debe mostrar su organización, actividad y evolución con los aprendizajes.
La referencia visual es el capítulo «Su cerebro» del video de
[Wichito IA](https://www.youtube.com/watch?v=3yjuZB5-XyU&t=68), junto con el extracto
de subtítulos aportado por el propietario. La referencia describe un coordinador
de flujos, memoria y salidas; no acredita actividad cerebral biológica.

## Decisión

Mantener el volumen bilateral 3D como protagonista. El mapa de módulos permanece
en **Flujo cognitivo**, sin duplicarlo en el Volumen. Cada registro visual conserva identidad, fuente, estado,
contenido e información de importancia y asociaciones emocionales disponibles.
La malla de puntos es una guía ilustrativa; sus puntos no se cuentan como recuerdos.
La escala espacial crece lentamente con el número real de registros visibles.

Separar la proyección de conocimiento de la selección para conversación. El volumen
incluye los estudios guardados aunque estén pendientes de ejercicio aprobado o
retirados del contexto; esos estados permanecen explícitos y no habilitan RAG.
Los recuerdos disponibles para conversar siguen usando sus filtros anteriores.

La primera lectura completa establece una línea base. Las incorporaciones y
actualizaciones posteriores se resaltan y aparecen en un seguimiento en RAM.
Una recuperación, un movimiento de cámara o una nueva fecha de repaso no producen
un aprendizaje nuevo. Si un ID conocido reaparece, se presenta como actualización.
No se reconstruye un historial anterior ni se crea un almacén paralelo de memoria.

Las rutas de actividad se derivan de R3 y sus extremos. Se conserva la ventana de
auditoría y se detiene la animación cuando la fuente no es confiable o la muestra
lleva más de 15 segundos sin actualizarse. Frecuencia y velocidad de partículas
son decisiones visuales, no mediciones de tráfico neuronal ni de latencia.

El modo Demostración es explícito, optativo y separado de los registros. No añade
nodos persistentes, eventos, asociaciones ni contexto para el modelo. La pausa y
la preferencia de movimiento reducido detienen la animación. Zoom, giro, traslado,
inspector, fuentes, asociaciones y paleta existentes se conservan.

## Correcciones de fuente

La auditoría puede contener eventos de gobierno sin señal cognitiva. El parser
admite ese caso sin encender actividad por su simple conteo. Las consultas del
núcleo se serializan y se descartan las respuestas recibidas tras desmontar la vista.
Las asociaciones se vuelven a consultar al cambiar sus fuentes; tanto las aristas
como la evidencia del inspector exigen versiones coincidentes con el recuerdo
actual, evitando conservar citas confirmadas sobre una versión desplazada.

## Límites

La vista no entrena pesos de Gemma, no calcula emociones propias de Alice ni
habilita decisiones, rostro, cuerpo o sensores que permanezcan planificados.
Imitar mecanismos neuronales mediante umbrales, inhibición, retardos y períodos
refractarios sería otro experimento explícito. No se presenta como implementado
por el hecho de dibujar pulsos o un contorno cerebral.

[Guía de uso](../MANUAL_DE_USO.md#volumen-cognitivo) ·
[Informe y alcance de validación](../testing/COGNITIVE_VOLUME_EVOLUTION_REPORT_2026-11-11.md).
