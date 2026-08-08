# ADR-P-035 — Enseñanza guiada inicial sin datos ficticios

Fecha: 2026-08-08  
Estado: aceptada para implementación

## Contexto

Alice dispone de un formulario completo para recibir enseñanzas, pero una memoria vacía obliga a Enrique a decidir desde cero qué tema, tipo, fuente e importancia escribir. Esa fricción dificulta formar una base personal aunque el almacenamiento ya funcione.

## Decisión

- Incorporar un selector compacto de puntos de partida dentro de la pantalla Memoria.
- Ofrecer seis categorías: perfil personal, facultad, proyectos, preferencias, personas importantes y reglas para Alice.
- Cada categoría cambia únicamente las ayudas del formulario, el tipo sugerido y una importancia inicial; no inserta hechos ni crea registros.
- Mantener tema y contenido vacíos hasta que Enrique los escriba.
- Guardar continuará siendo la única confirmación que modifica `records.json`.
- La fuente sugerida será `Enrique · enseñanza directa` y seguirá siendo editable.
- No solicitar a un modelo de nube que deduzca datos personales ni transformar conversaciones antiguas en enseñanzas.

## Consecuencias

- Alice puede comenzar a formar memoria útil sin una importación masiva ni un asistente invasivo.
- Las ayudas son reutilizables y no presuponen información sobre Enrique.
- Más adelante se podrá añadir importación revisada por lotes sobre el mismo contrato de confirmación individual.

## Criterios de aceptación

1. Elegir una categoría no guarda ni transmite información.
2. Ninguna plantilla contiene datos personales reales.
3. El formulario sigue rechazando tema, contenido o fuente vacíos.
4. Una enseñanza guardada conserva tipo, fuente e importancia elegidos.
5. La interfaz continúa siendo compacta en un monitor convencional.
