# ADR-P-052 — Fronteras entre mente, cuerpo, entorno y gobierno

Fecha: 2026-08-11  
Estado: aceptada

## Contexto

Alice tendrá un núcleo cognitivo, un cuerpo expresivo y, más adelante, sesiones dentro de una sala de observación para estudiar su comportamiento y evolución gradual. Las herramientas del propietario —permisos, configuración, capacidades y habilidades— no son facultades cognitivas ni partes del cuerpo. Presentarlas juntas haría difícil distinguir lo que Alice percibe o produce de lo que Carlos autoriza y administra.

## Decisión

La arquitectura visible se divide en cuatro fronteras semánticas:

1. **Cognitive Core:** conversación, percepción interpretada, memoria, estado interno, planificación y actividad cognitiva comprobable.
2. **Embodiment Core / Body Solver:** rostro, cuerpo, avatar y, posteriormente, conexión física o virtual con un entorno.
3. **Environment / Observation Room:** alcance futuro y separado para estímulos, objetos, sesiones, métricas y reinicio controlado. No se implementa en esta decisión.
4. **Governance Core:** control externo del propietario. Contiene Registro R1, Gateway R2, auditoría y diagnóstico R3, Taller R4 y Configuración. No representa pensamiento, emoción, aprendizaje o libre albedrío de Alice.

Reglas obligatorias:

- una pantalla pertenece a un único espacio;
- el Taller no aparece dentro de `COGNITIVE IDENTIFICATION`;
- capacidades y permisos no aparecen dentro de `BODY SOLVER`;
- rostro y cuerpo abren diagnósticos físicos directos, sin pasar por herramientas administrativas;
- gobierno puede detener, limitar o inspeccionar los otros espacios, pero su actividad no se presentará como conducta espontánea de Alice;
- la futura sala entregará estímulos mediante capacidades R1 y permisos R2, y registrará evidencia R3;
- “maduración” significará cambios trazables en memoria, habilidades, parámetros o conducta, nunca conciencia fingida ni modificaciones silenciosas;
- cada sesión futura deberá tener inicio, fin, parada inmediata, límites y posibilidad de volver a una línea base verificable.

## Consecuencias

- La interfaz incorpora `SYS 00 · GOVERNANCE CORE`, visualmente separado de la mente y el cuerpo.
- `COGNITIVE CORE` conserva únicamente pantallas de percepción, memoria, estado y actividad.
- `EMBODIMENT CORE` conserva Rostro, Cuerpo y Avatar.
- La futura sala de observación se diseñará como entorno delimitado, no como una pestaña administrativa ni como acceso irrestricto al equipo.
- El backend seguro de R4 se conserva sin confundirse con el cerebro de Alice.
