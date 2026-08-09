# ADR-P-046 — Paleta afectiva propia y volumen con actividad honesta

Fecha: 2026-08-09  
Estado: aceptada para diseño incremental

## Contexto

El volumen anterior utilizaba tres colores para entrada, memoria y salida y ocultaba los puntos no activos. Con diez recuerdos mostraba una red dispersa, dificultaba distinguir estructura de actividad y no preparaba el futuro simulador afectivo solicitado para Alice.

## Decisión

- Rediseñar el volumen como matriz cognitivo-afectiva de dos lóbulos y un núcleo de identidad.
- Mantener visible la estructura completa con baja intensidad.
- Reservar brillo, tamaño y pulso para actividad calculada desde datos reales.
- Definir diez canales cromáticos propios inspirados en asociaciones de *Intensamente 2*.
- Usar Nostalgia en gris rosado y Vergüenza en rosa vivo.
- Mostrar todos los canales en `0.00` y `planned` hasta implementar el motor.
- Mantener una leyenda explícita: color significa circuito; brillo significa actividad.
- No copiar personajes, arte, siluetas o animaciones de Disney/Pixar.

## Consecuencias

- La red parece estructuralmente completa sin fingir más actividad.
- El futuro motor dispone de identificadores y colores estables.
- Una emoción dominante no puede aparecer solamente por motivos estéticos.
- El volumen admite crecimiento gradual mediante R3, memoria y asociaciones reales.

## Límite

Este ADR implementa presentación y contrato de canales, no un simulador emocional. Alice todavía no calcula Alegría, Tristeza, Ira, Temor, Desagrado, Ansiedad, Envidia, Aburrimiento, Vergüenza o Nostalgia.
