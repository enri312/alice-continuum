# Diseño de simulación afectiva explicable

Estado: contrato visual; motor no implementado  
Fecha: 2026-08-09

## Propósito

Alice podrá calcular señales afectivas funcionales para modular atención, memoria, estilo de respuesta y expresión futura. Serán variables de software derivadas de evidencia, no sentimientos, conciencia ni diagnósticos sobre Carlos Nuñez.

La referencia visual es el reparto emocional de *Inside Out 2 / Intensamente 2*. Alice adopta asociaciones cromáticas reconocibles, pero no copia personajes, siluetas, nombres gráficos, animaciones ni arte de Disney/Pixar. Los valores hexadecimales son una paleta propia aproximada; no se presentan como colores oficiales.

## Paleta v1

| Canal | Color Alice | Papel computacional futuro |
|---|---|---|
| Alegría | `#FFD84D` | recompensa y valencia positiva |
| Tristeza | `#4AA8FF` | pérdida, pausa y solicitud de apoyo |
| Ira | `#F04444` | obstáculo, límite y conflicto |
| Temor | `#9A6BFF` | riesgo inmediato y evitación |
| Desagrado | `#78D64B` | rechazo y protección de preferencias |
| Ansiedad | `#FF8A3D` | anticipación de resultados negativos |
| Envidia | `#45D6C6` | comparación y deseo de adquisición |
| Aburrimiento | `#4F56A6` | baja novedad y baja implicación |
| Vergüenza | `#F39AB8` | exposición social y autocorrección |
| Nostalgia | `#B9A0AA` | recuerdo autobiográfico con valencia mixta |

Nostalgia usa gris rosado para separarse del rosa vivo de Vergüenza.

## Semántica visual

- El color identifica un circuito afectivo posible.
- El brillo y el pulso representarán activación calculada.
- Un punto tenue representa estructura disponible, no actividad.
- Cada canal permanece actualmente en `0.00` y estado `planned`.
- La interfaz muestra `CAPA AFECTIVA · EN ESPERA · SIN DOMINANTE` mientras no exista evidencia.
- La densidad de memoria y la activación cognitiva continúan siendo métricas separadas.

## Evidencia necesaria para el motor

Cada cambio futuro deberá derivarse de eventos R3 correlacionados y declarar:

- señal de origen;
- regla o modelo que produjo el cambio;
- valor anterior y posterior;
- duración y decaimiento;
- grado de incertidumbre;
- módulos que pueden consumir la señal;
- motivo de cualquier bloqueo.

Una respuesta del proveedor, un color del volumen o una frase emocional no serán evidencia suficiente por sí solos.

## Estimulación cognitiva futura

Las primeras pruebas deberán ser controladas y reversibles:

1. presentar una entrada conocida y otra novedosa;
2. recuperar recuerdos relevantes con autorización;
3. comparar expectativa y resultado;
4. solicitar retroalimentación explícita de Carlos;
5. observar atención, recuperación, conflicto, decisión y salida en R3;
6. descartar las señales efímeras al finalizar la sesión salvo confirmación.

No se utilizarán estímulos engañosos, captura oculta, privación, presión emocional ni aprendizaje automático irreversible.

## Separación de responsabilidades

| Capa | Responsabilidad |
|---|---|
| Auditoría R3 | evidencia de operaciones y resultados |
| Motor afectivo futuro | cálculo de canales y decaimiento |
| Volumen neuronal | visualización, nunca fuente de verdad |
| Comportamiento | modulación limitada y explicable |
| Avatar | expresión visible derivada, desconectable |

Referencias conceptuales: [página oficial de Pixar](https://www.pixar.com/inside-out-2) y [página oficial de Disney](https://movies.disney.com/inside-out-2).
