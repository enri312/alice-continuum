# ADR-P-048 — Manifiesto local de habilidades sin código ejecutable

Fecha: 2026-08-09  
Estado: aceptada para R4

## Contexto

Alice necesita aprender procedimientos reutilizables, pero una “habilidad” no puede ser texto libre que se convierta silenciosamente en comandos. R1 ya ofrece IDs, operaciones y riesgos estables; R2 gobierna permisos y R3 aporta trazabilidad.

## Decisión

- Una habilidad será un manifiesto JSON cerrado y versionado, no un script.
- La identidad inicial pertenece al espacio `local.*` y la procedencia es `localUser`.
- Cada capacidad y operación se valida contra un snapshot R1 real.
- El riesgo declarado nunca será menor que el riesgo máximo requerido.
- Se rechazan capacidades u operaciones declaradas que ningún paso utiliza.
- Rutas locales se consideran sensibles en entradas y resultados.
- Toda habilidad nueva comienza `draft`, versión 1, desactivada y sin padre.
- R4.1 sólo admite `simulationOnly` con red, procesos y escritura deshabilitados.
- No se registra comando Tauri ni almacenamiento hasta aprobar el siguiente incremento.

## Consecuencias positivas

- No puede ocultarse PowerShell, shell o código arbitrario dentro de un paso.
- El principio de menor privilegio puede comprobarse automáticamente.
- Las revisiones futuras tendrán identidad estable y procedencia verificable.
- El mismo contrato puede inspeccionarse en Rust y TypeScript antes de persistir.

## Costos y límites

- Describir una habilidad requiere más estructura que guardar una lista de instrucciones.
- Aún no existe Taller visible, persistencia, simulación operativa, aprobación o ejecución.
- Los estados futuros están representados, pero ningún estado concede autoridad por sí mismo.

## Alternativas descartadas

### Guardar prompts como habilidades

Se descarta porque un prompt no declara privilegios, operaciones, permisos ni comprobaciones verificables.

### Permitir scripts locales

Se descarta porque introduciría una ruta de ejecución genérica incompatible con el Roadmap y el Gateway R2.

### Descargar habilidades de terceros

Se mantiene fuera de R4 porque requiere firma, procedencia, revisión de suministro y un modelo de confianza todavía inexistente.
