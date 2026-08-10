# ADR-P-047 — Actividad efímera del Núcleo derivada de R3

Fecha: 2026-08-09  
Estado: aceptada

## Contexto

El Núcleo separaba visualmente estructura aprendida y actividad, pero varios pulsos todavía dependían de estado temporal de React y fórmulas de presentación. R3 ya ofrece eventos técnicos persistentes, mínimos y correlacionados. Era necesario usarlos sin convertir telemetría en emociones, conciencia o aprendizaje.

## Decisión

- Crear un snapshot nativo de solo lectura distinto del archivo persistente.
- Considerar únicamente eventos R3 válidos de los últimos cinco minutos.
- Adoptar el método reproducible `r3-recency-v1`, siempre marcado como heurística.
- Derivar seis regiones y cinco enlaces desde origen y capacidad mediante un mapeo cerrado.
- Exponer cantidad de eventos junto a cada intensidad; un cero significa ausencia de evidencia en la ventana.
- Mantener densidad estructural ligada exclusivamente a memoria local.
- Mantener afecto, intención, utilidad, riesgo y decisión en cero o sin calcular mientras no exista su motor auditable.
- Rechazar en TypeScript campos desconocidos, topología alterada y conteos incoherentes.

## Consecuencias positivas

- Cada brillo temporal puede explicarse mediante eventos R3 concretos.
- Cerrar o esperar cinco minutos apaga la señal sin borrar memoria.
- Un archivo vacío o antiguo no aparenta actividad.
- La lectura no agrega crecimiento al JSONL ni modifica datos privados.

## Costos y límites

- La señal describe actividad técnica reciente, no intensidad cognitiva biológica.
- La ventana y los divisores son parámetros de visualización versionados, no medidas científicas.
- El inicio de proceso activa únicamente la región de contexto; no prueba percepción ni razonamiento.
- Los 200 eventos visibles del archivo actual bastan para la ventana vigente, pero no forman una métrica histórica.

## Alternativas descartadas

### Usar mensajes, memoria total o estado `pending` de React como actividad

Se descarta porque mezcla datos con ciclos de vida distintos y no garantiza una fuente nativa correlacionada.

### Animación aleatoria o densidad fija

Se descarta porque haría parecer vivo un sistema sin evidencia reciente.

### Presentar la puntuación como emoción

Se descarta porque R3 no contiene un modelo afectivo ni evidencia de experiencia interna.
